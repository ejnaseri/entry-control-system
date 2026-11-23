import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { renewalForecastExportQuerySchema, renewalForecastQuerySchema } from "./reports-renewal-forecast.schemas";
import {
  getRenewalForecastCsv,
  getRenewalForecastPdf,
  getRenewalForecastReport,
  getRenewalForecastXlsx,
} from "./reports-renewal-forecast.service";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";

export const reportsRenewalForecastRouter = Router();

reportsRenewalForecastRouter.get("/", async (req, res, next) => {
  try {
    const query = renewalForecastQuerySchema.parse(req.query);
    const report = await getRenewalForecastReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsRenewalForecastRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = renewalForecastExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.renewal_forecast.exported",
      targetType: "RenewalForecastReport", targetId: "renewal-forecast-report", format: "CSV",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getRenewalForecastCsv(query); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsRenewalForecastRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = renewalForecastExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.renewal_forecast.exported",
      targetType: "RenewalForecastReport", targetId: "renewal-forecast-report", format: "XLSX",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getRenewalForecastXlsx(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsRenewalForecastRouter.get("/export.pdf", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = renewalForecastExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.renewal_forecast.exported",
      targetType: "RenewalForecastReport", targetId: "renewal-forecast-report", format: "PDF",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getRenewalForecastPdf(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

// Return PDF bytes inside JSON so browser download managers cannot intercept the
// authenticated API response and retry it without the application's session.
reportsRenewalForecastRouter.get("/export-pdf-data", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = renewalForecastExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.renewal_forecast.exported",
      targetType: "RenewalForecastReport", targetId: "renewal-forecast-report", format: "PDF",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getRenewalForecastPdf(query); return { ...result, body: result.buffer }; },
    });
    const body = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
    res.json({
      filename: file.filename,
      contentType: file.contentType,
      data: body.toString("base64"),
    });
  } catch (error) {
    next(error);
  }
});
