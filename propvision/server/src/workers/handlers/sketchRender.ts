import type { HandlerCtx } from "../index.js";
import { ai } from "../../services/ai/index.js";
import { loadAssetBuffer, saveGeneratedAsset, getUserTier } from "../../lib/assets.js";

const STYLE_HINTS: Record<string, string> = {
  architectural: "Photorealistic architectural rendering, professional photography, daytime lighting, clear skies, full building elevation",
  interior: "Photorealistic interior rendering, magazine photography, warm natural light, refined materials",
  landscape: "Photorealistic landscape rendering, lush vegetation, natural lighting, atmospheric depth",
};

export async function handleSketchRender(ctx: HandlerCtx) {
  const sketchAssetId = ctx.params.sketchAssetId as string;
  const style = (ctx.params.style as string) || "architectural";
  const fidelity = Math.max(0, Math.min(100, (ctx.params.fidelity as number) ?? 75));
  const additions = (ctx.params.promptAdditions as string) || "";

  await ctx.progress(15, "loading_sketch");
  const { buffer } = await loadAssetBuffer(sketchAssetId);

  const prompt = [
    `Render a photorealistic ${style} image based on this sketch.`,
    `Follow sketch lines with ${fidelity}% strictness — ${fidelity > 80 ? "preserve all lines exactly" : fidelity > 50 ? "use lines as guidance" : "treat lines as inspiration only"}.`,
    additions,
    STYLE_HINTS[style] || STYLE_HINTS.architectural,
    "High detail, balanced composition, no text or labels.",
  ].filter(Boolean).join(" ");

  await ctx.progress(40, "generating_render");

  const useEdit = fidelity > 70;
  const result = useEdit
    ? await ai.generateImage("IMAGE_EDIT", {
        prompt,
        imageBuffer: buffer,
        strength: 1 - fidelity / 100 * 0.6,
      })
    : await ai.generateImage("IMAGE_GENERATION", { prompt, width: 1024, height: 768 });

  await ctx.progress(90, "storing_result");
  const tier = await getUserTier(ctx.userId);
  const generated = await saveGeneratedAsset({
    projectId: ctx.projectId,
    buffer: result.imageBuffer,
    mimeType: result.mimeType,
    metadata: { sketchAssetId, style, fidelity, prompt },
    applyWatermarkForTier: tier,
  });

  return {
    generatedAssetId: generated.id,
    generatedUrl: generated.storageUrl,
    sketchAssetId,
    style,
    fidelity,
  };
}
