import { AdminPermission } from "@prisma/client";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  attendanceEditionReportCsvExportQuerySchema,
  attendanceEditionReportExportQuerySchema,
  attendanceMonthlyTimecardExportQuerySchema,
} from "./attendance-report.schemas";
import { getAttendanceEditionReportExport } from "./attendance-report.service";
import { getAuditedAttendanceMonthlyTimecardExport } from "./attendance-report-timecard.service";
import { getReportExportContext, sendReportExport } from "../reports/shared/report-export.audit";

export type AttendanceReportExportRouterApi = Readonly<{
  getExport: typeof getAttendanceEditionReportExport;
  getTimecardExport: typeof getAuditedAttendanceMonthlyTimecardExport;
}>;

const defaultApi: AttendanceReportExportRouterApi = Object.freeze({
  getExport: getAttendanceEditionReportExport,
  getTimecardExport: getAuditedAttendanceMonthlyTimecardExport,
});

export function createAttendanceReportExportRouter(api: AttendanceReportExportRouterApi = defaultApi) {
  const router = Router();
  router.get("/export.csv", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    const query = attendanceEditionReportCsvExportQuerySchema.parse(req.query);
    sendExport(res, await api.getExport(query, "CSV", getExportContext(req)));
  }));
  router.get("/export.xlsx", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    const query = attendanceEditionReportExportQuerySchema.parse(req.query);
    sendExport(res, await api.getExport(query, "XLSX", getExportContext(req)));
  }));
  router.get("/export.pdf", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    const query = attendanceEditionReportExportQuerySchema.parse(req.query);
    sendExport(res, await api.getExport(query, "PDF", getExportContext(req)));
  }));
  router.get("/timecard/export.csv", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    sendReportExport(res, await api.getTimecardExport(attendanceMonthlyTimecardExportQuerySchema.parse(req.query), "CSV", getReportExportContext(req)));
  }));
  router.get("/timecard/export.xlsx", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    sendReportExport(res, await api.getTimecardExport(attendanceMonthlyTimecardExportQuerySchema.parse(req.query), "XLSX", getReportExportContext(req)));
  }));
  router.get("/timecard/export.pdf", requirePermission(AdminPermission.ATTENDANCE_EXPORT), asyncHandler(async (req, res) => {
    sendReportExport(res, await api.getTimecardExport(attendanceMonthlyTimecardExportQuerySchema.parse(req.query), "PDF", getReportExportContext(req)));
  }));
  return router;
}

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

function sendExport(res: Response, file: { buffer: Buffer; filename: string; contentType: string }) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.status(200).send(file.buffer);
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
