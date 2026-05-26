import { ProjectType, JobStatus } from "@prisma/client";
import { prisma } from "../db.js";
import { CREDIT_COST } from "../config/credits.js";
import { enqueueAiJob } from "./queue.js";
import { streaming, JobUpdatePayload } from "./streaming.js";

export async function createJob(args: {
  userId: string;
  projectId: string;
  type: ProjectType;
  params: Record<string, unknown>;
  priority?: number;
}) {
  const cost = CREDIT_COST[args.type];

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: args.userId } });
    if (!user) throw new Error("user_not_found");
    if (user.creditsBalance < cost) {
      const err = new Error("insufficient_credits") as Error & { required?: number; balance?: number };
      err.required = cost;
      err.balance = user.creditsBalance;
      throw err;
    }

    const job = await tx.job.create({
      data: {
        userId: args.userId,
        projectId: args.projectId,
        type: args.type,
        status: "QUEUED",
        priority: args.priority ?? 0,
        creditsCost: cost,
        params: args.params as object,
      },
    });

    if (cost > 0) {
      await tx.user.update({
        where: { id: args.userId },
        data: { creditsBalance: { decrement: cost } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: args.userId,
          amount: -cost,
          type: "CONSUMPTION",
          jobId: job.id,
          description: `Reserved for ${args.type} job`,
        },
      });
    }

    return job;
  });
}

export async function refundJob(jobId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: jobId } });
    if (!job || job.creditsCost === 0) return;
    const alreadyRefunded = await tx.creditTransaction.findFirst({
      where: { jobId, type: "REFUND" },
    });
    if (alreadyRefunded) return;
    await tx.user.update({
      where: { id: job.userId },
      data: { creditsBalance: { increment: job.creditsCost } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: job.userId,
        amount: job.creditsCost,
        type: "REFUND",
        jobId,
        description: `Refund: ${reason}`,
      },
    });
  });
}

export async function publishProgress(args: {
  jobId: string;
  status?: JobStatus;
  progress: number;
  step?: string;
  data?: unknown;
}) {
  const job = await prisma.job.findUnique({ where: { id: args.jobId } });
  if (!job) return;

  if (args.status && args.status !== job.status) {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "PROCESSING" && !job.startedAt) updates.startedAt = new Date();
    if (args.status === "COMPLETE" || args.status === "FAILED" || args.status === "CANCELLED") {
      updates.completedAt = new Date();
    }
    await prisma.job.update({ where: { id: args.jobId }, data: updates });
  }

  const payload: JobUpdatePayload = {
    jobId: job.id,
    projectId: job.projectId,
    userId: job.userId,
    status: (args.status ?? job.status) as JobUpdatePayload["status"],
    progress: args.progress,
    step: args.step,
    data: args.data,
  };
  await streaming.notify(payload);
}

export async function enqueueAndPublish(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  await enqueueAiJob(
    {
      jobId: job.id,
      type: job.type,
      params: (job.params as Record<string, unknown>) || {},
      userId: job.userId,
      projectId: job.projectId,
    },
    { priority: job.priority },
  );
  await publishProgress({ jobId, progress: 0, step: "queued" });
}
