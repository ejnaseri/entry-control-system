import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission, AdminRole } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import {
  createAttendanceDailyRouter,
  createEntryLogsRouter,
  type AttendanceRouterApi,
} from "./attendance.router";
import { ATTENDANCE_DATA_SCOPES, type AttendanceDataScope } from "./attendance-edition-scope";
import { createAuditedAttendanceEntryLogsExporter } from "./attendance-export.service";
import { generateAuditedReportExport } from "../reports/shared/report-export.audit";
import { createAttendanceEntryLogsExporter } from "./attendance.service";
import { getReportExportLabels, REPORT_EXPORT_LANGUAGES } from "../reports/shared/report-export.i18n";
import { ATTENDANCE_EXPORT_BRAND } from "../reports-attendance/attendance-export.brand";

type CapturedCall = {
  operation: string;
  scope: AttendanceDataScope;
  input: unknown;
  context?: unknown;
};

const calls: CapturedCall[] = [];

const fakeApi = {
  async listAttendance(query: unknown, scope: AttendanceDataScope) {
    calls.push({ operation: "list", scope, input: query });
    return { items: [], page: 1, pageSize: 25, total: 0, summary: {} };
  },
  async listAttendanceDeviceOptions() {
    calls.push({ operation: "device-options", scope: ATTENDANCE_DATA_SCOPES.STRICT_STAFF, input: null });
    return [{ id: "cmattendancedevice000000001", name: "Front gate" }];
  },
  async exportAttendanceEntryLogs(query: unknown, format: "CSV" | "XLSX", scope: AttendanceDataScope, context: unknown) {
    calls.push({ operation: `entry-export-${format}`, scope, input: query, context });
    return { body: Buffer.from(format), filename: `entry-logs.${format.toLowerCase()}`, contentType: "application/octet-stream", rowCount: 2 };
  },
  async createManualAttendance(input: unknown, _context: unknown, scope: AttendanceDataScope) {
    calls.push({ operation: "manual", scope, input });
    return { id: "manual-test" };
  },
  async listDailyAttendance(query: unknown, scope: AttendanceDataScope) {
    calls.push({ operation: "daily", scope, input: query });
    return { date: "2026-08-11", summary: {}, warnings: {}, rows: [] };
  },
  async upsertAttendanceJustification(input: unknown, _context: unknown, scope: AttendanceDataScope) {
    calls.push({ operation: "justify", scope, input });
    return { id: "justification-test" };
  },
  async removeAttendanceJustification(input: unknown, _context: unknown, scope: AttendanceDataScope) {
    calls.push({ operation: "remove-justification", scope, input });
    return true;
  },
} as unknown as AttendanceRouterApi;

async function run() {
  await testEntryLogsAuditContract();
  await testCompleteLocalizedEntryLogsFiles();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const access = req.get("x-test-access");
    if (access) {
      const permissions: AdminPermission[] = [AdminPermission.SIGN_IN];
      if (access !== "signin") permissions.push(AdminPermission.ATTENDANCE_VIEW);
      if (access === "manual" || access === "all") permissions.push(AdminPermission.ATTENDANCE_MANUAL);
      if (access === "justify" || access === "all") permissions.push(AdminPermission.ATTENDANCE_JUSTIFY);
      if (access === "export" || access === "all") permissions.push(AdminPermission.ATTENDANCE_EXPORT);
      (req as any).auth = {
        user: { id: "attendance-api-admin", role: AdminRole.GYM_OWNER },
        session: { id: "attendance-api-session" },
        permissions,
      } as any;
    }
    next();
  });

  app.use(
    "/strict/entry",
    requirePermission(AdminPermission.ATTENDANCE_VIEW),
    createEntryLogsRouter("ATTENDANCE", fakeApi)
  );
  app.use(
    "/strict/attendance",
    requirePermission(AdminPermission.ATTENDANCE_VIEW),
    createAttendanceDailyRouter("ATTENDANCE", fakeApi)
  );
  app.use(
    "/full/entry",
    requirePermission(AdminPermission.ATTENDANCE_VIEW),
    createEntryLogsRouter("FULL", fakeApi)
  );
  app.use(
    "/full/attendance",
    requirePermission(AdminPermission.ATTENDANCE_VIEW),
    createAttendanceDailyRouter("FULL", fakeApi)
  );
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    await assertStatus(`${baseUrl}/strict/entry`, 401);
    await assertStatus(`${baseUrl}/strict/entry`, 403, { "x-test-access": "signin" });
    assert.equal(calls.length, 0, "permission failures must not invoke the Attendance API");

    await assertStatus(
      `${baseUrl}/strict/entry?memberType=CUSTOMER&search=customer&result=DENIED`,
      200,
      { "x-test-access": "view" }
    );
    const strictList = assertCall("list", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal((strictList.input as { result: string }).result, "DENIED");
    await assertStatus(`${baseUrl}/strict/entry/options/devices`, 200, { "x-test-access": "view" });
    assertCall("device-options", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    for (const format of ["csv", "xlsx"] as const) {
      const path = `${baseUrl}/strict/entry/export.${format}?eventType=OUT&result=DENIED&lang=en`;
      await assertStatus(path, 403, { "x-test-access": "view" });
      const response = await assertStatus(path, 200, { "x-test-access": "export" });
      assert.match(response.headers.get("content-disposition") ?? "", /attachment/u);
    }
    const csvExport = assertCall("entry-export-CSV", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal((csvExport.input as { eventType: string }).eventType, "OUT");
    assert.deepEqual((csvExport.context as any).actor, {
      id: "attendance-api-admin", role: AdminRole.GYM_OWNER, sessionId: "attendance-api-session",
    });
    const callsBeforeWidenedExport = calls.length;
    await assertStatus(
      `${baseUrl}/strict/entry/export.csv?lang=en&memberType=CUSTOMER`,
      400,
      { "x-test-access": "export" }
    );
    assert.equal(calls.length, callsBeforeWidenedExport);

    const manualPayload = {
      memberId: "cmattendanceemployee000001",
      eventType: "IN",
      occurredAt: "2026-08-11T08:00:00.000Z",
      notes: "Approved manual entry",
    };
    await assertJsonStatus(`${baseUrl}/strict/attendance/manual`, manualPayload, 403, "view");
    await assertJsonStatus(`${baseUrl}/strict/attendance/manual`, manualPayload, 201, "manual");
    assertCall("manual", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);

    const callsBeforeRejectedExtra = calls.length;
    await assertJsonStatus(
      `${baseUrl}/strict/attendance/manual`,
      { ...manualPayload, salaryAmount: 5000 },
      400,
      "manual"
    );
    assert.equal(calls.length, callsBeforeRejectedExtra, "strict schema must reject extra financial keys before service");

    const justification = {
      memberId: "cmattendanceemployee000001",
      date: "2026-08-11",
      reason: "Approved leave",
    };
    await assertJsonStatus(`${baseUrl}/strict/attendance/justifications`, justification, 403, "view");
    await assertJsonStatus(`${baseUrl}/strict/attendance/justifications`, justification, 201, "justify");
    assertCall("justify", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    await assertStatus(
      `${baseUrl}/strict/attendance/justifications?memberId=${justification.memberId}&date=${justification.date}`,
      204,
      { "x-test-access": "justify" },
      "DELETE"
    );
    assertCall("remove-justification", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);

    await assertJsonStatus(
      `${baseUrl}/full/attendance/manual`,
      { ...manualPayload, salaryAmount: 5000 },
      201,
      "manual"
    );
    const fullManual = assertCall("manual", ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    assert.equal(Object.hasOwn(fullManual.input as object, "salaryAmount"), false, "FULL keeps legacy strip behavior");

    await assertStatus(
      `${baseUrl}/full/entry?memberType=CUSTOMER`,
      200,
      { "x-test-access": "view" }
    );
    assertCall("list", ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    await assertStatus(`${baseUrl}/full/entry/export.csv?lang=en`, 404, { "x-test-access": "export" });

    console.log("ok - Attendance router binds Edition scope, permissions, and strict mutation schemas");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testCompleteLocalizedEntryLogsFiles() {
  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const pageCalls: number[] = [];
    const exporter = createAttendanceEntryLogsExporter((async (query: any) => {
      pageCalls.push(query.page);
      const index = query.page - 1;
      const item = {
        id: `log-${query.page}`, createdAt: new Date("2026-08-24T08:00:00.000Z"), recordedAt: new Date(`2026-08-24T0${8 + index}:00:00.000Z`),
        memberId: `employee-${query.page}`, memberCode: String(query.page), memberFullName: query.page === 1 ? "Eraj Naseri" : "Sara Ahmadi",
        memberType: "STAFF", memberStatus: "ACTIVE", memberPhone: null, memberRole: "EMPLOYEE", memberTitle: null,
        deviceId: "device-1", deviceName: "K40", eventType: query.page === 1 ? "IN" : "OUT",
        source: query.page === 1 ? "DEVICE" : "MANUAL", isAuthorized: query.page === 1, reason: query.page === 1 ? null : "Rejected",
      };
      return { items: [item], page: query.page, pageSize: 200, total: 2, summary: { totalIn: 1, totalOut: 1, uniqueVisitors: 2, deniedAttempts: 1 } };
    }) as any);
    const labels = getReportExportLabels(lang);
    const query = { eventType: "ALL", source: "ALL", result: "ALL", lang } as any;
    const csv = await exporter(query, "CSV", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    const text = csv.buffer.toString("utf8");
    assert.deepEqual(pageCalls, [1, 2]);
    assert.equal(csv.rowCount, 2);
    assert.match(csv.filename, /^entry-control-attendance-entry-logs-/u);
    assert.equal(text.includes(labels.t("entryLogs")), false, "CSV must begin with its tabular header, not metadata rows");
    assert.equal(text.includes(labels.t("employee")), true);
    assert.equal(text.includes(labels.attendanceEvent("IN")), true);
    assert.equal(text.includes(labels.attendanceResult("denied")), true);

    pageCalls.length = 0;
    const xlsx = await exporter(query, "XLSX", ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    const xlsxText = xlsx.buffer.toString("utf8");
    assert.deepEqual(pageCalls, [1, 2]);
    assert.equal(xlsxText.includes(ATTENDANCE_EXPORT_BRAND), true);
    assert.equal(xlsxText.includes(labels.t("entryLogs")), true);
  }
}

async function testEntryLogsAuditContract() {
  let auditInput: any;
  const exporter = createAuditedAttendanceEntryLogsExporter(
    async () => ({
      buffer: Buffer.from("localized-entry-logs"), filename: "entry-control-attendance-entry-logs.csv",
      contentType: "text/csv; charset=utf-8", rowCount: 7,
    }),
    (async (input: any) => {
      auditInput = input;
      return input.generate();
    }) as typeof generateAuditedReportExport
  );
  const context = {
    actor: { id: "owner-1", role: AdminRole.GYM_OWNER, sessionId: "session-1" },
    meta: { ipAddress: "127.0.0.1", userAgent: "phase-4-6-test" },
  };
  const file = await exporter({
    from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z", search: "private name",
    eventType: "OUT", source: "DEVICE", result: "DENIED", lang: "fa",
  }, "CSV", ATTENDANCE_DATA_SCOPES.STRICT_STAFF, context);
  assert.equal(file.rowCount, 7);
  assert.equal(auditInput.action, "report.entry_logs.exported");
  assert.equal(auditInput.targetId, "entry-logs-report");
  assert.deepEqual(auditInput.context, context);
  assert.equal(auditInput.filters.memberType, "staff");
  assert.equal(auditInput.filters.language, "fa");
  assert.equal(auditInput.filters.searchApplied, true);
  assert.equal(JSON.stringify(auditInput.filters).includes("private name"), false);
}

function assertCall(operation: string, scope: AttendanceDataScope) {
  const call = [...calls].reverse().find((item) => item.operation === operation && item.scope === scope);
  assert.ok(call, `Missing ${operation} call for ${scope}`);
  return call;
}

async function assertJsonStatus(
  url: string,
  body: unknown,
  expectedStatus: number,
  access: string
) {
  return assertStatus(
    url,
    expectedStatus,
    { "content-type": "application/json", "x-test-access": access },
    "POST",
    JSON.stringify(body)
  );
}

async function assertStatus(
  url: string,
  expectedStatus: number,
  headers: Record<string, string> = {},
  method = "GET",
  body?: string
) {
  const response = await fetch(url, { method, headers, ...(body === undefined ? {} : { body }) });
  assert.equal(response.status, expectedStatus, `${method} ${url}`);
  return response;
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
