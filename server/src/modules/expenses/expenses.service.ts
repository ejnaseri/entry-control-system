import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { AdminRole, AuditActor } from "@prisma/client";
import { HttpError } from "../../middlewares/error-handler";
import { prisma } from "../../lib/prisma";
import type {
  ExpenseCategoryCreateInput,
  ExpenseCategoryListQuery,
  ExpenseCreateInput,
  ExpenseListQuery,
  ExpenseReverseInput,
} from "./expenses.schemas";

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

type ExpenseCategoryRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type ExpenseCategoryAnalyticsRow = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
};

type ExpenseMonthlyAnalyticsRow = {
  monthKey: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
};

type ExpenseMonthlyCategoryAnalyticsRow = {
  monthKey: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
};

export type ExpenseActionContext = {
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

type ExpenseAuditInput = {
  action: string;
  targetType: "Expense" | "ExpenseCategory";
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

type RawClient = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
};

const DEFAULT_EXPENSE_CATEGORIES: Array<{ id: string; slug: string; name: string; sortOrder: number }> = [
  { id: "expcat_rent", slug: "rent", name: "Rent", sortOrder: 10 },
  { id: "expcat_utilities", slug: "utilities", name: "Utilities", sortOrder: 20 },
  { id: "expcat_internet", slug: "internet", name: "Internet", sortOrder: 30 },
  { id: "expcat_cleaning", slug: "cleaning", name: "Cleaning", sortOrder: 40 },
  { id: "expcat_equipment", slug: "equipment", name: "Equipment", sortOrder: 50 },
  { id: "expcat_maintenance", slug: "maintenance", name: "Maintenance", sortOrder: 60 },
  { id: "expcat_miscellaneous", slug: "miscellaneous", name: "Miscellaneous", sortOrder: 70 },
];

export async function listExpenseCategories(query: ExpenseCategoryListQuery) {
  await ensureDefaultCategories();
  const sql = query.includeInactive
    ? `
      SELECT
        "id",
        "name",
        "slug",
        "isActive",
        "sortOrder",
        "createdAt",
        "updatedAt"
      FROM "ExpenseCategory"
      ORDER BY "sortOrder" ASC, "name" ASC
    `
    : `
      SELECT
        "id",
        "name",
        "slug",
        "isActive",
        "sortOrder",
        "createdAt",
        "updatedAt"
      FROM "ExpenseCategory"
      WHERE "isActive" = true
      ORDER BY "sortOrder" ASC, "name" ASC
    `;

  const rows = await raw().$queryRawUnsafe<ExpenseCategoryRow[]>(sql);
  return rows.map(mapCategory);
}

export async function createExpenseCategory(input: ExpenseCategoryCreateInput, context: ExpenseActionContext) {
  await ensureDefaultCategories();
  const name = input.name.trim();

  return prisma.$transaction(async (tx) => {
    const db = raw(tx);
    const slug = await generateUniqueCategorySlug(name, tx);
    const [maxSortRow] = await db.$queryRawUnsafe<Array<{ maxSortOrder: number | null }>>(
      `SELECT COALESCE(MAX("sortOrder"), 0) AS "maxSortOrder" FROM "ExpenseCategory"`
    );
    const nextSort = Number(maxSortRow?.maxSortOrder ?? 0) + 10;
    const id = randomUUID().replace(/-/g, "");
    const now = new Date();
    const rows = await db.$queryRawUnsafe<ExpenseCategoryRow[]>(
      `
        INSERT INTO "ExpenseCategory" (
          "id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, true, $4, $5, $6)
        RETURNING "id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt"
      `,
      id,
      name,
      slug,
      nextSort,
      now,
      now
    );

    const created = rows[0];
    if (!created) {
      throw new HttpError(500, "Failed to create expense category");
    }
    await tx.auditLog.create({
      data: buildExpenseAuditData(context, {
        action: "expense.category.created",
        targetType: "ExpenseCategory",
        targetId: created.id,
        afterData: toExpenseCategoryAuditJson(created),
      }),
    });
    return mapCategory(created);
  });
}

export async function listExpenses(query: ExpenseListQuery) {
  await ensureDefaultCategories();
  const { fromDate, toExclusive } = resolveDateRange(query.from, query.to);
  const search = query.search?.trim();

  const whereParts: string[] = [
    `e."occurredAt" >= $1`,
    `e."occurredAt" < $2`,
  ];
  const params: unknown[] = [fromDate, toExclusive];

  if (query.categoryId) {
    whereParts.push(`e."categoryId" = $${params.length + 1}`);
    params.push(query.categoryId);
  }

  if (query.status) {
    whereParts.push(`e."status" = $${params.length + 1}`);
    params.push(query.status);
  }

  if (search) {
    whereParts.push(
      `(
        c."name" ILIKE $${params.length + 1}
        OR COALESCE(e."reference", '') ILIKE $${params.length + 1}
        OR COALESCE(e."vendorName", '') ILIKE $${params.length + 1}
        OR COALESCE(e."notes", '') ILIKE $${params.length + 1}
      )`
    );
    params.push(`%${search}%`);
  }

  const whereSql = whereParts.join(" AND ");
  const orderPrimary = query.sortBy === "amount" ? `e."amount"` : `e."occurredAt"`;
  const orderDir = query.sortDir === "asc" ? "ASC" : "DESC";

  const page = query.page;
  const pageSize = query.pageSize;
  const offset = (page - 1) * pageSize;

  const totalRows = await raw().$queryRawUnsafe<Array<{ total: number }>>(
    `
      SELECT COUNT(*)::int AS total
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql}
    `,
    ...params
  );
  const totalItems = Number(totalRows[0]?.total ?? 0);

  const items = await raw().$queryRawUnsafe<ExpenseRow[]>(
    `
      SELECT
        e."id",
        e."categoryId",
        e."amount"::numeric::float8 AS "amount",
        e."currency",
        e."status",
        e."occurredAt",
        e."notes",
        e."reference",
        e."vendorName",
        e."isAdjustment",
        e."reversalOfExpenseId",
        e."reversedAt",
        e."createdAt",
        e."updatedAt",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        ro."reference" AS "reversalOfReference",
        rb."id" AS "reversedByExpenseId",
        rb."reference" AS "reversedByReference"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      LEFT JOIN "Expense" ro ON ro."id" = e."reversalOfExpenseId"
      LEFT JOIN "Expense" rb ON rb."reversalOfExpenseId" = e."id"
      WHERE ${whereSql}
      ORDER BY ${orderPrimary} ${orderDir}, e."createdAt" DESC
      OFFSET $${params.length + 1}
      LIMIT $${params.length + 2}
    `,
    ...params,
    offset,
    pageSize
  );

  const [netRow] = await raw().$queryRawUnsafe<Array<{ total: number | null }>>(
    `
      SELECT COALESCE(SUM(e."amount"), 0)::numeric::float8 AS total
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql}
    `,
    ...params
  );

  const [positiveRow] = await raw().$queryRawUnsafe<Array<{ total: number | null; count: number }>>(
    `
      SELECT
        COALESCE(SUM(e."amount"), 0)::numeric::float8 AS total,
        COUNT(*)::int AS count
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql} AND e."amount" > 0
    `,
    ...params
  );

  const [negativeRow] = await raw().$queryRawUnsafe<Array<{ total: number | null; count: number }>>(
    `
      SELECT
        COALESCE(SUM(e."amount"), 0)::numeric::float8 AS total,
        COUNT(*)::int AS count
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql} AND e."amount" < 0
    `,
    ...params
  );

  const categoryAnalyticsRows = await raw().$queryRawUnsafe<ExpenseCategoryAnalyticsRow[]>(
    `
      SELECT
        e."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        COALESCE(SUM(CASE WHEN e."amount" > 0 THEN e."amount" ELSE 0 END), 0)::numeric::float8 AS "grossOutflow",
        ABS(COALESCE(SUM(CASE WHEN e."amount" < 0 THEN e."amount" ELSE 0 END), 0))::numeric::float8 AS "adjustments",
        COALESCE(SUM(e."amount"), 0)::numeric::float8 AS "netOutflow"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql}
      GROUP BY e."categoryId", c."name", c."slug"
      HAVING COALESCE(SUM(e."amount"), 0) > 0
      ORDER BY COALESCE(SUM(e."amount"), 0) DESC, c."name" ASC
    `,
    ...params
  );

  const monthlyAnalyticsRows = await raw().$queryRawUnsafe<ExpenseMonthlyAnalyticsRow[]>(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('month', e."occurredAt"), 'YYYY-MM') AS "monthKey",
        COALESCE(SUM(CASE WHEN e."amount" > 0 THEN e."amount" ELSE 0 END), 0)::numeric::float8 AS "grossOutflow",
        ABS(COALESCE(SUM(CASE WHEN e."amount" < 0 THEN e."amount" ELSE 0 END), 0))::numeric::float8 AS "adjustments",
        COALESCE(SUM(e."amount"), 0)::numeric::float8 AS "netOutflow"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql}
      GROUP BY DATE_TRUNC('month', e."occurredAt")
      ORDER BY DATE_TRUNC('month', e."occurredAt") ASC
    `,
    ...params
  );

  const monthlyCategoryAnalyticsRows = await raw().$queryRawUnsafe<ExpenseMonthlyCategoryAnalyticsRow[]>(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('month', e."occurredAt"), 'YYYY-MM') AS "monthKey",
        e."categoryId",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        COALESCE(SUM(CASE WHEN e."amount" > 0 THEN e."amount" ELSE 0 END), 0)::numeric::float8 AS "grossOutflow",
        ABS(COALESCE(SUM(CASE WHEN e."amount" < 0 THEN e."amount" ELSE 0 END), 0))::numeric::float8 AS "adjustments",
        COALESCE(SUM(e."amount"), 0)::numeric::float8 AS "netOutflow"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      WHERE ${whereSql}
      GROUP BY DATE_TRUNC('month', e."occurredAt"), e."categoryId", c."name", c."slug"
      HAVING COALESCE(SUM(e."amount"), 0) > 0
      ORDER BY DATE_TRUNC('month', e."occurredAt") ASC, COALESCE(SUM(e."amount"), 0) DESC, c."name" ASC
    `,
    ...params
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      from: formatDateKey(fromDate),
      to: formatDateKey(addDays(toExclusive, -1)),
      categoryId: query.categoryId ?? null,
      status: query.status ?? null,
      search: search || null,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
    },
    summary: {
      grossOutflow: roundCurrency(Number(positiveRow?.total ?? 0)),
      adjustments: roundCurrency(Math.abs(Number(negativeRow?.total ?? 0))),
      netOutflow: roundCurrency(Number(netRow?.total ?? 0)),
      expenseCount: Number(positiveRow?.count ?? 0),
      adjustmentCount: Number(negativeRow?.count ?? 0),
    },
    items: items.map(mapExpenseRow),
    analytics: {
      categoryBreakdown: buildCategoryAnalytics(categoryAnalyticsRows),
      monthlyTrend: buildMonthlyAnalytics(monthlyAnalyticsRows, monthlyCategoryAnalyticsRows),
    },
    pageInfo: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function createExpense(input: ExpenseCreateInput, context: ExpenseActionContext) {
  await ensureDefaultCategories();
  const amount = roundCurrency(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Expense amount must be greater than 0", { amount: input.amount });
  }

  const occurredAt = parseTimestamp(input.occurredAt, "occurredAt");
  const reference = input.reference?.trim() || buildReference("EXP", occurredAt);
  const vendorName = input.vendorName?.trim() || null;
  const notes = input.notes?.trim() || null;

  const id = randomUUID().replace(/-/g, "");
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const db = raw(tx);
    const categoryRows = await db.$queryRawUnsafe<Array<{ id: string; isActive: boolean }>>(
      `SELECT "id", "isActive" FROM "ExpenseCategory" WHERE "id" = $1 LIMIT 1`,
      input.categoryId
    );
    const category = categoryRows[0];
    if (!category) {
      throw new HttpError(404, "Expense category not found", { categoryId: input.categoryId });
    }
    if (!category.isActive) {
      throw new HttpError(400, "Expense category is inactive", { categoryId: input.categoryId });
    }

    await db.$executeRawUnsafe(
      `
        INSERT INTO "Expense" (
          "id", "categoryId", "amount", "currency", "status", "occurredAt",
          "notes", "reference", "vendorName", "isAdjustment", "reversalOfExpenseId",
          "reversedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, 'AFN', 'POSTED', $4, $5, $6, $7, false, NULL, NULL, $8, $9)
      `,
      id,
      input.categoryId,
      amount,
      occurredAt,
      notes,
      reference,
      vendorName,
      now,
      now
    );

    const created = await fetchExpenseById(id, tx);
    if (!created) {
      throw new HttpError(500, "Failed to create expense");
    }
    await tx.auditLog.create({
      data: buildExpenseAuditData(context, {
        action: "expense.created",
        targetType: "Expense",
        targetId: created.id,
        afterData: toExpenseAuditJson(created),
        metadata: { categoryId: created.categoryId, reference: created.reference ?? "" },
      }),
    });
    return mapExpenseRow(created);
  });
}

export async function reverseExpense(expenseId: string, input: ExpenseReverseInput, context: ExpenseActionContext) {
  await ensureDefaultCategories();
  const occurredAt = parseTimestamp(input.occurredAt, "occurredAt");
  const userNotes = input.notes?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const db = raw(tx);

    const originalRows = await db.$queryRawUnsafe<ExpenseRow[]>(
      `
        SELECT
          e."id",
          e."categoryId",
          e."amount"::numeric::float8 AS "amount",
          e."currency",
          e."status",
          e."occurredAt",
          e."notes",
          e."reference",
          e."vendorName",
          e."isAdjustment",
          e."reversalOfExpenseId",
          e."reversedAt",
          e."createdAt",
          e."updatedAt",
          c."name" AS "categoryName",
          c."slug" AS "categorySlug",
          ro."reference" AS "reversalOfReference",
          rb."id" AS "reversedByExpenseId",
          rb."reference" AS "reversedByReference"
        FROM "Expense" e
        INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
        LEFT JOIN "Expense" ro ON ro."id" = e."reversalOfExpenseId"
        LEFT JOIN "Expense" rb ON rb."reversalOfExpenseId" = e."id"
        WHERE e."id" = $1
        FOR UPDATE OF e
      `,
      expenseId
    );

    const original = originalRows[0];
    if (!original) {
      throw new HttpError(404, "Expense not found", { expenseId });
    }
    if (original.isAdjustment || original.amount <= 0) {
      throw new HttpError(400, "Adjustment entries cannot be reversed", { expenseId });
    }
    if (original.status === "REVERSED" || original.reversedByExpenseId) {
      throw new HttpError(400, "Expense already reversed", { expenseId });
    }

    const reversalAmount = roundCurrency(-Math.abs(original.amount));
    const reversalReference = buildReference("REV", occurredAt);
    const reversalNotes = [original.reference ? `Reversal of ${original.reference}` : "Expense reversal", userNotes]
      .filter(Boolean)
      .join(" | ");

    const reversalId = randomUUID().replace(/-/g, "");
    const now = new Date();

    await db.$executeRawUnsafe(
      `
        INSERT INTO "Expense" (
          "id", "categoryId", "amount", "currency", "status", "occurredAt",
          "notes", "reference", "vendorName", "isAdjustment", "reversalOfExpenseId",
          "reversedAt", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, 'POSTED', $5, $6, $7, $8, true, $9, NULL, $10, $11)
      `,
      reversalId,
      original.categoryId,
      reversalAmount,
      original.currency,
      occurredAt,
      reversalNotes || null,
      reversalReference,
      original.vendorName,
      original.id,
      now,
      now
    );

    await db.$executeRawUnsafe(
      `
        UPDATE "Expense"
        SET "status" = 'REVERSED', "reversedAt" = $2, "updatedAt" = $3
        WHERE "id" = $1
      `,
      original.id,
      occurredAt,
      now
    );

    const refreshedOriginal = await fetchExpenseById(original.id, tx);
    const reversal = await fetchExpenseById(reversalId, tx);

    if (!refreshedOriginal || !reversal) {
      throw new HttpError(500, "Failed to load reversal result", { expenseId });
    }

    await tx.auditLog.create({
      data: buildExpenseAuditData(context, {
        action: "expense.reversed",
        targetType: "Expense",
        targetId: original.id,
        beforeData: toExpenseAuditJson(original),
        afterData: {
          original: toExpenseAuditJson(refreshedOriginal),
          adjustment: toExpenseAuditJson(reversal),
        },
        metadata: {
          originalExpenseId: original.id,
          reversalExpenseId: reversal.id,
          reversalReference: reversal.reference ?? "",
        },
      }),
    });

    return {
      original: mapExpenseRow(refreshedOriginal),
      reversal: mapExpenseRow(reversal),
    };
  });
}

async function ensureDefaultCategories() {
  const db = raw();
  for (const item of DEFAULT_EXPENSE_CATEGORIES) {
    await db.$executeRawUnsafe(
      `
        INSERT INTO "ExpenseCategory" (
          "id", "name", "slug", "isActive", "sortOrder", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, true, $4, NOW(), NOW())
        ON CONFLICT ("slug") DO NOTHING
      `,
      item.id,
      item.name,
      item.slug,
      item.sortOrder
    );
  }
}

async function generateUniqueCategorySlug(name: string, tx?: Prisma.TransactionClient) {
  const base = slugify(name) || "category";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = `${base}${suffix}`;

    const rows = await raw(tx).$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "ExpenseCategory" WHERE "slug" = $1 LIMIT 1`,
      candidate
    );
    if (!rows.length) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function buildExpenseAuditData(
  context: ExpenseActionContext,
  input: ExpenseAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    success: true,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.afterData) data.afterData = input.afterData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toExpenseCategoryAuditJson(row: ExpenseCategoryRow): Prisma.InputJsonObject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    sortOrder: Number(row.sortOrder),
  };
}

function toExpenseAuditJson(row: ExpenseRow): Prisma.InputJsonObject {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    amount: roundCurrency(Number(row.amount)),
    currency: row.currency,
    status: row.status,
    occurredAt: row.occurredAt.toISOString(),
    isAdjustment: row.isAdjustment,
    ...(row.reference ? { reference: row.reference } : {}),
    ...(row.reversalOfExpenseId ? { reversalOfExpenseId: row.reversalOfExpenseId } : {}),
    ...(row.reversedAt ? { reversedAt: row.reversedAt.toISOString() } : {}),
    ...(row.reversedByExpenseId ? { reversedByExpenseId: row.reversedByExpenseId } : {}),
    ...(row.reversedByReference ? { reversedByReference: row.reversedByReference } : {}),
  };
}

async function fetchExpenseById(id: string, tx?: Prisma.TransactionClient) {
  const db = raw(tx);
  const rows = await db.$queryRawUnsafe<ExpenseRow[]>(
    `
      SELECT
        e."id",
        e."categoryId",
        e."amount"::numeric::float8 AS "amount",
        e."currency",
        e."status",
        e."occurredAt",
        e."notes",
        e."reference",
        e."vendorName",
        e."isAdjustment",
        e."reversalOfExpenseId",
        e."reversedAt",
        e."createdAt",
        e."updatedAt",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug",
        ro."reference" AS "reversalOfReference",
        rb."id" AS "reversedByExpenseId",
        rb."reference" AS "reversedByReference"
      FROM "Expense" e
      INNER JOIN "ExpenseCategory" c ON c."id" = e."categoryId"
      LEFT JOIN "Expense" ro ON ro."id" = e."reversalOfExpenseId"
      LEFT JOIN "Expense" rb ON rb."reversalOfExpenseId" = e."id"
      WHERE e."id" = $1
      LIMIT 1
    `,
    id
  );
  return rows[0] ?? null;
}

function mapCategory(row: ExpenseCategoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    sortOrder: Number(row.sortOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapExpenseRow(row: ExpenseRow) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    category: {
      id: row.categoryId,
      name: row.categoryName,
      slug: row.categorySlug,
    },
    amount: roundCurrency(row.amount),
    currency: row.currency,
    status: row.status,
    occurredAt: row.occurredAt,
    notes: row.notes,
    reference: row.reference,
    vendorName: row.vendorName,
    isAdjustment: row.isAdjustment,
    reversalOfExpenseId: row.reversalOfExpenseId ?? null,
    reversedAt: row.reversedAt,
    reversedByExpenseId: row.reversedByExpenseId ?? null,
    reversedByReference: row.reversedByReference ?? null,
    reversalOfReference: row.reversalOfReference ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildCategoryAnalytics(rows: ExpenseCategoryAnalyticsRow[]) {
  const rounded = rows
    .map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      grossOutflow: roundCurrency(Number(row.grossOutflow)),
      adjustments: roundCurrency(Number(row.adjustments)),
      netOutflow: roundCurrency(Number(row.netOutflow)),
    }))
    .filter((row) => row.netOutflow > 0);

  const shareBase = rounded.reduce((sum, row) => sum + row.netOutflow, 0);

  return rounded.map((row) => ({
    ...row,
    sharePct: shareBase > 0 ? roundPercent((row.netOutflow / shareBase) * 100) : 0,
  }));
}

function buildMonthlyAnalytics(rows: ExpenseMonthlyAnalyticsRow[], categoryRows: ExpenseMonthlyCategoryAnalyticsRow[]) {
  const categoryRowsByMonth = new Map<string, ExpenseCategoryAnalyticsRow[]>();

  for (const row of categoryRows) {
    const existing = categoryRowsByMonth.get(row.monthKey) ?? [];
    existing.push(row);
    categoryRowsByMonth.set(row.monthKey, existing);
  }

  const categoryMap = new Map(
    Array.from(categoryRowsByMonth.entries()).map(([monthKey, monthRows]) => [monthKey, buildCategoryAnalytics(monthRows)])
  );

  return rows.map((row) => ({
    monthKey: row.monthKey,
    grossOutflow: roundCurrency(Number(row.grossOutflow)),
    adjustments: roundCurrency(Number(row.adjustments)),
    netOutflow: roundCurrency(Number(row.netOutflow)),
    categoryBreakdown: categoryMap.get(row.monthKey) ?? [],
  }));
}

function parseTimestamp(input: string | undefined, field: string) {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} timestamp`, { [field]: input });
  }
  return parsed;
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildReference(prefix: "EXP" | "REV", date: Date) {
  const shortId = randomUUID().replace(/-/g, "").slice(-8).toUpperCase();
  return `${prefix}-${formatDateStamp(date)}-${shortId}`;
}

function formatDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
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

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function raw(tx?: Prisma.TransactionClient): RawClient {
  return (tx ?? prisma) as unknown as RawClient;
}
