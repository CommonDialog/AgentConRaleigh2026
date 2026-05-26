import { Router, Request, Response } from "express";
import { z } from "zod";
import { SubscriptionTier } from "@prisma/client";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";
import { stripe, stripeEnabled } from "../services/stripe.js";
import { CREDIT_PACKS, TIER_MONTHLY_CREDITS } from "../config/credits.js";
import { env } from "../env.js";

export const billingRouter = Router();

billingRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json({
    tier: user.subscriptionTier,
    creditsBalance: user.creditsBalance,
    monthlyAllotment: TIER_MONTHLY_CREDITS[user.subscriptionTier],
    stripeCustomerId: user.stripeCustomerId,
  });
});

billingRouter.get("/transactions", authRequired, async (req: AuthedRequest, res) => {
  const cursor = req.query.cursor as string | undefined;
  const txs = await prisma.creditTransaction.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = txs.length > 50;
  const items = hasMore ? txs.slice(0, 50) : txs;
  res.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});

async function ensureStripeCustomer(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("user_not_found");
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

const checkoutSchema = z.object({ tier: z.enum(["PRO", "ENTERPRISE"]) });
billingRouter.post("/create-checkout", authRequired, async (req: AuthedRequest, res) => {
  if (!stripeEnabled()) return res.status(503).json({ error: "billing_not_configured" });
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const priceId = parsed.data.tier === "PRO" ? env.STRIPE_PRICE_PRO : env.STRIPE_PRICE_ENTERPRISE;
  if (!priceId) return res.status(503).json({ error: "tier_not_configured" });

  const customerId = await ensureStripeCustomer(req.user!.id);
  const session = await stripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.CLIENT_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/billing?cancelled=true`,
    metadata: { userId: req.user!.id, tier: parsed.data.tier },
  });
  res.json({ url: session.url });
});

billingRouter.post("/create-portal", authRequired, async (req: AuthedRequest, res) => {
  if (!stripeEnabled()) return res.status(503).json({ error: "billing_not_configured" });
  const customerId = await ensureStripeCustomer(req.user!.id);
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.CLIENT_URL}/billing`,
  });
  res.json({ url: session.url });
});

const buyCreditsSchema = z.object({ pack: z.enum(["PACK_50", "PACK_150", "PACK_500"]) });
billingRouter.post("/buy-credits", authRequired, async (req: AuthedRequest, res) => {
  if (!stripeEnabled()) return res.status(503).json({ error: "billing_not_configured" });
  const parsed = buyCreditsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

  const pack = CREDIT_PACKS[parsed.data.pack];
  const priceId = process.env[pack.stripePriceEnvKey];
  if (!priceId) return res.status(503).json({ error: "pack_not_configured" });

  const customerId = await ensureStripeCustomer(req.user!.id);
  const session = await stripe().checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.CLIENT_URL}/billing?credits_added=true`,
    cancel_url: `${env.CLIENT_URL}/billing?cancelled=true`,
    metadata: { userId: req.user!.id, pack: parsed.data.pack, credits: String(pack.credits) },
  });
  res.json({ url: session.url });
});

export const stripeWebhookHandler = async (req: Request, res: Response) => {
  if (!stripeEnabled() || !env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).end();
  }
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) return res.status(400).end();

  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe webhook] signature failure", err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as { metadata?: Record<string, string>; mode?: string };
        const userId = session.metadata?.userId;
        if (!userId) break;
        if (session.mode === "subscription") {
          const tier = session.metadata?.tier as SubscriptionTier;
          if (tier) {
            await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: tier } });
          }
        } else if (session.mode === "payment") {
          const credits = parseInt(session.metadata?.credits || "0", 10);
          if (credits > 0) {
            await prisma.user.update({
              where: { id: userId },
              data: { creditsBalance: { increment: credits } },
            });
            await prisma.creditTransaction.create({
              data: {
                userId,
                amount: credits,
                type: "PURCHASE",
                description: `Credit pack ${session.metadata?.pack}`,
              },
            });
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as { customer: string; items: { data: { price: { id: string } }[] }; status: string };
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer } });
        if (!user) break;
        const priceId = sub.items.data[0]?.price?.id;
        let tier: SubscriptionTier = "FREE";
        if (priceId === env.STRIPE_PRICE_PRO) tier = "PRO";
        else if (priceId === env.STRIPE_PRICE_ENTERPRISE) tier = "ENTERPRISE";
        await prisma.user.update({ where: { id: user.id }, data: { subscriptionTier: tier } });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as { customer: string };
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer } });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { subscriptionTier: "FREE" } });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as { customer: string; billing_reason?: string };
        if (invoice.billing_reason === "subscription_cycle" || invoice.billing_reason === "subscription_create") {
          const user = await prisma.user.findFirst({ where: { stripeCustomerId: invoice.customer } });
          if (user) {
            const monthly = TIER_MONTHLY_CREDITS[user.subscriptionTier];
            if (monthly > 0) {
              await prisma.user.update({
                where: { id: user.id },
                data: { creditsBalance: monthly },
              });
              await prisma.creditTransaction.create({
                data: {
                  userId: user.id,
                  amount: monthly,
                  type: "BONUS",
                  description: `Monthly ${user.subscriptionTier} allotment`,
                },
              });
            }
          }
        }
        break;
      }
      case "invoice.payment_failed":
        console.warn("[stripe] payment failed", event.data.object);
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
  }

  res.json({ received: true });
};
