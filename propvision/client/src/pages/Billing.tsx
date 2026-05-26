import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useToast } from "../components/Toast";
import { useAuth } from "../lib/auth";
import { cn } from "../lib/cn";

interface BillingMe {
  tier: "FREE" | "PRO" | "ENTERPRISE";
  creditsBalance: number;
  monthlyAllotment: number;
  stripeCustomerId?: string | null;
}

interface Tx {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

const TIERS = [
  { tier: "FREE", price: 0, credits: 5, features: ["Standard processing", "Watermarked output"] },
  { tier: "PRO", price: 49, credits: 100, features: ["Priority queue", "No watermark", "All features"] },
  { tier: "ENTERPRISE", price: 199, credits: 500, features: ["Highest priority", "API access", "Team management"] },
];

const PACKS = [
  { key: "PACK_50", credits: 50, price: 10 },
  { key: "PACK_150", credits: 150, price: 25 },
  { key: "PACK_500", credits: 500, price: 70 },
];

export function Billing() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [me, setMe] = useState<BillingMe | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);

  useEffect(() => {
    api<BillingMe>("/api/billing/me").then(setMe).catch(() => {});
    api<{ items: Tx[] }>("/api/billing/transactions").then((d) => setTxs(d.items)).catch(() => setTxs([]));
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) push({ variant: "success", title: "You're on the new plan", description: "Welcome aboard." });
    if (params.get("credits_added")) push({ variant: "success", title: "Credits added", description: "Have at it." });
    if (params.get("cancelled")) push({ variant: "warning", title: "Checkout cancelled" });
    refresh();
  }, []);

  const upgrade = async (tier: "PRO" | "ENTERPRISE") => {
    try {
      const r = await api<{ url: string }>("/api/billing/create-checkout", { method: "POST", body: { tier } });
      window.location.href = r.url;
    } catch {
      push({ variant: "error", title: "Billing not configured", description: "Set Stripe keys to enable checkout." });
    }
  };
  const portal = async () => {
    try {
      const r = await api<{ url: string }>("/api/billing/create-portal", { method: "POST" });
      window.location.href = r.url;
    } catch {
      push({ variant: "error", title: "Stripe portal unavailable" });
    }
  };
  const buy = async (pack: string) => {
    try {
      const r = await api<{ url: string }>("/api/billing/buy-credits", { method: "POST", body: { pack } });
      window.location.href = r.url;
    } catch {
      push({ variant: "error", title: "Billing not configured" });
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Current plan</div>
            <div className="text-xl font-semibold">{me?.tier ?? user?.subscriptionTier}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Credits</div>
            <div className="text-xl font-semibold">{me?.creditsBalance ?? user?.creditsBalance}</div>
            {me && <div className="text-xs text-slate-500">of {me.monthlyAllotment} monthly</div>}
          </div>
        </div>
        <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500" style={{ width: `${Math.min(100, ((me?.creditsBalance || 0) / Math.max(1, me?.monthlyAllotment || 1)) * 100)}%` }} />
        </div>
        {me?.stripeCustomerId && <button className="btn-secondary mt-4" onClick={portal}>Manage subscription</button>}
      </div>

      <section>
        <h2 className="font-semibold mb-3">Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TIERS.map((t) => (
            <div key={t.tier} className={cn("card p-5", me?.tier === t.tier && "ring-2 ring-brand-500")}>
              <div className="text-xs uppercase text-slate-500">{t.tier}</div>
              <div className="text-3xl font-bold mt-1">${t.price}<span className="text-sm font-normal text-slate-500">/mo</span></div>
              <div className="text-sm text-slate-500">{t.credits} credits/month</div>
              <ul className="mt-3 space-y-1 text-sm">
                {t.features.map((f) => <li key={f}>· {f}</li>)}
              </ul>
              {t.tier === "FREE" ? (
                <div className="mt-4 text-sm text-slate-500">Default plan</div>
              ) : (
                <button onClick={() => upgrade(t.tier as "PRO" | "ENTERPRISE")} className="btn-primary mt-4 w-full" disabled={me?.tier === t.tier}>
                  {me?.tier === t.tier ? "Current" : "Upgrade"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Need extra credits?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PACKS.map((p) => (
            <div key={p.key} className="card p-4 text-center">
              <div className="text-2xl font-bold">{p.credits}</div>
              <div className="text-xs text-slate-500">credits</div>
              <div className="text-lg font-semibold mt-1">${p.price}</div>
              <button className="btn-secondary mt-3 w-full" onClick={() => buy(p.key)}>Buy</button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Transactions</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 text-xs uppercase">
              <tr><th className="px-4 py-3">Date</th><th>Description</th><th>Type</th><th className="text-right pr-4">Credits</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txs === null && <tr><td colSpan={4} className="p-4 text-center text-slate-400">Loading…</td></tr>}
              {txs && txs.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">No transactions yet.</td></tr>}
              {txs?.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-slate-600">{new Date(t.createdAt).toLocaleString()}</td>
                  <td>{t.description}</td>
                  <td><span className="badge bg-slate-100 text-slate-700">{t.type}</span></td>
                  <td className={cn("text-right pr-4 font-mono", t.amount < 0 ? "text-red-600" : "text-emerald-600")}>{t.amount > 0 ? "+" : ""}{t.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
