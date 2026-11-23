import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { canonicalPublicServerIdentity } from "../../config/build-identity";

type AppEdition = "FULL" | "ATTENDANCE";

const WORKER_ARG = "--auth-contract-worker";
const TEST_DATABASE_URL = "postgresql://auth_contract:auth_contract@127.0.0.1:1/auth_contract";
const TEST_PASSWORD = "Contract-Test-Password-42!";
const EXPECTED_FULL_FEATURES = [
  "ADMIN_USERS",
  "ATTENDANCE_COMPLIANCE",
  "ATTENDANCE_DAILY",
  "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_REPORTS",
  "AUDIT_LOGS",
  "AUTH",
  "BACKUPS",
  "CUSTOMERS",
  "CUSTOMER_PAYMENTS",
  "DEVICES",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
  "EMPLOYEES",
  "ENTRY_LOGS",
  "EXPENSES",
  "FINANCIAL_REPORTS",
  "GENERIC_DEVICE_PUSH",
  "ICLOCK_ADMS",
  "INBOX",
  "MEMBERSHIPS",
  "PAYROLL",
  "SOUNDS",
  "STAFF_GROUPS",
] as const;

const EXPECTED_ATTENDANCE_FEATURES = ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"] as const;

const AUTH_PAYLOAD_KEYS = [
  "edition",
  "expiresAt",
  "features",
  "permissions",
  "session",
  "user",
] as const;
const SESSION_KEYS = ["createdAt", "expiresAt", "id", "lastSeenAt"] as const;
const USER_KEYS = [
  "createdAt",
  "deactivatedAt",
  "email",
  "fullName",
  "id",
  "isActive",
  "isProtected",
  "lastLoginAt",
  "passwordChangedAt",
  "role",
  "updatedAt",
  "username",
  "vendorMaintenanceActivatedAt",
  "vendorMaintenanceActivatedById",
  "vendorMaintenanceExpiresAt",
  "vendorMaintenanceReason",
] as const;
const FORBIDDEN_RESPONSE_KEYS = new Set([
  "adminUserId",
  "ipAddress",
  "password",
  "passwordHash",
  "revokedAt",
  "sessionToken",
  "token",
  "tokenHash",
  "userAgent",
]);

function compareIdentifiers(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort(compareIdentifiers);
}

function buildWorkerEnv(edition: AppEdition): NodeJS.ProcessEnv {
  const workerEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(workerEnv)) {
    if (["APP_EDITION", "DATABASE_URL", "NODE_ENV", "CLIENT_ORIGIN"].includes(key.toUpperCase())) {
      delete workerEnv[key];
    }
  }

  workerEnv["APP_EDITION"] = edition;
  workerEnv["DATABASE_URL"] = TEST_DATABASE_URL;
  workerEnv["NODE_ENV"] = "test";
  workerEnv["DOTENV_CONFIG_PATH"] = path.join(__dirname, `.auth-contract-missing-${process.pid}.env`);
  workerEnv["DOTENV_CONFIG_QUIET"] = "true";
  return workerEnv;
}

function runWorker(edition: AppEdition): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [__filename, WORKER_ARG], {
    cwd: __dirname,
    encoding: "utf8",
    env: buildWorkerEnv(edition),
    shell: false,
    timeout: 60_000,
    windowsHide: true,
  });
}

function describeWorker(result: SpawnSyncReturns<string>): string {
  return JSON.stringify({
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
}

function assertIsoDate(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    assert.fail(`${label} should be an ISO string`);
  }
  const date = new Date(value);
  assert.equal(Number.isNaN(date.getTime()), false, `${label} should be a valid date`);
  assert.equal(date.toISOString(), value, `${label} should use canonical ISO format`);
}

function collectKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, output);
    }
    return output;
  }
  if (!value || typeof value !== "object") {
    return output;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    output.add(key);
    collectKeys(nestedValue, output);
  }
  return output;
}

function assertNoSensitiveFields(payload: unknown, label: string): void {
  const keys = collectKeys(payload);
  for (const forbiddenKey of FORBIDDEN_RESPONSE_KEYS) {
    assert.equal(keys.has(forbiddenKey), false, `${label} leaked ${forbiddenKey}`);
  }
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes(TEST_PASSWORD), false, `${label} leaked the submitted password`);
}

function assertAuthPayload(
  payload: any,
  edition: AppEdition,
  expectedFeatures: readonly string[],
  expectedPermissions: readonly string[],
  label: string
): void {
  assert.deepEqual(Object.keys(payload).sort(compareIdentifiers), AUTH_PAYLOAD_KEYS);
  assert.equal(payload.edition, edition);
  assert.deepEqual(payload.features, expectedFeatures);
  assert.deepEqual(payload.permissions, expectedPermissions);
  assert.deepEqual(payload.features, sorted(payload.features));
  assert.deepEqual(payload.permissions, sorted(payload.permissions));
  assert.equal(new Set(payload.features).size, payload.features.length, `${label} features should be unique`);
  assert.equal(new Set(payload.permissions).size, payload.permissions.length, `${label} permissions should be unique`);

  assert.deepEqual(Object.keys(payload.user).sort(compareIdentifiers), USER_KEYS);
  assert.equal(payload.user.username, `contract-owner-${edition.toLowerCase()}`);
  assert.equal(payload.user.role, "GYM_OWNER");

  assert.deepEqual(Object.keys(payload.session).sort(compareIdentifiers), SESSION_KEYS);
  assert.equal(typeof payload.session.id, "string");
  assert.notEqual(payload.session.id.length, 0);
  assertIsoDate(payload.session.createdAt, `${label} session.createdAt`);
  assertIsoDate(payload.session.lastSeenAt, `${label} session.lastSeenAt`);
  assertIsoDate(payload.session.expiresAt, `${label} session.expiresAt`);
  assert.equal(payload.expiresAt, payload.session.expiresAt);
  assertNoSensitiveFields(payload, label);
}

function cookieFrom(response: Response, label: string): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, `${label} should set the session cookie`);
  assert.match(setCookie, /HttpOnly/iu);
  assert.match(setCookie, /SameSite=Lax/iu);
  assert.match(setCookie, /Path=\//u);
  assert.match(setCookie, /Expires=/u);
  const cookie = setCookie.split(";", 1)[0];
  if (!cookie?.includes("=")) {
    assert.fail(`${label} cookie should contain a value`);
  }
  return cookie;
}

async function readJson(response: Response): Promise<any> {
  return response.json() as Promise<any>;
}

function installPrismaMocks(prisma: any, runtime: any) {
  const original = {
    transaction: prisma.$transaction,
    adminUserFindFirst: prisma.adminUser.findFirst,
    adminUserUpdate: prisma.adminUser.update,
    adminSessionCreate: prisma.adminSession.create,
    adminSessionFindUnique: prisma.adminSession.findUnique,
    adminSessionUpdate: prisma.adminSession.update,
    rolePermissionFindMany: prisma.adminRolePermission.findMany,
    userPermissionFindMany: prisma.adminUserPermission.findMany,
    auditLogCreate: prisma.auditLog.create,
  };

  let privateUser: any = null;
  let sessionSequence = 0;
  const sessionsByHash = new Map<string, any>();
  const sessionsById = new Map<string, any>();

  function applySelect(record: any, select: Record<string, unknown> | undefined) {
    if (!select) {
      return { ...record };
    }

    return Object.fromEntries(
      Object.entries(select)
        .filter(([, included]) => included === true)
        .map(([key]) => [key, record[key]])
    );
  }

  function createUser(data: any) {
    const timestamp = new Date("2026-08-04T10:00:00.000Z");
    privateUser = {
      id: "auth-contract-owner",
      username: data.username,
      email: data.email ?? null,
      fullName: data.fullName ?? null,
      passwordHash: data.passwordHash,
      role: data.role,
      isActive: true,
      isProtected: false,
      lastLoginAt: null,
      passwordChangedAt: data.passwordChangedAt ?? timestamp,
      deactivatedAt: null,
      vendorMaintenanceActivatedAt: null,
      vendorMaintenanceExpiresAt: null,
      vendorMaintenanceReason: null,
      vendorMaintenanceActivatedById: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    return privateUser;
  }

  function createSession(data: any) {
    sessionSequence += 1;
    const timestamp = new Date(Date.parse("2026-08-04T11:00:00.000Z") + sessionSequence * 1_000);
    const session = {
      id: `auth-contract-session-${sessionSequence}`,
      adminUserId: data.adminUserId,
      tokenHash: data.tokenHash,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      createdAt: timestamp,
      lastSeenAt: timestamp,
      expiresAt: data.expiresAt,
      revokedAt: null,
    };
    sessionsByHash.set(session.tokenHash, session);
    sessionsById.set(session.id, session);
    return { ...session };
  }

  const tx = {
    adminUser: {
      count: async () => 0,
      create: async ({ data, select }: any) => applySelect(createUser(data), select),
    },
    adminRolePermission: {
      upsert: async ({ create }: any) => ({
        id: `role-${create.role}-${create.permission}`,
        ...create,
        createdAt: new Date("2026-08-04T10:00:00.000Z"),
      }),
    },
    adminSession: {
      create: async ({ data }: any) => createSession(data),
    },
    auditLog: {
      create: async ({ data }: any) => ({ id: "setup-audit", ...data }),
    },
  };

  prisma.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  prisma.adminUser.findFirst = async ({ select }: any) =>
    privateUser ? applySelect(privateUser, select) : null;
  prisma.adminUser.update = async ({ data, select }: any) => {
    assert.ok(privateUser, "login should follow setup");
    privateUser = {
      ...privateUser,
      ...data,
      updatedAt: new Date("2026-08-04T12:00:00.000Z"),
    };
    return applySelect(privateUser, select);
  };
  prisma.adminSession.create = async ({ data }: any) => createSession(data);
  prisma.adminSession.findUnique = async ({ where, include }: any) => {
    const session = sessionsByHash.get(where.tokenHash);
    if (!session || !privateUser) {
      return null;
    }
    return {
      ...session,
      adminUser: applySelect(privateUser, include?.adminUser?.select),
    };
  };
  prisma.adminSession.update = async ({ where, data }: any) => {
    const session = sessionsById.get(where.id);
    assert.ok(session, `unknown session ${where.id}`);
    Object.assign(session, data);
    return { ...session };
  };
  prisma.adminRolePermission.findMany = async () =>
    Object.values(runtime.AdminPermission).map((permission) => ({ permission }));
  prisma.adminUserPermission.findMany = async () => [
    { permission: runtime.AdminPermission.FINANCIAL_EXPORT, mode: runtime.PermissionMode.ALLOW },
    { permission: runtime.AdminPermission.LICENSE_ACTIVATE, mode: runtime.PermissionMode.ALLOW },
    { permission: runtime.AdminPermission.ATTENDANCE_MANUAL, mode: runtime.PermissionMode.DENY },
  ];
  prisma.auditLog.create = async ({ data }: any) => ({ id: "login-audit", ...data });

  return () => {
    prisma.$transaction = original.transaction;
    prisma.adminUser.findFirst = original.adminUserFindFirst;
    prisma.adminUser.update = original.adminUserUpdate;
    prisma.adminSession.create = original.adminSessionCreate;
    prisma.adminSession.findUnique = original.adminSessionFindUnique;
    prisma.adminSession.update = original.adminSessionUpdate;
    prisma.adminRolePermission.findMany = original.rolePermissionFindMany;
    prisma.adminUserPermission.findMany = original.userPermissionFindMany;
    prisma.auditLog.create = original.auditLogCreate;
  };
}

async function closeServer(server: Server | undefined): Promise<void> {
  if (!server?.listening) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function runContractWorker(): Promise<void> {
  const runtime = require("@prisma/client") as typeof import("@prisma/client");
  const { env } = require("../../config/env") as typeof import("../../config/env");
  const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
  const restorePrisma = installPrismaMocks(prisma as any, runtime);
  let server: Server | undefined;

  try {
    const { createApp } = require("../../app") as typeof import("../../app");
    server = createServer(createApp());
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const edition = env.APP_EDITION;
    const expectedFeatures = edition === "FULL" ? EXPECTED_FULL_FEATURES : EXPECTED_ATTENDANCE_FEATURES;
    const allPermissions = Object.values(runtime.AdminPermission);
    const expectedPermissions = edition === "FULL"
      ? sorted(allPermissions.filter((permission) => permission !== runtime.AdminPermission.ATTENDANCE_MANUAL))
      : sorted([
          runtime.AdminPermission.ATTENDANCE_JUSTIFY,
          runtime.AdminPermission.ATTENDANCE_VIEW,
          runtime.AdminPermission.ATTENDANCE_EXPORT,
          runtime.AdminPermission.ADMIN_USERS_MANAGE,
          runtime.AdminPermission.AUDIT_LOG_VIEW,
          runtime.AdminPermission.BACKUP_CREATE,
          runtime.AdminPermission.BACKUP_SETTINGS_MANAGE,
          runtime.AdminPermission.DEVICES_ENROLL,
          runtime.AdminPermission.DEVICES_USER_SYNC,
          runtime.AdminPermission.DEVICES_VIEW,
          runtime.AdminPermission.MEMBERS_VIEW,
          runtime.AdminPermission.MEMBERS_WRITE,
          runtime.AdminPermission.SIGN_IN,
          runtime.AdminPermission.SYSTEM_SETTINGS_MANAGE,
          runtime.AdminPermission.ROLES_MANAGE,
        ]);

    const identityResponse = await fetch(`${baseUrl}/api`);
    assert.equal(identityResponse.status, 200);
    const identity = await readJson(identityResponse);
    assert.deepEqual(identity, canonicalPublicServerIdentity(edition));
    assert.deepEqual(Object.keys(identity).sort(compareIdentifiers), [
      "apiVersion",
      "buildManifestVersion",
      "edition",
      "licenseProtocolVersion",
      "name",
      "productId",
      "schemaVersion",
      "version",
      "versionIdentitySha256",
    ]);
    assertNoSensitiveFields(identity, "/api identity");

    const unauthorizedMe = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert.equal(unauthorizedMe.status, 401);
    assert.deepEqual(await readJson(unauthorizedMe), { message: "Authentication required" });

    const credentials = {
      username: `contract-owner-${edition.toLowerCase()}`,
      password: TEST_PASSWORD,
      fullName: "Contract Owner",
      email: `contract-${edition.toLowerCase()}@example.test`,
    };
    const setupResponse = await fetch(`${baseUrl}/api/v1/auth/setup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    assert.equal(setupResponse.status, 201);
    const setupCookie = cookieFrom(setupResponse, "setup");
    const setupPayload = await readJson(setupResponse);
    assertAuthPayload(setupPayload, edition, expectedFeatures, expectedPermissions, "setup");

    const setupMeResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: setupCookie },
    });
    assert.equal(setupMeResponse.status, 200);
    assertAuthPayload(
      await readJson(setupMeResponse),
      edition,
      expectedFeatures,
      expectedPermissions,
      "me after setup"
    );

    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    });
    assert.equal(loginResponse.status, 200);
    const loginCookie = cookieFrom(loginResponse, "login");
    const loginPayload = await readJson(loginResponse);
    assertAuthPayload(loginPayload, edition, expectedFeatures, expectedPermissions, "login");

    const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: loginCookie },
    });
    assert.equal(meResponse.status, 200);
    const mePayload = await readJson(meResponse);
    assertAuthPayload(mePayload, edition, expectedFeatures, expectedPermissions, "me after login");
    assert.deepEqual(mePayload.features, loginPayload.features);
    assert.deepEqual(mePayload.permissions, loginPayload.permissions);
    assert.equal(mePayload.user.id, loginPayload.user.id);

    process.stdout.write(`AUTH_CONTRACT_OK:${edition}`);
  } finally {
    await closeServer(server);
    restorePrisma();
    await prisma.$disconnect();
  }
}

function runParentSuite(): void {
  for (const edition of ["FULL", "ATTENDANCE"] as const) {
    const result = runWorker(edition);
    assert.equal(result.error, undefined, describeWorker(result));
    assert.equal(result.signal, null, describeWorker(result));
    assert.equal(result.status, 0, describeWorker(result));
    assert.equal(result.stdout, `AUTH_CONTRACT_OK:${edition}`);
  }
  console.log("ok - public API identity and setup/login/me contract in FULL and ATTENDANCE");
}

async function main(): Promise<void> {
  if (process.argv[2] === WORKER_ARG) {
    await runContractWorker();
    return;
  }
  if (process.argv[2] !== undefined) {
    throw new Error(`Unknown argument: ${process.argv[2]}`);
  }
  runParentSuite();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
