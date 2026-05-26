import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { prisma } from "../db.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    subscriptionTier: string;
    creditsBalance: number;
  };
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export async function authRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) return res.status(401).json({ error: "unauthenticated" });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) return res.status(401).json({ error: "unauthenticated" });
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      subscriptionTier: user.subscriptionTier,
      creditsBalance: user.creditsBalance,
    };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function adminRequired(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") return res.status(403).json({ error: "admin_only" });
  next();
}
