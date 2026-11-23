import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
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
import { listExpenseCategories } from "./expenses.service";

const OUTPUT_PREFIX = "EXPENSE_AUDIT_BROWSER_FIXTURE:";

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Expense browser fixture refuses to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["EXPENSE_BROWSER_FIXTURE_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Expense browser fixture refuses non-local database host: ${hostname}`);
  }
}

async function setupFixture() {
  const suffix = randomUUID();
  const token = `expense-browser-${suffix}`;
  const username = `it-expense-browser-${suffix}`;
  const actorName = "Expense Browser Fixture";
  const reference = `IT-BROWSER-EXP-${suffix}`;
  const vendorName = `Browser fixture vendor ${suffix}`;
  const notes = `Browser fixture notes ${suffix}`;
  const categories = await listExpenseCategories({ includeInactive: false });
  const category = categories.find((item) => item.slug === "rent") ?? categories[0];
  assert.ok(category, "Expected at least one active expense category");

  const records = await prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        username,
        fullName: actorName,
        passwordHash: "not-used-by-expense-browser-fixture",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        {
          adminUserId: admin.id,
          permission: AdminPermission.EXPENSES_MANAGE,
          mode: PermissionMode.ALLOW,
          reason: "Expense browser fixture",
        },
        {
          adminUserId: admin.id,
          permission: AdminPermission.AUDIT_LOG_VIEW,
          mode: PermissionMode.ALLOW,
          reason: "Expense browser fixture",
        },
      ],
    });
    const session = await tx.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { admin, session };
  });

  return {
    suffix,
    token,
    username,
    actorName,
    adminId: records.admin.id,
    sessionId: records.session.id,
    cookieName: env.AUTH_COOKIE_NAME,
    categoryId: category.id,
    reference,
    vendorName,
    notes,
    amount: 317.25,
  };
}

async function verifyFixture(adminId: string, sessionId: string, reference: string, expectedAmount: number) {
  const original = await prisma.expense.findFirst({
    where: { reference },
    include: { reversedBy: true },
  });
  assert.ok(original, "Browser-created expense was not found");
  assert.equal(Number(original.amount), expectedAmount);
  assert.equal(original.status, ExpenseStatus.REVERSED);
  assert.ok(original.reversedAt);
  assert.ok(original.reversedBy, "Expense reversal adjustment was not found");
  assert.equal(Number(original.reversedBy.amount), -expectedAmount);
  assert.equal(original.reversedBy.isAdjustment, true);
  assert.equal(original.reversedBy.reversalOfExpenseId, original.id);

  const audits = await prisma.auditLog.findMany({
    where: {
      actorId: adminId,
      action: { in: ["expense.created", "expense.reversed"] },
    },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(audits.length, 2);
  const createdAudit = audits.find((item) => item.action === "expense.created");
  const reversedAudit = audits.find((item) => item.action === "expense.reversed");
  assert.ok(createdAudit);
  assert.ok(reversedAudit);

  for (const audit of audits) {
    assert.equal(audit.actorType, AuditActor.ADMIN);
    assert.equal(audit.actorId, adminId);
    assert.equal(audit.actorRole, AdminRole.STAFF);
    assert.equal(audit.sessionId, sessionId);
    assert.equal(audit.targetType, "Expense");
    assert.equal(audit.targetId, original.id);
    assert.equal(audit.success, true);
    assert.ok(audit.ipAddress);
    assert.match(audit.userAgent ?? "", /Chrome/u);
    assertNoSensitiveExpenseFields(audit.beforeData);
    assertNoSensitiveExpenseFields(audit.afterData);
  }

  const createAfter = asJsonObject(createdAudit.afterData);
  assert.equal(createAfter["id"], original.id);
  assert.equal(createAfter["amount"], expectedAmount);
  assert.equal(createAfter["status"], ExpenseStatus.POSTED);
  assert.equal(createAfter["reference"], reference);

  const reverseBefore = asJsonObject(reversedAudit.beforeData);
  const reverseAfter = asJsonObject(reversedAudit.afterData);
  const reverseOriginal = asJsonObject(reverseAfter["original"] as Prisma.JsonValue);
  const reverseAdjustment = asJsonObject(reverseAfter["adjustment"] as Prisma.JsonValue);
  assert.equal(reverseBefore["status"], ExpenseStatus.POSTED);
  assert.equal(reverseOriginal["status"], ExpenseStatus.REVERSED);
  assert.equal(reverseOriginal["reversedByExpenseId"], original.reversedBy.id);
  assert.equal(reverseAdjustment["id"], original.reversedBy.id);
  assert.equal(reverseAdjustment["amount"], -expectedAmount);
  assert.equal(reverseAdjustment["reversalOfExpenseId"], original.id);

  return {
    expenseId: original.id,
    reversalId: original.reversedBy.id,
    createdAuditId: createdAudit.id,
    reversedAuditId: reversedAudit.id,
  };
}

function assertNoSensitiveExpenseFields(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertNoSensitiveExpenseFields);
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assert.notEqual(key, "notes");
    assert.notEqual(key, "vendorName");
    assertNoSensitiveExpenseFields(nested);
  }
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

async function cleanupFixture(adminId: string, sessionId: string, reference: string) {
  const original = await prisma.expense.findFirst({
    where: { reference },
    include: { reversedBy: true },
  });

  await prisma.auditLog.deleteMany({ where: { actorId: adminId } });
  if (original?.reversedBy) {
    await prisma.expense.delete({ where: { id: original.reversedBy.id } });
  }
  if (original) {
    await prisma.expense.delete({ where: { id: original.id } });
  }
  await prisma.adminUserPermission.deleteMany({ where: { adminUserId: adminId } });
  await prisma.adminSession.deleteMany({ where: { id: sessionId } });
  await prisma.adminUser.deleteMany({ where: { id: adminId } });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({ where: { actorId: adminId } }),
    prisma.expense.count({
      where: {
        OR: [
          { reference },
          ...(original ? [{ reversalOfExpenseId: original.id }] : []),
        ],
      },
    }),
    prisma.adminUserPermission.count({ where: { adminUserId: adminId } }),
    prisma.adminSession.count({ where: { id: sessionId } }),
    prisma.adminUser.count({ where: { id: adminId } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  return { cleaned: true, leftovers };
}

function requiredArg(index: number, label: string) {
  const value = process.argv[index];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

async function main() {
  assertSafeDatabaseTarget();
  const mode = requiredArg(2, "fixture mode");
  let result: unknown;
  if (mode === "setup") {
    result = await setupFixture();
  } else if (mode === "verify") {
    result = await verifyFixture(
      requiredArg(3, "admin ID"),
      requiredArg(4, "session ID"),
      requiredArg(5, "expense reference"),
      Number(requiredArg(6, "expected amount"))
    );
  } else if (mode === "cleanup") {
    result = await cleanupFixture(
      requiredArg(3, "admin ID"),
      requiredArg(4, "session ID"),
      requiredArg(5, "expense reference")
    );
  } else {
    throw new Error(`Unknown fixture mode: ${mode}`);
  }
  console.log(`${OUTPUT_PREFIX}${JSON.stringify(result)}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
