import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { debtAgingExportQuerySchema, debtAgingQuerySchema } from "./reports-debt-aging.schemas";
import { getDebtAgingReport, getDebtAgingReportCsv, getDebtAgingReportXlsx } from "./reports-debt-aging.service";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";

export const reportsDebtAgingRouter = Router();

reportsDebtAgingRouter.get("/", async (req, res, next) => {
  try {
    const query = debtAgingQuerySchema.parse(req.query);
    const report = await getDebtAgingReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsDebtAgingRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = debtAgingExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.debt_aging.exported",
      targetType: "DebtAgingReport", targetId: "debt-aging-report", format: "CSV",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getDebtAgingReportCsv(query); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsDebtAgingRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = debtAgingExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.debt_aging.exported",
      targetType: "DebtAgingReport", targetId: "debt-aging-report", format: "XLSX",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getDebtAgingReportXlsx(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});
