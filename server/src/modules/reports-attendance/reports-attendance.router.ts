import { Router } from "express";
import type { Request, Response } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import type { AppEdition } from "../../shared/app-identity";
import { getAttendanceDataScope } from "../attendance/attendance-edition-scope";
import {
  attendanceReportCsvExportQuerySchema,
  attendanceClientCsvAuditSchema,
  attendanceReportDailyQuerySchema,
  attendanceReportEvidenceQuerySchema,
  attendanceReportExportQuerySchema,
  attendanceReportMembersQuerySchema,
  attendanceReportSummaryQuerySchema,
} from "./reports-attendance.schemas";
import {
  getAuditedAttendanceReportExport,
  recordAttendanceClientCsvExport,
  getAttendanceReportDaily,
  getAttendanceReportEvidence,
  getAttendanceReportMembers,
  getAttendanceReportSummary,
} from "./reports-attendance.service";

export function createReportsAttendanceRouter(edition: AppEdition) {
  const reportsAttendanceRouter = Router();
  const scope = getAttendanceDataScope(edition);

reportsAttendanceRouter.post("/client-export-audit", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const input = attendanceClientCsvAuditSchema.parse(req.body);
    const result = await recordAttendanceClientCsvExport(input, getExportContext(req), scope);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = attendanceReportCsvExportQuerySchema.parse(req.query);
    const file = await getAuditedAttendanceReportExport(query, "CSV", getExportContext(req), scope);
    sendExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/summary", async (req, res, next) => {
  try {
    const query = attendanceReportSummaryQuerySchema.parse(req.query);
    const result = await getAttendanceReportSummary(query, scope);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/daily", async (req, res, next) => {
  try {
    const query = attendanceReportDailyQuerySchema.parse(req.query);
    const result = await getAttendanceReportDaily(query, scope);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/members", async (req, res, next) => {
  try {
    const query = attendanceReportMembersQuerySchema.parse(req.query);
    const result = await getAttendanceReportMembers(query, scope);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/evidence", async (req, res, next) => {
  try {
    const query = attendanceReportEvidenceQuerySchema.parse(req.query);
    const result = await getAttendanceReportEvidence(query, scope);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = attendanceReportExportQuerySchema.parse(req.query);
    const file = await getAuditedAttendanceReportExport(query, "XLSX", getExportContext(req), scope);
    sendExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceRouter.get("/export.pdf", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = attendanceReportExportQuerySchema.parse(req.query);
    const file = await getAuditedAttendanceReportExport(query, "PDF", getExportContext(req), scope);
    sendExport(res, file);
  } catch (error) {
    next(error);
  }
});

  return reportsAttendanceRouter;
}

export const reportsAttendanceRouter = createReportsAttendanceRouter("FULL");

function getExportContext(req: Request) {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return {
    actor: { id: req.auth.user.id, role: req.auth.user.role, sessionId: req.auth.session.id },
    meta: {
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
    },
  };
}

function sendExport(
  res: Response,
  file: { buffer: Buffer; filename: string; contentType: string }
) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.status(200).send(file.buffer);
}
