import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  PermissionMode,
} from "@prisma/client";
import { env, type AppEdition } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { errorHandler } from "../../middlewares/error-handler";
import { notFoundHandler } from "../../middlewares/not-found";
import { createAuditLogRouter } from "./audit-log.router";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  action: string;
  failedAction: string;
  targetId: string;
  auditIds: string[];
  newestAuditId: string;
  attendanceSafeAuditId: string;
  attendanceHiddenAuditIds: string[];
  dateKey: string;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Audit Log integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["AUDIT_LOG_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Audit Log integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `audit-viewer-allowed-${suffix}`;
  const deniedToken = `audit-viewer-denied-${suffix}`;
  const action = `audit.integration.${suffix}`;
  const failedAction = `audit.integration.failed.${suffix}`;
  const targetId = `audit-target-${suffix}`;
  const now = new Date();
  const olderAt = new Date(now.getTime() - 120_000);
  const middleAt = new Date(now.getTime() - 60_000);

  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-audit-allowed-${suffix}`,
        fullName: "Audit Allowed Integration",
        passwordHash: "not-used-by-audit-log-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-audit-denied-${suffix}`,
        fullName: "Audit Denied Integration",
        passwordHash: "not-used-by-audit-log-integration-test",
        role: AdminRole.STAFF,
      },
    });

    await tx.adminUserPermission.createMany({
      data: [
        {
          adminUserId: allowedAdmin.id,
          permission: AdminPermission.AUDIT_LOG_VIEW,
          mode: PermissionMode.ALLOW,
          reason: "Audit Log integration fixture",
        },
        {
          adminUserId: deniedAdmin.id,
          permission: AdminPermission.AUDIT_LOG_VIEW,
          mode: PermissionMode.DENY,
          reason: "Audit Log integration fixture",
        },
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

    const older = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action,
        targetType: "Member",
        targetId,
        success: true,
        ipAddress: "127.0.0.1",
        userAgent: "audit-integration-fixture",
        beforeData: { status: "PENDING", password: "must-not-leak" },
        afterData: { status: "ACTIVE", publicNote: "visible" },
        metadata: { nested: { apiToken: "must-not-leak", note: "visible metadata" } },
        createdAt: olderAt,
      },
    });
    const failed = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action: failedAction,
        targetType: "Device",
        targetId,
        success: false,
        metadata: { reason: "Expected integration failure" },
        createdAt: middleAt,
      },
    });
    const newest = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action,
        targetType: "Member",
        targetId,
        success: false,
        metadata: { reason: "Newest matching record" },
        createdAt: now,
      },
    });

    const attendanceSafe = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action: "member.created",
        targetType: "Member",
        targetId,
        success: true,
        afterData: { memberType: "STAFF", isStaff: true, salaryAmount: 50_000 },
        metadata: { fixture: suffix },
      },
    });
    const attendanceCustomer = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action: "member.created",
        targetType: "Member",
        targetId,
        success: true,
        afterData: { memberType: "CUSTOMER", isStaff: false },
        metadata: { fixture: suffix },
      },
    });
    const attendanceFinancial = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action: "expense.created",
        targetType: "Expense",
        targetId,
        success: true,
        metadata: { fixture: suffix, amount: 50_000 },
      },
    });
    const attendanceAmbiguous = await tx.auditLog.create({
      data: {
        actorType: AuditActor.ADMIN,
        actorId: allowedAdmin.id,
        actorRole: AdminRole.STAFF,
        sessionId: allowedSession.id,
        action: "attendance.manual.created",
        targetType: "AttendanceLog",
        targetId,
        success: true,
        metadata: { fixture: suffix },
      },
    });

    return {
      allowedAdmin,
      deniedAdmin,
      allowedSession,
      deniedSession,
      older,
      failed,
      newest,
      attendanceSafe,
      attendanceCustomer,
      attendanceFinancial,
      attendanceAmbiguous,
    };
  });

  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    action,
    failedAction,
    targetId,
    auditIds: [
      records.older.id,
      records.failed.id,
      records.newest.id,
      records.attendanceSafe.id,
      records.attendanceCustomer.id,
      records.attendanceFinancial.id,
      records.attendanceAmbiguous.id,
    ],
    newestAuditId: records.newest.id,
    attendanceSafeAuditId: records.attendanceSafe.id,
    attendanceHiddenAuditIds: [
      records.attendanceCustomer.id,
      records.attendanceFinancial.id,
      records.attendanceAmbiguous.id,
    ],
    dateKey: formatDateKey(now),
  };
}

function buildTestApp(edition: AppEdition) {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/audit-logs", createAuditLogRouter(edition));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp("FULL"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/audit-logs`;
    await testAuthorizationGuards(baseUrl, fixture);
    await testListFiltersAndPagination(baseUrl, fixture);
    await testOptionsAndSanitizedDetail(baseUrl, fixture);
    await testValidationAndReadOnlyContract(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function runAttendanceIsolationTests(fixture: Fixture) {
  const server = createServer(buildTestApp("ATTENDANCE"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/audit-logs`;
    const headers = authenticatedHeaders(fixture.allowedToken);

    const listResponse = await fetch(
      `${baseUrl}?${new URLSearchParams({ search: fixture.targetId, pageSize: "20" }).toString()}`,
      { headers }
    );
    assert.equal(listResponse.status, 200);
    const list = await listResponse.json() as {
      items: Array<{ id: string; action: string }>;
      total: number;
      summary: { total: number; successful: number; failed: number };
    };
    assert.equal(list.total, 1);
    assert.deepEqual(list.summary, { total: 1, successful: 1, failed: 0 });
    assert.deepEqual(list.items.map((item) => item.id), [fixture.attendanceSafeAuditId]);

    const optionsResponse = await fetch(`${baseUrl}/options`, { headers });
    assert.equal(optionsResponse.status, 200);
    const options = await optionsResponse.json() as { actions: string[]; targetTypes: string[] };
    assert.equal(options.actions.includes("member.created"), true);
    assert.equal(options.actions.includes("expense.created"), false);
    assert.equal(options.targetTypes.includes("Expense"), false);

    const visibleDetailResponse = await fetch(`${baseUrl}/${fixture.attendanceSafeAuditId}`, { headers });
    assert.equal(visibleDetailResponse.status, 200);
    const visibleDetail = await visibleDetailResponse.json() as { afterData: Record<string, unknown> };
    assert.equal(visibleDetail.afterData["salaryAmount"], "[REDACTED]");
    assert.equal(visibleDetail.afterData["memberType"], "STAFF");

    for (const hiddenId of fixture.attendanceHiddenAuditIds) {
      const hiddenDetailResponse = await fetch(`${baseUrl}/${hiddenId}`, { headers });
      assert.equal(hiddenDetailResponse.status, 404);
    }
    console.log("✓ ATTENDANCE list, summary, options, and detail isolate historical FULL Audit rows");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function testAuthorizationGuards(baseUrl: string, fixture: Fixture) {
  const unauthenticated = await fetch(`${baseUrl}?action=${encodeURIComponent(fixture.action)}`);
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json() as { message: string }).message, "Authentication required");

  const forbidden = await fetch(`${baseUrl}?action=${encodeURIComponent(fixture.action)}`, {
    headers: authenticatedHeaders(fixture.deniedToken),
  });
  assert.equal(forbidden.status, 403);
  assert.equal(
    (await forbidden.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.AUDIT_LOG_VIEW
  );
  console.log("✓ Audit Log API enforces 401 and AUDIT_LOG_VIEW 403 guards");
}

async function testListFiltersAndPagination(baseUrl: string, fixture: Fixture) {
  const firstPage = await fetch(
    `${baseUrl}?${new URLSearchParams({ action: fixture.action, page: "1", pageSize: "1" }).toString()}`,
    { headers: authenticatedHeaders(fixture.allowedToken) }
  );
  assert.equal(firstPage.status, 200);
  const pageBody = await firstPage.json() as {
    items: Array<{ id: string; action: string; success: boolean; actor: { id: string } | null }>;
    page: number;
    pageSize: number;
    total: number;
    summary: { total: number; successful: number; failed: number };
  };
  assert.equal(pageBody.page, 1);
  assert.equal(pageBody.pageSize, 1);
  assert.equal(pageBody.total, 2);
  assert.deepEqual(pageBody.summary, { total: 2, successful: 1, failed: 1 });
  assert.equal(pageBody.items[0]?.id, fixture.newestAuditId);
  assert.equal(pageBody.items[0]?.actor?.id, fixture.allowedAdminId);

  const failedOnly = await fetch(
    `${baseUrl}?${new URLSearchParams({ search: fixture.targetId, success: "false", pageSize: "10" }).toString()}`,
    { headers: authenticatedHeaders(fixture.allowedToken) }
  );
  assert.equal(failedOnly.status, 200);
  const failedBody = await failedOnly.json() as { items: Array<{ id: string; success: boolean }>; total: number };
  assert.equal(failedBody.total, 2);
  assert.equal(failedBody.items.every((item) => item.success === false), true);

  const dateFiltered = await fetch(
    `${baseUrl}?${new URLSearchParams({
      action: fixture.action,
      actorId: fixture.allowedAdminId,
      targetType: "Member",
      from: fixture.dateKey,
      to: fixture.dateKey,
    }).toString()}`,
    { headers: authenticatedHeaders(fixture.allowedToken) }
  );
  assert.equal(dateFiltered.status, 200);
  assert.equal((await dateFiltered.json() as { total: number }).total, 2);
  console.log("✓ Audit Log list reconciles ordering, pagination, summary, search, status, actor, target, and date filters");
}

async function testOptionsAndSanitizedDetail(baseUrl: string, fixture: Fixture) {
  const optionsResponse = await fetch(`${baseUrl}/options`, {
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(optionsResponse.status, 200);
  const options = await optionsResponse.json() as {
    actions: string[];
    targetTypes: string[];
    actors: Array<{ id: string }>;
  };
  assert.equal(options.actions.includes(fixture.action), true);
  assert.equal(options.targetTypes.includes("Member"), true);
  assert.equal(options.actors.some((actor) => actor.id === fixture.allowedAdminId), true);

  const detailResponse = await fetch(`${baseUrl}/${fixture.auditIds[0]}`, {
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(detailResponse.status, 200);
  const detail = await detailResponse.json() as {
    sessionId: string | null;
    userAgent: string | null;
    beforeData: Record<string, unknown>;
    afterData: Record<string, unknown>;
    metadata: { nested: Record<string, unknown> };
  };
  assert.equal(detail.sessionId, fixture.allowedSessionId);
  assert.equal(detail.userAgent, "audit-integration-fixture");
  assert.equal(detail.beforeData["password"], "[REDACTED]");
  assert.equal(detail.afterData["publicNote"], "visible");
  assert.equal(detail.metadata.nested["apiToken"], "[REDACTED]");
  assert.equal(detail.metadata.nested["note"], "visible metadata");
  console.log("✓ Audit Log options and detail expose useful fields while redacting sensitive JSON keys");
}

async function testValidationAndReadOnlyContract(baseUrl: string, fixture: Fixture) {
  const invalidDate = await fetch(`${baseUrl}?from=2026-02-31`, {
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(invalidDate.status, 400);

  const deleteAttempt = await fetch(`${baseUrl}/${fixture.auditIds[0]}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(deleteAttempt.status, 404);

  const remaining = await prisma.auditLog.count({ where: { id: { in: fixture.auditIds } } });
  assert.equal(remaining, fixture.auditIds.length);
  console.log("✓ Audit Log API rejects rollover dates and exposes no delete mutation route");
}

function authenticatedHeaders(token: string) {
  return {
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "audit-log-api-integration-test",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({ where: { id: { in: fixture.auditIds } } });
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
    prisma.auditLog.count({ where: { id: { in: fixture.auditIds } } }),
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
  assert.deepEqual(leftovers, [0, 0, 0, 0]);
  console.log("✓ Audit Log integration fixture cleanup verified (0 records left)");
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runApiTests(fixture);
    await runAttendanceIsolationTests(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Audit Log API integration tests passed (authorization, filters, detail redaction, read-only contract, cleanup). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
