import { AdminPermission } from "@prisma/client";
import { Router, type Express, type RequestHandler, type Router as ExpressRouter } from "express";
import { runtimeOptionalFeatureFlags, type AppEdition } from "../config/env";
import { isFeatureEnabled } from "../config/capabilities";
import { requireAnyPermission, requireAuth, requirePermission } from "../middlewares/auth";
import {
  HTTP_ROUTE_REGISTRY,
  getHttpRouteDefinition,
  type HttpRouteId,
} from "./http-route-registry";

type ApiRouteRegistration = Readonly<{
  id: HttpRouteId;
  loadRouter: (edition: AppEdition) => ExpressRouter;
  middleware?: readonly RequestHandler[];
}>;

function defineApiRoute(registration: ApiRouteRegistration): ApiRouteRegistration {
  return Object.freeze({
    ...registration,
    ...(registration.middleware ? { middleware: Object.freeze([...registration.middleware]) } : {}),
  });
}

const apiRouteRegistrations = Object.freeze([
  defineApiRoute({
    id: "health",
    loadRouter: () => (require("../modules/health/health.router") as typeof import("../modules/health/health.router")).healthRouter,
  }),
  defineApiRoute({
    id: "auth",
    loadRouter: () => (require("../modules/auth/auth.router") as typeof import("../modules/auth/auth.router")).authRouter,
  }),
  defineApiRoute({
    id: "admin-users",
    loadRouter: (edition) =>
      (require("../modules/admin-users/admin-user.router") as typeof import("../modules/admin-users/admin-user.router"))
        .createAdminUserRouter(edition),
  }),
  defineApiRoute({
    id: "audit-logs",
    loadRouter: (edition) =>
      (require("../modules/audit-logs/audit-log.router") as typeof import("../modules/audit-logs/audit-log.router"))
        .createAuditLogRouter(edition),
  }),
  defineApiRoute({
    id: "members",
    middleware: [requirePermission(AdminPermission.MEMBERS_VIEW)],
    loadRouter: () => (require("../modules/members/member.router") as typeof import("../modules/members/member.router")).memberRouter,
  }),
  defineApiRoute({
    id: "employees",
    middleware: [requirePermission(AdminPermission.MEMBERS_VIEW)],
    loadRouter: () =>
      (require("../modules/employees/employee.router") as typeof import("../modules/employees/employee.router"))
        .employeeRouter,
  }),
  defineApiRoute({
    id: "attendance-entry-logs",
    middleware: [requirePermission(AdminPermission.ATTENDANCE_VIEW)],
    loadRouter: (edition) =>
      (require("../modules/attendance/attendance.router") as typeof import("../modules/attendance/attendance.router"))
        .createEntryLogsRouter(edition),
  }),
  defineApiRoute({
    id: "attendance-daily",
    middleware: [requirePermission(AdminPermission.ATTENDANCE_VIEW)],
    loadRouter: (edition) =>
      (require("../modules/attendance/attendance.router") as typeof import("../modules/attendance/attendance.router"))
        .createAttendanceDailyRouter(edition),
  }),
  defineApiRoute({
    id: "membership-plans",
    middleware: [
      requireAnyPermission([AdminPermission.MEMBERSHIPS_WRITE, AdminPermission.SYSTEM_SETTINGS_MANAGE]),
    ],
    loadRouter: () =>
      (require("../modules/membership-plans/plan.router") as typeof import("../modules/membership-plans/plan.router"))
        .planRouter,
  }),
  defineApiRoute({
    id: "staff-groups",
    middleware: [requireAnyPermission([AdminPermission.MEMBERS_VIEW, AdminPermission.SYSTEM_SETTINGS_MANAGE])],
    loadRouter: () =>
      (require("../modules/staff-groups/staff-group.router") as typeof import("../modules/staff-groups/staff-group.router"))
        .staffGroupRouter,
  }),
  defineApiRoute({
    id: "shifts",
    middleware: [requirePermission(AdminPermission.MEMBERS_VIEW)],
    loadRouter: () => (require("../modules/shifts/shift.router") as typeof import("../modules/shifts/shift.router")).shiftRouter,
  }),
  defineApiRoute({
    id: "device-push",
    loadRouter: () =>
      (require("../modules/devices/device-push.router") as typeof import("../modules/devices/device-push.router"))
        .devicePushRouter,
  }),
  defineApiRoute({
    id: "device-diagnostics",
    loadRouter: (edition) =>
      (
        require("../modules/devices/device-diagnostics.router") as typeof import("../modules/devices/device-diagnostics.router")
      ).createDeviceDiagnosticsRouter(edition),
  }),
  defineApiRoute({
    id: "device-door-control",
    loadRouter: (edition) =>
      (
        require("../modules/devices/device-door-control.router") as typeof import("../modules/devices/device-door-control.router")
      ).createDeviceDoorControlRouter(edition),
  }),
  defineApiRoute({
    id: "devices",
    loadRouter: (edition) =>
      (require("../modules/devices/device-core.router") as typeof import("../modules/devices/device-core.router"))
        .createDeviceCoreRouter(edition),
  }),
  defineApiRoute({
    id: "dashboard-attendance",
    middleware: [requireAuth],
    loadRouter: (edition) => edition === "ATTENDANCE"
      ? (require("../modules/dashboard/attendance-dashboard.router") as typeof import("../modules/dashboard/attendance-dashboard.router"))
        .createAttendanceDashboardRouter()
      : (require("../modules/dashboard/dashboard.router") as typeof import("../modules/dashboard/dashboard.router"))
        .attendanceDashboardRouter,
  }),
  defineApiRoute({
    id: "dashboard-customers",
    middleware: [requireAuth],
    loadRouter: () =>
      (require("../modules/dashboard/dashboard.router") as typeof import("../modules/dashboard/dashboard.router"))
        .customerDashboardRouter,
  }),
  defineApiRoute({
    id: "dashboard-financial",
    middleware: [requireAuth],
    loadRouter: () =>
      (require("../modules/dashboard/dashboard.router") as typeof import("../modules/dashboard/dashboard.router"))
        .financialDashboardRouter,
  }),
  defineApiRoute({
    id: "inbox",
    middleware: [requireAuth],
    loadRouter: (edition) =>
      (require("../modules/inbox/inbox.router") as typeof import("../modules/inbox/inbox.router"))
        .createInboxRouter(edition),
  }),
  defineApiRoute({
    id: "sounds",
    loadRouter: () => (require("../modules/sounds/sounds.router") as typeof import("../modules/sounds/sounds.router")).soundsRouter,
  }),
  defineApiRoute({
    id: "backups",
    loadRouter: () => (require("../modules/backups/backup.router") as typeof import("../modules/backups/backup.router")).backupRouter,
  }),
  defineApiRoute({
    id: "payroll",
    middleware: [requirePermission(AdminPermission.PAYROLL_MANAGE)],
    loadRouter: () => (require("../modules/payroll/payroll.router") as typeof import("../modules/payroll/payroll.router")).payrollRouter,
  }),
  defineApiRoute({
    id: "expenses",
    middleware: [requirePermission(AdminPermission.EXPENSES_MANAGE)],
    loadRouter: () => (require("../modules/expenses/expenses.router") as typeof import("../modules/expenses/expenses.router")).expensesRouter,
  }),
  defineApiRoute({
    id: "membership-report",
    middleware: [requirePermission(AdminPermission.FINANCIAL_REPORTS_VIEW)],
    loadRouter: () =>
      (require("../modules/membership-report/membership-report.router") as typeof import("../modules/membership-report/membership-report.router"))
        .membershipReportRouter,
  }),
  defineApiRoute({
    id: "reports-attendance",
    middleware: [requirePermission(AdminPermission.ATTENDANCE_VIEW)],
    loadRouter: (edition) => edition === "ATTENDANCE"
      ? (require("../modules/reports-attendance/attendance-report.router") as typeof import("../modules/reports-attendance/attendance-report.router"))
        .createAttendanceReportRouter()
      : (require("../modules/reports-attendance/reports-attendance.router") as typeof import("../modules/reports-attendance/reports-attendance.router"))
        .createReportsAttendanceRouter(edition),
  }),
  defineApiRoute({
    id: "reports-customer-activity",
    middleware: [requirePermission(AdminPermission.MEMBERS_VIEW)],
    loadRouter: () =>
      (require("../modules/reports-customer-activity/reports-customer-activity.router") as typeof import("../modules/reports-customer-activity/reports-customer-activity.router"))
        .reportsCustomerActivityRouter,
  }),
  defineApiRoute({
    id: "reports-debt-aging",
    middleware: [requirePermission(AdminPermission.FINANCIAL_REPORTS_VIEW)],
    loadRouter: () =>
      (require("../modules/reports-debt-aging/reports-debt-aging.router") as typeof import("../modules/reports-debt-aging/reports-debt-aging.router"))
        .reportsDebtAgingRouter,
  }),
  defineApiRoute({
    id: "reports-renewal-forecast",
    middleware: [requirePermission(AdminPermission.FINANCIAL_REPORTS_VIEW)],
    loadRouter: () =>
      (require("../modules/reports-renewal-forecast/reports-renewal-forecast.router") as typeof import("../modules/reports-renewal-forecast/reports-renewal-forecast.router"))
        .reportsRenewalForecastRouter,
  }),
  defineApiRoute({
    id: "reports-payroll-variance",
    middleware: [requirePermission(AdminPermission.PAYROLL_MANAGE)],
    loadRouter: () =>
      (require("../modules/reports-payroll-variance/reports-payroll-variance.router") as typeof import("../modules/reports-payroll-variance/reports-payroll-variance.router"))
        .reportsPayrollVarianceRouter,
  }),
  defineApiRoute({
    id: "reports-attendance-compliance",
    middleware: [requirePermission(AdminPermission.ATTENDANCE_VIEW)],
    loadRouter: (edition) =>
      (require("../modules/reports-attendance-compliance/reports-attendance-compliance.router") as typeof import("../modules/reports-attendance-compliance/reports-attendance-compliance.router"))
        .createReportsAttendanceComplianceRouter(edition),
  }),
  defineApiRoute({
    id: "reports-cashflow",
    middleware: [requirePermission(AdminPermission.FINANCIAL_REPORTS_VIEW)],
    loadRouter: () =>
      (require("../modules/reports-cashflow/reports-cashflow.router") as typeof import("../modules/reports-cashflow/reports-cashflow.router"))
        .reportsCashflowRouter,
  }),
] as const);

function assertApiRouteRegistryIsComplete(): void {
  const registrationIds = apiRouteRegistrations.map((registration) => registration.id);
  const uniqueRegistrationIds = new Set(registrationIds);
  if (uniqueRegistrationIds.size !== registrationIds.length) {
    throw new Error("HTTP route registration contains a duplicate route id");
  }

  const expectedIds = HTTP_ROUTE_REGISTRY.filter((definition) => definition.path.startsWith("/api/v1/")).map(
    (definition) => definition.id
  );
  const missingIds = expectedIds.filter((id) => !uniqueRegistrationIds.has(id));
  const unexpectedIds = registrationIds.filter((id) => !expectedIds.includes(id));
  if (missingIds.length > 0 || unexpectedIds.length > 0) {
    throw new Error(
      `HTTP route registration does not match the central registry (missing=${missingIds.join(",") || "none"}; unexpected=${unexpectedIds.join(",") || "none"})`
    );
  }
}

assertApiRouteRegistryIsComplete();

function isRegistrationEnabled(edition: AppEdition, registration: ApiRouteRegistration) {
  const definition = getHttpRouteDefinition(registration.id);
  return definition.capability === null || isFeatureEnabled(edition, definition.capability, runtimeOptionalFeatureFlags);
}

function getApiMountPath(id: HttpRouteId): string {
  const definition = getHttpRouteDefinition(id);
  const prefix = "/api/v1";
  if (!definition.path.startsWith(`${prefix}/`)) {
    throw new Error(`HTTP route ${id} is not mounted below ${prefix}`);
  }
  return definition.path.slice(prefix.length);
}

export function registerRoutes(app: Express, edition: AppEdition) {
  const api = Router();
  const enabledRegistrations = apiRouteRegistrations.filter((registration) =>
    isRegistrationEnabled(edition, registration)
  );
  const publicAndAuth = enabledRegistrations.filter((registration) => {
    const layer = getHttpRouteDefinition(registration.id).layer;
    return layer === "PUBLIC" || layer === "AUTH";
  });
  const business = enabledRegistrations.filter((registration) =>
    getHttpRouteDefinition(registration.id).layer === "BUSINESS");

  for (const registration of publicAndAuth) {
    api.use(getApiMountPath(registration.id), ...(registration.middleware ?? []), registration.loadRouter(edition));
  }

  for (const registration of business) {
    api.use(getApiMountPath(registration.id), ...(registration.middleware ?? []), registration.loadRouter(edition));
  }

  app.use("/api/v1", api);
}
