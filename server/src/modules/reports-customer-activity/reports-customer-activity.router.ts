import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { generateAuditedReportExport, getReportExportContext, sendReportExport, toSafeReportExportFilters } from "../reports/shared/report-export.audit";
import {
  customerActivityExportQuerySchema,
  customerActivityInactiveMembersQuerySchema,
  customerActivityLowEngagementQuerySchema,
  customerActivitySummaryQuerySchema,
  customerActivityVisitedTodayQuerySchema,
} from "./reports-customer-activity.schemas";
import {
  getCustomerActivityCsv,
  getCustomerActivityLowEngagement,
  getCustomerActivitySummary,
  getCustomerActivityVisitedToday,
  getCustomerActivityInactiveMembers,
  getCustomerActivityXlsx,
} from "./reports-customer-activity.service";

export const reportsCustomerActivityRouter = Router();

reportsCustomerActivityRouter.get("/summary", async (req, res, next) => {
  try {
    const query = customerActivitySummaryQuerySchema.parse(req.query);
    const report = await getCustomerActivitySummary(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsCustomerActivityRouter.get("/visited-today", async (req, res, next) => {
  try {
    const query = customerActivityVisitedTodayQuerySchema.parse(req.query);
    const report = await getCustomerActivityVisitedToday(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsCustomerActivityRouter.get("/inactive-members", async (req, res, next) => {
  try {
    const query = customerActivityInactiveMembersQuerySchema.parse(req.query);
    const report = await getCustomerActivityInactiveMembers(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsCustomerActivityRouter.get("/low-engagement", async (req, res, next) => {
  try {
    const query = customerActivityLowEngagementQuerySchema.parse(req.query);
    const report = await getCustomerActivityLowEngagement(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

reportsCustomerActivityRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = customerActivityExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.customer_activity.exported",
      targetType: "CustomerActivityReport", targetId: "customer-activity-report", format: "CSV",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getCustomerActivityCsv(query); return { ...result, contentType: "text/csv; charset=utf-8", body: result.csv }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});

reportsCustomerActivityRouter.get("/export.xlsx", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = customerActivityExportQuerySchema.parse(req.query);
    const file = await generateAuditedReportExport({
      context: getReportExportContext(req), action: "report.customer_activity.exported",
      targetType: "CustomerActivityReport", targetId: "customer-activity-report", format: "XLSX",
      filters: toSafeReportExportFilters(query),
      generate: async () => { const result = await getCustomerActivityXlsx(query); return { ...result, body: result.buffer }; },
    });
    sendReportExport(res, file);
  } catch (error) {
    next(error);
  }
});
