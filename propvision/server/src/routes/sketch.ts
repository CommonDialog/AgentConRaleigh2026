import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { createJob, enqueueAndPublish } from "../services/jobs.js";
import { storage } from "../services/storage.js";
import { v4 as uuid } from "uuid";

export const sketchRouter = Router();

const schema = z.object({
  projectId: z.string().uuid().optional(),
  sketchBase64: z.string(),
  style: z.enum(["architectural", "interior", "landscape"]),
  fidelity: z.number().int().min(0).max(100).default(75),
  promptAdditions: z.string().max(500).optional(),
});

sketchRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  let projectId = parsed.data.projectId;
  if (!projectId) {
    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        name: `Sketch ${new Date().toISOString().slice(0, 10)}`,
        type: "SKETCH_RENDER",
      },
    });
    projectId = project.id;
  }

  const buf = Buffer.from(parsed.data.sketchBase64.replace(/^data:[^,]+,/, ""), "base64");
  const key = `${projectId}/${uuid()}-sketch.png`;
  await storage.put(key, buf, "image/png");
  const asset = await prisma.asset.create({
    data: {
      projectId,
      type: "SKETCH",
      storageUrl: storage.publicUrl(key),
      mimeType: "image/png",
      fileSizeBytes: buf.byteLength,
      metadata: { storageKey: key },
    },
  });

  try {
    const job = await createJob({
      userId: req.user!.id,
      projectId,
      type: "SKETCH_RENDER",
      params: {
        sketchAssetId: asset.id,
        style: parsed.data.style,
        fidelity: parsed.data.fidelity,
        promptAdditions: parsed.data.promptAdditions || "",
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
