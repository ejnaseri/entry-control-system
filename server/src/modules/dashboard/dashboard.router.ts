import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { HttpError } from "../../middlewares/error-handler";
import { requirePermission } from "../../middlewares/auth";
import { getDashboardDetails, getDashboardSummary, getReportsDashboardSummary, type DashboardDetailType } from "./dashboard.service";

const CUSTOMER_DETAIL_TYPES = new Set<DashboardDetailType>(["activeMembers", "expiringSoon"]);
const FINANCIAL_DETAIL_TYPES = new Set<DashboardDetailType>(["debtors", "revenueToday"]);
const ATTENDANCE_DETAIL_TYPES = new Set<DashboardDetailType>(["insideNow", "todaysEntries"]);
const DASHBOARD_DETAIL_TYPES = new Set<DashboardDetailType>([
  ...CUSTOMER_DETAIL_TYPES,
  ...FINANCIAL_DETAIL_TYPES,
  ...ATTENDANCE_DETAIL_TYPES,
]);

export const attendanceDashboardRouter = Router();
export const customerDashboardRouter = Router();
export const financialDashboardRouter = Router();

attendanceDashboardRouter.get("/summary", requirePermission(AdminPermission.ATTENDANCE_VIEW), async (req, res, next) => {
  try {
    const range = req.query["range"] === "24h" ? "24h" : "7d";
    const summary = await getDashboardSummary(range);
    const permissions = new Set(req.auth?.permissions ?? []);
    const canViewMembers = permissions.has(AdminPermission.MEMBERS_VIEW);
    const canViewFinancial = permissions.has(AdminPermission.FINANCIAL_REPORTS_VIEW);

    res.json({
      ...summary,
      activeMembers: canViewMembers ? summary.activeMembers : { value: 0, deltaPct: null },
      expiringSoon: canViewMembers ? summary.expiringSoon : { value: 0, deltaPct: null },
      debtors: canViewFinancial ? summary.debtors : { value: 0, deltaPct: null },
      revenueToday: canViewFinancial
        ? summary.revenueToday
        : { value: 0, deltaPct: null, currency: summary.revenueToday.currency },
    });
  } catch (error) {
    next(error);
  }
});

financialDashboardRouter.get("/reports-summary", requirePermission(AdminPermission.FINANCIAL_REPORTS_VIEW), async (_req, res, next) => {
  try {
    const summary = await getReportsDashboardSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

customerDashboardRouter.get("/details", async (req, res, next) => {
  try {
    const type = String(req.query["type"] ?? "") as DashboardDetailType;
    if (!CUSTOMER_DETAIL_TYPES.has(type)) {
      next();
      return;
    }
    if (!req.auth?.permissions.includes(AdminPermission.MEMBERS_VIEW)) {
      throw new HttpError(403, "Permission denied");
    }
    const details = await getDashboardDetails(type, getDetailsLimit(req.query["limit"]));
    res.json(details);
  } catch (error) {
    next(error);
  }
});

financialDashboardRouter.get("/details", async (req, res, next) => {
  try {
    const type = String(req.query["type"] ?? "") as DashboardDetailType;
    if (!FINANCIAL_DETAIL_TYPES.has(type)) {
      next();
      return;
    }
    if (!req.auth?.permissions.includes(AdminPermission.FINANCIAL_REPORTS_VIEW)) {
      throw new HttpError(403, "Permission denied");
    }
    const details = await getDashboardDetails(type, getDetailsLimit(req.query["limit"]));
    res.json(details);
  } catch (error) {
    next(error);
  }
});

attendanceDashboardRouter.get("/details", async (req, res, next) => {
  try {
    const type = String(req.query["type"] ?? "") as DashboardDetailType;
    if (!DASHBOARD_DETAIL_TYPES.has(type)) {
      throw new HttpError(400, "Invalid dashboard details type");
    }
    if (!ATTENDANCE_DETAIL_TYPES.has(type)) {
      next();
      return;
    }
    if (!req.auth?.permissions.includes(AdminPermission.ATTENDANCE_VIEW)) {
      throw new HttpError(403, "Permission denied");
    }
    const details = await getDashboardDetails(type, getDetailsLimit(req.query["limit"]));
    res.json(details);
  } catch (error) {
    next(error);
  }
});

export const dashboardRouter = Router();
dashboardRouter.use(customerDashboardRouter);
dashboardRouter.use(financialDashboardRouter);
dashboardRouter.use(attendanceDashboardRouter);

function getDetailsLimit(rawValue: unknown) {
  const rawLimit = Number(rawValue ?? 20);
  return Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.floor(rawLimit))) : 20;
}
