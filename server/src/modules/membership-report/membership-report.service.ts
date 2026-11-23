import {
  AdminRole,
  AuditActor,
  MemberType,
  MembershipStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import type { MembershipReportQuery } from "./membership-report.schemas";

type MembershipLifecycle = "FIRST_TIME" | "RENEWAL";

export type MembershipReportExportContext = {
  actor: {
    id: string;
    role: AdminRole;
    sessionId?: string;
  };
  meta: {
    ipAddress?: string;
    userAgent?: string;
  };
};

type MembershipReportItem = {
  id: string;
  member: {
    id: string;
    code: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    phone: string | null;
  };
  plan: {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: string;
  } | null;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  activatedAt: Date | null;
  autoRenew: boolean;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  lifecycle: MembershipLifecycle;
  daysLeft: number | null;
  isExpiredByDate: boolean;
  isExpiringSoon: boolean;
};

type PlanStats = {
  planId: string;
  planName: string;
  memberships: number;
  active: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
};

type MonthlyTrendPoint = {
  monthKey: string;
  label: string;
  memberships: number;
  renewals: number;
  firstTimers: number;
  totalDue: number;
  totalPaid: number;
  totalRemaining: number;
};

type MembershipReportResponse = {
  generatedAt: string;
  filters: {
    preset: MembershipReportQuery["preset"];
    dateField: MembershipReportQuery["dateField"];
    from: string | null;
    to: string | null;
    status: MembershipStatus | null;
    planId: string | null;
    memberId: string | null;
    search: string | null;
    remaining: MembershipReportQuery["remaining"];
    autoRenew: boolean | null;
    expiringInDays: number | null;
    sortBy: MembershipReportQuery["sortBy"];
    sortDir: MembershipReportQuery["sortDir"];
  };
  total: number;
  skip: number;
  take: number;
  summary: {
    totalMemberships: number;
    active: number;
    pending: number;
    expired: number;
    suspended: number;
    cancelled: number;
    renewals: number;
    firstTimers: number;
    autoRenewEnabled: number;
    expiringSoon: number;
    debtors: number;
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
    collectionRatePct: number;
    averageDuePerMembership: number;
  };
  charts: {
    statusSplit: Array<{ status: MembershipStatus; count: number }>;
    lifecycleSplit: Array<{ type: MembershipLifecycle; count: number }>;
    monthlyTrend: MonthlyTrendPoint[];
    expiringBuckets: Array<{ bucket: "0-7" | "8-30" | "31-60" | "61+"; count: number }>;
    topPlans: PlanStats[];
    topDebtors: Array<{
      membershipId: string;
      memberId: string;
      memberName: string;
      planName: string | null;
      remaining: number;
      endDate: string;
      daysLeft: number | null;
    }>;
  };
  items: MembershipReportItem[];
};

export async function getMembershipReport(query: MembershipReportQuery): Promise<MembershipReportResponse> {
  const now = new Date();
  const range = resolveDateRange(query.preset, query.from, query.to);
  const search = query.search?.trim();
  const dateField = mapDateField(query.dateField);

  const where: Prisma.MembershipWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    ...(query.memberId ? { memberId: query.memberId } : {}),
    ...(query.autoRenew === undefined ? {} : { autoRenew: query.autoRenew }),
    member: {
      memberType: MemberType.CUSTOMER,
      isStaff: false,
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

  if (range) {
    (where as Record<string, unknown>)[dateField] = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  const rows = await prisma.membership.findMany({
    where,
    include: {
      member: { select: { id: true, code: true, firstName: true, lastName: true, phone: true } },
      plan: { select: { id: true, name: true, durationValue: true, durationUnit: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const memberIds = Array.from(new Set(rows.map((row) => row.memberId)));
  const historyRows = memberIds.length
    ? await prisma.membership.findMany({
        where: { memberId: { in: memberIds } },
        select: { id: true, memberId: true, createdAt: true },
        orderBy: [{ memberId: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const firstMembershipIdByMember = new Map<string, string>();
  historyRows.forEach((row) => {
    if (!firstMembershipIdByMember.has(row.memberId)) {
      firstMembershipIdByMember.set(row.memberId, row.id);
    }
  });

  const expiringWindowDays = query.expiringInDays ?? 7;
  const expiringWindowEnd = addDays(startOfDay(now), expiringWindowDays + 1);

  let items = rows.map((row) => {
    const totalDue = asAmount(row.totalDue);
    const totalPaid = asAmount(row.totalPaid);
    const remaining = Math.max(0, roundCurrency(totalDue - totalPaid));
    const daysLeft = calcDaysLeft(now, row.endDate);
    const isActiveByStatus = row.status === MembershipStatus.ACTIVE;
    const isExpiringSoon = isActiveByStatus && row.endDate >= now && row.endDate < expiringWindowEnd;
    const lifecycle: MembershipLifecycle =
      firstMembershipIdByMember.get(row.memberId) === row.id ? "FIRST_TIME" : "RENEWAL";

    return {
      id: row.id,
      member: {
        id: row.member.id,
        code: row.member.code,
        firstName: row.member.firstName,
        lastName: row.member.lastName ?? null,
        fullName: formatMemberName(row.member.firstName, row.member.lastName),
        phone: row.member.phone ?? null,
      },
      plan: row.plan
        ? {
            id: row.plan.id,
            name: row.plan.name,
            durationValue: row.plan.durationValue,
            durationUnit: row.plan.durationUnit,
          }
        : null,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      createdAt: row.createdAt,
      activatedAt: row.activatedAt ?? null,
      autoRenew: row.autoRenew,
      totalDue,
      totalPaid,
      remaining,
      lifecycle,
      daysLeft,
      isExpiredByDate: row.endDate < now,
      isExpiringSoon,
    } satisfies MembershipReportItem;
  });

  if (query.remaining === "WITH_DEBT") {
    items = items.filter((item) => item.remaining > 0);
  } else if (query.remaining === "SETTLED") {
    items = items.filter((item) => item.remaining <= 0);
  }

  const expiringInDays = query.expiringInDays;
  if (expiringInDays !== undefined) {
    items = items.filter(
      (item) =>
        item.status === MembershipStatus.ACTIVE &&
        (item.daysLeft ?? Number.POSITIVE_INFINITY) <= expiringInDays &&
        (item.daysLeft ?? -1) >= 0
    );
  }

  const sorted = sortMembershipItems(items, query.sortBy, query.sortDir);
  const total = sorted.length;
  const pagedItems = sorted.slice(query.skip, query.skip + query.take);

  const summary = buildSummary(sorted, expiringWindowDays);
  const charts = buildCharts(sorted);

  return {
    generatedAt: now.toISOString(),
    filters: {
      preset: query.preset,
      dateField: query.dateField,
      from: range?.from?.toISOString() ?? null,
      to: range?.to?.toISOString() ?? null,
      status: query.status ?? null,
      planId: query.planId ?? null,
      memberId: query.memberId ?? null,
      search: search ?? null,
      remaining: query.remaining,
      autoRenew: query.autoRenew ?? null,
      expiringInDays: query.expiringInDays ?? null,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
    total,
    skip: query.skip,
    take: query.take,
    summary,
    charts,
    items: pagedItems,
  };
}

export async function getMembershipReportCsv(query: MembershipReportQuery) {
  return (await buildMembershipReportCsv(query)).csv;
}

export async function getAuditedMembershipReportCsv(
  query: MembershipReportQuery,
  context: MembershipReportExportContext
) {
  let exportResult: Awaited<ReturnType<typeof buildMembershipReportCsv>>;
  try {
    exportResult = await buildMembershipReportCsv(query);
  } catch (error) {
    await prisma.auditLog.create({
      data: buildMembershipReportExportAuditData(context, {
        success: false,
        metadata: {
          format: "CSV",
          rowCount: 0,
          outcome: "GENERATION_FAILED",
          filters: toSafeMembershipReportAuditFilters(query),
        },
      }),
    });
    throw error;
  }

  await prisma.auditLog.create({
    data: buildMembershipReportExportAuditData(context, {
      success: true,
      metadata: {
        format: "CSV",
        rowCount: exportResult.rowCount,
        outcome: "EXPORTED",
        filters: toSafeMembershipReportAuditFilters(query),
      },
    }),
  });

  return exportResult;
}

async function buildMembershipReportCsv(query: MembershipReportQuery) {
  const report = await getMembershipReport({
    ...query,
    skip: 0,
    take: Number.MAX_SAFE_INTEGER,
  });
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;

  const headers = [
    t("membershipId"),
    t("memberCode"),
    t("memberName"),
    t("phone"),
    t("plan"),
    t("status"),
    t("lifecycle"),
    t("startDate"),
    t("membershipEnd"),
    t("createdAt"),
    t("activatedAt"),
    t("autoRenew"),
    t("daysLeft"),
    t("totalDue"),
    t("totalPaid"),
    t("remaining"),
    t("expiringSoon"),
  ];

  const rows = report.items.map((item) => [
    item.id,
    item.member.code,
    item.member.fullName,
    item.member.phone ?? "",
    item.plan?.name ?? "",
    labels.membershipStatus(item.status),
    labels.membershipLifecycle(item.lifecycle),
    formatCsvDate(item.startDate),
    formatCsvDate(item.endDate),
    formatCsvDate(item.createdAt),
    item.activatedAt ? formatCsvDate(item.activatedAt) : "",
    labels.yesNo(item.autoRenew),
    item.daysLeft === null ? "" : String(item.daysLeft),
    item.totalDue.toFixed(2),
    item.totalPaid.toFixed(2),
    item.remaining.toFixed(2),
    labels.yesNo(item.isExpiringSoon),
  ]);

  return {
    csv: buildCsv([headers, ...rows]),
    rowCount: report.total,
  };
}

function buildMembershipReportExportAuditData(
  context: MembershipReportExportContext,
  input: {
    success: boolean;
    metadata: Prisma.InputJsonObject;
  }
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: "report.membership.exported",
    targetType: "MembershipReport",
    targetId: "membership-report",
    success: input.success,
    metadata: input.metadata,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  return data;
}

function toSafeMembershipReportAuditFilters(
  query: MembershipReportQuery
): Prisma.InputJsonObject {
  return {
    preset: query.preset,
    dateField: query.dateField,
    from: query.from ?? "",
    to: query.to ?? "",
    status: query.status ?? "",
    planId: query.planId ?? "",
    memberId: query.memberId ?? "",
    searchApplied: Boolean(query.search?.trim()),
    remaining: query.remaining,
    autoRenew: query.autoRenew ?? "",
    expiringInDays: query.expiringInDays ?? "",
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    language: query.lang,
  };
}

function buildSummary(items: MembershipReportItem[], expiringWindowDays: number) {
  const now = new Date();
  const counts = {
    [MembershipStatus.ACTIVE]: 0,
    [MembershipStatus.PENDING]: 0,
    [MembershipStatus.EXPIRED]: 0,
    [MembershipStatus.SUSPENDED]: 0,
    [MembershipStatus.CANCELLED]: 0,
  };

  let renewals = 0;
  let firstTimers = 0;
  let autoRenewEnabled = 0;
  let debtors = 0;
  let expiringSoon = 0;
  let totalDue = 0;
  let totalPaid = 0;
  let totalRemaining = 0;

  items.forEach((item) => {
    counts[item.status] += 1;
    if (item.lifecycle === "RENEWAL") renewals += 1;
    if (item.lifecycle === "FIRST_TIME") firstTimers += 1;
    if (item.autoRenew) autoRenewEnabled += 1;
    if (item.remaining > 0) debtors += 1;
    if (item.status === MembershipStatus.ACTIVE && item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= expiringWindowDays) {
      expiringSoon += 1;
    }
    totalDue += item.totalDue;
    totalPaid += item.totalPaid;
    totalRemaining += item.remaining;
  });

  const collectionRatePct = totalDue > 0 ? roundCurrency((totalPaid / totalDue) * 100) : 0;
  const averageDuePerMembership = items.length > 0 ? roundCurrency(totalDue / items.length) : 0;

  return {
    totalMemberships: items.length,
    active: counts[MembershipStatus.ACTIVE],
    pending: counts[MembershipStatus.PENDING],
    expired: counts[MembershipStatus.EXPIRED],
    suspended: counts[MembershipStatus.SUSPENDED],
    cancelled: counts[MembershipStatus.CANCELLED],
    renewals,
    firstTimers,
    autoRenewEnabled,
    expiringSoon,
    debtors,
    totalDue: roundCurrency(totalDue),
    totalPaid: roundCurrency(totalPaid),
    totalRemaining: roundCurrency(totalRemaining),
    collectionRatePct,
    averageDuePerMembership,
  };
}

function buildCharts(items: MembershipReportItem[]) {
  const statusMap = new Map<MembershipStatus, number>();
  const lifecycleMap = new Map<MembershipLifecycle, number>();
  const planMap = new Map<string, PlanStats>();
  const expiringBuckets = new Map<"0-7" | "8-30" | "31-60" | "61+", number>([
    ["0-7", 0],
    ["8-30", 0],
    ["31-60", 0],
    ["61+", 0],
  ]);

  const now = new Date();
  const monthBuckets = createMonthBuckets(now, 12);

  items.forEach((item) => {
    statusMap.set(item.status, (statusMap.get(item.status) ?? 0) + 1);
    lifecycleMap.set(item.lifecycle, (lifecycleMap.get(item.lifecycle) ?? 0) + 1);

    const planKey = item.plan?.id ?? "__no_plan__";
    const current = planMap.get(planKey) ?? {
      planId: item.plan?.id ?? "",
      planName: item.plan?.name ?? "-",
      memberships: 0,
      active: 0,
      totalDue: 0,
      totalPaid: 0,
      totalRemaining: 0,
    };
    current.memberships += 1;
    if (item.status === MembershipStatus.ACTIVE) current.active += 1;
    current.totalDue += item.totalDue;
    current.totalPaid += item.totalPaid;
    current.totalRemaining += item.remaining;
    planMap.set(planKey, current);

    if (item.status === MembershipStatus.ACTIVE && item.daysLeft !== null && item.daysLeft >= 0) {
      if (item.daysLeft <= 7) {
        expiringBuckets.set("0-7", (expiringBuckets.get("0-7") ?? 0) + 1);
      } else if (item.daysLeft <= 30) {
        expiringBuckets.set("8-30", (expiringBuckets.get("8-30") ?? 0) + 1);
      } else if (item.daysLeft <= 60) {
        expiringBuckets.set("31-60", (expiringBuckets.get("31-60") ?? 0) + 1);
      } else {
        expiringBuckets.set("61+", (expiringBuckets.get("61+") ?? 0) + 1);
      }
    }

    const monthKey = toMonthKey(item.createdAt);
    const point = monthBuckets.get(monthKey);
    if (point) {
      point.memberships += 1;
      if (item.lifecycle === "RENEWAL") {
        point.renewals += 1;
      } else {
        point.firstTimers += 1;
      }
      point.totalDue += item.totalDue;
      point.totalPaid += item.totalPaid;
      point.totalRemaining += item.remaining;
    }
  });

  const statusSplit = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const lifecycleSplit = (["FIRST_TIME", "RENEWAL"] as MembershipLifecycle[]).map((type) => ({
    type,
    count: lifecycleMap.get(type) ?? 0,
  }));

  const topPlans = Array.from(planMap.values())
    .map((plan) => ({
      ...plan,
      totalDue: roundCurrency(plan.totalDue),
      totalPaid: roundCurrency(plan.totalPaid),
      totalRemaining: roundCurrency(plan.totalRemaining),
    }))
    .sort((a, b) => {
      if (b.memberships !== a.memberships) return b.memberships - a.memberships;
      return b.totalDue - a.totalDue;
    })
    .slice(0, 6);

  const monthlyTrend = Array.from(monthBuckets.values()).map((point) => ({
    ...point,
    totalDue: roundCurrency(point.totalDue),
    totalPaid: roundCurrency(point.totalPaid),
    totalRemaining: roundCurrency(point.totalRemaining),
  }));

  const topDebtors = items
    .filter((item) => item.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)
    .slice(0, 5)
    .map((item) => ({
      membershipId: item.id,
      memberId: item.member.id,
      memberName: item.member.fullName,
      planName: item.plan?.name ?? null,
      remaining: item.remaining,
      endDate: item.endDate.toISOString(),
      daysLeft: item.daysLeft,
    }));

  return {
    statusSplit,
    lifecycleSplit,
    monthlyTrend,
    expiringBuckets: Array.from(expiringBuckets.entries()).map(([bucket, count]) => ({ bucket, count })),
    topPlans,
    topDebtors,
  };
}

function sortMembershipItems(
  items: MembershipReportItem[],
  sortBy: MembershipReportQuery["sortBy"],
  sortDir: MembershipReportQuery["sortDir"]
) {
  const sorted = [...items].sort((left, right) => {
    const factor = sortDir === "asc" ? 1 : -1;

    if (sortBy === "CREATED_AT") return factor * (left.createdAt.getTime() - right.createdAt.getTime());
    if (sortBy === "START_DATE") return factor * (left.startDate.getTime() - right.startDate.getTime());
    if (sortBy === "END_DATE") return factor * (left.endDate.getTime() - right.endDate.getTime());
    if (sortBy === "TOTAL_DUE") return factor * (left.totalDue - right.totalDue);
    if (sortBy === "TOTAL_PAID") return factor * (left.totalPaid - right.totalPaid);
    if (sortBy === "REMAINING") return factor * (left.remaining - right.remaining);
    if (sortBy === "DAYS_LEFT") {
      const leftDays = left.daysLeft ?? Number.POSITIVE_INFINITY;
      const rightDays = right.daysLeft ?? Number.POSITIVE_INFINITY;
      return factor * (leftDays - rightDays);
    }
    return 0;
  });

  return sorted;
}

function resolveDateRange(preset: MembershipReportQuery["preset"], fromInput?: string, toInput?: string) {
  const parsedFrom = parseDateInput(fromInput);
  const parsedTo = parseDateInput(toInput);
  if (parsedFrom || parsedTo) {
    let from = parsedFrom;
    let to = parsedTo;
    if (from && to && from > to) {
      const temp = from;
      from = to;
      to = temp;
    }
    return {
      from: from ? startOfDay(from) : undefined,
      to: to ? endOfDay(to) : undefined,
    };
  }

  const now = new Date();
  const start = startOfDay(now);

  if (preset === "ALL") {
    return null;
  }

  if (preset === "LAST_30_DAYS") {
    return { from: addDays(start, -30), to: endOfDay(now) };
  }
  if (preset === "LAST_90_DAYS") {
    return { from: addDays(start, -90), to: endOfDay(now) };
  }
  if (preset === "THIS_MONTH") {
    return { from: startOfMonth(now), to: endOfDay(now) };
  }
  if (preset === "LAST_MONTH") {
    const lastMonth = addMonths(now, -1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }

  return { from: startOfYear(now), to: endOfDay(now) };
}

function mapDateField(field: MembershipReportQuery["dateField"]) {
  if (field === "CREATED_AT") return "createdAt";
  if (field === "START_DATE") return "startDate";
  if (field === "END_DATE") return "endDate";
  return "activatedAt";
}

function createMonthBuckets(reference: Date, count: number) {
  const start = startOfMonth(addMonths(reference, -(count - 1)));
  const map = new Map<string, MonthlyTrendPoint>();
  for (let i = 0; i < count; i += 1) {
    const date = addMonths(start, i);
    const key = toMonthKey(date);
    map.set(key, {
      monthKey: key,
      label: date.toLocaleString("en-US", { month: "short", year: "numeric" }),
      memberships: 0,
      renewals: 0,
      firstTimers: 0,
      totalDue: 0,
      totalPaid: 0,
      totalRemaining: 0,
    });
  }
  return map;
}

function calcDaysLeft(now: Date, endDate: Date) {
  const today = startOfDay(now);
  const end = startOfDay(endDate);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function parseDateInput(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function buildCsv(rows: string[][]) {
  const serialized = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
  // Include UTF-8 BOM so spreadsheet tools render multilingual content correctly.
  return `\uFEFF${serialized}`;
}

function escapeCsvValue(value: string) {
  if (!value) return "";
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCsvDate(value: Date) {
  return value.toISOString();
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMemberName(firstName: string, lastName?: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function asAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}
