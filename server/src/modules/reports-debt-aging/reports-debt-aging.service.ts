import { MemberType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildXlsxBuffer, formatDateKey } from "../reports/shared/report-export.utils";
import { buildDebtBuckets, resolveDebtBucket, type DebtBucket } from "./debt-aging.logic";
import type { DebtAgingExportQuery, DebtAgingQuery } from "./reports-debt-aging.schemas";

type DebtAgingItem = {
  membershipId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  memberType: "STAFF" | "CUSTOMER";
  staffGroupName: string | null;
  planId: string | null;
  planName: string | null;
  status: string;
  referenceDate: string;
  startDate: string;
  endDate: string;
  due: number;
  paid: number;
  remaining: number;
  daysPastDue: number;
  bucket: string;
  lastPaymentDate: string | null;
};

type DebtAgingKpis = {
  totalOutstanding: number;
  countDebtors: number;
  avgDebt: number;
  largestDebt: number;
  collectionRate: number;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type DebtAgingReportResponse = {
  generatedAt: string;
  filters: {
    dateField: DebtAgingQuery["dateField"];
    from: string | null;
    to: string | null;
    status: string | null;
    planId: string | null;
    memberType: DebtAgingQuery["memberType"];
    staffGroupId: string | null;
    search: string | null;
    bucket1: number;
    bucket2: number;
    bucket3: number;
    sortBy: DebtAgingQuery["sortBy"];
    sortDir: DebtAgingQuery["sortDir"];
  };
  kpis: DebtAgingKpis;
  charts: {
    bucketTotals: Array<{ bucket: string; label: string; count: number; totalOutstanding: number }>;
    monthlyTrend: Array<{ monthKey: string; label: string; totalOutstanding: number; countDebtors: number }>;
  };
  items: DebtAgingItem[];
  pageInfo: PageInfo;
};

type DebtAgingDataset = {
  filters: DebtAgingReportResponse["filters"];
  items: DebtAgingItem[];
  kpis: DebtAgingKpis;
  charts: DebtAgingReportResponse["charts"];
  buckets: DebtBucket[];
};

export async function getDebtAgingReport(query: DebtAgingQuery): Promise<DebtAgingReportResponse> {
  const dataset = await buildDebtAgingDataset(query);
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

export async function getDebtAgingReportCsv(query: DebtAgingExportQuery): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildDebtAgingDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("member"),
    t("type"),
    t("plan"),
    t("status"),
    t("totalDue"),
    t("paid"),
    t("remaining"),
    t("daysPastDue"),
    t("bucket"),
    t("lastPaymentDate"),
  ];
  const rows = dataset.items.map((item) => [
    `${item.memberName} (#${item.memberCode})`,
    labels.memberType(item.memberType),
    item.planName ?? "-",
    labels.membershipStatus(item.status),
    item.due.toFixed(2),
    item.paid.toFixed(2),
    item.remaining.toFixed(2),
    item.daysPastDue,
    labels.debtBucket(bucketKeyFromLabel(item.bucket)),
    item.lastPaymentDate ? item.lastPaymentDate.slice(0, 10) : "",
  ]);

  return {
    csv: buildCsv(headers, rows),
    filename: `debt-aging-report-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getDebtAgingReportXlsx(
  query: DebtAgingExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDebtAgingDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;

  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("totalOutstanding"), dataset.kpis.totalOutstanding],
    [t("debtorsCount"), dataset.kpis.countDebtors],
    [t("averageDebt"), dataset.kpis.avgDebt],
    [t("largestDebt"), dataset.kpis.largestDebt],
    [t("collectionRate"), dataset.kpis.collectionRate],
    [t("dateField"), labels.debtDateField(dataset.filters.dateField)],
    [t("from"), dataset.filters.from ?? "-"],
    [t("to"), dataset.filters.to ?? "-"],
  ];

  const tableRows: Array<Array<string | number>> = [
    [t("member"), t("type"), t("plan"), t("status"), t("totalDue"), t("paid"), t("remaining"), t("daysPastDue"), t("bucket"), t("lastPaymentDate")],
    ...dataset.items.map((item) => [
      `${item.memberName} (#${item.memberCode})`,
      labels.memberType(item.memberType),
      item.planName ?? "-",
      labels.membershipStatus(item.status),
      item.due,
      item.paid,
      item.remaining,
      item.daysPastDue,
      labels.debtBucket(bucketKeyFromLabel(item.bucket)),
      item.lastPaymentDate ? item.lastPaymentDate.slice(0, 10) : "",
    ]),
  ];

  const bucketRows: Array<Array<string | number>> = [
    [t("bucket"), t("count"), t("outstanding")],
    ...dataset.charts.bucketTotals.map((item) => [labels.debtBucket(item.bucket), item.count, item.totalOutstanding]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    { name: t("buckets"), rows: bucketRows },
    { name: t("debtors"), rows: tableRows },
  ]);

  return {
    buffer,
    filename: `debt-aging-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: dataset.items.length,
  };
}

async function buildDebtAgingDataset(query: DebtAgingExportQuery | DebtAgingQuery): Promise<DebtAgingDataset> {
  const now = startOfDay(new Date());
  const fromDate = query.from ? parseDateInput(query.from, "from", false) : null;
  const toDate = query.to ? parseDateInput(query.to, "to", true) : null;
  if (fromDate && toDate && fromDate > toDate) {
    throw new HttpError(400, "Invalid date range", { from: query.from, to: query.to });
  }

  const dateField = mapDateField(query.dateField);
  const buckets = buildDebtBuckets(query.bucket1, query.bucket2, query.bucket3);
  const search = query.search?.trim();

  const memberTypeWhere = buildMemberTypeWhere(query.memberType);

  const where: Prisma.MembershipWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.planId ? { planId: query.planId } : {}),
    member: {
      ...memberTypeWhere,
      ...(query.staffGroupId ? { staffGroupId: query.staffGroupId } : {}),
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

  if (fromDate || toDate) {
    (where as Record<string, unknown>)[dateField] = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const rows = await prisma.membership.findMany({
    where,
    include: {
      member: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          phone: true,
          memberType: true,
          isStaff: true,
          staffGroup: { select: { name: true } },
        },
      },
      plan: { select: { id: true, name: true } },
      payments: {
        where: { status: PaymentStatus.PAID, paidAt: { not: null } },
        orderBy: { paidAt: "desc" },
        take: 1,
        select: { paidAt: true },
      },
    },
  });

  const items: DebtAgingItem[] = [];
  const bucketTotals = new Map<string, { label: string; count: number; totalOutstanding: number }>();
  const monthlyTrend = new Map<string, { monthKey: string; label: string; totalOutstanding: number; countDebtors: number }>();

  let totalOutstanding = 0;
  let largestDebt = 0;
  let totalDue = 0;
  let totalPaid = 0;

  rows.forEach((row) => {
    const due = asAmount(row.totalDue);
    const paid = asAmount(row.totalPaid);
    const remaining = Math.max(0, roundCurrency(due - paid));
    if (remaining <= 0) return;

    const memberName = formatMemberName(row.member.firstName, row.member.lastName);
    const referenceDate = resolveReferenceDate(row, query.dateField);
    const daysPastDue = Math.max(0, diffDays(now, referenceDate));
    const bucket = resolveDebtBucket(daysPastDue, buckets);

    totalOutstanding += remaining;
    totalDue += due;
    totalPaid += paid;
    if (remaining > largestDebt) largestDebt = remaining;

    const existingBucket = bucketTotals.get(bucket.key) ?? {
      label: bucket.label,
      count: 0,
      totalOutstanding: 0,
    };
    existingBucket.count += 1;
    existingBucket.totalOutstanding += remaining;
    bucketTotals.set(bucket.key, existingBucket);

    const monthKey = toMonthKey(referenceDate);
    const monthLabel = monthKey;
    const monthPoint = monthlyTrend.get(monthKey) ?? {
      monthKey,
      label: monthLabel,
      totalOutstanding: 0,
      countDebtors: 0,
    };
    monthPoint.totalOutstanding += remaining;
    monthPoint.countDebtors += 1;
    monthlyTrend.set(monthKey, monthPoint);

    items.push({
      membershipId: row.id,
      memberId: row.member.id,
      memberCode: row.member.code,
      memberName,
      memberPhone: row.member.phone ?? null,
      memberType: row.member.memberType === MemberType.STAFF || row.member.isStaff ? "STAFF" : "CUSTOMER",
      staffGroupName: row.member.staffGroup?.name ?? null,
      planId: row.planId,
      planName: row.plan?.name ?? null,
      status: row.status,
      referenceDate: referenceDate.toISOString(),
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      due,
      paid,
      remaining,
      daysPastDue,
      bucket: bucket.label,
      lastPaymentDate: row.payments[0]?.paidAt?.toISOString() ?? null,
    });
  });

  const sortedItems = sortItems(items, query.sortBy, query.sortDir);
  const countDebtors = sortedItems.length;
  const avgDebt = countDebtors ? roundCurrency(totalOutstanding / countDebtors) : 0;
  const collectionRate = totalDue > 0 ? roundPercent((totalPaid / totalDue) * 100) : 0;

  const normalizedBuckets = buckets.map((bucket) => {
    const data = bucketTotals.get(bucket.key);
    return {
      bucket: bucket.key,
      label: bucket.label,
      count: data?.count ?? 0,
      totalOutstanding: roundCurrency(data?.totalOutstanding ?? 0),
    };
  });

  const trend = Array.from(monthlyTrend.values())
    .sort((left, right) => (left.monthKey < right.monthKey ? -1 : 1))
    .map((item) => ({
      monthKey: item.monthKey,
      label: item.label,
      totalOutstanding: roundCurrency(item.totalOutstanding),
      countDebtors: item.countDebtors,
    }));

  return {
    filters: {
      dateField: query.dateField,
      from: fromDate ? formatDateKey(fromDate) : null,
      to: toDate ? formatDateKey(toDate) : null,
      status: query.status ?? null,
      planId: query.planId ?? null,
      memberType: query.memberType,
      staffGroupId: query.staffGroupId ?? null,
      search: search ?? null,
      bucket1: query.bucket1,
      bucket2: query.bucket2,
      bucket3: query.bucket3,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
    items: sortedItems,
    kpis: {
      totalOutstanding: roundCurrency(totalOutstanding),
      countDebtors,
      avgDebt,
      largestDebt: roundCurrency(largestDebt),
      collectionRate,
    },
    charts: {
      bucketTotals: normalizedBuckets,
      monthlyTrend: trend,
    },
    buckets,
  };
}

function buildMemberTypeWhere(memberType: DebtAgingQuery["memberType"]): Prisma.MemberWhereInput {
  if (memberType === "customer") {
    return { memberType: MemberType.CUSTOMER, isStaff: false };
  }
  if (memberType === "staff") {
    return {
      OR: [{ memberType: MemberType.STAFF }, { isStaff: true }],
    };
  }
  return {};
}

function mapDateField(dateField: DebtAgingQuery["dateField"]) {
  if (dateField === "CREATED_AT") return "createdAt";
  if (dateField === "START_DATE") return "startDate";
  if (dateField === "ACTIVATED_AT") return "activatedAt";
  return "endDate";
}

function resolveReferenceDate(
  row: {
    createdAt: Date;
    startDate: Date;
    endDate: Date;
    activatedAt: Date | null;
  },
  dateField: DebtAgingQuery["dateField"]
) {
  if (dateField === "CREATED_AT") return row.createdAt;
  if (dateField === "START_DATE") return row.startDate;
  if (dateField === "ACTIVATED_AT") return row.activatedAt ?? row.endDate;
  return row.endDate;
}

function sortItems(items: DebtAgingItem[], sortBy: DebtAgingQuery["sortBy"], sortDir: DebtAgingQuery["sortDir"]) {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (sortBy === "daysPastDue") return factor * (left.daysPastDue - right.daysPastDue || right.remaining - left.remaining);
    if (sortBy === "memberName") return factor * left.memberName.localeCompare(right.memberName);
    if (sortBy === "status") return factor * left.status.localeCompare(right.status);
    if (sortBy === "endDate") return factor * (new Date(left.endDate).getTime() - new Date(right.endDate).getTime());
    return factor * (left.remaining - right.remaining || left.daysPastDue - right.daysPastDue);
  });
}

function parseDateInput(value: string, field: string, endOfDay: boolean): Date {
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateOnly.test(value)) {
    const [yearStr = "0", monthStr = "0", dayStr = "0"] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const parsed = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
  }
  return parsed;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function diffDays(later: Date, earlier: Date) {
  const laterStart = startOfDay(later);
  const earlierStart = startOfDay(earlier);
  return Math.floor((laterStart.getTime() - earlierStart.getTime()) / 86400000);
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function bucketKeyFromLabel(label: string) {
  return label.replace(/ days$/u, "");
}
