import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildXlsxBuffer } from "../reports/shared/report-export.utils";
import { getAttendanceReportMembersAll } from "../reports-attendance/reports-attendance.service";
import { computeComplianceScore, type ComplianceMetrics, type ComplianceWeights } from "./attendance-compliance.logic";
import type { AttendanceComplianceExportQuery, AttendanceComplianceQuery } from "./reports-attendance-compliance.schemas";
import {
  buildStrictStaffMemberWhere,
  isStrictStaffAttendanceScope,
  type AttendanceDataScope,
} from "../attendance/attendance-edition-scope";

type ComplianceItem = {
  id: string;
  name: string;
  entityType: "member" | "group";
  memberType: "STAFF" | "CUSTOMER" | "MIXED";
  memberCount: number;
  score: number;
  expectedShifts: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  deniedCount: number;
  noCheckoutCount: number;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AttendanceComplianceReportResponse = {
  generatedAt: string;
  filters: {
    from: string;
    to: string;
    memberType: AttendanceComplianceQuery["memberType"];
    shiftMode: AttendanceComplianceQuery["shiftMode"];
    shiftId: string | null;
    staffGroupId: string | null;
    deviceId: string | null;
    eventType: AttendanceComplianceQuery["eventType"];
    search: string | null;
    onlyAnomalies: boolean;
    viewBy: AttendanceComplianceQuery["viewBy"];
    sortBy: AttendanceComplianceQuery["sortBy"];
    sortDir: AttendanceComplianceQuery["sortDir"];
    weights: ComplianceWeights;
  };
  kpis: {
    averageScore: number;
    bestScore: number;
    worstScore: number;
    evaluatedCount: number;
  };
  charts: {
    distribution: Array<{ bucket: string; count: number }>;
    topLowScores: Array<{ id: string; label: string; score: number }>;
  };
  items: ComplianceItem[];
  pageInfo: PageInfo;
};

type ComplianceDataset = {
  filters: AttendanceComplianceReportResponse["filters"];
  kpis: AttendanceComplianceReportResponse["kpis"];
  charts: AttendanceComplianceReportResponse["charts"];
  items: ComplianceItem[];
};

export async function getAttendanceComplianceReport(
  query: AttendanceComplianceQuery,
  scope: AttendanceDataScope
): Promise<AttendanceComplianceReportResponse> {
  const dataset = await buildDataset(query, scope);
  const totalItems = dataset.items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(Math.max(1, query.page), totalPages);
  const start = (page - 1) * query.pageSize;
  const items = dataset.items.slice(start, start + query.pageSize);

  return {
    generatedAt: new Date().toISOString(),
    filters: dataset.filters,
    kpis: dataset.kpis,
    charts: dataset.charts,
    items,
    pageInfo: {
      page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getAttendanceComplianceCsv(
  query: AttendanceComplianceExportQuery,
  scope: AttendanceDataScope
): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildDataset(query, scope);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("entity"),
    t("type"),
    t("score"),
    t("lateCount"),
    t("lateMinutes"),
    t("absentDays"),
    t("earlyLeave"),
    t("overtime"),
    t("denied"),
    t("noCheckout"),
  ];
  const rows = dataset.items.map((item) => [
    item.name,
    labels.entityType(item.entityType),
    item.score.toFixed(2),
    item.lateCount,
    item.lateMinutes,
    item.absentDays,
    item.earlyLeaveCount,
    item.overtimeMinutes,
    item.deniedCount,
    item.noCheckoutCount,
  ]);
  return {
    csv: buildCsv(headers, rows),
    filename: `attendance-compliance-report-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getAttendanceComplianceXlsx(
  query: AttendanceComplianceExportQuery,
  scope: AttendanceDataScope
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDataset(query, scope);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("averageScore"), dataset.kpis.averageScore],
    [t("bestScore"), dataset.kpis.bestScore],
    [t("worstScore"), dataset.kpis.worstScore],
    [t("evaluatedCount"), dataset.kpis.evaluatedCount],
    [t("viewBy"), labels.entityType(dataset.filters.viewBy)],
  ];
  const distributionRows: Array<Array<string | number>> = [
    [t("bucket"), t("count")],
    ...dataset.charts.distribution.map((item) => [item.bucket, item.count]),
  ];
  const tableRows: Array<Array<string | number>> = [
    [t("entity"), t("type"), t("score"), t("lateCount"), t("lateMinutes"), t("absentDays"), t("earlyLeave"), t("overtime"), t("denied"), t("noCheckout")],
    ...dataset.items.map((item) => [
      item.name,
      labels.entityType(item.entityType),
      item.score,
      item.lateCount,
      item.lateMinutes,
      item.absentDays,
      item.earlyLeaveCount,
      item.overtimeMinutes,
      item.deniedCount,
      item.noCheckoutCount,
    ]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    { name: t("distribution"), rows: distributionRows },
    { name: t("compliance"), rows: tableRows },
  ]);

  return {
    buffer,
    filename: `attendance-compliance-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: dataset.items.length,
  };
}

async function buildDataset(
  query: AttendanceComplianceExportQuery | AttendanceComplianceQuery,
  scope: AttendanceDataScope
): Promise<ComplianceDataset> {
  const weights: ComplianceWeights = {
    lateMinutesWeight: query.lateMinutesWeight,
    lateCountWeight: query.lateCountWeight,
    absentWeight: query.absentWeight,
    noCheckoutWeight: query.noCheckoutWeight,
    deniedWeight: query.deniedWeight,
  };

  const memberRows = await loadAllMembers(query, scope);
  const scoredMembers = memberRows.map((row) => mapMemberRow(row, weights));

  const items = query.viewBy === "group" ? await toGroupRows(scoredMembers, weights, scope) : scoredMembers;
  const sortedItems = sortItems(items, query.sortBy, query.sortDir);

  const evaluatedCount = sortedItems.length;
  const averageScore = evaluatedCount
    ? roundNumber(sortedItems.reduce((sum, item) => sum + item.score, 0) / evaluatedCount)
    : 0;
  const bestScore = evaluatedCount ? roundNumber(Math.max(...sortedItems.map((item) => item.score))) : 0;
  const worstScore = evaluatedCount ? roundNumber(Math.min(...sortedItems.map((item) => item.score))) : 0;

  const distribution = [
    { bucket: "0-49", count: 0 },
    { bucket: "50-69", count: 0 },
    { bucket: "70-84", count: 0 },
    { bucket: "85-100", count: 0 },
  ];
  sortedItems.forEach((item) => {
    if (item.score < 50) distribution[0]!.count += 1;
    else if (item.score < 70) distribution[1]!.count += 1;
    else if (item.score < 85) distribution[2]!.count += 1;
    else distribution[3]!.count += 1;
  });

  const topLowScores = [...sortedItems]
    .sort((left, right) => left.score - right.score)
    .slice(0, 10)
    .map((item) => ({ id: item.id, label: item.name, score: item.score }));

  return {
    filters: {
      from: query.from,
      to: query.to,
      memberType: isStrictStaffAttendanceScope(scope) ? "staff" : query.memberType,
      shiftMode: query.shiftMode,
      shiftId: query.shiftId ?? null,
      staffGroupId: query.staffGroupId ?? null,
      deviceId: query.deviceId ?? null,
      eventType: query.eventType,
      search: query.search?.trim() || null,
      onlyAnomalies: query.onlyAnomalies,
      viewBy: query.viewBy,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      weights,
    },
    kpis: {
      averageScore,
      bestScore,
      worstScore,
      evaluatedCount,
    },
    charts: {
      distribution,
      topLowScores,
    },
    items: sortedItems,
  };
}

async function loadAllMembers(
  query: AttendanceComplianceExportQuery | AttendanceComplianceQuery,
  scope: AttendanceDataScope
) {
  return getAttendanceReportMembersAll({
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
    sortBy: "memberName",
    sortDir: "asc",
  }, scope);
}

function mapMemberRow(
  row: {
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
    deniedCount: number;
    noCheckoutCount: number;
  },
  weights: ComplianceWeights
): ComplianceItem {
  const metrics: ComplianceMetrics = {
    lateMinutes: row.lateMinutes,
    lateCount: row.lateCount,
    absentDays: row.absentDays,
    noCheckoutCount: row.noCheckoutCount,
    deniedCount: row.deniedCount,
  };
  return {
    id: row.memberId,
    name: `${row.memberName} (#${row.memberCode})`,
    entityType: "member",
    memberType: row.memberType,
    memberCount: 1,
    score: computeComplianceScore(metrics, weights),
    expectedShifts: row.expectedShifts,
    presentDays: row.presentDays,
    absentDays: row.absentDays,
    lateCount: row.lateCount,
    lateMinutes: row.lateMinutes,
    earlyLeaveCount: row.earlyLeaveCount,
    earlyLeaveMinutes: row.earlyLeaveMinutes,
    overtimeMinutes: row.overtimeMinutes,
    deniedCount: row.deniedCount,
    noCheckoutCount: row.noCheckoutCount,
  };
}

async function toGroupRows(
  items: ComplianceItem[],
  weights: ComplianceWeights,
  scope: AttendanceDataScope
): Promise<ComplianceItem[]> {
  if (!items.length) return [];

  const memberIds = items.map((item) => item.id);
  const memberRows = await prisma.member.findMany({
    where: {
      id: { in: memberIds },
      ...(isStrictStaffAttendanceScope(scope) ? buildStrictStaffMemberWhere() : {}),
    },
    select: { id: true, staffGroup: { select: { name: true } } },
  });

  const groupByMember = new Map(memberRows.map((row) => [row.id, row.staffGroup?.name ?? "Ungrouped"]));
  const map = new Map<string, ComplianceItem>();

  items.forEach((item) => {
    const groupName = groupByMember.get(item.id) ?? "Ungrouped";
    const current = map.get(groupName) ?? {
      id: groupName,
      name: groupName,
      entityType: "group" as const,
      memberType: (isStrictStaffAttendanceScope(scope) ? "STAFF" : "MIXED") as "STAFF" | "MIXED",
      memberCount: 0,
      score: 0,
      expectedShifts: 0,
      presentDays: 0,
      absentDays: 0,
      lateCount: 0,
      lateMinutes: 0,
      earlyLeaveCount: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      deniedCount: 0,
      noCheckoutCount: 0,
    };
    current.memberCount += 1;
    current.expectedShifts += item.expectedShifts;
    current.presentDays += item.presentDays;
    current.absentDays += item.absentDays;
    current.lateCount += item.lateCount;
    current.lateMinutes += item.lateMinutes;
    current.earlyLeaveCount += item.earlyLeaveCount;
    current.earlyLeaveMinutes += item.earlyLeaveMinutes;
    current.overtimeMinutes += item.overtimeMinutes;
    current.deniedCount += item.deniedCount;
    current.noCheckoutCount += item.noCheckoutCount;
    map.set(groupName, current);
  });

  return Array.from(map.values()).map((item) => {
    item.score = computeComplianceScore(
      {
        lateMinutes: item.lateMinutes,
        lateCount: item.lateCount,
        absentDays: item.absentDays,
        noCheckoutCount: item.noCheckoutCount,
        deniedCount: item.deniedCount,
      },
      weights
    );
    return item;
  });
}

function sortItems(items: ComplianceItem[], sortBy: AttendanceComplianceQuery["sortBy"], sortDir: AttendanceComplianceQuery["sortDir"]) {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (sortBy === "lateMinutes") return factor * (left.lateMinutes - right.lateMinutes || left.score - right.score);
    if (sortBy === "lateCount") return factor * (left.lateCount - right.lateCount || left.score - right.score);
    if (sortBy === "absentDays") return factor * (left.absentDays - right.absentDays || left.score - right.score);
    if (sortBy === "deniedCount") return factor * (left.deniedCount - right.deniedCount || left.score - right.score);
    if (sortBy === "noCheckoutCount") return factor * (left.noCheckoutCount - right.noCheckoutCount || left.score - right.score);
    if (sortBy === "name") return factor * left.name.localeCompare(right.name);
    return factor * (left.score - right.score || left.absentDays - right.absentDays);
  });
}

function roundNumber(value: number) {
  return Number(value.toFixed(2));
}
