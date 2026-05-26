import { ProjectType } from "@prisma/client";

export const CREDIT_COST: Record<ProjectType, number> = {
  STAGING: 5,
  ENVIRONMENTAL_EDIT: 3,
  DECLUTTER: 4,
  SKETCH_RENDER: 5,
  SPACE_OPTIMIZATION: 8,
  RESIZE: 0,
};

export const TIER_MONTHLY_CREDITS = {
  FREE: 5,
  PRO: 100,
  ENTERPRISE: 500,
} as const;

export const CREDIT_PACKS = {
  PACK_50: { credits: 50, priceUsd: 10, stripePriceEnvKey: "STRIPE_PRICE_CREDITS_50" },
  PACK_150: { credits: 150, priceUsd: 25, stripePriceEnvKey: "STRIPE_PRICE_CREDITS_150" },
  PACK_500: { credits: 500, priceUsd: 70, stripePriceEnvKey: "STRIPE_PRICE_CREDITS_500" },
} as const;
