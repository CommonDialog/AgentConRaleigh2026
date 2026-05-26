import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { signToken, authRequired, AuthedRequest } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ARCHITECT", "AGENT"]).default("AGENT"),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  const { name, email, password, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "email_taken" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      subscriptionTier: "FREE",
      creditsBalance: 5,
    },
  });

  const token = signToken(user.id);
  res
    .cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_credentials" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signToken(user.id);
  res
    .cookie("token", token, { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 })
    .json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token").json({ ok: true });
});

authRouter.get("/me", authRequired, async (req: AuthedRequest, res) => {
  const fresh = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!fresh) return res.status(404).json({ error: "not_found" });
  res.json({
    id: fresh.id,
    email: fresh.email,
    name: fresh.name,
    role: fresh.role,
    subscriptionTier: fresh.subscriptionTier,
    creditsBalance: fresh.creditsBalance,
  });
});
