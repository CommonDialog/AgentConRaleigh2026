export type Capability =
  | "IMAGE_GENERATION"
  | "IMAGE_EDIT"
  | "INPAINTING"
  | "DEPTH_ESTIMATION"
  | "IMAGE_UPSCALE"
  | "VISION_ANALYSIS"
  | "TEXT_GENERATION";

export type ProviderName = "stability" | "anthropic" | "azure-openai" | "mock";

export class AiError extends Error {
  constructor(
    public code: "RATE_LIMITED" | "INVALID_INPUT" | "PROVIDER_ERROR" | "TIMEOUT" | "NOT_CONFIGURED",
    message: string,
    public provider?: ProviderName,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface ImageGenInput {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  imageBuffer?: Buffer;
  maskBuffer?: Buffer;
  strength?: number;
}

export interface ImageGenResult {
  imageBuffer: Buffer;
  mimeType: string;
  metadata: Record<string, unknown>;
}

export interface VisionInput {
  imageBuffer: Buffer;
  mimeType: string;
  prompt: string;
  schemaName?: string;
}

export interface TextGenInput {
  prompt: string;
  systemPrompt?: string;
  jsonMode?: boolean;
  maxTokens?: number;
}

export interface TextResult {
  text: string;
  parsed?: unknown;
  metadata: Record<string, unknown>;
}

export interface ProviderAdapter {
  name: ProviderName;
  supports: Capability[];
  isConfigured(): boolean;
  generateImage?(input: ImageGenInput, capability: Capability): Promise<ImageGenResult>;
  analyzeVision?(input: VisionInput): Promise<TextResult>;
  generateText?(input: TextGenInput): Promise<TextResult>;
}
