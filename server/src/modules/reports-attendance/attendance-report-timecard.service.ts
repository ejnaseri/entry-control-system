import { HttpError } from "../../middlewares/error-handler";
import { ATTENDANCE_DATA_SCOPES } from "../attendance/attendance-edition-scope";
import { listDailyAttendance } from "../attendance/attendance.service";
import { buildCsv, buildSimplePdf, buildXlsxBuffer } from "../reports/shared/report-export.utils";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import {
  generateAuditedReportExport,
  toSafeReportExportFilters,
  type ReportExportContext,
} from "../reports/shared/report-export.audit";
import { ATTENDANCE_EXPORT_BRAND, ATTENDANCE_EXPORT_FILENAME_PREFIX } from "./attendance-export.brand";
import type {
  AttendanceMonthlyTimecardExportQuery,
  AttendanceMonthlyTimecardQuery,
} from "./attendance-report.schemas";

type DailyLoader = typeof listDailyAttendance;
type DailyResponse = Awaited<ReturnType<DailyLoader>>;
type DailyRow = DailyResponse["rows"][number];

export type MonthlyTimecardDay = Readonly<{
  date: string;
  status: "ABSENT" | "LATE" | "PRESENT" | "INSIDE" | "JUSTIFIED";
  shiftName: string;
  scheduledMinutes: number;
  actualMinutes: number;
  pairedSessionCount: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  missingPunch: boolean;
  invalidPunch: boolean;
  justified: boolean;
  unscheduled: boolean;
}>;

export type MonthlyTimecardTotals = Readonly<{
  scheduledMinutes: number;
  actualMinutes: number;
  pairedSessionCount: number;
  presentDays: number;
  absentDays: number;
  justifiedDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  missingPunchDays: number;
  invalidPunchDays: number;
  unscheduledDays: number;
}>;

export type MonthlyTimecardItem = Readonly<{
  memberId: string;
  memberCode: string;
  memberName: string;
  staffGroupId: string | null;
  staffGroupName: string | null;
  totals: MonthlyTimecardTotals;
  days: readonly MonthlyTimecardDay[];
}>;

export type MonthlyTimecardResponse = Readonly<{
  month: string;
  items: readonly MonthlyTimecardItem[];
  pageInfo: Readonly<{ page: number; pageSize: number; totalItems: number; totalPages: number }>;
}>;

export function createMonthlyTimecardService(dailyLoader: DailyLoader = listDailyAttendance) {
  const loadAll = async (query: Pick<AttendanceMonthlyTimecardQuery, "month" | "memberId" | "staffGroupId">) => {
    const dates = datesInMonth(query.month);
    const responses: DailyResponse[] = [];
    for (let index = 0; index < dates.length; index += 5) {
      const batch = dates.slice(index, index + 5);
      responses.push(...await Promise.all(batch.map((date) => dailyLoader({
        date,
        mode: "primary",
        ...(query.memberId ? { memberId: query.memberId } : {}),
        ...(query.staffGroupId ? { staffGroupId: query.staffGroupId } : {}),
      }, ATTENDANCE_DATA_SCOPES.STRICT_STAFF))));
    }
    return aggregateTimecards(responses);
  };

  return Object.freeze({ loadAll });
}

const monthlyTimecardService = createMonthlyTimecardService();

export async function getAttendanceMonthlyTimecard(
  query: AttendanceMonthlyTimecardQuery
): Promise<MonthlyTimecardResponse> {
  const items = await monthlyTimecardService.loadAll(query);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  return {
    month: query.month,
    items: items.slice(start, start + query.pageSize),
    pageInfo: { page, pageSize: query.pageSize, totalItems, totalPages },
  };
}

export function createAttendanceMonthlyTimecardExporter(service = monthlyTimecardService) {
  return async (
    query: AttendanceMonthlyTimecardExportQuery,
    format: "CSV" | "XLSX" | "PDF"
  ) => {
  const items = await service.loadAll(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("memberCode"), t("employee"), t("staffGroup"), t("date"), t("status"), t("shift"),
    t("scheduledMinutes"), t("actualMinutes"), t("pairedSessions"), t("checkIn"), t("checkOut"),
    t("lateMinutes"), t("earlyLeaveMinutes"), t("overtimeMinutes"), t("missingPunch"),
    t("invalidPunch"), t("justified"),
  ];
  const detailRows = items.flatMap((item) => item.days.map((day) => [
    item.memberCode, item.memberName, item.staffGroupName ?? "", day.date, labels.attendanceStatus(day.status), day.shiftName,
    day.scheduledMinutes, day.actualMinutes, day.pairedSessionCount, day.checkInAt ?? "", day.checkOutAt ?? "",
    day.lateMinutes, day.earlyLeaveMinutes, day.overtimeMinutes, labels.yesNo(day.missingPunch),
    labels.yesNo(day.invalidPunch), labels.yesNo(day.justified),
  ]));
  const summaryHeaders = [
    t("memberCode"), t("employee"), t("staffGroup"), t("scheduledMinutes"), t("actualMinutes"), t("pairedSessions"),
    t("presentDays"), t("absentDays"), t("justifiedDays"), t("lateMinutes"), t("earlyLeaveMinutes"),
    t("overtimeMinutes"), t("missingPunch"), t("invalidPunch"), t("unscheduled"),
  ];
  const summaryRows = items.map((item) => [
    item.memberCode, item.memberName, item.staffGroupName ?? "", item.totals.scheduledMinutes,
    item.totals.actualMinutes, item.totals.pairedSessionCount, item.totals.presentDays,
    item.totals.absentDays, item.totals.justifiedDays, item.totals.lateMinutes,
    item.totals.earlyLeaveMinutes, item.totals.overtimeMinutes, item.totals.missingPunchDays,
    item.totals.invalidPunchDays, item.totals.unscheduledDays,
  ]);
  const base = `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-monthly-timecard-${query.month}`;

  if (format === "CSV") {
    return {
      buffer: Buffer.from(`\uFEFF${buildCsv(headers, detailRows)}`, "utf8"),
      filename: `${base}.csv`,
      contentType: "text/csv; charset=utf-8",
      rowCount: detailRows.length,
    };
  }
  if (format === "XLSX") {
    return {
      buffer: buildXlsxBuffer([
        { name: t("summary"), rows: [[ATTENDANCE_EXPORT_BRAND], [t("monthlyTimecard"), query.month], [], summaryHeaders, ...summaryRows] },
        { name: t("dailyDetails"), rows: [[ATTENDANCE_EXPORT_BRAND], [t("month"), query.month], [], headers, ...detailRows] },
      ]),
      filename: `${base}.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      rowCount: detailRows.length,
    };
  }
  const lines = items.flatMap((item) => [
    `${t("memberCode")}: ${item.memberCode} | ${t("employee")}: ${item.memberName} | ${t("staffGroup")}: ${item.staffGroupName ?? "-"}`,
    `${t("scheduledMinutes")}: ${item.totals.scheduledMinutes} | ${t("actualMinutes")}: ${item.totals.actualMinutes} | ${t("pairedSessions")}: ${item.totals.pairedSessionCount}`,
    `${t("presentDays")}: ${item.totals.presentDays} | ${t("absentDays")}: ${item.totals.absentDays} | ${t("justifiedDays")}: ${item.totals.justifiedDays}`,
    `${t("lateMinutes")}: ${item.totals.lateMinutes} | ${t("earlyLeaveMinutes")}: ${item.totals.earlyLeaveMinutes} | ${t("overtimeMinutes")}: ${item.totals.overtimeMinutes}`,
    ...item.days.map((day) => `${day.date} | ${labels.attendanceStatus(day.status)} | ${day.shiftName || t("unscheduled")} | ${t("scheduledMinutes")}: ${day.scheduledMinutes} | ${t("actualMinutes")}: ${day.actualMinutes} | ${t("pairedSessions")}: ${day.pairedSessionCount}`),
    "",
  ]);
  return {
    buffer: await buildSimplePdf([ATTENDANCE_EXPORT_BRAND, `${t("month")}: ${query.month}`, "", ...lines], `${t("monthlyTimecard")} ${query.month}`),
    filename: `${base}.pdf`,
    contentType: "application/pdf",
    rowCount: detailRows.length,
  };
  };
}

export const getAttendanceMonthlyTimecardExport = createAttendanceMonthlyTimecardExporter();

export function createAuditedAttendanceMonthlyTimecardExporter(
  generate = getAttendanceMonthlyTimecardExport,
  audit = generateAuditedReportExport
) {
  return async (
    query: AttendanceMonthlyTimecardExportQuery,
    format: "CSV" | "XLSX" | "PDF",
    context: ReportExportContext
  ) => audit({
    context,
    action: "report.monthly_timecard.exported",
    targetType: "MonthlyTimecard",
    targetId: "monthly-timecard",
    format,
    filters: {
      ...toSafeReportExportFilters(query as unknown as Record<string, unknown>),
      memberType: "staff",
      language: query.lang,
      generation: "SERVER",
    },
    generate: async () => {
      const file = await generate(query, format);
      return { ...file, body: file.buffer };
    },
  });
}

export const getAuditedAttendanceMonthlyTimecardExport = createAuditedAttendanceMonthlyTimecardExporter();

export function aggregateTimecards(responses: readonly DailyResponse[]): MonthlyTimecardItem[] {
  const records = new Map<string, {
    memberId: string;
    memberCode: string;
    memberName: string;
    staffGroupId: string | null;
    staffGroupName: string | null;
    days: MonthlyTimecardDay[];
  }>();

  for (const response of responses) {
    for (const row of response.rows) {
      const record = records.get(row.memberId) ?? {
        memberId: row.memberId,
        memberCode: row.memberCode,
        memberName: row.memberFullName,
        staffGroupId: row.staffGroupId ?? null,
        staffGroupName: row.staffGroupName ?? null,
        days: [],
      };
      record.days.push(toTimecardDay(response.date, row));
      records.set(row.memberId, record);
    }
  }

  return [...records.values()]
    .map((record) => Object.freeze({ ...record, days: Object.freeze([...record.days].sort((a, b) => a.date.localeCompare(b.date))), totals: sumDays(record.days) }))
    .sort((left, right) => left.memberName.localeCompare(right.memberName));
}

function toTimecardDay(date: string, row: DailyRow): MonthlyTimecardDay {
  const justified = row.isJustified && row.status === "ABSENT";
  return Object.freeze({
    date,
    status: justified ? "JUSTIFIED" : row.status,
    shiftName: row.shiftName,
    scheduledMinutes: row.hasShift ? scheduledMinutes(row.shiftStart, row.shiftEnd) : 0,
    actualMinutes: row.confirmedDurationMinutes,
    pairedSessionCount: row.pairedSessionCount,
    checkInAt: row.checkInAt?.toISOString() ?? null,
    checkOutAt: row.checkOutAt?.toISOString() ?? null,
    lateMinutes: row.lateMinutes ?? 0,
    earlyLeaveMinutes: row.earlyLeaveMinutes ?? 0,
    overtimeMinutes: row.overtimeMinutes ?? 0,
    missingPunch: row.warnings.includes("NO_CHECKOUT"),
    invalidPunch: row.warnings.includes("MULTIPLE_EVENTS"),
    justified,
    unscheduled: !row.hasShift,
  });
}

function sumDays(days: readonly MonthlyTimecardDay[]): MonthlyTimecardTotals {
  return Object.freeze(days.reduce((total, day) => {
    total.scheduledMinutes += day.scheduledMinutes;
    total.actualMinutes += day.actualMinutes;
    total.pairedSessionCount += day.pairedSessionCount;
    total.presentDays += day.status !== "ABSENT" && day.status !== "JUSTIFIED" ? 1 : 0;
    total.absentDays += day.status === "ABSENT" ? 1 : 0;
    total.justifiedDays += day.justified ? 1 : 0;
    total.lateMinutes += day.lateMinutes;
    total.earlyLeaveMinutes += day.earlyLeaveMinutes;
    total.overtimeMinutes += day.overtimeMinutes;
    total.missingPunchDays += day.missingPunch ? 1 : 0;
    total.invalidPunchDays += day.invalidPunch ? 1 : 0;
    total.unscheduledDays += day.unscheduled ? 1 : 0;
    return total;
  }, emptyTotals()));
}

function emptyTotals(): Mutable<MonthlyTimecardTotals> {
  return {
    scheduledMinutes: 0, actualMinutes: 0, pairedSessionCount: 0, presentDays: 0, absentDays: 0,
    justifiedDays: 0, lateMinutes: 0, earlyLeaveMinutes: 0, overtimeMinutes: 0,
    missingPunchDays: 0, invalidPunchDays: 0, unscheduledDays: 0,
  };
}

function datesInMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(month);
  if (!match) throw new HttpError(400, "Use YYYY-MM", { month });
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`);
}

function scheduledMinutes(start: string, end: string) {
  const parse = (value: string) => {
    const [hours = "0", minutes = "0"] = value.split(":");
    return Number(hours) * 60 + Number(minutes);
  };
  const startMinutes = parse(start);
  const endMinutes = parse(end);
  return endMinutes > startMinutes ? endMinutes - startMinutes : 24 * 60 - startMinutes + endMinutes;
}

type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
