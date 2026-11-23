import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AttendanceSource,
  AttendanceType,
  AuditActor,
  MemberStatus,
  MemberType,
  PermissionMode,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { attendanceRouter } from "./attendance.router";
import { ATTENDANCE_DATA_SCOPES } from "./attendance-edition-scope";
import { createManualAttendance, type AttendanceActionContext } from "./attendance.service";

type Fixture = {
  suffix: string;
  memberId: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  dateKey: string;
  occurredAt: Date;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Attendance API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["ATTENDANCE_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Attendance API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `attendance-allowed-${suffix}`;
  const deniedToken = `attendance-denied-${suffix}`;
  const occurredAt = new Date();
  occurredAt.setMonth(occurredAt.getMonth() - 2);
  occurredAt.setHours(9, 15, 0, 0);
  const dateKey = formatDateKey(occurredAt);

  const records = await prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        code: `IT-ATT-API-${suffix}`,
        firstName: "Attendance API",
        lastName: "Integration Fixture",
        memberType: MemberType.STAFF,
        status: MemberStatus.ACTIVE,
        isStaff: true,
      },
    });
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-attendance-api-allowed-${suffix}`,
        passwordHash: "not-used-by-attendance-api-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-attendance-api-denied-${suffix}`,
        passwordHash: "not-used-by-attendance-api-integration-test",
        role: AdminRole.STAFF,
      },
    });

    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.ATTENDANCE_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.ATTENDANCE_MANUAL, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.ATTENDANCE_JUSTIFY, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.ATTENDANCE_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.ATTENDANCE_MANUAL, PermissionMode.DENY),
        permissionRow(deniedAdmin.id, AdminPermission.ATTENDANCE_JUSTIFY, PermissionMode.DENY),
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

    return { member, allowedAdmin, deniedAdmin, allowedSession, deniedSession };
  });

  return {
    suffix,
    memberId: records.member.id,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    dateKey,
    occurredAt,
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return {
    adminUserId,
    permission,
    mode,
    reason: "Attendance API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/attendance", requirePermission(AdminPermission.ATTENDANCE_VIEW), attendanceRouter);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/attendance`;
    await testAuthenticationAndPermissionGuards(baseUrl, fixture);
    await testManualAttendanceAndAudit(baseUrl, fixture);
    await testJustificationAuditLifecycle(baseUrl, fixture);
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
  const manualBody = {
    memberId: fixture.memberId,
    eventType: "IN",
    occurredAt: fixture.occurredAt.toISOString(),
    notes: `AUTH-GUARD-${fixture.suffix}`,
  };

  const unauthenticated = await fetch(`${baseUrl}/manual`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(manualBody),
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal((await unauthenticated.json() as { message: string }).message, "Authentication required");

  const deniedManual = await fetch(`${baseUrl}/manual`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(manualBody),
  });
  assert.equal(deniedManual.status, 403);
  assert.equal(
    (await deniedManual.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.ATTENDANCE_MANUAL
  );

  const deniedJustification = await fetch(`${baseUrl}/justifications`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify({ memberId: fixture.memberId, date: fixture.dateKey, reason: "Denied request" }),
  });
  assert.equal(deniedJustification.status, 403);
  assert.equal(
    (await deniedJustification.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.ATTENDANCE_JUSTIFY
  );

  const [attendanceWrites, deniedAudits] = await prisma.$transaction([
    prisma.attendanceLog.count({ where: { memberId: fixture.memberId } }),
    prisma.auditLog.count({ where: { actorId: fixture.deniedAdminId, action: { startsWith: "attendance." } } }),
  ]);
  assert.equal(attendanceWrites, 0);
  assert.equal(deniedAudits, 0);
  console.log("✓ attendance API rejects unauthenticated and unauthorized mutations with no writes");
}

async function testManualAttendanceAndAudit(baseUrl: string, fixture: Fixture) {
  const notes = `Manual attendance audit ${fixture.suffix}`;
  const response = await fetch(`${baseUrl}/manual`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      memberId: fixture.memberId,
      eventType: "IN",
      occurredAt: fixture.occurredAt.toISOString(),
      notes,
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as {
    id: string;
    memberId: string;
    eventType: string;
    source: string;
    isAuthorized: boolean;
    reason: string | null;
  };
  assert.equal(body.memberId, fixture.memberId);
  assert.equal(body.eventType, AttendanceType.IN);
  assert.equal(body.source, AttendanceSource.MANUAL);
  assert.equal(body.isAuthorized, true);
  assert.equal(body.reason, notes);

  const [stored, audit] = await prisma.$transaction([
    prisma.attendanceLog.findUnique({ where: { id: body.id } }),
    prisma.auditLog.findFirst({
      where: { action: "attendance.manual.created", targetType: "AttendanceLog", targetId: body.id },
    }),
  ]);
  assert.ok(stored);
  assert.equal(stored.memberId, fixture.memberId);
  assert.equal(stored.reason, notes);
  assert.ok(audit);
  assert.equal(audit.actorType, AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.allowedAdminId);
  assert.equal(audit.actorRole, AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.allowedSessionId);
  assert.equal(audit.userAgent, "attendance-api-integration-test");
  assert.ok(audit.ipAddress);
  const afterData = asJsonObject(audit.afterData);
  assert.equal(afterData["memberId"], fixture.memberId);
  assert.equal(afterData["entryType"], AttendanceType.IN);
  assert.equal(afterData["reason"], notes);
  console.log("✓ authorized manual attendance creates the record and attributed audit together");
}

async function testJustificationAuditLifecycle(baseUrl: string, fixture: Fixture) {
  const createdReason = `Approved leave ${fixture.suffix}`;
  const updatedReason = `Approved medical leave ${fixture.suffix}`;
  const createResponse = await fetch(`${baseUrl}/justifications`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({ memberId: fixture.memberId, date: fixture.dateKey, reason: createdReason }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as { id: string; reason: string | null };
  assert.equal(created.reason, createdReason);

  const updateResponse = await fetch(`${baseUrl}/justifications`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({ memberId: fixture.memberId, date: fixture.dateKey, reason: updatedReason }),
  });
  assert.equal(updateResponse.status, 201);
  const updated = await updateResponse.json() as { id: string; reason: string | null };
  assert.equal(updated.id, created.id);
  assert.equal(updated.reason, updatedReason);

  const deleteQuery = new URLSearchParams({ memberId: fixture.memberId, date: fixture.dateKey });
  const deleteResponse = await fetch(`${baseUrl}/justifications?${deleteQuery.toString()}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(deleteResponse.status, 204);

  const [remaining, audits] = await prisma.$transaction([
    prisma.attendanceJustification.count({ where: { id: created.id } }),
    prisma.auditLog.findMany({
      where: { targetType: "AttendanceJustification", targetId: created.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  assert.equal(remaining, 0);
  assert.deepEqual(
    audits.map((record) => record.action),
    [
      "attendance.justification.created",
      "attendance.justification.updated",
      "attendance.justification.deleted",
    ]
  );
  audits.forEach((audit) => {
    assert.equal(audit.actorId, fixture.allowedAdminId);
    assert.equal(audit.sessionId, fixture.allowedSessionId);
    assert.equal(audit.userAgent, "attendance-api-integration-test");
  });
  assert.equal(asJsonObject(audits[0]?.afterData ?? null)["reason"], createdReason);
  assert.equal(asJsonObject(audits[1]?.beforeData ?? null)["reason"], createdReason);
  assert.equal(asJsonObject(audits[1]?.afterData ?? null)["reason"], updatedReason);
  assert.equal(asJsonObject(audits[2]?.beforeData ?? null)["reason"], updatedReason);
  console.log("✓ justification create, update, and delete preserve complete attributed audit history");
}

async function testAtomicRollback(fixture: Fixture) {
  const rollbackNotes = `ROLLBACK-${fixture.suffix}`;
  const invalidContext: AttendanceActionContext = {
    actor: { id: `missing-attendance-actor-${fixture.suffix}`, role: AdminRole.STAFF },
    meta: { userAgent: "attendance-atomic-rollback-test" },
  };

  await assert.rejects(() =>
    createManualAttendance(
      {
        memberId: fixture.memberId,
        eventType: "OUT",
        occurredAt: new Date(fixture.occurredAt.getTime() + 60_000).toISOString(),
        notes: rollbackNotes,
      },
      invalidContext,
      ATTENDANCE_DATA_SCOPES.FULL_LEGACY
    )
  );

  const remaining = await prisma.attendanceLog.count({
    where: { memberId: fixture.memberId, reason: rollbackNotes },
  });
  assert.equal(remaining, 0);
  console.log("✓ failed audit creation rolls back the manual attendance record atomically");
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "attendance-api-integration-test",
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
  await prisma.attendanceJustification.deleteMany({ where: { memberId: fixture.memberId } });
  await prisma.attendanceLog.deleteMany({ where: { memberId: fixture.memberId } });
  await prisma.adminUserPermission.deleteMany({
    where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.adminSession.deleteMany({
    where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.member.deleteMany({ where: { id: fixture.memberId } });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({
      where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.attendanceJustification.count({ where: { memberId: fixture.memberId } }),
    prisma.attendanceLog.count({ where: { memberId: fixture.memberId } }),
    prisma.adminUserPermission.count({
      where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.adminSession.count({
      where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
    }),
    prisma.adminUser.count({
      where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.member.count({ where: { id: fixture.memberId } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0]);
  console.log("✓ attendance API integration fixture cleanup verified (0 records left)");
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
    await testAtomicRollback(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Attendance mutation API integration tests passed (auth, permissions, audit, atomicity, cleanup). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
