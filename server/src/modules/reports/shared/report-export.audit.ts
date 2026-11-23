import { AuditActor, type AdminRole, type Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../../../lib/prisma";
import { HttpError } from "../../../middlewares/error-handler";

export type ReportExportFormat = "CSV" | "XLSX" | "PDF";

export type ReportExportFile = {
  filename: string;
  contentType: string;
  body: string | Buffer;
  rowCount: number;
};

export type ReportExportContext = {
  actor: { id: string; role: AdminRole; sessionId: string };
  meta: { ipAddress?: string; userAgent?: string };
};

export function getReportExportContext(req: Request): ReportExportContext {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return {
    actor: {
      id: req.auth.user.id,
      role: req.auth.user.role,
      sessionId: req.auth.session.id,
    },
    meta: {
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
    },
  };
}

export async function generateAuditedReportExport(input: {
  context: ReportExportContext;
  action: string;
  targetType: string;
  targetId: string;
  format: ReportExportFormat;
  filters: Prisma.InputJsonObject;
  generate: () => Promise<ReportExportFile>;
}) {
  let file: ReportExportFile;
  try {
    file = await input.generate();
  } catch (error) {
    await prisma.auditLog.create({
      data: buildAuditData(input, false, 0, "GENERATION_FAILED"),
    });
    throw error;
  }

  await prisma.auditLog.create({
    data: buildAuditData(input, true, file.rowCount, "EXPORTED"),
  });
  return file;
}

export function sendReportExport(res: Response, file: ReportExportFile) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.status(200).send(file.body);
}

export function toSafeReportExportFilters(
  query: Record<string, unknown>
): Prisma.InputJsonObject {
  const filters: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "search") {
      filters["searchApplied"] = typeof value === "string" && value.trim().length > 0;
      continue;
    }
    if (
      typeof value === "string"
      || typeof value === "number"
      || typeof value === "boolean"
    ) {
      filters[key] = value;
    }
  }
  if (!("searchApplied" in filters)) filters["searchApplied"] = false;
  return filters as Prisma.InputJsonObject;
}

function buildAuditData(
  input: {
    context: ReportExportContext;
    action: string;
    targetType: string;
    targetId: string;
    format: ReportExportFormat;
    filters: Prisma.InputJsonObject;
  },
  success: boolean,
  rowCount: number,
  outcome: "EXPORTED" | "GENERATION_FAILED"
): Prisma.AuditLogUncheckedCreateInput {
  return {
    actorType: AuditActor.ADMIN,
    actorId: input.context.actor.id,
    actorRole: input.context.actor.role,
    sessionId: input.context.actor.sessionId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    success,
    metadata: {
      format: input.format,
      rowCount,
      outcome,
      filters: input.filters,
    },
    ...(input.context.meta.ipAddress ? { ipAddress: input.context.meta.ipAddress } : {}),
    ...(input.context.meta.userAgent ? { userAgent: input.context.meta.userAgent } : {}),
  };
}
