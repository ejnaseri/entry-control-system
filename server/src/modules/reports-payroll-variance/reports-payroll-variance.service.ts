import { MemberType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildXlsxBuffer } from "../reports/shared/report-export.utils";
import { resolveVarianceBucket, type VarianceBucket } from "./payroll-variance.logic";
import type { PayrollVarianceExportQuery, PayrollVarianceQuery } from "./reports-payroll-variance.schemas";

type PayrollVariancePayment = {
  id: string;
  amount: number;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type PayrollVarianceBreakdown = {
  baseAmount: number;
  deductions: number;
  additions: number;
  totalAdjustment: number;
  suggestedPay: number;
  absentDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedDays: number;
} | null;

export type PayrollVarianceItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  staffGroupName: string | null;
  period: { year: number; month: number };
  suggestedPay: number;
  actualPaid: number;
  variance: number;
  absoluteVariance: number;
  varianceRate: number;
  varianceReason: string | null;
  paymentStatus: string;
  payments: PayrollVariancePayment[];
  breakdown: PayrollVarianceBreakdown;
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type PayrollVarianceReportResponse = {
  generatedAt: string;
  filters: {
    year: number;
    month: number;
    memberId: string | null;
    staffGroupId: string | null;
    search: string | null;
    sortBy: PayrollVarianceQuery["sortBy"];
    sortDir: PayrollVarianceQuery["sortDir"];
    smallThreshold: number;
    mediumThreshold: number;
  };
  kpis: {
    totalSuggested: number;
    totalPaid: number;
    totalVariance: number;
    varianceRate: number;
    topVarianceEmployees: Array<{ memberId: string; memberName: string; variance: number }>;
  };
  charts: {
    suggestedVsPaid: Array<{ label: string; suggested: number; paid: number; variance: number }>;
    varianceBuckets: Record<VarianceBucket, number>;
  };
  items: PayrollVarianceItem[];
  pageInfo: PageInfo;
};

type PayrollVarianceDataset = {
  filters: PayrollVarianceReportResponse["filters"];
  kpis: PayrollVarianceReportResponse["kpis"];
  charts: PayrollVarianceReportResponse["charts"];
  items: PayrollVarianceItem[];
};

export async function getPayrollVarianceReport(query: PayrollVarianceQuery): Promise<PayrollVarianceReportResponse> {
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

export async function getPayrollVarianceCsv(query: PayrollVarianceExportQuery): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [t("employee"), t("period"), t("suggestedPay"), t("actualPaid"), t("variance"), t("varianceReason"), t("paymentStatus")];
  const rows = dataset.items.map((item) => [
    `${item.memberName} (#${item.memberCode})`,
    `${item.period.year}-${String(item.period.month).padStart(2, "0")}`,
    item.suggestedPay.toFixed(2),
    item.actualPaid.toFixed(2),
    item.variance.toFixed(2),
    item.varianceReason ?? "",
    labels.paymentStatus(item.paymentStatus),
  ]);

  return {
    csv: buildCsv(headers, rows),
    filename: `payroll-variance-report-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getPayrollVarianceXlsx(
  query: PayrollVarianceExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("totalSuggested"), dataset.kpis.totalSuggested],
    [t("totalPaid"), dataset.kpis.totalPaid],
    [t("totalVariance"), dataset.kpis.totalVariance],
    [t("varianceRatePct"), dataset.kpis.varianceRate],
    [t("month"), `${dataset.filters.year}-${String(dataset.filters.month).padStart(2, "0")}`],
  ];
  const tableRows: Array<Array<string | number>> = [
    [t("employee"), t("period"), t("suggestedPay"), t("actualPaid"), t("variance"), t("varianceRatePct"), t("varianceReason"), t("paymentStatus")],
    ...dataset.items.map((item) => [
      `${item.memberName} (#${item.memberCode})`,
      `${item.period.year}-${String(item.period.month).padStart(2, "0")}`,
      item.suggestedPay,
      item.actualPaid,
      item.variance,
      item.varianceRate,
      item.varianceReason ?? "",
      labels.paymentStatus(item.paymentStatus),
    ]),
  ];
  const chartRows: Array<Array<string | number>> = [
    [t("label"), t("suggestedPay"), t("paid"), t("variance")],
    ...dataset.charts.suggestedVsPaid.map((row) => [row.label, row.suggested, row.paid, row.variance]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    { name: t("trend"), rows: chartRows },
    { name: t("variance"), rows: tableRows },
  ]);

  return {
    buffer,
    filename: `payroll-variance-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: dataset.items.length,
  };
}

async function buildDataset(query: PayrollVarianceExportQuery | PayrollVarianceQuery): Promise<PayrollVarianceDataset> {
  const search = query.search?.trim();

  const rows = await prisma.payrollPeriod.findMany({
    where: {
      year: query.year,
      month: query.month,
      ...(query.memberId ? { memberId: query.memberId } : {}),
      member: {
        OR: [{ memberType: MemberType.STAFF }, { isStaff: true }],
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
    },
    include: {
      member: {
        select: {
          id: true,
          code: true,
          firstName: true,
          lastName: true,
          staffGroup: { select: { name: true } },
        },
      },
      payments: {
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          status: true,
          paidAt: true,
          notes: true,
          createdAt: true,
          breakdown: true,
        },
      },
    },
  });

  const items: PayrollVarianceItem[] = rows.map((row) => {
    const payments = row.payments.map((payment) => ({
      id: payment.id,
      amount: asAmount(payment.amount),
      status: payment.status,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      notes: payment.notes ?? null,
      createdAt: payment.createdAt.toISOString(),
    }));

    const actualPaid = roundCurrency(
      row.payments.reduce((sum, payment) => {
        if (payment.status !== PaymentStatus.PAID) return sum;
        return sum + asAmount(payment.amount);
      }, 0)
    );

    const latestWithBreakdown = row.payments.find((payment) => payment.breakdown && typeof payment.breakdown === "object");
    const breakdown = mapBreakdown(latestWithBreakdown?.breakdown ?? null);
    const suggestedPay = roundCurrency(
      breakdown?.suggestedPay ??
        (latestWithBreakdown?.breakdown ? extractSuggestedFromBreakdown(latestWithBreakdown.breakdown, asAmount(row.totalDue)) : asAmount(row.totalDue))
    );

    const variance = roundCurrency(actualPaid - suggestedPay);
    const absoluteVariance = roundCurrency(Math.abs(variance));
    const varianceRate = suggestedPay > 0 ? roundPercent((variance / suggestedPay) * 100) : 0;

    const latestPayment = row.payments[0];
    const varianceReason = latestPayment?.notes ?? null;
    const paymentStatus = latestPayment?.status ?? row.status;

    return {
      memberId: row.memberId,
      memberCode: row.member.code,
      memberName: formatMemberName(row.member.firstName, row.member.lastName),
      staffGroupName: row.member.staffGroup?.name ?? null,
      period: { year: row.year, month: row.month },
      suggestedPay,
      actualPaid,
      variance,
      absoluteVariance,
      varianceRate,
      varianceReason,
      paymentStatus,
      payments,
      breakdown,
    };
  });

  const sorted = sortItems(items, query.sortBy, query.sortDir);

  const totalSuggested = roundCurrency(sorted.reduce((sum, item) => sum + item.suggestedPay, 0));
  const totalPaid = roundCurrency(sorted.reduce((sum, item) => sum + item.actualPaid, 0));
  const totalVariance = roundCurrency(totalPaid - totalSuggested);
  const varianceRate = totalSuggested > 0 ? roundPercent((totalVariance / totalSuggested) * 100) : 0;

  const topVarianceEmployees = [...sorted]
    .sort((left, right) => right.absoluteVariance - left.absoluteVariance)
    .slice(0, 5)
    .map((item) => ({ memberId: item.memberId, memberName: item.memberName, variance: item.variance }));

  const suggestedVsPaid = [...sorted]
    .sort((left, right) => right.absoluteVariance - left.absoluteVariance)
    .slice(0, 12)
    .map((item) => ({
      label: item.memberName,
      suggested: item.suggestedPay,
      paid: item.actualPaid,
      variance: item.variance,
    }));

  const varianceBuckets: Record<VarianceBucket, number> = {
    zero: 0,
    small: 0,
    medium: 0,
    large: 0,
  };
  sorted.forEach((item) => {
    const bucket = resolveVarianceBucket(item.variance, query.smallThreshold, query.mediumThreshold);
    varianceBuckets[bucket] += 1;
  });

  return {
    filters: {
      year: query.year,
      month: query.month,
      memberId: query.memberId ?? null,
      staffGroupId: query.staffGroupId ?? null,
      search: search ?? null,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      smallThreshold: query.smallThreshold,
      mediumThreshold: query.mediumThreshold,
    },
    kpis: {
      totalSuggested,
      totalPaid,
      totalVariance,
      varianceRate,
      topVarianceEmployees,
    },
    charts: {
      suggestedVsPaid,
      varianceBuckets,
    },
    items: sorted,
  };
}

function mapBreakdown(value: Prisma.JsonValue | null): PayrollVarianceBreakdown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return {
    baseAmount: toFiniteNumber(raw["baseAmount"]),
    deductions: toFiniteNumber(raw["deductions"]),
    additions: toFiniteNumber(raw["additions"]),
    totalAdjustment: toFiniteNumber(raw["totalAdjustment"]),
    suggestedPay: toFiniteNumber(raw["suggestedPay"]),
    absentDays: toFiniteNumber(raw["absentDays"]),
    lateMinutes: toFiniteNumber(raw["lateMinutes"]),
    earlyLeaveMinutes: toFiniteNumber(raw["earlyLeaveMinutes"]),
    overtimeMinutes: toFiniteNumber(raw["overtimeMinutes"]),
    justifiedDays: toFiniteNumber(raw["justifiedDays"]),
  };
}

function extractSuggestedFromBreakdown(value: Prisma.JsonValue, fallback: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const suggested = (value as Record<string, unknown>)["suggestedPay"];
  if (typeof suggested === "number" && Number.isFinite(suggested)) return suggested;
  if (typeof suggested === "string") {
    const parsed = Number(suggested);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function sortItems(items: PayrollVarianceItem[], sortBy: PayrollVarianceQuery["sortBy"], sortDir: PayrollVarianceQuery["sortDir"]) {
  const factor = sortDir === "asc" ? 1 : -1;
  return [...items].sort((left, right) => {
    if (sortBy === "variance") return factor * (left.variance - right.variance || right.absoluteVariance - left.absoluteVariance);
    if (sortBy === "suggestedPay") return factor * (left.suggestedPay - right.suggestedPay || left.actualPaid - right.actualPaid);
    if (sortBy === "actualPaid") return factor * (left.actualPaid - right.actualPaid || left.suggestedPay - right.suggestedPay);
    if (sortBy === "memberName") return factor * left.memberName.localeCompare(right.memberName);
    return factor * (left.absoluteVariance - right.absoluteVariance || left.variance - right.variance);
  });
}

function asAmount(value: Prisma.Decimal | number) {
  return typeof value === "number" ? value : Number(value);
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
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
