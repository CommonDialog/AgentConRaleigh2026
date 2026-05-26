import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { AssetType } from "@prisma/client";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { storage } from "../services/storage.js";

export const assetsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
  "application/pdf",
  "image/svg+xml",
  "application/vnd.dxf",
  "application/dxf",
]);

const uploadBodySchema = z.object({
  projectId: z.string().uuid(),
  type: z.nativeEnum(AssetType).default("SOURCE_IMAGE"),
});

assetsRouter.post("/upload", authRequired, upload.single("file"), async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" });
  if (!ALLOWED_MIME.has(req.file.mimetype)) return res.status(400).json({ error: "unsupported_mime" });

  const parsed = uploadBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, userId: req.user!.id, deletedAt: null },
  });
  if (!project) return res.status(404).json({ error: "project_not_found" });

  const ext = (req.file.originalname.split(".").pop() || "bin").toLowerCase();
  const key = `${parsed.data.projectId}/${uuid()}.${ext}`;
  await storage.put(key, req.file.buffer, req.file.mimetype);

  let width: number | undefined;
  let height: number | undefined;
  let thumbnailUrl: string | undefined;

  if (req.file.mimetype.startsWith("image/") && req.file.mimetype !== "image/svg+xml") {
    try {
      const meta = await sharp(req.file.buffer).metadata();
      width = meta.width;
      height = meta.height;
      const thumb = await sharp(req.file.buffer)
        .resize({ width: 400, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const thumbKey = `thumbnails/${parsed.data.projectId}/${uuid()}.jpg`;
      const thumbResult = await storage.put(thumbKey, thumb, "image/jpeg");
      thumbnailUrl = thumbResult.url;
    } catch (err) {
      console.warn("[assets] thumbnail failed", err);
    }
  }

  const asset = await prisma.asset.create({
    data: {
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      storageUrl: storage.publicUrl(key),
      thumbnailUrl,
      mimeType: req.file.mimetype,
      width,
      height,
      fileSizeBytes: req.file.size,
      metadata: { originalName: req.file.originalname, storageKey: key },
    },
  });

  res.status(201).json(asset);
});

assetsRouter.get("/:assetId", authRequired, async (req: AuthedRequest, res) => {
  const asset = await prisma.asset.findFirst({
    where: { id: req.params.assetId, project: { userId: req.user!.id }, deletedAt: null },
    include: { project: true },
  });
  if (!asset) return res.status(404).json({ error: "not_found" });
  res.json(asset);
});

assetsRouter.get("/:assetId/download", authRequired, async (req: AuthedRequest, res) => {
  const asset = await prisma.asset.findFirst({
    where: { id: req.params.assetId, project: { userId: req.user!.id }, deletedAt: null },
  });
  if (!asset) return res.status(404).json({ error: "not_found" });
  const meta = (asset.metadata as { storageKey?: string }) || {};
  const key = meta.storageKey || asset.storageUrl;
  const url = await storage.signedUrl(key, 15 * 60);
  res.redirect(url);
});

assetsRouter.delete("/:assetId", authRequired, async (req: AuthedRequest, res) => {
  const asset = await prisma.asset.findFirst({
    where: { id: req.params.assetId, project: { userId: req.user!.id } },
  });
  if (!asset) return res.status(404).json({ error: "not_found" });
  await prisma.asset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
  res.json({ ok: true });
});
