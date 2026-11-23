import { MemberType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildSimplePdf, buildXlsxBuffer, formatDateKey } from "../reports/shared/report-export.utils";
import type { RenewalForecastExportQuery, RenewalForecastQuery } from "./reports-renewal-forecast.schemas";

type RenewalForecastItem = {
  membershipId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER";
  planId: string | null;
  planName: string | null;
  currentStatus: string;
  expireDate: string;
  daysLeft: number;
  due: number;
  paid: number;
  remaining: number;
  autoRenew: boolean;
  lastPaymentDate: string | null;
  suggestedAction: "Call" | "SMS" | "Visit";
};

type RenewalForecastKpis = {
  expiringCount: number;
  expiringRevenueAtRisk: number;
  expectedRenewals: number;
  renewalRatePct: number;
  debtAtRisk: number;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type RenewalForecastReportResponse = {
  generatedAt: string;
  filters: {
    horizonDays: number;
    includeExpired: boolean;
    showOnlyDebtors: boolean;
    planId: string | null;
    status: string | null;
    memberType: RenewalForecastQuery["memberType"];
    search: string | null;
    sortBy: RenewalForecastQuery["sortBy"];
    sortDir: RenewalForecastQuery["sortDir"];
  };
  kpis: RenewalForecastKpis;
  charts: {
    expirationsTimeline: Array<{ key: string; label: string; count: number; totalDue: number; totalRemaining: number }>;
    byPlan: Array<{ planId: string; planName: string; count: number; totalDue: number; totalRemaining: number }>;
  };
  items: RenewalForecastItem[];
  pageInfo: PageInfo;
};

type RenewalForecastDataset = {
  filters: RenewalForecastReportResponse["filters"];
  kpis: RenewalForecastKpis;
  charts: RenewalForecastReportResponse["charts"];
  items: RenewalForecastItem[];
};

const LOOKBACK_MONTHS = 6;

export async function getRenewalForecastReport(query: RenewalForecastQuery): Promise<RenewalForecastReportResponse> {
  const dataset = await buildDataset(query);
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

export async function getRenewalForecastCsv(query: RenewalForecastExportQuery): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("member"),
    t("plan"),
    t("currentStatus"),
    t("expireDate"),
    t("daysLeft"),
    t("totalDue"),
    t("paid"),
    t("remaining"),
    t("autoRenew"),
    t("suggestedAction"),
  ];
  const rows = dataset.items.map((item) => [
    `${item.memberName} (#${item.memberCode})`,
    item.planName ?? "-",
    labels.membershipStatus(item.currentStatus),
    item.expireDate.slice(0, 10),
    item.daysLeft,
    item.due.toFixed(2),
    item.paid.toFixed(2),
    item.remaining.toFixed(2),
    labels.yesNo(item.autoRenew),
    labels.suggestedAction(item.suggestedAction),
  ]);

  return {
    csv: buildCsv(headers, rows),
    filename: `renewal-forecast-report-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getRenewalForecastXlsx(
  query: RenewalForecastExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("expiringCount"), dataset.kpis.expiringCount],
    [t("revenueAtRisk"), dataset.kpis.expiringRevenueAtRisk],
    [t("expectedRenewals"), dataset.kpis.expectedRenewals],
    [t("renewalRatePct"), dataset.kpis.renewalRatePct],
    [t("debtAtRisk"), dataset.kpis.debtAtRisk],
    [t("horizonDays"), dataset.filters.horizonDays],
  ];
  const tableRows: Array<Array<string | number>> = [
    [t("member"), t("plan"), t("currentStatus"), t("expireDate"), t("daysLeft"), t("totalDue"), t("paid"), t("remaining"), t("autoRenew"), t("suggestedAction")],
    ...dataset.items.map((item) => [
      `${item.memberName} (#${item.memberCode})`,
      item.planName ?? "-",
      labels.membershipStatus(item.currentStatus),
      item.expireDate.slice(0, 10),
      item.daysLeft,
      item.due,
      item.paid,
      item.remaining,
      labels.yesNo(item.autoRenew),
      labels.suggestedAction(item.suggestedAction),
    ]),
  ];
  const planRows: Array<Array<string | number>> = [
    [t("plan"), t("count"), t("totalDue"), t("totalRemaining")],
    ...dataset.charts.byPlan.map((row) => [row.planName, row.count, row.totalDue, row.totalRemaining]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    { name: t("byPlan"), rows: planRows },
    { name: t("forecast"), rows: tableRows },
  ]);

  return {
    buffer,
    filename: `renewal-forecast-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: dataset.items.length,
  };
}

export async function getRenewalForecastPdf(
  query: RenewalForecastExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const lines: string[] = [];
  lines.push("AtlasGym");
  lines.push(t("forecast"));
  lines.push(`${t("generatedAt")}: ${new Date().toISOString()}`);
  lines.push(`${t("horizonDays")}: ${dataset.filters.horizonDays}`);
  lines.push(`${t("expiringCount")}: ${dataset.kpis.expiringCount}`);
  lines.push(`${t("revenueAtRisk")}: ${dataset.kpis.expiringRevenueAtRisk}`);
  lines.push(`${t("expectedRenewals")}: ${dataset.kpis.expectedRenewals}`);
  lines.push(`${t("debtAtRisk")}: ${dataset.kpis.debtAtRisk}`);
  lines.push("");
  lines.push(`${t("members")}:`);
  dataset.items.slice(0, 120).forEach((item) => {
    lines.push(
      `${item.memberName} | ${item.planName ?? "-"} | ${item.expireDate.slice(0, 10)} | ${t("daysLeft")}:${item.daysLeft} | ${t("remaining")}:${item.remaining} | ${labels.suggestedAction(item.suggestedAction)}`
    );
  });

  const buffer = await buildSimplePdf(lines, t("forecast"));
  return {
    buffer,
    filename: `renewal-forecast-report-${buildFilenameStamp(new Date())}.pdf`,
    contentType: "application/pdf",
    rowCount: Math.min(dataset.items.length, 120),
  };
}

async function buildDataset(query: RenewalForecastExportQuery | RenewalForecastQuery): Promise<RenewalForecastDataset> {
  const now = startOfDay(new Date());
  const horizonEnd = addDays(now, query.horizonDays);
  const search = query.search?.trim();

  const memberTypeWhere = buildMemberTypeWhere(query.memberType);

  const where: Prisma.MembershipWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    endDate: {
      ...(query.includeExpired ? {} : { gte: now }),
      lte: horizonEnd,
    },
    member: {
      ...memberTypeWhere,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };

  const rows = await prisma.membership.findMany({
    where,
    include: {
      member: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          memberType: true,
          isStaff: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
        },
      },
      payments: {
        where: { status: PaymentStatus.PAID, paidAt: { not: null } },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true },
      },
    },
  });

  const items: RenewalForecastItem[] = rows
    .map((row) => {
      const due = asAmount(row.totalDue);
      const paid = asAmount(row.totalPaid);
      const remaining = Math.max(0, roundCurrency(due - paid));
      const daysLeft = diffDays(startOfDay(row.endDate), now);

      const item: RenewalForecastItem = {
        membershipId: row.id,
        memberId: row.memberId,
        memberCode: row.member.code,
        memberName: formatMemberName(row.member.firstName, row.member.lastName),
        memberType: row.member.memberType === MemberType.STAFF || row.member.isStaff ? "STAFF" : "CUSTOMER",
        planId: row.planId,
        planName: row.plan?.name ?? null,
        currentStatus: row.status,
        expireDate: row.endDate.toISOString(),
        daysLeft,
        due,
        paid,
        remaining,
        autoRenew: row.autoRenew,
        lastPaymentDate: row.payments[0]?.paidAt?.toISOString() ?? null,
        suggestedAction: decideAction({ daysLeft, remaining, autoRenew: row.autoRenew }),
      };
      return item;
    })
    .filter((item) => (query.showOnlyDebtors ? item.remaining > 0 : true));

  const sorted = sortItems(items, query.sortBy, query.sortDir);
  const expiringCount = sorted.length;
  const expiringRevenueAtRisk = roundCurrency(sorted.reduce((sum, item) => sum + item.due, 0));
  const debtAtRisk = roundCurrency(sorted.reduce((sum, item) => sum + item.remaining, 0));
  const renewalRate = await estimateRenewalRate(query, now);
  const expectedRenewals = Math.round(expiringCount * renewalRate);

  const timeline = buildTimeline(sorted, now, query.horizonDays);
  const byPlan = buildByPlan(sorted);

  return {
    filters: {
      horizonDays: query.horizonDays,
      includeExpired: query.includeExpired,
      showOnlyDebtors: query.showOnlyDebtors,
      planId: query.planId ?? null,
      status: query.status ?? null,
      memberType: query.memberType,
      search: search ?? null,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
    kpis: {
      expiringCount,
      expiringRevenueAtRisk,
      expectedRenewals,
      renewalRatePct: roundPercent(renewalRate * 100),
      debtAtRisk,
    },
    charts: {
      expirationsTimeline: timeline,
      byPlan,
    },
    items: sorted,
  };
}

async function estimateRenewalRate(query: RenewalForecastExportQuery | RenewalForecastQuery, now: Date) {
  const lookbackStart = addMonths(now, -LOOKBACK_MONTHS);
  const memberTypeWhere = buildMemberTypeWhere(query.memberType);

  const recent = await prisma.membership.findMany({
    where: {
      ...(query.planId ? { planId: query.planId } : {}),
      createdAt: { gte: lookbackStart },
      member: memberTypeWhere,
    },
    select: {
      id: true,
      memberId: true,
    },
  });

  if (!recent.length) return 0.35;

  const memberIds = Array.from(new Set(recent.map((row) => row.memberId)));
  const history = await prisma.membership.findMany({
    where: { memberId: { in: memberIds } },
    select: { id: true, memberId: true, createdAt: true },
    orderBy: [{ memberId: "asc" }, { createdAt: "asc" }],
  });

  const firstMembershipByMember = new Map<string, string>();
  history.forEach((row) => {
    if (!firstMembershipByMember.has(row.memberId)) {
      firstMembershipByMember.set(row.memberId, row.id);
    }
  });

  const renewals = recent.filter((row) => firstMembershipByMember.get(row.memberId) !== row.id).length;
  const rate = renewals / recent.length;
  if (!Number.isFinite(rate)) return 0.35;
  return Math.min(1, Math.max(0, rate));
}

function buildByPlan(items: RenewalForecastItem[]) {
  const planMap = new Map<string, { planId: string; planName: string; count: number; totalDue: number; totalRemaining: number }>();
  items.forEach((item) => {
    const key = item.planId ?? "__none__";
    const current = planMap.get(key) ?? {
      planId: item.planId ?? "",
      planName: item.planName ?? "-",
      count: 0,
      totalDue: 0,
      totalRemaining: 0,
    };
    current.count += 1;
    current.totalDue += item.due;
    current.totalRemaining += item.remaining;
    planMap.set(key, current);
  });
  return Array.from(planMap.values())
    .map((row) => ({
      ...row,
      totalDue: roundCurrency(row.totalDue),
      totalRemaining: roundCurrency(row.totalRemaining),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

function buildTimeline(items: RenewalForecastItem[], start: Date, horizonDays: number) {
  const points = new Map<string, { key: string; label: string; count: number; totalDue: number; totalRemaining: number }>();
  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(start, i);
    const key = formatDateKey(date);
    points.set(key, {
      key,
      label: key.slice(5),
      count: 0,
      totalDue: 0,
      totalRemaining: 0,
    });
  }
  items.forEach((item) => {
    const date = formatDateKey(new Date(item.expireDate));
    const point = points.get(date);
    if (!point) return;
    point.count += 1;
    point.totalDue += item.due;
    point.totalRemaining += item.remaining;
  });
  return Array.from(points.values()).map((point) => ({
    ...point,
    totalDue: roundCurrency(point.totalDue),
    totalRemaining: roundCurrency(point.totalRemaining),
  }));
}

function sortItems(items: RenewalForecastItem[], sortBy: RenewalForecastQuery["sortBy"], sortDir: RenewalForecastQuery["sortDir"]) {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (sortBy === "remaining") return factor * (left.remaining - right.remaining || left.daysLeft - right.daysLeft);
    if (sortBy === "endDate") return factor * (new Date(left.expireDate).getTime() - new Date(right.expireDate).getTime());
    if (sortBy === "memberName") return factor * left.memberName.localeCompare(right.memberName);
    return factor * (left.daysLeft - right.daysLeft || right.remaining - left.remaining);
  });
}

function buildMemberTypeWhere(memberType: RenewalForecastQuery["memberType"]): Prisma.MemberWhereInput {
  if (memberType === "staff") {
    return {
      OR: [{ memberType: MemberType.STAFF }, { isStaff: true }],
    };
  }
  if (memberType === "customer") {
    return { memberType: MemberType.CUSTOMER, isStaff: false };
  }
  return {};
}

function decideAction(input: { daysLeft: number; remaining: number; autoRenew: boolean }): "Call" | "SMS" | "Visit" {
  if (input.daysLeft <= 0 && input.remaining > 0) return "Visit";
  if (input.remaining > 0 && input.daysLeft <= 7) return "Call";
  if (input.remaining > 0) return "SMS";
  if (input.daysLeft <= 3) return "Call";
  if (input.autoRenew) return "SMS";
  return "Visit";
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function diffDays(later: Date, earlier: Date) {
  return Math.floor((startOfDay(later).getTime() - startOfDay(earlier).getTime()) / 86400000);
}

function asAmount(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : Number(value);
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2));
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}
