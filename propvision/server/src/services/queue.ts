import { Queue, Worker, QueueEvents, Job as BullJob } from "bullmq";
import { env } from "../env.js";

export const QUEUE_NAME = "ai-jobs";

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as null,
};

export const aiQueue = new Queue(QUEUE_NAME, { connection });

export const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

export interface AiJobData {
  jobId: string;
  type: string;
  params: Record<string, unknown>;
  userId: string;
  projectId: string;
}

export async function enqueueAiJob(data: AiJobData, opts?: { priority?: number; delay?: number }) {
  return aiQueue.add(data.type, data, {
    priority: opts?.priority ?? 0,
    delay: opts?.delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  });
}

export function makeWorker(processor: (job: BullJob<AiJobData>) => Promise<unknown>) {
  return new Worker<AiJobData>(QUEUE_NAME, processor, {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 },
    lockDuration: 5 * 60_000,
  });
}
