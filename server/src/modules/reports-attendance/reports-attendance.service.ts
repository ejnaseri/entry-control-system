import { AdminRole, AttendanceSource, AttendanceType, AuditActor, MemberType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildSimplePdf as buildReportSimplePdf } from "../reports/shared/report-export.utils";
import {
  normalizeAttendanceReportFilters,
  type AttendanceReportCsvExportQueryInput,
  type AttendanceClientCsvAuditInput,
  type AttendanceReportDailyQueryInput,
  type AttendanceReportEvidenceQueryInput,
  type AttendanceReportExportQueryInput,
  type AttendanceReportFilters,
  type AttendanceReportFiltersInput,
  type AttendanceReportMembersQueryInput,
  type AttendanceReportSummaryQueryInput,
} from "./reports-attendance.schemas";
import {
  buildStrictStaffMemberWhere,
  isStrictStaffAttendanceScope,
  type AttendanceDataScope,
} from "../attendance/attendance-edition-scope";
import { ATTENDANCE_EXPORT_BRAND, ATTENDANCE_EXPORT_FILENAME_PREFIX } from "./attendance-export.brand";

export type AttendanceReportExportContext = {
  actor: { id: string; role: AdminRole; sessionId?: string };
  meta: { ipAddress?: string; userAgent?: string };
};

type AttendanceExportFile = {
  buffer: Buffer;
  filename: string;
  contentType: string;
  rowCount: number;
};

const SHIFT_MATCH_BUFFER_MINUTES = 120;
const EVIDENCE_EXPORT_BATCH_SIZE = 2000;
const EVIDENCE_EXPORT_MAX_ROWS = 50000;
const ATTENDANCE_ANALYTICS_CACHE_TTL_MS = Number(process.env["ATTENDANCE_ANALYTICS_CACHE_TTL_MS"] ?? 90_000);
const ATTENDANCE_ANALYTICS_CACHE_MAX_ENTRIES = Number(process.env["ATTENDANCE_ANALYTICS_CACHE_MAX_ENTRIES"] ?? 40);

type ReportPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AttendanceReportKpis = {
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceReportSummaryResponse = {
  range: { from: string; to: string };
  kpis: AttendanceReportKpis;
};

export type AttendanceReportDailyItem = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceReportDailyResponse = {
  items: AttendanceReportDailyItem[];
  pageInfo: ReportPageInfo;
};

export type AttendanceReportMemberItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER";
  expectedShifts: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceReportMembersResponse = {
  items: AttendanceReportMemberItem[];
  pageInfo: ReportPageInfo;
};

export type AttendanceReportEvidenceItem = {
  id: string;
  timestamp: string;
  memberId: string | null;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER" | "UNKNOWN";
  eventType: "IN" | "OUT" | "DENIED";
  deviceId: string | null;
  deviceName: string | null;
  source: AttendanceSource;
  authorized: boolean;
  result: "authorized" | "denied";
  denyReason: string | null;
  notes: string | null;
};

export type AttendanceReportEvidenceResponse = {
  items: AttendanceReportEvidenceItem[];
  pageInfo: ReportPageInfo;
};

export type AttendanceReportMembersAllQueryInput = Omit<AttendanceReportMembersQueryInput, "page" | "pageSize">;

type ReportMember = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  memberType: "STAFF" | "CUSTOMER";
  isStaff: boolean;
  staffGroupId: string | null;
  staffGroupName: string | null;
};

type ReportShift = {
  id: string;
  memberId: string;
  shiftId: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
};

type ReportLog = Prisma.AttendanceLogGetPayload<{
  include: {
    member: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
        memberType: true;
        isStaff: true;
      };
    };
    deviceUser: {
      select: {
        deviceId: true;
      };
    };
  };
}>;

type AnalyticsLog = Prisma.AttendanceLogGetPayload<{
  select: {
    id: true;
    memberId: true;
    entryType: true;
    recordedAt: true;
    isAuthorized: true;
  };
}>;

type AttendanceMetricsStatus = "ABSENT" | "LATE" | "PRESENT" | "INSIDE";
type AttendanceWarning = "NO_CHECKOUT" | "NO_SHIFT" | "MULTIPLE_EVENTS";

type AttendanceMetrics = {
  status: AttendanceMetricsStatus;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  overtimeMinutes: number | null;
  lastEventType: AttendanceType | null;
  hasUnpairedIn: boolean;
  hasUnpairedOut: boolean;
};

type MemberDayStats = {
  memberId: string;
  expectedShifts: number;
  presentDay: boolean;
  absentShiftCount: number;
  justifiedAbsentShifts: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  unscheduledPresent: boolean;
  deniedCount: number;
  noCheckout: boolean;
  hasAnomaly: boolean;
  anomalyLogIds: Set<string>;
};

type MemberRoll = {
  member: ReportMember;
  expectedShifts: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
  hasAnomaly: boolean;
};

type AttendanceAnalyticsResult = {
  memberMap: Map<string, ReportMember>;
  memberIds: string[];
  dailyItems: AttendanceReportDailyItem[];
  memberItems: AttendanceReportMemberItem[];
  kpis: AttendanceReportKpis;
  anomalyEvidenceLogIds: Set<string>;
};

type AttendanceAnalyticsCacheEntry = {
  value: AttendanceAnalyticsResult;
  expiresAt: number;
};

type ScopedAttendanceReportFilters = AttendanceReportFilters & {
  attendanceDataScope: AttendanceDataScope;
};

const attendanceAnalyticsCache = new Map<string, AttendanceAnalyticsCacheEntry>();
const attendanceAnalyticsInFlight = new Map<string, Promise<AttendanceAnalyticsResult>>();

function normalizeScopedAttendanceReportFilters(
  input: AttendanceReportFiltersInput,
  scope: AttendanceDataScope
): ScopedAttendanceReportFilters {
  const filters = normalizeAttendanceReportFilters(input);
  return {
    ...filters,
    ...(isStrictStaffAttendanceScope(scope) ? { memberType: "staff" as const } : {}),
    attendanceDataScope: scope,
  };
}

export async function getAttendanceReportSummary(
  query: AttendanceReportSummaryQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportSummaryResponse> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  return {
    range: {
      from: formatDateKey(filters.fromDate),
      to: formatDateKey(filters.toDate),
    },
    kpis: analytics.kpis,
  };
}

export async function getAttendanceReportDaily(
  query: AttendanceReportDailyQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportDailyResponse> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  const paged = paginateArray(analytics.dailyItems, query.page, query.pageSize);
  return {
    items: paged.items,
    pageInfo: paged.pageInfo,
  };
}

export async function getAttendanceReportMembers(
  query: AttendanceReportMembersQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportMembersResponse> {
  const sorted = await getSortedMemberItems({
    from: query.from,
    to: query.to,
    memberId: query.memberId,
    memberType: query.memberType,
    shiftMode: query.shiftMode,
    shiftId: query.shiftId,
    staffGroupId: query.staffGroupId,
    deviceId: query.deviceId,
    eventType: query.eventType,
    search: query.search,
    onlyAnomalies: query.onlyAnomalies,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  }, scope);
  const paged = paginateArray(sorted, query.page, query.pageSize);
  return {
    items: paged.items,
    pageInfo: paged.pageInfo,
  };
}

export async function getAttendanceReportMembersAll(
  query: AttendanceReportMembersAllQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportMemberItem[]> {
  return getSortedMemberItems(query, scope);
}

export async function getAttendanceReportEvidence(
  query: AttendanceReportEvidenceQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportEvidenceResponse> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const members = await loadFilteredMembers(filters);
  const memberIds = members.map((member) => member.id);
  if (!memberIds.length) {
    return {
      items: [],
      pageInfo: buildPageInfo(query.page, query.pageSize, 0),
    };
  }

  let anomalyIds: Set<string> | null = null;
  if (filters.onlyAnomalies) {
    const analytics = await getAttendanceAnalyticsCached(filters);
    anomalyIds = analytics.anomalyEvidenceLogIds;
    if (!anomalyIds.size) {
      return {
        items: [],
        pageInfo: buildPageInfo(query.page, query.pageSize, 0),
      };
    }
  }

  const where = buildEvidenceWhere(filters, memberIds, anomalyIds);
  const skip = (query.page - 1) * query.pageSize;
  const [rows, totalItems] = await prisma.$transaction([
    prisma.attendanceLog.findMany({
      where,
      orderBy: { recordedAt: query.sortDir },
      skip,
      take: query.pageSize,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberType: true,
            isStaff: true,
          },
        },
        deviceUser: { select: { deviceId: true } },
      },
    }),
    prisma.attendanceLog.count({ where }),
  ]);

  const deviceMap = await loadDeviceMapFromLogs(rows);
  const items = rows.map((row) => formatEvidenceRow(row, deviceMap, filters.attendanceDataScope));

  return {
    items,
    pageInfo: buildPageInfo(query.page, query.pageSize, totalItems),
  };
}

export async function getAttendanceReportXlsxExport(
  query: AttendanceReportExportQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceExportFile> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  const membersByName = sortMemberItems(analytics.memberItems, "memberName", "asc");
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;

  const evidenceItems = query.includeEvidence
    ? await loadAllEvidenceForExport(filters, analytics.memberIds, filters.onlyAnomalies ? analytics.anomalyEvidenceLogIds : null)
    : [];

  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("presentDays"), analytics.kpis.presentDays],
    [t("absentDays"), analytics.kpis.absentDays],
    [t("lateCount"), analytics.kpis.lateCount],
    [t("lateMinutes"), analytics.kpis.lateMinutes],
    [t("earlyLeaveCount"), analytics.kpis.earlyLeaveCount],
    [t("earlyLeaveMinutes"), analytics.kpis.earlyLeaveMinutes],
    [t("overtimeMinutes"), analytics.kpis.overtimeMinutes],
    [t("justifiedDays"), analytics.kpis.justifiedCount],
    [t("unscheduledPresent"), analytics.kpis.unscheduledPresentCount],
    [t("deniedAttempts"), analytics.kpis.deniedCount],
    [t("noCheckoutCount"), analytics.kpis.noCheckoutCount],
    [t("dateFrom"), formatDateKey(filters.fromDate)],
    [t("dateTo"), formatDateKey(filters.toDate)],
  ];
  if (isStrictStaffAttendanceScope(scope)) {
    summaryRows.unshift([ATTENDANCE_EXPORT_BRAND], [t("dailySummary")], []);
  }

  const dailyRows: Array<Array<string | number>> = [
    [
      t("date"),
      t("present"),
      t("absentDays"),
      t("lateCount"),
      t("lateMin"),
      t("earlyLeave"),
      t("earlyMin"),
      t("overtimeMin"),
      t("justified"),
      t("unscheduled"),
      t("denied"),
      t("noCheckout"),
    ],
    ...analytics.dailyItems.map((item) => [
      item.date,
      item.presentCount,
      item.absentCount,
      item.lateCount,
      item.lateMinutes,
      item.earlyLeaveCount,
      item.earlyLeaveMinutes,
      item.overtimeMinutes,
      item.justifiedCount,
      item.unscheduledPresentCount,
      item.deniedCount,
      item.noCheckoutCount,
    ]),
  ];

  const memberRows: Array<Array<string | number>> = [
    [
      t("memberCode"),
      t("member"),
      t("memberType"),
      t("expectedShifts"),
      t("present"),
      t("absentDays"),
      t("lateCount"),
      t("lateMin"),
      t("earlyCount"),
      t("earlyMin"),
      t("overtimeMin"),
      t("justified"),
      t("unscheduled"),
      t("denied"),
      t("noCheckout"),
    ],
    ...membersByName.map((item) => [
      item.memberCode,
      item.memberName,
      labels.memberType(item.memberType),
      item.expectedShifts,
      item.presentDays,
      item.absentDays,
      item.lateCount,
      item.lateMinutes,
      item.earlyLeaveCount,
      item.earlyLeaveMinutes,
      item.overtimeMinutes,
      item.justifiedCount,
      item.unscheduledPresentCount,
      item.deniedCount,
      item.noCheckoutCount,
    ]),
  ];

  const evidenceRows: Array<Array<string | number>> = [
    [t("timestamp"), t("member"), t("type"), t("event"), t("device"), t("source"), t("result"), t("reason"), t("notes")],
    ...evidenceItems.map((item) => [
      item.timestamp,
      item.memberName,
      labels.memberType(item.memberType),
      labels.attendanceEvent(item.eventType),
      item.deviceName ?? "-",
      labels.attendanceSource(item.source),
      labels.attendanceResult(item.result),
      item.denyReason ?? "",
      item.notes ?? "",
    ]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summaryKpi"), rows: summaryRows },
    { name: t("daily"), rows: dailyRows },
    { name: t("members"), rows: memberRows },
    { name: t("evidence"), rows: evidenceRows },
  ]);

  return {
    buffer,
    filename: `${isStrictStaffAttendanceScope(scope) ? `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-` : ""}attendance-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: analytics.dailyItems.length + membersByName.length + evidenceItems.length,
  };
}

export async function getAttendanceReportPdfExport(
  query: AttendanceReportExportQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceExportFile> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const topLateMembers = [...analytics.memberItems]
    .sort((left, right) => right.lateMinutes - left.lateMinutes)
    .slice(0, 20);

  const lines: string[] = [];
  lines.push(isStrictStaffAttendanceScope(scope) ? ATTENDANCE_EXPORT_BRAND : "AtlasGym");
  lines.push(t("attendanceCountsNote"));
  lines.push(`${t("range")}: ${formatDateKey(filters.fromDate)} ${t("to")} ${formatDateKey(filters.toDate)}`);
  lines.push("");
  lines.push(`${t("filters")}:`);
  lines.push(`${t("memberType")}: ${labels.memberType(filters.memberType.toUpperCase())}`);
  lines.push(`${t("shiftMode")}: ${labels.attendanceShiftMode(filters.shiftMode)}`);
  lines.push(`${t("shiftId")}: ${filters.shiftId ?? "-"}`);
  lines.push(`${t("staffGroupId")}: ${filters.staffGroupId ?? "-"}`);
  lines.push(`${t("deviceId")}: ${filters.deviceId ?? "-"}`);
  lines.push(`${t("eventType")}: ${labels.attendanceEventFilter(filters.eventType)}`);
  lines.push(`${t("search")}: ${filters.search ?? "-"}`);
  lines.push(`${t("onlyAnomalies")}: ${labels.yesNo(filters.onlyAnomalies)}`);
  lines.push("");
  lines.push(`${t("summaryKpi")}:`);
  lines.push(`${t("presentDays")}: ${analytics.kpis.presentDays}`);
  lines.push(`${t("absentDays")}: ${analytics.kpis.absentDays}`);
  lines.push(`${t("lateCount")}/${t("lateMinutes")}: ${analytics.kpis.lateCount} / ${analytics.kpis.lateMinutes}`);
  lines.push(`${t("earlyLeaveCount")}/${t("earlyLeaveMinutes")}: ${analytics.kpis.earlyLeaveCount} / ${analytics.kpis.earlyLeaveMinutes}`);
  lines.push(`${t("overtimeMinutes")}: ${analytics.kpis.overtimeMinutes}`);
  lines.push(`${t("justifiedDays")}: ${analytics.kpis.justifiedCount}`);
  lines.push(`${t("unscheduledPresent")}: ${analytics.kpis.unscheduledPresentCount}`);
  lines.push(`${t("deniedAttempts")}: ${analytics.kpis.deniedCount}`);
  lines.push(`${t("noCheckoutCount")}: ${analytics.kpis.noCheckoutCount}`);
  lines.push("");
  lines.push(`${t("dailySummary")}:`);
  analytics.dailyItems.forEach((item) => {
    lines.push(
      `${item.date} | ${t("present")}:${item.presentCount} ${t("absentDays")}:${item.absentCount} ${t("lateMinShort")}:${item.lateCount} ${t("earlyLeave")}:${item.earlyLeaveCount} ${t("overtime")} ${item.overtimeMinutes} ${t("denied")}:${item.deniedCount}`
    );
  });
  lines.push("");
  lines.push(`${t("topLateMembers")}:`);
  if (!topLateMembers.length) {
    lines.push(t("noMembers"));
  } else {
    topLateMembers.forEach((member, index) => {
      lines.push(
        `${index + 1}. ${member.memberName} (#${member.memberCode}) ${t("lateMin")}: ${member.lateMinutes}, ${t("denied")}: ${member.deniedCount}`
      );
    });
  }
  lines.push("");
  lines.push(`${t("notes")}:`);
  lines.push(t("attendanceCountsNote"));

  const buffer = await buildReportSimplePdf(lines, t("dailySummary"));
  return {
    buffer,
    filename: `${isStrictStaffAttendanceScope(scope) ? `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-` : ""}attendance-report-${buildFilenameStamp(new Date())}.pdf`,
    contentType: "application/pdf",
    rowCount: analytics.dailyItems.length + topLateMembers.length,
  };
}

export async function getAttendanceReportCsvExport(
  query: AttendanceReportCsvExportQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceExportFile> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  let headers: string[];
  let rows: Array<Array<string | number>>;

  if (query.variant === "daily") {
    headers = [
      t("date"), t("present"), t("absentDays"), t("lateCount"), t("lateMin"),
      t("earlyLeave"), t("earlyMin"), t("overtimeMin"), t("justified"),
      t("unscheduled"), t("denied"), t("noCheckout"),
    ];
    rows = analytics.dailyItems.map((item) => [
      item.date, item.presentCount, item.absentCount, item.lateCount, item.lateMinutes,
      item.earlyLeaveCount, item.earlyLeaveMinutes, item.overtimeMinutes,
      item.justifiedCount, item.unscheduledPresentCount, item.deniedCount, item.noCheckoutCount,
    ]);
  } else if (query.variant === "members") {
    const members = sortMemberItems(analytics.memberItems, query.sortBy, query.sortDir);
    headers = [
      t("memberCode"), t("member"), t("memberType"), t("expectedShifts"), t("present"),
      t("absentDays"), t("lateCount"), t("lateMin"), t("earlyCount"), t("earlyMin"),
      t("overtimeMin"), t("justified"), t("unscheduled"), t("denied"), t("noCheckout"),
    ];
    rows = members.map((item) => [
      item.memberCode, item.memberName, labels.memberType(item.memberType), item.expectedShifts,
      item.presentDays, item.absentDays, item.lateCount, item.lateMinutes,
      item.earlyLeaveCount, item.earlyLeaveMinutes, item.overtimeMinutes,
      item.justifiedCount, item.unscheduledPresentCount, item.deniedCount, item.noCheckoutCount,
    ]);
  } else {
    const evidence = await loadAllEvidenceForExport(
      filters,
      analytics.memberIds,
      filters.onlyAnomalies ? analytics.anomalyEvidenceLogIds : null
    );
    headers = [t("timestamp"), t("member"), t("type"), t("event"), t("device"), t("source"), t("result"), t("reason"), t("notes")];
    rows = evidence.map((item) => [
      item.timestamp, item.memberName, labels.memberType(item.memberType),
      labels.attendanceEvent(item.eventType), item.deviceName ?? "-",
      labels.attendanceSource(item.source), labels.attendanceResult(item.result),
      item.denyReason ?? "", item.notes ?? "",
    ]);
  }

  return {
    buffer: Buffer.from(`\uFEFF${buildCsv(headers, rows)}`, "utf8"),
    filename: `${isStrictStaffAttendanceScope(scope) ? `${ATTENDANCE_EXPORT_FILENAME_PREFIX}-` : ""}attendance-${query.variant}-${buildFilenameStamp(new Date())}.csv`,
    contentType: "text/csv; charset=utf-8",
    rowCount: rows.length,
  };
}

export async function getAuditedAttendanceReportExport(
  query: AttendanceReportExportQueryInput | AttendanceReportCsvExportQueryInput,
  format: "CSV" | "XLSX" | "PDF",
  context: AttendanceReportExportContext,
  scope: AttendanceDataScope
): Promise<AttendanceExportFile> {
  const variant = "variant" in query ? query.variant : "attendance";
  const action =
    variant === "daily"
      ? "report.daily_attendance.exported"
      : variant === "evidence"
        ? "report.entry_logs.exported"
        : "report.attendance.exported";
  const targetType =
    variant === "daily" ? "DailyAttendanceReport" : variant === "evidence" ? "EntryLogsReport" : "AttendanceReport";

  let file: AttendanceExportFile;
  try {
    file =
      format === "CSV"
        ? await getAttendanceReportCsvExport(query as AttendanceReportCsvExportQueryInput, scope)
        : format === "XLSX"
          ? await getAttendanceReportXlsxExport(query as AttendanceReportExportQueryInput, scope)
          : await getAttendanceReportPdfExport(query as AttendanceReportExportQueryInput, scope);
  } catch (error) {
    await prisma.auditLog.create({
      data: buildAttendanceExportAuditData(context, action, targetType, false, {
        format,
        rowCount: 0,
        outcome: "GENERATION_FAILED",
        variant,
        filters: toSafeAttendanceExportFilters(query, scope),
      }),
    });
    throw error;
  }

  await prisma.auditLog.create({
    data: buildAttendanceExportAuditData(context, action, targetType, true, {
      format,
      rowCount: file.rowCount,
      outcome: "EXPORTED",
      variant,
      filters: toSafeAttendanceExportFilters(query, scope),
    }),
  });
  return file;
}

function buildAttendanceExportAuditData(
  context: AttendanceReportExportContext,
  action: string,
  targetType: string,
  success: boolean,
  metadata: Prisma.InputJsonObject
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action,
    targetType,
    targetId: targetType === "AttendanceReport" ? "attendance-report" : targetType === "DailyAttendanceReport" ? "daily-attendance-report" : "entry-logs-report",
    success,
    metadata,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  return data;
}

function toSafeAttendanceExportFilters(
  query: AttendanceReportExportQueryInput | AttendanceReportCsvExportQueryInput,
  scope: AttendanceDataScope
): Prisma.InputJsonObject {
  return {
    from: query.from,
    to: query.to,
    memberId: query.memberId ?? "",
    memberType: isStrictStaffAttendanceScope(scope) ? "staff" : query.memberType,
    shiftMode: query.shiftMode,
    shiftId: query.shiftId ?? "",
    staffGroupId: query.staffGroupId ?? "",
    deviceId: query.deviceId ?? "",
    eventType: query.eventType,
    onlyAnomalies: query.onlyAnomalies,
    searchApplied: Boolean(query.search?.trim()),
    language: query.lang,
  };
}

export async function recordAttendanceClientCsvExport(
  input: AttendanceClientCsvAuditInput,
  context: AttendanceReportExportContext,
  scope: AttendanceDataScope
) {
  const daily = input.variant === "daily-attendance";
  await prisma.auditLog.create({
    data: buildAttendanceExportAuditData(
      context,
      daily ? "report.daily_attendance.exported" : "report.entry_logs.exported",
      daily ? "DailyAttendanceReport" : "EntryLogsReport",
      true,
      {
        format: "CSV",
        rowCount: input.rowCount,
        outcome: "EXPORTED",
        variant: input.variant,
        language: input.lang,
        filters: {
          ...input.filters,
          ...(isStrictStaffAttendanceScope(scope) ? { memberType: "staff" } : {}),
        },
        generation: "CLIENT",
      }
    ),
  });
  return { recorded: true };
}

async function buildAttendanceAnalytics(filters: ScopedAttendanceReportFilters): Promise<AttendanceAnalyticsResult> {
  const members = await loadFilteredMembers(filters);
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const memberIds = members.map((member) => member.id);

  if (!memberIds.length) {
    return {
      memberMap,
      memberIds: [],
      dailyItems: [],
      memberItems: [],
      kpis: createEmptyKpis(),
      anomalyEvidenceLogIds: new Set<string>(),
    };
  }

  const staffMemberIds = members.filter((member) => member.memberType === "STAFF").map((member) => member.id);
  const shifts =
    filters.shiftMode === "ignoreShifts" || !staffMemberIds.length
      ? []
      : await loadMemberShifts(filters, staffMemberIds);

  const hasCrossMidnightShift = shifts.some((shift) => isCrossMidnight(shift.shiftStart, shift.shiftEnd));
  const logWindowEnd = hasCrossMidnightShift ? addDays(filters.toExclusive, 1) : filters.toExclusive;

  const logs = await loadAnalyticsLogs(filters, memberIds, logWindowEnd);
  const authorizedLogs = logs.filter((log) => log.isAuthorized);
  const deniedLogs = logs.filter((log) => !log.isAuthorized);
  const authorizedLogsByMember = groupLogsByMember(authorizedLogs);
  const authorizedLogsByDay = groupLogsByDay(authorizedLogs);
  const deniedLogsByDay = groupLogsByDay(deniedLogs);

  const justifications = staffMemberIds.length
    ? await prisma.attendanceJustification.findMany({
        where: {
          memberId: { in: staffMemberIds },
          date: { gte: filters.fromDate, lt: filters.toExclusive },
          ...(isStrictStaffAttendanceScope(filters.attendanceDataScope)
            ? { member: buildStrictStaffMemberWhere() }
            : {}),
        },
        select: { memberId: true, date: true },
      })
    : [];
  const justificationSet = new Set(justifications.map((row) => `${row.memberId}|${formatDateKey(row.date)}`));

  const dailyItems: AttendanceReportDailyItem[] = [];
  const rollMap = new Map<string, MemberRoll>();
  const anomalyEvidenceLogIds = new Set<string>();

  for (let dayOffset = 0; dayOffset < filters.dayCount; dayOffset += 1) {
    const dayStart = addDays(filters.fromDate, dayOffset);
    const dayEnd = addDays(dayStart, 1);
    const dateKey = formatDateKey(dayStart);
    const weekday = toScheduleWeekday(dayStart);
    const dayStatsMap = new Map<string, MemberDayStats>();

    const shiftsForDay = selectShiftsForDay(shifts, weekday, filters.shiftMode, filters.shiftId);
    const expectedMemberIds = new Set<string>(shiftsForDay.map((shift) => shift.memberId));

    shiftsForDay.forEach((shift) => {
      if (!memberMap.has(shift.memberId)) return;
      const key = `${shift.memberId}|${dateKey}`;
      const isJustified = justificationSet.has(key);
      const memberLogs = authorizedLogsByMember.get(shift.memberId) ?? [];
      const shiftLogs = filterLogsForShift(memberLogs, shift, dayStart);
      const metrics = computeAttendanceMetrics({
        logs: shiftLogs,
        dayStart,
        hasShift: true,
        shiftStart: shift.shiftStart,
        shiftEnd: shift.shiftEnd,
        graceMinutes: shift.graceMinutes,
      });
      const warnings = buildWarnings({
        logs: shiftLogs,
        hasShift: true,
        checkInAt: metrics.checkInAt,
        checkOutAt: metrics.checkOutAt,
        lastEventType: metrics.lastEventType,
        hasUnpairedIn: metrics.hasUnpairedIn,
        hasUnpairedOut: metrics.hasUnpairedOut,
      });

      const dayStats = getOrCreateMemberDayStats(dayStatsMap, shift.memberId);
      dayStats.expectedShifts += 1;
      if (metrics.status === "ABSENT") {
        if (isJustified) {
          dayStats.justifiedAbsentShifts += 1;
        } else {
          dayStats.absentShiftCount += 1;
        }
      } else {
        dayStats.presentDay = true;
      }

      if ((metrics.lateMinutes ?? 0) > 0) {
        dayStats.lateCount += 1;
        dayStats.lateMinutes += metrics.lateMinutes ?? 0;
      }
      if ((metrics.earlyLeaveMinutes ?? 0) > 0) {
        dayStats.earlyLeaveCount += 1;
        dayStats.earlyLeaveMinutes += metrics.earlyLeaveMinutes ?? 0;
      }
      if ((metrics.overtimeMinutes ?? 0) > 0) {
        dayStats.overtimeMinutes += metrics.overtimeMinutes ?? 0;
      }
      if (warnings.includes("NO_CHECKOUT")) {
        dayStats.noCheckout = true;
      }

      const rowIsAnomaly = isExpectedRowAnomaly(metrics, warnings, isJustified);
      if (rowIsAnomaly) {
        dayStats.hasAnomaly = true;
        shiftLogs.forEach((log) => dayStats.anomalyLogIds.add(log.id));
      }
    });

    const logsForDay = (authorizedLogsByDay.get(dateKey) ?? []).filter(
      (log) => log.recordedAt >= dayStart && log.recordedAt < dayEnd
    );
    const logsByMemberForDay = groupLogsByMember(logsForDay);
    logsByMemberForDay.forEach((memberLogs, memberId) => {
      if (!memberMap.has(memberId) || expectedMemberIds.has(memberId) || memberLogs.length === 0) return;
      const metrics = computeAttendanceMetrics({
        logs: memberLogs,
        dayStart,
        hasShift: false,
      });
      const warnings = buildWarnings({
        logs: memberLogs,
        hasShift: false,
        checkInAt: metrics.checkInAt,
        checkOutAt: metrics.checkOutAt,
        lastEventType: metrics.lastEventType,
        hasUnpairedIn: metrics.hasUnpairedIn,
        hasUnpairedOut: metrics.hasUnpairedOut,
      });
      const dayStats = getOrCreateMemberDayStats(dayStatsMap, memberId);
      const unscheduledPresent = metrics.status !== "ABSENT" || Boolean(metrics.checkInAt);
      if (unscheduledPresent) {
        dayStats.presentDay = true;
        dayStats.unscheduledPresent = true;
      }
      if (warnings.includes("NO_CHECKOUT")) {
        dayStats.noCheckout = true;
      }
      dayStats.hasAnomaly = true;
      memberLogs.forEach((log) => dayStats.anomalyLogIds.add(log.id));
    });

    const deniedForDay = (deniedLogsByDay.get(dateKey) ?? []).filter(
      (log) => log.recordedAt >= dayStart && log.recordedAt < dayEnd
    );
    deniedForDay.forEach((log) => {
      if (!log.memberId || !memberMap.has(log.memberId)) return;
      const dayStats = getOrCreateMemberDayStats(dayStatsMap, log.memberId);
      dayStats.deniedCount += 1;
      dayStats.hasAnomaly = true;
      dayStats.anomalyLogIds.add(log.id);
    });

    const dailyItem = buildDailyItem(dateKey, dayStatsMap, deniedForDay.length);
    const includeDay = !filters.onlyAnomalies || isDailyAnomaly(dailyItem);
    if (!includeDay) continue;

    dailyItems.push(dailyItem);
    dayStatsMap.forEach((dayStats, memberId) => {
      const member = memberMap.get(memberId);
      if (!member) return;
      const roll = getOrCreateMemberRoll(rollMap, member);
      mergeMemberDayToRoll(roll, dayStats);
      if (dayStats.hasAnomaly) {
        dayStats.anomalyLogIds.forEach((id) => anomalyEvidenceLogIds.add(id));
      }
    });
  }

  const memberItems = Array.from(rollMap.values())
    .filter((roll) => {
      if (filters.onlyAnomalies) return roll.hasAnomaly;
      return (
        roll.expectedShifts > 0 ||
        roll.presentDays > 0 ||
        roll.absentDays > 0 ||
        roll.deniedCount > 0 ||
        roll.unscheduledPresentCount > 0
      );
    })
    .map((roll) => ({
      memberId: roll.member.id,
      memberCode: roll.member.code,
      memberName: formatMemberName(roll.member.firstName, roll.member.lastName),
      memberType: roll.member.memberType,
      expectedShifts: roll.expectedShifts,
      presentDays: roll.presentDays,
      absentDays: roll.absentDays,
      lateCount: roll.lateCount,
      lateMinutes: roll.lateMinutes,
      earlyLeaveCount: roll.earlyLeaveCount,
      earlyLeaveMinutes: roll.earlyLeaveMinutes,
      overtimeMinutes: roll.overtimeMinutes,
      justifiedCount: roll.justifiedCount,
      unscheduledPresentCount: roll.unscheduledPresentCount,
      deniedCount: roll.deniedCount,
      noCheckoutCount: roll.noCheckoutCount,
    }));

  const kpis = dailyItems.reduce<AttendanceReportKpis>(
    (acc, item) => {
      acc.presentDays += item.presentCount;
      acc.absentDays += item.absentCount;
      acc.lateCount += item.lateCount;
      acc.lateMinutes += item.lateMinutes;
      acc.earlyLeaveCount += item.earlyLeaveCount;
      acc.earlyLeaveMinutes += item.earlyLeaveMinutes;
      acc.overtimeMinutes += item.overtimeMinutes;
      acc.justifiedCount += item.justifiedCount;
      acc.unscheduledPresentCount += item.unscheduledPresentCount;
      acc.deniedCount += item.deniedCount;
      acc.noCheckoutCount += item.noCheckoutCount;
      return acc;
    },
    createEmptyKpis()
  );

  return {
    memberMap,
    memberIds,
    dailyItems,
    memberItems,
    kpis,
    anomalyEvidenceLogIds,
  };
}

async function getSortedMemberItems(
  query: AttendanceReportMembersAllQueryInput,
  scope: AttendanceDataScope
): Promise<AttendanceReportMemberItem[]> {
  const filters = normalizeScopedAttendanceReportFilters(query, scope);
  const analytics = await getAttendanceAnalyticsCached(filters);
  return sortMemberItems(analytics.memberItems, query.sortBy, query.sortDir);
}

function buildAttendanceAnalyticsCacheKey(filters: ScopedAttendanceReportFilters) {
  return JSON.stringify({
    attendanceDataScope: filters.attendanceDataScope,
    from: formatDateKey(filters.fromDate),
    to: formatDateKey(filters.toDate),
    memberId: filters.memberId ?? null,
    memberType: filters.memberType,
    shiftMode: filters.shiftMode,
    shiftId: filters.shiftId ?? null,
    staffGroupId: filters.staffGroupId ?? null,
    deviceId: filters.deviceId ?? null,
    eventType: filters.eventType,
    search: filters.search?.trim().toLowerCase() ?? "",
    onlyAnomalies: filters.onlyAnomalies,
  });
}

function trimAttendanceAnalyticsCache(now: number) {
  for (const [key, entry] of attendanceAnalyticsCache.entries()) {
    if (entry.expiresAt <= now) {
      attendanceAnalyticsCache.delete(key);
    }
  }
  while (attendanceAnalyticsCache.size > ATTENDANCE_ANALYTICS_CACHE_MAX_ENTRIES) {
    const oldestKey = attendanceAnalyticsCache.keys().next().value;
    if (!oldestKey) break;
    attendanceAnalyticsCache.delete(oldestKey);
  }
}

async function getAttendanceAnalyticsCached(filters: ScopedAttendanceReportFilters): Promise<AttendanceAnalyticsResult> {
  // Staff classification is mutable legacy data. Reusing a prior strict result could
  // expose a member after it has been reclassified as Customer or marker-mismatched.
  if (isStrictStaffAttendanceScope(filters.attendanceDataScope)) {
    return buildAttendanceAnalytics(filters);
  }

  const key = buildAttendanceAnalyticsCacheKey(filters);
  const now = Date.now();
  const cached = attendanceAnalyticsCache.get(key);
  if (cached && cached.expiresAt > now) {
    // Touch entry to keep recently-used keys longer when trimming.
    attendanceAnalyticsCache.delete(key);
    attendanceAnalyticsCache.set(key, cached);
    return cached.value;
  }
  if (cached) {
    attendanceAnalyticsCache.delete(key);
  }

  const inFlight = attendanceAnalyticsInFlight.get(key);
  if (inFlight) {
    return inFlight;
  }

  const pending = buildAttendanceAnalytics(filters)
    .then((result) => {
      attendanceAnalyticsCache.set(key, {
        value: result,
        expiresAt: Date.now() + ATTENDANCE_ANALYTICS_CACHE_TTL_MS,
      });
      trimAttendanceAnalyticsCache(Date.now());
      return result;
    })
    .finally(() => {
      attendanceAnalyticsInFlight.delete(key);
    });

  attendanceAnalyticsInFlight.set(key, pending);
  return pending;
}

async function loadFilteredMembers(filters: ScopedAttendanceReportFilters): Promise<ReportMember[]> {
  const where: Prisma.MemberWhereInput = {
    archivedAt: null,
    ...buildMemberTypeWhere(filters.memberType, filters.attendanceDataScope),
  };

  if (filters.memberId) {
    where.id = filters.memberId;
  }

  if (filters.staffGroupId) {
    where.staffGroupId = filters.staffGroupId;
  }

  const search = filters.search?.trim();
  if (search && isStrictStaffAttendanceScope(filters.attendanceDataScope)) {
    where.AND = [
      buildStrictStaffMemberWhere(),
      {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  } else if (search) {
    where.OR = [
      { code: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.member.findMany({
    where,
    select: {
      id: true,
      code: true,
      firstName: true,
      lastName: true,
      phone: true,
      memberType: true,
      isStaff: true,
      staffGroupId: true,
      staffGroup: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    firstName: row.firstName,
    lastName: row.lastName ?? null,
    phone: row.phone ?? null,
    memberType: isStrictStaffAttendanceScope(filters.attendanceDataScope)
      ? "STAFF"
      : row.memberType === MemberType.STAFF || row.isStaff
        ? "STAFF"
        : "CUSTOMER",
    isStaff: isStrictStaffAttendanceScope(filters.attendanceDataScope)
      ? true
      : row.memberType === MemberType.STAFF || row.isStaff,
    staffGroupId: row.staffGroupId ?? null,
    staffGroupName: row.staffGroup?.name ?? null,
  }));
}

function buildMemberTypeWhere(
  memberType: AttendanceReportFilters["memberType"],
  scope: AttendanceDataScope
): Prisma.MemberWhereInput {
  if (isStrictStaffAttendanceScope(scope)) {
    return buildStrictStaffMemberWhere();
  }
  if (memberType === "staff") {
    return { OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] };
  }
  if (memberType === "customer") {
    return { memberType: MemberType.CUSTOMER, isStaff: false };
  }
  return {};
}

async function loadMemberShifts(filters: ScopedAttendanceReportFilters, staffMemberIds: string[]): Promise<ReportShift[]> {
  if (!staffMemberIds.length) return [];
  const where: Prisma.MemberShiftWhereInput = {
    memberId: { in: staffMemberIds },
    isActive: true,
    ...(isStrictStaffAttendanceScope(filters.attendanceDataScope)
      ? { member: buildStrictStaffMemberWhere() }
      : {}),
  };
  if (filters.shiftId) {
    where.shiftId = filters.shiftId;
  }
  const rows = await prisma.memberShift.findMany({
    where,
    select: {
      id: true,
      memberId: true,
      shiftId: true,
      shiftName: true,
      shiftStart: true,
      shiftEnd: true,
      weekdays: true,
      graceMinutes: true,
    },
    orderBy: [{ shiftStart: "asc" }, { shiftName: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    memberId: row.memberId,
    shiftId: row.shiftId ?? null,
    shiftName: row.shiftName,
    shiftStart: row.shiftStart,
    shiftEnd: row.shiftEnd,
    weekdays: row.weekdays?.length ? row.weekdays : [0, 1, 2, 3, 4, 5, 6],
    graceMinutes: row.graceMinutes ?? 0,
  }));
}

async function loadAnalyticsLogs(
  filters: ScopedAttendanceReportFilters,
  memberIds: string[],
  toExclusive: Date
): Promise<AnalyticsLog[]> {
  const where: Prisma.AttendanceLogWhereInput = {
    memberId: { in: memberIds },
    recordedAt: { gte: filters.fromDate, lt: toExclusive },
    ...(isStrictStaffAttendanceScope(filters.attendanceDataScope)
      ? { member: buildStrictStaffMemberWhere() }
      : {}),
  };

  if (filters.deviceId) {
    where.deviceUser = { deviceId: filters.deviceId };
  }

  if (filters.eventType === "in") {
    where.isAuthorized = true;
    where.entryType = AttendanceType.IN;
  } else if (filters.eventType === "out") {
    where.isAuthorized = true;
    where.entryType = AttendanceType.OUT;
  } else if (filters.eventType === "denied") {
    where.isAuthorized = false;
  }

  return prisma.attendanceLog.findMany({
    where,
    orderBy: { recordedAt: "asc" },
    select: {
      id: true,
      memberId: true,
      entryType: true,
      recordedAt: true,
      isAuthorized: true,
    },
  });
}

function groupLogsByMember(logs: AnalyticsLog[]) {
  const map = new Map<string, AnalyticsLog[]>();
  logs.forEach((log) => {
    if (!log.memberId) return;
    const list = map.get(log.memberId) ?? [];
    list.push(log);
    map.set(log.memberId, list);
  });
  return map;
}

function groupLogsByDay(logs: AnalyticsLog[]) {
  const map = new Map<string, AnalyticsLog[]>();
  logs.forEach((log) => {
    const key = formatDateKey(log.recordedAt);
    const list = map.get(key) ?? [];
    list.push(log);
    map.set(key, list);
  });
  return map;
}

function selectShiftsForDay(
  shifts: ReportShift[],
  weekday: number,
  mode: AttendanceReportFilters["shiftMode"],
  shiftId?: string
) {
  const applicable = shifts.filter((shift) => shift.weekdays.includes(weekday));
  if (shiftId) return applicable.filter((shift) => shift.shiftId === shiftId);
  if (mode === "all") return applicable;
  if (mode === "ignoreShifts") return [];
  return selectPrimaryShift(applicable);
}

function selectPrimaryShift(shifts: ReportShift[]) {
  const byMember = new Map<string, ReportShift[]>();
  shifts.forEach((shift) => {
    const list = byMember.get(shift.memberId) ?? [];
    list.push(shift);
    byMember.set(shift.memberId, list);
  });
  const selected: ReportShift[] = [];
  byMember.forEach((memberShifts) => {
    const sorted = [...memberShifts].sort((left, right) => {
      const leftMinutes = timeToMinutes(left.shiftStart);
      const rightMinutes = timeToMinutes(right.shiftStart);
      if (leftMinutes === rightMinutes) return left.shiftName.localeCompare(right.shiftName);
      return leftMinutes - rightMinutes;
    });
    const first = sorted[0];
    if (first) selected.push(first);
  });
  return selected;
}

function filterLogsForShift(logs: AnalyticsLog[], shift: ReportShift, dayStart: Date) {
  if (!logs.length) return [];
  const window = computeShiftWindow(dayStart, shift.shiftStart, shift.shiftEnd);
  const windowStart = addMinutes(window.startAt, -SHIFT_MATCH_BUFFER_MINUTES);
  const windowEnd = addMinutes(window.endAt, SHIFT_MATCH_BUFFER_MINUTES);
  const inWindowLogs = logs.filter((log) => log.recordedAt >= windowStart && log.recordedAt <= windowEnd);
  if (!computeSessionDuration(inWindowLogs).hasOpenSession) {
    return inWindowLogs;
  }

  const closingOut = logs.find((log) => log.recordedAt > windowEnd && log.entryType === AttendanceType.OUT);
  return closingOut ? [...inWindowLogs, closingOut] : inWindowLogs;
}

function computeAttendanceMetrics(params: {
  logs: AnalyticsLog[];
  dayStart: Date;
  hasShift: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  graceMinutes?: number;
}): AttendanceMetrics {
  const { logs, dayStart, hasShift, shiftStart, shiftEnd, graceMinutes = 0 } = params;
  const checkInAt = logs.find((log) => log.entryType === AttendanceType.IN)?.recordedAt ?? null;
  const checkOutAt = [...logs].reverse().find((log) => log.entryType === AttendanceType.OUT)?.recordedAt ?? null;
  const lastEventType = logs.at(-1)?.entryType ?? null;
  const inside = Boolean(checkInAt && (!checkOutAt || lastEventType === AttendanceType.IN));
  const duration = computeSessionDuration(logs);

  let lateMinutes: number | null = null;
  let earlyLeaveMinutes: number | null = null;
  let overtimeMinutes: number | null = null;

  if (hasShift && shiftStart && shiftEnd) {
    const window = computeShiftWindow(dayStart, shiftStart, shiftEnd);
    if (checkInAt) {
      const lateThreshold = addMinutes(window.startAt, graceMinutes);
      lateMinutes = Math.max(0, minutesBetween(checkInAt, lateThreshold));
    }
    if (checkOutAt) {
      earlyLeaveMinutes = checkOutAt < window.endAt ? Math.max(0, minutesBetween(window.endAt, checkOutAt)) : 0;
      overtimeMinutes = checkOutAt > window.endAt ? Math.max(0, minutesBetween(checkOutAt, window.endAt)) : 0;
    }
  }

  const status: AttendanceMetricsStatus = !checkInAt
    ? "ABSENT"
    : inside
      ? "INSIDE"
      : lateMinutes && lateMinutes > 0
        ? "LATE"
        : "PRESENT";

  return {
    status,
    checkInAt,
    checkOutAt,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    lastEventType,
    hasUnpairedIn: duration.hasUnpairedIn,
    hasUnpairedOut: duration.hasUnpairedOut,
  };
}

function buildWarnings(params: {
  logs: AnalyticsLog[];
  hasShift: boolean;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  lastEventType: AttendanceType | null;
  hasUnpairedIn: boolean;
  hasUnpairedOut: boolean;
}): AttendanceWarning[] {
  const { logs, hasShift, checkInAt, checkOutAt, lastEventType, hasUnpairedIn, hasUnpairedOut } = params;
  const warnings: AttendanceWarning[] = [];
  if (!hasShift) warnings.push("NO_SHIFT");
  if (checkInAt && (!checkOutAt || lastEventType === AttendanceType.IN)) warnings.push("NO_CHECKOUT");
  if (hasUnpairedIn && !warnings.includes("NO_CHECKOUT")) warnings.push("NO_CHECKOUT");
  if (hasUnpairedOut) warnings.push("MULTIPLE_EVENTS");
  if (hasMultipleEvents(logs)) warnings.push("MULTIPLE_EVENTS");
  return warnings;
}

function hasMultipleEvents(logs: AnalyticsLog[]) {
  if (logs.length <= 2) return false;
  let repeated = false;
  for (let i = 1; i < logs.length; i += 1) {
    const current = logs[i];
    const previous = logs[i - 1];
    if (!current || !previous) continue;
    if (current.entryType === previous.entryType) {
      repeated = true;
      break;
    }
  }
  const inCount = logs.filter((log) => log.entryType === AttendanceType.IN).length;
  const outCount = logs.filter((log) => log.entryType === AttendanceType.OUT).length;
  return repeated || inCount > 1 || outCount > 1;
}

function computeSessionDuration(logs: AnalyticsLog[]) {
  if (!logs.length) {
    return { hasUnpairedIn: false, hasUnpairedOut: false, hasOpenSession: false };
  }
  let currentIn: Date | null = null;
  let hasUnpairedIn = false;
  let hasUnpairedOut = false;

  logs.forEach((log) => {
    if (log.entryType === AttendanceType.IN) {
      if (currentIn) hasUnpairedIn = true;
      currentIn = log.recordedAt;
      return;
    }
    if (log.entryType === AttendanceType.OUT) {
      if (!currentIn) {
        hasUnpairedOut = true;
        return;
      }
      currentIn = null;
    }
  });

  if (currentIn) hasUnpairedIn = true;
  return { hasUnpairedIn, hasUnpairedOut, hasOpenSession: Boolean(currentIn) };
}

function isExpectedRowAnomaly(metrics: AttendanceMetrics, warnings: AttendanceWarning[], isJustified: boolean) {
  if (metrics.status === "ABSENT" && !isJustified) return true;
  if ((metrics.lateMinutes ?? 0) > 0) return true;
  if ((metrics.earlyLeaveMinutes ?? 0) > 0) return true;
  if (warnings.includes("NO_CHECKOUT")) return true;
  if (warnings.includes("MULTIPLE_EVENTS")) return true;
  return false;
}

function getOrCreateMemberDayStats(map: Map<string, MemberDayStats>, memberId: string): MemberDayStats {
  const existing = map.get(memberId);
  if (existing) return existing;
  const created: MemberDayStats = {
    memberId,
    expectedShifts: 0,
    presentDay: false,
    absentShiftCount: 0,
    justifiedAbsentShifts: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyLeaveCount: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    unscheduledPresent: false,
    deniedCount: 0,
    noCheckout: false,
    hasAnomaly: false,
    anomalyLogIds: new Set<string>(),
  };
  map.set(memberId, created);
  return created;
}

function buildDailyItem(
  date: string,
  dayStatsMap: Map<string, MemberDayStats>,
  deniedCount: number
): AttendanceReportDailyItem {
  const rows = Array.from(dayStatsMap.values());
  const presentCount = rows.filter((row) => row.presentDay).length;
  const absentCount = rows.filter((row) => isMemberDayAbsent(row)).length;
  const lateCount = rows.filter((row) => row.lateCount > 0).length;
  const lateMinutes = rows.reduce((sum, row) => sum + row.lateMinutes, 0);
  const earlyLeaveCount = rows.filter((row) => row.earlyLeaveCount > 0).length;
  const earlyLeaveMinutes = rows.reduce((sum, row) => sum + row.earlyLeaveMinutes, 0);
  const overtimeMinutes = rows.reduce((sum, row) => sum + row.overtimeMinutes, 0);
  const justifiedCount = rows.filter((row) => row.justifiedAbsentShifts > 0).length;
  const unscheduledPresentCount = rows.filter((row) => row.unscheduledPresent).length;
  const noCheckoutCount = rows.filter((row) => row.noCheckout).length;

  return {
    date,
    presentCount,
    absentCount,
    lateCount,
    lateMinutes,
    earlyLeaveCount,
    earlyLeaveMinutes,
    overtimeMinutes,
    justifiedCount,
    unscheduledPresentCount,
    deniedCount,
    noCheckoutCount,
  };
}

function isMemberDayAbsent(day: MemberDayStats) {
  if (!day.expectedShifts) return false;
  if (day.presentDay) return false;
  return day.absentShiftCount > 0;
}

function isDailyAnomaly(item: AttendanceReportDailyItem) {
  return (
    item.absentCount > 0 ||
    item.lateCount > 0 ||
    item.earlyLeaveCount > 0 ||
    item.unscheduledPresentCount > 0 ||
    item.deniedCount > 0 ||
    item.noCheckoutCount > 0
  );
}

function getOrCreateMemberRoll(map: Map<string, MemberRoll>, member: ReportMember): MemberRoll {
  const existing = map.get(member.id);
  if (existing) return existing;
  const created: MemberRoll = {
    member,
    expectedShifts: 0,
    presentDays: 0,
    absentDays: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyLeaveCount: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    justifiedCount: 0,
    unscheduledPresentCount: 0,
    deniedCount: 0,
    noCheckoutCount: 0,
    hasAnomaly: false,
  };
  map.set(member.id, created);
  return created;
}

function mergeMemberDayToRoll(roll: MemberRoll, day: MemberDayStats) {
  roll.expectedShifts += day.expectedShifts;
  if (day.presentDay) roll.presentDays += 1;
  if (isMemberDayAbsent(day)) roll.absentDays += 1;
  roll.lateCount += day.lateCount;
  roll.lateMinutes += day.lateMinutes;
  roll.earlyLeaveCount += day.earlyLeaveCount;
  roll.earlyLeaveMinutes += day.earlyLeaveMinutes;
  roll.overtimeMinutes += day.overtimeMinutes;
  if (day.justifiedAbsentShifts > 0) roll.justifiedCount += 1;
  if (day.unscheduledPresent) roll.unscheduledPresentCount += 1;
  roll.deniedCount += day.deniedCount;
  if (day.noCheckout) roll.noCheckoutCount += 1;
  const hasAnomaly =
    day.hasAnomaly ||
    day.deniedCount > 0 ||
    day.unscheduledPresent ||
    day.noCheckout ||
    day.lateCount > 0 ||
    day.earlyLeaveCount > 0 ||
    isMemberDayAbsent(day);
  if (hasAnomaly) roll.hasAnomaly = true;
}

function sortMemberItems(
  items: AttendanceReportMemberItem[],
  sortBy: AttendanceReportMembersQueryInput["sortBy"],
  sortDir: AttendanceReportMembersQueryInput["sortDir"]
) {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (sortBy === "memberName") return factor * left.memberName.localeCompare(right.memberName);
    if (sortBy === "expectedShifts") return factor * (left.expectedShifts - right.expectedShifts);
    if (sortBy === "presentDays") return factor * (left.presentDays - right.presentDays);
    if (sortBy === "absentDays") return factor * (left.absentDays - right.absentDays);
    if (sortBy === "lateCount") return factor * (left.lateCount - right.lateCount);
    if (sortBy === "lateMinutes") return factor * (left.lateMinutes - right.lateMinutes);
    if (sortBy === "earlyLeaveCount") return factor * (left.earlyLeaveCount - right.earlyLeaveCount);
    if (sortBy === "earlyLeaveMinutes") return factor * (left.earlyLeaveMinutes - right.earlyLeaveMinutes);
    if (sortBy === "overtimeMinutes") return factor * (left.overtimeMinutes - right.overtimeMinutes);
    if (sortBy === "justifiedCount") return factor * (left.justifiedCount - right.justifiedCount);
    if (sortBy === "unscheduledPresentCount") return factor * (left.unscheduledPresentCount - right.unscheduledPresentCount);
    if (sortBy === "deniedCount") return factor * (left.deniedCount - right.deniedCount);
    if (sortBy === "noCheckoutCount") return factor * (left.noCheckoutCount - right.noCheckoutCount);
    return factor * left.memberName.localeCompare(right.memberName);
  });
}

function createEmptyKpis(): AttendanceReportKpis {
  return {
    presentDays: 0,
    absentDays: 0,
    lateCount: 0,
    lateMinutes: 0,
    earlyLeaveCount: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 0,
    justifiedCount: 0,
    unscheduledPresentCount: 0,
    deniedCount: 0,
    noCheckoutCount: 0,
  };
}

function paginateArray<T>(items: T[], page: number, pageSize: number): { items: T[]; pageInfo: ReportPageInfo } {
  if (!items.length) {
    return { items: [], pageInfo: buildPageInfo(page, pageSize, 0) };
  }
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const sliced = items.slice(start, start + pageSize);
  return {
    items: sliced,
    pageInfo: {
      page: safePage,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

function buildPageInfo(page: number, pageSize: number, totalItems: number): ReportPageInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
  };
}

function buildEvidenceWhere(
  filters: ScopedAttendanceReportFilters,
  memberIds: string[],
  anomalyIds: Set<string> | null
): Prisma.AttendanceLogWhereInput {
  const where: Prisma.AttendanceLogWhereInput = {
    memberId: { in: memberIds },
    recordedAt: { gte: filters.fromDate, lt: filters.toExclusive },
    ...(isStrictStaffAttendanceScope(filters.attendanceDataScope)
      ? { member: buildStrictStaffMemberWhere() }
      : {}),
  };

  if (filters.deviceId) {
    where.deviceUser = { deviceId: filters.deviceId };
  }

  if (filters.eventType === "in") {
    where.isAuthorized = true;
    where.entryType = AttendanceType.IN;
  } else if (filters.eventType === "out") {
    where.isAuthorized = true;
    where.entryType = AttendanceType.OUT;
  } else if (filters.eventType === "denied") {
    where.isAuthorized = false;
  }

  if (anomalyIds) {
    where.id = { in: Array.from(anomalyIds) };
  }

  return where;
}

async function loadAllEvidenceForExport(
  filters: ScopedAttendanceReportFilters,
  memberIds: string[],
  anomalyIds: Set<string> | null
): Promise<AttendanceReportEvidenceItem[]> {
  if (!memberIds.length) return [];
  if (anomalyIds && !anomalyIds.size) return [];

  const where = buildEvidenceWhere(filters, memberIds, anomalyIds);
  const totalItems = await prisma.attendanceLog.count({ where });
  if (totalItems > EVIDENCE_EXPORT_MAX_ROWS) {
    throw new HttpError(413, "Evidence export is too large. Narrow filters and try again.", {
      maxRows: EVIDENCE_EXPORT_MAX_ROWS,
      totalItems,
    });
  }

  const items: AttendanceReportEvidenceItem[] = [];
  let skip = 0;
  while (skip < totalItems) {
    const rows = await prisma.attendanceLog.findMany({
      where,
      orderBy: { recordedAt: "desc" },
      skip,
      take: EVIDENCE_EXPORT_BATCH_SIZE,
      include: {
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            memberType: true,
            isStaff: true,
          },
        },
        deviceUser: { select: { deviceId: true } },
      },
    });
    const deviceMap = await loadDeviceMapFromLogs(rows);
    rows.forEach((row) => items.push(formatEvidenceRow(row, deviceMap, filters.attendanceDataScope)));
    skip += rows.length;
    if (!rows.length) break;
  }
  return items;
}

async function loadDeviceMapFromLogs(logs: Array<{ deviceUser?: { deviceId: string | null } | null }>) {
  const deviceIds = Array.from(
    new Set(logs.map((row) => row.deviceUser?.deviceId).filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  if (!deviceIds.length) return new Map<string, string>();
  const rows = await prisma.device.findMany({
    where: { id: { in: deviceIds } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

function formatEvidenceRow(
  row: ReportLog,
  deviceMap: Map<string, string>,
  scope: AttendanceDataScope
): AttendanceReportEvidenceItem {
  const memberType = isStrictStaffAttendanceScope(scope)
    ? "STAFF"
    : row.member
    ? row.member.memberType === MemberType.STAFF || row.member.isStaff
      ? "STAFF"
      : "CUSTOMER"
    : "UNKNOWN";
  const memberName = row.member ? formatMemberName(row.member.firstName, row.member.lastName) : "Unknown";
  const deviceId = row.deviceUser?.deviceId ?? null;

  return {
    id: row.id,
    timestamp: row.recordedAt.toISOString(),
    memberId: row.memberId ?? null,
    memberName,
    memberType,
    eventType: row.isAuthorized ? row.entryType : "DENIED",
    deviceId,
    deviceName: deviceId ? deviceMap.get(deviceId) ?? null : null,
    source: row.source,
    authorized: row.isAuthorized,
    result: row.isAuthorized ? "authorized" : "denied",
    denyReason: row.isAuthorized ? null : row.reason ?? null,
    notes: row.reason ?? null,
  };
}

type XlsxSheet = {
  name: string;
  rows: Array<Array<string | number | boolean | null | undefined>>;
};

function buildXlsxBuffer(sheets: XlsxSheet[]) {
  const normalizedSheets = sheets.map((sheet, index) => ({
    name: sanitizeSheetName(sheet.name || `Sheet${index + 1}`),
    rows: sheet.rows,
  }));

  const entries: Array<{ name: string; data: Buffer }> = [];
  entries.push({
    name: "[Content_Types].xml",
    data: Buffer.from(buildContentTypesXml(normalizedSheets.length), "utf8"),
  });
  entries.push({
    name: "_rels/.rels",
    data: Buffer.from(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
      "utf8"
    ),
  });
  entries.push({
    name: "xl/workbook.xml",
    data: Buffer.from(buildWorkbookXml(normalizedSheets), "utf8"),
  });
  entries.push({
    name: "xl/_rels/workbook.xml.rels",
    data: Buffer.from(buildWorkbookRelsXml(normalizedSheets.length), "utf8"),
  });
  entries.push({
    name: "xl/styles.xml",
    data: Buffer.from(buildStylesXml(), "utf8"),
  });

  normalizedSheets.forEach((sheet, index) => {
    entries.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: Buffer.from(buildSheetXml(sheet.rows), "utf8"),
    });
  });

  return buildZip(entries);
}

function buildContentTypesXml(sheetCount: number) {
  const sheets = Array.from({ length: sheetCount }, (_, idx) => {
    const i = idx + 1;
    return `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets +
    "</Types>"
  );
}

function buildWorkbookXml(sheets: Array<{ name: string }>) {
  const rows = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${rows}</sheets>` +
    "</workbook>"
  );
}

function buildWorkbookRelsXml(sheetCount: number) {
  const sheetRels = Array.from({ length: sheetCount }, (_, idx) => {
    const i = idx + 1;
    return `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }).join("");
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRels +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>"
  );
}

function buildStylesXml() {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>"
  );
}

function buildSheetXml(rows: Array<Array<string | number | boolean | null | undefined>>) {
  const xmlRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => buildSheetCell(value, rowIndex + 1, colIndex + 1))
        .filter(Boolean)
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${xmlRows}</sheetData>` +
    "</worksheet>"
  );
}

function buildSheetCell(value: string | number | boolean | null | undefined, row: number, col: number) {
  if (value === null || value === undefined) return "";
  const ref = `${toExcelColumnName(col)}${row}`;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  const text = escapeXml(String(value));
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function toExcelColumnName(index: number) {
  let col = "";
  let n = index;
  while (n > 0) {
    const mod = (n - 1) % 26;
    col = String.fromCharCode(65 + mod) + col;
    n = Math.floor((n - mod) / 26);
  }
  return col;
}

function sanitizeSheetName(name: string) {
  const sanitized = name.replace(/[\\/?*\[\]:]/g, " ").trim();
  return sanitized.slice(0, 31) || "Sheet";
}

function buildZip(entries: Array<{ name: string; data: Buffer }>) {
  const fileParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const fileName = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const crc = crc32(data);
    const dos = toDosDateTime(new Date());

    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dos.time, 10);
    localHeader.writeUInt16LE(dos.date, 12);
    localHeader.writeUInt32LE(crc >>> 0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileName.copy(localHeader, 30);

    fileParts.push(localHeader, data);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dos.time, 12);
    centralHeader.writeUInt16LE(dos.date, 14);
    centralHeader.writeUInt32LE(crc >>> 0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localOffset, 42);
    fileName.copy(centralHeader, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + data.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(localOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...fileParts, centralDirectory, endRecord]);
}

function toDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time: dosTime, date: dosDate };
}

let crcTable: number[] | null = null;

function getCrcTable() {
  if (crcTable) return crcTable;
  const table: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(buffer: Buffer) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    const byte = buffer[i];
    if (byte === undefined) continue;
    crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || "Unknown";
}

function buildFilenameStamp(date: Date) {
  return date.toISOString().replace(/[:T]/g, "-").slice(0, 19);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toScheduleWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

function minutesBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / 60000);
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function applyTime(base: Date, time: string): Date {
  const [hoursPart = "0", minutesPart = "0"] = time.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  const next = new Date(base);
  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return next;
}

function computeShiftWindow(dayStart: Date, shiftStart: string, shiftEnd: string) {
  const startAt = applyTime(dayStart, shiftStart);
  let endAt = applyTime(dayStart, shiftEnd);
  if (isCrossMidnight(shiftStart, shiftEnd)) {
    endAt = addDays(endAt, 1);
  }
  if (endAt < startAt) {
    endAt = addDays(endAt, 1);
  }
  return { startAt, endAt };
}

function isCrossMidnight(shiftStart: string, shiftEnd: string) {
  return timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart);
}

function timeToMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}
