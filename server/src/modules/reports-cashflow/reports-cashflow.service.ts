import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { getReportExportLabels } from "../reports/shared/report-export.i18n";
import { buildCsv, buildFilenameStamp, buildXlsxBuffer, formatDateKey } from "../reports/shared/report-export.utils";
import type { CashflowExportQuery, CashflowGroupBy, CashflowQuery } from "./reports-cashflow.schemas";

export type CashflowTrendRow = {
  periodKey: string;
  label: string;
  inflow: number;
  refunds: number;
  membershipNet: number;
  expenseOutflow: number;
  expenseAdjustments: number;
  expenseNetOutflow: number;
  payrollOutflow: number;
  totalOutflow: number;
  netCash: number;
};

export type CashflowExpenseCategoryRow = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
  sharePct: number;
};

export type CashflowReportResponse = {
  generatedAt: string;
  filters: {
    from: string;
    to: string;
    groupBy: CashflowGroupBy;
    includePayroll: boolean;
  };
  summary: {
    membershipInflow: number;
    membershipRefunds: number;
    membershipNet: number;
    expenseGrossOutflow: number;
    expenseAdjustments: number;
    expenseNetOutflow: number;
    payrollOutflow: number;
    totalOutflow: number;
    netCash: number;
    transactionCounts: {
      membershipPayments: number;
      expenseEntries: number;
      payrollPayments: number;
    };
  };
  charts: {
    trend: CashflowTrendRow[];
    expenseByCategory: CashflowExpenseCategoryRow[];
  };
};

type CashflowDataset = Omit<CashflowReportResponse, "generatedAt">;

type TrendAccumulator = Omit<CashflowTrendRow, "totalOutflow" | "netCash" | "membershipNet"> & {
  membershipNet: number;
  totalOutflow: number;
  netCash: number;
};

type PeriodAxisItem = {
  key: string;
  label: string;
};

type CategoryAccumulator = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
};

export async function getCashflowReport(query: CashflowQuery): Promise<CashflowReportResponse> {
  const dataset = await buildDataset(query);
  return {
    generatedAt: new Date().toISOString(),
    ...dataset,
  };
}

export async function getCashflowCsv(query: CashflowExportQuery): Promise<{ csv: string; filename: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;
  const headers = [
    t("period"),
    t("inflow"),
    t("refunds"),
    t("membershipNet"),
    t("expensesGross"),
    t("expenseAdjustments"),
    t("expensesNet"),
    t("payrollOutflow"),
    t("totalOutflow"),
    t("netCash"),
  ];
  const rows = dataset.charts.trend.map((row) => [
    row.label,
    row.inflow.toFixed(2),
    row.refunds.toFixed(2),
    row.membershipNet.toFixed(2),
    row.expenseOutflow.toFixed(2),
    row.expenseAdjustments.toFixed(2),
    row.expenseNetOutflow.toFixed(2),
    row.payrollOutflow.toFixed(2),
    row.totalOutflow.toFixed(2),
    row.netCash.toFixed(2),
  ]);

  return {
    csv: buildCsv(headers, rows),
    filename: `cashflow-report-${buildFilenameStamp(new Date())}.csv`,
    rowCount: rows.length,
  };
}

export async function getCashflowXlsx(
  query: CashflowExportQuery
): Promise<{ buffer: Buffer; filename: string; contentType: string; rowCount: number }> {
  const dataset = await buildDataset(query);
  const labels = getReportExportLabels(query.lang);
  const t = labels.t;

  const summaryRows: Array<Array<string | number>> = [
    [t("metric"), t("value")],
    [t("from"), dataset.filters.from],
    [t("to"), dataset.filters.to],
    [t("groupBy"), dataset.filters.groupBy],
    [t("includePayroll"), labels.yesNo(dataset.filters.includePayroll)],
    [t("membershipInflow"), dataset.summary.membershipInflow],
    [t("membershipRefunds"), dataset.summary.membershipRefunds],
    [t("membershipNet"), dataset.summary.membershipNet],
    [t("expensesGross"), dataset.summary.expenseGrossOutflow],
    [t("adjustments"), dataset.summary.expenseAdjustments],
    [t("expensesNet"), dataset.summary.expenseNetOutflow],
    [t("payrollOutflow"), dataset.summary.payrollOutflow],
    [t("totalOutflow"), dataset.summary.totalOutflow],
    [t("netCash"), dataset.summary.netCash],
  ];

  const trendRows: Array<Array<string | number>> = [
    [
      t("period"),
      t("inflow"),
      t("refunds"),
      t("membershipNet"),
      t("expensesGross"),
      t("expenseAdjustments"),
      t("expensesNet"),
      t("payrollOutflow"),
      t("totalOutflow"),
      t("netCash"),
    ],
    ...dataset.charts.trend.map((row) => [
      row.label,
      row.inflow,
      row.refunds,
      row.membershipNet,
      row.expenseOutflow,
      row.expenseAdjustments,
      row.expenseNetOutflow,
      row.payrollOutflow,
      row.totalOutflow,
      row.netCash,
    ]),
  ];

  const expenseRows: Array<Array<string | number>> = [
    [t("category"), t("grossOutflow"), t("adjustments"), t("netOutflow"), t("sharePct")],
    ...dataset.charts.expenseByCategory.map((item) => [
      item.categoryName,
      item.grossOutflow,
      item.adjustments,
      item.netOutflow,
      item.sharePct,
    ]),
  ];

  const buffer = buildXlsxBuffer([
    { name: t("summary"), rows: summaryRows },
    { name: t("trend"), rows: trendRows },
    { name: t("expenses"), rows: expenseRows },
  ]);

  return {
    buffer,
    filename: `cashflow-report-${buildFilenameStamp(new Date())}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    rowCount: dataset.charts.trend.length,
  };
}

async function buildDataset(query: CashflowQuery | CashflowExportQuery): Promise<CashflowDataset> {
  const { fromDate, toExclusive } = resolveDateRange(query.from, query.to);
  const toDate = addDays(toExclusive, -1);
  const axis = buildPeriodAxis(fromDate, toDate, query.groupBy);
  const trendMap = new Map<string, TrendAccumulator>();
  axis.forEach((period) => {
    trendMap.set(period.key, createEmptyTrend(period.key, period.label));
  });
  const categoryMap = new Map<string, CategoryAccumulator>();

  const paymentsPromise = prisma.payment.findMany({
    where: {
      status: PaymentStatus.PAID,
      OR: [
        { paidAt: { gte: fromDate, lt: toExclusive } },
        { paidAt: null, createdAt: { gte: fromDate, lt: toExclusive } },
      ],
    },
    select: {
      amount: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const expensesPromise: Promise<
    Array<{ amount: Prisma.Decimal | number; occurredAt: Date; categoryId: string; categoryName: string; categorySlug: string }>
  > = prisma.$queryRawUnsafe(
    `
      SELECT
        e."amount"::numeric::float8 AS "amount",
        e."occurredAt",
        e."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE e."occurredAt" >= $1 AND e."occurredAt" < $2
    `,
    fromDate,
    toExclusive
  );

  const payrollPromise: Promise<Array<{ amount: Prisma.Decimal; paidAt: Date | null; createdAt: Date }>> = query.includePayroll
    ? prisma.payrollPayment.findMany({
        where: {
          status: PaymentStatus.PAID,
          OR: [
            { paidAt: { gte: fromDate, lt: toExclusive } },
            { paidAt: null, createdAt: { gte: fromDate, lt: toExclusive } },
          ],
        },
        select: {
          amount: true,
          paidAt: true,
          createdAt: true,
        },
      })
    : Promise.resolve([]);

  const [payments, expenses, payrollRows] = await Promise.all([paymentsPromise, expensesPromise, payrollPromise]);

  let membershipInflow = 0;
  let membershipRefunds = 0;
  let expenseGrossOutflow = 0;
  let expenseAdjustments = 0;
  let expenseNetOutflow = 0;
  let payrollOutflow = 0;

  for (const payment of payments) {
    const occurredAt = payment.paidAt ?? payment.createdAt;
    const key = resolvePeriodKey(occurredAt, query.groupBy);
    const trend = trendMap.get(key);
    if (!trend) continue;

    const amount = asAmount(payment.amount);
    if (amount >= 0) {
      trend.inflow += amount;
      membershipInflow += amount;
    } else {
      const refund = Math.abs(amount);
      trend.refunds += refund;
      membershipRefunds += refund;
    }
    trend.membershipNet += amount;
  }

  for (const expense of expenses) {
    const key = resolvePeriodKey(expense.occurredAt, query.groupBy);
    const trend = trendMap.get(key);
    if (!trend) continue;

    const amount = asAmount(expense.amount);
    const category = ensureCategoryAccumulator(categoryMap, expense.categoryId, expense.categoryName, expense.categorySlug);

    if (amount >= 0) {
      trend.expenseOutflow += amount;
      category.grossOutflow += amount;
      expenseGrossOutflow += amount;
    } else {
      const adjustment = Math.abs(amount);
      trend.expenseAdjustments += adjustment;
      category.adjustments += adjustment;
      expenseAdjustments += adjustment;
    }

    trend.expenseNetOutflow += amount;
    category.netOutflow += amount;
    expenseNetOutflow += amount;
  }

  for (const payroll of payrollRows) {
    const occurredAt = payroll.paidAt ?? payroll.createdAt;
    const key = resolvePeriodKey(occurredAt, query.groupBy);
    const trend = trendMap.get(key);
    if (!trend) continue;

    const amount = Math.abs(asAmount(payroll.amount));
    trend.payrollOutflow += amount;
    payrollOutflow += amount;
  }

  const trend = axis.map((period) => normalizeTrend(trendMap.get(period.key) ?? createEmptyTrend(period.key, period.label)));
  const expenseByCategory = buildCategoryRows(categoryMap);

  const membershipNet = roundCurrency(membershipInflow - membershipRefunds);
  const totalOutflow = roundCurrency(expenseNetOutflow + payrollOutflow + membershipRefunds);
  const netCash = roundCurrency(membershipInflow - totalOutflow);

  return {
    filters: {
      from: formatDateKey(fromDate),
      to: formatDateKey(toDate),
      groupBy: query.groupBy,
      includePayroll: query.includePayroll,
    },
    summary: {
      membershipInflow: roundCurrency(membershipInflow),
      membershipRefunds: roundCurrency(membershipRefunds),
      membershipNet,
      expenseGrossOutflow: roundCurrency(expenseGrossOutflow),
      expenseAdjustments: roundCurrency(expenseAdjustments),
      expenseNetOutflow: roundCurrency(expenseNetOutflow),
      payrollOutflow: roundCurrency(payrollOutflow),
      totalOutflow,
      netCash,
      transactionCounts: {
        membershipPayments: payments.length,
        expenseEntries: expenses.length,
        payrollPayments: payrollRows.length,
      },
    },
    charts: {
      trend,
      expenseByCategory,
    },
  };
}

function buildCategoryRows(map: Map<string, CategoryAccumulator>): CashflowExpenseCategoryRow[] {
  const rows = Array.from(map.values())
    .map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categorySlug: item.categorySlug,
      grossOutflow: roundCurrency(item.grossOutflow),
      adjustments: roundCurrency(item.adjustments),
      netOutflow: roundCurrency(item.netOutflow),
      sharePct: 0,
    }))
    .filter((row) => row.netOutflow > 0);

  const shareBase = rows.reduce((sum, row) => sum + row.netOutflow, 0);
  const withShare = rows.map((row) => ({
    ...row,
    sharePct: shareBase > 0 ? roundPercent((row.netOutflow / shareBase) * 100) : 0,
  }));

  return withShare.sort((left, right) => {
    if (right.netOutflow !== left.netOutflow) return right.netOutflow - left.netOutflow;
    if (right.grossOutflow !== left.grossOutflow) return right.grossOutflow - left.grossOutflow;
    return left.categoryName.localeCompare(right.categoryName);
  });
}

function normalizeTrend(row: TrendAccumulator): CashflowTrendRow {
  const inflow = roundCurrency(row.inflow);
  const refunds = roundCurrency(row.refunds);
  const membershipNet = roundCurrency(inflow - refunds);
  const expenseOutflow = roundCurrency(row.expenseOutflow);
  const expenseAdjustments = roundCurrency(row.expenseAdjustments);
  const expenseNetOutflow = roundCurrency(row.expenseNetOutflow);
  const payrollOutflow = roundCurrency(row.payrollOutflow);
  const totalOutflow = roundCurrency(expenseNetOutflow + payrollOutflow + refunds);
  const netCash = roundCurrency(inflow - totalOutflow);

  return {
    periodKey: row.periodKey,
    label: row.label,
    inflow,
    refunds,
    membershipNet,
    expenseOutflow,
    expenseAdjustments,
    expenseNetOutflow,
    payrollOutflow,
    totalOutflow,
    netCash,
  };
}

function ensureCategoryAccumulator(
  map: Map<string, CategoryAccumulator>,
  categoryId: string,
  categoryName: string,
  categorySlug: string
) {
  const existing = map.get(categoryId);
  if (existing) return existing;
  const created: CategoryAccumulator = {
    categoryId,
    categoryName,
    categorySlug,
    grossOutflow: 0,
    adjustments: 0,
    netOutflow: 0,
  };
  map.set(categoryId, created);
  return created;
}

function createEmptyTrend(periodKey: string, label: string): TrendAccumulator {
  return {
    periodKey,
    label,
    inflow: 0,
    refunds: 0,
    membershipNet: 0,
    expenseOutflow: 0,
    expenseAdjustments: 0,
    expenseNetOutflow: 0,
    payrollOutflow: 0,
    totalOutflow: 0,
    netCash: 0,
  };
}

function buildPeriodAxis(fromDate: Date, toDate: Date, groupBy: CashflowGroupBy): PeriodAxisItem[] {
  if (toDate < fromDate) return [];
  if (groupBy === "week") {
    const rows: PeriodAxisItem[] = [];
    const start = startOfWeek(fromDate);
    const end = startOfWeek(toDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatDateKey(cursor);
      rows.push({ key, label: key });
      cursor.setDate(cursor.getDate() + 7);
    }
    return rows;
  }

  if (groupBy === "month") {
    const rows: PeriodAxisItem[] = [];
    const start = startOfMonth(fromDate);
    const end = startOfMonth(toDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = formatMonthKey(cursor);
      rows.push({ key, label: key });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return rows;
  }

  const rows: PeriodAxisItem[] = [];
  const cursor = startOfDay(fromDate);
  while (cursor <= toDate) {
    const key = formatDateKey(cursor);
    rows.push({ key, label: key });
    cursor.setDate(cursor.getDate() + 1);
  }
  return rows;
}

function resolvePeriodKey(date: Date, groupBy: CashflowGroupBy) {
  if (groupBy === "week") {
    return formatDateKey(startOfWeek(date));
  }
  if (groupBy === "month") {
    return formatMonthKey(date);
  }
  return formatDateKey(startOfDay(date));
}

function resolveDateRange(from?: string, to?: string) {
  const now = new Date();
  const defaultFrom = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const fromDate = from ? parseDateOnly(from, "from") : defaultFrom;
  const toDate = to ? parseDateOnly(to, "to") : startOfDay(now);
  const toExclusive = addDays(toDate, 1);

  if (toExclusive <= fromDate) {
    throw new HttpError(400, "Invalid date range", {
      from: from ?? formatDateKey(fromDate),
      to: to ?? formatDateKey(toDate),
    });
  }
  return { fromDate, toExclusive };
}

function parseDateOnly(value: string, field: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
  }
  return startOfDay(parsed);
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function asAmount(value: Prisma.Decimal | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}
