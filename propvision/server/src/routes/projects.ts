import { Router } from "express";
import { z } from "zod";
import { ProjectType } from "@prisma/client";
import { prisma } from "../db.js";
import { authRequired, AuthedRequest } from "../middleware/auth.js";

export const projectsRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.nativeEnum(ProjectType),
});

projectsRouter.post("/", authRequired, async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const project = await prisma.project.create({
    data: { ...parsed.data, userId: req.user!.id },
  });
  res.status(201).json(project);
});

projectsRouter.get("/", authRequired, async (req: AuthedRequest, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(parseInt((req.query.limit as string) || "20", 10), 100);

  const projects = await prisma.project.findMany({
    where: { userId: req.user!.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      assets: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      _count: { select: { jobs: true, assets: true } },
    },
  });

  const hasMore = projects.length > limit;
  const items = hasMore ? projects.slice(0, limit) : projects;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  res.json({ items, nextCursor });
});

projectsRouter.get("/:projectId", authRequired, async (req: AuthedRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId, userId: req.user!.id, deletedAt: null },
    include: {
      assets: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!project) return res.status(404).json({ error: "not_found" });
  res.json(project);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

projectsRouter.put("/:projectId", authRequired, async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const existing = await prisma.project.findFirst({
    where: { id: req.params.projectId, userId: req.user!.id, deletedAt: null },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  const updated = await prisma.project.update({
    where: { id: existing.id },
    data: parsed.data,
  });
  res.json(updated);
});

projectsRouter.delete("/:projectId", authRequired, async (req: AuthedRequest, res) => {
  const existing = await prisma.project.findFirst({
    where: { id: req.params.projectId, userId: req.user!.id, deletedAt: null },
  });
  if (!existing) return res.status(404).json({ error: "not_found" });
  await prisma.$transaction([
    prisma.project.update({ where: { id: existing.id }, data: { deletedAt: new Date() } }),
    prisma.asset.updateMany({
      where: { projectId: existing.id },
      data: { deletedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
});
