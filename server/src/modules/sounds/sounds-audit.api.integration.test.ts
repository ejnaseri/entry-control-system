import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  PermissionMode,
  type Prisma,
  type SoundSettings,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { errorHandler } from "../../middlewares/error-handler";
import { soundsRouter } from "./sounds.router";
import {
  createSoundAsset,
  deleteSoundAsset,
  updateSoundSettings,
  type SoundActionContext,
} from "./sounds.service";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  originalSettings: SoundSettings | null;
  firstAssetId: string;
  retainedAssetId: string;
  assetIds: string[];
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Sound audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["SOUND_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Sound audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `sound-audit-allowed-${suffix}`;
  const deniedToken = `sound-audit-denied-${suffix}`;
  const originalSettings = await prisma.soundSettings.findUnique({ where: { id: "global" } });
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-sound-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-sound-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-sound-audit-denied-${suffix}`,
        passwordHash: "not-used-by-sound-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.SIGN_IN, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.SOUND_SETTINGS_MANAGE, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.SIGN_IN, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.SOUND_SETTINGS_MANAGE, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    const firstAsset = await tx.soundAsset.create({
      data: {
        name: `it-sound-first-${suffix}.wav`,
        mimeType: "audio/wav",
        size: 1,
        durationMs: 250,
        data: new Uint8Array([1]),
      },
    });
    const retainedAsset = await tx.soundAsset.create({
      data: {
        name: `it-sound-retained-${suffix}.wav`,
        mimeType: "audio/wav",
        size: 1,
        durationMs: 250,
        data: new Uint8Array([2]),
      },
    });
    await tx.soundSettings.upsert({
      where: { id: "global" },
      create: {
        id: "global",
        enabled: true,
        accessAllowedSoundId: firstAsset.id,
        accessDeniedSoundId: retainedAsset.id,
        alertSoundId: retainedAsset.id,
        accessAllowedVolume: 0.31,
        accessDeniedVolume: 0.42,
        alertVolume: 0.53,
      },
      update: {
        enabled: true,
        accessAllowedSoundId: firstAsset.id,
        accessDeniedSoundId: retainedAsset.id,
        alertSoundId: retainedAsset.id,
        accessAllowedVolume: 0.31,
        accessDeniedVolume: 0.42,
        alertVolume: 0.53,
      },
    });
    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession, firstAsset, retainedAsset };
  });

  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    originalSettings,
    firstAssetId: records.firstAsset.id,
    retainedAssetId: records.retainedAsset.id,
    assetIds: [records.firstAsset.id, records.retainedAsset.id],
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return {
    adminUserId,
    permission,
    mode,
    reason: "Sound audit API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/sounds", soundsRouter);
  app.use(errorHandler);
  return app;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/sounds`;
    await testSettingsGuardsAndAudit(baseUrl, fixture);
    await testUploadGuardsPrivacyAndAudit(baseUrl, fixture);
    await testSelectiveDeleteAndAudit(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
  }
}

async function testSettingsGuardsAndAudit(baseUrl: string, fixture: Fixture) {
  const payload = { enabled: false, accessAllowedVolume: 0.65 };
  const unauthenticated = await fetch(`${baseUrl}/settings`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(unauthenticated.status, 401);

  const denied = await fetch(`${baseUrl}/settings`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  let settings = await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } });
  assert.equal(settings.enabled, true);
  assert.equal(settings.accessAllowedVolume, 0.31);
  assert.equal(await deniedAuditCount(fixture), 0);

  const response = await fetch(`${baseUrl}/settings`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  settings = await response.json() as SoundSettings;
  assert.equal(settings.enabled, false);
  assert.equal(settings.accessAllowedVolume, 0.65);
  assert.equal(settings.accessAllowedSoundId, fixture.firstAssetId);
  assert.equal(settings.accessDeniedSoundId, fixture.retainedAssetId);
  assert.equal(settings.alertSoundId, fixture.retainedAssetId);

  const audit = await findSoundAudit("sound.settings.updated", "SoundSettings", "global");
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["enabled"], true);
  assert.equal(beforeData["accessAllowedVolume"], 0.31);
  assert.equal(afterData["enabled"], false);
  assert.equal(afterData["accessAllowedVolume"], 0.65);
  assert.equal(afterData["accessDeniedSoundId"], fixture.retainedAssetId);
  assert.deepEqual(metadata["changedFields"], ["enabled", "accessAllowedVolume"]);
  console.log("ok sound settings are permission-guarded and audited with exact safe before/after state");
}

async function testUploadGuardsPrivacyAndAudit(baseUrl: string, fixture: Fixture) {
  const deniedName = `denied-${fixture.suffix}.wav`;
  const denied = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: cookieHeader(fixture.deniedToken),
    body: audioForm(deniedName),
  });
  assert.equal(denied.status, 403);
  assert.equal(await prisma.soundAsset.count({ where: { name: deniedName } }), 0);

  const originalName = `audit upload ${fixture.suffix}.wav`;
  const expectedName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64);
  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: cookieHeader(fixture.allowedToken),
    body: audioForm(originalName),
  });
  assert.equal(response.status, 200);
  const created = await response.json() as {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    durationMs: number;
    data?: unknown;
  };
  fixture.assetIds.push(created.id);
  assert.equal(created.name, expectedName);
  assert.equal(created.mimeType, "audio/wav");
  assert.ok(created.size > 44);
  assert.equal(created.durationMs, 250);
  assert.equal(Object.prototype.hasOwnProperty.call(created, "data"), false);

  const audit = await findSoundAudit("sound.asset.uploaded", "SoundAsset", created.id);
  assertAuditAttribution(audit, fixture);
  assert.equal(audit.beforeData, null);
  const afterData = asJsonObject(audit.afterData);
  assert.deepEqual(Object.keys(afterData).sort(), ["createdAt", "durationMs", "id", "mimeType", "name", "size"]);
  assert.equal(afterData["name"], expectedName);
  assert.equal(afterData["size"], created.size);
  assert.equal(Object.prototype.hasOwnProperty.call(afterData, "data"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(afterData, "buffer"), false);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok sound upload writes safe metadata only and never returns or audits audio bytes");
}

async function testSelectiveDeleteAndAudit(baseUrl: string, fixture: Fixture) {
  await prisma.soundSettings.update({
    where: { id: "global" },
    data: {
      accessAllowedSoundId: fixture.firstAssetId,
      accessDeniedSoundId: fixture.retainedAssetId,
      alertSoundId: fixture.retainedAssetId,
    },
  });
  const denied = await fetch(`${baseUrl}/${fixture.firstAssetId}`, {
    method: "DELETE",
    headers: cookieHeader(fixture.deniedToken),
  });
  assert.equal(denied.status, 403);
  assert.ok(await prisma.soundAsset.findUnique({ where: { id: fixture.firstAssetId } }));

  const response = await fetch(`${baseUrl}/${fixture.firstAssetId}`, {
    method: "DELETE",
    headers: cookieHeader(fixture.allowedToken),
  });
  assert.equal(response.status, 200);
  const deleted = await response.json() as { id: string; data?: unknown };
  assert.equal(deleted.id, fixture.firstAssetId);
  assert.equal(Object.prototype.hasOwnProperty.call(deleted, "data"), false);
  assert.equal(await prisma.soundAsset.findUnique({ where: { id: fixture.firstAssetId } }), null);

  const settings = await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } });
  assert.equal(settings.accessAllowedSoundId, null);
  assert.equal(settings.accessDeniedSoundId, fixture.retainedAssetId);
  assert.equal(settings.alertSoundId, fixture.retainedAssetId);

  const audit = await findSoundAudit("sound.asset.deleted", "SoundAsset", fixture.firstAssetId);
  assertAuditAttribution(audit, fixture);
  assert.equal(asJsonObject(audit.beforeData)["id"], fixture.firstAssetId);
  assert.deepEqual(asJsonObject(audit.afterData), { id: fixture.firstAssetId, deleted: true });
  assert.deepEqual(asJsonObject(audit.metadata)["clearedSettingFields"], ["accessAllowedSoundId"]);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok deleting one sound clears only matching settings and preserves other sound selections");
}

async function testAtomicRollback(fixture: Fixture) {
  const invalidContext: SoundActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: `missing-sound-session-${fixture.suffix}`,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "sound-audit-rollback-test" },
  };

  const beforeSettings = await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } });
  await assert.rejects(() => updateSoundSettings({ alertVolume: 0.99 }, invalidContext));
  assert.equal(
    (await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } })).alertVolume,
    beforeSettings.alertVolume
  );

  const rollbackName = `rollback-${fixture.suffix}.wav`;
  const rollbackFile = multerAudioFile(rollbackName);
  await assert.rejects(() => createSoundAsset(rollbackFile, invalidContext));
  assert.equal(await prisma.soundAsset.count({ where: { name: rollbackName } }), 0);

  const beforeDeleteSettings = await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } });
  await assert.rejects(() => deleteSoundAsset(fixture.retainedAssetId, invalidContext));
  assert.ok(await prisma.soundAsset.findUnique({ where: { id: fixture.retainedAssetId } }));
  const afterDeleteSettings = await prisma.soundSettings.findUniqueOrThrow({ where: { id: "global" } });
  assert.equal(afterDeleteSettings.accessDeniedSoundId, beforeDeleteSettings.accessDeniedSoundId);
  assert.equal(afterDeleteSettings.alertSoundId, beforeDeleteSettings.alertSoundId);
  console.log("ok failed sound audits atomically roll back settings, upload, and selective delete mutations");
}

function createWavBuffer() {
  const sampleRate = 8_000;
  const durationMs = 250;
  const sampleCount = sampleRate * durationMs / 1_000;
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function audioForm(name: string) {
  const form = new FormData();
  form.append("file", new Blob([createWavBuffer()], { type: "audio/wav" }), name);
  return form;
}

function multerAudioFile(name: string): Express.Multer.File {
  const buffer = createWavBuffer();
  return {
    fieldname: "file",
    originalname: name,
    encoding: "7bit",
    mimetype: "audio/wav",
    size: buffer.length,
    buffer,
    stream: Readable.from(buffer),
    destination: "",
    filename: name,
    path: "",
  };
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "sound-audit-api-integration-test",
  };
}

function cookieHeader(token: string) {
  return {
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "sound-audit-api-integration-test",
  };
}

async function findSoundAudit(action: string, targetType: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType, targetId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, `Expected ${action} audit for ${targetType} ${targetId}`);
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
  assert.equal(audit.userAgent, "sound-audit-api-integration-test");
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

async function deniedAuditCount(fixture: Fixture) {
  return prisma.auditLog.count({
    where: { actorId: fixture.deniedAdminId, action: { startsWith: "sound." } },
  });
}

async function restoreOriginalSettings(fixture: Fixture) {
  if (!fixture.originalSettings) {
    await prisma.soundSettings.deleteMany({ where: { id: "global" } });
    return;
  }
  const original = fixture.originalSettings;
  await prisma.soundSettings.upsert({
    where: { id: "global" },
    create: {
      id: original.id,
      enabled: original.enabled,
      accessAllowedSoundId: original.accessAllowedSoundId,
      accessDeniedSoundId: original.accessDeniedSoundId,
      alertSoundId: original.alertSoundId,
      accessAllowedVolume: original.accessAllowedVolume,
      accessDeniedVolume: original.accessDeniedVolume,
      alertVolume: original.alertVolume,
      createdAt: original.createdAt,
      updatedAt: original.updatedAt,
    },
    update: {
      enabled: original.enabled,
      accessAllowedSoundId: original.accessAllowedSoundId,
      accessDeniedSoundId: original.accessDeniedSoundId,
      alertSoundId: original.alertSoundId,
      accessAllowedVolume: original.accessAllowedVolume,
      accessDeniedVolume: original.accessDeniedVolume,
      alertVolume: original.alertVolume,
      updatedAt: original.updatedAt,
    },
  });
}

async function cleanupFixture(fixture: Fixture) {
  await restoreOriginalSettings(fixture);
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.soundAsset.deleteMany({ where: { id: { in: fixture.assetIds } } });
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
    prisma.soundAsset.count({ where: { id: { in: fixture.assetIds } } }),
    prisma.adminUserPermission.count({ where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.adminSession.count({ where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } } }),
    prisma.adminUser.count({ where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  console.log("ok sound audit integration fixture cleanup verified (0 records left; original settings restored)");
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
  console.log("Sound audit API integration tests passed (auth, privacy, selective delete, atomicity, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
