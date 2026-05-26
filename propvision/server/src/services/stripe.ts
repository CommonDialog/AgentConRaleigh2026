import Stripe from "stripe";
import { env } from "../env.js";

let _client: Stripe | null = null;
export function stripe(): Stripe {
  if (!_client) {
    if (!env.STRIPE_SECRET_KEY) throw new Error("stripe_not_configured");
    _client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-09-30.acacia" });
  }
  return _client;
}

export const stripeEnabled = () => Boolean(env.STRIPE_SECRET_KEY);
