import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import type { AppEdition } from "../../shared/app-identity";
import { getAttendanceDataScope, isStrictStaffAttendanceScope } from "../attendance/attendance-edition-scope";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";
import {
  attendanceComplianceExportQuerySchema,
  attendanceComplianceQuerySchema,
} from "./reports-attendance-compliance.schemas";
import {
  getAttendanceComplianceCsv,
  getAttendanceComplianceReport,
  getAttendanceComplianceXlsx,
} from "./reports-attendance-compliance.service";

export function createReportsAttendanceComplianceRouter(edition: AppEdition) {
  const reportsAttendanceComplianceRouter = Router();
  const scope = getAttendanceDataScope(edition);

reportsAttendanceComplianceRouter.get("/", async (req, res, next) => {
  try {
    const query = attendanceComplianceQuerySchema.parse(req.query);
    const report = await getAttendanceComplianceReport(query, scope);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceComplianceRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = attendanceComplianceExportQuerySchema.parse(req.query);
    const auditQuery = isStrictStaffAttendanceScope(scope) ? { ...query, memberType: "staff" as const } : query;
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.attendance_compliance.exported",
      targetType: "AttendanceComplianceReport", targetId: "attendance-compliance-report", format: "CSV",
      filters: toSafeReportExportFilters(auditQuery),
      generate: async () => { const result = await getAttendanceComplianceCsv(query, scope); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsAttendanceComplianceRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = attendanceComplianceExportQuerySchema.parse(req.query);
    const auditQuery = isStrictStaffAttendanceScope(scope) ? { ...query, memberType: "staff" as const } : query;
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.attendance_compliance.exported",
      targetType: "AttendanceComplianceReport", targetId: "attendance-compliance-report", format: "XLSX",
      filters: toSafeReportExportFilters(auditQuery),
      generate: async () => { const result = await getAttendanceComplianceXlsx(query, scope); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

  return reportsAttendanceComplianceRouter;
}

export const reportsAttendanceComplianceRouter = createReportsAttendanceComplianceRouter("FULL");
