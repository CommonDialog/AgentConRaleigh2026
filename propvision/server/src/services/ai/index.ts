import {
  AiError,
  Capability,
  ImageGenInput,
  ImageGenResult,
  ProviderAdapter,
  ProviderName,
  TextGenInput,
  TextResult,
  VisionInput,
} from "./types.js";
import { anthropicAdapter } from "./anthropic.js";
import { stabilityAdapter } from "./stability.js";
import { azureOpenAiAdapter } from "./azureOpenAi.js";
import { mockAdapter } from "./mock.js";
import routing from "./routing.json" with { type: "json" };

const ADAPTERS: Record<ProviderName, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  stability: stabilityAdapter,
  "azure-openai": azureOpenAiAdapter,
  mock: mockAdapter,
};

type RoutingMap = Record<Capability, { primary: ProviderName; fallback: ProviderName }>;

function getRoute(capability: Capability): { primary: ProviderAdapter; fallback: ProviderAdapter } {
  const cfg = (routing as RoutingMap)[capability];
  const primary = ADAPTERS[cfg?.primary] ?? mockAdapter;
  const fallback = ADAPTERS[cfg?.fallback] ?? mockAdapter;
  return { primary, fallback };
}

async function tryProvider<T>(
  adapter: ProviderAdapter,
  capability: Capability,
  fn: () => Promise<T>,
): Promise<T> {
  if (!adapter.isConfigured() || !adapter.supports.includes(capability)) {
    throw new AiError("NOT_CONFIGURED", `${adapter.name} not configured for ${capability}`, adapter.name);
  }
  return fn();
}

async function withFallback<T>(
  capability: Capability,
  fn: (a: ProviderAdapter) => Promise<T>,
): Promise<T> {
  const { primary, fallback } = getRoute(capability);
  try {
    return await tryProvider(primary, capability, () => fn(primary));
  } catch (err) {
    const code = err instanceof AiError ? err.code : "PROVIDER_ERROR";
    const retriable = code === "RATE_LIMITED" || code === "PROVIDER_ERROR" || code === "NOT_CONFIGURED";
    if (!retriable) throw err;
    if (fallback === primary) {
      try {
        return await tryProvider(mockAdapter, capability, () => fn(mockAdapter));
      } catch {
        throw err;
      }
    }
    try {
      return await tryProvider(fallback, capability, () => fn(fallback));
    } catch {
      return await tryProvider(mockAdapter, capability, () => fn(mockAdapter));
    }
  }
}

export const ai = {
  async generateImage(capability: Capability, input: ImageGenInput): Promise<ImageGenResult> {
    return withFallback(capability, (adapter) => {
      if (!adapter.generateImage) throw new AiError("INVALID_INPUT", `${adapter.name} cannot generate images`, adapter.name);
      return adapter.generateImage(input, capability);
    });
  },
  async analyzeVision(input: VisionInput): Promise<TextResult> {
    return withFallback("VISION_ANALYSIS", (adapter) => {
      if (!adapter.analyzeVision) throw new AiError("INVALID_INPUT", `${adapter.name} cannot analyze vision`, adapter.name);
      return adapter.analyzeVision(input);
    });
  },
  async generateText(input: TextGenInput): Promise<TextResult> {
    return withFallback("TEXT_GENERATION", (adapter) => {
      if (!adapter.generateText) throw new AiError("INVALID_INPUT", `${adapter.name} cannot generate text`, adapter.name);
      return adapter.generateText(input);
    });
  },
};

export { AiError } from "./types.js";
