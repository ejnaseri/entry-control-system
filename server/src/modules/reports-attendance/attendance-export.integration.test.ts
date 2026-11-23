import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AttendanceSource,
  AttendanceType,
  MemberStatus,
  MemberType,
  SalaryType,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { errorHandler } from "../../middlewares/error-handler";
import { createEntryLogsRouter } from "../attendance/attendance.router";
import {
  getReportExportLabels,
  REPORT_EXPORT_LANGUAGES,
  type ReportExportLanguage,
} from "../reports/shared/report-export.i18n";
import { extractPdfText, pdfTextIncludesWords } from "../reports/shared/pdf-text.test-utils";
import { ATTENDANCE_EXPORT_BRAND, ATTENDANCE_EXPORT_FILENAME_PREFIX } from "./attendance-export.brand";
import { createAttendanceReportRouter } from "./attendance-report.router";

type Fixture = Readonly<{
  suffix: string;
  date: Date;
  dateKey: string;
  monthKey: string;
  adminUserId: string;
  adminSessionId: string;
  staffGroupId: string;
  shiftId: string;
  reportMemberId: string;
  reportMemberCode: string;
  reportMemberName: string;
  bulkMemberId: string;
  bulkMemberCode: string;
  bulkMemberName: string;
  customerId: string;
  customerCode: string;
}>;

type DownloadedFile = Readonly<{
  buffer: Buffer;
  contentType: string;
  disposition: string;
}>;

const USER_AGENT = "attendance-phase-4.7-export-e2e";
const ENTRY_LOG_COUNT = 205;

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Attendance export integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["ATTENDANCE_EXPORT_DB_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Attendance export integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const shortSuffix = suffix.slice(0, 8);
  const date = new Date(2026, 3, 14, 0, 0, 0, 0);
  const dateKey = formatDateKey(date);
  const monthKey = dateKey.slice(0, 7);
  const weekday = (date.getDay() + 1) % 7;
  const reportMemberCode = `P47-S-${shortSuffix}`;
  const bulkMemberCode = `P47-B-${shortSuffix}`;
  const customerCode = `P47-C-${shortSuffix}`;
  const reportMemberName = "Phase FortySeven Staff";
  const bulkMemberName = "Phase FortySeven Bulk";

  const records = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        username: `phase-4.7-${suffix}`,
        fullName: "Phase 4.7 Export Actor",
        passwordHash: "not-used-by-attendance-export-integration",
        role: AdminRole.GYM_OWNER,
      },
    });
    const session = await tx.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: `phase-4.7-token-${suffix}`,
        ipAddress: "127.0.0.1",
        userAgent: USER_AGENT,
        expiresAt: addDays(new Date(), 1),
      },
    });
    const group = await tx.staffGroup.create({
      data: { name: `Phase 4.7 Operations ${shortSuffix}` },
    });
    const reportMember = await tx.member.create({
      data: {
        code: reportMemberCode,
        firstName: "Phase FortySeven",
        lastName: "Staff",
        memberType: MemberType.STAFF,
        isStaff: true,
        status: MemberStatus.ACTIVE,
        staffGroupId: group.id,
        createdAt: addDays(date, -60),
      },
    });
    const bulkMember = await tx.member.create({
      data: {
        code: bulkMemberCode,
        firstName: "Phase FortySeven",
        lastName: "Bulk",
        memberType: MemberType.STAFF,
        isStaff: true,
        status: MemberStatus.ACTIVE,
        createdAt: addDays(date, -60),
      },
    });
    const customer = await tx.member.create({
      data: {
        code: customerCode,
        firstName: "Phase FortySeven",
        lastName: "Customer",
        memberType: MemberType.CUSTOMER,
        isStaff: false,
        status: MemberStatus.ACTIVE,
        createdAt: addDays(date, -60),
      },
    });
    const shift = await tx.memberShift.create({
      data: {
        memberId: reportMember.id,
        shiftName: "Phase 4.7 Morning",
        shiftStart: "09:00",
        shiftEnd: "17:00",
        weekdays: [weekday],
        graceMinutes: 0,
        earlyAccessMinutes: 15,
        salaryType: SalaryType.MONTHLY,
        salaryAmount: 100,
        isActive: true,
      },
    });

    await tx.attendanceLog.createMany({
      data: [
        buildLog(reportMember.id, atTime(date, 9, 0), AttendanceType.IN, true),
        buildLog(reportMember.id, atTime(date, 17, 0), AttendanceType.OUT, true),
        buildLog(reportMember.id, atTime(date, 12, 0), AttendanceType.IN, false),
        buildLog(customer.id, atTime(date, 10, 0), AttendanceType.IN, true),
        ...Array.from({ length: ENTRY_LOG_COUNT }, (_, index) => ({
          ...buildLog(
            bulkMember.id,
            new Date(atTime(date, 5, 0).getTime() + index * 60_000),
            index % 2 === 0 ? AttendanceType.IN : AttendanceType.OUT,
            true
          ),
          dedupeKey: `phase-4.7-bulk-${suffix}-${index}`,
        })),
      ],
    });

    return { admin, session, group, reportMember, bulkMember, customer, shift };
  });

  return Object.freeze({
    suffix,
    date,
    dateKey,
    monthKey,
    adminUserId: records.admin.id,
    adminSessionId: records.session.id,
    staffGroupId: records.group.id,
    shiftId: records.shift.id,
    reportMemberId: records.reportMember.id,
    reportMemberCode,
    reportMemberName,
    bulkMemberId: records.bulkMember.id,
    bulkMemberCode,
    bulkMemberName,
    customerId: records.customer.id,
    customerCode,
  });
}

async function runHttpExportAcceptance(fixture: Fixture) {
  const app = express();
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile") ?? "exporter";
    if (profile !== "none") {
      req.auth = {
        user: {
          id: fixture.adminUserId,
          username: `phase-4.7-${fixture.suffix}`,
          role: AdminRole.GYM_OWNER,
        },
        permissions: profile === "viewer"
          ? [AdminPermission.ATTENDANCE_VIEW]
          : [AdminPermission.ATTENDANCE_VIEW, AdminPermission.ATTENDANCE_EXPORT],
        session: { id: fixture.adminSessionId },
      } as any;
    }
    next();
  });
  app.use("/api/v1/attendance", createEntryLogsRouter("ATTENDANCE"));
  app.use("/api/v1/reports/attendance", createAttendanceReportRouter());
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const origin = `http://127.0.0.1:${port}`;
    await testHttpPermissionAndScopeGuards(origin, fixture);
    for (const lang of REPORT_EXPORT_LANGUAGES) {
      await testAttendanceReportFiles(origin, fixture, lang);
      await testEntryLogFiles(origin, fixture, lang);
      await testMonthlyTimecardFiles(origin, fixture, lang);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function testHttpPermissionAndScopeGuards(origin: string, fixture: Fixture) {
  const reportUrl = `${origin}/api/v1/reports/attendance/export.xlsx?${new URLSearchParams({
    from: fixture.dateKey,
    to: fixture.dateKey,
    memberId: fixture.reportMemberId,
    lang: "en",
  })}`;
  assert.equal((await fetch(reportUrl, { headers: headers("none") })).status, 401);
  assert.equal((await fetch(reportUrl, { headers: headers("viewer") })).status, 403);
  assert.equal((await fetch(`${reportUrl}&memberType=customer`, { headers: headers() })).status, 400);

  const entryUrl = `${origin}/api/v1/attendance/export.csv?${new URLSearchParams({
    from: atTime(fixture.date, 0, 0).toISOString(),
    to: atTime(fixture.date, 23, 59).toISOString(),
    memberId: fixture.bulkMemberId,
    lang: "en",
  })}`;
  assert.equal((await fetch(entryUrl, { headers: headers("viewer") })).status, 403);
  assert.equal((await fetch(`${entryUrl}&memberType=CUSTOMER`, { headers: headers() })).status, 400);
  console.log("ok - Phase 4.7 HTTP permission and Staff-only widening guards");
}

async function testAttendanceReportFiles(origin: string, fixture: Fixture, lang: ReportExportLanguage) {
  const labels = getReportExportLabels(lang);
  const common = {
    from: fixture.dateKey,
    to: fixture.dateKey,
    memberId: fixture.reportMemberId,
    lang,
  };

  for (const variant of ["daily", "members", "evidence"] as const) {
    const file = await download(origin, "/api/v1/reports/attendance/export.csv", { ...common, variant });
    assertBrandedFilename(file, `attendance-${variant}`, "csv");
    const rows = parseCsv(file.buffer.toString("utf8"));
    assert.equal(rows.length, variant === "evidence" ? 4 : 2, `${lang} ${variant} CSV row count`);
    assert.equal(rows.flat().includes(fixture.customerCode), false);
    assert.equal(rows.flat().includes(fixture.bulkMemberCode), false);
    if (variant === "daily") {
      assert.equal(rows[0]?.[0], labels.t("date"));
      assert.equal(rows[1]?.[0], fixture.dateKey);
    } else if (variant === "members") {
      assert.equal(rows[0]?.[0], labels.t("memberCode"));
      assert.equal(rows[1]?.[0], fixture.reportMemberCode);
      assert.equal(rows[1]?.[1], fixture.reportMemberName);
      assert.equal(rows[1]?.[2], labels.memberType("STAFF"));
    } else {
      assert.equal(rows[0]?.[0], labels.t("timestamp"));
      assert.equal(rows.slice(1).every((row) => row[1] === fixture.reportMemberName), true);
      assert.equal(rows.slice(1).some((row) => row[6] === labels.attendanceResult("denied")), true);
    }
  }

  const xlsx = await download(origin, "/api/v1/reports/attendance/export.xlsx", {
    ...common,
    includeEvidence: "true",
  });
  assertBrandedFilename(xlsx, "attendance-report", "xlsx");
  assert.equal(xlsx.buffer.subarray(0, 2).toString("utf8"), "PK");
  const workbook = readZipEntry(xlsx.buffer, "xl/workbook.xml");
  [labels.t("summaryKpi"), labels.t("daily"), labels.t("members"), labels.t("evidence")].forEach((name) => {
    assert.match(workbook, new RegExp(`name="${escapeRegExp(name)}"`, "u"));
  });
  const summary = parseXlsxSheet(xlsx.buffer, 1);
  const daily = parseXlsxSheet(xlsx.buffer, 2);
  const members = parseXlsxSheet(xlsx.buffer, 3);
  const evidence = parseXlsxSheet(xlsx.buffer, 4);
  assert.deepEqual(summary[0], [ATTENDANCE_EXPORT_BRAND]);
  assert.equal(daily.length - 1, 1);
  assert.equal(members.length - 1, 1);
  assert.equal(evidence.length - 1, 3);
  assert.equal(members[1]?.[0], fixture.reportMemberCode);
  assert.equal(evidence.slice(1).every((row) => row[1] === fixture.reportMemberName), true);

  const pdf = await download(origin, "/api/v1/reports/attendance/export.pdf", common);
  assertBrandedFilename(pdf, "attendance-report", "pdf");
  assert.equal(pdf.buffer.subarray(0, 5).toString("utf8"), "%PDF-");
  const pdfText = await extractPdfText(pdf.buffer);
  assert.equal(pdfText.includes(ATTENDANCE_EXPORT_BRAND), true);
  assert.equal(pdfText.includes(fixture.reportMemberName), true);
  assert.equal(pdfText.includes("AtlasGym"), false);
  assert.equal(pdfTextIncludesWords(pdfText, labels.t("presentDays")), true);
  console.log(`ok - Phase 4.7 ${lang} Attendance Report CSV/XLSX/PDF parsed and reconciled`);
}

async function testEntryLogFiles(origin: string, fixture: Fixture, lang: ReportExportLanguage) {
  const labels = getReportExportLabels(lang);
  const query = {
    from: atTime(fixture.date, 0, 0).toISOString(),
    to: atTime(fixture.date, 23, 59).toISOString(),
    memberId: fixture.bulkMemberId,
    lang,
  };
  const csv = await download(origin, "/api/v1/attendance/export.csv", query);
  assertBrandedFilename(csv, "entry-logs", "csv");
  const csvRows = parseCsv(csv.buffer.toString("utf8"));
  assert.equal(csvRows.length, ENTRY_LOG_COUNT + 1);
  assert.equal(csvRows[0]?.[0], labels.t("timestamp"));
  assert.equal(csvRows.slice(1).every((row) => row[1] === fixture.bulkMemberName), true);
  assert.equal(csvRows.flat().includes(fixture.customerCode), false);

  const xlsx = await download(origin, "/api/v1/attendance/export.xlsx", query);
  assertBrandedFilename(xlsx, "entry-logs", "xlsx");
  const workbook = readZipEntry(xlsx.buffer, "xl/workbook.xml");
  assert.match(workbook, new RegExp(`name="${escapeRegExp(labels.t("entryLogs"))}"`, "u"));
  const rows = parseXlsxSheet(xlsx.buffer, 1);
  assert.deepEqual(rows[0], [ATTENDANCE_EXPORT_BRAND]);
  assert.equal(rows.length, ENTRY_LOG_COUNT + 4);
  assert.equal(rows.slice(4).every((row) => row[1] === fixture.bulkMemberName), true);
  console.log(`ok - Phase 4.7 ${lang} Entry Logs exported all ${ENTRY_LOG_COUNT} rows beyond one page`);
}

async function testMonthlyTimecardFiles(origin: string, fixture: Fixture, lang: ReportExportLanguage) {
  const labels = getReportExportLabels(lang);
  const query = { month: fixture.monthKey, memberId: fixture.reportMemberId, lang };
  const csv = await download(origin, "/api/v1/reports/attendance/timecard/export.csv", query);
  assertBrandedFilename(csv, `monthly-timecard-${fixture.monthKey}`, "csv");
  const csvRows = parseCsv(csv.buffer.toString("utf8"));
  assert.equal(csvRows.length > 2, true);
  assert.equal(csvRows[0]?.[0], labels.t("memberCode"));
  assert.equal(csvRows.slice(1).every((row) => row[0] === fixture.reportMemberCode), true);
  const detailRows = csvRows.slice(1);
  const sums = {
    scheduled: sumColumn(detailRows, 6),
    actual: sumColumn(detailRows, 7),
    paired: sumColumn(detailRows, 8),
    late: sumColumn(detailRows, 11),
    early: sumColumn(detailRows, 12),
    overtime: sumColumn(detailRows, 13),
  };

  const xlsx = await download(origin, "/api/v1/reports/attendance/timecard/export.xlsx", query);
  assertBrandedFilename(xlsx, `monthly-timecard-${fixture.monthKey}`, "xlsx");
  const workbook = readZipEntry(xlsx.buffer, "xl/workbook.xml");
  assert.match(workbook, new RegExp(`name="${escapeRegExp(labels.t("summary"))}"`, "u"));
  assert.match(workbook, new RegExp(`name="${escapeRegExp(labels.t("dailyDetails"))}"`, "u"));
  const summary = parseXlsxSheet(xlsx.buffer, 1);
  const daily = parseXlsxSheet(xlsx.buffer, 2);
  assert.deepEqual(summary[0], [ATTENDANCE_EXPORT_BRAND]);
  assert.deepEqual(daily[0], [ATTENDANCE_EXPORT_BRAND]);
  assert.equal(daily.length - 4, detailRows.length);
  const summaryRow = summary[4];
  assert.ok(summaryRow, "Monthly Timecard summary row is missing");
  assert.equal(summaryRow[0], fixture.reportMemberCode);
  assert.equal(Number(summaryRow[3]), sums.scheduled);
  assert.equal(Number(summaryRow[4]), sums.actual);
  assert.equal(Number(summaryRow[5]), sums.paired);
  assert.equal(Number(summaryRow[9]), sums.late);
  assert.equal(Number(summaryRow[10]), sums.early);
  assert.equal(Number(summaryRow[11]), sums.overtime);

  const pdf = await download(origin, "/api/v1/reports/attendance/timecard/export.pdf", query);
  assertBrandedFilename(pdf, `monthly-timecard-${fixture.monthKey}`, "pdf");
  const pdfText = await extractPdfText(pdf.buffer);
  assert.equal(pdfText.includes(ATTENDANCE_EXPORT_BRAND), true);
  assert.equal(pdfText.includes(fixture.reportMemberName), true);
  assert.equal(pdfTextIncludesWords(pdfText, labels.t("monthlyTimecard")), true);
  console.log(`ok - Phase 4.7 ${lang} Monthly Timecard totals reconcile across CSV/XLSX/PDF`);
}

async function assertAuditRecords(fixture: Fixture) {
  const records = await prisma.auditLog.findMany({
    where: { actorId: fixture.adminUserId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(records.length, REPORT_EXPORT_LANGUAGES.length * 10);
  for (const record of records) {
    assert.equal(record.actorRole, AdminRole.GYM_OWNER);
    assert.equal(record.sessionId, fixture.adminSessionId);
    assert.equal(record.success, true);
    assert.equal(record.userAgent, USER_AGENT);
    assert.match(record.ipAddress ?? "", /127\.0\.0\.1/u);
    const metadata = asJsonObject(record.metadata);
    assert.equal(metadata["outcome"], "EXPORTED");
    assert.equal(typeof metadata["rowCount"], "number");
    assert.equal((metadata["rowCount"] as number) > 0, true);
    assert.equal(JSON.stringify(metadata).includes(fixture.suffix), false, "Audit metadata leaked fixture/search content");
  }

  assertAuditRows(records, "report.daily_attendance.exported", 1, 3);
  assertAuditRows(records, "report.attendance.exported", 1, 3);
  assertAuditRows(records, "report.attendance.exported", 5, 3);
  assertAuditRows(records, "report.attendance.exported", 2, 3);
  assertAuditRows(records, "report.entry_logs.exported", 3, 3);
  assertAuditRows(records, "report.entry_logs.exported", ENTRY_LOG_COUNT, 6);

  const timecard = records.filter((record) => record.action === "report.monthly_timecard.exported");
  assert.equal(timecard.length, 9);
  const timecardRowCount = asJsonObject(timecard[0]?.metadata)["rowCount"];
  assert.equal(typeof timecardRowCount, "number");
  assert.equal(timecard.every((record) => asJsonObject(record.metadata)["rowCount"] === timecardRowCount), true);
  console.log("ok - Phase 4.7 database Audit rows reconcile actor/session/IP and actual export row counts");
}

function assertAuditRows(
  records: Array<{ action: string; metadata: Prisma.JsonValue | null }>,
  action: string,
  rowCount: number,
  expectedCount: number
) {
  const matches = records.filter((record) =>
    record.action === action && asJsonObject(record.metadata)["rowCount"] === rowCount
  );
  assert.equal(matches.length, expectedCount, `${action} rowCount=${rowCount}`);
}

async function download(
  origin: string,
  path: string,
  query: Record<string, string>
): Promise<DownloadedFile> {
  const response = await fetch(`${origin}${path}?${new URLSearchParams(query)}`, { headers: headers() });
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, `${path}: ${body.toString("utf8")}`);
  return Object.freeze({
    buffer: body,
    contentType: response.headers.get("content-type") ?? "",
    disposition: response.headers.get("content-disposition") ?? "",
  });
}

function headers(profile = "exporter") {
  return { "x-test-profile": profile, "user-agent": USER_AGENT };
}

function assertBrandedFilename(file: DownloadedFile, stem: string, extension: string) {
  assert.match(file.disposition, new RegExp(
    `filename="${escapeRegExp(ATTENDANCE_EXPORT_FILENAME_PREFIX)}-${escapeRegExp(stem)}[^\"]*\\.${extension}"`,
    "u"
  ));
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const normalized = csv.replace(/^\uFEFF/u, "");
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]!;
    if (char === '"') {
      if (quoted && normalized[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r" || quoted) {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((item) => item.some((value) => value !== ""));
}

function readZipEntry(buffer: Buffer, entryName: string) {
  let offset = 0;
  while (offset <= buffer.length - 30) {
    if (buffer.readUInt32LE(offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    if (name === entryName) return buffer.subarray(dataStart, dataEnd).toString("utf8");
    offset = dataEnd;
  }
  throw new Error(`Missing ZIP entry: ${entryName}`);
}

function parseXlsxSheet(buffer: Buffer, sheetNumber: number) {
  const xml = readZipEntry(buffer, `xl/worksheets/sheet${sheetNumber}.xml`);
  return Array.from(xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gu), (rowMatch) =>
    Array.from((rowMatch[1] ?? "").matchAll(/<c\b[^>]*>([\s\S]*?)<\/c>/gu), (cellMatch) => {
      const cell = cellMatch[1] ?? "";
      const inlineText = cell.match(/<t\b[^>]*>([\s\S]*?)<\/t>/u)?.[1];
      const numericValue = cell.match(/<v>([\s\S]*?)<\/v>/u)?.[1];
      return decodeXml(inlineText ?? numericValue ?? "");
    })
  );
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

function sumColumn(rows: string[][], index: number) {
  return rows.reduce((total, row) => total + Number(row[index] ?? 0), 0);
}

function asJsonObject(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected Audit metadata object");
  return value as Record<string, Prisma.JsonValue>;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLog(memberId: string, recordedAt: Date, entryType: AttendanceType, isAuthorized: boolean) {
  return {
    memberId,
    recordedAt,
    entryType,
    source: AttendanceSource.MANUAL,
    isAuthorized,
    reason: isAuthorized ? null : "PHASE_4_7_DENIED",
  };
}

function atTime(date: Date, hours: number, minutes: number) {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function cleanupFixture(fixture: Fixture) {
  const memberIds = [fixture.reportMemberId, fixture.bulkMemberId, fixture.customerId];
  await prisma.auditLog.deleteMany({ where: { actorId: fixture.adminUserId } });
  await prisma.attendanceJustification.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.attendanceLog.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.memberShift.deleteMany({ where: { id: fixture.shiftId } });
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.staffGroup.deleteMany({ where: { id: fixture.staffGroupId } });
  await prisma.adminSession.deleteMany({ where: { id: fixture.adminSessionId } });
  await prisma.adminUser.deleteMany({ where: { id: fixture.adminUserId } });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({ where: { actorId: fixture.adminUserId } }),
    prisma.attendanceLog.count({ where: { memberId: { in: memberIds } } }),
    prisma.memberShift.count({ where: { id: fixture.shiftId } }),
    prisma.member.count({ where: { id: { in: memberIds } } }),
    prisma.staffGroup.count({ where: { id: fixture.staffGroupId } }),
    prisma.adminSession.count({ where: { id: fixture.adminSessionId } }),
    prisma.adminUser.count({ where: { id: fixture.adminUserId } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0]);
  console.log("ok - Phase 4.7 PostgreSQL fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runHttpExportAcceptance(fixture);
    await assertAuditRecords(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Attendance Phase 4.7 database/export/E2E acceptance passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
