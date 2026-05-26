import { env } from "../../env.js";
import { AiError, Capability, ImageGenInput, ImageGenResult, ProviderAdapter } from "./types.js";

export const azureOpenAiAdapter: ProviderAdapter = {
  name: "azure-openai",
  supports: ["IMAGE_GENERATION"] as Capability[],
  isConfigured() {
    return Boolean(env.AZURE_OPENAI_API_KEY && env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DALLE_DEPLOYMENT);
  },
  async generateImage(input: ImageGenInput): Promise<ImageGenResult> {
    if (!azureOpenAiAdapter.isConfigured()) {
      throw new AiError("NOT_CONFIGURED", "azure openai not configured", "azure-openai");
    }
    const url = `${env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${env.AZURE_OPENAI_DALLE_DEPLOYMENT}/images/generations?api-version=2024-02-01`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": env.AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
        n: 1,
        size: `${input.width ?? 1024}x${input.height ?? 1024}`,
      }),
    });
    if (res.status === 429) throw new AiError("RATE_LIMITED", "azure rate limited", "azure-openai");
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new AiError("PROVIDER_ERROR", `azure ${res.status}: ${body}`, "azure-openai");
    }
    const data = (await res.json()) as { data: { url?: string; b64_json?: string }[] };
    const item = data.data?.[0];
    if (!item) throw new AiError("PROVIDER_ERROR", "no image returned", "azure-openai");
    let buf: Buffer;
    if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
    else if (item.url) {
      const r = await fetch(item.url);
      buf = Buffer.from(await r.arrayBuffer());
    } else throw new AiError("PROVIDER_ERROR", "no image data", "azure-openai");
    return { imageBuffer: buf, mimeType: "image/png", metadata: { provider: "azure-openai" } };
  },
};
