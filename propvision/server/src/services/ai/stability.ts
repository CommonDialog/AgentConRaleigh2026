import { env } from "../../env.js";
import { AiError, Capability, ImageGenInput, ImageGenResult, ProviderAdapter } from "./types.js";

async function call(formPath: string, form: FormData, accept = "image/*"): Promise<ImageGenResult> {
  if (!env.STABILITY_AI_API_KEY) throw new AiError("NOT_CONFIGURED", "STABILITY_AI_API_KEY missing", "stability");
  const url = `${env.STABILITY_AI_BASE_URL}${formPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STABILITY_AI_API_KEY}`,
      Accept: accept,
    },
    body: form,
  });
  if (res.status === 429) throw new AiError("RATE_LIMITED", "stability rate limited", "stability");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError("PROVIDER_ERROR", `stability ${res.status}: ${body}`, "stability");
  }
  const ct = res.headers.get("content-type") || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { imageBuffer: buf, mimeType: ct, metadata: { provider: "stability", endpoint: formPath } };
}

export const stabilityAdapter: ProviderAdapter = {
  name: "stability",
  supports: ["IMAGE_GENERATION", "IMAGE_EDIT", "INPAINTING", "IMAGE_UPSCALE"] as Capability[],
  isConfigured() {
    return Boolean(env.STABILITY_AI_API_KEY);
  },
  async generateImage(input: ImageGenInput, capability: Capability): Promise<ImageGenResult> {
    const form = new FormData();
    form.append("prompt", input.prompt);
    if (input.negativePrompt) form.append("negative_prompt", input.negativePrompt);
    form.append("output_format", "png");

    if (capability === "IMAGE_GENERATION") {
      if (input.width) form.append("width", String(input.width));
      if (input.height) form.append("height", String(input.height));
      return call("/v2beta/stable-image/generate/sd3", form);
    }

    if (capability === "IMAGE_EDIT" && input.imageBuffer) {
      form.append("image", new Blob([input.imageBuffer], { type: "image/png" }), "input.png");
      form.append("mode", "image-to-image");
      form.append("strength", String(input.strength ?? 0.7));
      return call("/v2beta/stable-image/generate/sd3", form);
    }

    if (capability === "INPAINTING" && input.imageBuffer && input.maskBuffer) {
      form.append("image", new Blob([input.imageBuffer], { type: "image/png" }), "input.png");
      form.append("mask", new Blob([input.maskBuffer], { type: "image/png" }), "mask.png");
      return call("/v2beta/stable-image/edit/inpaint", form);
    }

    if (capability === "IMAGE_UPSCALE" && input.imageBuffer) {
      const f = new FormData();
      f.append("image", new Blob([input.imageBuffer], { type: "image/png" }), "input.png");
      return call("/v2beta/stable-image/upscale/conservative", f);
    }

    throw new AiError("INVALID_INPUT", `unsupported capability ${capability} for stability`, "stability");
  },
};
