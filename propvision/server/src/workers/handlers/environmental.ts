import type { HandlerCtx } from "../index.js";
import { ai } from "../../services/ai/index.js";
import { loadAssetBuffer, saveGeneratedAsset, getUserTier } from "../../lib/assets.js";

const SKY_PROMPTS: Record<string, string> = {
  BLUE_SKY: "vivid blue sky with gentle scattered clouds, midday lighting",
  DRAMATIC_CLOUDS: "dramatic cumulus clouds with depth and contrast, late-afternoon light",
  GOLDEN_HOUR: "warm golden-hour sky, soft amber and rose gradients, low sun",
  TWILIGHT: "twilight sky with deep blue-to-purple gradient and faint star glimmer",
};

export async function handleEnvironmental(ctx: HandlerCtx) {
  const sourceAssetId = ctx.params.sourceAssetId as string;
  const subtype = ctx.params.subtype as "HDR_BLEND" | "SKY_REPLACE" | "DAY_TO_DUSK";
  const skyType = (ctx.params.skyType as string) || "BLUE_SKY";

  await ctx.progress(10, "downloading_source");
  const { asset, buffer } = await loadAssetBuffer(sourceAssetId);

  let visionPrompt = "";
  let generationPrompt = "";
  let negativePrompt = "no perspective change, preserve all architectural details exactly, no people";

  if (subtype === "HDR_BLEND") {
    visionPrompt = "Analyze this real-estate photo for exposure issues. Return JSON with arrays: overexposed (regions like windows/skylights with severity), underexposed (regions like corners/shadows with severity), whiteBalanceIssues (color cast notes).";
  } else if (subtype === "SKY_REPLACE") {
    visionPrompt = "Identify the sky region in this exterior property photo. Return JSON with: skyCondition (overcast/clear/partly-cloudy/sunset), horizonLinePosition (percent from top), buildingEdgeComplexity (simple/moderate/complex), timeOfDay.";
  } else {
    visionPrompt = "Analyze this daytime exterior property photo. Return JSON with: windows (array of {position, count}), exteriorFixtures (array of {type, position}), landscapeLighting (array of strings), sunDirection.";
  }

  await ctx.progress(30, "analyzing");
  const vision = await ai.analyzeVision({
    imageBuffer: buffer,
    mimeType: asset.mimeType,
    prompt: visionPrompt,
  });
  const analysis = (vision.parsed as Record<string, unknown>) || {};

  if (subtype === "HDR_BLEND") {
    generationPrompt = "Balance interior and exterior exposure through windows. Lift shadow detail in dark corners while keeping highlights natural. Preserve all furniture and architectural elements exactly. Maintain natural color temperature, professional real-estate photography quality.";
  } else if (subtype === "SKY_REPLACE") {
    generationPrompt = `Replace the sky with a ${SKY_PROMPTS[skyType]}. Match lighting direction to existing sun position. Adjust ambient light on the building to match the new sky. Preserve building edges perfectly with no artifacts around rooflines or trees.`;
  } else {
    generationPrompt = "Convert this daytime photo to a twilight/dusk scene. Sky: deep blue-to-purple gradient with warm horizon glow. Windows: warm interior light. Activate exterior light fixtures and landscape path lighting with warm glows. Maintain all architectural details and proportions exactly.";
  }

  await ctx.progress(60, "generating_image");
  const result = await ai.generateImage("IMAGE_EDIT", {
    prompt: generationPrompt,
    negativePrompt,
    imageBuffer: buffer,
    strength: subtype === "HDR_BLEND" ? 0.4 : 0.55,
  });

  await ctx.progress(90, "storing_result");
  const tier = await getUserTier(ctx.userId);
  const generated = await saveGeneratedAsset({
    projectId: ctx.projectId,
    buffer: result.imageBuffer,
    mimeType: result.mimeType,
    metadata: { sourceAssetId, subtype, skyType, analysis, prompt: generationPrompt },
    applyWatermarkForTier: tier,
  });

  return {
    generatedAssetId: generated.id,
    generatedUrl: generated.storageUrl,
    sourceAssetId,
    subtype,
    skyType,
    analysis,
  };
}
