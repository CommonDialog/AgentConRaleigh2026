import sharp from "sharp";
import { Capability, ImageGenInput, ImageGenResult, ProviderAdapter, TextGenInput, TextResult, VisionInput } from "./types.js";

function hashColor(seed: string): { r: number; g: number; b: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return { r: 50 + (h & 0x7f), g: 70 + ((h >> 8) & 0x7f), b: 90 + ((h >> 16) & 0x7f) };
}

async function placeholderImage(seed: string, width = 1024, height = 768): Promise<Buffer> {
  const c = hashColor(seed);
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgb(${c.r},${c.g},${c.b})"/>
          <stop offset="100%" stop-color="rgb(${Math.min(255, c.r + 60)},${Math.min(255, c.g + 60)},${Math.min(255, c.b + 60)})"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="48" fill="white" opacity="0.85">PropVision · Demo</text>
      <text x="50%" y="58%" text-anchor="middle" dominant-baseline="middle"
        font-family="sans-serif" font-size="22" fill="white" opacity="0.65">${seed.slice(0, 80)}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export const mockAdapter: ProviderAdapter = {
  name: "mock",
  supports: [
    "IMAGE_GENERATION",
    "IMAGE_EDIT",
    "INPAINTING",
    "DEPTH_ESTIMATION",
    "IMAGE_UPSCALE",
    "VISION_ANALYSIS",
    "TEXT_GENERATION",
  ] as Capability[],
  isConfigured() {
    return true;
  },
  async generateImage(input: ImageGenInput, _capability: Capability): Promise<ImageGenResult> {
    const buf = await placeholderImage(input.prompt, input.width || 1024, input.height || 768);
    return { imageBuffer: buf, mimeType: "image/png", metadata: { provider: "mock" } };
  },
  async analyzeVision(input: VisionInput): Promise<TextResult> {
    const fake = mockVisionFor(input.prompt);
    return {
      text: JSON.stringify(fake, null, 2),
      parsed: fake,
      metadata: { provider: "mock" },
    };
  },
  async generateText(input: TextGenInput): Promise<TextResult> {
    const fake = mockTextFor(input.prompt);
    return {
      text: typeof fake === "string" ? fake : JSON.stringify(fake, null, 2),
      parsed: typeof fake === "string" ? undefined : fake,
      metadata: { provider: "mock" },
    };
  },
};

function mockVisionFor(prompt: string): unknown {
  const p = prompt.toLowerCase();
  if (p.includes("room photo") || p.includes("analyze this room")) {
    return {
      roomType: "living",
      dimensions: { widthFt: 14, lengthFt: 18, heightFt: 9 },
      lightSources: [{ type: "window", position: "south wall", intensity: "high" }],
      existingFurniture: [],
      emptyZones: [{ description: "main floor", position: "center" }],
      floorMaterial: "engineered hardwood",
      wallColor: "warm white",
      architecturalStyle: "transitional",
    };
  }
  if (p.includes("clutter")) {
    return [
      { label: "shoes by door", boundingBox: { x: 5, y: 70, width: 15, height: 20 }, confidence: 0.92, category: "PERSONAL_ITEMS" },
      { label: "cable on floor", boundingBox: { x: 40, y: 80, width: 25, height: 8 }, confidence: 0.78, category: "WIRES_CABLES" },
      { label: "trash bag", boundingBox: { x: 70, y: 60, width: 12, height: 18 }, confidence: 0.85, category: "TRASH" },
    ];
  }
  if (p.includes("sky")) {
    return {
      skyCondition: "overcast",
      horizonLinePosition: 38,
      buildingEdgeComplexity: "moderate",
      timeOfDay: "midday",
    };
  }
  if (p.includes("daytime exterior") || p.includes("dusk")) {
    return {
      windows: [{ position: "front-left", count: 4 }, { position: "front-right", count: 4 }],
      exteriorFixtures: [{ type: "porch sconce", position: "front door" }],
      landscapeLighting: ["walkway"],
      sunDirection: "south-west",
    };
  }
  if (p.includes("floor plan") || p.includes("layout")) {
    return {
      rooms: [
        { name: "Kitchen", estimatedSqFt: 200, currentFunction: "cooking" },
        { name: "Living Room", estimatedSqFt: 280, currentFunction: "lounge" },
        { name: "Bedroom 3", estimatedSqFt: 130, currentFunction: "guest" },
      ],
      trafficFlow: "Linear flow front-to-back; bottleneck at the kitchen island.",
      wastedSpace: [{ location: "hallway", sqFt: 45, description: "underused corridor between kitchen and bath" }],
      naturalLight: [{ room: "Living Room", windowCount: 3, orientation: "south", lightQuality: "excellent" }],
      complianceNotes: [],
    };
  }
  if (p.includes("exposure") || p.includes("hdr")) {
    return {
      overexposed: [{ region: "front window", severity: "high" }],
      underexposed: [{ region: "back-left corner", severity: "medium" }],
      whiteBalanceIssues: ["slight cool cast in shadows"],
    };
  }
  return { note: "mock vision output", input: prompt.slice(0, 200) };
}

function mockTextFor(prompt: string): unknown {
  const p = prompt.toLowerCase();
  if (p.includes("cost estimate")) {
    return {
      lineItems: [
        { category: "Demolition", description: "Remove non-load-bearing wall", lowEstimate: 1500, highEstimate: 3000, unit: "lump", quantity: 1 },
        { category: "Cabinetry", description: "Mid-range kitchen cabinets", lowEstimate: 8000, highEstimate: 15000, unit: "set", quantity: 1 },
        { category: "Flooring", description: "Engineered hardwood, installed", lowEstimate: 6, highEstimate: 12, unit: "sqft", quantity: 350 },
      ],
      totalLowEstimate: 11600,
      totalHighEstimate: 22200,
      timelineWeeks: 6,
      permitRequirements: ["Building permit", "Electrical permit"],
      assumptions: ["Mid-range finishes", "No structural surprises", "2026 contractor pricing"],
    };
  }
  if (p.includes("sustainability") || p.includes("energy-efficient")) {
    return {
      recommendations: [
        { category: "INSULATION", description: "Upgrade attic to R-49", estimatedCost: 1800, annualSavings: 280, roiYears: 6.4, environmentalImpact: 1500 },
        { category: "HVAC", description: "Replace AC with heat pump", estimatedCost: 9000, annualSavings: 720, roiYears: 12.5, environmentalImpact: 4200 },
        { category: "WINDOWS", description: "Triple-pane on south face", estimatedCost: 6200, annualSavings: 310, roiYears: 20, environmentalImpact: 1100 },
      ],
      currentEstimatedEnergyScore: 58,
      projectedEnergyScore: 82,
    };
  }
  return { note: "mock text output", input: prompt.slice(0, 200) };
}
