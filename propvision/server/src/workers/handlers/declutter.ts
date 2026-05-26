import sharp from "sharp";
import type { HandlerCtx } from "../index.js";
import { ai } from "../../services/ai/index.js";
import { loadAssetBuffer, saveGeneratedAsset, getUserTier } from "../../lib/assets.js";
import { prisma } from "../../db.js";
import { publishProgress } from "../../services/jobs.js";

interface DetectedItem {
  label: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  category: string;
}

async function buildMaskFromBoxes(width: number, height: number, items: DetectedItem[]): Promise<Buffer> {
  const rects = items
    .map((it) => {
      const bx = Math.max(0, Math.floor((it.boundingBox.x / 100) * width));
      const by = Math.max(0, Math.floor((it.boundingBox.y / 100) * height));
      const bw = Math.floor((it.boundingBox.width / 100) * width);
      const bh = Math.floor((it.boundingBox.height / 100) * height);
      return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="white"/>`;
    })
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="black"/>${rects}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function waitForConfirmation(jobId: string, timeoutMs = 5 * 60_000): Promise<string[] | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return null;
    if (job.status === "CANCELLED") return null;
    const params = (job.params as Record<string, unknown>) || {};
    const conf = params.confirmation as { removeItems?: string[] } | undefined;
    if (conf?.removeItems) return conf.removeItems;
  }
  throw new Error("confirmation_timeout");
}

export async function handleDeclutter(ctx: HandlerCtx) {
  const sourceAssetId = ctx.params.sourceAssetId as string;
  const mode = ctx.params.mode as "AUTO" | "MANUAL";
  const maskAssetId = ctx.params.maskAssetId as string | undefined;

  await ctx.progress(10, "downloading_source");
  const { asset, buffer } = await loadAssetBuffer(sourceAssetId);
  const meta = await sharp(buffer).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 768;

  let maskBuffer: Buffer;

  if (mode === "AUTO") {
    await ctx.progress(20, "detecting_clutter");
    const visionPrompt = "Analyze this real-estate listing photo. Identify all removable clutter and distractions. Return ONLY a JSON array of items with: label, boundingBox {x, y, width, height} as percentages 0-100, confidence (0-1), category (PERSONAL_ITEMS, VEHICLES, WIRES_CABLES, TRASH, EQUIPMENT, SIGNAGE, OTHER). Do NOT flag permanent fixtures, furniture, or architectural elements.";
    const vision = await ai.analyzeVision({
      imageBuffer: buffer,
      mimeType: asset.mimeType,
      prompt: visionPrompt,
    });
    const detected = (vision.parsed as DetectedItem[]) || [];

    await publishProgress({
      jobId: ctx.jobId,
      status: "STREAMING",
      progress: 30,
      step: "awaiting_confirmation",
      data: { detected },
    });

    const confirmedLabels = await waitForConfirmation(ctx.jobId);
    if (!confirmedLabels) return { cancelled: true };
    const toRemove = detected.filter((d) => confirmedLabels.includes(d.label));
    if (toRemove.length === 0) {
      return { skipped: true, reason: "no_items_selected", detected };
    }

    maskBuffer = await buildMaskFromBoxes(w, h, toRemove);
  } else {
    if (!maskAssetId) throw new Error("mask_required_for_manual");
    const mask = await loadAssetBuffer(maskAssetId);
    maskBuffer = await sharp(mask.buffer).resize(w, h, { fit: "fill" }).toFormat("png").toBuffer();
  }

  await ctx.progress(60, "inpainting");
  const result = await ai.generateImage("INPAINTING", {
    prompt: "Photorealistically reconstruct the masked region to match the surrounding scene. Maintain perspective, lighting, and texture continuity.",
    imageBuffer: buffer,
    maskBuffer,
  });

  await ctx.progress(90, "storing_result");
  const tier = await getUserTier(ctx.userId);
  const generated = await saveGeneratedAsset({
    projectId: ctx.projectId,
    buffer: result.imageBuffer,
    mimeType: result.mimeType,
    metadata: { sourceAssetId, mode, maskAssetId },
    applyWatermarkForTier: tier,
  });

  return {
    generatedAssetId: generated.id,
    generatedUrl: generated.storageUrl,
    sourceAssetId,
    mode,
  };
}
