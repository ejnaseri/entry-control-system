import { Router } from "express";
import { prisma } from "../../lib/prisma";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const dbCheck = await prisma.$queryRaw<{ ok: number }>`SELECT 1 as ok`;
  res.json({
    status: "ok",
    database: Boolean(dbCheck),
    timestamp: new Date().toISOString(),
  });
});
