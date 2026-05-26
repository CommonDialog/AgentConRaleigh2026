import type { HandlerCtx } from "../index.js";
import { ai } from "../../services/ai/index.js";
import { loadAssetBuffer } from "../../lib/assets.js";

export async function handleSpaceOptimization(ctx: HandlerCtx) {
  const sourceAssetId = ctx.params.sourceAssetId as string;
  const goals = (ctx.params.goals as string[]) || [];
  const region = (ctx.params.region as string) || "United States";
  const climateZone = (ctx.params.climateZone as string) || "mixed";

  await ctx.progress(10, "loading_source");
  const { asset, buffer } = await loadAssetBuffer(sourceAssetId);

  await ctx.progress(20, "analyzing_layout");
  const layoutVision = await ai.analyzeVision({
    imageBuffer: buffer,
    mimeType: asset.mimeType,
    prompt: "Analyze this floor plan or property layout. Return JSON with: rooms (array of {name, estimatedSqFt, currentFunction}), trafficFlow (string description of movement and bottlenecks), wastedSpace (array of {location, sqFt, description}), naturalLight (array of {room, windowCount, orientation, lightQuality}), complianceNotes (array of strings).",
  });
  const layoutAnalysis = layoutVision.parsed || {};

  await ctx.progress(50, "estimating_costs");
  const costPrompt = `Given this layout analysis: ${JSON.stringify(layoutAnalysis)}. The owner wants to: ${goals.length ? goals.join("; ") : "modernize the space efficiently"}. Provide a detailed cost estimate as JSON: { lineItems (array of {category, description, lowEstimate, highEstimate, unit, quantity}), totalLowEstimate, totalHighEstimate, timelineWeeks, permitRequirements (array of strings), assumptions (array of strings) }. Use mid-range contractor pricing for ${region}. All costs in USD.`;
  const costResult = await ai.generateText({
    prompt: costPrompt,
    jsonMode: true,
    maxTokens: 3000,
  });
  const costEstimate = costResult.parsed || {};

  await ctx.progress(80, "sustainability_recommendations");
  const sustPrompt = `Given this property layout in climate zone ${climateZone}: ${JSON.stringify(layoutAnalysis)}. Recommend energy-efficient upgrades. Return JSON: { recommendations (array of {category (INSULATION/HVAC/LIGHTING/WATER/SOLAR/WINDOWS/OTHER), description, estimatedCost, annualSavings, roiYears, environmentalImpact (CO2 lbs/year)}), currentEstimatedEnergyScore (1-100), projectedEnergyScore (1-100) }.`;
  const sustResult = await ai.generateText({
    prompt: sustPrompt,
    jsonMode: true,
    maxTokens: 2000,
  });
  const sustainability = sustResult.parsed || {};

  return {
    sourceAssetId,
    goals,
    region,
    climateZone,
    layoutAnalysis,
    costEstimate,
    sustainability,
  };
}
