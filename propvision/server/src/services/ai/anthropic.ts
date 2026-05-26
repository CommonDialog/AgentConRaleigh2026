import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../env.js";
import { AiError, Capability, ProviderAdapter, TextGenInput, TextResult, VisionInput } from "./types.js";

const MODEL = "claude-opus-4-7";

let _client: Anthropic | null = null;
function client() {
  if (!_client) {
    if (!env.ANTHROPIC_API_KEY) throw new AiError("NOT_CONFIGURED", "ANTHROPIC_API_KEY missing", "anthropic");
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

function tryParseJson(text: string): unknown | undefined {
  const fence = /```(?:json)?\s*([\s\S]+?)```/i.exec(text);
  const candidate = fence ? fence[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(candidate.slice(first, last + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export const anthropicAdapter: ProviderAdapter = {
  name: "anthropic",
  supports: ["VISION_ANALYSIS", "TEXT_GENERATION"] as Capability[],
  isConfigured() {
    return Boolean(env.ANTHROPIC_API_KEY);
  },
  async analyzeVision(input: VisionInput): Promise<TextResult> {
    try {
      const res = await client().messages.create({
        model: MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: input.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
                  data: input.imageBuffer.toString("base64"),
                },
              },
              { type: "text", text: input.prompt + "\n\nRespond ONLY with valid JSON." },
            ],
          },
        ],
      });
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return {
        text,
        parsed: tryParseJson(text),
        metadata: { model: MODEL, usage: res.usage },
      };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) throw new AiError("RATE_LIMITED", e.message || "rate limited", "anthropic", err);
      throw new AiError("PROVIDER_ERROR", e.message || "anthropic error", "anthropic", err);
    }
  },
  async generateText(input: TextGenInput): Promise<TextResult> {
    try {
      const res = await client().messages.create({
        model: MODEL,
        max_tokens: input.maxTokens ?? 4096,
        system: input.systemPrompt,
        messages: [
          {
            role: "user",
            content: input.jsonMode ? `${input.prompt}\n\nRespond ONLY with valid JSON.` : input.prompt,
          },
        ],
      });
      const text = res.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      return {
        text,
        parsed: input.jsonMode ? tryParseJson(text) : undefined,
        metadata: { model: MODEL, usage: res.usage },
      };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) throw new AiError("RATE_LIMITED", e.message || "rate limited", "anthropic", err);
      throw new AiError("PROVIDER_ERROR", e.message || "anthropic error", "anthropic", err);
    }
  },
};
