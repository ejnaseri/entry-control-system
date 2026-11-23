import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission } from "@prisma/client";
import { errorHandler } from "../../middlewares/error-handler";
import type { AttendanceReportExportRouterApi } from "./attendance-report-export.router";
import { createAttendanceReportRouter, type AttendanceReportRouterApi } from "./attendance-report.router";
import {
  attendanceEditionReportCsvExportQuerySchema,
  attendanceEditionReportDailyQuerySchema,
  attendanceEditionReportExportQuerySchema,
  attendanceEditionReportSummaryQuerySchema,
  attendanceMonthlyTimecardExportQuerySchema,
  attendanceMonthlyTimecardQuerySchema,
} from "./attendance-report.schemas";
import { createAttendanceReportOptionsLoader } from "./attendance-report.service";
import {
  aggregateTimecards,
  createAttendanceMonthlyTimecardExporter,
  createAuditedAttendanceMonthlyTimecardExporter,
} from "./attendance-report-timecard.service";
import { ATTENDANCE_EXPORT_BRAND } from "./attendance-export.brand";
import { getReportExportLabels, REPORT_EXPORT_LANGUAGES } from "../reports/shared/report-export.i18n";
import { generateAuditedReportExport } from "../reports/shared/report-export.audit";
import { extractPdfText, pdfTextIncludesWords } from "../reports/shared/pdf-text.test-utils";

const FROM = "2026-08-01";
const TO = "2026-08-24";

function testStaffOnlySchemas() {
  assert.deepEqual(attendanceEditionReportSummaryQuerySchema.parse({ from: FROM, to: TO }), {
    from: FROM,
    to: TO,
    shiftMode: "primary",
    eventType: "all",
    onlyAnomalies: false,
    memberType: "staff",
  });
  assert.equal(attendanceEditionReportDailyQuerySchema.parse({ from: FROM, to: TO }).memberType, "staff");
  assert.throws(
    () => attendanceEditionReportSummaryQuerySchema.parse({ from: FROM, to: TO, memberType: "customer" }),
    /Unrecognized key/u
  );
  assert.throws(
    () => attendanceEditionReportSummaryQuerySchema.parse({ from: FROM, to: TO, paymentStatus: "PAID" }),
    /Unrecognized key/u
  );
  assert.equal(attendanceEditionReportExportQuerySchema.parse({ from: FROM, to: TO, lang: "fa" }).memberType, "staff");
  assert.equal(attendanceEditionReportCsvExportQuerySchema.parse({ from: FROM, to: TO, lang: "en", variant: "daily" }).memberType, "staff");
  assert.throws(
    () => attendanceEditionReportExportQuerySchema.parse({ from: FROM, to: TO, lang: "en", memberType: "customer" }),
    /Unrecognized key/u
  );
  assert.deepEqual(attendanceMonthlyTimecardQuerySchema.parse({ month: "2026-08" }), {
    month: "2026-08", page: 1, pageSize: 20,
  });
  assert.equal(attendanceMonthlyTimecardExportQuerySchema.parse({ month: "2026-08", lang: "ps" }).lang, "ps");
  assert.throws(() => attendanceMonthlyTimecardQuerySchema.parse({ month: "2026-08", memberType: "customer" }), /Unrecognized key/u);
}

function testMonthlyTimecardReconciliation() {
  const items = buildMonthlyTimecardFixture();
  assert.equal(items.length, 1);
  assert.deepEqual(items[0]?.totals, {
    scheduledMinutes: 960, actualMinutes: 465, pairedSessionCount: 1, presentDays: 1, absentDays: 0,
    justifiedDays: 1, lateMinutes: 10, earlyLeaveMinutes: 15, overtimeMinutes: 30,
    missingPunchDays: 1, invalidPunchDays: 1, unscheduledDays: 0,
  });
  assert.equal(items[0]?.days.reduce((sum, day) => sum + day.actualMinutes, 0), items[0]?.totals.actualMinutes);
}

function buildMonthlyTimecardFixture() {
  const base = {
    memberId: "employee-1", memberCode: "1", memberFullName: "Eraj Naseri", memberPhone: null,
    staffGroupId: "group-1", staffGroupName: "Operations", shiftId: "shift-1", shiftName: "Morning",
    shiftStart: "08:00", shiftEnd: "16:00", graceMinutes: 5, checkInAt: null, checkOutAt: null,
    earlyMinutes: 0, deviceName: null, justificationReason: null, hasShift: true,
  };
  return aggregateTimecards([
    { date: "2026-08-01", summary: {}, warnings: {}, rows: [{ ...base, status: "LATE", lateMinutes: 10, earlyLeaveMinutes: 15, overtimeMinutes: 30, durationMinutes: 465, confirmedDurationMinutes: 465, pairedSessionCount: 1, hasOpenSession: false, openSessionSince: null, liveDurationMinutes: null, lastEventType: "OUT", warnings: [], isJustified: false }] },
    { date: "2026-08-02", summary: {}, warnings: {}, rows: [{ ...base, status: "ABSENT", lateMinutes: null, earlyLeaveMinutes: null, overtimeMinutes: null, durationMinutes: 0, confirmedDurationMinutes: 0, pairedSessionCount: 0, hasOpenSession: false, openSessionSince: null, liveDurationMinutes: null, lastEventType: null, warnings: ["NO_CHECKOUT", "MULTIPLE_EVENTS"], isJustified: true }] },
  ] as any);
}

async function testMonthlyTimecardLocalizationBrandingAndAudit() {
  const items = buildMonthlyTimecardFixture();
  const generate = createAttendanceMonthlyTimecardExporter({ loadAll: async () => items });
  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const labels = getReportExportLabels(lang);
    const query = { month: "2026-08", lang };
    const csv = await generate(query, "CSV");
    const csvText = csv.buffer.toString("utf8");
    assert.match(csv.filename, /^entry-control-attendance-monthly-timecard-2026-08\.csv$/u);
    assert.equal(csvText.startsWith("\uFEFF"), true);
    assert.equal(csvText.includes(labels.t("scheduledMinutes")), true);
    assert.equal(csvText.includes(labels.attendanceStatus("LATE")), true);

    const xlsx = await generate(query, "XLSX");
    const xlsxText = xlsx.buffer.toString("utf8");
    assert.equal(xlsxText.includes(ATTENDANCE_EXPORT_BRAND), true);
    assert.equal(xlsxText.includes(labels.t("dailyDetails")), true);

    const pdf = await generate(query, "PDF");
    const pdfText = await extractPdfText(pdf.buffer);
    assert.equal(pdfText.includes(ATTENDANCE_EXPORT_BRAND), true);
    assert.equal(pdfTextIncludesWords(pdfText, labels.t("monthlyTimecard")), true);
  }

  let auditInput: any;
  const audited = createAuditedAttendanceMonthlyTimecardExporter(
    generate,
    (async (input: any) => {
      auditInput = input;
      return input.generate();
    }) as typeof generateAuditedReportExport
  );
  const context = {
    actor: { id: "owner-1", role: "GYM_OWNER" as const, sessionId: "session-1" },
    meta: { ipAddress: "127.0.0.1", userAgent: "phase-4-6-test" },
  };
  const result = await audited({ month: "2026-08", memberId: "employee-1", lang: "ps" }, "XLSX", context);
  assert.equal(result.rowCount, 2);
  assert.equal(auditInput.action, "report.monthly_timecard.exported");
  assert.equal(auditInput.targetType, "MonthlyTimecard");
  assert.deepEqual(auditInput.context, context);
  assert.equal(auditInput.filters.memberType, "staff");
  assert.equal(auditInput.filters.language, "ps");
  assert.equal(JSON.stringify(auditInput.filters).includes("salary"), false);
}

async function testSafeOptionsProjection() {
  const calls: Array<{ operation: string; args: any }> = [];
  const database = {
    member: { findMany: async (args: any) => {
      calls.push({ operation: "member.findMany", args });
      return [
        { id: "employee-1", code: "1", firstName: "Eraj", lastName: "Naseri", staffGroup: { id: "group-1", name: "Operations" } },
        { id: "employee-2", code: "2", firstName: "Sara", lastName: null, staffGroup: { id: "group-1", name: "Operations" } },
      ];
    } },
    memberShift: { findMany: async (args: any) => {
      calls.push({ operation: "memberShift.findMany", args });
      return [
        { shiftId: "shift-1", shiftName: "Morning", shiftStart: "08:00", shiftEnd: "16:00" },
        { shiftId: "shift-1", shiftName: "Morning", shiftStart: "08:00", shiftEnd: "16:00" },
      ];
    } },
    device: { findMany: async (args: any) => {
      calls.push({ operation: "device.findMany", args });
      return [{ id: "device-1", name: "K40" }];
    } },
  };

  const options = await createAttendanceReportOptionsLoader(database as any)();
  assert.deepEqual(options, {
    employees: [
      { id: "employee-1", code: "1", name: "Eraj Naseri" },
      { id: "employee-2", code: "2", name: "Sara" },
    ],
    groups: [{ id: "group-1", name: "Operations" }],
    shifts: [{ id: "shift-1", name: "Morning", start: "08:00", end: "16:00" }],
    devices: [{ id: "device-1", name: "K40" }],
  });
  const serialized = JSON.stringify(calls);
  assert.match(serialized, /"memberType":"STAFF"/u);
  assert.match(serialized, /"isStaff":true/u);
  assert.doesNotMatch(serialized, /customer|membership|payment|revenue|debt|salary|payroll|expense/iu);
  assert.deepEqual(calls.find(({ operation }) => operation === "device.findMany")?.args.select, { id: true, name: true });
}

async function testReadOnlyRouter() {
  const calls: Array<{ operation: string; query?: any }> = [];
  const pageInfo = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 };
  const api: AttendanceReportRouterApi = {
    getOptions: async () => {
      calls.push({ operation: "options" });
      return { employees: [], groups: [], shifts: [], devices: [] };
    },
    getSummary: async (query) => {
      calls.push({ operation: "summary", query });
      return { range: { from: FROM, to: TO }, kpis: { presentDays: 0, absentDays: 0, lateCount: 0, lateMinutes: 0, earlyLeaveCount: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0, justifiedCount: 0, unscheduledPresentCount: 0, deniedCount: 0, noCheckoutCount: 0 } };
    },
    getDaily: async (query) => { calls.push({ operation: "daily", query }); return { items: [], pageInfo }; },
    getMembers: async (query) => { calls.push({ operation: "members", query }); return { items: [], pageInfo }; },
    getEvidence: async (query) => { calls.push({ operation: "evidence", query }); return { items: [], pageInfo }; },
    getTimecard: async (query) => { calls.push({ operation: "timecard", query }); return { month: query.month, items: [], pageInfo }; },
  };
  const exportApi: AttendanceReportExportRouterApi = {
    getExport: async (query, format, context) => {
      calls.push({ operation: `export-${format}`, query: { ...query, context } });
      return {
        buffer: Buffer.from(format, "utf8"),
        filename: `attendance.${format.toLowerCase()}`,
        contentType: "application/octet-stream",
        rowCount: 1,
      };
    },
    getTimecardExport: async (query, format, context) => {
      calls.push({ operation: `timecard-export-${format}`, query: { ...query, context } });
      return { body: Buffer.from(format), filename: `timecard.${format.toLowerCase()}`, contentType: "application/octet-stream", rowCount: 1 };
    },
  };
  const app = express();
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile");
    if (profile) {
      req.auth = {
        user: { id: "staff-1", username: "staff", role: "STAFF" },
        permissions: profile === "viewer"
          ? [AdminPermission.ATTENDANCE_VIEW]
          : profile === "exporter"
            ? [AdminPermission.ATTENDANCE_VIEW, AdminPermission.ATTENDANCE_EXPORT]
            : profile === "financial"
              ? [AdminPermission.ATTENDANCE_VIEW, AdminPermission.FINANCIAL_EXPORT]
              : [AdminPermission.SIGN_IN],
        session: { id: "session-1" },
      } as any;
    }
    next();
  });
  app.use("/api/v1/reports/attendance", createAttendanceReportRouter(api, exportApi));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/v1/reports/attendance`;
    assert.equal((await fetch(`${base}/summary?from=${FROM}&to=${TO}`)).status, 401);
    assert.equal((await fetch(`${base}/summary?from=${FROM}&to=${TO}`, { headers: { "x-test-profile": "limited" } })).status, 403);
    for (const path of [
      "/options",
      `/summary?from=${FROM}&to=${TO}`,
      `/daily?from=${FROM}&to=${TO}`,
      `/members?from=${FROM}&to=${TO}`,
      `/evidence?from=${FROM}&to=${TO}`,
      "/timecard?month=2026-08",
    ]) {
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "viewer" } })).status, 200, path);
    }
    const widened = await fetch(`${base}/summary?from=${FROM}&to=${TO}&memberType=customer`, { headers: { "x-test-profile": "viewer" } });
    assert.equal(widened.status, 400);
    const exportPaths = [
      `/export.csv?from=${FROM}&to=${TO}&variant=daily&lang=en`,
      `/export.xlsx?from=${FROM}&to=${TO}&lang=fa`,
      `/export.pdf?from=${FROM}&to=${TO}&lang=ps`,
    ];
    for (const path of exportPaths) {
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "viewer" } })).status, 403, path);
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "financial" } })).status, 403, path);
      const response = await fetch(`${base}${path}`, { headers: { "x-test-profile": "exporter" } });
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get("content-disposition") ?? "", /attachment/u);
    }
    for (const path of [
      "/timecard/export.csv?month=2026-08&lang=en",
      "/timecard/export.xlsx?month=2026-08&lang=fa",
      "/timecard/export.pdf?month=2026-08&lang=ps",
    ]) {
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "viewer" } })).status, 403, path);
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "financial" } })).status, 403, path);
      assert.equal((await fetch(`${base}${path}`, { headers: { "x-test-profile": "exporter" } })).status, 200, path);
    }
    const widenedExport = await fetch(
      `${base}/export.xlsx?from=${FROM}&to=${TO}&lang=en&memberType=customer`,
      { headers: { "x-test-profile": "exporter" } }
    );
    assert.equal(widenedExport.status, 400);
    assert.equal((await fetch(`${base}/client-export-audit`, { headers: { "x-test-profile": "exporter" } })).status, 404);
    assert.equal(calls.length, 12);
    assert.equal(calls.filter(({ operation }) => ["summary", "daily", "members", "evidence"].includes(operation) || operation.startsWith("export-")).every(({ query }) => query.memberType === "staff"), true);
    assert.equal(calls.filter(({ operation }) => operation.includes("timecard")).every(({ query }) => !Object.hasOwn(query, "memberType")), true);
    assert.deepEqual(calls.filter(({ operation }) => operation.startsWith("export-")).map(({ operation }) => operation), [
      "export-CSV",
      "export-XLSX",
      "export-PDF",
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function run() {
  testStaffOnlySchemas();
  testMonthlyTimecardReconciliation();
  await testMonthlyTimecardLocalizationBrandingAndAudit();
  await testSafeOptionsProjection();
  await testReadOnlyRouter();
  console.log("ok - Attendance Report schemas, safe options, read permission, and dedicated export boundary");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
