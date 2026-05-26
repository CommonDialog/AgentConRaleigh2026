import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { createJob, enqueueAndPublish } from "../services/jobs.js";
import { storage } from "../services/storage.js";
import { v4 as uuid } from "uuid";

export const optimizeRouter = Router();

const schema = z.object({
  projectId: z.string().uuid().optional(),
  imageBase64: z.string().optional(),
  assetId: z.string().uuid().optional(),
  goals: z.array(z.string()).default([]),
  region: z.string().min(1),
  climateZone: z.string().optional(),
});

optimizeRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  let projectId = parsed.data.projectId;
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        name: `Optimization ${new Date().toISOString().slice(0, 10)}`,
        type: "SPACE_OPTIMIZATION",
      },
    });
    projectId = project.id;
  }

  let assetId = parsed.data.assetId;
  if (!assetId && parsed.data.imageBase64) {
    const buf = Buffer.from(parsed.data.imageBase64.replace(/^data:[^,]+,/, ""), "base64");
    const key = `${projectId}/${uuid()}-floorplan.jpg`;
    await storage.put(key, buf, "image/jpeg");
    const asset = await prisma.asset.create({
      data: {
        projectId,
        type: "FLOOR_PLAN",
        storageUrl: storage.publicUrl(key),
        mimeType: "image/jpeg",
        fileSizeBytes: buf.byteLength,
        metadata: { storageKey: key },
      },
    });
    assetId = asset.id;
  }
  if (!assetId) return res.status(400).json({ error: "no_image_provided" });

  try {
    const job = await createJob({
      userId: req.user!.id,
      projectId,
      type: "SPACE_OPTIMIZATION",
      params: {
        sourceAssetId: assetId,
        goals: parsed.data.goals,
        region: parsed.data.region,
        climateZone: parsed.data.climateZone || "mixed",
      },
    });
    await enqueueAndPublish(job.id);
    res.status(201).json({ jobId: job.id, projectId });
  } catch (err) {
    const e = err as Error & { required?: number; balance?: number };
    if (e.message === "insufficient_credits") {
      return res.status(402).json({ error: "insufficient_credits", required: e.required, balance: e.balance });
    }
    throw err;
  }
});
