import { Router } from "express";
import { authRequired, adminRequired, AuthedRequest } from "../middleware/auth.js";
import { aiQueue } from "../services/queue.js";

export const adminRouter = Router();

adminRouter.get("/queue-health", authRequired, adminRequired, async (_req: AuthedRequest, res) => {
  try {
    const counts = await aiQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    const workers = await aiQueue.getWorkers();
    const client = await aiQueue.client;
    res.json({
      counts,
      workerCount: workers.length,
      redis: client.status,
    });
  } catch (err) {
    res.status(503).json({
      error: "queue_unavailable",
      message: (err as Error).message,
    });
  }
});
