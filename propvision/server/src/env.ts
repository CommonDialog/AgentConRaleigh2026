import dotenv from "dotenv";
dotenv.config();

function get(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (fallback !== undefined) return fallback;
    return "";
  }
  return v;
}

export const env = {
  DATABASE_URL: get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/propvision"),
  REDIS_HOST: get("REDIS_HOST", "localhost"),
  REDIS_PORT: parseInt(get("REDIS_PORT", "6379"), 10),
  REDIS_PASSWORD: get("REDIS_PASSWORD"),
  JWT_SECRET: get("JWT_SECRET", "dev-only-not-for-prod"),
  PORT: parseInt(get("PORT", "4000"), 10),
  CLIENT_URL: get("CLIENT_URL", "http://localhost:5173"),

  AZURE_STORAGE_CONNECTION_STRING: get("AZURE_STORAGE_CONNECTION_STRING"),
  AZURE_STORAGE_CONTAINER: get("AZURE_STORAGE_CONTAINER", "propvision-assets"),

  STABILITY_AI_API_KEY: get("STABILITY_AI_API_KEY"),
  STABILITY_AI_BASE_URL: get("STABILITY_AI_BASE_URL", "https://api.stability.ai"),

  ANTHROPIC_API_KEY: get("ANTHROPIC_API_KEY"),

  AZURE_OPENAI_ENDPOINT: get("AZURE_OPENAI_ENDPOINT"),
  AZURE_OPENAI_API_KEY: get("AZURE_OPENAI_API_KEY"),
  AZURE_OPENAI_DALLE_DEPLOYMENT: get("AZURE_OPENAI_DALLE_DEPLOYMENT"),

  STRIPE_SECRET_KEY: get("STRIPE_SECRET_KEY"),
  STRIPE_WEBHOOK_SECRET: get("STRIPE_WEBHOOK_SECRET"),
  STRIPE_PRICE_PRO: get("STRIPE_PRICE_PRO"),
  STRIPE_PRICE_ENTERPRISE: get("STRIPE_PRICE_ENTERPRISE"),
  STRIPE_PRICE_CREDITS_50: get("STRIPE_PRICE_CREDITS_50"),
  STRIPE_PRICE_CREDITS_150: get("STRIPE_PRICE_CREDITS_150"),
  STRIPE_PRICE_CREDITS_500: get("STRIPE_PRICE_CREDITS_500"),
};

export const isMockMode = !env.STABILITY_AI_API_KEY || !env.ANTHROPIC_API_KEY;
