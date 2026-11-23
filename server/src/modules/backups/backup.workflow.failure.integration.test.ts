import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { AdminPermission, AuditLog, BackupJob, OperationRun, PrismaClient } from "@prisma/client";

const DATABASE_NAME_PATTERN = /^atlasgym_backup_workflow_test_[a-z0-9_]+$/u;
const FORBIDDEN_CONNECTION_QUERY_KEYS = new Set(["host", "port", "user", "password", "database", "db"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const MANAGED_ROOT_PREFIX = "atlasgym-backup-workflow-test-managed-";
const UPLOAD_ROOT_PREFIX = "atlasgym-backup-workflow-test-upload-";
const TEST_USER_AGENT = "atlasgym-backup-workflow-integration/1.0";
const MISSING_LOG_MESSAGE = "Backup import is missing backup.log";
const AUDIT_FAILURE_SENTINEL = "injected-backup-import-failure-audit-error";
const SUCCESS_AUDIT_FAILURE_SENTINEL = "injected-backup-import-success-audit-error";
const SAFE_IMPORT_FAILURE_MESSAGE = "Backup import failed";
const VERIFY_FAILURE_MESSAGE = "Backup verification failed: manifest hash or size mismatch.";
const VERIFY_AUDIT_FAILURE_SENTINEL = "injected-backup-verify-failure-audit-error";
const MISSING_MANIFEST_MESSAGE = "Backup manifest is missing";
const MISSING_DUMP_MESSAGE = "Backup dump file is missing";
const ZIP_EXTRACTION_TEMP_PREFIX = `atlasgym-backup-import-zip-${process.pid}-`;
const INCOMPLETE_ZIP_BASE64 =
  "UEsDBBQAAAAIAAAAIVzNmVVrIAAAABsAAAANAAAAZGF0YWJhc2UuZHVtcAEbAOT/emlwLXdvcmtmbG93LWRhdGFiYXNlLWR1bXAKUEsDBBQAAAAIAAAAIVx5sSu0IgAAAB0AAAANAAAAbWFuaWZlc3QuanNvbgEdAOL/eyJmaXh0dXJlIjoiemlwLWluY29tcGxldGUifQpQSwECFAAUAAAACAAAACFczZlVayAAAAAbAAAADQAAAAAAAAAAAAAAAAAAAAAAZGF0YWJhc2UuZHVtcFBLAQIUABQAAAAIAAAAIVx5sSu0IgAAAB0AAAANAAAAAAAAAAAAAAAAAEsAAABtYW5pZmVzdC5qc29uUEsFBgAAAAACAAIAdgAAAJgAAAAAAA==";
const INCOMPLETE_ZIP_SHA256 = "e382f36498e9998fea78fdbf086914c52a3ab364d30af70e6132465eb34dcfa0";
const INCOMPLETE_ZIP_DUMP = Buffer.from("zip-workflow-database-dump\n", "utf8");
const INCOMPLETE_ZIP_MANIFEST = Buffer.from('{"fixture":"zip-incomplete"}\n', "utf8");

type Runtime = {
  prisma: PrismaClient;
  AdminPermission: typeof import("@prisma/client").AdminPermission;
  AdminRole: typeof import("@prisma/client").AdminRole;
  AuditActor: typeof import("@prisma/client").AuditActor;
  BackupJobType: typeof import("@prisma/client").BackupJobType;
  BackupStatus: typeof import("@prisma/client").BackupStatus;
  BackupVerificationStatus: typeof import("@prisma/client").BackupVerificationStatus;
  OperationRunStatus: typeof import("@prisma/client").OperationRunStatus;
  OperationRunType: typeof import("@prisma/client").OperationRunType;
  PermissionMode: typeof import("@prisma/client").PermissionMode;
};

type Fixture = {
  adminId: string;
  sessionId: string;
  token: string;
};

type MutableAuditDelegate = {
  create: (args: {
    data: {
      action?: string;
      actorId?: string | null;
      targetId?: string | null;
      metadata?: unknown;
    };
  }) => Promise<unknown>;
};

type ValidImportPayload = {
  dump: Buffer;
  log: Buffer;
  manifest: Record<string, unknown>;
  manifestBytes: Buffer;
};

type VerificationFailureFixture = {
  label: string;
  backupId: string;
  folderPath: string;
  job: BackupJob;
  operation: OperationRun;
  expectedHash: string;
  actualHash: string;
  expectedSize: number;
  actualSize: number;
};

type MissingVerificationArtifactFixture = {
  label: string;
  backupId: string;
  folderPath: string;
  manifestPath: string;
  logPath: string;
  job: BackupJob;
  operation: OperationRun;
  dumpHash: string;
  dumpSize: number;
};

type MissingManifestVerificationFixture = MissingVerificationArtifactFixture;

type MissingDumpVerificationFixture = MissingVerificationArtifactFixture & {
  dumpPath: string;
};

function assertSafeWorkerEnvironment() {
  assert.equal(process.env["NODE_ENV"], "test", "Backup workflow worker requires NODE_ENV=test");
  const databaseUrl = process.env["DATABASE_URL"];
  assert.ok(databaseUrl, "Backup workflow worker requires DATABASE_URL");

  const parsed = new URL(databaseUrl);
  assert.ok(
    parsed.protocol === "postgres:" || parsed.protocol === "postgresql:",
    "Backup workflow worker requires a PostgreSQL URL"
  );
  assert.ok(LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()), "Backup workflow worker refuses a non-loopback database");
  for (const key of parsed.searchParams.keys()) {
    assert.ok(
      !FORBIDDEN_CONNECTION_QUERY_KEYS.has(key.toLowerCase()),
      `Backup workflow worker refuses connection query override: ${key}`
    );
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  assert.match(databaseName, DATABASE_NAME_PATTERN, "Backup workflow worker requires its generated disposable database");
  assert.ok(Buffer.byteLength(databaseName, "utf8") <= 63, "Disposable database name exceeds PostgreSQL's limit");
}

function assertSafeTemporaryRoot(root: string, prefix: string) {
  const resolvedRoot = path.resolve(root);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolvedRoot);
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.ok(path.basename(resolvedRoot).startsWith(prefix), `Unexpected temporary root: ${path.basename(resolvedRoot)}`);
}

async function loadRuntime(onPrismaLoaded: (prisma: PrismaClient) => void): Promise<Runtime & {
  createBackupRouter: typeof import("./backup.router").createBackupRouter;
  backupService: typeof import("./backup.service");
  errorHandler: typeof import("../../middlewares/error-handler").errorHandler;
  authCookieName: string;
}> {
  const prismaClient = await import("@prisma/client");
  const { prisma } = await import("../../lib/prisma");
  onPrismaLoaded(prisma);
  const backupService = await import("./backup.service");
  const { createBackupRouter } = await import("./backup.router");
  const { errorHandler } = await import("../../middlewares/error-handler");
  const { env } = await import("../../config/env");

  return {
    prisma,
    AdminPermission: prismaClient.AdminPermission,
    AdminRole: prismaClient.AdminRole,
    AuditActor: prismaClient.AuditActor,
    BackupJobType: prismaClient.BackupJobType,
    BackupStatus: prismaClient.BackupStatus,
    BackupVerificationStatus: prismaClient.BackupVerificationStatus,
    OperationRunStatus: prismaClient.OperationRunStatus,
    OperationRunType: prismaClient.OperationRunType,
    PermissionMode: prismaClient.PermissionMode,
    createBackupRouter,
    backupService,
    errorHandler,
    authCookieName: env.AUTH_COOKIE_NAME,
  };
}

async function createTemporaryRoots() {
  let managedRoot: string | null = null;
  let uploadRoot: string | null = null;
  try {
    managedRoot = await mkdtemp(path.join(os.tmpdir(), MANAGED_ROOT_PREFIX));
    assertSafeTemporaryRoot(managedRoot, MANAGED_ROOT_PREFIX);
    uploadRoot = await mkdtemp(path.join(os.tmpdir(), UPLOAD_ROOT_PREFIX));
    assertSafeTemporaryRoot(uploadRoot, UPLOAD_ROOT_PREFIX);
    return { managedRoot, uploadRoot };
  } catch (error) {
    if (uploadRoot) {
      assertSafeTemporaryRoot(uploadRoot, UPLOAD_ROOT_PREFIX);
      await rm(uploadRoot, { recursive: true, force: true });
    }
    if (managedRoot) {
      assertSafeTemporaryRoot(managedRoot, MANAGED_ROOT_PREFIX);
      await rm(managedRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

async function createFixture(
  runtime: Runtime,
  permissions: AdminPermission[] = [runtime.AdminPermission.BACKUP_CREATE]
): Promise<Fixture> {
  const suffix = randomUUID();
  const token = `backup-workflow-${suffix}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const result = await runtime.prisma.$transaction(async (tx) => {
    const admin = await tx.adminUser.create({
      data: {
        username: `it-backup-workflow-${suffix}`,
        passwordHash: "not-used-by-backup-workflow-integration-test",
        role: runtime.AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: permissions.map((permission) => ({
        adminUserId: admin.id,
        permission,
        mode: runtime.PermissionMode.ALLOW,
        reason: "Backup workflow integration fixture",
      })),
    });
    const session = await tx.adminSession.create({
      data: {
        adminUserId: admin.id,
        tokenHash: createHash("sha256").update(token).digest("hex"),
        expiresAt,
      },
    });
    return { admin, session };
  });

  return {
    adminId: result.admin.id,
    sessionId: result.session.id,
    token,
  };
}

async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}/api/v1/backups`;
}

async function closeServer(server: ReturnType<typeof createServer> | null) {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function authenticatedHeaders(fixture: Fixture, authCookieName: string) {
  return {
    cookie: `${authCookieName}=${encodeURIComponent(fixture.token)}`,
    "user-agent": TEST_USER_AGENT,
  };
}

async function sendMissingLogImport(baseUrl: string, fixture: Fixture, authCookieName: string) {
  const form = new FormData();
  form.append("files", new Blob(["workflow-test-database-dump"]), "database.dump");
  form.append("files", new Blob([JSON.stringify({ test: true })], { type: "application/json" }), "manifest.json");

  const response = await fetch(`${baseUrl}/import`, {
    method: "POST",
    headers: authenticatedHeaders(fixture, authCookieName),
    body: form,
  });
  const body = await response.json() as { message?: string; [key: string]: unknown };
  return { response, body };
}

function createValidImportPayload(): ValidImportPayload {
  const dump = Buffer.from(`backup-workflow-valid-${randomUUID()}\n`, "utf8");
  const log = Buffer.from("Backup workflow fixture completed successfully.\n", "utf8");
  const manifest: Record<string, unknown> = {
    appName: "AtlasGym",
    backupType: "manual",
    status: "succeeded",
    createdAt: "2026-07-31T12:00:00.000Z",
    databaseName: "atlasgym_backup_workflow_fixture",
    schema: "public",
    appCommit: null,
    prismaMigrationStatus: "not-run",
    fileName: "database.dump",
    sizeBytes: dump.length,
    sha256: createHash("sha256").update(dump).digest("hex"),
    operator: "backup-workflow-integration",
    notes: null,
  };
  return {
    dump,
    log,
    manifest,
    manifestBytes: Buffer.from(`${JSON.stringify(manifest)}\n`, "utf8"),
  };
}

async function sendValidImport(
  baseUrl: string,
  fixture: Fixture,
  authCookieName: string,
  payload: ValidImportPayload
) {
  const form = new FormData();
  form.append("files", new Blob([payload.dump]), "database.dump");
  form.append("files", new Blob([payload.manifestBytes], { type: "application/json" }), "manifest.json");
  form.append("files", new Blob([payload.log]), "backup.log");

  const response = await fetch(`${baseUrl}/import`, {
    method: "POST",
    headers: authenticatedHeaders(fixture, authCookieName),
    body: form,
  });
  const body = await response.json() as { message?: string; [key: string]: unknown };
  return { response, body };
}

async function sendZipImport(
  baseUrl: string,
  fixture: Fixture,
  authCookieName: string,
  archive: Buffer,
  fileName: string
) {
  const form = new FormData();
  form.append("files", new Blob([archive], { type: "application/zip" }), fileName);
  const response = await fetch(`${baseUrl}/import`, {
    method: "POST",
    headers: authenticatedHeaders(fixture, authCookieName),
    body: form,
  });
  const body = await response.json() as { message?: string; [key: string]: unknown };
  return { response, body };
}

function assertMissingLogResponse(result: Awaited<ReturnType<typeof sendMissingLogImport>>) {
  assert.equal(result.response.status, 400);
  assert.deepEqual(result.body, { message: MISSING_LOG_MESSAGE });
  assert.ok(!JSON.stringify(result.body).includes(AUDIT_FAILURE_SENTINEL));
}

function asJsonObject(value: unknown) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected a JSON object");
  return value as Record<string, unknown>;
}

function assertStrictlyInsideRoot(targetPath: string, rootPath: string) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function pathExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

function createIncompleteZipFixture() {
  const archive = Buffer.from(INCOMPLETE_ZIP_BASE64, "base64");
  assert.equal(archive.length, 292);
  assert.equal(createHash("sha256").update(archive).digest("hex"), INCOMPLETE_ZIP_SHA256);
  return archive;
}

function createCorruptZipFixture() {
  const archive = Buffer.from(createIncompleteZipFixture());
  const centralDirectoryOffset = archive.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(centralDirectoryOffset > 0);
  archive.writeUInt16LE(99, 8);
  archive.writeUInt16LE(99, centralDirectoryOffset + 10);
  return archive;
}

function assertSafeZipExtractionPath(targetPath: string) {
  const resolvedTarget = path.resolve(targetPath);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolvedTarget);
  assert.ok(relative && !path.isAbsolute(relative) && !relative.includes(path.sep));
  assert.ok(relative.startsWith(ZIP_EXTRACTION_TEMP_PREFIX));
}

async function listZipExtractionDirectories() {
  const entries = await readdir(os.tmpdir(), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(ZIP_EXTRACTION_TEMP_PREFIX))
    .map((entry) => path.resolve(os.tmpdir(), entry.name))
    .sort();
}

async function snapshotTree(root: string, current = root, output: string[] = []) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    assertStrictlyInsideRoot(entryPath, root);
    const relative = path.relative(root, entryPath).split(path.sep).join("/");
    if (entry.isDirectory()) {
      output.push(`directory:${relative}`);
      await snapshotTree(root, entryPath, output);
      continue;
    }
    if (entry.isFile()) {
      const contents = await readFile(entryPath);
      output.push(`file:${relative}:${contents.length}:${createHash("sha256").update(contents).digest("hex")}`);
    }
  }
  return output;
}

async function cleanupNewZipExtractionDirectories(baseline: readonly string[]) {
  const baselineSet = new Set(baseline);
  const newDirectories = (await listZipExtractionDirectories()).filter((directory) => !baselineSet.has(directory));
  for (const directory of newDirectories) {
    assertSafeZipExtractionPath(directory);
    await rm(directory, { recursive: true, force: true });
  }
  return newDirectories;
}

async function sendVerifyBackup(
  baseUrl: string,
  fixture: Fixture,
  authCookieName: string,
  backupId: string
) {
  const response = await fetch(`${baseUrl}/${encodeURIComponent(backupId)}/verify`, {
    method: "POST",
    headers: authenticatedHeaders(fixture, authCookieName),
  });
  const body = await response.json() as {
    message?: string;
    details?: Record<string, unknown>;
    [key: string]: unknown;
  };
  return { response, body };
}

async function createVerificationFailureFixture(
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string,
  label: string
): Promise<VerificationFailureFixture> {
  const manualRoot = path.join(managedRoot, "manual");
  await mkdir(manualRoot, { recursive: true });
  const folderName = `verify_failure_${label}_${randomUUID().replaceAll("-", "")}`;
  const folderPath = path.resolve(manualRoot, folderName);
  assertStrictlyInsideRoot(folderPath, managedRoot);
  assert.equal(path.dirname(folderPath), manualRoot);
  await mkdir(folderPath);

  const expectedDump = Buffer.from(`verify-workflow-${label}-${randomUUID()}\n`, "utf8");
  const actualDump = Buffer.from(expectedDump);
  const mutationIndex = Math.max(0, actualDump.length - 2);
  actualDump[mutationIndex] = actualDump[mutationIndex]! ^ 0x01;
  const expectedHash = createHash("sha256").update(expectedDump).digest("hex");
  const actualHash = createHash("sha256").update(actualDump).digest("hex");
  assert.notEqual(actualHash, expectedHash);
  assert.equal(actualDump.length, expectedDump.length, "Verify fixture must isolate a hash-only mismatch");

  const dumpPath = path.join(folderPath, "database.dump");
  const manifestPath = path.join(folderPath, "manifest.json");
  const logPath = path.join(folderPath, "backup.log");
  const manifest = {
    appName: "AtlasGym",
    backupType: "manual",
    status: "succeeded",
    createdAt: new Date().toISOString(),
    databaseName: "atlasgym_backup_workflow_fixture",
    schema: "public",
    appCommit: null,
    prismaMigrationStatus: "not-run",
    fileName: "database.dump",
    sizeBytes: expectedDump.length,
    sha256: expectedHash,
    operator: "backup-workflow-integration",
    notes: null,
  };
  await Promise.all([
    writeFile(dumpPath, actualDump),
    writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8"),
    writeFile(logPath, "Backup workflow verification fixture completed.\n", "utf8"),
  ]);

  const backupId = Buffer.from(`manual/${folderName}`, "utf8").toString("base64url");
  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - 2_000);
  const job = await runtime.prisma.backupJob.create({
    data: {
      type: runtime.BackupJobType.MANUAL,
      status: runtime.BackupStatus.COMPLETED,
      verificationStatus: runtime.BackupVerificationStatus.NOT_VERIFIED,
      startedAt,
      finishedAt,
      location: folderPath,
      backupRoot: managedRoot,
      manifestPath,
      logPath,
      sizeBytes: BigInt(expectedDump.length),
      sha256: expectedHash,
      triggeredById: fixture.adminId,
    },
  });
  const operation = await runtime.prisma.operationRun.create({
    data: {
      type: runtime.OperationRunType.SAFE_BACKUP,
      status: runtime.OperationRunStatus.RUNNING,
      step: "verifying",
      percent: 78,
      message: "Backup files were created; waiting for verification",
      targetType: "BackupJob",
      targetId: job.id,
      result: {
        backupId,
        backupJobId: job.id,
        location: folderPath,
        sizeBytes: expectedDump.length.toString(),
        sha256: expectedHash,
      },
      metadata: { fixture: "verify-failure", label },
      startedById: fixture.adminId,
      startedAt: new Date(startedAt.getTime() + 1_000),
    },
  });

  return {
    label,
    backupId,
    folderPath,
    job,
    operation,
    expectedHash,
    actualHash,
    expectedSize: expectedDump.length,
    actualSize: actualDump.length,
  };
}

async function createMissingManifestVerificationFixture(
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string,
  label: string
): Promise<MissingManifestVerificationFixture> {
  const manualRoot = path.join(managedRoot, "manual");
  await mkdir(manualRoot, { recursive: true });
  const folderName = `verify_missing_manifest_${label}_${randomUUID().replaceAll("-", "")}`;
  const folderPath = path.resolve(manualRoot, folderName);
  assertStrictlyInsideRoot(folderPath, managedRoot);
  assert.equal(path.dirname(folderPath), manualRoot);
  await mkdir(folderPath);

  const dump = Buffer.from(`verify-missing-manifest-${label}-${randomUUID()}\n`, "utf8");
  const dumpHash = createHash("sha256").update(dump).digest("hex");
  const dumpPath = path.join(folderPath, "database.dump");
  const manifestPath = path.join(folderPath, "manifest.json");
  const logPath = path.join(folderPath, "backup.log");
  await Promise.all([
    writeFile(dumpPath, dump),
    writeFile(logPath, "Backup workflow missing-manifest fixture completed.\n", "utf8"),
  ]);
  assert.equal(await pathExists(manifestPath), false, "Missing-manifest fixture must not create manifest.json");

  const backupId = Buffer.from(`manual/${folderName}`, "utf8").toString("base64url");
  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - 2_000);
  const job = await runtime.prisma.backupJob.create({
    data: {
      type: runtime.BackupJobType.MANUAL,
      status: runtime.BackupStatus.COMPLETED,
      verificationStatus: runtime.BackupVerificationStatus.NOT_VERIFIED,
      startedAt,
      finishedAt,
      location: folderPath,
      backupRoot: managedRoot,
      manifestPath,
      logPath,
      sizeBytes: BigInt(dump.length),
      sha256: dumpHash,
      triggeredById: fixture.adminId,
    },
  });
  const operation = await runtime.prisma.operationRun.create({
    data: {
      type: runtime.OperationRunType.SAFE_BACKUP,
      status: runtime.OperationRunStatus.RUNNING,
      step: "verifying",
      percent: 78,
      message: "Backup files were created; waiting for verification",
      targetType: "BackupJob",
      targetId: job.id,
      result: {
        backupId,
        backupJobId: job.id,
        location: folderPath,
        sizeBytes: dump.length.toString(),
        sha256: dumpHash,
      },
      metadata: { fixture: "verify-missing-manifest", label },
      startedById: fixture.adminId,
      startedAt: new Date(startedAt.getTime() + 1_000),
    },
  });

  return {
    label,
    backupId,
    folderPath,
    manifestPath,
    logPath,
    job,
    operation,
    dumpHash,
    dumpSize: dump.length,
  };
}

async function createMissingDumpVerificationFixture(
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string,
  label: string
): Promise<MissingDumpVerificationFixture> {
  const manualRoot = path.join(managedRoot, "manual");
  await mkdir(manualRoot, { recursive: true });
  const folderName = `verify_missing_dump_${label}_${randomUUID().replaceAll("-", "")}`;
  const folderPath = path.resolve(manualRoot, folderName);
  assertStrictlyInsideRoot(folderPath, managedRoot);
  assert.equal(path.dirname(folderPath), manualRoot);
  await mkdir(folderPath);

  const expectedDump = Buffer.from(`verify-missing-dump-${label}-${randomUUID()}\n`, "utf8");
  const dumpHash = createHash("sha256").update(expectedDump).digest("hex");
  const dumpPath = path.join(folderPath, "database.dump");
  const manifestPath = path.join(folderPath, "manifest.json");
  const logPath = path.join(folderPath, "backup.log");
  const manifest = {
    appName: "AtlasGym",
    backupType: "manual",
    status: "succeeded",
    createdAt: new Date().toISOString(),
    databaseName: "atlasgym_backup_workflow_fixture",
    schema: "public",
    appCommit: null,
    prismaMigrationStatus: "not-run",
    fileName: "database.dump",
    sizeBytes: expectedDump.length,
    sha256: dumpHash,
    operator: "backup-workflow-integration",
    notes: null,
  };
  await Promise.all([
    writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, "utf8"),
    writeFile(logPath, "Backup workflow missing-dump fixture completed.\n", "utf8"),
  ]);
  assert.equal(await pathExists(dumpPath), false, "Missing-dump fixture must not create database.dump");

  const backupId = Buffer.from(`manual/${folderName}`, "utf8").toString("base64url");
  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - 2_000);
  const job = await runtime.prisma.backupJob.create({
    data: {
      type: runtime.BackupJobType.MANUAL,
      status: runtime.BackupStatus.COMPLETED,
      verificationStatus: runtime.BackupVerificationStatus.NOT_VERIFIED,
      startedAt,
      finishedAt,
      location: folderPath,
      backupRoot: managedRoot,
      manifestPath,
      logPath,
      sizeBytes: BigInt(expectedDump.length),
      sha256: dumpHash,
      triggeredById: fixture.adminId,
    },
  });
  const operation = await runtime.prisma.operationRun.create({
    data: {
      type: runtime.OperationRunType.SAFE_BACKUP,
      status: runtime.OperationRunStatus.RUNNING,
      step: "verifying",
      percent: 78,
      message: "Backup files were created; waiting for verification",
      targetType: "BackupJob",
      targetId: job.id,
      result: {
        backupId,
        backupJobId: job.id,
        location: folderPath,
        sizeBytes: expectedDump.length.toString(),
        sha256: dumpHash,
      },
      metadata: { fixture: "verify-missing-dump", label },
      startedById: fixture.adminId,
      startedAt: new Date(startedAt.getTime() + 1_000),
    },
  });

  return {
    label,
    backupId,
    folderPath,
    dumpPath,
    manifestPath,
    logPath,
    job,
    operation,
    dumpHash,
    dumpSize: expectedDump.length,
  };
}

async function assertFileContentsByExtension(root: string, payload: ValidImportPayload) {
  const entries = await readdir(root);
  assert.equal(entries.length, 3);
  const expectedByExtension = new Map([
    [".dump", payload.dump],
    [".json", payload.manifestBytes],
    [".log", payload.log],
  ]);
  for (const [extension, expected] of expectedByExtension) {
    const matches = entries.filter((entry) => path.extname(entry) === extension);
    assert.equal(matches.length, 1, `Expected exactly one ${extension} file in ${root}`);
    assert.deepEqual(await readFile(path.join(root, matches[0]!)), expected);
  }
}

function assertJobState(job: BackupJob, runtime: Runtime, fixture: Fixture, managedRoot: string) {
  assert.equal(job.type, runtime.BackupJobType.MANUAL);
  assert.equal(job.status, runtime.BackupStatus.FAILED);
  assert.equal(job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(job.triggeredById, fixture.adminId);
  assert.equal(job.backupRoot, managedRoot);
  assert.equal(job.errorMessage, MISSING_LOG_MESSAGE);
  assert.ok(job.finishedAt);
  assert.equal(job.location, null);
  assert.equal(job.manifestPath, null);
  assert.equal(job.logPath, null);
  assert.equal(job.scheduleFrequency, null);
  assert.equal(job.sizeBytes, null);
  assert.equal(job.sha256, null);
  assert.equal(job.verifiedAt, null);
}

function assertOperationState(operation: OperationRun, job: BackupJob, runtime: Runtime, fixture: Fixture) {
  assert.equal(operation.type, runtime.OperationRunType.IMPORT_BACKUP);
  assert.equal(operation.status, runtime.OperationRunStatus.FAILED);
  assert.equal(operation.step, "failed");
  assert.equal(operation.percent, 100);
  assert.equal(operation.message, "Backup import failed");
  assert.equal(operation.errorMessage, MISSING_LOG_MESSAGE);
  assert.equal(operation.targetType, "BackupJob");
  assert.equal(operation.targetId, job.id);
  assert.equal(operation.startedById, fixture.adminId);
  assert.ok(operation.startedAt);
  assert.ok(operation.finishedAt);
  assert.deepEqual(asJsonObject(operation.result), { backupJobId: job.id });
  assert.deepEqual(asJsonObject(operation.metadata), { fileCount: 2, sourceKind: "folder" });
}

function assertAuditAttribution(audit: AuditLog, job: BackupJob, runtime: Runtime, fixture: Fixture) {
  assert.equal(audit.actorType, runtime.AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.adminId);
  assert.equal(audit.actorRole, runtime.AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.sessionId);
  assert.equal(audit.ipAddress, "127.0.0.1");
  assert.equal(audit.userAgent, TEST_USER_AGENT);
  assert.equal(audit.targetType, "BackupJob");
  assert.equal(audit.targetId, job.id);
}

async function fixtureJobs(runtime: Runtime, fixture: Fixture) {
  return runtime.prisma.backupJob.findMany({
    where: { triggeredById: fixture.adminId },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  });
}

async function operationForJob(runtime: Runtime, fixture: Fixture, jobId: string) {
  const operations = await runtime.prisma.operationRun.findMany({
    where: {
      startedById: fixture.adminId,
      targetType: "BackupJob",
      targetId: jobId,
    },
  });
  assert.equal(operations.length, 1);
  return operations[0]!;
}

async function auditsForJob(runtime: Runtime, fixture: Fixture, jobId: string) {
  return runtime.prisma.auditLog.findMany({
    where: {
      actorId: fixture.adminId,
      targetType: "BackupJob",
      targetId: jobId,
      action: { startsWith: "backup.import." },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function verificationAuditsForJob(runtime: Runtime, fixture: Fixture, jobId: string) {
  return runtime.prisma.auditLog.findMany({
    where: {
      actorId: fixture.adminId,
      targetType: "BackupJob",
      targetId: jobId,
      action: { startsWith: "backup.verify." },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function assertFilesystemClean(managedRoot: string, uploadRoot: string) {
  assert.deepEqual(await readdir(uploadRoot), [], "Import upload root must be empty after the response");
  assert.deepEqual(await readdir(managedRoot), [], "Invalid import must not create a managed backup destination");
}

async function assertNoRunningFixtureRecords(runtime: Runtime, fixture: Fixture) {
  const [runningJobs, runningOperations] = await runtime.prisma.$transaction([
    runtime.prisma.backupJob.count({
      where: { triggeredById: fixture.adminId, status: runtime.BackupStatus.RUNNING },
    }),
    runtime.prisma.operationRun.count({
      where: { startedById: fixture.adminId, status: runtime.OperationRunStatus.RUNNING },
    }),
  ]);
  assert.equal(runningJobs, 0);
  assert.equal(runningOperations, 0);
}

function assertFailedZipJobState(
  job: BackupJob,
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string,
  errorMessage: string
) {
  assert.equal(job.type, runtime.BackupJobType.MANUAL);
  assert.equal(job.status, runtime.BackupStatus.FAILED);
  assert.equal(job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(job.triggeredById, fixture.adminId);
  assert.equal(job.backupRoot, managedRoot);
  assert.equal(job.errorMessage, errorMessage);
  assert.ok(job.finishedAt);
  assert.equal(job.location, null);
  assert.equal(job.manifestPath, null);
  assert.equal(job.logPath, null);
  assert.equal(job.scheduleFrequency, null);
  assert.equal(job.sizeBytes, null);
  assert.equal(job.sha256, null);
  assert.equal(job.verifiedAt, null);
}

function assertFailedZipOperationState(
  operation: OperationRun,
  job: BackupJob,
  runtime: Runtime,
  fixture: Fixture,
  errorMessage: string,
  metadata: Record<string, unknown>
) {
  assert.equal(operation.type, runtime.OperationRunType.IMPORT_BACKUP);
  assert.equal(operation.status, runtime.OperationRunStatus.FAILED);
  assert.equal(operation.step, "failed");
  assert.equal(operation.percent, 100);
  assert.equal(operation.message, "Backup import failed");
  assert.equal(operation.errorMessage, errorMessage);
  assert.equal(operation.targetType, "BackupJob");
  assert.equal(operation.targetId, job.id);
  assert.equal(operation.startedById, fixture.adminId);
  assert.ok(operation.startedAt);
  assert.ok(operation.finishedAt);
  assert.deepEqual(asJsonObject(operation.result), { backupJobId: job.id });
  assert.deepEqual(asJsonObject(operation.metadata), metadata);
}

function assertVerificationFailureResponse(
  result: Awaited<ReturnType<typeof sendVerifyBackup>>,
  verificationFixture: VerificationFailureFixture
) {
  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, {
    message: "Backup verification failed",
    details: {
      expectedHash: verificationFixture.expectedHash,
      actualHash: verificationFixture.actualHash,
      expectedSize: verificationFixture.expectedSize,
      actualSize: verificationFixture.actualSize,
    },
  });
  assert.ok(!JSON.stringify(result.body).includes(VERIFY_AUDIT_FAILURE_SENTINEL));
}

function assertVerificationFailedJob(
  job: BackupJob,
  verificationFixture: VerificationFailureFixture,
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string
) {
  assert.equal(job.id, verificationFixture.job.id);
  assert.equal(job.type, runtime.BackupJobType.MANUAL);
  assert.equal(job.status, runtime.BackupStatus.COMPLETED);
  assert.equal(job.verificationStatus, runtime.BackupVerificationStatus.FAILED);
  assert.equal(job.triggeredById, fixture.adminId);
  assert.equal(job.backupRoot, managedRoot);
  assert.equal(job.location, verificationFixture.folderPath);
  assert.equal(job.manifestPath, path.join(verificationFixture.folderPath, "manifest.json"));
  assert.equal(job.logPath, path.join(verificationFixture.folderPath, "backup.log"));
  assert.equal(job.scheduleFrequency, null);
  assert.equal(job.sizeBytes, BigInt(verificationFixture.actualSize));
  assert.equal(job.sha256, verificationFixture.actualHash);
  assert.equal(job.errorMessage, VERIFY_FAILURE_MESSAGE);
  assert.equal(job.verifiedAt, null, "A failed check must not record a successful verification timestamp");
  assert.equal(job.finishedAt?.getTime(), verificationFixture.job.finishedAt?.getTime());
}

function assertVerificationFailedOperation(
  operation: OperationRun,
  verificationFixture: VerificationFailureFixture,
  runtime: Runtime,
  fixture: Fixture
) {
  assert.equal(operation.id, verificationFixture.operation.id);
  assert.equal(operation.type, runtime.OperationRunType.SAFE_BACKUP);
  assert.equal(operation.status, runtime.OperationRunStatus.FAILED);
  assert.equal(operation.step, "failed");
  assert.equal(operation.percent, 100);
  assert.equal(operation.message, "Safe backup verification failed");
  assert.equal(operation.errorMessage, VERIFY_FAILURE_MESSAGE);
  assert.equal(operation.targetType, "BackupJob");
  assert.equal(operation.targetId, verificationFixture.job.id);
  assert.equal(operation.startedById, fixture.adminId);
  assert.ok(operation.startedAt);
  assert.ok(operation.finishedAt);
  assert.deepEqual(asJsonObject(operation.result), {
    backupId: verificationFixture.backupId,
    backupJobId: verificationFixture.job.id,
    location: verificationFixture.folderPath,
    expectedHash: verificationFixture.expectedHash,
    actualHash: verificationFixture.actualHash,
    expectedSize: verificationFixture.expectedSize,
    actualSize: verificationFixture.actualSize,
  });
  assert.deepEqual(asJsonObject(operation.metadata), {
    fixture: "verify-failure",
    label: verificationFixture.label,
  });
}

function assertVerificationFailureAudit(
  audit: AuditLog,
  verificationFixture: VerificationFailureFixture,
  runtime: Runtime,
  fixture: Fixture
) {
  assert.equal(audit.action, "backup.verify.failed");
  assert.equal(audit.success, false);
  assertAuditAttribution(audit, verificationFixture.job, runtime, fixture);
  assert.deepEqual(asJsonObject(audit.metadata), {
    backupId: verificationFixture.backupId,
    location: verificationFixture.folderPath,
    scheduleFrequency: null,
    expectedHash: verificationFixture.expectedHash,
    actualHash: verificationFixture.actualHash,
    expectedSize: verificationFixture.expectedSize,
    actualSize: verificationFixture.actualSize,
  });
}

function assertMissingManifestVerificationResponse(
  result: Awaited<ReturnType<typeof sendVerifyBackup>>
) {
  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, { message: MISSING_MANIFEST_MESSAGE });
  assert.ok(!JSON.stringify(result.body).includes(VERIFY_AUDIT_FAILURE_SENTINEL));
}

function assertMissingDumpVerificationResponse(
  result: Awaited<ReturnType<typeof sendVerifyBackup>>
) {
  assert.equal(result.response.status, 409);
  assert.deepEqual(result.body, { message: MISSING_DUMP_MESSAGE });
  assert.ok(!JSON.stringify(result.body).includes(VERIFY_AUDIT_FAILURE_SENTINEL));
}

function assertMissingArtifactVerificationJob(
  job: BackupJob,
  missingArtifactFixture: MissingVerificationArtifactFixture,
  runtime: Runtime,
  fixture: Fixture,
  managedRoot: string,
  errorMessage: string
) {
  assert.equal(job.id, missingArtifactFixture.job.id);
  assert.equal(job.type, runtime.BackupJobType.MANUAL);
  assert.equal(job.status, runtime.BackupStatus.COMPLETED);
  assert.equal(job.verificationStatus, runtime.BackupVerificationStatus.FAILED);
  assert.equal(job.triggeredById, fixture.adminId);
  assert.equal(job.backupRoot, managedRoot);
  assert.equal(job.location, missingArtifactFixture.folderPath);
  assert.equal(job.manifestPath, missingArtifactFixture.manifestPath);
  assert.equal(job.logPath, missingArtifactFixture.logPath);
  assert.equal(job.scheduleFrequency, null);
  assert.equal(job.sizeBytes, BigInt(missingArtifactFixture.dumpSize));
  assert.equal(job.sha256, missingArtifactFixture.dumpHash);
  assert.equal(job.errorMessage, errorMessage);
  assert.equal(job.verifiedAt, null);
  assert.equal(job.finishedAt?.getTime(), missingArtifactFixture.job.finishedAt?.getTime());
}

function assertMissingArtifactVerificationOperation(
  operation: OperationRun,
  missingArtifactFixture: MissingVerificationArtifactFixture,
  runtime: Runtime,
  fixture: Fixture,
  errorMessage: string,
  metadataFixture: string
) {
  assert.equal(operation.id, missingArtifactFixture.operation.id);
  assert.equal(operation.type, runtime.OperationRunType.SAFE_BACKUP);
  assert.equal(operation.status, runtime.OperationRunStatus.FAILED);
  assert.equal(operation.step, "failed");
  assert.equal(operation.percent, 100);
  assert.equal(operation.message, "Safe backup verification failed");
  assert.equal(operation.errorMessage, errorMessage);
  assert.equal(operation.targetType, "BackupJob");
  assert.equal(operation.targetId, missingArtifactFixture.job.id);
  assert.equal(operation.startedById, fixture.adminId);
  assert.ok(operation.startedAt);
  assert.ok(operation.finishedAt);
  assert.deepEqual(asJsonObject(operation.result), {
    backupId: missingArtifactFixture.backupId,
    backupJobId: missingArtifactFixture.job.id,
    location: missingArtifactFixture.folderPath,
    errorMessage,
  });
  assert.deepEqual(asJsonObject(operation.metadata), {
    fixture: metadataFixture,
    label: missingArtifactFixture.label,
  });
}

function assertMissingArtifactVerificationAudit(
  audit: AuditLog,
  missingArtifactFixture: MissingVerificationArtifactFixture,
  runtime: Runtime,
  fixture: Fixture,
  errorMessage: string
) {
  assert.equal(audit.action, "backup.verify.failed");
  assert.equal(audit.success, false);
  assertAuditAttribution(audit, missingArtifactFixture.job, runtime, fixture);
  assert.deepEqual(asJsonObject(audit.metadata), {
    backupId: missingArtifactFixture.backupId,
    location: missingArtifactFixture.folderPath,
    scheduleFrequency: null,
    errorMessage,
  });
}

async function testInvalidImportPersistence(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  assertMissingLogResponse(await sendMissingLogImport(baseUrl, fixture, authCookieName));

  const jobs = await fixtureJobs(runtime, fixture);
  assert.equal(jobs.length, 1);
  const job = jobs[0]!;
  assertJobState(job, runtime, fixture, managedRoot);

  const operation = await operationForJob(runtime, fixture, job.id);
  assertOperationState(operation, job, runtime, fixture);

  const audits = await auditsForJob(runtime, fixture, job.id);
  assert.equal(audits.length, 2);
  const startAudit = audits.find((audit) => audit.action === "backup.import.start");
  const failedAudit = audits.find((audit) => audit.action === "backup.import.failed");
  assert.ok(startAudit);
  assert.ok(failedAudit);
  assert.equal(startAudit.success, true);
  assert.equal(failedAudit.success, false);
  assertAuditAttribution(startAudit, job, runtime, fixture);
  assertAuditAttribution(failedAudit, job, runtime, fixture);
  assert.deepEqual(asJsonObject(startAudit.metadata), {
    fileCount: 2,
    originalNames: ["database.dump", "manifest.json"],
  });
  assert.deepEqual(asJsonObject(failedAudit.metadata), { errorMessage: MISSING_LOG_MESSAGE });
  assert.ok(!JSON.stringify(audits.map((audit) => audit.metadata)).includes(uploadRoot));

  await assertFilesystemClean(managedRoot, uploadRoot);
  await assertNoRunningFixtureRecords(runtime, fixture);

  assertMissingLogResponse(await sendMissingLogImport(baseUrl, fixture, authCookieName));
  assert.equal((await fixtureJobs(runtime, fixture)).length, 2, "A retry must start instead of returning the stale-lock 409");
  await assertFilesystemClean(managedRoot, uploadRoot);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testFailureAuditIsolation(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let injectedFailures = 0;
  let result: Awaited<ReturnType<typeof sendMissingLogImport>>;

  mutableAudit.create = async (args) => {
    if (args.data.actorId === fixture.adminId && args.data.action === "backup.import.failed") {
      injectedFailures += 1;
      throw new Error(AUDIT_FAILURE_SENTINEL);
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendMissingLogImport(baseUrl, fixture, authCookieName);
  } finally {
    mutableAudit.create = originalCreate;
  }

  assert.equal(mutableAudit.create, originalCreate, "AuditLog fault injection must be restored exactly");
  assert.equal(injectedFailures, 1);
  assertMissingLogResponse(result);

  const jobs = await fixtureJobs(runtime, fixture);
  assert.equal(jobs.length, 3);
  const job = jobs[2]!;
  assertJobState(job, runtime, fixture, managedRoot);
  assertOperationState(await operationForJob(runtime, fixture, job.id), job, runtime, fixture);

  const audits = await auditsForJob(runtime, fixture, job.id);
  assert.equal(audits.length, 1);
  assert.equal(audits[0]?.action, "backup.import.start");
  assert.equal(audits[0]?.success, true);
  assertAuditAttribution(audits[0]!, job, runtime, fixture);

  await assertFilesystemClean(managedRoot, uploadRoot);
  await assertNoRunningFixtureRecords(runtime, fixture);

  assertMissingLogResponse(await sendMissingLogImport(baseUrl, fixture, authCookieName));
  const retriedJobs = await fixtureJobs(runtime, fixture);
  assert.equal(retriedJobs.length, 4, "Audit failure must not leave the import lock active");
  assert.equal(injectedFailures, 1, "The restored AuditLog writer must handle the retry normally");
  const retryAudits = await auditsForJob(runtime, fixture, retriedJobs[3]!.id);
  assert.deepEqual(
    retryAudits.map((audit) => [audit.action, audit.success]).sort(([left], [right]) => String(left).localeCompare(String(right))),
    [
      ["backup.import.failed", false],
      ["backup.import.start", true],
    ]
  );
  await assertFilesystemClean(managedRoot, uploadRoot);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testPopulatedDestinationRollback(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const payload = createValidImportPayload();
  const manualRoot = path.join(managedRoot, "manual");
  await mkdir(manualRoot, { recursive: true });
  assert.deepEqual(await readdir(managedRoot), ["manual"]);
  assert.deepEqual(await readdir(manualRoot), []);

  const jobsBefore = await fixtureJobs(runtime, fixture);
  const existingJobIds = new Set(jobsBefore.map((job) => job.id));
  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let injectedFailures = 0;
  let capturedDestination: string | null = null;
  let capturedJobId: string | null = null;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendValidImport>>;

  mutableAudit.create = async (args) => {
    if (args.data.actorId === fixture.adminId && args.data.action === "backup.import.success") {
      try {
        const metadata = asJsonObject(args.data.metadata);
        const destination = metadata["location"];
        if (typeof destination !== "string") throw new Error("Success audit did not contain a destination path");
        assertStrictlyInsideRoot(destination, managedRoot);
        assert.equal(path.dirname(destination), manualRoot);
        assert.match(path.basename(destination), /^imported_/u);
        assert.equal((await stat(destination)).isDirectory(), true);
        assert.deepEqual((await readdir(destination)).sort(), ["backup.log", "database.dump", "manifest.json"]);
        assert.deepEqual(await readFile(path.join(destination, "database.dump")), payload.dump);
        assert.deepEqual(await readFile(path.join(destination, "manifest.json")), payload.manifestBytes);
        assert.deepEqual(await readFile(path.join(destination, "backup.log")), payload.log);
        assert.deepEqual(JSON.parse((await readFile(path.join(destination, "manifest.json"), "utf8")).trim()), payload.manifest);
        await assertFileContentsByExtension(uploadRoot, payload);

        const targetId = args.data.targetId;
        if (typeof targetId !== "string") throw new Error("Success audit did not contain a BackupJob target");
        const registeredJob = await runtime.prisma.backupJob.findUnique({ where: { id: targetId } });
        assert.ok(registeredJob);
        assert.equal(registeredJob.status, runtime.BackupStatus.COMPLETED);
        assert.equal(registeredJob.verificationStatus, runtime.BackupVerificationStatus.VERIFIED);
        assert.equal(registeredJob.location, destination);
        assert.equal(registeredJob.manifestPath, path.join(destination, "manifest.json"));
        assert.equal(registeredJob.logPath, path.join(destination, "backup.log"));
        assert.equal(registeredJob.sizeBytes, BigInt(payload.dump.length));
        assert.equal(registeredJob.sha256, payload.manifest["sha256"]);

        capturedDestination = destination;
        capturedJobId = targetId;
        injectedFailures += 1;
      } catch (error) {
        observationError = error;
        throw error;
      }
      throw new Error(SUCCESS_AUDIT_FAILURE_SENTINEL);
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendValidImport(baseUrl, fixture, authCookieName, payload);
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Success AuditLog fault injection must be restored exactly");
  assert.equal(injectedFailures, 1);
  assert.ok(capturedDestination);
  assert.ok(capturedJobId);
  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, { message: SAFE_IMPORT_FAILURE_MESSAGE });
  assert.ok(!JSON.stringify(result.body).includes(SUCCESS_AUDIT_FAILURE_SENTINEL));
  assert.ok(!JSON.stringify(result.body).includes(capturedDestination));

  const jobsAfter = await fixtureJobs(runtime, fixture);
  assert.equal(jobsAfter.length, jobsBefore.length + 1);
  const job = jobsAfter.find((candidate) => candidate.id === capturedJobId);
  assert.ok(job);
  assert.equal(existingJobIds.has(job.id), false);
  assert.equal(job.type, runtime.BackupJobType.MANUAL);
  assert.equal(job.status, runtime.BackupStatus.FAILED);
  assert.equal(job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(job.triggeredById, fixture.adminId);
  assert.equal(job.backupRoot, managedRoot);
  assert.equal(job.errorMessage, SUCCESS_AUDIT_FAILURE_SENTINEL);
  assert.ok(job.finishedAt);
  assert.equal(job.location, null);
  assert.equal(job.manifestPath, null);
  assert.equal(job.logPath, null);
  assert.equal(job.scheduleFrequency, null);
  assert.equal(job.sizeBytes, null);
  assert.equal(job.sha256, null);
  assert.equal(job.verifiedAt, null);

  const operation = await operationForJob(runtime, fixture, job.id);
  assert.equal(operation.type, runtime.OperationRunType.IMPORT_BACKUP);
  assert.equal(operation.status, runtime.OperationRunStatus.FAILED);
  assert.equal(operation.step, "failed");
  assert.equal(operation.percent, 100);
  assert.equal(operation.message, "Backup import failed");
  assert.equal(operation.errorMessage, SUCCESS_AUDIT_FAILURE_SENTINEL);
  assert.equal(operation.targetType, "BackupJob");
  assert.equal(operation.targetId, job.id);
  assert.equal(operation.startedById, fixture.adminId);
  assert.ok(operation.startedAt);
  assert.ok(operation.finishedAt);
  assert.deepEqual(asJsonObject(operation.result), { backupJobId: job.id });
  assert.deepEqual(asJsonObject(operation.metadata), { fileCount: 3, sourceKind: "folder" });

  const audits = await auditsForJob(runtime, fixture, job.id);
  assert.equal(audits.length, 2);
  const startAudit = audits.find((audit) => audit.action === "backup.import.start");
  const failedAudit = audits.find((audit) => audit.action === "backup.import.failed");
  assert.ok(startAudit);
  assert.ok(failedAudit);
  assert.equal(startAudit.success, true);
  assert.equal(failedAudit.success, false);
  assertAuditAttribution(startAudit, job, runtime, fixture);
  assertAuditAttribution(failedAudit, job, runtime, fixture);
  assert.deepEqual(asJsonObject(startAudit.metadata), {
    fileCount: 3,
    originalNames: ["database.dump", "manifest.json", "backup.log"],
  });
  assert.deepEqual(asJsonObject(failedAudit.metadata), { errorMessage: SUCCESS_AUDIT_FAILURE_SENTINEL });
  assert.equal(audits.some((audit) => audit.action === "backup.import.success"), false);

  assert.equal(await pathExists(capturedDestination), false);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.deepEqual(await readdir(managedRoot), ["manual"]);
  assert.deepEqual(await readdir(manualRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);

  assertMissingLogResponse(await sendMissingLogImport(baseUrl, fixture, authCookieName));
  const jobsAfterRetry = await fixtureJobs(runtime, fixture);
  assert.equal(jobsAfterRetry.length, jobsBefore.length + 2, "Destination rollback must release the import lock");
  assert.equal(injectedFailures, 1, "The restored success AuditLog writer must not affect the retry");
  const retryJob = jobsAfterRetry.find((candidate) => !existingJobIds.has(candidate.id) && candidate.id !== job.id);
  assert.ok(retryJob);
  const retryAudits = await auditsForJob(runtime, fixture, retryJob.id);
  assert.deepEqual(
    retryAudits.map((audit) => [audit.action, audit.success]).sort(([left], [right]) => String(left).localeCompare(String(right))),
    [
      ["backup.import.failed", false],
      ["backup.import.start", true],
    ]
  );
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.deepEqual(await readdir(manualRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testIncompleteZipExtractionCleanup(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const archive = createIncompleteZipFixture();
  const extractionBaseline = await listZipExtractionDirectories();
  const extractionBaselineSet = new Set(extractionBaseline);
  const managedBaseline = await snapshotTree(managedRoot);
  const jobsBefore = await fixtureJobs(runtime, fixture);
  const existingJobIds = new Set(jobsBefore.map((job) => job.id));
  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let capturedExtractionDir: string | null = null;
  let capturedJobId: string | null = null;
  let observedFailureAudit = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendZipImport>>;

  mutableAudit.create = async (args) => {
    if (args.data.actorId === fixture.adminId && args.data.action === "backup.import.failed") {
      const metadata = asJsonObject(args.data.metadata);
      if (metadata["errorMessage"] === MISSING_LOG_MESSAGE) {
        try {
          const currentExtractionDirs = await listZipExtractionDirectories();
          const newExtractionDirs = currentExtractionDirs.filter((directory) => !extractionBaselineSet.has(directory));
          assert.equal(newExtractionDirs.length, 1);
          const extractionDir = newExtractionDirs[0]!;
          assertSafeZipExtractionPath(extractionDir);
          assert.equal((await stat(extractionDir)).isDirectory(), true);
          assert.deepEqual((await readdir(extractionDir)).sort(), ["database.dump", "manifest.json"]);
          assert.deepEqual(await readFile(path.join(extractionDir, "database.dump")), INCOMPLETE_ZIP_DUMP);
          assert.deepEqual(await readFile(path.join(extractionDir, "manifest.json")), INCOMPLETE_ZIP_MANIFEST);

          const uploadEntries = await readdir(uploadRoot);
          assert.equal(uploadEntries.length, 1);
          assert.equal(path.extname(uploadEntries[0]!), ".zip");
          assert.deepEqual(await readFile(path.join(uploadRoot, uploadEntries[0]!)), archive);

          const targetId = args.data.targetId;
          if (typeof targetId !== "string") throw new Error("ZIP failure audit did not contain a BackupJob target");
          capturedExtractionDir = extractionDir;
          capturedJobId = targetId;
          observedFailureAudit += 1;
        } catch (error) {
          observationError = error;
          throw error;
        }
      }
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendZipImport(baseUrl, fixture, authCookieName, archive, "incomplete-backup.zip");
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "ZIP failure-audit observer must be restored exactly");
  assert.equal(observedFailureAudit, 1);
  if (!capturedExtractionDir || !capturedJobId) throw new Error("Incomplete ZIP extraction was not observed");
  assert.equal(result.response.status, 400);
  assert.deepEqual(result.body, { message: MISSING_LOG_MESSAGE });

  const jobsAfter = await fixtureJobs(runtime, fixture);
  assert.equal(jobsAfter.length, jobsBefore.length + 1);
  const job = jobsAfter.find((candidate) => candidate.id === capturedJobId);
  assert.ok(job);
  assert.equal(existingJobIds.has(job.id), false);
  assertFailedZipJobState(job, runtime, fixture, managedRoot, MISSING_LOG_MESSAGE);
  assertFailedZipOperationState(
    await operationForJob(runtime, fixture, job.id),
    job,
    runtime,
    fixture,
    MISSING_LOG_MESSAGE,
    { fileCount: 2, sourceKind: "zip" }
  );

  const audits = await auditsForJob(runtime, fixture, job.id);
  assert.equal(audits.length, 2);
  const startAudit = audits.find((audit) => audit.action === "backup.import.start");
  const failedAudit = audits.find((audit) => audit.action === "backup.import.failed");
  assert.ok(startAudit);
  assert.ok(failedAudit);
  assert.equal(startAudit.success, true);
  assert.equal(failedAudit.success, false);
  assertAuditAttribution(startAudit, job, runtime, fixture);
  assertAuditAttribution(failedAudit, job, runtime, fixture);
  assert.deepEqual(asJsonObject(startAudit.metadata), {
    fileCount: 1,
    originalNames: ["incomplete-backup.zip"],
  });
  assert.deepEqual(asJsonObject(failedAudit.metadata), { errorMessage: MISSING_LOG_MESSAGE });
  assert.equal(audits.some((audit) => audit.action === "backup.import.success"), false);

  assert.equal(await pathExists(capturedExtractionDir), false);
  assert.deepEqual(await listZipExtractionDirectories(), extractionBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testCorruptZipExtractionCleanup(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const archive = createCorruptZipFixture();
  const extractionBaseline = await listZipExtractionDirectories();
  const managedBaseline = await snapshotTree(managedRoot);
  const jobsBefore = await fixtureJobs(runtime, fixture);
  const existingJobIds = new Set(jobsBefore.map((job) => job.id));
  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let capturedJobId: string | null = null;
  let internalErrorMessage: string | null = null;
  let observedFailureAudit = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendZipImport>>;

  mutableAudit.create = async (args) => {
    if (args.data.actorId === fixture.adminId && args.data.action === "backup.import.failed") {
      try {
        const metadata = asJsonObject(args.data.metadata);
        const errorMessage = metadata["errorMessage"];
        if (typeof errorMessage !== "string") throw new Error("Corrupt ZIP audit did not contain an error message");
        assert.match(errorMessage, /^Backup ZIP import failed\.\s+\S/u);
        assert.doesNotMatch(errorMessage, /(?:timed out|with exit code)/u);
        assert.ok(!errorMessage.includes(process.env["DATABASE_URL"] ?? "unreachable-database-url"));
        assert.deepEqual(await listZipExtractionDirectories(), extractionBaseline);

        const uploadEntries = await readdir(uploadRoot);
        assert.equal(uploadEntries.length, 1);
        assert.equal(path.extname(uploadEntries[0]!), ".zip");
        assert.deepEqual(await readFile(path.join(uploadRoot, uploadEntries[0]!)), archive);

        const targetId = args.data.targetId;
        if (typeof targetId !== "string") throw new Error("Corrupt ZIP audit did not contain a BackupJob target");
        capturedJobId = targetId;
        internalErrorMessage = errorMessage;
        observedFailureAudit += 1;
      } catch (error) {
        observationError = error;
        throw error;
      }
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendZipImport(baseUrl, fixture, authCookieName, archive, "corrupt-backup.zip");
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Corrupt ZIP failure-audit observer must be restored exactly");
  assert.equal(observedFailureAudit, 1);
  if (!capturedJobId || !internalErrorMessage) throw new Error("Corrupt ZIP failure was not observed");
  assert.equal(result.response.status, 500);
  assert.deepEqual(result.body, { message: SAFE_IMPORT_FAILURE_MESSAGE });
  assert.ok(!JSON.stringify(result.body).includes(internalErrorMessage));

  const jobsAfter = await fixtureJobs(runtime, fixture);
  assert.equal(jobsAfter.length, jobsBefore.length + 1);
  const job = jobsAfter.find((candidate) => candidate.id === capturedJobId);
  assert.ok(job);
  assert.equal(existingJobIds.has(job.id), false);
  assertFailedZipJobState(job, runtime, fixture, managedRoot, internalErrorMessage);
  assertFailedZipOperationState(
    await operationForJob(runtime, fixture, job.id),
    job,
    runtime,
    fixture,
    internalErrorMessage,
    { fileCount: 1, originalNames: ["corrupt-backup.zip"] }
  );

  const audits = await auditsForJob(runtime, fixture, job.id);
  assert.equal(audits.length, 2);
  const startAudit = audits.find((audit) => audit.action === "backup.import.start");
  const failedAudit = audits.find((audit) => audit.action === "backup.import.failed");
  assert.ok(startAudit);
  assert.ok(failedAudit);
  assert.equal(startAudit.success, true);
  assert.equal(failedAudit.success, false);
  assertAuditAttribution(startAudit, job, runtime, fixture);
  assertAuditAttribution(failedAudit, job, runtime, fixture);
  assert.deepEqual(asJsonObject(startAudit.metadata), {
    fileCount: 1,
    originalNames: ["corrupt-backup.zip"],
  });
  assert.deepEqual(asJsonObject(failedAudit.metadata), { errorMessage: internalErrorMessage });
  assert.equal(audits.some((audit) => audit.action === "backup.import.success"), false);

  assert.deepEqual(await listZipExtractionDirectories(), extractionBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  await assertNoRunningFixtureRecords(runtime, fixture);

  assertMissingLogResponse(await sendMissingLogImport(baseUrl, fixture, authCookieName));
  const jobsAfterRetry = await fixtureJobs(runtime, fixture);
  assert.equal(jobsAfterRetry.length, jobsBefore.length + 2, "Corrupt ZIP failure must release the import lock");
  const retryJob = jobsAfterRetry.find((candidate) => !existingJobIds.has(candidate.id) && candidate.id !== job.id);
  assert.ok(retryJob);
  const retryAudits = await auditsForJob(runtime, fixture, retryJob.id);
  assert.deepEqual(
    retryAudits.map((audit) => [audit.action, audit.success]).sort(([left], [right]) => String(left).localeCompare(String(right))),
    [
      ["backup.import.failed", false],
      ["backup.import.start", true],
    ]
  );
  assert.equal(observedFailureAudit, 1, "The restored audit writer must handle the retry normally");
  assert.deepEqual(await listZipExtractionDirectories(), extractionBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testVerificationMismatchPersistence(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const verificationFixture = await createVerificationFailureFixture(
    runtime,
    fixture,
    managedRoot,
    "persisted"
  );
  const managedBaseline = await snapshotTree(managedRoot);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.equal(verificationFixture.job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(verificationFixture.job.verifiedAt, null);
  assert.equal(verificationFixture.operation.status, runtime.OperationRunStatus.RUNNING);
  assert.equal(verificationFixture.operation.step, "verifying");
  assert.equal(verificationFixture.operation.percent, 78);
  assert.deepEqual(await verificationAuditsForJob(runtime, fixture, verificationFixture.job.id), []);

  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let observedFailureAudit = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendVerifyBackup>>;

  mutableAudit.create = async (args) => {
    if (
      args.data.actorId === fixture.adminId &&
      args.data.targetId === verificationFixture.job.id &&
      args.data.action === "backup.verify.failed"
    ) {
      try {
        const [job, operation] = await Promise.all([
          runtime.prisma.backupJob.findUnique({ where: { id: verificationFixture.job.id } }),
          runtime.prisma.operationRun.findUnique({ where: { id: verificationFixture.operation.id } }),
        ]);
        assert.ok(job);
        assert.ok(operation);
        assertVerificationFailedJob(job, verificationFixture, runtime, fixture, managedRoot);
        assertVerificationFailedOperation(operation, verificationFixture, runtime, fixture);
        assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
        assert.deepEqual(await readdir(uploadRoot), []);
        observedFailureAudit += 1;
      } catch (error) {
        observationError = error;
        throw error;
      }
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendVerifyBackup(baseUrl, fixture, authCookieName, verificationFixture.backupId);
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Verify AuditLog observer must be restored exactly");
  assert.equal(observedFailureAudit, 1);
  assertVerificationFailureResponse(result, verificationFixture);

  const [job, operation, audits] = await Promise.all([
    runtime.prisma.backupJob.findUnique({ where: { id: verificationFixture.job.id } }),
    runtime.prisma.operationRun.findUnique({ where: { id: verificationFixture.operation.id } }),
    verificationAuditsForJob(runtime, fixture, verificationFixture.job.id),
  ]);
  assert.ok(job);
  assert.ok(operation);
  assertVerificationFailedJob(job, verificationFixture, runtime, fixture, managedRoot);
  assertVerificationFailedOperation(operation, verificationFixture, runtime, fixture);
  assert.equal(audits.length, 1);
  assertVerificationFailureAudit(audits[0]!, verificationFixture, runtime, fixture);
  assert.equal(audits.some((audit) => audit.action === "backup.verify.success"), false);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testVerificationFailureAuditIsolation(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const verificationFixture = await createVerificationFailureFixture(
    runtime,
    fixture,
    managedRoot,
    "audit_isolation"
  );
  const managedBaseline = await snapshotTree(managedRoot);
  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let injectedFailures = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendVerifyBackup>>;

  mutableAudit.create = async (args) => {
    if (
      args.data.actorId === fixture.adminId &&
      args.data.targetId === verificationFixture.job.id &&
      args.data.action === "backup.verify.failed"
    ) {
      try {
        const [job, operation] = await Promise.all([
          runtime.prisma.backupJob.findUnique({ where: { id: verificationFixture.job.id } }),
          runtime.prisma.operationRun.findUnique({ where: { id: verificationFixture.operation.id } }),
        ]);
        assert.ok(job);
        assert.ok(operation);
        assertVerificationFailedJob(job, verificationFixture, runtime, fixture, managedRoot);
        assertVerificationFailedOperation(operation, verificationFixture, runtime, fixture);
        assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
        assert.deepEqual(await readdir(uploadRoot), []);
      } catch (error) {
        observationError = error;
        throw error;
      }
      injectedFailures += 1;
      throw new Error(VERIFY_AUDIT_FAILURE_SENTINEL);
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendVerifyBackup(baseUrl, fixture, authCookieName, verificationFixture.backupId);
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Verify AuditLog fault injection must be restored exactly");
  assert.equal(injectedFailures, 1);
  assertVerificationFailureResponse(result, verificationFixture);
  assert.deepEqual(await verificationAuditsForJob(runtime, fixture, verificationFixture.job.id), []);

  const [jobAfterFailure, operationAfterFailure] = await Promise.all([
    runtime.prisma.backupJob.findUnique({ where: { id: verificationFixture.job.id } }),
    runtime.prisma.operationRun.findUnique({ where: { id: verificationFixture.operation.id } }),
  ]);
  assert.ok(jobAfterFailure);
  assert.ok(operationAfterFailure);
  assertVerificationFailedJob(jobAfterFailure, verificationFixture, runtime, fixture, managedRoot);
  assertVerificationFailedOperation(operationAfterFailure, verificationFixture, runtime, fixture);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);

  const retry = await sendVerifyBackup(baseUrl, fixture, authCookieName, verificationFixture.backupId);
  assertVerificationFailureResponse(retry, verificationFixture);
  assert.equal(injectedFailures, 1, "The restored Verify AuditLog writer must handle the retry normally");
  const retryAudits = await verificationAuditsForJob(runtime, fixture, verificationFixture.job.id);
  assert.equal(retryAudits.length, 1);
  assertVerificationFailureAudit(retryAudits[0]!, verificationFixture, runtime, fixture);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  assert.deepEqual(await readdir(uploadRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testMissingManifestVerificationPersistence(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const missingManifestFixture = await createMissingManifestVerificationFixture(
    runtime,
    fixture,
    managedRoot,
    "persisted"
  );
  const managedBaseline = await snapshotTree(managedRoot);
  assert.deepEqual((await readdir(missingManifestFixture.folderPath)).sort(), ["backup.log", "database.dump"]);
  assert.equal(await pathExists(missingManifestFixture.manifestPath), false);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.equal(missingManifestFixture.job.status, runtime.BackupStatus.COMPLETED);
  assert.equal(missingManifestFixture.job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(missingManifestFixture.job.verifiedAt, null);
  assert.equal(missingManifestFixture.job.errorMessage, null);
  assert.equal(missingManifestFixture.operation.status, runtime.OperationRunStatus.RUNNING);
  assert.equal(missingManifestFixture.operation.step, "verifying");
  assert.equal(missingManifestFixture.operation.percent, 78);
  assert.deepEqual(await verificationAuditsForJob(runtime, fixture, missingManifestFixture.job.id), []);

  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let observedFailureAudit = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendVerifyBackup>>;

  mutableAudit.create = async (args) => {
    if (
      args.data.actorId === fixture.adminId &&
      args.data.targetId === missingManifestFixture.job.id &&
      args.data.action === "backup.verify.failed"
    ) {
      try {
        const [job, operation] = await Promise.all([
          runtime.prisma.backupJob.findUnique({ where: { id: missingManifestFixture.job.id } }),
          runtime.prisma.operationRun.findUnique({ where: { id: missingManifestFixture.operation.id } }),
        ]);
        assert.ok(job);
        assert.ok(operation);
        assertMissingArtifactVerificationJob(
          job,
          missingManifestFixture,
          runtime,
          fixture,
          managedRoot,
          MISSING_MANIFEST_MESSAGE
        );
        assertMissingArtifactVerificationOperation(
          operation,
          missingManifestFixture,
          runtime,
          fixture,
          MISSING_MANIFEST_MESSAGE,
          "verify-missing-manifest"
        );
        assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
        assert.equal(await pathExists(missingManifestFixture.manifestPath), false);
        assert.deepEqual(await readdir(uploadRoot), []);
        observedFailureAudit += 1;
      } catch (error) {
        observationError = error;
        throw error;
      }
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendVerifyBackup(baseUrl, fixture, authCookieName, missingManifestFixture.backupId);
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Missing-manifest AuditLog observer must be restored exactly");
  assert.equal(observedFailureAudit, 1);
  assertMissingManifestVerificationResponse(result);

  const [job, operation, audits] = await Promise.all([
    runtime.prisma.backupJob.findUnique({ where: { id: missingManifestFixture.job.id } }),
    runtime.prisma.operationRun.findUnique({ where: { id: missingManifestFixture.operation.id } }),
    verificationAuditsForJob(runtime, fixture, missingManifestFixture.job.id),
  ]);
  assert.ok(job);
  assert.ok(operation);
  assertMissingArtifactVerificationJob(
    job,
    missingManifestFixture,
    runtime,
    fixture,
    managedRoot,
    MISSING_MANIFEST_MESSAGE
  );
  assertMissingArtifactVerificationOperation(
    operation,
    missingManifestFixture,
    runtime,
    fixture,
    MISSING_MANIFEST_MESSAGE,
    "verify-missing-manifest"
  );
  assert.equal(audits.length, 1);
  assertMissingArtifactVerificationAudit(
    audits[0]!,
    missingManifestFixture,
    runtime,
    fixture,
    MISSING_MANIFEST_MESSAGE
  );
  assert.equal(audits.some((audit) => audit.action === "backup.verify.success"), false);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  assert.equal(await pathExists(missingManifestFixture.manifestPath), false);
  assert.deepEqual(await readdir(uploadRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function testMissingDumpVerificationPersistence(
  baseUrl: string,
  runtime: Runtime,
  fixture: Fixture,
  authCookieName: string,
  managedRoot: string,
  uploadRoot: string
) {
  const missingDumpFixture = await createMissingDumpVerificationFixture(
    runtime,
    fixture,
    managedRoot,
    "persisted"
  );
  const managedBaseline = await snapshotTree(managedRoot);
  assert.deepEqual((await readdir(missingDumpFixture.folderPath)).sort(), ["backup.log", "manifest.json"]);
  assert.equal(await pathExists(missingDumpFixture.manifestPath), true);
  assert.equal(await pathExists(missingDumpFixture.dumpPath), false);
  assert.deepEqual(await readdir(uploadRoot), []);
  assert.equal(missingDumpFixture.job.status, runtime.BackupStatus.COMPLETED);
  assert.equal(missingDumpFixture.job.verificationStatus, runtime.BackupVerificationStatus.NOT_VERIFIED);
  assert.equal(missingDumpFixture.job.verifiedAt, null);
  assert.equal(missingDumpFixture.job.errorMessage, null);
  assert.equal(missingDumpFixture.operation.status, runtime.OperationRunStatus.RUNNING);
  assert.equal(missingDumpFixture.operation.step, "verifying");
  assert.equal(missingDumpFixture.operation.percent, 78);
  assert.deepEqual(await verificationAuditsForJob(runtime, fixture, missingDumpFixture.job.id), []);

  const mutableAudit = runtime.prisma.auditLog as unknown as MutableAuditDelegate;
  const originalCreate = mutableAudit.create;
  let observedFailureAudit = 0;
  let observationError: unknown = null;
  let result: Awaited<ReturnType<typeof sendVerifyBackup>>;

  mutableAudit.create = async (args) => {
    if (
      args.data.actorId === fixture.adminId &&
      args.data.targetId === missingDumpFixture.job.id &&
      args.data.action === "backup.verify.failed"
    ) {
      try {
        const [job, operation] = await Promise.all([
          runtime.prisma.backupJob.findUnique({ where: { id: missingDumpFixture.job.id } }),
          runtime.prisma.operationRun.findUnique({ where: { id: missingDumpFixture.operation.id } }),
        ]);
        assert.ok(job);
        assert.ok(operation);
        assertMissingArtifactVerificationJob(
          job,
          missingDumpFixture,
          runtime,
          fixture,
          managedRoot,
          MISSING_DUMP_MESSAGE
        );
        assertMissingArtifactVerificationOperation(
          operation,
          missingDumpFixture,
          runtime,
          fixture,
          MISSING_DUMP_MESSAGE,
          "verify-missing-dump"
        );
        assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
        assert.equal(await pathExists(missingDumpFixture.manifestPath), true);
        assert.equal(await pathExists(missingDumpFixture.dumpPath), false);
        assert.deepEqual(await readdir(uploadRoot), []);
        observedFailureAudit += 1;
      } catch (error) {
        observationError = error;
        throw error;
      }
    }
    return originalCreate.call(runtime.prisma.auditLog, args);
  };
  try {
    result = await sendVerifyBackup(baseUrl, fixture, authCookieName, missingDumpFixture.backupId);
  } finally {
    mutableAudit.create = originalCreate;
  }

  if (observationError) throw observationError;
  assert.equal(mutableAudit.create, originalCreate, "Missing-dump AuditLog observer must be restored exactly");
  assert.equal(observedFailureAudit, 1);
  assertMissingDumpVerificationResponse(result);

  const [job, operation, audits] = await Promise.all([
    runtime.prisma.backupJob.findUnique({ where: { id: missingDumpFixture.job.id } }),
    runtime.prisma.operationRun.findUnique({ where: { id: missingDumpFixture.operation.id } }),
    verificationAuditsForJob(runtime, fixture, missingDumpFixture.job.id),
  ]);
  assert.ok(job);
  assert.ok(operation);
  assertMissingArtifactVerificationJob(
    job,
    missingDumpFixture,
    runtime,
    fixture,
    managedRoot,
    MISSING_DUMP_MESSAGE
  );
  assertMissingArtifactVerificationOperation(
    operation,
    missingDumpFixture,
    runtime,
    fixture,
    MISSING_DUMP_MESSAGE,
    "verify-missing-dump"
  );
  assert.equal(audits.length, 1);
  assertMissingArtifactVerificationAudit(audits[0]!, missingDumpFixture, runtime, fixture, MISSING_DUMP_MESSAGE);
  assert.equal(audits.some((audit) => audit.action === "backup.verify.success"), false);
  assert.deepEqual(await snapshotTree(managedRoot), managedBaseline);
  assert.equal(await pathExists(missingDumpFixture.manifestPath), true);
  assert.equal(await pathExists(missingDumpFixture.dumpPath), false);
  assert.deepEqual(await readdir(uploadRoot), []);
  await assertNoRunningFixtureRecords(runtime, fixture);
}

async function run() {
  assertSafeWorkerEnvironment();
  const zipExtractionBaseline = await listZipExtractionDirectories();
  const { managedRoot, uploadRoot } = await createTemporaryRoots();
  process.env["ATLASGYM_BACKUP_ROOT"] = managedRoot;

  let server: ReturnType<typeof createServer> | null = null;
  let runtime: Awaited<ReturnType<typeof loadRuntime>> | null = null;
  const cleanupHandles: { prisma: PrismaClient | null } = { prisma: null };
  let primaryError: unknown = null;

  try {
    runtime = await loadRuntime((prisma) => {
      cleanupHandles.prisma = prisma;
    });
    const fixture = await createFixture(runtime);
    const verificationActor = await createFixture(runtime, [runtime.AdminPermission.BACKUP_SETTINGS_MANAGE]);
    const express = (await import("express")).default;
    const app = express();
    app.use(express.json());
    app.use(
      "/api/v1/backups",
      runtime.createBackupRouter(runtime.backupService, { importUploadRoot: uploadRoot })
    );
    app.use(runtime.errorHandler);
    server = createServer(app);
    const baseUrl = await listen(server);

    await testInvalidImportPersistence(
      baseUrl,
      runtime,
      fixture,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - invalid import persists FAILED job/run/audits and cleans uploads/lock");

    await testFailureAuditIsolation(
      baseUrl,
      runtime,
      fixture,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - failed AuditLog write cannot mask the import error or strand OperationRun/lock");

    await testPopulatedDestinationRollback(
      baseUrl,
      runtime,
      fixture,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - populated import destination is rolled back without stale database paths or lock");

    await testIncompleteZipExtractionCleanup(
      baseUrl,
      runtime,
      fixture,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - incomplete ZIP is extracted and its upload/extraction directory are cleaned");

    await testCorruptZipExtractionCleanup(
      baseUrl,
      runtime,
      fixture,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - corrupt ZIP expansion failure leaves no extraction/upload directory or lock");

    await testVerificationMismatchPersistence(
      baseUrl,
      runtime,
      verificationActor,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - verification mismatch persists FAILED job/run/audit state without changing backup files");

    await testVerificationFailureAuditIsolation(
      baseUrl,
      runtime,
      verificationActor,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - failed verification AuditLog write cannot mask 409 or strand state");

    await testMissingManifestVerificationPersistence(
      baseUrl,
      runtime,
      verificationActor,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - missing-manifest verification persists terminal job/run/audit state without changing files");

    await testMissingDumpVerificationPersistence(
      baseUrl,
      runtime,
      verificationActor,
      runtime.authCookieName,
      managedRoot,
      uploadRoot
    );
    console.log("ok - missing-dump verification persists terminal job/run/audit state without changing files");
    console.log("Backup workflow failure integration tests passed (9/9).");
  } catch (error) {
    primaryError = error;
  }

  const cleanupErrors: unknown[] = [];
  try {
    await closeServer(server);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (cleanupHandles.prisma) {
    try {
      await cleanupHandles.prisma.$disconnect();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await cleanupNewZipExtractionDirectories(zipExtractionBaseline);
    assert.deepEqual(await listZipExtractionDirectories(), zipExtractionBaseline);
  } catch (error) {
    cleanupErrors.push(error);
  }
  for (const [root, prefix] of [
    [uploadRoot, UPLOAD_ROOT_PREFIX],
    [managedRoot, MANAGED_ROOT_PREFIX],
  ] as const) {
    try {
      assertSafeTemporaryRoot(root, prefix);
      await rm(root, { recursive: true, force: true });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (primaryError) {
    if (cleanupErrors.length) console.error("Backup workflow worker cleanup also failed", cleanupErrors);
    throw primaryError;
  }
  if (cleanupErrors.length) {
    throw new AggregateError(cleanupErrors, "Backup workflow worker cleanup failed");
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
