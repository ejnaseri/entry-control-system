import assert from "node:assert/strict";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { getCashflowCsv, getCashflowReport, getCashflowXlsx } from "./reports-cashflow.service";

type CashflowMockOptions = {
  payments?: Array<{ amount: number; paidAt?: Date | null; createdAt?: Date; status?: PaymentStatus }>;
  expenses?: Array<{ amount: number; occurredAt: Date; categoryId: string; categoryName: string; categorySlug: string }>;
  payrollRows?: Array<{ amount: number; paidAt?: Date | null; createdAt?: Date; status?: PaymentStatus }>;
};

const prismaAny = prisma as any;
const originalFns = {
  paymentFindMany: prismaAny.payment.findMany,
  queryRawUnsafe: prismaAny.$queryRawUnsafe,
  payrollPaymentFindMany: prismaAny.payrollPayment.findMany,
};

function restorePrisma() {
  prismaAny.payment.findMany = originalFns.paymentFindMany;
  prismaAny.$queryRawUnsafe = originalFns.queryRawUnsafe;
  prismaAny.payrollPayment.findMany = originalFns.payrollPaymentFindMany;
}

function mockCashflowPrisma(options: CashflowMockOptions) {
  const calls = { payrollFindMany: 0 };

  prismaAny.payment.findMany = async () =>
    (options.payments ?? []).map((payment) => ({
      paidAt: payment.paidAt ?? new Date("2026-07-08T10:00:00.000Z"),
      createdAt: payment.createdAt ?? new Date("2026-07-08T10:00:00.000Z"),
      status: payment.status ?? PaymentStatus.PAID,
      amount: payment.amount,
    }));
  prismaAny.$queryRawUnsafe = async () => options.expenses ?? [];
  prismaAny.payrollPayment.findMany = async () => {
    calls.payrollFindMany += 1;
    return (options.payrollRows ?? []).map((payroll) => ({
      paidAt: payroll.paidAt ?? new Date("2026-07-08T10:00:00.000Z"),
      createdAt: payroll.createdAt ?? new Date("2026-07-08T10:00:00.000Z"),
      status: payroll.status ?? PaymentStatus.PAID,
      amount: payroll.amount,
    }));
  };

  return calls;
}

function readZipEntry(buffer: Buffer, entryName: string) {
  let offset = 0;
  while (offset <= buffer.length - 30) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) {
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

    if (name === entryName) {
      return buffer.subarray(dataStart, dataEnd).toString("utf8");
    }

    offset = dataEnd;
  }

  throw new Error(`Missing ZIP entry: ${entryName}`);
}

function assertXmlHasNumber(xml: string, value: number) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(xml, new RegExp(`<v>${escaped}</v>`, "u"));
}

async function testMembershipPaymentsAndRefundsReconcileCashflow() {
  mockCashflowPrisma({
    payments: [
      { amount: 700, paidAt: new Date("2026-07-08T10:00:00.000Z") },
      { amount: 600, paidAt: new Date("2026-07-08T11:00:00.000Z") },
      { amount: 400, paidAt: new Date("2026-07-08T11:01:00.000Z") },
      { amount: -300, paidAt: new Date("2026-07-08T12:00:00.000Z") },
    ],
  });
  try {
    const report = await getCashflowReport({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: false,
    });

    assert.equal(report.summary.membershipInflow, 1700);
    assert.equal(report.summary.membershipRefunds, 300);
    assert.equal(report.summary.membershipNet, 1400);
    assert.equal(report.summary.totalOutflow, 300);
    assert.equal(report.summary.netCash, 1400);
    assert.equal(report.summary.transactionCounts.membershipPayments, 4);

    assert.equal(report.charts.trend.length, 1);
    assert.equal(report.charts.trend[0]?.periodKey, "2026-07-08");
    assert.equal(report.charts.trend[0]?.inflow, 1700);
    assert.equal(report.charts.trend[0]?.refunds, 300);
    assert.equal(report.charts.trend[0]?.membershipNet, 1400);
    assert.equal(report.charts.trend[0]?.netCash, 1400);
  } finally {
    restorePrisma();
  }
}

async function testExpensesReversalsAndPayrollReconcileCashflow() {
  mockCashflowPrisma({
    payments: [
      { amount: 1000, paidAt: new Date("2026-07-08T09:00:00.000Z") },
      { amount: -200, paidAt: new Date("2026-07-08T10:00:00.000Z") },
    ],
    expenses: [
      {
        amount: 500,
        occurredAt: new Date("2026-07-08T11:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: -125,
        occurredAt: new Date("2026-07-08T12:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: 200,
        occurredAt: new Date("2026-07-08T12:05:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
      {
        amount: -200,
        occurredAt: new Date("2026-07-08T12:06:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
    ],
    payrollRows: [{ amount: 300, paidAt: new Date("2026-07-08T13:00:00.000Z") }],
  });
  try {
    const report = await getCashflowReport({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: true,
    });

    assert.equal(report.summary.membershipInflow, 1000);
    assert.equal(report.summary.membershipRefunds, 200);
    assert.equal(report.summary.membershipNet, 800);
    assert.equal(report.summary.expenseGrossOutflow, 700);
    assert.equal(report.summary.expenseAdjustments, 325);
    assert.equal(report.summary.expenseNetOutflow, 375);
    assert.equal(report.summary.payrollOutflow, 300);
    assert.equal(report.summary.totalOutflow, 875);
    assert.equal(report.summary.netCash, 125);
    assert.deepEqual(report.summary.transactionCounts, {
      membershipPayments: 2,
      expenseEntries: 4,
      payrollPayments: 1,
    });

    assert.equal(report.charts.expenseByCategory.length, 1);
    assert.deepEqual(report.charts.expenseByCategory[0], {
      categoryId: "category-rent",
      categoryName: "Rent",
      categorySlug: "rent",
      grossOutflow: 500,
      adjustments: 125,
      netOutflow: 375,
      sharePct: 100,
    });

    assert.equal(report.charts.trend[0]?.expenseOutflow, 700);
    assert.equal(report.charts.trend[0]?.expenseAdjustments, 325);
    assert.equal(report.charts.trend[0]?.expenseNetOutflow, 375);
    assert.equal(report.charts.trend[0]?.payrollOutflow, 300);
    assert.equal(report.charts.trend[0]?.totalOutflow, 875);
    assert.equal(report.charts.trend[0]?.netCash, 125);
  } finally {
    restorePrisma();
  }
}

async function testPayrollIsSkippedWhenExcluded() {
  const calls = mockCashflowPrisma({
    payments: [{ amount: 1000, paidAt: new Date("2026-07-08T09:00:00.000Z") }],
    payrollRows: [{ amount: 300, paidAt: new Date("2026-07-08T13:00:00.000Z") }],
  });
  try {
    const report = await getCashflowReport({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: false,
    });

    assert.equal(calls.payrollFindMany, 0);
    assert.equal(report.summary.payrollOutflow, 0);
    assert.equal(report.summary.totalOutflow, 0);
    assert.equal(report.summary.netCash, 1000);
    assert.equal(report.summary.transactionCounts.payrollPayments, 0);
  } finally {
    restorePrisma();
  }
}

async function testCashflowCsvExportsReconciledTrendValues() {
  mockCashflowPrisma({
    payments: [
      { amount: 1000, paidAt: new Date("2026-07-08T09:00:00.000Z") },
      { amount: -200, paidAt: new Date("2026-07-08T10:00:00.000Z") },
    ],
    expenses: [
      {
        amount: 500,
        occurredAt: new Date("2026-07-08T11:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: -125,
        occurredAt: new Date("2026-07-08T12:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: 200,
        occurredAt: new Date("2026-07-08T12:05:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
      {
        amount: -200,
        occurredAt: new Date("2026-07-08T12:06:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
    ],
    payrollRows: [{ amount: 300, paidAt: new Date("2026-07-08T13:00:00.000Z") }],
  });
  try {
    const result = await getCashflowCsv({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: true,
      lang: "en",
    });

    const lines = result.csv.split("\n");
    assert.equal(
      lines[0],
      "Period,Inflow,Refunds,Membership Net,Expenses Gross,Expense Adjustments,Expenses Net,Payroll Outflow,Total Outflow,Net Cash"
    );
    assert.equal(lines[1], "2026-07-08,1000.00,200.00,800.00,700.00,325.00,375.00,300.00,875.00,125.00");
    assert.match(result.filename, /^cashflow-report-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/u);
  } finally {
    restorePrisma();
  }
}

async function testCashflowXlsxExportsReconciledSheets() {
  mockCashflowPrisma({
    payments: [
      { amount: 1000, paidAt: new Date("2026-07-08T09:00:00.000Z") },
      { amount: -200, paidAt: new Date("2026-07-08T10:00:00.000Z") },
    ],
    expenses: [
      {
        amount: 500,
        occurredAt: new Date("2026-07-08T11:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: -125,
        occurredAt: new Date("2026-07-08T12:00:00.000Z"),
        categoryId: "category-rent",
        categoryName: "Rent",
        categorySlug: "rent",
      },
      {
        amount: 200,
        occurredAt: new Date("2026-07-08T12:05:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
      {
        amount: -200,
        occurredAt: new Date("2026-07-08T12:06:00.000Z"),
        categoryId: "category-internet",
        categoryName: "Internet",
        categorySlug: "internet",
      },
    ],
    payrollRows: [{ amount: 300, paidAt: new Date("2026-07-08T13:00:00.000Z") }],
  });
  try {
    const report = await getCashflowReport({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: true,
    });
    assert.equal(report.charts.expenseByCategory.length, 1);
    assert.equal(report.charts.expenseByCategory[0]?.categoryName, "Rent");

    const result = await getCashflowXlsx({
      from: "2026-07-08",
      to: "2026-07-08",
      groupBy: "day",
      includePayroll: true,
      lang: "en",
    });

    assert.equal(result.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(result.filename, /^cashflow-report-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.xlsx$/u);
    assert.equal(result.buffer.subarray(0, 2).toString("utf8"), "PK");

    const workbookXml = readZipEntry(result.buffer, "xl/workbook.xml");
    assert.match(workbookXml, /name="Summary"/u);
    assert.match(workbookXml, /name="Trend"/u);
    assert.match(workbookXml, /name="Expenses"/u);

    const summaryXml = readZipEntry(result.buffer, "xl/worksheets/sheet1.xml");
    assert.match(summaryXml, /Membership inflow/u);
    assert.match(summaryXml, /Expenses Gross/u);
    [1000, 200, 800, 700, 325, 375, 300, 875, 125].forEach((value) => assertXmlHasNumber(summaryXml, value));

    const trendXml = readZipEntry(result.buffer, "xl/worksheets/sheet2.xml");
    assert.match(trendXml, /2026-07-08/u);
    [1000, 200, 800, 700, 325, 375, 300, 875, 125].forEach((value) => assertXmlHasNumber(trendXml, value));

    const expensesXml = readZipEntry(result.buffer, "xl/worksheets/sheet3.xml");
    assert.match(expensesXml, /Rent/u);
    assert.doesNotMatch(expensesXml, /Internet/u);
    [500, 125, 375, 100].forEach((value) => assertXmlHasNumber(expensesXml, value));
  } finally {
    restorePrisma();
  }
}

async function run() {
  const tests = [
    { name: "membership payments and refunds reconcile cashflow", execute: testMembershipPaymentsAndRefundsReconcileCashflow },
    { name: "expenses reversals and payroll reconcile cashflow", execute: testExpensesReversalsAndPayrollReconcileCashflow },
    { name: "payroll is skipped when excluded", execute: testPayrollIsSkippedWhenExcluded },
    { name: "cashflow CSV exports reconciled trend values", execute: testCashflowCsvExportsReconciledTrendValues },
    { name: "cashflow XLSX exports reconciled sheets", execute: testCashflowXlsxExportsReconciledSheets },
  ];

  for (const test of tests) {
    await test.execute();
    console.log(`ok - ${test.name}`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
