import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { BackupRouterService } from "./backup.router";

process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] =
  "postgresql://backup_router_test:backup_router_test@127.0.0.1:1/atlasgym_backup_router_test";

const { AdminPermission, AdminRole } = require("@prisma/client") as typeof import("@prisma/client");
const { errorHandler, HttpError } = require("../../middlewares/error-handler") as typeof import("../../middlewares/error-handler");
const { createBackupRouter } = require("./backup.router") as typeof import("./backup.router");

type TestProfile = "create" | "irrelevant" | "restore" | "settings";
type ServiceMethodName = keyof BackupRouterService;
type ServiceCall = {
  name: ServiceMethodName;
  args: unknown[];
};
type ServiceBehavior = (...args: unknown[]) => unknown | Promise<unknown>;
type HttpMethod = "GET" | "POST" | "PUT";

type RouteCase = {
  name: string;
  method: HttpMethod;
  path: string;
  profile: Exclude<TestProfile, "irrelevant">;
  expectedPermission?: string;
  expectedStatus: number;
  serviceMethod: ServiceMethodName;
  body?: unknown;
  multipart?: boolean;
};

const BACKUP_ID = "bWFudWFsL2JhY2t1cC1yb3V0ZXItdGVzdA";
const BACKUP_JOB_ID = "cm00000000000000000000001";
const OPERATION_RUN_ID = "cm00000000000000000000002";
const RESTORE_JOB_ID = "cm00000000000000000000003";
const MATRIX_USER_AGENT = "backup-router-matrix-test";
const backupPermissionProfiles = ["create", "settings", "restore"] as const;

const serviceMethodNames = [
  "clearRestoreMaintenanceMode",
  "confirmProductionRestoreHandoff",
  "copyBackupToExternalDrive",
  "createBackupSupportPackage",
  "getBackupDetails",
  "getBackupJob",
  "getBackupScheduleStatus",
  "getBackupSettings",
  "getBackupStorageStatus",
  "getOperationRun",
  "getRestoreJob",
  "getRestoreMaintenanceStatus",
  "importBackupFiles",
  "listBackups",
  "listExternalBackupDrives",
  "prepareProductionRestore",
  "runBackupRestoreTest",
  "runPostRestoreCheck",
  "startManualBackup",
  "startRestoreMaintenanceMode",
  "startScheduledBackupNow",
  "updateBackupScheduleConfig",
  "updateBackupStorageRoot",
  "useRecommendedBackupStorage",
  "verifyBackup",
] as const satisfies readonly ServiceMethodName[];

type MissingServiceMethod = Exclude<ServiceMethodName, (typeof serviceMethodNames)[number]>;
const allServiceMethodsAreStubbed: MissingServiceMethod extends never ? true : false = true;
void allServiceMethodsAreStubbed;

const routeCases: RouteCase[] = [
  {
    name: "shared settings read",
    method: "GET",
    path: "/settings",
    profile: "create",
    expectedStatus: 200,
    serviceMethod: "getBackupSettings",
  },
  {
    name: "shared maintenance read",
    method: "GET",
    path: "/maintenance",
    profile: "settings",
    expectedStatus: 200,
    serviceMethod: "getRestoreMaintenanceStatus",
  },
  {
    name: "shared inventory read",
    method: "GET",
    path: "/?page=1&limit=20",
    profile: "restore",
    expectedStatus: 200,
    serviceMethod: "listBackups",
  },
  {
    name: "shared backup-job read",
    method: "GET",
    path: `/jobs/${BACKUP_JOB_ID}`,
    profile: "create",
    expectedStatus: 200,
    serviceMethod: "getBackupJob",
  },
  {
    name: "shared operation-run read",
    method: "GET",
    path: `/operation-runs/${OPERATION_RUN_ID}`,
    profile: "settings",
    expectedStatus: 200,
    serviceMethod: "getOperationRun",
  },
  {
    name: "shared backup-details read",
    method: "GET",
    path: `/${BACKUP_ID}`,
    profile: "restore",
    expectedStatus: 200,
    serviceMethod: "getBackupDetails",
  },
  {
    name: "schedule read",
    method: "GET",
    path: "/schedule",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "getBackupScheduleStatus",
  },
  {
    name: "schedule update",
    method: "PUT",
    path: "/schedule",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "updateBackupScheduleConfig",
    body: { enabled: true, frequency: "daily", dailyTime: "10:15" },
  },
  {
    name: "storage read",
    method: "GET",
    path: "/storage",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "getBackupStorageStatus",
  },
  {
    name: "recommended storage",
    method: "POST",
    path: "/storage/recommended",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "useRecommendedBackupStorage",
    body: {},
  },
  {
    name: "storage update",
    method: "PUT",
    path: "/storage",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "updateBackupStorageRoot",
    body: { backupRoot: "E:\\BackupRouterContractTest" },
  },
  {
    name: "scheduled run-now",
    method: "POST",
    path: "/scheduled/run-now",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 202,
    serviceMethod: "startScheduledBackupNow",
    body: { frequency: "weekly" },
  },
  {
    name: "external-drive read",
    method: "GET",
    path: "/external-drives",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "listExternalBackupDrives",
  },
  {
    name: "external copy",
    method: "POST",
    path: "/external-copy",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 201,
    serviceMethod: "copyBackupToExternalDrive",
    body: { driveRoot: "E:\\", backupId: BACKUP_ID },
  },
  {
    name: "maintenance clear",
    method: "POST",
    path: "/maintenance/clear",
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "clearRestoreMaintenanceMode",
    body: { reason: "contract test" },
  },
  {
    name: "support package",
    method: "POST",
    path: `/${BACKUP_ID}/support-package`,
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 201,
    serviceMethod: "createBackupSupportPackage",
    body: {},
  },
  {
    name: "verify backup",
    method: "POST",
    path: `/${BACKUP_ID}/verify`,
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "verifyBackup",
    body: {},
  },
  {
    name: "restore test",
    method: "POST",
    path: `/${BACKUP_ID}/restore-test`,
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "runBackupRestoreTest",
    body: {},
  },
  {
    name: "post-restore check",
    method: "POST",
    path: `/${BACKUP_ID}/post-restore-check`,
    profile: "settings",
    expectedPermission: AdminPermission.BACKUP_SETTINGS_MANAGE,
    expectedStatus: 200,
    serviceMethod: "runPostRestoreCheck",
    body: {},
  },
  {
    name: "manual backup",
    method: "POST",
    path: "/manual",
    profile: "create",
    expectedPermission: AdminPermission.BACKUP_CREATE,
    expectedStatus: 202,
    serviceMethod: "startManualBackup",
    body: { notes: "contract test" },
  },
  {
    name: "backup import",
    method: "POST",
    path: "/import",
    profile: "create",
    expectedPermission: AdminPermission.BACKUP_CREATE,
    expectedStatus: 201,
    serviceMethod: "importBackupFiles",
    multipart: true,
  },
  {
    name: "restore-job read",
    method: "GET",
    path: `/restore-jobs/${RESTORE_JOB_ID}`,
    profile: "restore",
    expectedPermission: AdminPermission.RESTORE_DATABASE,
    expectedStatus: 200,
    serviceMethod: "getRestoreJob",
  },
  {
    name: "restore confirmation",
    method: "POST",
    path: `/restore-jobs/${RESTORE_JOB_ID}/confirm`,
    profile: "restore",
    expectedPermission: AdminPermission.RESTORE_DATABASE,
    expectedStatus: 200,
    serviceMethod: "confirmProductionRestoreHandoff",
    body: { folderName: "prepared-restore-folder", phrase: "RESTORE ATLASGYM DATABASE" },
  },
  {
    name: "restore maintenance start",
    method: "POST",
    path: `/restore-jobs/${RESTORE_JOB_ID}/maintenance/start`,
    profile: "restore",
    expectedPermission: AdminPermission.RESTORE_DATABASE,
    expectedStatus: 200,
    serviceMethod: "startRestoreMaintenanceMode",
    body: { reason: "contract test" },
  },
  {
    name: "restore preparation",
    method: "POST",
    path: `/${BACKUP_ID}/restore/prepare`,
    profile: "restore",
    expectedPermission: AdminPermission.RESTORE_DATABASE,
    expectedStatus: 202,
    serviceMethod: "prepareProductionRestore",
    body: { notes: "contract test" },
  },
];

function assertSafeTemporaryRoot(root: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTemp = path.resolve(os.tmpdir());
  const relative = path.relative(resolvedTemp, resolvedRoot);
  assert.ok(relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.match(path.basename(resolvedRoot), /^atlasgym-backup-api-test-/u);
}

function assertIsolatedEnvironment() {
  assert.equal(process.env["NODE_ENV"], "test");
  const databaseUrl = new URL(process.env["DATABASE_URL"] ?? "");
  assert.equal(databaseUrl.hostname, "127.0.0.1");
  assert.equal(databaseUrl.port, "1");
  assert.equal(databaseUrl.pathname, "/atlasgym_backup_router_test");
}

function createServiceDouble() {
  const calls: ServiceCall[] = [];
  const behaviors = new Map<ServiceMethodName, ServiceBehavior>();
  const entries = serviceMethodNames.map((name) => [
    name,
    async (...args: unknown[]) => {
      calls.push({ name, args });
      const behavior = behaviors.get(name);
      if (behavior) return behavior(...args);
      return { serviceMethod: name };
    },
  ]);
  const service = Object.fromEntries(entries) as unknown as BackupRouterService;
  return {
    service,
    calls,
    resetCalls: () => {
      calls.length = 0;
    },
    setBehavior: (name: ServiceMethodName, behavior?: ServiceBehavior) => {
      if (behavior) behaviors.set(name, behavior);
      else behaviors.delete(name);
    },
  };
}

function permissionsFor(profile: TestProfile) {
  if (profile === "create") return [AdminPermission.BACKUP_CREATE];
  if (profile === "settings") return [AdminPermission.BACKUP_SETTINGS_MANAGE];
  if (profile === "restore") return [AdminPermission.RESTORE_DATABASE];
  return [AdminPermission.SIGN_IN];
}

function roleFor(profile: TestProfile) {
  return profile === "restore" ? AdminRole.VENDOR_OWNER : AdminRole.STAFF;
}

function buildTestApp(service: BackupRouterService, uploadRoot: string) {
  const app = express();
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile") as TestProfile | undefined;
    if (profile && ["create", "irrelevant", "restore", "settings"].includes(profile)) {
      req.auth = {
        user: {
          id: `backup-router-${profile}`,
          username: `backup-router-${profile}`,
          role: roleFor(profile),
        },
        permissions: permissionsFor(profile),
        session: {
          id: `backup-router-session-${profile}`,
        },
      } as any;
    }
    next();
  });
  app.use(express.json());
  app.use(
    "/api/v1/backups",
    createBackupRouter(service, {
      importFileSizeLimitBytes: 64,
      importUploadRoot: uploadRoot,
    })
  );
  app.use(errorHandler);
  return app;
}

function createImportForm(fieldName = "files", fileCount = 1) {
  const form = new FormData();
  for (let index = 0; index < fileCount; index += 1) {
    form.append(fieldName, new Blob([`backup-router-fixture-${index}`]), index === 0 ? "database.dump" : `file-${index}.txt`);
  }
  return form;
}

function createOversizedImportForm() {
  const form = new FormData();
  form.append("files", new Blob(["x".repeat(65)]), "oversized.dump");
  return form;
}

async function request(
  baseUrl: string,
  input: {
    method: HttpMethod;
    path: string;
    profile?: TestProfile;
    body?: unknown;
    multipart?: FormData;
    userAgent?: string;
  }
) {
  const headers = new Headers();
  if (input.profile) headers.set("x-test-profile", input.profile);
  if (input.userAgent) headers.set("user-agent", input.userAgent);
  let body: FormData | string | undefined;
  if (input.multipart) {
    body = input.multipart;
  } else if (input.body !== undefined && input.method !== "GET") {
    headers.set("content-type", "application/json");
    body = JSON.stringify(input.body);
  }
  return fetch(`${baseUrl}${input.path}`, {
    method: input.method,
    headers,
    ...(body === undefined ? {} : { body }),
  });
}

async function requestRouteCase(baseUrl: string, routeCase: RouteCase, profile = routeCase.profile) {
  if (routeCase.multipart) {
    return request(baseUrl, {
      method: routeCase.method,
      path: routeCase.path,
      profile,
      multipart: createImportForm(),
      userAgent: MATRIX_USER_AGENT,
    });
  }
  return request(baseUrl, {
    method: routeCase.method,
    path: routeCase.path,
    profile,
    body: routeCase.body,
    userAgent: MATRIX_USER_AGENT,
  });
}

function expectedContext(profile: Exclude<TestProfile, "irrelevant">, userAgent = MATRIX_USER_AGENT) {
  return {
    actor: {
      id: `backup-router-${profile}`,
      role: roleFor(profile),
      sessionId: `backup-router-session-${profile}`,
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent,
    },
  };
}

function assertRouteCallArguments(routeCase: RouteCase, call: ServiceCall) {
  const context = expectedContext(routeCase.profile);
  switch (call.name) {
    case "getBackupSettings":
    case "getRestoreMaintenanceStatus":
    case "getBackupScheduleStatus":
    case "getBackupStorageStatus":
    case "listExternalBackupDrives":
      assert.deepEqual(call.args, []);
      return;
    case "listBackups":
      assert.deepEqual(call.args, [{ page: 1, limit: 20 }]);
      return;
    case "getBackupJob":
      assert.deepEqual(call.args, [BACKUP_JOB_ID]);
      return;
    case "getOperationRun":
      assert.deepEqual(call.args, [OPERATION_RUN_ID]);
      return;
    case "getBackupDetails":
      assert.deepEqual(call.args, [BACKUP_ID]);
      return;
    case "updateBackupScheduleConfig":
    case "updateBackupStorageRoot":
    case "copyBackupToExternalDrive":
    case "clearRestoreMaintenanceMode":
    case "startManualBackup":
      assert.deepEqual(call.args, [routeCase.body, context]);
      return;
    case "useRecommendedBackupStorage":
      assert.deepEqual(call.args, [context]);
      return;
    case "startScheduledBackupNow":
      assert.deepEqual(call.args, [context, "weekly"]);
      return;
    case "createBackupSupportPackage":
    case "verifyBackup":
    case "runBackupRestoreTest":
    case "runPostRestoreCheck":
      assert.deepEqual(call.args, [BACKUP_ID, context]);
      return;
    case "getRestoreJob":
      assert.deepEqual(call.args, [RESTORE_JOB_ID]);
      return;
    case "confirmProductionRestoreHandoff":
    case "startRestoreMaintenanceMode":
      assert.deepEqual(call.args, [RESTORE_JOB_ID, routeCase.body, context]);
      return;
    case "prepareProductionRestore":
      assert.deepEqual(call.args, [BACKUP_ID, routeCase.body, context]);
      return;
    case "importBackupFiles": {
      const files = call.args[0] as Array<{ originalname: string; size: number }>;
      assert.equal(files.length, 1);
      assert.equal(files[0]?.originalname, "database.dump");
      assert.equal(files[0]?.size, Buffer.byteLength("backup-router-fixture-0"));
      assert.deepEqual(call.args[1], context);
      return;
    }
  }
}

async function assertUploadRootEmpty(uploadRoot: string) {
  const entries = await readdir(uploadRoot).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  });
  assert.deepEqual(entries, []);
}

async function pathExists(targetPath: string) {
  return stat(targetPath)
    .then(() => true)
    .catch((error: unknown) => {
      if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    });
}

async function testGlobalAuthenticationAndPermissionGuards(
  baseUrl: string,
  serviceDouble: ReturnType<typeof createServiceDouble>
) {
  serviceDouble.resetCalls();
  const unauthenticated = await request(baseUrl, { method: "GET", path: "/settings" });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), { message: "Authentication required" });

  const unrelated = await request(baseUrl, {
    method: "GET",
    path: "/settings",
    profile: "irrelevant",
  });
  assert.equal(unrelated.status, 403);
  assert.deepEqual(await unrelated.json(), {
    message: "Permission denied",
    requiredPermissions: [
      AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE,
      AdminPermission.RESTORE_DATABASE,
    ],
  });
  assert.equal(serviceDouble.calls.length, 0);
}

async function testExactPermissionAndStatusMatrix(
  baseUrl: string,
  serviceDouble: ReturnType<typeof createServiceDouble>
) {
  assert.equal(routeCases.length, 25);
  for (const routeCase of routeCases) {
    if (routeCase.expectedPermission) {
      for (const deniedProfile of backupPermissionProfiles.filter((profile) => profile !== routeCase.profile)) {
        serviceDouble.resetCalls();
        const denied = await requestRouteCase(baseUrl, routeCase, deniedProfile);
        assert.equal(denied.status, 403, `${routeCase.name} must reject ${deniedProfile} permission`);
        assert.deepEqual(await denied.json(), {
          message: "Permission denied",
          requiredPermission: routeCase.expectedPermission,
        });
        assert.equal(serviceDouble.calls.length, 0, `${routeCase.name} must not call the service when denied`);
      }
    } else {
      for (const allowedProfile of backupPermissionProfiles) {
        serviceDouble.resetCalls();
        const allowed = await requestRouteCase(baseUrl, routeCase, allowedProfile);
        assert.equal(allowed.status, routeCase.expectedStatus, `${routeCase.name} must allow ${allowedProfile}`);
        await allowed.text();
        assert.deepEqual(serviceDouble.calls.map((call) => call.name), [routeCase.serviceMethod]);
      }
      const sharedCall = serviceDouble.calls[0];
      assert.ok(sharedCall);
      assertRouteCallArguments(routeCase, sharedCall);
      continue;
    }

    serviceDouble.resetCalls();
    const allowed = await requestRouteCase(baseUrl, routeCase);
    assert.equal(allowed.status, routeCase.expectedStatus, `${routeCase.name} returned the wrong HTTP status`);
    await allowed.text();
    assert.deepEqual(
      serviceDouble.calls.map((call) => call.name),
      [routeCase.serviceMethod],
      `${routeCase.name} called the wrong service method`
    );
    const call = serviceDouble.calls[0];
    assert.ok(call);
    assertRouteCallArguments(routeCase, call);
  }
}

async function testValidationStopsBeforeService(
  baseUrl: string,
  serviceDouble: ReturnType<typeof createServiceDouble>
) {
  const invalidCases: Array<{
    name: string;
    method: HttpMethod;
    path: string;
    profile: TestProfile;
    body?: unknown;
  }> = [
    { name: "list page", method: "GET", path: "/?page=0", profile: "create" },
    {
      name: "schedule time",
      method: "PUT",
      path: "/schedule",
      profile: "settings",
      body: { dailyTime: "25:99" },
    },
    {
      name: "schedule frequency",
      method: "POST",
      path: "/scheduled/run-now",
      profile: "settings",
      body: { frequency: "quarterly" },
    },
    {
      name: "storage root",
      method: "PUT",
      path: "/storage",
      profile: "settings",
      body: { backupRoot: "x" },
    },
    {
      name: "external drive",
      method: "POST",
      path: "/external-copy",
      profile: "settings",
      body: { driveRoot: "x" },
    },
    { name: "backup job id", method: "GET", path: "/jobs/not-a-cuid", profile: "create" },
    { name: "operation run id", method: "GET", path: "/operation-runs/not-a-cuid", profile: "settings" },
    { name: "restore job id", method: "GET", path: "/restore-jobs/not-a-cuid", profile: "restore" },
    {
      name: "restore confirmation",
      method: "POST",
      path: `/restore-jobs/${RESTORE_JOB_ID}/confirm`,
      profile: "restore",
      body: { folderName: "prepared-restore-folder" },
    },
  ];

  for (const invalidCase of invalidCases) {
    serviceDouble.resetCalls();
    const response = await request(baseUrl, invalidCase);
    assert.equal(response.status, 400, `${invalidCase.name} must return 400`);
    assert.equal((await response.json() as { message: string }).message, "Validation failed");
    assert.equal(serviceDouble.calls.length, 0, `${invalidCase.name} must stop before the service`);
  }
}

async function testContextAndSafeErrorMapping(
  baseUrl: string,
  serviceDouble: ReturnType<typeof createServiceDouble>
) {
  serviceDouble.resetCalls();
  const manual = await request(baseUrl, {
    method: "POST",
    path: "/manual",
    profile: "create",
    userAgent: "backup-router-contract-test",
    body: { notes: "  trimmed note  " },
  });
  assert.equal(manual.status, 202);
  await manual.text();
  assert.equal(serviceDouble.calls.length, 1);
  const manualCall = serviceDouble.calls[0];
  assert.equal(manualCall?.name, "startManualBackup");
  assert.deepEqual(manualCall?.args[0], { notes: "trimmed note" });
  assert.deepEqual(manualCall?.args[1], {
    actor: {
      id: "backup-router-create",
      role: AdminRole.STAFF,
      sessionId: "backup-router-session-create",
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent: "backup-router-contract-test",
    },
  });

  serviceDouble.setBehavior("listBackups", () => {
    throw new HttpError(409, "Backup operation is busy", { code: "ACTIVE_BACKUP_JOB" });
  });
  serviceDouble.resetCalls();
  const conflict = await request(baseUrl, { method: "GET", path: "/", profile: "create" });
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), {
    message: "Backup operation is busy",
    details: { code: "ACTIVE_BACKUP_JOB" },
  });
  assert.deepEqual(serviceDouble.calls.map((call) => call.name), ["listBackups"]);

  const privateError = "private backup router stack detail";
  serviceDouble.setBehavior("listBackups", () => {
    throw new Error(privateError);
  });
  serviceDouble.resetCalls();
  const unexpected = await request(baseUrl, { method: "GET", path: "/", profile: "settings" });
  assert.equal(unexpected.status, 500);
  const unexpectedBody = await unexpected.json() as { message: string };
  assert.deepEqual(unexpectedBody, { message: "Unexpected server error" });
  assert.equal(JSON.stringify(unexpectedBody).includes(privateError), false);
  assert.deepEqual(serviceDouble.calls.map((call) => call.name), ["listBackups"]);
  serviceDouble.setBehavior("listBackups");
}

async function testImportUploadCleanup(
  baseUrl: string,
  uploadRoot: string,
  serviceDouble: ReturnType<typeof createServiceDouble>
) {
  serviceDouble.resetCalls();
  const denied = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "settings",
    multipart: createImportForm(),
  });
  assert.equal(denied.status, 403);
  await denied.text();
  assert.equal(serviceDouble.calls.length, 0);
  await assertUploadRootEmpty(uploadRoot);

  serviceDouble.resetCalls();
  const succeeded = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    userAgent: "backup-router-import-test",
    multipart: createImportForm(),
  });
  assert.equal(succeeded.status, 201);
  await succeeded.text();
  assert.equal(serviceDouble.calls.length, 1);
  const importCall = serviceDouble.calls[0];
  assert.equal(importCall?.name, "importBackupFiles");
  const importedFiles = importCall?.args[0] as Array<{ originalname: string; path: string; size: number }>;
  assert.equal(importedFiles.length, 1);
  assert.equal(importedFiles[0]?.originalname, "database.dump");
  assert.equal(importedFiles[0]?.size, Buffer.byteLength("backup-router-fixture-0"));
  const uploadedPath = importedFiles[0]?.path;
  assert.ok(uploadedPath);
  assert.equal(path.dirname(path.resolve(uploadedPath)), path.resolve(uploadRoot));
  assert.equal(await pathExists(uploadedPath), false);
  assert.deepEqual(importCall?.args[1], {
    actor: {
      id: "backup-router-create",
      role: AdminRole.STAFF,
      sessionId: "backup-router-session-create",
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent: "backup-router-import-test",
    },
  });
  await assertUploadRootEmpty(uploadRoot);

  serviceDouble.setBehavior("importBackupFiles", () => {
    throw new HttpError(409, "Another backup is active", { code: "ACTIVE_BACKUP_JOB" });
  });
  serviceDouble.resetCalls();
  const rejected = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    multipart: createImportForm(),
  });
  assert.equal(rejected.status, 409);
  assert.deepEqual(await rejected.json(), {
    message: "Another backup is active",
    details: { code: "ACTIVE_BACKUP_JOB" },
  });
  assert.deepEqual(serviceDouble.calls.map((call) => call.name), ["importBackupFiles"]);
  await assertUploadRootEmpty(uploadRoot);

  serviceDouble.setBehavior("importBackupFiles", () => {
    throw new Error("private import implementation error");
  });
  serviceDouble.resetCalls();
  const failed = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    multipart: createImportForm(),
  });
  assert.equal(failed.status, 500);
  assert.deepEqual(await failed.json(), { message: "Unexpected server error" });
  assert.deepEqual(serviceDouble.calls.map((call) => call.name), ["importBackupFiles"]);
  await assertUploadRootEmpty(uploadRoot);
  serviceDouble.setBehavior("importBackupFiles");

  serviceDouble.resetCalls();
  const unexpectedField = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    multipart: createImportForm("unexpected"),
  });
  assert.equal(unexpectedField.status, 400);
  assert.deepEqual(await unexpectedField.json(), {
    message: "Uploaded files failed validation",
    details: {
      code: "LIMIT_UNEXPECTED_FILE",
      field: "unexpected",
    },
  });
  assert.equal(serviceDouble.calls.length, 0);
  await assertUploadRootEmpty(uploadRoot);

  serviceDouble.resetCalls();
  const oversizedFile = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    multipart: createOversizedImportForm(),
  });
  assert.equal(oversizedFile.status, 413);
  assert.deepEqual(await oversizedFile.json(), {
    message: "Uploaded file is too large",
    details: {
      code: "LIMIT_FILE_SIZE",
      field: "files",
    },
  });
  assert.equal(serviceDouble.calls.length, 0);
  await assertUploadRootEmpty(uploadRoot);

  serviceDouble.resetCalls();
  const tooManyFiles = await request(baseUrl, {
    method: "POST",
    path: "/import",
    profile: "create",
    multipart: createImportForm("files", 25),
  });
  assert.equal(tooManyFiles.status, 400);
  const tooManyBody = await tooManyFiles.json() as {
    message: string;
    details: { code: string };
  };
  assert.equal(tooManyBody.message, "Uploaded files failed validation");
  assert.equal(tooManyBody.details.code, "LIMIT_FILE_COUNT");
  assert.equal(serviceDouble.calls.length, 0);
  await assertUploadRootEmpty(uploadRoot);
}

async function run() {
  assertIsolatedEnvironment();
  const uploadRoot = await mkdtemp(path.join(os.tmpdir(), "atlasgym-backup-api-test-"));
  assertSafeTemporaryRoot(uploadRoot);
  let server: ReturnType<typeof createServer> | null = null;

  try {
    const serviceDouble = createServiceDouble();
    server = createServer(buildTestApp(serviceDouble.service, uploadRoot));
    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error) => reject(error);
      server?.once("error", handleError);
      server?.listen(0, "127.0.0.1", () => {
        server?.off("error", handleError);
        resolve();
      });
    });
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/backups`;
    const tests: Array<{ name: string; execute: () => Promise<void> }> = [
      {
        name: "global authentication and backup permission guards",
        execute: () => testGlobalAuthenticationAndPermissionGuards(baseUrl, serviceDouble),
      },
      {
        name: "exact permission and HTTP status matrix for all backup routes",
        execute: () => testExactPermissionAndStatusMatrix(baseUrl, serviceDouble),
      },
      {
        name: "schema validation stops before backup services",
        execute: () => testValidationStopsBeforeService(baseUrl, serviceDouble),
      },
      {
        name: "request context and safe HTTP error mapping",
        execute: () => testContextAndSafeErrorMapping(baseUrl, serviceDouble),
      },
      {
        name: "multipart import cleanup on denial, success, service failure, and Multer rejection",
        execute: () => testImportUploadCleanup(baseUrl, uploadRoot, serviceDouble),
      },
    ];

    for (const test of tests) {
      await test.execute();
      console.log(`ok - ${test.name}`);
    }
    console.log(`Backup API integration tests passed (${tests.length}/${tests.length}).`);
  } finally {
    try {
      if (server?.listening) {
        await new Promise<void>((resolve, reject) =>
          server?.close((error) => {
            if (error) reject(error);
            else resolve();
          })
        );
      }
    } finally {
      assertSafeTemporaryRoot(uploadRoot);
      await rm(uploadRoot, { recursive: true, force: true });
    }
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
