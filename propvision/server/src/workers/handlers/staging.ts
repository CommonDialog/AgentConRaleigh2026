import type { HandlerCtx } from "../index.js";
import { ai } from "../../services/ai/index.js";
import { loadAssetBuffer, saveGeneratedAsset, getUserTier } from "../../lib/assets.js";

const STYLE_DETAIL: Record<string, string> = {
  modern: "Clean lines, neutral palette, contemporary furniture, minimalist accents.",
  scandinavian: "Light woods, white walls, cozy textiles, hygge feel.",
  industrial: "Exposed materials, dark metals, leather, raw textures.",
  "mid-century": "Walnut wood tones, geometric patterns, tapered legs, atomic-era accents.",
  coastal: "Sandy beiges, soft blues, light linens, woven textures.",
  traditional: "Classic furniture, warm wood, layered fabrics, formal arrangements.",
  minimalist: "Spare furniture, neutral palette, abundant negative space.",
  bohemian: "Layered patterns, plants, eclectic textiles, warm jewel tones.",
};

export async function handleStaging(ctx: HandlerCtx) {
  const sourceAssetId = ctx.params.sourceAssetId as string;
  const style = (ctx.params.style as string) || "modern";

  await ctx.progress(10, "downloading_source");
  const { asset, buffer } = await loadAssetBuffer(sourceAssetId);

  await ctx.progress(30, "analyzing_room");
  const visionPrompt = `Analyze this room photo. Return JSON with: roomType (bedroom/living/kitchen/bathroom/dining/office), dimensions (estimated widthFt/lengthFt/heightFt as numbers), lightSources (array of {type, position, intensity}), existingFurniture (array of items already present), emptyZones (array of {description, position}), floorMaterial, wallColor, architecturalStyle.`;
  const vision = await ai.analyzeVision({
    imageBuffer: buffer,
    mimeType: asset.mimeType,
    prompt: visionPrompt,
  });
  const analysis = (vision.parsed as Record<string, unknown>) || {};

  await ctx.progress(50, "building_prompt", { analysis });

  const styleHint = STYLE_DETAIL[style] || STYLE_DETAIL.modern;
  const generationPrompt = [
    `Furnish this empty ${analysis.roomType ?? "room"} in a ${style} style.`,
    styleHint,
    `Maintain exact existing room geometry, walls, windows, doors, ceiling, floor, and lighting direction.`,
    `Floor: ${analysis.floorMaterial ?? "existing"}; walls: ${analysis.wallColor ?? "existing"}.`,
    `Photorealistic, professional real-estate photography lighting, natural daylight.`,
  ].join(" ");
  const negativePrompt = "do not alter walls, windows, doors, ceiling, floor; no perspective change; no people; no text watermarks; avoid distorted geometry";

  await ctx.progress(70, "generating_image");
  const result = await ai.generateImage("IMAGE_EDIT", {
    prompt: generationPrompt,
    negativePrompt,
    imageBuffer: buffer,
    strength: 0.65,
  });

  await ctx.progress(90, "storing_result");
  const tier = await getUserTier(ctx.userId);
  const generated = await saveGeneratedAsset({
    projectId: ctx.projectId,
    buffer: result.imageBuffer,
    mimeType: result.mimeType,
    metadata: { sourceAssetId, style, analysis, prompt: generationPrompt },
    applyWatermarkForTier: tier,
  });

  return {
    generatedAssetId: generated.id,
    generatedUrl: generated.storageUrl,
    sourceAssetId,
    style,
    analysis,
  };
}
