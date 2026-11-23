import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  DeviceConnectionType,
  DeviceStatus,
  DeviceType,
  PermissionMode,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { errorHandler, HttpError } from "../../middlewares/error-handler";

const COMMAND_ACTIONS = [
  "device.enrollment.started",
  "device.users.synced",
  "device.user.upserted",
  "device.user.deleted",
] as const;

const ENROLLMENT_NAME = "Private Enrollment Name";
const UPSERT_NAME = "Private Upsert Name";
const REJECTED_NAME = "Private Rejected Name";
const RAW_COMMAND_ERROR = "private raw device command error";

type Fixture = {
  suffix: string;
  password: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  deviceId: string;
};

type StubCall = {
  operation: "enroll" | "sync" | "upsert" | "delete";
  deviceId: string;
  payload?: Record<string, unknown>;
};

type DeviceManagerModule = typeof import("./deviceManager");
type DeviceRouterModule = typeof import("./device.router");

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Device-user command audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_USER_COMMAND_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Device-user command audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const password = `private-device-user-command-password-${suffix}`;
  const allowedToken = `device-user-command-audit-allowed-${suffix}`;
  const deniedToken = `device-user-command-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-user-command-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-device-user-command-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-user-command-audit-denied-${suffix}`,
        passwordHash: "not-used-by-device-user-command-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_ENROLL, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_USER_SYNC, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_ENROLL, PermissionMode.DENY),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_USER_SYNC, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    const device = await tx.device.create({
      data: {
        name: `User command audit device ${suffix}`,
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
        enabled: false,
        status: DeviceStatus.UNKNOWN,
        model: "K40-USER-COMMAND-AUDIT",
        config: { ip: "127.0.0.1", port: 65534, timeoutMs: 100, password },
      },
    });
    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession, device };
  });
  return {
    suffix,
    password,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    deviceId: records.device.id,
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return { adminUserId, permission, mode, reason: "Device-user command audit API integration fixture" };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function installDeviceCommandStubs(calls: StubCall[]) {
  const manager = require("./deviceManager") as DeviceManagerModule;
  const originals = {
    enrollDevice: manager.enrollDevice,
    syncDeviceUsers: manager.syncDeviceUsers,
    upsertDeviceUser: manager.upsertDeviceUser,
    deleteDeviceUser: manager.deleteDeviceUser,
  };

  Object.assign(manager, {
    enrollDevice: async (deviceId: string, payload: { userId: string; fingerId?: number; name?: string }) => {
      calls.push({ operation: "enroll", deviceId, payload: { ...payload } });
      return { ok: true, mode: "temporary" as const };
    },
    syncDeviceUsers: async (deviceId: string) => {
      calls.push({ operation: "sync", deviceId });
      return { total: 3, synced: 2, skipped: 1, mode: "temporary" as const };
    },
    upsertDeviceUser: async (deviceId: string, payload: { userId: string | number; name: string }) => {
      calls.push({ operation: "upsert", deviceId, payload: { ...payload } });
      if (payload.userId === "reject-42") {
        throw new HttpError(502, RAW_COMMAND_ERROR);
      }
      return { ok: true, mode: "temporary" as const };
    },
    deleteDeviceUser: async (deviceId: string, payload: { userId?: string | number; uid?: number }) => {
      calls.push({ operation: "delete", deviceId, payload: { ...payload } });
      return { ok: true, mode: "temporary" as const };
    },
  } satisfies Partial<DeviceManagerModule>);

  return () => Object.assign(manager, originals);
}

function buildTestApp() {
  const { deviceRouter } = require("./device.router") as DeviceRouterModule;
  const app = express();
  app.use(express.json());
  app.use("/api/v1/devices", deviceRouter);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture, calls: StubCall[]) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/devices`;
    await testGuards(baseUrl, fixture, calls);
    await testSuccessfulCommands(baseUrl, fixture, calls);
    await testRejectedCommand(baseUrl, fixture);
    await assertExactActionCounts(fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testGuards(baseUrl: string, fixture: Fixture, calls: StubCall[]) {
  const unauthenticated = await postJson(`${baseUrl}/${fixture.deviceId}/enroll`, { userId: "40" });
  assert.equal(unauthenticated.status, 401);

  const deniedEnrollment = await postJson(
    `${baseUrl}/${fixture.deviceId}/enroll`,
    { userId: "40" },
    fixture.deniedToken
  );
  assert.equal(deniedEnrollment.status, 403);
  assert.equal(
    (await deniedEnrollment.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.DEVICES_ENROLL
  );

  const deniedSync = await postJson(`${baseUrl}/${fixture.deviceId}/users/sync`, {}, fixture.deniedToken);
  assert.equal(deniedSync.status, 403);
  assert.equal(
    (await deniedSync.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.DEVICES_USER_SYNC
  );
  assert.equal(calls.length, 0);
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  assert.equal(
    await prisma.auditLog.count({ where: { action: { in: [...COMMAND_ACTIONS] }, targetId: fixture.deviceId } }),
    0
  );
  console.log("ok device enrollment/user endpoints enforce 401/403 without audit or command execution");
}

async function testSuccessfulCommands(baseUrl: string, fixture: Fixture, calls: StubCall[]) {
  const enrollment = await postJson(
    `${baseUrl}/${fixture.deviceId}/enroll`,
    { userId: "41", fingerId: 2, name: ENROLLMENT_NAME },
    fixture.allowedToken
  );
  assert.equal(enrollment.status, 200);
  assert.deepEqual(await enrollment.json(), { ok: true, mode: "temporary" });
  const enrollmentAudit = await findAudit("device.enrollment.started", fixture.deviceId, true);
  assertAuditAttribution(enrollmentAudit, fixture, true);
  assert.deepEqual(asJsonObject(enrollmentAudit.metadata), {
    outcome: "STARTED",
    externalUserId: "41",
    fingerId: 2,
    mode: "temporary",
  });
  assertSafeAudit(enrollmentAudit, fixture);

  const sync = await postJson(`${baseUrl}/${fixture.deviceId}/users/sync`, {}, fixture.allowedToken);
  assert.equal(sync.status, 200);
  assert.deepEqual(await sync.json(), { total: 3, synced: 2, skipped: 1, mode: "temporary" });
  const syncAudit = await findAudit("device.users.synced", fixture.deviceId, true);
  assertAuditAttribution(syncAudit, fixture, true);
  assert.deepEqual(asJsonObject(syncAudit.metadata), {
    outcome: "COMPLETED",
    mode: "temporary",
    totalUsers: 3,
    syncedUsers: 2,
    skippedUsers: 1,
  });
  assertSafeAudit(syncAudit, fixture);

  const upsert = await postJson(
    `${baseUrl}/${fixture.deviceId}/users/upsert`,
    { userId: "42", name: UPSERT_NAME },
    fixture.allowedToken
  );
  assert.equal(upsert.status, 200);
  const upsertAudit = await findAudit("device.user.upserted", fixture.deviceId, true);
  assertAuditAttribution(upsertAudit, fixture, true);
  assert.deepEqual(asJsonObject(upsertAudit.metadata), {
    outcome: "COMPLETED",
    externalUserId: "42",
    mode: "temporary",
  });
  assertSafeAudit(upsertAudit, fixture);

  const deletion = await postJson(
    `${baseUrl}/${fixture.deviceId}/users/delete`,
    { userId: "42" },
    fixture.allowedToken
  );
  assert.equal(deletion.status, 200);
  const deleteAudit = await findAudit("device.user.deleted", fixture.deviceId, true);
  assertAuditAttribution(deleteAudit, fixture, true);
  assert.deepEqual(asJsonObject(deleteAudit.metadata), {
    outcome: "COMPLETED",
    externalUserId: "42",
    mode: "temporary",
  });
  assertSafeAudit(deleteAudit, fixture);

  assert.deepEqual(calls, [
    { operation: "enroll", deviceId: fixture.deviceId, payload: { userId: "41", fingerId: 2, name: ENROLLMENT_NAME } },
    { operation: "sync", deviceId: fixture.deviceId },
    { operation: "upsert", deviceId: fixture.deviceId, payload: { userId: "42", name: UPSERT_NAME } },
    { operation: "delete", deviceId: fixture.deviceId, payload: { userId: "42" } },
  ]);
  console.log("ok successful enrollment/user commands record exact safe summaries while forwarding full command inputs");
}

async function testRejectedCommand(baseUrl: string, fixture: Fixture) {
  const response = await postJson(
    `${baseUrl}/${fixture.deviceId}/users/upsert`,
    { userId: "reject-42", name: REJECTED_NAME },
    fixture.allowedToken
  );
  assert.equal(response.status, 502);
  const audit = await findAudit("device.user.upserted", fixture.deviceId, false);
  assertAuditAttribution(audit, fixture, false);
  assert.deepEqual(asJsonObject(audit.metadata), {
    externalUserId: "reject-42",
    outcome: "ERROR",
    errorType: "HTTP_ERROR",
    httpStatus: 502,
  });
  assertSafeAudit(audit, fixture);
  console.log("ok rejected user command records safe failure metadata and preserves the original HTTP status");
}

async function assertExactActionCounts(fixture: Fixture) {
  const rows = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { actorId: fixture.allowedAdminId, action: { in: [...COMMAND_ACTIONS] } },
    _count: { _all: true },
  });
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.action, row._count._all])), {
    "device.enrollment.started": 1,
    "device.user.deleted": 1,
    "device.user.upserted": 2,
    "device.users.synced": 1,
  });
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  console.log("ok exact enrollment/user action counts reconcile and denied actor has zero rows");
}

async function findAudit(action: string, targetId: string, success: boolean) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "Device", targetId, success },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  assert.ok(audit, `Expected ${action} audit for device ${targetId}`);
  return audit;
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
    beforeData?: Prisma.JsonValue | null;
    afterData?: Prisma.JsonValue | null;
  },
  fixture: Fixture,
  success: boolean
) {
  assert.equal(audit.actorType, AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.allowedAdminId);
  assert.equal(audit.actorRole, AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.allowedSessionId);
  assert.equal(audit.success, success);
  assert.ok(audit.ipAddress);
  assert.equal(audit.userAgent, "device-user-command-audit-api-integration-test");
  assert.equal(audit.beforeData, null);
  assert.equal(audit.afterData, null);
}

function assertSafeAudit(
  audit: { beforeData?: Prisma.JsonValue | null; afterData?: Prisma.JsonValue | null; metadata?: Prisma.JsonValue | null },
  fixture: Fixture
) {
  const serialized = JSON.stringify(audit);
  for (const forbidden of [
    fixture.password,
    ENROLLMENT_NAME,
    UPSERT_NAME,
    REJECTED_NAME,
    RAW_COMMAND_ERROR,
    "password",
    "\"name\"",
    "fingerprintTemplate",
    "biometric",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `Audit unexpectedly contained ${forbidden}`);
  }
}

function asJsonObject(value: Prisma.JsonValue | undefined | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

function postJson(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "device-user-command-audit-api-integration-test",
  };
  if (token) headers["cookie"] = `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`;
  return fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
}

function commandAuditCount(actorId: string) {
  return prisma.auditLog.count({ where: { actorId, action: { in: [...COMMAND_ACTIONS] } } });
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } });
  await prisma.device.deleteMany({ where: { id: fixture.deviceId } });
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
    prisma.auditLog.count({ where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.device.count({ where: { id: fixture.deviceId } }),
    prisma.adminUserPermission.count({ where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.adminSession.count({ where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } } }),
    prisma.adminUser.count({ where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  console.log("ok device-user command audit integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const calls: StubCall[] = [];
  const restoreCommands = installDeviceCommandStubs(calls);
  const fixture = await createFixture();
  try {
    await runApiTests(fixture, calls);
  } finally {
    await cleanupFixture(fixture);
    restoreCommands();
  }
  console.log("Device-user command audit API integration tests passed (auth, success/failure, privacy, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
