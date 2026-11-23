import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  ExpenseStatus,
  PermissionMode,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { expensesRouter } from "./expenses.router";
import {
  createExpense,
  createExpenseCategory,
  reverseExpense,
  type ExpenseActionContext,
} from "./expenses.service";

type Fixture = {
  suffix: string;
  categoryName: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  categoryId?: string;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Expense API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["EXPENSE_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Expense API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `expense-allowed-${suffix}`;
  const deniedToken = `expense-denied-${suffix}`;

  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-expense-api-allowed-${suffix}`,
        passwordHash: "not-used-by-expense-api-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-expense-api-denied-${suffix}`,
        passwordHash: "not-used-by-expense-api-integration-test",
        role: AdminRole.STAFF,
      },
    });

    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, PermissionMode.DENY),
      ],
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: {
        adminUserId: allowedAdmin.id,
        tokenHash: hashSessionToken(allowedToken),
        expiresAt,
      },
    });
    const deniedSession = await tx.adminSession.create({
      data: {
        adminUserId: deniedAdmin.id,
        tokenHash: hashSessionToken(deniedToken),
        expiresAt,
      },
    });

    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession };
  });

  return {
    suffix,
    categoryName: `Expense Audit Integration ${suffix}`,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
  };
}

function permissionRow(adminUserId: string, mode: PermissionMode) {
  return {
    adminUserId,
    permission: AdminPermission.EXPENSES_MANAGE,
    mode,
    reason: "Expense API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/expenses", requirePermission(AdminPermission.EXPENSES_MANAGE), expensesRouter);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/expenses`;
    await testAuthenticationAndPermissionGuards(baseUrl, fixture);
    await testCategoryCreationAudit(baseUrl, fixture);
    await testExpenseCreationAndReversalAudits(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function testAuthenticationAndPermissionGuards(baseUrl: string, fixture: Fixture) {
  const body = { name: fixture.categoryName };
  const unauthenticated = await fetch(`${baseUrl}/categories`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json() as { message: string }).message, "Authentication required");

  const denied = await fetch(`${baseUrl}/categories`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(body),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.EXPENSES_MANAGE
  );

  const [categories, deniedAudits] = await prisma.$transaction([
    prisma.expenseCategory.count({ where: { name: fixture.categoryName } }),
    prisma.auditLog.count({
      where: { actorId: fixture.deniedAdminId, action: { startsWith: "expense." } },
    }),
  ]);
  assert.equal(categories, 0);
  assert.equal(deniedAudits, 0);
  console.log("ok expense API rejects unauthenticated and unauthorized mutations with no writes");
}

async function testCategoryCreationAudit(baseUrl: string, fixture: Fixture) {
  const response = await fetch(`${baseUrl}/categories`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({ name: fixture.categoryName }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    sortOrder: number;
  };
  fixture.categoryId = body.id;
  assert.equal(body.name, fixture.categoryName);
  assert.equal(body.isActive, true);

  const [stored, audit] = await prisma.$transaction([
    prisma.expenseCategory.findUnique({ where: { id: body.id } }),
    prisma.auditLog.findFirst({
      where: {
        action: "expense.category.created",
        targetType: "ExpenseCategory",
        targetId: body.id,
      },
    }),
  ]);
  assert.ok(stored);
  assert.ok(audit);
  assertAuditAttribution(audit, fixture);
  const afterData = asJsonObject(audit.afterData);
  assert.equal(afterData["id"], body.id);
  assert.equal(afterData["name"], fixture.categoryName);
  assert.equal(afterData["slug"], body.slug);
  assert.equal(afterData["isActive"], true);
  assert.equal(afterData["sortOrder"], body.sortOrder);
  console.log("ok expense category creation writes an attributed audit event");
}

async function testExpenseCreationAndReversalAudits(baseUrl: string, fixture: Fixture) {
  assert.ok(fixture.categoryId);
  const reference = `IT-EXP-${fixture.suffix}`;
  const vendorName = `Private vendor ${fixture.suffix}`;
  const notes = `Private expense notes ${fixture.suffix}`;
  const occurredAt = new Date(Date.now() - 60_000).toISOString();
  const createResponse = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      categoryId: fixture.categoryId,
      amount: 1875.5,
      occurredAt,
      reference,
      vendorName,
      notes,
    }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as {
    id: string;
    categoryId: string;
    amount: number;
    status: string;
    reference: string;
  };
  assert.equal(created.categoryId, fixture.categoryId);
  assert.equal(created.amount, 1875.5);
  assert.equal(created.status, ExpenseStatus.POSTED);
  assert.equal(created.reference, reference);

  const creationAudit = await prisma.auditLog.findFirst({
    where: { action: "expense.created", targetType: "Expense", targetId: created.id },
  });
  assert.ok(creationAudit);
  assertAuditAttribution(creationAudit, fixture);
  const createAfter = asJsonObject(creationAudit.afterData);
  assert.equal(createAfter["id"], created.id);
  assert.equal(createAfter["categoryId"], fixture.categoryId);
  assert.equal(createAfter["categoryName"], fixture.categoryName);
  assert.equal(createAfter["amount"], 1875.5);
  assert.equal(createAfter["currency"], "AFN");
  assert.equal(createAfter["status"], ExpenseStatus.POSTED);
  assert.equal(createAfter["reference"], reference);
  assert.equal("notes" in createAfter, false);
  assert.equal("vendorName" in createAfter, false);
  assert.equal(JSON.stringify(createAfter).includes(notes), false);
  assert.equal(JSON.stringify(createAfter).includes(vendorName), false);

  const reversalNotes = `Private reversal notes ${fixture.suffix}`;
  const reverseResponse = await fetch(`${baseUrl}/${created.id}/reverse`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({ occurredAt: new Date().toISOString(), notes: reversalNotes }),
  });
  assert.equal(reverseResponse.status, 201);
  const reversed = await reverseResponse.json() as {
    original: { id: string; status: string; reversedByExpenseId: string };
    reversal: {
      id: string;
      amount: number;
      isAdjustment: boolean;
      reversalOfExpenseId: string;
      reference: string;
    };
  };
  assert.equal(reversed.original.id, created.id);
  assert.equal(reversed.original.status, ExpenseStatus.REVERSED);
  assert.equal(reversed.original.reversedByExpenseId, reversed.reversal.id);
  assert.equal(reversed.reversal.amount, -1875.5);
  assert.equal(reversed.reversal.isAdjustment, true);
  assert.equal(reversed.reversal.reversalOfExpenseId, created.id);

  const reversalAudit = await prisma.auditLog.findFirst({
    where: { action: "expense.reversed", targetType: "Expense", targetId: created.id },
  });
  assert.ok(reversalAudit);
  assertAuditAttribution(reversalAudit, fixture);
  const beforeData = asJsonObject(reversalAudit.beforeData);
  const afterData = asJsonObject(reversalAudit.afterData);
  const metadata = asJsonObject(reversalAudit.metadata);
  const afterOriginal = asJsonObject(afterData["original"] as Prisma.JsonValue);
  const afterAdjustment = asJsonObject(afterData["adjustment"] as Prisma.JsonValue);
  assert.equal(beforeData["id"], created.id);
  assert.equal(beforeData["status"], ExpenseStatus.POSTED);
  assert.equal(beforeData["amount"], 1875.5);
  assert.equal(afterOriginal["status"], ExpenseStatus.REVERSED);
  assert.equal(afterOriginal["reversedByExpenseId"], reversed.reversal.id);
  assert.equal(afterAdjustment["id"], reversed.reversal.id);
  assert.equal(afterAdjustment["amount"], -1875.5);
  assert.equal(afterAdjustment["reversalOfExpenseId"], created.id);
  assert.equal(metadata["originalExpenseId"], created.id);
  assert.equal(metadata["reversalExpenseId"], reversed.reversal.id);
  assert.equal(metadata["reversalReference"], reversed.reversal.reference);
  assert.equal(JSON.stringify(afterData).includes(reversalNotes), false);

  const actionCounts = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { actorId: fixture.allowedAdminId, action: { startsWith: "expense." } },
    _count: { _all: true },
  });
  assert.deepEqual(
    Object.fromEntries(actionCounts.map((row) => [row.action, row._count._all])),
    {
      "expense.category.created": 1,
      "expense.created": 1,
      "expense.reversed": 1,
    }
  );
  console.log("ok expense create/reverse audits include safe before-after data and linkage");
}

function assertAuditAttribution(
  audit: {
    actorType: AuditActor;
    actorId: string | null;
    actorRole: AdminRole | null;
    sessionId: string | null;
    success: boolean;
    ipAddress: string | null;
    userAgent: string | null;
  },
  fixture: Fixture
) {
  assert.equal(audit.actorType, AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.allowedAdminId);
  assert.equal(audit.actorRole, AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.allowedSessionId);
  assert.equal(audit.success, true);
  assert.ok(audit.ipAddress);
  assert.equal(audit.userAgent, "expense-api-integration-test");
}

async function testAtomicRollback(fixture: Fixture) {
  assert.ok(fixture.categoryId);
  const invalidContext: ExpenseActionContext = {
    actor: { id: `missing-expense-actor-${fixture.suffix}`, role: AdminRole.STAFF },
    meta: { userAgent: "expense-api-integration-rollback-test" },
  };
  const validContext: ExpenseActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: fixture.allowedSessionId,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "expense-api-integration-rollback-test" },
  };

  const rollbackCategoryName = `Expense Audit Rollback ${fixture.suffix}`;
  await assert.rejects(() => createExpenseCategory({ name: rollbackCategoryName }, invalidContext));
  assert.equal(await prisma.expenseCategory.count({ where: { name: rollbackCategoryName } }), 0);

  const rollbackCreateReference = `IT-EXP-CREATE-ROLLBACK-${fixture.suffix}`;
  await assert.rejects(() =>
    createExpense(
      {
        categoryId: fixture.categoryId!,
        amount: 932.25,
        occurredAt: new Date().toISOString(),
        reference: rollbackCreateReference,
      },
      invalidContext
    )
  );
  assert.equal(await prisma.expense.count({ where: { reference: rollbackCreateReference } }), 0);

  const rollbackReverseReference = `IT-EXP-REVERSE-ROLLBACK-${fixture.suffix}`;
  const original = await createExpense(
    {
      categoryId: fixture.categoryId,
      amount: 421.75,
      occurredAt: new Date().toISOString(),
      reference: rollbackReverseReference,
    },
    validContext
  );
  await assert.rejects(() =>
    reverseExpense(
      original.id,
      { occurredAt: new Date().toISOString(), notes: `Rollback reversal ${fixture.suffix}` },
      invalidContext
    )
  );

  const [storedOriginal, reversalCount, reversalAuditCount] = await prisma.$transaction([
    prisma.expense.findUnique({ where: { id: original.id } }),
    prisma.expense.count({ where: { reversalOfExpenseId: original.id } }),
    prisma.auditLog.count({
      where: { action: "expense.reversed", targetType: "Expense", targetId: original.id },
    }),
  ]);
  assert.ok(storedOriginal);
  assert.equal(storedOriginal.status, ExpenseStatus.POSTED);
  assert.equal(storedOriginal.reversedAt, null);
  assert.equal(reversalCount, 0);
  assert.equal(reversalAuditCount, 0);
  console.log("ok failed audit writes roll back category, expense, and reversal mutations atomically");
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "expense-api-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });

  const categories = await prisma.expenseCategory.findMany({
    where: { name: { contains: fixture.suffix } },
    select: { id: true },
  });
  const categoryIds = categories.map((category) => category.id);
  if (categoryIds.length) {
    await prisma.expense.deleteMany({ where: { categoryId: { in: categoryIds }, isAdjustment: true } });
    await prisma.expense.deleteMany({ where: { categoryId: { in: categoryIds } } });
    await prisma.expenseCategory.deleteMany({ where: { id: { in: categoryIds } } });
  }

  await prisma.adminUserPermission.deleteMany({
    where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.adminSession.deleteMany({
    where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({
      where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.expenseCategory.count({ where: { name: { contains: fixture.suffix } } }),
    prisma.expense.count({ where: { reference: { contains: fixture.suffix } } }),
    prisma.adminUserPermission.count({
      where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.adminSession.count({
      where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
    }),
    prisma.adminUser.count({
      where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0]);
  console.log("ok expense API integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runApiTests(fixture);
    await testAtomicRollback(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Expense mutation API integration tests passed (auth, audit, atomicity, cleanup). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
