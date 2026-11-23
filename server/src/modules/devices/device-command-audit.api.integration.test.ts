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
import { errorHandler } from "../../middlewares/error-handler";
import { deviceRouter } from "./device.router";

const COMMAND_ACTIONS = [
  "device.diagnosed",
  "device.scan.started",
  "device.scan.cancelled",
  "device.tested",
  "device.connection_tested",
] as const;

type Fixture = {
  suffix: string;
  password: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  networkDeviceId: string;
  unsupportedDeviceId: string;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Device-command audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_COMMAND_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Device-command audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const password = `private-device-command-password-${suffix}`;
  const allowedToken = `device-command-audit-allowed-${suffix}`;
  const deniedToken = `device-command-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-command-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-device-command-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-command-audit-denied-${suffix}`,
        passwordHash: "not-used-by-device-command-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_DIAGNOSTICS, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_DIAGNOSTICS, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    const networkDevice = await tx.device.create({
      data: {
        name: `Loopback command audit device ${suffix}`,
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
        enabled: false,
        status: DeviceStatus.UNKNOWN,
        model: "K40-COMMAND-AUDIT",
        config: {
          ip: "127.0.0.1",
          port: 65534,
          subnet: "255.255.255.255",
          timeoutMs: 100,
          pollIntervalMs: 500,
          eventMode: "PUSH",
          pushEnabled: true,
          password,
        },
      },
    });
    const unsupportedDevice = await tx.device.create({
      data: {
        name: `Unsupported command audit device ${suffix}`,
        type: DeviceType.OTHER,
        connectionType: DeviceConnectionType.USB,
        enabled: false,
        status: DeviceStatus.UNKNOWN,
        model: "USB-COMMAND-AUDIT",
        config: { vendorId: "1234", productId: "5678", password },
      },
    });
    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession, networkDevice, unsupportedDevice };
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
    networkDeviceId: records.networkDevice.id,
    unsupportedDeviceId: records.unsupportedDevice.id,
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return { adminUserId, permission, mode, reason: "Device-command audit API integration fixture" };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/devices", deviceRouter);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/devices`;
    await testGuards(baseUrl, fixture);
    await testDiagnostics(baseUrl, fixture);
    await testRejectedDiagnostics(baseUrl, fixture);
    await testConnectionEndpoints(baseUrl, fixture);
    await testScanStartAndCancel(baseUrl, fixture);
    await assertExactActionCounts(fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testGuards(baseUrl: string, fixture: Fixture) {
  const unauthenticated = await fetch(`${baseUrl}/${fixture.networkDeviceId}/diagnose`, { method: "POST" });
  assert.equal(unauthenticated.status, 401);
  const denied = await fetch(`${baseUrl}/${fixture.networkDeviceId}/diagnose`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.DEVICES_DIAGNOSTICS
  );
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  assert.equal(await prisma.auditLog.count({ where: { action: { in: [...COMMAND_ACTIONS] }, targetId: fixture.networkDeviceId } }), 0);
  console.log("ok device command endpoints enforce 401/403 without audit or command execution");
}

async function testDiagnostics(baseUrl: string, fixture: Fixture) {
  const response = await fetch(`${baseUrl}/${fixture.networkDeviceId}/diagnose`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(response.status, 200);
  const result = await response.json() as {
    deviceId: string;
    target: { host: string; port: number };
    ping: { status: string };
    tcpPort: { status: string };
  };
  assert.equal(result.deviceId, fixture.networkDeviceId);
  assert.equal(result.target.host, "127.0.0.1");
  assert.equal(result.target.port, 65534);

  const audit = await findAudit("device.diagnosed", fixture.networkDeviceId);
  assertAuditAttribution(audit, fixture, true);
  assert.equal(audit.beforeData, null);
  assert.equal(audit.afterData, null);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(metadata["outcome"], "COMPLETED");
  assert.equal(metadata["targetHost"], "127.0.0.1");
  assert.equal(metadata["targetPort"], 65534);
  assert.equal(metadata["pingStatus"], result.ping.status);
  assert.equal(metadata["tcpPortStatus"], result.tcpPort.status);
  assert.equal(typeof metadata["networkIssueCount"], "number");
  assertSafeAudit(audit, fixture);
  console.log("ok diagnostics records a safe completed summary without local interfaces or credentials");
}

async function testRejectedDiagnostics(baseUrl: string, fixture: Fixture) {
  const response = await fetch(`${baseUrl}/${fixture.unsupportedDeviceId}/diagnose`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(response.status, 400);
  const audit = await findAudit("device.diagnosed", fixture.unsupportedDeviceId);
  assertAuditAttribution(audit, fixture, false);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(metadata["outcome"], "ERROR");
  assert.equal(metadata["errorType"], "HTTP_ERROR");
  assert.equal(metadata["httpStatus"], 400);
  assert.equal(Object.prototype.hasOwnProperty.call(metadata, "errorMessage"), false);
  assertSafeAudit(audit, fixture);
  console.log("ok rejected diagnostics records a safe failed attempt and preserves the HTTP error");
}

async function testConnectionEndpoints(baseUrl: string, fixture: Fixture) {
  for (const [path, action] of [
    ["test", "device.tested"],
    ["test-connection", "device.connection_tested"],
  ] as const) {
    const response = await fetch(`${baseUrl}/${fixture.networkDeviceId}/${path}`, {
      method: "POST",
      headers: authenticatedHeaders(fixture.allowedToken),
    });
    assert.equal(response.status, 200);
    const result = await response.json() as { ok: boolean; status: DeviceStatus; message?: string };
    assert.equal(result.ok, false);
    assert.equal(result.status, DeviceStatus.ERROR);
    const audit = await findAudit(action, fixture.networkDeviceId);
    assertAuditAttribution(audit, fixture, false);
    const metadata = asJsonObject(audit.metadata);
    assert.equal(metadata["outcome"], "FAILED");
    assert.equal(metadata["deviceStatus"], DeviceStatus.ERROR);
    assert.equal(Object.prototype.hasOwnProperty.call(metadata, "message"), false);
    assertSafeAudit(audit, fixture);
  }
  console.log("ok both connection-test routes audit logical failures without storing raw connection errors");
}

async function testScanStartAndCancel(baseUrl: string, fixture: Fixture) {
  const startResponse = await fetch(`${baseUrl}/${fixture.networkDeviceId}/scan`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(startResponse.status, 200);
  const started = await startResponse.json() as {
    scanId: string;
    deviceId: string;
    status: string;
    total: number;
  };
  assert.ok(started.scanId);
  assert.equal(started.deviceId, fixture.networkDeviceId);
  assert.equal(started.status, "running");
  assert.equal(started.total, 1);
  const startAudit = await findAudit("device.scan.started", fixture.networkDeviceId);
  assertAuditAttribution(startAudit, fixture, true);
  const startMetadata = asJsonObject(startAudit.metadata);
  assert.equal(startMetadata["outcome"], "RUNNING");
  assert.equal(startMetadata["scanId"], started.scanId);
  assert.equal(startMetadata["totalTargets"], 1);
  assert.equal(Object.prototype.hasOwnProperty.call(startMetadata, "candidates"), false);
  assertSafeAudit(startAudit, fixture);

  const cancelResponse = await fetch(`${baseUrl}/scan/${started.scanId}/cancel`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(cancelResponse.status, 200);
  const cancelled = await cancelResponse.json() as { scanId: string; deviceId: string; status: string };
  assert.equal(cancelled.scanId, started.scanId);
  assert.equal(cancelled.deviceId, fixture.networkDeviceId);
  assert.equal(cancelled.status, "cancelled");
  const cancelAudit = await findAudit("device.scan.cancelled", fixture.networkDeviceId);
  assertAuditAttribution(cancelAudit, fixture, true);
  const cancelMetadata = asJsonObject(cancelAudit.metadata);
  assert.equal(cancelMetadata["outcome"], "CANCELLED");
  assert.equal(cancelMetadata["scanId"], started.scanId);
  assertSafeAudit(cancelAudit, fixture);
  console.log("ok loopback-only scan start/cancel records safe IDs and counts without candidates or credentials");
}

async function assertExactActionCounts(fixture: Fixture) {
  const rows = await prisma.auditLog.groupBy({
    by: ["action"],
    where: { actorId: fixture.allowedAdminId, action: { in: [...COMMAND_ACTIONS] } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(rows.map((row) => [row.action, row._count._all]));
  assert.deepEqual(counts, {
    "device.connection_tested": 1,
    "device.diagnosed": 2,
    "device.scan.cancelled": 1,
    "device.scan.started": 1,
    "device.tested": 1,
  });
  assert.equal(await commandAuditCount(fixture.deniedAdminId), 0);
  console.log("ok exact command action counts reconcile and denied actor has zero rows");
}

async function findAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "Device", targetId },
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
  assert.equal(audit.userAgent, "device-command-audit-api-integration-test");
}

function assertSafeAudit(
  audit: { beforeData?: Prisma.JsonValue | null; afterData?: Prisma.JsonValue | null; metadata?: Prisma.JsonValue | null },
  fixture: Fixture
) {
  const serialized = JSON.stringify(audit);
  for (const forbidden of [fixture.password, "password", "localInterfaces", "recommendations", "candidates"]) {
    assert.equal(serialized.includes(forbidden), false, `Audit unexpectedly contained ${forbidden}`);
  }
}

function asJsonObject(value: Prisma.JsonValue | undefined | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

function authenticatedHeaders(token: string) {
  return {
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "device-command-audit-api-integration-test",
  };
}

async function commandAuditCount(actorId: string) {
  return prisma.auditLog.count({ where: { actorId, action: { in: [...COMMAND_ACTIONS] } } });
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.device.deleteMany({
    where: { id: { in: [fixture.networkDeviceId, fixture.unsupportedDeviceId] } },
  });
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
    prisma.device.count({ where: { id: { in: [fixture.networkDeviceId, fixture.unsupportedDeviceId] } } }),
    prisma.adminUserPermission.count({ where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.adminSession.count({ where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } } }),
    prisma.adminUser.count({ where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  console.log("ok device-command audit integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runApiTests(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Device-command audit API integration tests passed (auth, outcomes, privacy, scan lifecycle, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
