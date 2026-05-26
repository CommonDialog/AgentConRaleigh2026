import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { createJob, enqueueAndPublish } from "../services/jobs.js";
import { storage } from "../services/storage.js";
import { v4 as uuid } from "uuid";

export const environmentalRouter = Router();

const SUBTYPES = ["HDR_BLEND", "SKY_REPLACE", "DAY_TO_DUSK"] as const;
const SKY_TYPES = ["BLUE_SKY", "DRAMATIC_CLOUDS", "GOLDEN_HOUR", "TWILIGHT"] as const;

const schema = z.object({
  projectId: z.string().uuid().optional(),
  subtype: z.enum(SUBTYPES),
  skyType: z.enum(SKY_TYPES).optional(),
  imageBase64: z.string().optional(),
  assetId: z.string().uuid().optional(),
});

environmentalRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });

  let projectId = parsed.data.projectId;
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        name: `Environmental ${new Date().toISOString().slice(0, 10)}`,
        type: "ENVIRONMENTAL_EDIT",
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

  try {
    const job = await createJob({
      userId: req.user!.id,
      projectId,
      type: "ENVIRONMENTAL_EDIT",
      params: { sourceAssetId: assetId, subtype: parsed.data.subtype, skyType: parsed.data.skyType },
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
