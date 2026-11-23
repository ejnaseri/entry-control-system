import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission } from "@prisma/client";
import { errorHandler } from "../../middlewares/error-handler";
import {
  ATTENDANCE_AUDIT_SCOPE_MARKER,
  getAuditLogVisibilityWhere,
  isAuditLogVisibleForEdition,
} from "./audit-log-edition-policy";
import { createAuditLogRouter, type AuditLogRouterApi } from "./audit-log.router";
import { sanitizeAuditJson } from "./audit-log.service";

const STAFF = { memberType: "STAFF", isStaff: true };
const CUSTOMER = { memberType: "CUSTOMER", isStaff: false };

function testHistoricalVisibilityPolicy() {
  assert.equal(isAuditLogVisibleForEdition("FULL", {
    action: "membership.payment.recorded", targetType: "Payment",
  }), true);

  const visibleAttendanceRows = [
    { action: "auth.login_success", targetType: "AdminUser" },
    { action: "admin_user.update", targetType: "AdminUser" },
    { action: "backup.restore.confirm.handoffCreated", targetType: "RestoreJob" },
    { action: "staff_group.updated", targetType: "StaffGroup" },
    { action: "member.created", targetType: "Member", afterData: STAFF },
    { action: "member.updated", targetType: "Member", beforeData: STAFF, afterData: STAFF },
    { action: "member.deleted", targetType: "Member", beforeData: STAFF },
    {
      action: "attendance.manual.created",
      targetType: "AttendanceLog",
      metadata: { editionScope: ATTENDANCE_AUDIT_SCOPE_MARKER },
    },
    { action: "device.user.upserted", targetType: "Device" },
    {
      action: "report.monthly_timecard.exported",
      targetType: "MonthlyTimecard",
      metadata: { filters: { memberType: "staff" } },
    },
  ] as const;
  for (const row of visibleAttendanceRows) {
    assert.equal(isAuditLogVisibleForEdition("ATTENDANCE", row), true, JSON.stringify(row));
  }

  const hiddenAttendanceRows = [
    { action: "membership.created", targetType: "Membership" },
    { action: "membership.payment.recorded", targetType: "Payment" },
    { action: "payroll.payment.recorded", targetType: "PayrollPayment" },
    { action: "expense.reversed", targetType: "Expense" },
    { action: "report.cashflow.exported", targetType: "CashflowReport" },
    { action: "member.created", targetType: "Member", afterData: CUSTOMER },
    { action: "member.created", targetType: "Member", afterData: { memberType: "STAFF" } },
    { action: "member.updated", targetType: "Member", beforeData: CUSTOMER, afterData: STAFF },
    { action: "member.shifts.updated", targetType: "Member", beforeData: STAFF },
    { action: "attendance.manual.created", targetType: "AttendanceLog", metadata: { memberId: "ambiguous" } },
    {
      action: "report.attendance.exported",
      targetType: "AttendanceReport",
      metadata: { filters: { memberType: "ALL" } },
    },
    { action: "device.diagnosed", targetType: "Device" },
    { action: "device.logs.cleared", targetType: "Device" },
    { action: "device.door.unlocked", targetType: "Device" },
    { action: "devices.raw_logs.support_bundle_exported", targetType: "DeviceRawLog" },
    { action: "auth.login_success", targetType: "Payment" },
    { action: "future.unreviewed", targetType: "Member", afterData: STAFF },
  ] as const;
  for (const row of hiddenAttendanceRows) {
    assert.equal(isAuditLogVisibleForEdition("ATTENDANCE", row), false, JSON.stringify(row));
  }

  const compiled = JSON.stringify(getAuditLogVisibilityWhere("ATTENDANCE"));
  assert.match(compiled, /ATTENDANCE_STRICT_STAFF/u);
  assert.match(compiled, /memberType/u);
  assert.match(compiled, /isStaff/u);
  assert.match(compiled, /report\.attendance\.exported/u);
  assert.doesNotMatch(compiled, /membership\.payment|payroll\.payment|expense\.reversed|device\.door\.unlocked/u);
  assert.deepEqual(getAuditLogVisibilityWhere("FULL"), {});
  console.log("ok - historical FULL Audit rows are fail-closed by Attendance action, target, and Staff evidence");
}

function testRecursiveSensitiveAndFinancialRedaction() {
  const sanitized = sanitizeAuditJson({
    createdAt: "2026-08-25T00:00:00.000Z",
    rowCount: 12,
    overtimeMinutes: 45,
    nested: {
      passwordHash: "secret-password",
      apiToken: "secret-token",
      fingerprintTemplate: "biometric-template",
      permissionChanges: ["FINANCIAL_EXPORT"],
      salaryAmount: 50_000,
      paymentMethod: "CASH",
      outstandingBalance: 900,
      hourlyRate: 150,
      note: "safe operational note",
    },
  } as any) as Record<string, any>;

  assert.equal(sanitized["createdAt"], "2026-08-25T00:00:00.000Z");
  assert.equal(sanitized["rowCount"], 12);
  assert.equal(sanitized["overtimeMinutes"], 45);
  assert.equal(sanitized["nested"]["note"], "safe operational note");
  for (const key of [
    "passwordHash", "apiToken", "fingerprintTemplate", "permissionChanges", "salaryAmount",
    "paymentMethod", "outstandingBalance", "hourlyRate",
  ]) {
    assert.equal(sanitized["nested"][key], "[REDACTED]", key);
  }
  console.log("ok - recursive Audit detail redaction hides credentials, biometrics, permissions, and financial values");
}

async function testRouterBindsEditionAndPermission() {
  const calls: Array<{ operation: string; edition: string; id?: string }> = [];
  const api: AuditLogRouterApi = {
    list: async (query, edition) => {
      calls.push({ operation: "list", edition: edition ?? "FULL" });
      return { items: [], page: query.page, pageSize: query.pageSize, total: 0, summary: { total: 0, successful: 0, failed: 0 } };
    },
    options: async (edition) => {
      calls.push({ operation: "options", edition: edition ?? "FULL" });
      return { actions: [], targetTypes: [], actors: [], actorTypes: [], actorRoles: [] };
    },
    detail: async (id, edition) => {
      calls.push({ operation: "detail", edition: edition ?? "FULL", id });
      return { id } as any;
    },
  };
  const app = express();
  app.use((req, _res, next) => {
    const permission = req.get("x-audit-permission");
    req.auth = {
      user: { id: "admin-1", role: "GYM_OWNER" },
      session: { id: "session-1" },
      permissions: permission === "allow" ? [AdminPermission.AUDIT_LOG_VIEW] : [AdminPermission.SIGN_IN],
    } as any;
    next();
  });
  app.use("/api/v1/audit-logs", createAuditLogRouter("ATTENDANCE", api));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1/audit-logs`;
    assert.equal((await fetch(baseUrl)).status, 403);
    assert.equal(calls.length, 0);
    const headers = { "x-audit-permission": "allow" };
    assert.equal((await fetch(baseUrl, { headers })).status, 200);
    assert.equal((await fetch(`${baseUrl}/options`, { headers })).status, 200);
    const auditId = "cmphase52audit000000000001";
    assert.equal((await fetch(`${baseUrl}/${auditId}`, { headers })).status, 200);
    assert.deepEqual(calls, [
      { operation: "list", edition: "ATTENDANCE" },
      { operation: "options", edition: "ATTENDANCE" },
      { operation: "detail", edition: "ATTENDANCE", id: auditId },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  console.log("ok - Audit router requires permission and binds every read surface to the active Edition");
}

async function main() {
  testHistoricalVisibilityPolicy();
  testRecursiveSensitiveAndFinancialRedaction();
  await testRouterBindsEditionAndPermission();
  console.log("Audit Log Edition boundary tests passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
