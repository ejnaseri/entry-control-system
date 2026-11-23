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
import { stopDevice } from "./deviceManager";
import { deviceRouter } from "./device.router";
import {
  createDevice,
  setDeviceEnabled,
  updateDevice,
  type DeviceActionContext,
} from "./device.service";
import type { DeviceCreateInput, DeviceUpdateInput } from "./device.schemas";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  deviceIds: string[];
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Device-admin audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_ADMIN_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Device-admin audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `device-admin-audit-allowed-${suffix}`;
  const deniedToken = `device-admin-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-admin-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-device-admin-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-device-admin-audit-denied-${suffix}`,
        passwordHash: "not-used-by-device-admin-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.SYSTEM_SETTINGS_MANAGE, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.DEVICES_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.SYSTEM_SETTINGS_MANAGE, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession };
  });
  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    deviceIds: [],
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return { adminUserId, permission, mode, reason: "Device-admin audit API integration fixture" };
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

function devicePayload(
  fixture: Fixture,
  label = "Primary",
  overrides: Partial<DeviceCreateInput> = {}
) {
  return {
    name: `${label} Audit Device ${fixture.suffix}`,
    type: DeviceType.FINGERPRINT,
    connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
    enabled: false,
    model: `${label}-K40`,
    serialNumber: `${label}-${fixture.suffix}`,
    config: {
      ip: "127.0.0.1",
      port: 4370,
      eventMode: "PUSH",
      pushEnabled: true,
      timeoutMs: 500,
      pollIntervalMs: 500,
      password: `private-device-password-${label}-${fixture.suffix}`,
    },
    ...overrides,
  } satisfies DeviceCreateInput;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/devices`;
    await testGuardsAndCreate(baseUrl, fixture);
    await testNameOnlyUpdatePreservesOperationalStatus(baseUrl, fixture);
    await testUpdateAndEmbeddedEnable(baseUrl, fixture);
    await testDedicatedDisableAndEnable(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testNameOnlyUpdatePreservesOperationalStatus(baseUrl: string, fixture: Fixture) {
  const deviceId = fixture.deviceIds[0];
  assert.ok(deviceId);
  await prisma.device.update({
    where: { id: deviceId },
    data: { status: DeviceStatus.OFFLINE },
  });

  const payload = devicePayload(fixture, "Primary", {
    name: `Name Only Audit Device ${fixture.suffix}`,
  }) as DeviceUpdateInput;
  const response = await fetch(`${baseUrl}/${deviceId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const updated = await response.json() as { name: string; status: DeviceStatus };
  assert.equal(updated.name, payload.name);
  assert.equal(updated.status, DeviceStatus.OFFLINE);

  const audit = await findDeviceAudit("device.updated", deviceId);
  assertAuditAttribution(audit, fixture);
  assert.equal(asJsonObject(audit.beforeData)["status"], DeviceStatus.OFFLINE);
  assert.equal(asJsonObject(audit.afterData)["status"], DeviceStatus.OFFLINE);
  assert.deepEqual(asJsonArray(asJsonObject(audit.metadata)["changedFields"]), ["name"]);
  console.log("ok name-only device update preserves status when JSON config key order differs");
}

async function testGuardsAndCreate(baseUrl: string, fixture: Fixture) {
  const payload = devicePayload(fixture);
  const unauthenticated = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(unauthenticated.status, 401);

  const denied = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.SYSTEM_SETTINGS_MANAGE
  );
  assert.equal(await prisma.device.count({ where: { name: payload.name } }), 0);
  assert.equal(await deniedAuditCount(fixture), 0);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const created = await response.json() as {
    id: string;
    name: string;
    connectionType: DeviceConnectionType;
    enabled: boolean;
    config: Record<string, unknown>;
  };
  fixture.deviceIds.push(created.id);
  assert.equal(created.name, payload.name);
  assert.equal(created.connectionType, DeviceConnectionType.ZKTECO_PULL_SDK);
  assert.equal(created.enabled, false);
  assert.equal(created.config["password"], (payload.config as Record<string, unknown>)["password"]);

  const audit = await findDeviceAudit("device.created", created.id);
  assertAuditAttribution(audit, fixture);
  const afterData = asJsonObject(audit.afterData);
  const config = asJsonObject(afterData["config"]);
  assert.equal(afterData["id"], created.id);
  assert.equal(afterData["name"], payload.name);
  assert.equal(afterData["enabled"], false);
  assert.equal(config["ip"], "127.0.0.1");
  assert.equal(config["port"], 4370);
  assert.equal(Object.prototype.hasOwnProperty.call(config, "password"), false);
  assertAuditContainsNoCredential(audit, payload);
  console.log("ok device creation is guarded, attributed, atomic, and excludes connection credentials");
}

async function testUpdateAndEmbeddedEnable(baseUrl: string, fixture: Fixture) {
  const deviceId = fixture.deviceIds[0];
  assert.ok(deviceId);
  const payload = devicePayload(fixture, "Updated", {
    enabled: true,
    config: {
      ip: "127.0.0.2",
      port: 4371,
      eventMode: "PUSH",
      pushEnabled: true,
      timeoutMs: 750,
      pollIntervalMs: 1000,
      password: `private-updated-password-${fixture.suffix}`,
    },
  }) as DeviceUpdateInput;

  const denied = await fetch(`${baseUrl}/${deviceId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  assert.equal((await prisma.device.findUniqueOrThrow({ where: { id: deviceId } })).enabled, false);

  const response = await fetch(`${baseUrl}/${deviceId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const updated = await response.json() as { name: string; enabled: boolean; config: Record<string, unknown> };
  assert.equal(updated.name, payload.name);
  assert.equal(updated.enabled, true);
  assert.equal(updated.config["password"], (payload.config as Record<string, unknown>)["password"]);

  const audit = await findDeviceAudit("device.updated", deviceId);
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["enabled"], false);
  assert.equal(afterData["enabled"], true);
  assert.equal(asJsonObject(beforeData["config"])["ip"], "127.0.0.1");
  assert.equal(asJsonObject(afterData["config"])["ip"], "127.0.0.2");
  const changedFields = asJsonArray(metadata["changedFields"]);
  for (const field of ["name", "enabled", "model", "serialNumber", "config"]) {
    assert.ok(changedFields.includes(field), `Expected changed field ${field}`);
  }
  assertAuditContainsNoCredential(audit, payload);

  const enabledAudits = await prisma.auditLog.findMany({
    where: { action: "device.enabled", targetType: "Device", targetId: deviceId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(enabledAudits.length, 1);
  assert.equal(asJsonObject(enabledAudits[0]!.metadata)["source"], "DEVICE_UPDATE");
  assertAuditAttribution(enabledAudits[0]!, fixture);
  assertAuditContainsNoCredential(enabledAudits[0]!, payload);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok device update records safe before/after config plus its embedded enable transition");
}

async function testDedicatedDisableAndEnable(baseUrl: string, fixture: Fixture) {
  const deviceId = fixture.deviceIds[0];
  assert.ok(deviceId);
  const denied = await fetch(`${baseUrl}/${deviceId}/disable`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
  });
  assert.equal(denied.status, 403);
  assert.equal((await prisma.device.findUniqueOrThrow({ where: { id: deviceId } })).enabled, true);

  const disabledResponse = await fetch(`${baseUrl}/${deviceId}/disable`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(disabledResponse.status, 200);
  const disabled = await disabledResponse.json() as { enabled: boolean; status: DeviceStatus };
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.status, DeviceStatus.OFFLINE);
  const disabledAudit = await findDeviceAudit("device.disabled", deviceId);
  assertAuditAttribution(disabledAudit, fixture);
  assert.equal(asJsonObject(disabledAudit.beforeData)["enabled"], true);
  assert.equal(asJsonObject(disabledAudit.afterData)["enabled"], false);
  assert.equal(asJsonObject(disabledAudit.metadata)["source"], "ENABLE_DISABLE_ENDPOINT");

  const enabledResponse = await fetch(`${baseUrl}/${deviceId}/enable`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(enabledResponse.status, 200);
  const enabled = await enabledResponse.json() as { enabled: boolean; status: DeviceStatus };
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.status, DeviceStatus.UNKNOWN);
  const enabledAudits = await prisma.auditLog.findMany({
    where: { action: "device.enabled", targetType: "Device", targetId: deviceId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(enabledAudits.length, 2);
  const endpointAudit = enabledAudits[1]!;
  assertAuditAttribution(endpointAudit, fixture);
  assert.equal(asJsonObject(endpointAudit.metadata)["source"], "ENABLE_DISABLE_ENDPOINT");
  assert.equal(asJsonObject(endpointAudit.beforeData)["enabled"], false);
  assert.equal(asJsonObject(endpointAudit.afterData)["enabled"], true);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok dedicated disable/enable endpoints persist exact safe transitions without hardware polling");
}

async function testAtomicRollback(fixture: Fixture) {
  const invalidContext: DeviceActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: `missing-device-admin-session-${fixture.suffix}`,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "device-admin-audit-rollback-test" },
  };
  const validContext: DeviceActionContext = {
    actor: { id: fixture.allowedAdminId, role: AdminRole.STAFF, sessionId: fixture.allowedSessionId },
    meta: { ipAddress: "127.0.0.1", userAgent: "device-admin-audit-rollback-test" },
  };

  const failedCreate = devicePayload(fixture, "Failed Create");
  await assert.rejects(() => createDevice(failedCreate, invalidContext));
  assert.equal(await prisma.device.count({ where: { name: failedCreate.name } }), 0);

  const rollbackDevice = await createDevice(devicePayload(fixture, "Rollback"), validContext);
  fixture.deviceIds.push(rollbackDevice.id);
  const beforeUpdate = await prisma.device.findUniqueOrThrow({ where: { id: rollbackDevice.id } });
  await assert.rejects(() =>
    updateDevice(
      rollbackDevice.id,
      devicePayload(fixture, "Failed Update", { enabled: true }) as DeviceUpdateInput,
      invalidContext
    )
  );
  const afterFailedUpdate = await prisma.device.findUniqueOrThrow({ where: { id: rollbackDevice.id } });
  assert.equal(afterFailedUpdate.name, beforeUpdate.name);
  assert.equal(afterFailedUpdate.enabled, beforeUpdate.enabled);
  assert.deepEqual(afterFailedUpdate.config, beforeUpdate.config);

  await assert.rejects(() => setDeviceEnabled(rollbackDevice.id, true, invalidContext));
  const afterFailedEnable = await prisma.device.findUniqueOrThrow({ where: { id: rollbackDevice.id } });
  assert.equal(afterFailedEnable.enabled, false);
  assert.equal(afterFailedEnable.status, DeviceStatus.UNKNOWN);
  console.log("ok failed device audits roll back create, update, config, and enabled-state mutations");
}

async function findDeviceAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "Device", targetId },
    orderBy: { createdAt: "desc" },
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
  fixture: Fixture
) {
  assert.equal(audit.actorType, AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.allowedAdminId);
  assert.equal(audit.actorRole, AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.allowedSessionId);
  assert.equal(audit.success, true);
  assert.ok(audit.ipAddress);
  assert.equal(audit.userAgent, "device-admin-audit-api-integration-test");
}

function assertAuditContainsNoCredential(
  audit: { beforeData?: Prisma.JsonValue | null; afterData?: Prisma.JsonValue | null; metadata?: Prisma.JsonValue | null },
  payload: DeviceCreateInput | DeviceUpdateInput
) {
  const serialized = JSON.stringify(audit);
  const password = (payload.config as Record<string, unknown>)["password"];
  assert.equal(serialized.includes("password"), false);
  assert.equal(typeof password === "string" && serialized.includes(password), false);
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "device-admin-audit-api-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | undefined | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

function asJsonArray(value: Prisma.JsonValue | undefined) {
  assert.ok(Array.isArray(value), "Expected audit JSON array");
  return value as Prisma.JsonArray;
}

async function deniedAuditCount(fixture: Fixture) {
  return prisma.auditLog.count({
    where: { actorId: fixture.deniedAdminId, action: { in: ["device.created", "device.updated", "device.enabled", "device.disabled"] } },
  });
}

async function cleanupFixture(fixture: Fixture) {
  for (const deviceId of fixture.deviceIds) {
    await stopDevice(deviceId);
  }
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.device.deleteMany({ where: { id: { in: fixture.deviceIds } } });
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
    prisma.device.count({ where: { id: { in: fixture.deviceIds } } }),
    prisma.adminUserPermission.count({ where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.adminSession.count({ where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } } }),
    prisma.adminUser.count({ where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  console.log("ok device-admin audit integration fixture cleanup verified (0 records left)");
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
  console.log("Device-admin audit API integration tests passed (auth, privacy, transitions, atomicity, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
