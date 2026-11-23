
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AttendanceSource, AttendanceType, MemberType } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { errorHandler } from "../../middlewares/error-handler";
import { ATTENDANCE_DATA_SCOPES } from "../attendance/attendance-edition-scope";
import { getReportExportLabels, REPORT_EXPORT_LANGUAGES } from "../reports/shared/report-export.i18n";
import { extractPdfText, pdfTextIncludesWords } from "../reports/shared/pdf-text.test-utils";
import { getAttendanceComplianceCsv, getAttendanceComplianceXlsx } from "../reports-attendance-compliance/reports-attendance-compliance.service";
import { reportsAttendanceRouter } from "./reports-attendance.router";
import { getAttendanceReportCsvExport, getAttendanceReportPdfExport, getAttendanceReportSummary, getAttendanceReportXlsxExport } from "./reports-attendance.service";
import { ATTENDANCE_EXPORT_BRAND, ATTENDANCE_EXPORT_FILENAME_PREFIX } from "./attendance-export.brand";

type FixtureMember = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  memberType: MemberType;
  isStaff: boolean;
  archivedAt: Date | null;
  staffGroupId: string | null;
  staffGroupName: string | null;
};

type FixtureShift = {
  id: string;
  memberId: string;
  shiftId: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
  isActive: boolean;
};

type FixtureJustification = {
  id: string;
  memberId: string;
  date: Date;
};

type FixtureLog = {
  id: string;
  memberId: string | null;
  entryType: AttendanceType;
  recordedAt: Date;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason: string | null;
  deviceId: string | null;
};

type FixtureDevice = {
  id: string;
  name: string;
};

type FixtureData = {
  members: FixtureMember[];
  shifts: FixtureShift[];
  justifications: FixtureJustification[];
  logs: FixtureLog[];
  devices: FixtureDevice[];
};

const prismaAny = prisma as any;
const originalFns = {
  memberFindMany: prismaAny.member.findMany,
  memberShiftFindMany: prismaAny.memberShift.findMany,
  attendanceLogFindMany: prismaAny.attendanceLog.findMany,
  attendanceLogCount: prismaAny.attendanceLog.count,
  attendanceJustificationFindMany: prismaAny.attendanceJustification.findMany,
  deviceFindMany: prismaAny.device.findMany,
};

function restorePrisma() {
  prismaAny.member.findMany = originalFns.memberFindMany;
  prismaAny.memberShift.findMany = originalFns.memberShiftFindMany;
  prismaAny.attendanceLog.findMany = originalFns.attendanceLogFindMany;
  prismaAny.attendanceLog.count = originalFns.attendanceLogCount;
  prismaAny.attendanceJustification.findMany = originalFns.attendanceJustificationFindMany;
  prismaAny.device.findMany = originalFns.deviceFindMany;
}

async function testSummaryAggregation() {
  mockPrisma(buildSummaryFixture());

  const result = await getAttendanceReportSummary({
    from: "2026-02-16",
    to: "2026-02-16",
    memberType: "both",
    shiftMode: "primary",
    eventType: "all",
    onlyAnomalies: false,
  } as any, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);

  assert.equal(result.range.from, "2026-02-16");
  assert.equal(result.range.to, "2026-02-16");
  assert.equal(result.kpis.presentDays, 1);
  assert.equal(result.kpis.absentDays, 0);
  assert.equal(result.kpis.lateCount, 1);
  assert.equal(result.kpis.lateMinutes, 10);
  assert.equal(result.kpis.overtimeMinutes, 5);
  assert.equal(result.kpis.justifiedCount, 1);
  assert.equal(result.kpis.deniedCount, 1);
  assert.equal(result.kpis.noCheckoutCount, 0);
}

async function testCrossMidnight() {
  mockPrisma(buildCrossMidnightFixture());

  const result = await getAttendanceReportSummary({
    from: "2026-02-15",
    to: "2026-02-15",
    memberType: "staff",
    shiftMode: "primary",
    eventType: "all",
    onlyAnomalies: false,
  } as any, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);

  assert.equal(result.kpis.presentDays, 1);
  assert.equal(result.kpis.lateCount, 1);
  assert.equal(result.kpis.lateMinutes, 5);
  assert.equal(result.kpis.noCheckoutCount, 0);
}

async function testExportEndpoints() {
  mockPrisma(buildSummaryFixture());
  const audits: any[] = [];
  prismaAny.auditLog.create = async ({ data }: { data: any }) => {
    audits.push(data);
    return { id: `audit-${audits.length}`, ...data };
  };

  const app = express();
  app.use((req, _res, next) => {
    req.auth = {
      user: { id: "test-export-admin", role: "GYM_OWNER" },
      session: { id: "test-export-session" },
      permissions: ["FINANCIAL_EXPORT"],
    } as any;
    next();
  });
  app.use("/api/v1/reports/attendance", reportsAttendanceRouter);
  app.use(errorHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const query = "from=2026-02-16&to=2026-02-16";

    const xlsxRes = await fetch(`${baseUrl}/api/v1/reports/attendance/export.xlsx?${query}`);
    assert.equal(xlsxRes.status, 200);
    assert.match(xlsxRes.headers.get("content-type") ?? "", /application\/vnd\.openxmlformats-officedocument/);
    assert.match(xlsxRes.headers.get("content-disposition") ?? "", /attachment; filename="attendance-report-.*\.xlsx"/);
    const xlsxBytes = Buffer.from(await xlsxRes.arrayBuffer());
    assert.equal(xlsxBytes.subarray(0, 2).toString("utf8"), "PK");

    const pdfRes = await fetch(`${baseUrl}/api/v1/reports/attendance/export.pdf?${query}`);
    assert.equal(pdfRes.status, 200);
    assert.match(pdfRes.headers.get("content-type") ?? "", /application\/pdf/);
    assert.match(pdfRes.headers.get("content-disposition") ?? "", /attachment; filename="attendance-report-.*\.pdf"/);
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    assert.equal(pdfBytes.subarray(0, 5).toString("utf8"), "%PDF-");

    for (const variant of ["daily", "members", "evidence"] as const) {
      const csvRes = await fetch(
        `${baseUrl}/api/v1/reports/attendance/export.csv?${query}&variant=${variant}&lang=en`
      );
      assert.equal(csvRes.status, 200);
      assert.match(csvRes.headers.get("content-type") ?? "", /text\/csv/);
      const csvBytes = Buffer.from(await csvRes.arrayBuffer());
      assert.deepEqual([...csvBytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.ok(parseCsv(csvBytes.toString("utf8")).length >= 1);
    }

    assert.deepEqual(
      audits.map((audit) => audit.action),
      [
        "report.attendance.exported",
        "report.attendance.exported",
        "report.daily_attendance.exported",
        "report.attendance.exported",
        "report.entry_logs.exported",
      ]
    );
    assert.equal(audits.every((audit) => audit.success && audit.metadata.outcome === "EXPORTED"), true);
    assert.equal(audits.every((audit) => audit.metadata.filters.searchApplied === false), true);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function testXlsxExportReconcilesLocalizedFixtureContent() {
  mockPrisma(buildSummaryFixture());

  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const labels = getReportExportLabels(lang);
    const result = await getAttendanceReportXlsxExport({
      from: "2026-02-16",
      to: "2026-02-16",
      memberType: "both",
      shiftMode: "primary",
      eventType: "all",
      onlyAnomalies: false,
      includeEvidence: true,
      lang,
    } as any, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);

    const workbook = readZipEntry(result.buffer, "xl/workbook.xml");
    [labels.t("summaryKpi"), labels.t("daily"), labels.t("members"), labels.t("evidence")].forEach((sheetName) => {
      assert.match(workbook, new RegExp(`name="${escapeRegExp(sheetName)}"`, "u"));
    });

    const summary = parseXlsxSheet(result.buffer, 1);
    assert.deepEqual(summary[0], [labels.t("metric"), labels.t("value")]);
    assert.deepEqual(findRow(summary, labels.t("presentDays")), [labels.t("presentDays"), "1"]);
    assert.deepEqual(findRow(summary, labels.t("lateMinutes")), [labels.t("lateMinutes"), "10"]);
    assert.deepEqual(findRow(summary, labels.t("overtimeMinutes")), [labels.t("overtimeMinutes"), "5"]);
    assert.deepEqual(findRow(summary, labels.t("justifiedDays")), [labels.t("justifiedDays"), "1"]);
    assert.deepEqual(findRow(summary, labels.t("deniedAttempts")), [labels.t("deniedAttempts"), "1"]);
    assert.deepEqual(findRow(summary, labels.t("dateFrom")), [labels.t("dateFrom"), "2026-02-16"]);

    const daily = parseXlsxSheet(result.buffer, 2);
    assert.deepEqual(daily[0], [
      labels.t("date"),
      labels.t("present"),
      labels.t("absentDays"),
      labels.t("lateCount"),
      labels.t("lateMin"),
      labels.t("earlyLeave"),
      labels.t("earlyMin"),
      labels.t("overtimeMin"),
      labels.t("justified"),
      labels.t("unscheduled"),
      labels.t("denied"),
      labels.t("noCheckout"),
    ]);
    assert.deepEqual(daily[1], ["2026-02-16", "1", "0", "1", "10", "0", "0", "5", "1", "0", "1", "0"]);

    const members = parseXlsxSheet(result.buffer, 3);
    assert.equal(members[0]?.[0], labels.t("memberCode"));
    assert.equal(members[0]?.[1], labels.t("member"));
    assert.equal(members[0]?.[2], labels.t("memberType"));
    const alice = findRow(members, "1");
    assert.equal(alice[1], "Alice Ahmadi");
    assert.equal(alice[2], labels.memberType("STAFF"));
    assert.deepEqual(alice.slice(3), ["1", "1", "0", "1", "10", "0", "0", "5", "0", "0", "1", "0"]);
    const bob = findRow(members, "2");
    assert.equal(bob[1], "Bob Nouri");
    assert.equal(bob[2], labels.memberType("STAFF"));
    assert.deepEqual(bob.slice(3), ["1", "0", "0", "0", "0", "0", "0", "0", "1", "0", "0", "0"]);

    const evidence = parseXlsxSheet(result.buffer, 4);
    assert.deepEqual(evidence[0], [
      labels.t("timestamp"),
      labels.t("member"),
      labels.t("type"),
      labels.t("event"),
      labels.t("device"),
      labels.t("source"),
      labels.t("result"),
      labels.t("reason"),
      labels.t("notes"),
    ]);
    assert.equal(evidence.length, 4);
    assert.equal(evidence.every((row, index) => index === 0 || row[1] === "Alice Ahmadi"), true);
    assert.equal(evidence.every((row, index) => index === 0 || row[2] === labels.memberType("STAFF")), true);
    assert.equal(evidence.every((row, index) => index === 0 || row[4] === "Gate 1"), true);
    assert.equal(evidence.every((row, index) => index === 0 || row[5] === labels.attendanceSource("DEVICE")), true);
    assert.equal(evidence.some((row) => row[3] === labels.attendanceEvent("IN") && row[6] === labels.attendanceResult("authorized")), true);
    assert.equal(evidence.some((row) => row[3] === labels.attendanceEvent("OUT") && row[6] === labels.attendanceResult("authorized")), true);
    assert.equal(
      evidence.some(
        (row) =>
          row[3] === labels.attendanceEvent("DENIED") &&
          row[6] === labels.attendanceResult("denied") &&
          row[7] === "Door denied" &&
          row[8] === "Door denied"
      ),
      true
    );
  }
}

async function testPdfExportReconcilesLocalizedFixtureText() {
  mockPrisma(buildSummaryFixture());

  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const labels = getReportExportLabels(lang);
    const result = await getAttendanceReportPdfExport({
      from: "2026-02-16",
      to: "2026-02-16",
      memberType: "both",
      shiftMode: "primary",
      eventType: "all",
      onlyAnomalies: false,
      includeEvidence: true,
      lang,
    } as any, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    const text = await extractPdfText(result.buffer);

    for (const expected of [
      labels.t("presentDays"),
      labels.t("lateMinutes"),
      labels.t("overtimeMinutes"),
    ]) {
      assert.equal(pdfTextIncludesWords(text, expected), true, `attendance ${lang} PDF is missing extracted words: ${expected}\n${text}`);
    }
    for (const expected of ["AtlasGym", "2026-02-16", "Alice Ahmadi"]) {
      assert.equal(text.includes(expected), true, `attendance ${lang} PDF is missing extracted text: ${expected}\n${text}`);
    }
    assert.match(text, /10/u);
    assert.equal(text.includes("undefined"), false);
    assert.equal(text.includes("NaN"), false);
  }
}

async function testComplianceExportsReconcileLocalizedFixtureContent() {
  mockPrisma(buildComplianceFixture());
  const queryBase = {
    from: "2026-03-02",
    to: "2026-03-03",
    memberType: "staff",
    shiftMode: "primary",
    eventType: "all",
    onlyAnomalies: false,
    viewBy: "member",
    sortBy: "score",
    sortDir: "asc",
    lateMinutesWeight: 0.05,
    lateCountWeight: 1,
    absentWeight: 8,
    noCheckoutWeight: 4,
    deniedWeight: 6,
  } as any;

  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const labels = getReportExportLabels(lang);
    const query = { ...queryBase, lang };
    const expectedHeaders = [
      labels.t("entity"),
      labels.t("type"),
      labels.t("score"),
      labels.t("lateCount"),
      labels.t("lateMinutes"),
      labels.t("absentDays"),
      labels.t("earlyLeave"),
      labels.t("overtime"),
      labels.t("denied"),
      labels.t("noCheckout"),
    ];
    const expectedCsvRows = [
      ["Risky Staff (#R1)", labels.entityType("member"), "80.00", "1", "20", "1", "0", "0", "1", "1"],
      ["Healthy Staff (#H1)", labels.entityType("member"), "100.00", "0", "0", "0", "0", "0", "0", "0"],
    ];

    const csvResult = await getAttendanceComplianceCsv(query, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    const csvRows = parseCsv(csvResult.csv);
    assert.deepEqual(csvRows[0], expectedHeaders);
    assert.deepEqual(csvRows.slice(1), expectedCsvRows, `attendance compliance ${lang} CSV rows`);

    const xlsxResult = await getAttendanceComplianceXlsx(query, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    const workbook = readZipEntry(xlsxResult.buffer, "xl/workbook.xml");
    [labels.t("summary"), labels.t("distribution"), labels.t("compliance")].forEach((sheetName) => {
      assert.match(workbook, new RegExp(`name="${escapeRegExp(sheetName)}"`, "u"));
    });

    const summary = parseXlsxSheet(xlsxResult.buffer, 1);
    assert.deepEqual(summary[0], [labels.t("metric"), labels.t("value")]);
    assert.deepEqual(findRow(summary, labels.t("averageScore")), [labels.t("averageScore"), "90"]);
    assert.deepEqual(findRow(summary, labels.t("bestScore")), [labels.t("bestScore"), "100"]);
    assert.deepEqual(findRow(summary, labels.t("worstScore")), [labels.t("worstScore"), "80"]);
    assert.deepEqual(findRow(summary, labels.t("evaluatedCount")), [labels.t("evaluatedCount"), "2"]);
    assert.deepEqual(findRow(summary, labels.t("viewBy")), [labels.t("viewBy"), labels.entityType("member")]);

    const distribution = parseXlsxSheet(xlsxResult.buffer, 2);
    assert.deepEqual(distribution, [
      [labels.t("bucket"), labels.t("count")],
      ["0-49", "0"],
      ["50-69", "0"],
      ["70-84", "1"],
      ["85-100", "1"],
    ]);

    const compliance = parseXlsxSheet(xlsxResult.buffer, 3);
    assert.deepEqual(compliance[0], expectedHeaders);
    assert.deepEqual(
      compliance.slice(1),
      expectedCsvRows.map((row) => [row[0], row[1], String(Number(row[2])), ...row.slice(3)]),
      `attendance compliance ${lang} XLSX rows`
    );
  }
}

async function testAttendanceEditionExportBrandingAndLanguage() {
  mockPrisma(buildSummaryFixture());
  for (const lang of REPORT_EXPORT_LANGUAGES) {
    const labels = getReportExportLabels(lang);
    const query = {
      from: "2026-02-16", to: "2026-02-16", memberType: "staff", shiftMode: "primary",
      eventType: "all", onlyAnomalies: false, includeEvidence: true, lang,
    } as any;
    const csv = await getAttendanceReportCsvExport({ ...query, variant: "daily", sortBy: "memberName", sortDir: "asc" }, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal(csv.filename.startsWith(`${ATTENDANCE_EXPORT_FILENAME_PREFIX}-attendance-daily-`), true);
    assert.equal(csv.buffer.toString("utf8").includes(labels.t("present")), true);

    const xlsx = await getAttendanceReportXlsxExport(query, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal(xlsx.filename.startsWith(`${ATTENDANCE_EXPORT_FILENAME_PREFIX}-attendance-report-`), true);
    assert.equal(xlsx.buffer.toString("utf8").includes(ATTENDANCE_EXPORT_BRAND), true);

    const pdf = await getAttendanceReportPdfExport(query, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    const text = await extractPdfText(pdf.buffer);
    assert.equal(text.includes(ATTENDANCE_EXPORT_BRAND), true);
    assert.equal(text.includes("AtlasGym"), false);
    assert.equal(pdfTextIncludesWords(text, labels.t("presentDays")), true);
  }
}

async function run() {
  const tests: Array<{ name: string; execute: () => Promise<void> }> = [
    { name: "summary aggregation includes late/overtime/justified/denied metrics", execute: testSummaryAggregation },
    { name: "cross-midnight shifts are computed inside the same scheduled day", execute: testCrossMidnight },
    { name: "export endpoints return valid downloadable files", execute: testExportEndpoints },
    { name: "XLSX export reconciles localized fixture content", execute: testXlsxExportReconcilesLocalizedFixtureContent },
    { name: "PDF export reconciles localized fixture text", execute: testPdfExportReconcilesLocalizedFixtureText },
    { name: "Attendance Edition exports use Entry Control branding and three languages", execute: testAttendanceEditionExportBrandingAndLanguage },
    { name: "compliance CSV and XLSX reconcile localized fixture content", execute: testComplianceExportsReconcileLocalizedFixtureContent },
  ];

  let failures = 0;
  for (const item of tests) {
    try {
      await item.execute();
      console.log(`ok - ${item.name}`);
    } catch (error) {
      failures += 1;
      console.error(`not ok - ${item.name}`);
      console.error(error);
    } finally {
      restorePrisma();
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void run();

function readZipEntry(buffer: Buffer, entryName: string) {
  let offset = 0;
  while (offset + 30 <= buffer.length) {
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
  throw new Error(`Missing XLSX entry: ${entryName}`);
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

function findRow(rows: string[][], firstCell: string) {
  const row = rows.find((item) => item[0] === firstCell);
  assert.ok(row, `Missing XLSX row starting with ${firstCell}`);
  return row;
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&amp;/gu, "&");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
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
  return rows;
}

function mockPrisma(fixture: FixtureData) {
  prismaAny.auditLog.create = async ({ data }: { data: any }) => ({ id: "test-audit", ...data });
  prismaAny.member.findMany = async ({ where }: { where?: any } = {}) => {
    return filterMembers(fixture.members, where).map((member) => ({
      id: member.id,
      code: member.code,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      memberType: member.memberType,
      isStaff: member.isStaff,
      staffGroupId: member.staffGroupId,
      staffGroup: member.staffGroupName ? { name: member.staffGroupName } : null,
    }));
  };

  prismaAny.memberShift.findMany = async ({ where }: { where?: any } = {}) => {
    return filterShifts(fixture.shifts, where).map((shift) => ({
      id: shift.id,
      memberId: shift.memberId,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays,
      graceMinutes: shift.graceMinutes,
    }));
  };

  prismaAny.attendanceLog.findMany = async ({ where, orderBy, skip = 0, take }: { where?: any; orderBy?: any; skip?: number; take?: number } = {}) => {
    const ordered = sortLogs(filterLogs(fixture.logs, where), orderBy);
    const sliced = typeof take === "number" ? ordered.slice(skip, skip + take) : ordered.slice(skip);
    return sliced.map((log) => {
      const member = log.memberId ? fixture.members.find((item) => item.id === log.memberId) ?? null : null;
      return {
        id: log.id,
        memberId: log.memberId,
        deviceUserId: log.deviceId ? `du_${log.deviceId}` : null,
        rawLogId: null,
        entryType: log.entryType,
        recordedAt: log.recordedAt,
        source: log.source,
        isAuthorized: log.isAuthorized,
        reason: log.reason,
        dedupeKey: null,
        createdAt: log.recordedAt,
        member: member
          ? {
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              memberType: member.memberType,
              isStaff: member.isStaff,
            }
          : null,
        deviceUser: log.deviceId ? { deviceId: log.deviceId } : null,
      };
    });
  };

  prismaAny.attendanceLog.count = async ({ where }: { where?: any } = {}) => filterLogs(fixture.logs, where).length;

  prismaAny.attendanceJustification.findMany = async ({ where }: { where?: any } = {}) => {
    const memberIds = (where?.memberId?.in as string[] | undefined) ?? null;
    const gte = where?.date?.gte as Date | undefined;
    const lt = where?.date?.lt as Date | undefined;
    return fixture.justifications
      .filter((row) => (!memberIds ? true : memberIds.includes(row.memberId)) && (!gte || row.date >= gte) && (!lt || row.date < lt))
      .map((row) => ({ memberId: row.memberId, date: row.date }));
  };

  prismaAny.device.findMany = async ({ where }: { where?: any } = {}) => {
    const deviceIds = (where?.id?.in as string[] | undefined) ?? [];
    return fixture.devices.filter((device) => deviceIds.includes(device.id));
  };
}

function filterMembers(members: FixtureMember[], where: any): FixtureMember[] {
  if (!where) return [...members];
  return members.filter((member) => matchesMemberWhere(member, where));
}

function matchesMemberWhere(member: FixtureMember, where: any): boolean {
  if (where.archivedAt === null && member.archivedAt !== null) return false;
  if (typeof where.id === "string" && member.id !== where.id) return false;
  if (typeof where.staffGroupId === "string" && member.staffGroupId !== where.staffGroupId) return false;
  if (typeof where.memberType === "string" && member.memberType !== where.memberType) return false;
  if (typeof where.isStaff === "boolean" && member.isStaff !== where.isStaff) return false;

  if (Array.isArray(where.OR) && where.OR.length > 0) {
    const matched = where.OR.some((condition: any) => matchesMemberWhere(member, condition));
    if (!matched) return false;
  }

  if (where.code?.contains && !matchesContains(member.code, where.code.contains)) return false;
  if (where.firstName?.contains && !matchesContains(member.firstName, where.firstName.contains)) return false;
  if (where.lastName?.contains && !matchesContains(member.lastName ?? "", where.lastName.contains)) return false;
  if (where.phone?.contains && !matchesContains(member.phone ?? "", where.phone.contains)) return false;

  return true;
}

function filterShifts(shifts: FixtureShift[], where: any): FixtureShift[] {
  if (!where) return [...shifts];
  return shifts.filter((shift) => {
    if (where.isActive === true && !shift.isActive) return false;
    if (where.memberId?.in && !(where.memberId.in as string[]).includes(shift.memberId)) return false;
    if (where.shiftId && shift.shiftId !== where.shiftId) return false;
    return true;
  });
}

function filterLogs(logs: FixtureLog[], where: any): FixtureLog[] {
  if (!where) return [...logs];
  return logs.filter((log) => {
    if (where.memberId?.in && !log.memberId) return false;
    if (where.memberId?.in && !(where.memberId.in as string[]).includes(log.memberId as string)) return false;

    const gte = where.recordedAt?.gte as Date | undefined;
    const lt = where.recordedAt?.lt as Date | undefined;
    if (gte && log.recordedAt < gte) return false;
    if (lt && log.recordedAt >= lt) return false;

    if (typeof where.isAuthorized === "boolean" && log.isAuthorized !== where.isAuthorized) return false;
    if (where.entryType && log.entryType !== where.entryType) return false;
    if (where.id?.in && !(where.id.in as string[]).includes(log.id)) return false;
    if (where.deviceUser?.deviceId && log.deviceId !== where.deviceUser.deviceId) return false;

    return true;
  });
}

function sortLogs(logs: FixtureLog[], orderBy: any): FixtureLog[] {
  const direction = Array.isArray(orderBy) ? orderBy[0]?.recordedAt : orderBy?.recordedAt;
  if (!direction) return [...logs];
  const factor = direction === "asc" ? 1 : -1;
  return [...logs].sort((left, right) => factor * (left.recordedAt.getTime() - right.recordedAt.getTime()));
}

function matchesContains(source: string, search: string) {
  return source.toLowerCase().includes(search.toLowerCase());
}

function buildSummaryFixture(): FixtureData {
  return {
    members: [
      {
        id: "cm_member_01",
        code: "1",
        firstName: "Alice",
        lastName: "Ahmadi",
        phone: "0700000001",
        memberType: MemberType.STAFF,
        isStaff: true,
        archivedAt: null,
        staffGroupId: null,
        staffGroupName: null,
      },
      {
        id: "cm_member_02",
        code: "2",
        firstName: "Bob",
        lastName: "Nouri",
        phone: "0700000002",
        memberType: MemberType.STAFF,
        isStaff: true,
        archivedAt: null,
        staffGroupId: null,
        staffGroupName: null,
      },
    ],
    shifts: [
      { id: "shift-1", memberId: "cm_member_01", shiftId: "tmpl-1", shiftName: "Morning", shiftStart: "09:00", shiftEnd: "17:00", weekdays: [0, 1, 2, 3, 4, 5, 6], graceMinutes: 0, isActive: true },
      { id: "shift-2", memberId: "cm_member_02", shiftId: "tmpl-1", shiftName: "Morning", shiftStart: "09:00", shiftEnd: "17:00", weekdays: [0, 1, 2, 3, 4, 5, 6], graceMinutes: 0, isActive: true },
    ],
    justifications: [{ id: "just-1", memberId: "cm_member_02", date: new Date(2026, 1, 16) }],
    logs: [
      { id: "log-in-1", memberId: "cm_member_01", entryType: AttendanceType.IN, recordedAt: new Date(2026, 1, 16, 9, 10), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-1" },
      { id: "log-out-1", memberId: "cm_member_01", entryType: AttendanceType.OUT, recordedAt: new Date(2026, 1, 16, 17, 5), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-1" },
      { id: "log-denied-1", memberId: "cm_member_01", entryType: AttendanceType.IN, recordedAt: new Date(2026, 1, 16, 8, 40), source: AttendanceSource.DEVICE, isAuthorized: false, reason: "Door denied", deviceId: "device-1" },
    ],
    devices: [{ id: "device-1", name: "Gate 1" }],
  };
}

function buildCrossMidnightFixture(): FixtureData {
  return {
    members: [
      {
        id: "cm_member_10",
        code: "10",
        firstName: "Cross",
        lastName: "Midnight",
        phone: "0700000010",
        memberType: MemberType.STAFF,
        isStaff: true,
        archivedAt: null,
        staffGroupId: null,
        staffGroupName: null,
      },
    ],
    shifts: [
      { id: "shift-x", memberId: "cm_member_10", shiftId: "tmpl-x", shiftName: "Cross", shiftStart: "21:40", shiftEnd: "09:00", weekdays: [0, 1, 2, 3, 4, 5, 6], graceMinutes: 0, isActive: true },
    ],
    justifications: [],
    logs: [
      { id: "log-in-x", memberId: "cm_member_10", entryType: AttendanceType.IN, recordedAt: new Date(2026, 1, 15, 21, 45), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-2" },
      { id: "log-out-x", memberId: "cm_member_10", entryType: AttendanceType.OUT, recordedAt: new Date(2026, 1, 16, 8, 50), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-2" },
    ],
    devices: [{ id: "device-2", name: "Gate 2" }],
  };
}

function buildComplianceFixture(): FixtureData {
  const members: FixtureMember[] = [
    {
      id: "cm_compliance_healthy",
      code: "H1",
      firstName: "Healthy",
      lastName: "Staff",
      phone: "0700000101",
      memberType: MemberType.STAFF,
      isStaff: true,
      archivedAt: null,
      staffGroupId: null,
      staffGroupName: null,
    },
    {
      id: "cm_compliance_risky",
      code: "R1",
      firstName: "Risky",
      lastName: "Staff",
      phone: "0700000102",
      memberType: MemberType.STAFF,
      isStaff: true,
      archivedAt: null,
      staffGroupId: null,
      staffGroupName: null,
    },
  ];
  const shifts: FixtureShift[] = members.map((member, index) => ({
    id: `compliance-shift-${index + 1}`,
    memberId: member.id,
    shiftId: "compliance-template",
    shiftName: "Day",
    shiftStart: "09:00",
    shiftEnd: "17:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    graceMinutes: 0,
    isActive: true,
  }));
  const logs: FixtureLog[] = [
    { id: "healthy-in-1", memberId: "cm_compliance_healthy", entryType: AttendanceType.IN, recordedAt: new Date(2026, 2, 2, 9, 0), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-compliance" },
    { id: "healthy-out-1", memberId: "cm_compliance_healthy", entryType: AttendanceType.OUT, recordedAt: new Date(2026, 2, 2, 17, 0), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-compliance" },
    { id: "healthy-in-2", memberId: "cm_compliance_healthy", entryType: AttendanceType.IN, recordedAt: new Date(2026, 2, 3, 9, 0), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-compliance" },
    { id: "healthy-out-2", memberId: "cm_compliance_healthy", entryType: AttendanceType.OUT, recordedAt: new Date(2026, 2, 3, 17, 0), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-compliance" },
    { id: "risky-denied", memberId: "cm_compliance_risky", entryType: AttendanceType.IN, recordedAt: new Date(2026, 2, 2, 8, 30), source: AttendanceSource.DEVICE, isAuthorized: false, reason: "Denied", deviceId: "device-compliance" },
    { id: "risky-in", memberId: "cm_compliance_risky", entryType: AttendanceType.IN, recordedAt: new Date(2026, 2, 2, 9, 20), source: AttendanceSource.DEVICE, isAuthorized: true, reason: null, deviceId: "device-compliance" },
  ];
  return {
    members,
    shifts,
    justifications: [],
    logs,
    devices: [{ id: "device-compliance", name: "Compliance Gate" }],
  };
}
