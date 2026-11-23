import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { cashflowExportQuerySchema, cashflowQuerySchema } from "./reports-cashflow.schemas";
import { getCashflowCsv, getCashflowReport, getCashflowXlsx } from "./reports-cashflow.service";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";

export const reportsCashflowRouter = Router();

reportsCashflowRouter.get("/", async (req, res, next) => {
  try {
    const query = cashflowQuerySchema.parse(req.query);
    const report = await getCashflowReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsCashflowRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = cashflowExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.cashflow.exported",
      targetType: "CashflowReport", targetId: "cashflow-report", format: "CSV",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getCashflowCsv(query); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsCashflowRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = cashflowExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.cashflow.exported",
      targetType: "CashflowReport", targetId: "cashflow-report", format: "XLSX",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getCashflowXlsx(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});
