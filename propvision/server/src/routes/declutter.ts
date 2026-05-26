import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { createJob, enqueueAndPublish } from "../services/jobs.js";
import { storage } from "../services/storage.js";
import { v4 as uuid } from "uuid";

export const declutterRouter = Router();

const schema = z.object({
  projectId: z.string().uuid().optional(),
  mode: z.enum(["AUTO", "MANUAL"]),
  assetId: z.string().uuid().optional(),
  imageBase64: z.string().optional(),
  maskBase64: z.string().optional(),
});

declutterRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  let projectId = parsed.data.projectId;
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        name: `Declutter ${new Date().toISOString().slice(0, 10)}`,
        type: "DECLUTTER",
      },
    });
    projectId = project.id;
  }

  let assetId = parsed.data.assetId;
  if (!assetId && parsed.data.imageBase64) {
    const buf = Buffer.from(parsed.data.imageBase64.replace(/^data:[^,]+,/, ""), "base64");
    const key = `${projectId}/${uuid()}.jpg`;
    await storage.put(key, buf, "image/jpeg");
    const asset = await prisma.asset.create({
      data: {
        projectId,
        type: "SOURCE_IMAGE",
        storageUrl: storage.publicUrl(key),
        mimeType: "image/jpeg",
        fileSizeBytes: buf.byteLength,
        metadata: { storageKey: key },
      },
    });
    assetId = asset.id;
  }
  if (!assetId) return res.status(400).json({ error: "no_image_provided" });

  let maskAssetId: string | undefined;
  if (parsed.data.mode === "MANUAL") {
    if (!parsed.data.maskBase64) return res.status(400).json({ error: "mask_required_for_manual" });
    const buf = Buffer.from(parsed.data.maskBase64.replace(/^data:[^,]+,/, ""), "base64");
    const key = `${projectId}/${uuid()}-mask.png`;
    await storage.put(key, buf, "image/png");
    const mask = await prisma.asset.create({
      data: {
        projectId,
        type: "MASK",
        storageUrl: storage.publicUrl(key),
        mimeType: "image/png",
        fileSizeBytes: buf.byteLength,
        metadata: { storageKey: key },
      },
    });
    maskAssetId = mask.id;
  }

  try {
    const job = await createJob({
      userId: req.user!.id,
      projectId,
      type: "DECLUTTER",
      params: { sourceAssetId: assetId, mode: parsed.data.mode, maskAssetId },
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
