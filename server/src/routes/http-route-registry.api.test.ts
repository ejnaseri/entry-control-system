import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { AdminPermission } from "@prisma/client";
import type { AppEdition } from "../config/env";
import { canonicalPublicServerIdentity } from "../config/build-identity";
import type {
  HttpRequestDescriptor,
  HttpRouteDefinition,
  HttpRouteId,
} from "./http-route-registry";

const TEST_DATABASE_URL = "postgresql://http_route_test:http_route_test@127.0.0.1:1/http_route_test";
const WORKER_ARGUMENT = "--http-route-worker";
const missingDotenvPath = path.join(__dirname, `.http-route-test-missing-${process.pid}.env`);

const OPTIONAL_ATTENDANCE_ENV_FLAGS = [
  "APP_FEATURE_ATTENDANCE_COMPLIANCE",
  "APP_FEATURE_INBOX",
  "APP_FEATURE_SOUNDS",
  "APP_FEATURE_DEVICE_DIAGNOSTICS",
  "APP_FEATURE_DOOR_CONTROL",
] as const;

const OPTIONAL_ATTENDANCE_CAPABILITIES = [
  "ATTENDANCE_COMPLIANCE",
  "INBOX",
  "SOUNDS",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
] as const;

const APP_ENV_KEYS = new Set([
  "NODE_ENV",
  "APP_EDITION",
  "PORT",
  "DATABASE_URL",
  "LOG_LEVEL",
  "SHADOW_DATABASE_URL",
  "ZKTECO_HOST",
  "ZKTECO_PORT",
  "ZKTECO_PASS",
  "ZKTECO_POLL_INTERVAL_MS",
  "DOOR_RELAY_HOST",
  "DOOR_RELAY_PORT",
  "DOOR_RELAY_PATH",
  "DOOR_OPEN_SECONDS",
  "AUTH_COOKIE_NAME",
  "AUTH_SESSION_HOURS",
  "CLIENT_ORIGIN",
  "ATLASGYM_BACKUP_ROOT",
  "ATLASGYM_PG_DUMP_PATH",
  "ATLASGYM_CREATEDB_PATH",
  "ATLASGYM_DROPDB_PATH",
  "ATLASGYM_PG_RESTORE_PATH",
  "ATLASGYM_PSQL_PATH",
  "ATLASGYM_BACKUP_TIMEOUT_MS",
  ...OPTIONAL_ATTENDANCE_ENV_FLAGS,
  "ICLOCK_DEBUG",
]);

const EXPECTED_FULL_INVENTORY = [
  { id: "api-identity", path: "/api", capability: null, layer: "PUBLIC", boundaryMatch: "EXACT" },
  { id: "health", path: "/api/v1/health", capability: null, layer: "PUBLIC", boundaryMatch: "PREFIX" },
  { id: "auth", path: "/api/v1/auth", capability: "AUTH", layer: "AUTH", boundaryMatch: "PREFIX" },
  { id: "iclock", path: "/iclock", capability: "ICLOCK_ADMS", layer: "SPECIAL", boundaryMatch: "PREFIX" },
  {
    id: "device-push",
    path: "/api/v1/devices",
    capability: "GENERIC_DEVICE_PUSH",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "device-diagnostics",
    path: "/api/v1/devices",
    capability: "DEVICE_DIAGNOSTICS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "device-door-control",
    path: "/api/v1/devices",
    capability: "DOOR_CONTROL",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "admin-users",
    path: "/api/v1/admin-users",
    capability: "ADMIN_USERS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "audit-logs",
    path: "/api/v1/audit-logs",
    capability: "AUDIT_LOGS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "members",
    path: "/api/v1/members",
    capability: "CUSTOMERS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "employees",
    path: "/api/v1/employees",
    capability: "EMPLOYEES",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "attendance-entry-logs",
    path: "/api/v1/attendance",
    capability: "ENTRY_LOGS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "attendance-daily",
    path: "/api/v1/attendance",
    capability: "ATTENDANCE_DAILY",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "membership-plans",
    path: "/api/v1/membership-plans",
    capability: "MEMBERSHIPS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "staff-groups",
    path: "/api/v1/staff-groups",
    capability: "STAFF_GROUPS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "shifts",
    path: "/api/v1/shifts",
    capability: "STAFF_GROUPS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "devices",
    path: "/api/v1/devices",
    capability: "DEVICES",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "dashboard-attendance",
    path: "/api/v1/dashboard",
    capability: "ATTENDANCE_DASHBOARD",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "dashboard-customers",
    path: "/api/v1/dashboard",
    capability: "CUSTOMERS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "dashboard-financial",
    path: "/api/v1/dashboard",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  { id: "inbox", path: "/api/v1/inbox", capability: "INBOX", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "sounds", path: "/api/v1/sounds", capability: "SOUNDS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "backups", path: "/api/v1/backups", capability: "BACKUPS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "payroll", path: "/api/v1/payroll", capability: "PAYROLL", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "expenses", path: "/api/v1/expenses", capability: "EXPENSES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  {
    id: "membership-report",
    path: "/api/v1/membership-report",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-attendance",
    path: "/api/v1/reports/attendance",
    capability: "ATTENDANCE_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-customer-activity",
    path: "/api/v1/reports/customer-activity",
    capability: "CUSTOMERS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-debt-aging",
    path: "/api/v1/reports/debt-aging",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-renewal-forecast",
    path: "/api/v1/reports/renewal-forecast",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-payroll-variance",
    path: "/api/v1/reports/payroll-variance",
    capability: "PAYROLL",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-attendance-compliance",
    path: "/api/v1/reports/attendance-compliance",
    capability: "ATTENDANCE_COMPLIANCE",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-cashflow",
    path: "/api/v1/reports/cashflow",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
] as const satisfies readonly HttpRouteDefinition[];

const EXPECTED_ATTENDANCE_INVENTORY = [
  { id: "api-identity", path: "/api", capability: null, layer: "PUBLIC", boundaryMatch: "EXACT" },
  { id: "health", path: "/api/v1/health", capability: null, layer: "PUBLIC", boundaryMatch: "PREFIX" },
  { id: "auth", path: "/api/v1/auth", capability: "AUTH", layer: "AUTH", boundaryMatch: "PREFIX" },
  { id: "admin-users", path: "/api/v1/admin-users", capability: "ADMIN_USERS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "audit-logs", path: "/api/v1/audit-logs", capability: "AUDIT_LOGS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "employees", path: "/api/v1/employees", capability: "EMPLOYEES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "attendance-entry-logs", path: "/api/v1/attendance", capability: "ENTRY_LOGS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "attendance-daily", path: "/api/v1/attendance", capability: "ATTENDANCE_DAILY", layer: "BUSINESS", boundaryMatch: "RESERVED_ONLY" },
  { id: "devices", path: "/api/v1/devices", capability: "DEVICES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "dashboard-attendance", path: "/api/v1/dashboard", capability: "ATTENDANCE_DASHBOARD", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "backups", path: "/api/v1/backups", capability: "BACKUPS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "reports-attendance", path: "/api/v1/reports/attendance", capability: "ATTENDANCE_REPORTS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
] as const satisfies readonly HttpRouteDefinition[];

type RouteProbe = Readonly<{
  id: HttpRouteId;
  method: string;
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: string;
}>;

const DISABLED_ROUTE_PROBES = [
  {
    id: "iclock",
    method: "POST",
    path: "/iclock/cdata?SN=http-route-test&table=ATTLOG",
    headers: { "content-type": "application/octet-stream" },
    body: "probe",
  },
  {
    id: "device-push",
    method: "POST",
    path: "/api/v1/devices/push-test",
    headers: { "content-type": "application/octet-stream" },
    body: "probe",
  },
  { id: "device-diagnostics", method: "GET", path: "/api/v1/devices/raw-logs" },
  { id: "device-door-control", method: "POST", path: "/api/v1/devices/device-test/unlock" },
  { id: "members", method: "GET", path: "/api/v1/members" },
  { id: "membership-plans", method: "GET", path: "/api/v1/membership-plans" },
  { id: "staff-groups", method: "GET", path: "/api/v1/staff-groups" },
  { id: "shifts", method: "GET", path: "/api/v1/shifts" },
  { id: "dashboard-customers", method: "GET", path: "/api/v1/dashboard/details?type=activeMembers" },
  { id: "dashboard-financial", method: "GET", path: "/api/v1/dashboard/reports-summary" },
  { id: "inbox", method: "GET", path: "/api/v1/inbox" },
  { id: "sounds", method: "GET", path: "/api/v1/sounds" },
  { id: "payroll", method: "GET", path: "/api/v1/payroll" },
  { id: "expenses", method: "GET", path: "/api/v1/expenses" },
  { id: "membership-report", method: "GET", path: "/api/v1/membership-report" },
  { id: "reports-customer-activity", method: "GET", path: "/api/v1/reports/customer-activity" },
  { id: "reports-debt-aging", method: "GET", path: "/api/v1/reports/debt-aging" },
  { id: "reports-renewal-forecast", method: "GET", path: "/api/v1/reports/renewal-forecast" },
  { id: "reports-payroll-variance", method: "GET", path: "/api/v1/reports/payroll-variance" },
  {
    id: "reports-attendance-compliance",
    method: "GET",
    path: "/api/v1/reports/attendance-compliance",
  },
  { id: "reports-cashflow", method: "GET", path: "/api/v1/reports/cashflow" },
] as const satisfies readonly RouteProbe[];

const DEVICE_CORE_ROUTE_PROBES = [
  { id: "devices", method: "GET", path: "/api/v1/devices" },
  { id: "devices", method: "GET", path: "/api/v1/devices/status" },
  { id: "devices", method: "GET", path: "/api/v1/devices/events" },
  { id: "devices", method: "POST", path: "/api/v1/devices", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "GET", path: "/api/v1/devices/device-test" },
  { id: "devices", method: "PUT", path: "/api/v1/devices/device-test", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/test-connection" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/enroll", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "GET", path: "/api/v1/devices/device-test/users" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/users/sync" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/users/upsert", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/users/delete", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "GET", path: "/api/v1/devices/device-test/time" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/time", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "devices", method: "GET", path: "/api/v1/devices/device-test/suggest-user-id" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/enable" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/disable" },
  { id: "devices", method: "GET", path: "/api/v1/devices/device-test/runtime-status" },
] as const satisfies readonly RouteProbe[];

const ADMIN_USER_ROUTE_PROBES = [
  { id: "admin-users", method: "GET", path: "/api/v1/admin-users" },
  { id: "admin-users", method: "GET", path: "/api/v1/admin-users/roles" },
  { id: "admin-users", method: "POST", path: "/api/v1/admin-users", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "admin-users", method: "PUT", path: "/api/v1/admin-users/cmadminuser000000000000001", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "admin-users", method: "POST", path: "/api/v1/admin-users/cmadminuser000000000000001/reset-password", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "admin-users", method: "POST", path: "/api/v1/admin-users/cmadminuser000000000000001/deactivate" },
  { id: "admin-users", method: "POST", path: "/api/v1/admin-users/cmadminuser000000000000001/reactivate" },
] as const satisfies readonly RouteProbe[];

const EVENT_PUSH_PROBE = {
  id: "device-push",
  method: "POST",
  path: "/api/v1/devices/events/push",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ deviceId: "missing-device" }),
} as const satisfies RouteProbe;

const EMPLOYEE_ROUTE_PROBES = [
  {
    id: "employees",
    method: "POST",
    path: "/api/v1/employees",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  { id: "employees", method: "GET", path: "/api/v1/employees/cmemployee00000000000000001" },
  {
    id: "employees",
    method: "PUT",
    path: "/api/v1/employees/cmemployee00000000000000001",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  {
    id: "employees",
    method: "PUT",
    path: "/api/v1/employees/cmemployee00000000000000001/shifts",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  {
    id: "employees",
    method: "PATCH",
    path: "/api/v1/employees/cmemployee00000000000000001/archive",
    headers: { "content-type": "application/json" },
    body: "{}",
  },
  { id: "employees", method: "GET", path: "/api/v1/employees/cmemployee00000000000000001/attendance" },
  { id: "employees", method: "DELETE", path: "/api/v1/employees/cmemployee00000000000000001" },
  { id: "employees", method: "GET", path: "/api/v1/employees/cmemployee00000000000000001/full" },
  { id: "employees", method: "GET", path: "/api/v1/employees/cmemployee00000000000000001/memberships" },
  { id: "employees", method: "GET", path: "/api/v1/employees/cmemployee00000000000000001/payments" },
] as const satisfies readonly RouteProbe[];

const ATTENDANCE_ROUTE_PROBES = [
  { id: "attendance-entry-logs", method: "GET", path: "/api/v1/attendance" },
  { id: "attendance-entry-logs", method: "GET", path: "/api/v1/attendance/options/devices" },
  { id: "attendance-daily", method: "GET", path: "/api/v1/attendance/daily" },
  { id: "attendance-daily", method: "POST", path: "/api/v1/attendance/manual", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "attendance-daily", method: "POST", path: "/api/v1/attendance/justifications", headers: { "content-type": "application/json" }, body: "{}" },
  { id: "attendance-daily", method: "DELETE", path: "/api/v1/attendance/justifications" },
] as const satisfies readonly RouteProbe[];

const AUDIT_LOG_ROUTE_PROBES = [
  { id: "audit-logs", method: "GET", path: "/api/v1/audit-logs" },
  { id: "audit-logs", method: "GET", path: "/api/v1/audit-logs/options" },
] as const satisfies readonly RouteProbe[];

const BACKUP_ROUTE_PROBES = [
  { id: "backups", method: "GET", path: "/api/v1/backups" },
] as const satisfies readonly RouteProbe[];

const ATTENDANCE_ENTRY_EXPORT_ROUTE_PROBES = [
  { id: "attendance-entry-logs", method: "GET", path: "/api/v1/attendance/export.csv?from=2026-08-01&to=2026-08-24&lang=en" },
  { id: "attendance-entry-logs", method: "GET", path: "/api/v1/attendance/export.xlsx?from=2026-08-01&to=2026-08-24&lang=en" },
] as const satisfies readonly RouteProbe[];

const ATTENDANCE_DASHBOARD_ROUTE_PROBES = [
  { id: "dashboard-attendance", method: "GET", path: "/api/v1/dashboard/summary" },
] as const satisfies readonly RouteProbe[];

const ATTENDANCE_REPORT_ROUTE_PROBES = [
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/options" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/summary?from=2026-08-01&to=2026-08-24" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/daily?from=2026-08-01&to=2026-08-24" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/members?from=2026-08-01&to=2026-08-24" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/evidence?from=2026-08-01&to=2026-08-24" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/timecard?month=2026-08" },
] as const satisfies readonly RouteProbe[];

const ATTENDANCE_REPORT_EXPORT_ROUTE_PROBES = [
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/export.csv?from=2026-08-01&to=2026-08-24&variant=daily&lang=en" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/export.xlsx?from=2026-08-01&to=2026-08-24&lang=en" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/export.pdf?from=2026-08-01&to=2026-08-24&lang=en" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/timecard/export.csv?month=2026-08&lang=en" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/timecard/export.xlsx?month=2026-08&lang=en" },
  { id: "reports-attendance", method: "GET", path: "/api/v1/reports/attendance/timecard/export.pdf?month=2026-08&lang=en" },
] as const satisfies readonly RouteProbe[];

const RESERVED_BOUNDARY_PROBES = [
  {
    id: "device-push",
    method: "POST",
    path: "/api/v1/devices/push-test",
  },
  {
    id: "device-push",
    method: "POST",
    path: "/api/v1/devices/events/push",
  },
  { id: "device-diagnostics", method: "GET", path: "/api/v1/devices/scan/scan-test" },
  { id: "device-diagnostics", method: "GET", path: "/api/v1/devices/raw-logs" },
  {
    id: "device-diagnostics",
    method: "GET",
    path: "/api/v1/devices/raw-logs/support-bundle",
  },
  { id: "device-diagnostics", method: "GET", path: "/api/v1/devices/device-test/logs" },
  {
    id: "device-diagnostics",
    method: "POST",
    path: "/api/v1/devices/scan/scan-test/cancel",
  },
  { id: "device-diagnostics", method: "POST", path: "/api/v1/devices/device-test/diagnose" },
  { id: "device-diagnostics", method: "POST", path: "/api/v1/devices/device-test/scan" },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/test" },
  {
    id: "devices",
    method: "POST",
    path: "/api/v1/devices/device-test/test-connection",
  },
  { id: "devices", method: "POST", path: "/api/v1/devices/device-test/time" },
  {
    id: "device-diagnostics",
    method: "POST",
    path: "/api/v1/devices/device-test/logs/clear",
  },
  { id: "device-door-control", method: "POST", path: "/api/v1/devices/device-test/unlock" },
  { id: "attendance-entry-logs", method: "GET", path: "/api/v1/attendance" },
  { id: "attendance-daily", method: "POST", path: "/api/v1/attendance/manual" },
  { id: "attendance-daily", method: "GET", path: "/api/v1/attendance/daily" },
  { id: "attendance-daily", method: "POST", path: "/api/v1/attendance/justifications" },
  { id: "attendance-daily", method: "DELETE", path: "/api/v1/attendance/justifications" },
  { id: "dashboard-attendance", method: "GET", path: "/api/v1/dashboard/summary" },
  { id: "dashboard-financial", method: "GET", path: "/api/v1/dashboard/reports-summary" },
  {
    id: "dashboard-customers",
    method: "GET",
    path: "/api/v1/dashboard/details?type=activeMembers",
  },
  {
    id: "dashboard-customers",
    method: "GET",
    path: "/api/v1/dashboard/details?type=expiringSoon",
  },
  {
    id: "dashboard-financial",
    method: "GET",
    path: "/api/v1/dashboard/details?type=debtors",
  },
  {
    id: "dashboard-financial",
    method: "GET",
    path: "/api/v1/dashboard/details?type=revenueToday",
  },
  {
    id: "dashboard-attendance",
    method: "GET",
    path: "/api/v1/dashboard/details?type=insideNow",
  },
  {
    id: "dashboard-attendance",
    method: "GET",
    path: "/api/v1/dashboard/details?type=todaysEntries",
  },
  { id: "dashboard-attendance", method: "GET", path: "/api/v1/dashboard/details" },
  {
    id: "dashboard-attendance",
    method: "GET",
    path: "/api/v1/dashboard/details?type=unsupported",
  },
] as const satisfies readonly RouteProbe[];

const PREFLIGHT_ORIGIN = "http://127.0.0.1:5173";

function buildDisabledParserBypassProbes(): readonly RouteProbe[] {
  const oversizedValue = "x".repeat(5 * 1024 * 1024 + 1);
  return [
    {
      id: "members",
      method: "POST",
      path: "/api/v1/members",
      headers: { "content-type": "application/json" },
      body: "{",
    },
    {
      id: "members",
      method: "POST",
      path: "/api/v1/members",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: oversizedValue }),
    },
    {
      id: "members",
      method: "POST",
      path: "/api/v1/members",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `payload=${oversizedValue}`,
    },
  ];
}

const DISABLED_ROUTER_MODULES = [
  "../modules/members/member.router.js",
  "../modules/membership-plans/plan.router.js",
  "../modules/staff-groups/staff-group.router.js",
  "../modules/shifts/shift.router.js",
  "../modules/devices/device-push.router.js",
  "../modules/devices/device-diagnostics.router.js",
  "../modules/devices/device-door-control.router.js",
  "../modules/devices/iclock.router.js",
  "../modules/dashboard/dashboard.router.js",
  "../modules/inbox/inbox.router.js",
  "../modules/sounds/sounds.router.js",
  "../modules/payroll/payroll.router.js",
  "../modules/expenses/expenses.router.js",
  "../modules/membership-report/membership-report.router.js",
  "../modules/reports-attendance/reports-attendance.router.js",
  "../modules/reports-customer-activity/reports-customer-activity.router.js",
  "../modules/reports-debt-aging/reports-debt-aging.router.js",
  "../modules/reports-renewal-forecast/reports-renewal-forecast.router.js",
  "../modules/reports-payroll-variance/reports-payroll-variance.router.js",
  "../modules/reports-attendance-compliance/reports-attendance-compliance.router.js",
  "../modules/reports-cashflow/reports-cashflow.router.js",
] as const;

const DEVICE_CORE_OPTIONAL_MODULES = [
  "../modules/devices/device.router.js",
  "../modules/devices/device-push.router.js",
  "../modules/devices/device-diagnostics.router.js",
  "../modules/devices/device-door-control.router.js",
  "../modules/devices/deviceDiagnostics.js",
  "../modules/devices/deviceSupportBundle.service.js",
  "../modules/devices/deviceManager.js",
  "../modules/door/door.service.js",
  "../modules/inbox/inbox.device.js",
  "../modules/inbox/inbox.service.js",
] as const;

const STARTUP_ONLY_MODULES = [
  "../bootstrap.js",
  "../index.js",
  "../modules/inbox/inbox.jobs.js",
  "../modules/inbox/inbox.ws.js",
] as const;

type QueryCounters = {
  health: number;
  maintenance: number;
  sessions: number;
  sessionUpdates: number;
  rolePermissions: number;
  userPermissions: number;
  deviceFindUnique: number;
  deviceFindFirst: number;
};

type MaintenanceMode = "inactive" | "active";

function clearAppEnv(target: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(target)) {
    if (APP_ENV_KEYS.has(key.toUpperCase())) {
      delete target[key];
    }
  }
}

function buildChildEnv(edition: AppEdition): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  clearAppEnv(childEnv);
  childEnv["NODE_ENV"] = "test";
  childEnv["APP_EDITION"] = edition;
  childEnv["DATABASE_URL"] = TEST_DATABASE_URL;
  childEnv["LOG_LEVEL"] = "error";
  childEnv["DOTENV_CONFIG_PATH"] = missingDotenvPath;
  childEnv["DOTENV_CONFIG_QUIET"] = "true";
  childEnv["ICLOCK_DEBUG"] = "0";
  if (edition === "ATTENDANCE") {
    for (const flag of OPTIONAL_ATTENDANCE_ENV_FLAGS) {
      childEnv[flag] = "1";
    }
  }
  return childEnv;
}

function runWorker(edition: AppEdition): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [__filename, WORKER_ARGUMENT, edition], {
    cwd: __dirname,
    encoding: "utf8",
    env: buildChildEnv(edition),
    shell: false,
    timeout: 60_000,
    windowsHide: true,
  });
}

function describeWorker(result: SpawnSyncReturns<string>): string {
  return JSON.stringify({
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
}

function assertWorkerPassed(result: SpawnSyncReturns<string>, edition: AppEdition): void {
  const description = describeWorker(result);
  assert.equal(result.error, undefined, `${edition} route worker failed to complete: ${description}`);
  assert.equal(result.signal, null, `${edition} route worker was terminated: ${description}`);
  assert.equal(result.status, 0, `${edition} route worker failed: ${description}`);
  assert.match(result.stdout, new RegExp(`HTTP_ROUTE_WORKER_OK:${edition}`, "u"));
}

function requestDescriptor(probe: RouteProbe): HttpRequestDescriptor {
  const requestUrl = new URL(probe.path, "http://route.test");
  return {
    method: probe.method,
    pathname: requestUrl.pathname,
    query: Object.fromEntries(requestUrl.searchParams.entries()),
  };
}

function expectedDisabledRouteIds(): HttpRouteId[] {
  return EXPECTED_FULL_INVENTORY
    .filter((definition) => !EXPECTED_ATTENDANCE_INVENTORY.some((enabled) => enabled.id === definition.id))
    .map((definition) => definition.id)
    .sort();
}

async function readJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

async function assertJsonResponse(response: Response, status: number, expected: unknown): Promise<void> {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/u);
  assert.deepEqual(await readJson(response), expected);
}

async function assertHealthResponse(response: Response): Promise<void> {
  assert.equal(response.status, 200);
  const payload = (await readJson(response)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(payload).sort(), ["database", "status", "timestamp"]);
  assert.equal(payload["status"], "ok");
  assert.equal(payload["database"], true);
  assert.equal(typeof payload["timestamp"], "string");
  assert.ok(!Number.isNaN(Date.parse(payload["timestamp"] as string)));
}

function fetchProbe(baseUrl: string, probe: RouteProbe, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { ...(probe.headers ?? {}) };
  if (cookie) {
    headers["cookie"] = cookie;
  }
  const init: RequestInit = { method: probe.method, headers };
  if (probe.body !== undefined) {
    init.body = probe.body;
  }
  return fetch(`${baseUrl}${probe.path}`, init);
}

function fetchPushPreflight(baseUrl: string): Promise<Response> {
  return fetch(`${baseUrl}/api/v1/devices/push-test`, {
    method: "OPTIONS",
    headers: {
      origin: PREFLIGHT_ORIGIN,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server?.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function assertModulesLoaded(modulePaths: readonly string[], expected: boolean, label: string): void {
  const unexpected = modulePaths
    .map((relativePath) => path.resolve(__dirname, relativePath))
    .filter((modulePath) => (require.cache[modulePath] !== undefined) !== expected);
  assert.deepEqual(unexpected, [], label);
}

function assertAttendanceDeviceCoreModuleIsolation(): void {
  const core = require("../modules/devices/device-core.router") as typeof import("../modules/devices/device-core.router");
  core.createDeviceCoreRouter("ATTENDANCE");
  assertModulesLoaded(
    DEVICE_CORE_OPTIONAL_MODULES,
    false,
    "Attendance Device Core imported or constructed an optional/legacy Device module"
  );
}

async function assertDeviceCoreRouterFactoryContract(
  expressModule: typeof import("express"),
  permissions: typeof import("@prisma/client").AdminPermission
): Promise<void> {
  const core = require("../modules/devices/device-core.router") as typeof import("../modules/devices/device-core.router");
  const calls: Array<{ operation: "test" | "time"; scope: string }> = [];
  const manager = {
    testDeviceConnection: async (_deviceId: string, scope: string) => {
      calls.push({ operation: "test", scope });
      return { ok: true, status: "ONLINE" };
    },
    setDeviceTime: async (_deviceId: string, timestamp: Date, scope: string) => {
      calls.push({ operation: "time", scope });
      return { time: timestamp, mode: "fake" };
    },
  } as unknown as ReturnType<import("../modules/devices/device-core.router").DeviceCoreRouterApi["loadManager"]>;
  const api: Partial<import("../modules/devices/device-core.router").DeviceCoreRouterApi> = {
    loadManager: () => manager,
    loadService: () => {
      throw new Error("Device Core factory permission test unexpectedly loaded the Device service");
    },
    prisma: new Proxy(
      {},
      {
        get() {
          throw new Error("Device Core factory permission test unexpectedly queried Prisma");
        },
      }
    ) as import("../modules/devices/device-core.router").DeviceCoreRouterApi["prisma"],
    getRecentEvents: () => {
      throw new Error("Device Core factory permission test unexpectedly read the event buffer");
    },
    subscribeSse: () => {
      throw new Error("Device Core factory permission test unexpectedly subscribed to SSE");
    },
    runAuditedDeviceCommand: (async (input: { execute: () => unknown | Promise<unknown> }) =>
      input.execute()) as import("../modules/devices/device-core.router").DeviceCoreRouterApi["runAuditedDeviceCommand"],
  };
  const app = (expressModule as unknown as () => import("express").Express)();
  const mount = (prefix: string, edition: AppEdition, granted: readonly AdminPermission[]) => {
    app.use(
      prefix,
      (req: any, _res: any, next: (error?: unknown) => void) => {
        req.auth = {
          user: { id: "router-test-admin", role: "GYM_OWNER" },
          session: { id: "router-test-session" },
          permissions: [...granted],
        };
        next();
      },
      core.createDeviceCoreRouter(edition, api)
    );
  };
  mount("/strict-view", "ATTENDANCE", [permissions.DEVICES_VIEW]);
  mount("/strict-owner", "ATTENDANCE", [permissions.DEVICES_VIEW, permissions.SYSTEM_SETTINGS_MANAGE]);
  mount("/full-view", "FULL", [permissions.DEVICES_VIEW, permissions.SYSTEM_SETTINGS_MANAGE]);
  mount("/full-tech", "FULL", [permissions.DEVICES_VIEW, permissions.DEVICES_DIAGNOSTICS]);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const deviceId = "cmdevicerouter000000000000001";

    let response = await fetch(`${baseUrl}/strict-view/${deviceId}/test-connection`, { method: "POST" });
    assert.equal(response.status, 200);
    await response.text();
    assert.deepEqual(calls, [{ operation: "test", scope: "STRICT_STAFF" }]);

    response = await fetch(`${baseUrl}/full-view/${deviceId}/test-connection`, { method: "POST" });
    await assertJsonResponse(response, 403, {
      message: "Permission denied",
      requiredPermission: permissions.DEVICES_DIAGNOSTICS,
    });
    assert.equal(calls.length, 1, "FULL test-connection invoked manager without legacy Diagnostics permission");

    response = await fetch(`${baseUrl}/full-tech/${deviceId}/test-connection`, { method: "POST" });
    assert.equal(response.status, 200);
    await response.text();

    response = await fetch(`${baseUrl}/strict-view/${deviceId}/time`, { method: "POST" });
    await assertJsonResponse(response, 403, {
      message: "Permission denied",
      requiredPermission: permissions.SYSTEM_SETTINGS_MANAGE,
    });
    assert.equal(calls.length, 2, "STRICT time update invoked manager without Core settings permission");

    response = await fetch(`${baseUrl}/strict-owner/${deviceId}/time`, { method: "POST" });
    assert.equal(response.status, 200);
    await response.text();

    response = await fetch(`${baseUrl}/full-view/${deviceId}/time`, { method: "POST" });
    await assertJsonResponse(response, 403, {
      message: "Permission denied",
      requiredPermission: permissions.DEVICES_DIAGNOSTICS,
    });
    assert.equal(calls.length, 3, "FULL time update invoked manager without legacy Diagnostics permission");

    response = await fetch(`${baseUrl}/full-tech/${deviceId}/time`, { method: "POST" });
    assert.equal(response.status, 200);
    await response.text();
    assert.deepEqual(calls, [
      { operation: "test", scope: "STRICT_STAFF" },
      { operation: "test", scope: "FULL_LEGACY" },
      { operation: "time", scope: "STRICT_STAFF" },
      { operation: "time", scope: "FULL_LEGACY" },
    ]);
  } finally {
    await closeServer(server);
  }
}

function installPrismaMocks(
  prisma: any,
  runtime: typeof import("@prisma/client"),
  counters: QueryCounters,
  getMaintenanceMode: () => MaintenanceMode,
  getRolePermissions: () => readonly AdminPermission[]
): () => void {
  const original = {
    queryRaw: prisma.$queryRaw,
    settingFindUnique: prisma.systemSetting.findUnique,
    sessionFindUnique: prisma.adminSession.findUnique,
    sessionUpdate: prisma.adminSession.update,
    rolePermissionFindMany: prisma.adminRolePermission.findMany,
    userPermissionFindMany: prisma.adminUserPermission.findMany,
    deviceFindUnique: prisma.device.findUnique,
    deviceFindFirst: prisma.device.findFirst,
  };

  const now = new Date("2026-08-04T12:00:00.000Z");
  const adminUser = {
    id: "limited-user",
    username: "limited",
    email: null,
    fullName: "Limited User",
    role: runtime.AdminRole.STAFF,
    isActive: true,
    isProtected: false,
    lastLoginAt: null,
    passwordChangedAt: now,
    deactivatedAt: null,
    vendorMaintenanceActivatedAt: null,
    vendorMaintenanceExpiresAt: null,
    vendorMaintenanceReason: null,
    vendorMaintenanceActivatedById: null,
    createdAt: now,
    updatedAt: now,
  };

  prisma.$queryRaw = async () => {
    counters.health += 1;
    return [{ ok: 1 }];
  };
  prisma.systemSetting.findUnique = async () => {
    counters.maintenance += 1;
    if (getMaintenanceMode() === "inactive") {
      return null;
    }
    return {
      value: JSON.stringify({
        enabled: true,
        restoreJobId: "restore-job-test",
        startedAt: now.toISOString(),
        selectedBackupFolderName: "backup-folder-test",
      }),
      updatedAt: now,
    };
  };
  prisma.adminSession.findUnique = async () => {
    counters.sessions += 1;
    return {
      id: "limited-session",
      adminUserId: adminUser.id,
      tokenHash: "ignored",
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      adminUser,
    };
  };
  prisma.adminSession.update = async () => {
    counters.sessionUpdates += 1;
    return { id: "limited-session" };
  };
  prisma.adminRolePermission.findMany = async () => {
    counters.rolePermissions += 1;
    return getRolePermissions().map((permission) => ({ permission }));
  };
  prisma.adminUserPermission.findMany = async () => {
    counters.userPermissions += 1;
    return [];
  };
  prisma.device.findUnique = async () => {
    counters.deviceFindUnique += 1;
    return null;
  };
  prisma.device.findFirst = async () => {
    counters.deviceFindFirst += 1;
    return null;
  };

  return () => {
    prisma.$queryRaw = original.queryRaw;
    prisma.systemSetting.findUnique = original.settingFindUnique;
    prisma.adminSession.findUnique = original.sessionFindUnique;
    prisma.adminSession.update = original.sessionUpdate;
    prisma.adminRolePermission.findMany = original.rolePermissionFindMany;
    prisma.adminUserPermission.findMany = original.userPermissionFindMany;
    prisma.device.findUnique = original.deviceFindUnique;
    prisma.device.findFirst = original.deviceFindFirst;
  };
}

async function assertCommonApi(baseUrl: string, edition: AppEdition, counters: QueryCounters): Promise<void> {
  await assertJsonResponse(await fetch(`${baseUrl}/api`), 200, canonicalPublicServerIdentity(edition));

  const healthBefore = counters.health;
  await assertHealthResponse(await fetch(`${baseUrl}/api/v1/health`));
  assert.equal(counters.health, healthBefore + 1);

  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/auth/me`), 401, {
    message: "Authentication required",
  });

  const maintenanceBefore = counters.maintenance;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/definitely-unknown`), 404, {
    message: "Route not found",
  });
  assert.equal(counters.maintenance, maintenanceBefore);
}

async function assertAttendanceBoundaries(
  baseUrl: string,
  cookie: string,
  counters: QueryCounters,
  rawFactoryCalls: () => number,
  rawHits: readonly string[],
  setMaintenanceMode: (mode: MaintenanceMode) => void,
  setRolePermissions: (permissions: readonly AdminPermission[]) => void,
  permissions: typeof import("@prisma/client").AdminPermission
): Promise<void> {
  assert.equal(rawFactoryCalls(), 0);
  const initialCounters = { ...counters };

  for (const requestCookie of [undefined, cookie]) {
    for (const probe of [...DISABLED_ROUTE_PROBES, EVENT_PUSH_PROBE]) {
      await assertJsonResponse(await fetchProbe(baseUrl, probe, requestCookie), 404, {
        message: "Route not found",
      });
    }
  }

  for (const requestCookie of [undefined, cookie]) {
    for (const probe of buildDisabledParserBypassProbes()) {
      await assertJsonResponse(await fetchProbe(baseUrl, probe, requestCookie), 404, {
        message: "Route not found",
      });
    }
  }

  const preflightRawHitsBefore = rawHits.length;
  await assertJsonResponse(await fetchPushPreflight(baseUrl), 404, { message: "Route not found" });
  assert.equal(rawHits.length, preflightRawHitsBefore);
  assert.deepEqual(counters, initialCounters, "Disabled Attendance routes must not create database queries");
  assert.deepEqual(rawHits, [], "Disabled Attendance routes must not install or execute raw parsers");

  for (const probe of EMPLOYEE_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "MEMBERS_VIEW",
    });
  }
  for (const probe of ATTENDANCE_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ATTENDANCE_VIEW",
    });
  }
  for (const probe of ATTENDANCE_DASHBOARD_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ATTENDANCE_VIEW",
    });
  }
  for (const probe of ATTENDANCE_REPORT_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ATTENDANCE_VIEW",
    });
  }
  for (const probe of DEVICE_CORE_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "DEVICES_VIEW",
    });
  }
  for (const probe of ADMIN_USER_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ADMIN_USERS_MANAGE",
    });
  }
  for (const probe of AUDIT_LOG_ROUTE_PROBES) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "AUDIT_LOG_VIEW",
    });
  }
  setRolePermissions([permissions.SIGN_IN, permissions.ATTENDANCE_VIEW]);
  for (const probe of [...ATTENDANCE_ENTRY_EXPORT_ROUTE_PROBES, ...ATTENDANCE_REPORT_EXPORT_ROUTE_PROBES]) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ATTENDANCE_EXPORT",
    });
  }
  setRolePermissions([permissions.SIGN_IN, permissions.ATTENDANCE_VIEW, permissions.FINANCIAL_EXPORT]);
  for (const probe of [...ATTENDANCE_ENTRY_EXPORT_ROUTE_PROBES, ...ATTENDANCE_REPORT_EXPORT_ROUTE_PROBES]) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 403, {
      message: "Permission denied",
      requiredPermission: "ATTENDANCE_EXPORT",
    });
  }
  setRolePermissions([permissions.SIGN_IN]);
  assert.ok(counters.maintenance > initialCounters.maintenance, "Enabled Employee routes skipped maintenance ordering");
  assert.ok(counters.sessions > initialCounters.sessions, "Enabled Employee routes skipped session validation");

  setMaintenanceMode("active");
  const maintenanceBefore = counters.maintenance;
  for (const probe of [
    DISABLED_ROUTE_PROBES.find((candidate) => candidate.id === "members")!,
    DISABLED_ROUTE_PROBES.find((candidate) => candidate.id === "device-push")!,
    DISABLED_ROUTE_PROBES.find((candidate) => candidate.id === "iclock")!,
  ]) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 404, { message: "Route not found" });
  }
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/unknown-during-maintenance`), 404, {
    message: "Route not found",
  });
  assert.equal(counters.maintenance, maintenanceBefore);
  assert.ok(counters.sessions > 0);
  assert.equal(counters.deviceFindUnique, 0);
  assert.equal(counters.deviceFindFirst, 0);

  assertModulesLoaded(DISABLED_ROUTER_MODULES, false, "Attendance loaded a disabled Router module");
  assertModulesLoaded(
    [
      "../modules/devices/deviceManager.js",
    ],
    false,
    "Attendance loaded a disabled business/runtime module"
  );
  assertModulesLoaded(
    ["../middlewares/restore-maintenance.js", "../modules/backups/backup.service.js"],
    true,
    "Enabled Employee route skipped maintenance middleware"
  );
  assertModulesLoaded(
    ["../modules/backups/backup.router.js"],
    true,
    "Attendance did not load the enabled Backup boundary"
  );
  assertModulesLoaded(
    [
      "../modules/employees/employee.router.js",
      "../modules/employees/employee.repository.js",
      "../modules/employees/employee.service.js",
    ],
    true,
    "Attendance did not load the enabled Employee boundary"
  );
  assertModulesLoaded(
    ["../modules/attendance/attendance.router.js", "../modules/attendance/attendance.service.js"],
    true,
    "Attendance did not load the enabled Attendance boundary"
  );
  assertModulesLoaded(
    [
      "../modules/dashboard/attendance-dashboard.router.js",
      "../modules/dashboard/attendance-dashboard.service.js",
    ],
    true,
    "Attendance did not load its independent Dashboard boundary"
  );
  assertModulesLoaded(
    [
      "../modules/reports-attendance/attendance-report-export.router.js",
      "../modules/reports-attendance/attendance-report.router.js",
      "../modules/reports-attendance/attendance-report.service.js",
      "../modules/reports-attendance/attendance-report-timecard.service.js",
      "../modules/reports-attendance/attendance-report.schemas.js",
      "../modules/reports-attendance/reports-attendance.service.js",
    ],
    true,
    "Attendance did not load its independent Report read boundary"
  );
  assertModulesLoaded(
    ["../modules/devices/device-core.router.js"],
    true,
    "Attendance did not load the enabled Device Core boundary"
  );
  assertModulesLoaded(
    ["../modules/admin-users/admin-user.router.js", "../modules/admin-users/admin-user.service.js"],
    true,
    "Attendance did not load the enabled Admin User boundary"
  );
  assertModulesLoaded(
    ["../modules/audit-logs/audit-log.router.js", "../modules/audit-logs/audit-log.service.js", "../modules/audit-logs/audit-log-edition-policy.js"],
    true,
    "Attendance did not load the Edition-filtered Audit boundary"
  );
  assertAttendanceDeviceCoreModuleIsolation();
}

async function assertFullBoundaries(
  baseUrl: string,
  cookie: string,
  counters: QueryCounters,
  rawFactoryCalls: () => number,
  rawHits: readonly string[],
  setMaintenanceMode: (mode: MaintenanceMode) => void,
  setRolePermissions: (permissions: readonly AdminPermission[]) => void,
  permissions: typeof import("@prisma/client").AdminPermission
): Promise<void> {
  assert.ok(rawFactoryCalls() > 0, "FULL must construct raw middleware for legacy device endpoints");

  const preflightMaintenanceBefore = counters.maintenance;
  const preflightSessionsBefore = counters.sessions;
  const preflightRawHitsBefore = rawHits.length;
  const preflightResponse = await fetchPushPreflight(baseUrl);
  assert.equal(preflightResponse.status, 204);
  assert.equal(await preflightResponse.text(), "");
  assert.equal(preflightResponse.headers.get("access-control-allow-origin"), PREFLIGHT_ORIGIN);
  assert.match(preflightResponse.headers.get("access-control-allow-methods") ?? "", /(?:^|,)POST(?:,|$)/u);
  assert.equal(counters.maintenance, preflightMaintenanceBefore);
  assert.equal(counters.sessions, preflightSessionsBefore);
  assert.equal(rawHits.length, preflightRawHitsBefore);

  const protectedBusinessProbes = [...DISABLED_ROUTE_PROBES, ...EMPLOYEE_ROUTE_PROBES, ...ATTENDANCE_ROUTE_PROBES, ...ATTENDANCE_DASHBOARD_ROUTE_PROBES, ...ATTENDANCE_REPORT_ROUTE_PROBES, ...DEVICE_CORE_ROUTE_PROBES, ...ADMIN_USER_ROUTE_PROBES, ...AUDIT_LOG_ROUTE_PROBES, ...BACKUP_ROUTE_PROBES].filter(
    (probe) => probe.id !== "iclock" && probe.id !== "device-push"
  );
  counters.maintenance = 0;
  counters.sessions = 0;
  for (const probe of protectedBusinessProbes) {
    const maintenanceBefore = counters.maintenance;
    await assertJsonResponse(await fetchProbe(baseUrl, probe), 401, { message: "Authentication required" });
    assert.equal(counters.maintenance, maintenanceBefore + 1, `${probe.id} skipped restore maintenance ordering`);
  }
  assert.equal(counters.sessions, 0, "Unauthenticated requests must not query sessions without a cookie");

  const maintenanceBeforePush = counters.maintenance;
  const pushResponse = await fetchProbe(
    baseUrl,
    DISABLED_ROUTE_PROBES.find((probe) => probe.id === "device-push")!
  );
  assert.equal(pushResponse.status, 200);
  assert.match(pushResponse.headers.get("content-type") ?? "", /^text\/plain/u);
  assert.equal(await pushResponse.text(), "PUSH RECEIVED");
  assert.equal(counters.maintenance, maintenanceBeforePush + 1);

  const maintenanceBeforeEventPush = counters.maintenance;
  await assertJsonResponse(await fetchProbe(baseUrl, EVENT_PUSH_PROBE), 404, {
    message: "Device not found for push payload",
    details: { deviceId: "missing-device" },
  });
  assert.equal(counters.maintenance, maintenanceBeforeEventPush + 1);
  assert.equal(counters.deviceFindUnique, 1);
  assert.equal(counters.deviceFindFirst, 0);

  const maintenanceBeforeIclock = counters.maintenance;
  const cdataResponse = await fetchProbe(
    baseUrl,
    DISABLED_ROUTE_PROBES.find((probe) => probe.id === "iclock")!
  );
  assert.equal(cdataResponse.status, 200);
  assert.match(await cdataResponse.text(), /^OK(?:\r?\n|$)/u);
  const pingResponse = await fetch(`${baseUrl}/iclock/ping?SN=http-route-test`);
  assert.equal(pingResponse.status, 200);
  assert.equal(await pingResponse.text(), "OK\r\n");
  assert.equal(counters.maintenance, maintenanceBeforeIclock + 2);

  assert.ok(
    rawHits.some((url) => url.startsWith("/api/v1/devices/push-test")),
    "FULL push-test raw parser did not execute"
  );
  assert.ok(rawHits.some((url) => url.startsWith("/iclock/cdata")), "FULL iClock raw parser did not execute");
  assert.ok(
    !rawHits.some((url) => url.startsWith("/api/v1/devices/events/push")),
    "JSON event push must not cross the push-test raw parser"
  );

  const memberMaintenanceBefore = counters.maintenance;
  const memberSessionBefore = counters.sessions;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/members`, { headers: { cookie } }), 403, {
    message: "Permission denied",
    requiredPermission: "MEMBERS_VIEW",
  });
  assert.equal(counters.maintenance, memberMaintenanceBefore + 1);
  assert.equal(counters.sessions, memberSessionBefore + 1);

  const employeeMaintenanceBefore = counters.maintenance;
  const employeeSessionBefore = counters.sessions;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/employees`, { headers: { cookie } }), 403, {
    message: "Permission denied",
    requiredPermission: "MEMBERS_VIEW",
  });
  assert.equal(counters.maintenance, employeeMaintenanceBefore + 1);
  assert.equal(counters.sessions, employeeSessionBefore + 1);

  setRolePermissions([permissions.SIGN_IN, permissions.MEMBERS_VIEW, permissions.MEMBERS_WRITE]);
  for (const probe of EMPLOYEE_ROUTE_PROBES.filter(
    (candidate) =>
      candidate.method === "DELETE" ||
      candidate.path.endsWith("/full") ||
      candidate.path.endsWith("/memberships") ||
      candidate.path.endsWith("/payments")
  )) {
    await assertJsonResponse(await fetchProbe(baseUrl, probe, cookie), 404, { message: "Route not found" });
  }

  const planMaintenanceBefore = counters.maintenance;
  const planSessionBefore = counters.sessions;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/membership-plans`, { headers: { cookie } }), 403, {
    message: "Permission denied",
    requiredPermissions: ["MEMBERSHIPS_WRITE", "SYSTEM_SETTINGS_MANAGE"],
  });
  assert.equal(counters.maintenance, planMaintenanceBefore + 1);
  assert.equal(counters.sessions, planSessionBefore + 1);

  setRolePermissions([permissions.SIGN_IN, permissions.DEVICES_VIEW]);
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/devices/raw-logs`, { headers: { cookie } }), 403, {
    message: "Permission denied",
    requiredPermission: "DEVICES_DIAGNOSTICS",
  });
  await assertJsonResponse(
    await fetch(`${baseUrl}/api/v1/devices/device-test/unlock`, { method: "POST", headers: { cookie } }),
    403,
    { message: "Permission denied", requiredPermission: "DOOR_UNLOCK" }
  );

  setRolePermissions([permissions.SIGN_IN, permissions.ATTENDANCE_VIEW]);
  await assertJsonResponse(
    await fetch(`${baseUrl}/api/v1/attendance/manual`, { method: "POST", headers: { cookie } }),
    403,
    { message: "Permission denied", requiredPermission: "ATTENDANCE_MANUAL" }
  );

  setRolePermissions([permissions.SIGN_IN]);
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/dashboard/summary`, { headers: { cookie } }), 403, {
    message: "Permission denied",
    requiredPermission: "ATTENDANCE_VIEW",
  });
  for (const dashboardPath of [
    "/api/v1/dashboard/details?type=activeMembers",
    "/api/v1/dashboard/details?type=debtors",
  ]) {
    await assertJsonResponse(await fetch(`${baseUrl}${dashboardPath}`, { headers: { cookie } }), 403, {
      message: "Permission denied",
    });
  }

  setMaintenanceMode("active");
  const maintenanceBody = {
    message: "System is in restore maintenance mode",
    maintenance: {
      enabled: true,
      restoreJobId: "restore-job-test",
      startedAt: "2026-08-04T12:00:00.000Z",
      selectedBackupFolderName: "backup-folder-test",
    },
  };

  const publicMaintenanceBefore = counters.maintenance;
  await assertJsonResponse(await fetch(`${baseUrl}/api`), 200, canonicalPublicServerIdentity("FULL"));
  await assertHealthResponse(await fetch(`${baseUrl}/api/v1/health`));
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/auth/me`), 401, {
    message: "Authentication required",
  });
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/unknown-during-maintenance`), 404, {
    message: "Route not found",
  });
  assert.equal(counters.maintenance, publicMaintenanceBefore);

  const activeMemberBefore = counters.maintenance;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/members`), 503, maintenanceBody);
  assert.equal(counters.maintenance, activeMemberBefore + 1);

  const activePushBefore = counters.maintenance;
  await assertJsonResponse(
    await fetchProbe(baseUrl, DISABLED_ROUTE_PROBES.find((probe) => probe.id === "device-push")!),
    503,
    maintenanceBody
  );
  assert.equal(counters.maintenance, activePushBefore + 1);

  const activeBackupBefore = counters.maintenance;
  await assertJsonResponse(await fetch(`${baseUrl}/api/v1/backups`), 401, { message: "Authentication required" });
  assert.equal(counters.maintenance, activeBackupBefore + 1);

  const activeIclockBefore = counters.maintenance;
  const activePing = await fetch(`${baseUrl}/iclock/ping?SN=http-route-test-active`);
  await assertJsonResponse(activePing, 503, maintenanceBody);
  assert.equal(counters.maintenance, activeIclockBefore + 1);

  assertModulesLoaded(DISABLED_ROUTER_MODULES, true, "FULL did not load its legacy Router inventory");
  assertModulesLoaded(
    [
      "../modules/dashboard/attendance-dashboard.router.js",
      "../modules/dashboard/attendance-dashboard.service.js",
    ],
    false,
    "FULL loaded the Attendance-only Dashboard module"
  );
  assertModulesLoaded(
    [
      "../modules/reports-attendance/attendance-report-export.router.js",
      "../modules/reports-attendance/attendance-report.router.js",
      "../modules/reports-attendance/attendance-report.service.js",
      "../modules/reports-attendance/attendance-report-timecard.service.js",
      "../modules/reports-attendance/attendance-report.schemas.js",
    ],
    false,
    "FULL loaded the Attendance-only Report module"
  );
  assertModulesLoaded(
    ["../modules/devices/device.router.js"],
    false,
    "Capability-owned FULL registration loaded the legacy Device aggregator"
  );
}

async function runHttpRouteWorker(edition: AppEdition): Promise<void> {
  const runtime = require("@prisma/client") as typeof import("@prisma/client");
  const expressModule = require("express") as typeof import("express");
  const expressAny = expressModule as any;
  const originalRaw = expressAny.raw;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  let rawFactoryCalls = 0;
  const rawHits: string[] = [];
  expressAny.raw = (...args: unknown[]) => {
    rawFactoryCalls += 1;
    const parser = originalRaw(...args);
    return (req: any, res: any, next: (error?: unknown) => void) => {
      parser(req, res, (error?: unknown) => {
        if (!error && Buffer.isBuffer(req.body)) {
          rawHits.push(String(req.originalUrl));
        }
        next(error);
      });
    };
  };
  console.log = () => {};
  console.warn = () => {};

  const { env } = require("../config/env") as typeof import("../config/env");
  assert.equal(env.APP_EDITION, edition);
  const { prisma } = require("../lib/prisma") as typeof import("../lib/prisma");
  const counters: QueryCounters = {
    health: 0,
    maintenance: 0,
    sessions: 0,
    sessionUpdates: 0,
    rolePermissions: 0,
    userPermissions: 0,
    deviceFindUnique: 0,
    deviceFindFirst: 0,
  };
  let maintenanceMode: MaintenanceMode = "inactive";
  let rolePermissions: readonly AdminPermission[] = [runtime.AdminPermission.SIGN_IN];
  const restorePrisma = installPrismaMocks(
    prisma as any,
    runtime,
    counters,
    () => maintenanceMode,
    () => rolePermissions
  );
  let server: Server | undefined;

  try {
    const registry = require("./http-route-registry") as typeof import("./http-route-registry");
    const capabilities = require("../config/capabilities") as typeof import("../config/capabilities");
    if (edition === "ATTENDANCE") {
      for (const flag of OPTIONAL_ATTENDANCE_ENV_FLAGS) {
        assert.equal(process.env[flag], "1", `${flag} poison value was not present in the worker`);
      }
      for (const capability of OPTIONAL_ATTENDANCE_CAPABILITIES) {
        assert.equal(
          capabilities.isFeatureEnabled("ATTENDANCE", capability),
          false,
          `${capability} was activated by an unselected environment flag`
        );
      }
    }
    assert.deepEqual(registry.HTTP_ROUTE_REGISTRY, EXPECTED_FULL_INVENTORY);
    assert.ok(Object.isFrozen(registry.HTTP_ROUTE_REGISTRY));
    assert.ok(registry.HTTP_ROUTE_REGISTRY.every(Object.isFrozen));
    assert.deepEqual(
      registry.getEnabledHttpRouteInventory(edition),
      edition === "FULL" ? EXPECTED_FULL_INVENTORY : EXPECTED_ATTENDANCE_INVENTORY
    );
    assert.ok(Object.isFrozen(registry.getEnabledHttpRouteInventory(edition)));

    const coveredDisabledIds = [...new Set(DISABLED_ROUTE_PROBES.map((probe) => probe.id))].sort();
    assert.deepEqual(coveredDisabledIds, expectedDisabledRouteIds());
    for (const probe of [...DISABLED_ROUTE_PROBES, EVENT_PUSH_PROBE]) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), false, probe.id);
    }
    for (const probe of EMPLOYEE_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ATTENDANCE_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ATTENDANCE_ENTRY_EXPORT_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ATTENDANCE_DASHBOARD_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ATTENDANCE_REPORT_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ATTENDANCE_REPORT_EXPORT_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of DEVICE_CORE_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of ADMIN_USER_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    for (const probe of AUDIT_LOG_ROUTE_PROBES) {
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, probe.id);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)), true, probe.id);
    }
    assert.equal(RESERVED_BOUNDARY_PROBES.length, 29);
    for (const probe of RESERVED_BOUNDARY_PROBES) {
      const label = `${probe.id} ${probe.method} ${probe.path}`;
      assert.equal(registry.isHttpRequestEnabled("FULL", requestDescriptor(probe)), true, label);
      assert.equal(
        registry.isHttpRequestEnabled("ATTENDANCE", requestDescriptor(probe)),
        probe.id === "attendance-entry-logs" || probe.id === "attendance-daily" || probe.id === "dashboard-attendance" || probe.id === "devices",
        label
      );
    }
    for (const descriptor of [
      { method: "GET", pathname: "/api" },
      { method: "HEAD", pathname: "/api" },
      { method: "GET", pathname: "/api/v1/health" },
      { method: "GET", pathname: "/api/v1/auth/me" },
    ] as const) {
      assert.equal(registry.isHttpRequestEnabled("FULL", descriptor), true);
      assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", descriptor), true);
    }
    assert.equal(registry.isHttpRequestEnabled("FULL", { method: "GET", pathname: "/not-a-route" }), false);
    assert.equal(registry.isHttpRequestEnabled("ATTENDANCE", { method: "GET", pathname: "/not-a-route" }), false);
    assert.equal(
      registry.isHttpRequestEnabled("FULL", {
        method: "OPTIONS",
        pathname: "/api/v1/devices/push-test",
        preflightMethod: "POST",
      }),
      true
    );
    assert.equal(
      registry.isHttpRequestEnabled("ATTENDANCE", {
        method: "OPTIONS",
        pathname: "/api/v1/devices/push-test",
        preflightMethod: "POST",
      }),
      false
    );

    const { createApp } = require("../app") as typeof import("../app");
    server = createServer(createApp());
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const cookie = `${env.AUTH_COOKIE_NAME}=route-test-token`;

    assertModulesLoaded(STARTUP_ONLY_MODULES, false, "createApp loaded a startup-only module");
    await assertCommonApi(baseUrl, edition, counters);

    if (edition === "ATTENDANCE") {
      await assertAttendanceBoundaries(
        baseUrl,
        cookie,
        counters,
        () => rawFactoryCalls,
        rawHits,
        (mode) => {
          maintenanceMode = mode;
        },
        (nextPermissions) => {
          rolePermissions = nextPermissions;
        },
        runtime.AdminPermission
      );
      await assertDeviceCoreRouterFactoryContract(expressModule, runtime.AdminPermission);
    } else {
      await assertFullBoundaries(
        baseUrl,
        cookie,
        counters,
        () => rawFactoryCalls,
        rawHits,
        (mode) => {
          maintenanceMode = mode;
        },
        (nextPermissions) => {
          rolePermissions = nextPermissions;
        },
        runtime.AdminPermission
      );
    }

    assertModulesLoaded(STARTUP_ONLY_MODULES, false, "HTTP probes loaded a startup-only module");
    process.stdout.write(`HTTP_ROUTE_WORKER_OK:${edition}`);
  } finally {
    await closeServer(server);
    restorePrisma();
    expressAny.raw = originalRaw;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    await prisma.$disconnect();
  }
}

function runParentSuite(): void {
  for (const edition of ["FULL", "ATTENDANCE"] as const) {
    assertWorkerPassed(runWorker(edition), edition);
  }
  process.stdout.write("HTTP_ROUTE_REGISTRY_API_TESTS_PASSED\n");
}

if (process.argv[2] === WORKER_ARGUMENT) {
  const edition = process.argv[3];
  if (edition !== "FULL" && edition !== "ATTENDANCE") {
    throw new Error(`Invalid HTTP route worker edition: ${edition ?? "missing"}`);
  }
  runHttpRouteWorker(edition).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  runParentSuite();
}
