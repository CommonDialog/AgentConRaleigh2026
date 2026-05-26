import sharp from "sharp";
import { v4 as uuid } from "uuid";
import { Asset, AssetType, SubscriptionTier } from "@prisma/client";
import { prisma } from "../db.js";
import { storage, readFromUrl } from "../services/storage.js";

export async function loadAssetBuffer(assetId: string): Promise<{ asset: Asset; buffer: Buffer }> {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new Error(`asset_not_found:${assetId}`);
  const meta = (asset.metadata as { storageKey?: string }) || {};
  const url = meta.storageKey ? `/uploads/${meta.storageKey}` : asset.storageUrl;
  const buffer = await readFromUrl(url);
  return { asset, buffer };
}

export async function saveGeneratedAsset(args: {
  projectId: string;
  buffer: Buffer;
  mimeType: string;
  type?: AssetType;
  metadata?: Record<string, unknown>;
  applyWatermarkForTier?: SubscriptionTier;
}): Promise<Asset> {
  let buf = args.buffer;
  let mime = args.mimeType;

  if (args.applyWatermarkForTier === "FREE") {
    try {
      buf = await applyWatermark(buf);
      mime = "image/jpeg";
    } catch (err) {
      console.warn("[watermark] failed, using original", err);
    }
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  const key = `${args.projectId}/generated/${uuid()}.${ext}`;
  await storage.put(key, buf, mime);

  let width: number | undefined;
  let height: number | undefined;
  let thumbnailUrl: string | undefined;
  try {
    const meta = await sharp(buf).metadata();
    width = meta.width;
    height = meta.height;
    const thumb = await sharp(buf).resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const thumbKey = `thumbnails/${args.projectId}/${uuid()}.jpg`;
    const thumbResult = await storage.put(thumbKey, thumb, "image/jpeg");
    thumbnailUrl = thumbResult.url;
  } catch (err) {
    console.warn("[saveGeneratedAsset] thumbnail failed", err);
  }

  return prisma.asset.create({
    data: {
      projectId: args.projectId,
      type: args.type ?? "GENERATED_IMAGE",
      storageUrl: storage.publicUrl(key),
      thumbnailUrl,
      mimeType: mime,
      width,
      height,
      fileSizeBytes: buf.byteLength,
      metadata: { storageKey: key, ...(args.metadata || {}) },
    },
  });
}

async function applyWatermark(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = meta.width || 1024;
  const h = meta.height || 768;
  const fontSize = Math.max(28, Math.floor(Math.min(w, h) / 18));
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(${w / 2} ${h / 2}) rotate(-30)" opacity="0.18">
        <text font-family="sans-serif" font-size="${fontSize}" fill="white" text-anchor="middle" dominant-baseline="middle"
              stroke="black" stroke-width="1">
          PropVision · upgrade to remove
        </text>
      </g>
    </svg>`;
  return sharp(buf)
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return (user?.subscriptionTier as SubscriptionTier) ?? "FREE";
}
