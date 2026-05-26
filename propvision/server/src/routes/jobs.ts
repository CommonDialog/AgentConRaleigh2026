import { Router, Response } from "express";
import { z } from "zod";
import { ProjectType } from "@prisma/client";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { createJob, enqueueAndPublish, refundJob, publishProgress } from "../services/jobs.js";
import { aiQueue } from "../services/queue.js";
import { streaming } from "../services/streaming.js";

export const jobsRouter = Router();

const createSchema = z.object({
  projectId: z.string().uuid(),
  type: z.nativeEnum(ProjectType),
  params: z.record(z.unknown()).default({}),
  priority: z.number().int().optional(),
});

jobsRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: req.user!.id, deletedAt: null },
  });
  if (!project) return res.status(404).json({ error: "project_not_found" });

  try {
    const job = await createJob({
      userId: req.user!.id,
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      params: parsed.data.params,
      priority: parsed.data.priority,
    });
    await enqueueAndPublish(job.id);
    res.status(201).json(job);
  } catch (err) {
    const e = err as Error & { required?: number; balance?: number };
    if (e.message === "insufficient_credits") {
      return res.status(402).json({
        error: "insufficient_credits",
        required: e.required,
        balance: e.balance,
      });
    }
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

jobsRouter.get("/:jobId", authRequired, async (req: AuthedRequest, res) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.jobId, userId: req.user!.id },
  });
  if (!job) return res.status(404).json({ error: "not_found" });
  res.json(job);
});

jobsRouter.post("/:jobId/cancel", authRequired, async (req: AuthedRequest, res) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.jobId, userId: req.user!.id },
  });
  if (!job) return res.status(404).json({ error: "not_found" });
  if (job.status === "COMPLETE" || job.status === "FAILED" || job.status === "CANCELLED") {
    return res.status(400).json({ error: "cannot_cancel" });
  }

  const queued = await aiQueue.getJob(job.id);
  if (queued) {
    try { await queued.remove(); } catch { /* may already be active */ }
  }

  await refundJob(job.id, "user_cancelled");
  await publishProgress({ jobId: job.id, status: "CANCELLED", progress: 100, step: "cancelled" });
  res.json({ ok: true });
});

const confirmSchema = z.object({ removeItems: z.array(z.string()) });
jobsRouter.put("/:jobId/confirm", authRequired, async (req: AuthedRequest, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const job = await prisma.job.findFirst({
    where: { id: req.params.jobId, userId: req.user!.id },
  });
  if (!job) return res.status(404).json({ error: "not_found" });
  if (job.status !== "STREAMING") return res.status(400).json({ error: "job_not_awaiting_confirmation" });

  await prisma.job.update({
    where: { id: job.id },
    data: { params: { ...(job.params as object), confirmation: parsed.data } },
  });
  await streaming.notify({
    jobId: job.id,
    projectId: job.projectId,
    userId: job.userId,
    status: "STREAMING",
    progress: 50,
    step: "user_confirmed",
    data: parsed.data,
  });
  res.json({ ok: true });
});

jobsRouter.get("/:jobId/stream", authRequired, async (req: AuthedRequest, res: Response) => {
  const job = await prisma.job.findFirst({
    where: { id: req.params.jobId, userId: req.user!.id },
  });
  if (!job) return res.status(404).json({ error: "not_found" });

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("init", { jobId: job.id, status: job.status });

  if (job.status === "COMPLETE" || job.status === "FAILED" || job.status === "CANCELLED") {
    send(job.status.toLowerCase(), { jobId: job.id, status: job.status, result: job.result, error: job.error });
    return res.end();
  }

  await streaming.connect();
  const off = streaming.onJob(job.id, (payload) => {
    send("update", payload);
    if (payload.status === "COMPLETE" || payload.status === "FAILED" || payload.status === "CANCELLED") {
      off();
      res.end();
    }
  });

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    off();
  });
});

export const projectJobsRouter = Router({ mergeParams: true });
projectJobsRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
  const projectId = (req.params as { projectId: string }).projectId;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: req.user!.id, deletedAt: null },
  });
  if (!project) return res.status(404).json({ error: "not_found" });
  const jobs = await prisma.job.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(jobs);
});
