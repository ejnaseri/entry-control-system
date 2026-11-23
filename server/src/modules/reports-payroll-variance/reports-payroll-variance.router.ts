import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { payrollVarianceExportQuerySchema, payrollVarianceQuerySchema } from "./reports-payroll-variance.schemas";
import {
  getPayrollVarianceCsv,
  getPayrollVarianceReport,
  getPayrollVarianceXlsx,
} from "./reports-payroll-variance.service";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";

export const reportsPayrollVarianceRouter = Router();

reportsPayrollVarianceRouter.get("/", async (req, res, next) => {
  try {
    const query = payrollVarianceQuerySchema.parse(req.query);
    const report = await getPayrollVarianceReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsPayrollVarianceRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = payrollVarianceExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.payroll_variance.exported",
      targetType: "PayrollVarianceReport", targetId: "payroll-variance-report", format: "CSV",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getPayrollVarianceCsv(query); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsPayrollVarianceRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = payrollVarianceExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.payroll_variance.exported",
      targetType: "PayrollVarianceReport", targetId: "payroll-variance-report", format: "XLSX",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getPayrollVarianceXlsx(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});
