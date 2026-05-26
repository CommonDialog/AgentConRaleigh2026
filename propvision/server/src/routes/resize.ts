import { Router } from "express";
import { z } from "zod";
import sharp from "sharp";
import archiver from "archiver";
import { v4 as uuid } from "uuid";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { storage, readFromUrl } from "../services/storage.js";
import { FORMAT_PRESETS } from "../config/formats.js";

export const resizeRouter = Router();

resizeRouter.get("/formats", (_req, res) => {
  res.json(Object.values(FORMAT_PRESETS));
});

const resizeSchema = z.object({
  assetId: z.string().uuid(),
  formats: z.array(z.string()).min(1),
  outputFormat: z.enum(["jpeg", "png"]).default("jpeg"),
});

async function processFormat(input: Buffer, format: ReturnType<typeof Object.values<typeof FORMAT_PRESETS>>[number], outputFormat: "jpeg" | "png") {
  const meta = await sharp(input).metadata();
  const srcW = meta.width || format.width;
  const srcH = meta.height || format.height;

  const upscale = format.width > srcW || format.height > srcH;
  let pipeline = sharp(input).resize({
    width: format.width,
    height: format.height,
    fit: "cover",
    position: "attention",
    kernel: upscale ? sharp.kernel.lanczos3 : sharp.kernel.lanczos3,
  });

  pipeline = outputFormat === "jpeg"
    ? pipeline.jpeg({ quality: 90 })
    : pipeline.png({ compressionLevel: 9 });

  const buf = await pipeline.toBuffer();

  const safeMargin = 0.05;
  const ratioSrc = srcW / srcH;
  const ratioDst = format.width / format.height;
  const safeMarginWarning = Math.abs(ratioSrc - ratioDst) > 0.4;

  return { buf, safeMarginWarning, upscaled: upscale };
}

resizeRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = resizeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const sourceAsset = await prisma.asset.findFirst({
    where: { id: parsed.data.assetId, project: { userId: req.user!.id }, deletedAt: null },
  });
  if (!sourceAsset) return res.status(404).json({ error: "asset_not_found" });

  const meta = (sourceAsset.metadata as { storageKey?: string }) || {};
  const sourceUrl = meta.storageKey ? `/uploads/${meta.storageKey}` : sourceAsset.storageUrl;
  const sourceBuf = await readFromUrl(sourceUrl);

  const ext = parsed.data.outputFormat === "jpeg" ? "jpg" : "png";
  const mime = parsed.data.outputFormat === "jpeg" ? "image/jpeg" : "image/png";

  const results: Array<{
    format: string;
    label: string;
    assetId: string;
    downloadUrl: string;
    width: number;
    height: number;
    safeMarginWarning: boolean;
  }> = [];

  for (const formatKey of parsed.data.formats) {
    const preset = FORMAT_PRESETS[formatKey];
    if (!preset) continue;
    const { buf, safeMarginWarning } = await processFormat(sourceBuf, preset, parsed.data.outputFormat);
    const key = `${sourceAsset.projectId}/resize/${uuid()}-${preset.key}.${ext}`;
    await storage.put(key, buf, mime);
    const newAsset = await prisma.asset.create({
      data: {
        projectId: sourceAsset.projectId,
        type: "GENERATED_IMAGE",
        storageUrl: storage.publicUrl(key),
        thumbnailUrl: storage.publicUrl(key),
        mimeType: mime,
        width: preset.width,
        height: preset.height,
        fileSizeBytes: buf.byteLength,
        metadata: {
          storageKey: key,
          formatKey: preset.key,
          sourceAssetId: sourceAsset.id,
          safeMarginWarning,
        },
      },
    });
    results.push({
      format: preset.key,
      label: preset.label,
      assetId: newAsset.id,
      downloadUrl: storage.publicUrl(key),
      width: preset.width,
      height: preset.height,
      safeMarginWarning,
    });
  }

  res.json({ items: results });
});

resizeRouter.post("/zip", authRequired, async (req: AuthedRequest, res) => {
  const schema = z.object({ assetIds: z.array(z.string().uuid()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const assets = await prisma.asset.findMany({
    where: { id: { in: parsed.data.assetIds }, project: { userId: req.user!.id }, deletedAt: null },
  });
  if (assets.length === 0) return res.status(404).json({ error: "no_assets" });

  res.set({ "Content-Type": "application/zip", "Content-Disposition": "attachment; filename=propvision-resized.zip" });
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => res.status(500).end(err.message));
  archive.pipe(res);

  for (const asset of assets) {
    const meta = (asset.metadata as { storageKey?: string; formatKey?: string }) || {};
    const url = meta.storageKey ? `/uploads/${meta.storageKey}` : asset.storageUrl;
    try {
      const buf = await readFromUrl(url);
      const ext = asset.mimeType === "image/png" ? "png" : "jpg";
      archive.append(buf, { name: `${meta.formatKey || asset.id}.${ext}` });
    } catch (err) {
      console.error("[resize/zip] skipping asset", asset.id, err);
    }
  }
  archive.finalize();
});
