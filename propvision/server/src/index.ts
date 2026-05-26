import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "node:path";
import { env } from "./env.js";
import { authRouter } from "./routes/auth.js";
import { projectsRouter } from "./routes/projects.js";
import { assetsRouter } from "./routes/assets.js";
import { jobsRouter, projectJobsRouter } from "./routes/jobs.js";
import { adminRouter } from "./routes/admin.js";
import { stagingRouter } from "./routes/staging.js";
import { environmentalRouter } from "./routes/environmental.js";
import { declutterRouter } from "./routes/declutter.js";
import { sketchRouter } from "./routes/sketch.js";
import { optimizeRouter } from "./routes/optimize.js";
import { resizeRouter } from "./routes/resize.js";
import { billingRouter, stripeWebhookHandler } from "./routes/billing.js";
import { streaming } from "./services/streaming.js";

const app = express();

app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(cookieParser());

// Stripe webhook needs raw body for signature verification — register before json()
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json({ limit: "20mb" }));

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/projects/:projectId/jobs", projectJobsRouter);
app.use("/api/assets", assetsRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/staging", stagingRouter);
app.use("/api/environmental", environmentalRouter);
app.use("/api/declutter", declutterRouter);
app.use("/api/sketch", sketchRouter);
app.use("/api/optimize", optimizeRouter);
app.use("/api/resize", resizeRouter);
app.use("/api/billing", billingRouter);

streaming.connect().catch((err) => console.warn("[streaming] initial connect failed", err.message));

app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT}`);
});
