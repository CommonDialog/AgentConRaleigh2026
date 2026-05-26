import { Job as BullJob } from "bullmq";
import { prisma } from "../db.js";
import { makeWorker, AiJobData } from "../services/queue.js";
import { publishProgress, refundJob } from "../services/jobs.js";
import { streaming } from "../services/streaming.js";
import { handleStaging } from "./handlers/staging.js";
import { handleEnvironmental } from "./handlers/environmental.js";
import { handleDeclutter } from "./handlers/declutter.js";
import { handleSketchRender } from "./handlers/sketchRender.js";
import { handleSpaceOptimization } from "./handlers/spaceOptimization.js";

export type HandlerCtx = {
  jobId: string;
  userId: string;
  projectId: string;
  params: Record<string, unknown>;
  progress: (pct: number, step: string, data?: unknown) => Promise<void>;
};

async function dispatch(job: BullJob<AiJobData>) {
  const { jobId, type, userId, projectId, params } = job.data;

  await publishProgress({ jobId, status: "PROCESSING", progress: 5, step: "started" });

  const ctx: HandlerCtx = {
    jobId,
    userId,
    projectId,
    params,
    progress: async (pct, step, data) => {
      await publishProgress({ jobId, status: "PROCESSING", progress: pct, step, data });
    },
  };

  let result: unknown;
  switch (type) {
    case "STAGING":
      result = await handleStaging(ctx);
      break;
    case "ENVIRONMENTAL_EDIT":
      result = await handleEnvironmental(ctx);
      break;
    case "DECLUTTER":
      result = await handleDeclutter(ctx);
      break;
    case "SKETCH_RENDER":
      result = await handleSketchRender(ctx);
      break;
    case "SPACE_OPTIMIZATION":
      result = await handleSpaceOptimization(ctx);
      break;
    default:
      throw new Error(`unknown_job_type:${type}`);
  }

  await prisma.job.update({ where: { id: jobId }, data: { result: result as object } });
  await publishProgress({ jobId, status: "COMPLETE", progress: 100, step: "complete", data: result });
  return result;
}

async function main() {
  await streaming.connect();
  const worker = makeWorker(dispatch);

  worker.on("failed", async (bullJob, err) => {
    if (!bullJob) return;
    const { jobId } = bullJob.data;
    const isFinal = bullJob.attemptsMade >= (bullJob.opts.attempts ?? 1);
    if (!isFinal) {
      await publishProgress({ jobId, progress: 5, step: `retry_${bullJob.attemptsMade}` });
      return;
    }
    await prisma.job.update({
      where: { id: jobId },
      data: { error: err.message, status: "FAILED", completedAt: new Date() },
    });
    await refundJob(jobId, `error: ${err.message}`);
    await publishProgress({ jobId, status: "FAILED", progress: 100, step: "failed", data: { error: err.message } });
  });

  worker.on("ready", () => console.log("[worker] ready"));
  worker.on("error", (err) => console.error("[worker] error", err));

  console.log("[worker] started");
}

main().catch((err) => {
  console.error("[worker] startup failed", err);
  process.exit(1);
});
