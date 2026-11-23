import assert from "node:assert/strict";
import { AdminRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { listExpenses, reverseExpense, type ExpenseActionContext } from "./expenses.service";

type ExpenseStatusValue = "POSTED" | "REVERSED";

type ExpenseRow = {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  status: ExpenseStatusValue;
  occurredAt: Date;
  notes: string | null;
  reference: string | null;
  vendorName: string | null;
  isAdjustment: boolean;
  reversalOfExpenseId: string | null;
  reversedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  categoryName: string;
  categorySlug: string;
  reversalOfReference: string | null;
  reversedByExpenseId: string | null;
  reversedByReference: string | null;
};

const prismaAny = prisma as any;
const originalFns = {
  transaction: prismaAny.$transaction,
  queryRawUnsafe: prismaAny.$queryRawUnsafe,
  executeRawUnsafe: prismaAny.$executeRawUnsafe,
};

const auditContext: ExpenseActionContext = {
  actor: { id: "expense-test-actor", role: AdminRole.GYM_OWNER, sessionId: "expense-test-session" },
  meta: { ipAddress: "127.0.0.1", userAgent: "expense-service-test" },
};

function restorePrisma() {
  prismaAny.$transaction = originalFns.transaction;
  prismaAny.$queryRawUnsafe = originalFns.queryRawUnsafe;
  prismaAny.$executeRawUnsafe = originalFns.executeRawUnsafe;
}

function buildExpenseRow(overrides: Partial<ExpenseRow> = {}): ExpenseRow {
  const now = new Date("2026-07-10T08:00:00.000Z");
  return {
    id: "expense-original",
    categoryId: "expcat_rent",
    amount: 25000,
    currency: "AFN",
    status: "POSTED",
    occurredAt: now,
    notes: null,
    reference: "EXP-20260710-RENT0001",
    vendorName: "Landlord",
    isAdjustment: false,
    reversalOfExpenseId: null,
    reversedAt: null,
    createdAt: now,
    updatedAt: now,
    categoryName: "Rent",
    categorySlug: "rent",
    reversalOfReference: null,
    reversedByExpenseId: null,
    reversedByReference: null,
    ...overrides,
  };
}

async function testReverseExpenseLocksOnlyTheOriginalExpenseRow() {
  const calls: Array<{ kind: "query" | "execute"; query: string; values: unknown[] }> = [];
  const original = buildExpenseRow();
  let reversalId = "";

  const tx = {
    auditLog: {
      create: async (args: unknown) => args,
    },
    $queryRawUnsafe: async <T = unknown>(query: string, ...values: unknown[]): Promise<T> => {
      calls.push({ kind: "query", query, values });

      if (query.includes("FOR UPDATE")) {
        return [original] as T;
      }

      const id = values[0];
      if (id === original.id) {
        return [
          buildExpenseRow({
            status: "REVERSED",
            reversedAt: new Date("2026-07-10T09:00:00.000Z"),
            reversedByExpenseId: reversalId,
            reversedByReference: "REV-20260710-MOCK0001",
          }),
        ] as T;
      }

      if (id === reversalId) {
        return [
          buildExpenseRow({
            id: reversalId,
            amount: -25000,
            status: "POSTED",
            isAdjustment: true,
            reversalOfExpenseId: original.id,
            reference: "REV-20260710-MOCK0001",
            notes: "Reversal of EXP-20260710-RENT0001 | Duplicate expense",
            reversedByExpenseId: null,
            reversedByReference: null,
          }),
        ] as T;
      }

      return [] as T;
    },
    $executeRawUnsafe: async (query: string, ...values: unknown[]) => {
      calls.push({ kind: "execute", query, values });
      if (query.includes('INSERT INTO "Expense"')) {
        reversalId = String(values[0]);
      }
      return 1;
    },
  };

  prismaAny.$executeRawUnsafe = async (query: string, ...values: unknown[]) => {
    calls.push({ kind: "execute", query, values });
    return 1;
  };
  prismaAny.$transaction = async <T>(callback: (transactionClient: typeof tx) => Promise<T>): Promise<T> => callback(tx);

  try {
    const result = await reverseExpense(
      original.id,
      {
        occurredAt: "2026-07-10T09:00:00.000Z",
        notes: "Duplicate expense",
      },
      auditContext
    );

    const lockQuery = calls.find((call) => call.kind === "query" && call.query.includes("FOR UPDATE"))?.query;
    assert.ok(lockQuery, "Reverse flow should lock the original expense row");
    assert.match(lockQuery, /FOR UPDATE\s+OF\s+e/u);

    const reversalInsert = calls.find((call) => call.kind === "execute" && call.query.includes('INSERT INTO "Expense"'));
    assert.ok(reversalInsert, "Reverse flow should insert an adjustment expense");
    assert.equal(reversalInsert.values[2], -25000);
    assert.equal(reversalInsert.values[8], original.id);

    const originalUpdate = calls.find((call) => call.kind === "execute" && call.query.includes('UPDATE "Expense"'));
    assert.ok(originalUpdate, "Reverse flow should mark the original expense as reversed");
    assert.equal(originalUpdate.values[0], original.id);

    assert.equal(result.original.status, "REVERSED");
    assert.equal(result.reversal.amount, -25000);
    assert.equal(result.reversal.reversalOfExpenseId, original.id);
  } finally {
    restorePrisma();
  }
}

async function testExpenseAnalyticsUseNetOutflowAfterReversals() {
  const queries: string[] = [];

  prismaAny.$executeRawUnsafe = async () => 1;
  prismaAny.$queryRawUnsafe = async <T = unknown>(query: string): Promise<T> => {
    queries.push(query);

    if (query.includes("COUNT(*)::int AS total")) {
      return [{ total: 5 }] as T;
    }

    if (query.includes('LEFT JOIN "Expense" ro')) {
      return [] as T;
    }

    if (query.includes("COUNT(*)::int AS count") && query.includes('e."amount" > 0')) {
      return [{ total: 39000, count: 3 }] as T;
    }

    if (query.includes("COUNT(*)::int AS count") && query.includes('e."amount" < 0')) {
      return [{ total: -14000, count: 2 }] as T;
    }

    if (query.includes('COALESCE(SUM(e."amount"), 0)::numeric::float8 AS total')) {
      return [{ total: 25000 }] as T;
    }

    if (query.includes("GROUP BY e.\"categoryId\"")) {
      return [
        {
          categoryId: "expcat_rent",
          categoryName: "Rent",
          categorySlug: "rent",
          grossOutflow: 37000,
          adjustments: 12000,
          netOutflow: 25000,
        },
        {
          categoryId: "expcat_internet",
          categoryName: "Internet",
          categorySlug: "internet",
          grossOutflow: 2000,
          adjustments: 2000,
          netOutflow: 0,
        },
      ] as T;
    }

    if (query.includes("GROUP BY DATE_TRUNC") && query.includes(", e.\"categoryId\"")) {
      return [
        {
          monthKey: "2026-07",
          categoryId: "expcat_rent",
          categoryName: "Rent",
          categorySlug: "rent",
          grossOutflow: 37000,
          adjustments: 12000,
          netOutflow: 25000,
        },
        {
          monthKey: "2026-07",
          categoryId: "expcat_internet",
          categoryName: "Internet",
          categorySlug: "internet",
          grossOutflow: 2000,
          adjustments: 2000,
          netOutflow: 0,
        },
      ] as T;
    }

    if (query.includes("GROUP BY DATE_TRUNC")) {
      return [{ monthKey: "2026-07", grossOutflow: 39000, adjustments: 14000, netOutflow: 25000 }] as T;
    }

    throw new Error(`Unexpected query: ${query}`);
  };

  try {
    const result = await listExpenses({
      from: "2026-07-01",
      to: "2026-07-31",
      sortBy: "occurredAt",
      sortDir: "desc",
      page: 1,
      pageSize: 25,
    });

    assert.equal(result.summary.grossOutflow, 39000);
    assert.equal(result.summary.adjustments, 14000);
    assert.equal(result.summary.netOutflow, 25000);

    assert.equal(result.analytics.categoryBreakdown.length, 1);
    assert.equal(result.analytics.categoryBreakdown[0]?.categoryName, "Rent");
    assert.equal(result.analytics.categoryBreakdown[0]?.netOutflow, 25000);
    assert.equal(result.analytics.categoryBreakdown[0]?.sharePct, 100);

    assert.equal(result.analytics.monthlyTrend.length, 1);
    assert.equal(result.analytics.monthlyTrend[0]?.grossOutflow, 39000);
    assert.equal(result.analytics.monthlyTrend[0]?.adjustments, 14000);
    assert.equal(result.analytics.monthlyTrend[0]?.netOutflow, 25000);
    assert.equal(result.analytics.monthlyTrend[0]?.categoryBreakdown.length, 1);
    assert.equal(result.analytics.monthlyTrend[0]?.categoryBreakdown[0]?.categoryName, "Rent");

    assert.ok(queries.some((query) => query.includes("HAVING COALESCE(SUM(e.\"amount\"), 0) > 0")));
  } finally {
    restorePrisma();
  }
}

async function run() {
  const tests = [
    {
      name: "expense reversal locks only the original row",
      execute: testReverseExpenseLocksOnlyTheOriginalExpenseRow,
    },
    {
      name: "expense analytics use net outflow after reversals",
      execute: testExpenseAnalyticsUseNetOutflowAfterReversals,
    },
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
