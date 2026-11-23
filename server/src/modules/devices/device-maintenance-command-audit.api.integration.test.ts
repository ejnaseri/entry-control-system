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

const COMMAND_ACTIONS = ["device.time.updated", "device.door.unlocked", "device.logs.cleared"] as const;
const REQUESTED_TIME = "2026-07-20T08:15:30.000Z";
const RAW_COMMAND_ERROR = "private raw clear-logs command error";

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
  operation: "set-time" | "unlock" | "clear-logs";
  deviceId: string;
  value?: string | number;
};

type DeviceManagerModule = typeof import("./deviceManager");
type DeviceRouterModule = typeof import("./device.router");

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Device maintenance command audit API integration tests refuse NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_MAINTENANCE_COMMAND_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Device maintenance command audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return { adminUserId, permission, mode, reason: "Device maintenance command audit API integration fixture" };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const password = `private-device-maintenance-password-${suffix}`;
  const allowedToken = `device-maintenance-audit-allowed-${suffix}`;
  const deniedToken = `device-maintenance-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-maintenance-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-device-maintenance-audit-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-maintenance-audit-denied-${suffix}`,
        passwordHash: "not-used-by-device-maintenance-audit-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_DIAGNOSTICS, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DOOR_UNLOCK, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_CLEAR_LOGS, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_DIAGNOSTICS, PermissionMode.DENY),
        permissionRow(deniedAdmin.id, AdminPermission.DOOR_UNLOCK, PermissionMode.DENY),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_CLEAR_LOGS, PermissionMode.DENY),
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
        name: `Maintenance command audit device ${suffix}`,
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
        enabled: false,
        status: DeviceStatus.UNKNOWN,
        model: "K40-MAINTENANCE-COMMAND-AUDIT",
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

function installDeviceCommandStubs(calls: StubCall[]) {
  const manager = require("./deviceManager") as DeviceManagerModule;
  const originals = {
    setDeviceTime: manager.setDeviceTime,
    unlockDeviceDoor: manager.unlockDeviceDoor,
    clearDeviceAttendanceLogs: manager.clearDeviceAttendanceLogs,
  };
  let clearLogsCalls = 0;

  Object.assign(manager, {
    setDeviceTime: async (deviceId: string, timestamp: Date) => {
      calls.push({ operation: "set-time", deviceId, value: timestamp.toISOString() });
      return { time: timestamp, mode: "temporary" as const };
    },
    unlockDeviceDoor: async (deviceId: string, seconds?: number) => {
      const duration = seconds ?? 3;
      calls.push({ operation: "unlock", deviceId, value: duration });
      return { ok: true, seconds: duration, mode: "temporary" as const };
    },
    clearDeviceAttendanceLogs: async (deviceId: string) => {
      clearLogsCalls += 1;
      calls.push({ operation: "clear-logs", deviceId });
      if (clearLogsCalls === 2) throw new HttpError(502, RAW_COMMAND_ERROR);
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

async function testGuards(baseUrl: string, fixture: Fixture, calls: StubCall[]) {
  assert.equal((await postJson(`${baseUrl}/${fixture.deviceId}/time`, {})).status, 401);
  const deniedCases = [
    { path: "time", body: {}, permission: AdminPermission.DEVICES_DIAGNOSTICS },
    { path: "unlock", body: { seconds: 5 }, permission: AdminPermission.DOOR_UNLOCK },
    { path: "logs/clear", body: {}, permission: AdminPermission.DEVICES_CLEAR_LOGS },
  ];
  for (const deniedCase of deniedCases) {
    const response = await postJson(
      `${baseUrl}/${fixture.deviceId}/${deniedCase.path}`,
      deniedCase.body,
      fixture.deniedToken
    );
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { requiredPermission: string }).requiredPermission, deniedCase.permission);
  }
  assert.equal(calls.length, 0);
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  assert.equal(
    await prisma.auditLog.count({ where: { action: { in: [...COMMAND_ACTIONS] }, targetId: fixture.deviceId } }),
    0
  );
  console.log("ok maintenance command endpoints enforce 401/403 without audit or command execution");
}

async function testSuccessfulCommands(baseUrl: string, fixture: Fixture, calls: StubCall[]) {
  const timeResponse = await postJson(
    `${baseUrl}/${fixture.deviceId}/time`,
    { timestamp: REQUESTED_TIME },
    fixture.allowedToken
  );
  assert.equal(timeResponse.status, 200);
  assert.deepEqual(await timeResponse.json(), { time: REQUESTED_TIME, mode: "temporary" });
  const timeAudit = await findAudit("device.time.updated", fixture.deviceId, true);
  assertAuditAttribution(timeAudit, fixture, true);
  assert.deepEqual(asJsonObject(timeAudit.metadata), {
    outcome: "COMPLETED",
    deviceTime: REQUESTED_TIME,
    mode: "temporary",
  });
  assertSafeAudit(timeAudit, fixture);

  const unlockResponse = await postJson(`${baseUrl}/${fixture.deviceId}/unlock`, { seconds: 7 }, fixture.allowedToken);
  assert.equal(unlockResponse.status, 200);
  assert.deepEqual(await unlockResponse.json(), { ok: true, seconds: 7, mode: "temporary" });
  const unlockAudit = await findAudit("device.door.unlocked", fixture.deviceId, true);
  assertAuditAttribution(unlockAudit, fixture, true);
  assert.deepEqual(asJsonObject(unlockAudit.metadata), {
    outcome: "COMPLETED",
    durationSeconds: 7,
    mode: "temporary",
  });
  assertSafeAudit(unlockAudit, fixture);

  const clearResponse = await postJson(`${baseUrl}/${fixture.deviceId}/logs/clear`, {}, fixture.allowedToken);
  assert.equal(clearResponse.status, 200);
  assert.deepEqual(await clearResponse.json(), { ok: true, mode: "temporary" });
  const clearAudit = await findAudit("device.logs.cleared", fixture.deviceId, true);
  assertAuditAttribution(clearAudit, fixture, true);
  assert.deepEqual(asJsonObject(clearAudit.metadata), { outcome: "CLEARED", mode: "temporary" });
  assertSafeAudit(clearAudit, fixture);

  assert.deepEqual(calls, [
    { operation: "set-time", deviceId: fixture.deviceId, value: REQUESTED_TIME },
    { operation: "unlock", deviceId: fixture.deviceId, value: 7 },
    { operation: "clear-logs", deviceId: fixture.deviceId },
  ]);
  console.log("ok successful time/unlock/log-clear commands record exact safe summaries");
}

async function testRejectedCommand(baseUrl: string, fixture: Fixture) {
  const response = await postJson(`${baseUrl}/${fixture.deviceId}/logs/clear`, {}, fixture.allowedToken);
  assert.equal(response.status, 502);
  const audit = await findAudit("device.logs.cleared", fixture.deviceId, false);
  assertAuditAttribution(audit, fixture, false);
  assert.deepEqual(asJsonObject(audit.metadata), {
    outcome: "ERROR",
    errorType: "HTTP_ERROR",
    httpStatus: 502,
  });
  assertSafeAudit(audit, fixture);
  console.log("ok rejected log-clear command records safe failure metadata and preserves HTTP status");
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
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function assertExactActionCounts(fixture: Fixture) {
  const rows = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { actorId: fixture.allowedAdminId, action: { in: [...COMMAND_ACTIONS] } },
    _count: { _all: true },
  });
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row.action, row._count._all])), {
    "device.door.unlocked": 1,
    "device.logs.cleared": 2,
    "device.time.updated": 1,
  });
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  console.log("ok exact maintenance command action counts reconcile and denied actor has zero rows");
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
  assert.equal(audit.userAgent, "device-maintenance-command-audit-api-integration-test");
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
    RAW_COMMAND_ERROR,
    "password",
    "attendanceLog",
    "rawLog",
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
    "user-agent": "device-maintenance-command-audit-api-integration-test",
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
  console.log("ok device maintenance command audit fixture cleanup verified (0 records left)");
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
  console.log("Device maintenance command audit API integration tests passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
