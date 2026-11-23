import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://backup_service_test:backup_service_test@127.0.0.1:1/backup_service_test";

const { AdminRole, BackupJobType, BackupStatus } = require("@prisma/client") as typeof import("@prisma/client");
const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
const { HttpError } = require("../../middlewares/error-handler") as typeof import("../../middlewares/error-handler");
const { backupServiceTestHooks } = require("./backup.service") as typeof import("./backup.service");

type ScheduleRule = Parameters<typeof backupServiceTestHooks.computeNextScheduledRun>[0];
type ScheduleFrequency = ScheduleRule["frequency"];
type RetentionConfig = Parameters<typeof backupServiceTestHooks.planScheduledBackupRetention>[1];

type BackupFixtureOptions = {
  backupType: "manual" | "scheduled" | "pre-migration";
  createdAt: string;
  scheduleFrequency?: ScheduleFrequency;
};

const prismaAny = prisma as any;
const originalPrismaFns = {
  auditLogCreate: prismaAny.auditLog.create,
  backupJobFindFirst: prismaAny.backupJob.findFirst,
  backupJobUpdateMany: prismaAny.backupJob.updateMany,
  operationRunUpdateMany: prismaAny.operationRun.updateMany,
  systemSettingUpsert: prismaAny.systemSetting.upsert,
};

function restorePrismaFunctions() {
  prismaAny.auditLog.create = originalPrismaFns.auditLogCreate;
  prismaAny.backupJob.findFirst = originalPrismaFns.backupJobFindFirst;
  prismaAny.backupJob.updateMany = originalPrismaFns.backupJobUpdateMany;
  prismaAny.operationRun.updateMany = originalPrismaFns.operationRunUpdateMany;
  prismaAny.systemSetting.upsert = originalPrismaFns.systemSettingUpsert;
}

function isStrictlyInside(targetPath: string, parentPath: string) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertSafeTemporaryRoot(root: string) {
  const resolvedRoot = path.resolve(root);
  const resolvedTemp = path.resolve(os.tmpdir());
  assert.ok(isStrictlyInside(resolvedRoot, resolvedTemp), `Unsafe temporary root: ${resolvedRoot}`);
  assert.match(path.basename(resolvedRoot), /^atlasgym-backup-service-test-/u);
}

async function withTemporaryBackupRoot<T>(execute: (root: string) => Promise<T>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlasgym-backup-service-test-"));
  assertSafeTemporaryRoot(root);
  try {
    return await execute(root);
  } finally {
    assertSafeTemporaryRoot(root);
    await rm(root, { recursive: true, force: true });
  }
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

async function createBackupFixture(root: string, relativePath: string, options: BackupFixtureOptions) {
  const normalizedRelativePath = relativePath.replace(/\\/gu, "/");
  const folderPath = path.join(root, ...normalizedRelativePath.split("/"));
  assert.ok(isStrictlyInside(folderPath, root), `Unsafe backup fixture path: ${folderPath}`);
  const dump = Buffer.from(`fixture:${normalizedRelativePath}`, "utf8");
  const manifest: Record<string, unknown> = {
    backupType: options.backupType,
    status: "succeeded",
    createdAt: options.createdAt,
    databaseName: "backup_service_test",
    schema: "public",
    fileName: "database.dump",
    sizeBytes: dump.length,
    sha256: createHash("sha256").update(dump).digest("hex"),
    operator: "backup-service-test",
  };
  if (options.scheduleFrequency) {
    manifest["scheduleFrequency"] = options.scheduleFrequency;
  }

  await mkdir(folderPath, { recursive: true });
  await Promise.all([
    writeFile(path.join(folderPath, "database.dump"), dump),
    writeFile(path.join(folderPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(folderPath, "backup.log"), "backup fixture completed\n", "utf8"),
  ]);
  return folderPath;
}

function encodedPayload(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function assertInvalidBackupId(id: string) {
  assert.throws(
    () => backupServiceTestHooks.decodeBackupId(id),
    (error: unknown) => error instanceof HttpError && error.status === 400 && error.message === "Invalid backup id"
  );
}

async function testBackupIdRoundTripsAndRejectsUnsafeLayouts() {
  const nestedPath = "scheduled/monthly/2026-07-05_120000_scheduled";
  const nestedId = backupServiceTestHooks.encodeBackupId(nestedPath);
  assert.match(nestedId, /^[A-Za-z0-9_-]+$/u);
  assert.deepEqual(backupServiceTestHooks.decodeBackupId(nestedId), {
    typeDir: "scheduled",
    folderName: "2026-07-05_120000_scheduled",
    relativePath: nestedPath,
  });

  const legacyFolder = "2026-06-01_090000_scheduled";
  const legacyId = backupServiceTestHooks.encodeBackupId("daily", legacyFolder);
  assert.deepEqual(backupServiceTestHooks.decodeBackupId(legacyId), {
    typeDir: "daily",
    folderName: legacyFolder,
    relativePath: `daily/${legacyFolder}`,
  });

  const transitionalPath = "scheduled/2026-07-03_063519_monthly_scheduled";
  assert.equal(
    backupServiceTestHooks.decodeBackupId(backupServiceTestHooks.encodeBackupId(transitionalPath)).relativePath,
    transitionalPath
  );
  assert.equal(
    backupServiceTestHooks.decodeBackupId(
      backupServiceTestHooks.encodeBackupId("scheduled\\weekly\\2026-07-04_120000_scheduled")
    ).relativePath,
    "scheduled/weekly/2026-07-04_120000_scheduled"
  );

  [
    "manual",
    "manual/../outside",
    "manual/./folder",
    "manual/folder\0",
    "/manual/outside",
    "C:/manual/outside",
    "\\\\server\\share\\manual\\outside",
    "manual/C:outside",
    "manual/folder/extra",
    "support-packages/archive",
    "unknown/folder",
    "scheduled/hourly",
    "scheduled/not-a-frequency/folder",
  ].forEach((payload) => assertInvalidBackupId(encodedPayload(payload)));

  assertInvalidBackupId("");
  assertInvalidBackupId("not+canonical");
  assertInvalidBackupId(`${nestedId}=`);
  assert.throws(() => backupServiceTestHooks.encodeBackupId("/manual/outside"), /Invalid backup relative path/u);
  assert.throws(() => backupServiceTestHooks.encodeBackupId("C:\\manual\\outside"), /Invalid backup relative path/u);
}

async function testScannerFindsCanonicalTransitionalAndLegacyFixtures() {
  await withTemporaryBackupRoot(async (root) => {
    const frequencies = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;
    for (const [index, frequency] of frequencies.entries()) {
      const day = String(index + 1).padStart(2, "0");
      await createBackupFixture(root, `scheduled/${frequency}/2026-07-${day}_120000_scheduled`, {
        backupType: "scheduled",
        createdAt: `2026-07-${day}T12:00:00.000Z`,
      });
    }

    await createBackupFixture(root, "scheduled/2026-07-06_120000_monthly_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-06T12:00:00.000Z",
    });
    await createBackupFixture(root, "scheduled/2026-07-10_120000_daily_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-10T12:00:00.000Z",
      scheduleFrequency: "weekly",
    });
    await createBackupFixture(root, "daily/2026-07-07_120000_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-07T12:00:00.000Z",
    });
    await createBackupFixture(root, "manual/2026-07-08_120000_manual", {
      backupType: "manual",
      createdAt: "2026-07-08T12:00:00.000Z",
    });
    await createBackupFixture(root, "pre-migration/2026-07-09_120000_pre-migration", {
      backupType: "pre-migration",
      createdAt: "2026-07-09T12:00:00.000Z",
    });
    await createBackupFixture(root, "support-packages/internal-folder-must-not-be-scanned", {
      backupType: "manual",
      createdAt: "2026-07-10T12:00:00.000Z",
    });
    await writeFile(path.join(root, "backup-config.json"), "{}\n", "utf8");
    await writeFile(path.join(root, "manual", "loose-file-must-not-be-scanned.txt"), "ignored\n", "utf8");

    const items = await backupServiceTestHooks.scanBackupRoot(root);
    assert.equal(items.length, 10);
    assert.deepEqual(
      items.map((item) => item.relativePath),
      [
        "scheduled/2026-07-10_120000_daily_scheduled",
        "pre-migration/2026-07-09_120000_pre-migration",
        "manual/2026-07-08_120000_manual",
        "daily/2026-07-07_120000_scheduled",
        "scheduled/2026-07-06_120000_monthly_scheduled",
        "scheduled/yearly/2026-07-05_120000_scheduled",
        "scheduled/monthly/2026-07-04_120000_scheduled",
        "scheduled/weekly/2026-07-03_120000_scheduled",
        "scheduled/daily/2026-07-02_120000_scheduled",
        "scheduled/hourly/2026-07-01_120000_scheduled",
      ]
    );

    const byPath = new Map(items.map((item) => [item.relativePath, item]));
    frequencies.forEach((frequency, index) => {
      const day = String(index + 1).padStart(2, "0");
      const item = byPath.get(`scheduled/${frequency}/2026-07-${day}_120000_scheduled`);
      assert.ok(item);
      assert.equal(item.type, BackupJobType.SCHEDULED);
      assert.equal(item.scheduleFrequency, frequency);
    });

    assert.equal(byPath.get("scheduled/2026-07-06_120000_monthly_scheduled")?.scheduleFrequency, "monthly");
    assert.equal(
      byPath.get("scheduled/2026-07-10_120000_daily_scheduled")?.scheduleFrequency,
      "weekly",
      "Manifest frequency must take precedence over a transitional folder-name hint"
    );
    assert.equal(byPath.get("daily/2026-07-07_120000_scheduled")?.scheduleFrequency, "daily");
    assert.equal(byPath.get("manual/2026-07-08_120000_manual")?.type, BackupJobType.MANUAL);
    assert.equal(byPath.get("pre-migration/2026-07-09_120000_pre-migration")?.type, BackupJobType.PRE_MIGRATION);
    assert.equal(items.some((item) => item.relativePath.includes("support-packages")), false);
    assert.equal(items.every((item) => item.hasManifest && item.hasDump), true);

    for (const item of items) {
      assert.equal(backupServiceTestHooks.decodeBackupId(item.id).relativePath, item.relativePath);
      const readById = await backupServiceTestHooks.readBackupFolderById(root, item.id);
      assert.equal(readById.relativePath, item.relativePath);
      assert.equal(readById.scheduleFrequency, item.scheduleFrequency);
      assert.equal(readById.location, item.location);
    }
  });
}

async function testRestoreTestReportContractNormalizesPersistedAndCompatibilityFields() {
  await withTemporaryBackupRoot(async (root) => {
    const persistedReportPath = path.join(root, "restore-test-report_persisted.json");
    const persistedCreatedAt = "2026-06-23T08:15:30.123+04:30";
    const persistedCounts = { Member: 12, Membership: 9, InboxItem: null };
    await writeFile(
      persistedReportPath,
      `${JSON.stringify({
        status: "succeeded",
        createdAt: persistedCreatedAt,
        sourceBackup: path.join(root, "database.dump"),
        sourceSha256: "a".repeat(64),
        testDatabaseName: "atlasgym_restore_test_persisted",
        databaseHost: "localhost",
        databasePort: 5432,
        counts: persistedCounts,
        cleanupRequested: false,
      }, null, 2)}\n`,
      "utf8"
    );

    assert.deepEqual(await backupServiceTestHooks.readRestoreTestReport(persistedReportPath, root), {
      testedAt: new Date(persistedCreatedAt).toISOString(),
      testDatabaseName: "atlasgym_restore_test_persisted",
      sourceBackup: path.join(root, "database.dump"),
      cleanup: false,
      counts: persistedCounts,
    });

    const compatibilityReportPath = path.join(root, "restore-test-report_compatibility.json");
    const compatibilityTestedAt = "2026-06-17T04:30:00.000Z";
    const compatibilityCounts = { Member: 7, Membership: 5 };
    await writeFile(
      compatibilityReportPath,
      `${JSON.stringify({
        testedAt: compatibilityTestedAt,
        testDatabase: "atlasgym_restore_test_compatibility",
        sourceBackup: path.join(root, "legacy-database.dump"),
        cleanup: true,
        counts: compatibilityCounts,
      }, null, 2)}\n`,
      "utf8"
    );

    assert.deepEqual(await backupServiceTestHooks.readRestoreTestReport(compatibilityReportPath, root), {
      testedAt: compatibilityTestedAt,
      testDatabaseName: "atlasgym_restore_test_compatibility",
      sourceBackup: path.join(root, "legacy-database.dump"),
      cleanup: true,
      counts: compatibilityCounts,
    });

    const precedenceReportPath = path.join(root, "restore-test-report_precedence.json");
    const persistedPrecedenceTimestamp = "2026-06-23T09:30:00.000+04:30";
    await writeFile(
      precedenceReportPath,
      `${JSON.stringify({
        createdAt: persistedPrecedenceTimestamp,
        testedAt: "2025-01-01T00:00:00.000Z",
        testDatabaseName: "atlasgym_restore_test_persisted_wins",
        testDatabase: "atlasgym_restore_test_alias_loses",
        cleanupRequested: false,
        cleanup: true,
        counts: { Member: -1 },
      }, null, 2)}\n`,
      "utf8"
    );

    assert.deepEqual(await backupServiceTestHooks.readRestoreTestReport(precedenceReportPath, root), {
      testedAt: new Date(persistedPrecedenceTimestamp).toISOString(),
      testDatabaseName: "atlasgym_restore_test_persisted_wins",
      cleanup: false,
    });

    await assert.rejects(
      backupServiceTestHooks.readRestoreTestReport(path.join(root, "..", "outside-report.json"), root),
      (error: unknown) => error instanceof HttpError
        && error.status === 400
        && error.message === "Backup path is outside the configured backup root"
    );
  });
}

function createScheduleRule(frequency: ScheduleFrequency, overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    enabled: true,
    time: "10:15",
    minute: 15,
    dayOfWeek: 1,
    dayOfMonth: 5,
    month: 1,
    ...overrides,
    frequency,
  };
}

async function testScheduleBoundariesForEveryFrequency() {
  const exactBoundary = new Date(2026, 0, 5, 10, 15, 0, 0);
  const frequencies = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;
  const expectedNextRunAt: Record<ScheduleFrequency, Date> = {
    hourly: new Date(2026, 0, 5, 11, 15, 0, 0),
    daily: new Date(2026, 0, 6, 10, 15, 0, 0),
    weekly: new Date(2026, 0, 12, 10, 15, 0, 0),
    monthly: new Date(2026, 1, 5, 10, 15, 0, 0),
    yearly: new Date(2027, 0, 5, 10, 15, 0, 0),
  };

  for (const frequency of frequencies) {
    const rule = createScheduleRule(frequency, {
      minute: exactBoundary.getMinutes(),
      dayOfWeek: exactBoundary.getDay(),
      dayOfMonth: exactBoundary.getDate(),
      month: exactBoundary.getMonth() + 1,
    });
    const due = backupServiceTestHooks.computeNextScheduledRun(rule, null, true, exactBoundary);
    assert.equal(due.dueNow, true, `${frequency} should be due at its exact boundary`);
    assert.equal(due.currentRunAt, exactBoundary.toISOString());
    assert.equal(due.nextRunAt, expectedNextRunAt[frequency].toISOString());

    const justBeforeBoundary = new Date(exactBoundary.getTime() - 1);
    const before = backupServiceTestHooks.computeNextScheduledRun(rule, null, true, justBeforeBoundary);
    assert.equal(before.dueNow, false, `${frequency} should not run before its boundary`);
    assert.equal(before.currentRunAt, exactBoundary.toISOString());
    assert.equal(before.nextRunAt, exactBoundary.toISOString());

    const justAfterBoundary = new Date(exactBoundary.getTime() + 1);
    const after = backupServiceTestHooks.computeNextScheduledRun(rule, null, true, justAfterBoundary);
    assert.equal(after.dueNow, true, `${frequency} should be due immediately after its boundary`);
    assert.equal(after.currentRunAt, exactBoundary.toISOString());
    assert.equal(after.nextRunAt, expectedNextRunAt[frequency].toISOString());

    const alreadyRan = backupServiceTestHooks.computeNextScheduledRun(
      rule,
      new Date(exactBoundary),
      true,
      justAfterBoundary
    );
    assert.equal(alreadyRan.dueNow, false, `${frequency} should not run twice in the same window`);
    assert.equal(alreadyRan.currentRunAt, exactBoundary.toISOString());
    assert.equal(alreadyRan.nextRunAt, expectedNextRunAt[frequency].toISOString());
  }

  const dailyRule = createScheduleRule("daily");
  const afterBoundary = new Date(exactBoundary.getTime() + 1);
  assert.deepEqual(backupServiceTestHooks.computeNextScheduledRun(dailyRule, null, false, afterBoundary), {
    currentRunAt: null,
    nextRunAt: null,
    dueNow: false,
  });
  assert.deepEqual(
    backupServiceTestHooks.computeNextScheduledRun({ ...dailyRule, enabled: false }, null, true, afterBoundary),
    {
      currentRunAt: null,
      nextRunAt: null,
      dueNow: false,
    }
  );

  const nonLeapBoundary = new Date(2027, 1, 28, 10, 15, 0, 0);
  const leapBoundary = new Date(2028, 1, 29, 10, 15, 0, 0);
  const monthlyDay31 = createScheduleRule("monthly", { dayOfMonth: 31 });
  assert.deepEqual(backupServiceTestHooks.computeNextScheduledRun(monthlyDay31, null, true, nonLeapBoundary), {
    currentRunAt: nonLeapBoundary.toISOString(),
    nextRunAt: new Date(2027, 2, 31, 10, 15, 0, 0).toISOString(),
    dueNow: true,
  });
  assert.deepEqual(backupServiceTestHooks.computeNextScheduledRun(monthlyDay31, null, true, leapBoundary), {
    currentRunAt: leapBoundary.toISOString(),
    nextRunAt: new Date(2028, 2, 31, 10, 15, 0, 0).toISOString(),
    dueNow: true,
  });

  const yearlyFebruary31 = createScheduleRule("yearly", { dayOfMonth: 31, month: 2 });
  assert.deepEqual(backupServiceTestHooks.computeNextScheduledRun(yearlyFebruary31, null, true, nonLeapBoundary), {
    currentRunAt: nonLeapBoundary.toISOString(),
    nextRunAt: leapBoundary.toISOString(),
    dueNow: true,
  });
  assert.deepEqual(backupServiceTestHooks.computeNextScheduledRun(yearlyFebruary31, null, true, leapBoundary), {
    currentRunAt: leapBoundary.toISOString(),
    nextRunAt: new Date(2029, 1, 28, 10, 15, 0, 0).toISOString(),
    dueNow: true,
  });
}

async function testLatestScheduledBackupIsIsolatedByFrequency() {
  await withTemporaryBackupRoot(async (root) => {
    await createBackupFixture(root, "scheduled/daily/2026-07-10_120000_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-10T12:00:00.000Z",
    });
    await createBackupFixture(root, "scheduled/monthly/2026-07-05_120000_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-05T12:00:00.000Z",
    });

    type LatestBackupWhere = {
      type: string;
      status: string;
      scheduleFrequency: string;
    };
    const calls: LatestBackupWhere[] = [];
    prismaAny.backupJob.findFirst = async ({ where }: { where: LatestBackupWhere }) => {
      calls.push({ ...where });
      return where.scheduleFrequency === "monthly"
        ? { startedAt: new Date("2026-07-08T12:00:00.000Z") }
        : null;
    };

    try {
      const daily = await backupServiceTestHooks.getLatestScheduledBackupAtForFrequency(root, "daily");
      const monthly = await backupServiceTestHooks.getLatestScheduledBackupAtForFrequency(root, "monthly");
      assert.equal(daily?.toISOString(), "2026-07-10T12:00:00.000Z");
      assert.equal(monthly?.toISOString(), "2026-07-08T12:00:00.000Z");
      assert.deepEqual(calls, [
        {
          type: BackupJobType.SCHEDULED,
          status: BackupStatus.COMPLETED,
          scheduleFrequency: "daily",
        },
        {
          type: BackupJobType.SCHEDULED,
          status: BackupStatus.COMPLETED,
          scheduleFrequency: "monthly",
        },
      ]);
    } finally {
      prismaAny.backupJob.findFirst = originalPrismaFns.backupJobFindFirst;
    }
  });
}

function createRetentionConfig(overrides: Partial<RetentionConfig> = {}): RetentionConfig {
  return {
    hourly: 2,
    daily: 2,
    weekly: 2,
    monthly: 2,
    yearly: 2,
    preMigration: 10,
    manualAutoDelete: false,
    ...overrides,
  };
}

async function testRetentionPlannerSelectsOnlyOldestTargetFrequency() {
  await withTemporaryBackupRoot(async (root) => {
    const legacyDailyPath = "daily/2026-07-01_120000_scheduled";
    const transitionalDailyPath = "scheduled/2026-07-02_120000_daily_scheduled";
    const firstTiedDailyPath = "scheduled/daily/2026-07-03_120000_scheduled";
    const secondTiedDailyPath = "scheduled/daily/2026-07-03_130000_scheduled";
    await createBackupFixture(root, legacyDailyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-01T12:00:00.000Z",
    });
    await createBackupFixture(root, transitionalDailyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-02T12:00:00.000Z",
    });
    await createBackupFixture(root, firstTiedDailyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-03T12:00:00.000Z",
    });
    await createBackupFixture(root, secondTiedDailyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-03T12:00:00.000Z",
    });
    await createBackupFixture(root, "scheduled/monthly/2026-07-04_120000_scheduled", {
      backupType: "scheduled",
      createdAt: "2026-07-04T12:00:00.000Z",
    });
    const oldMonthlyPath = "scheduled/monthly/2026-07-01_080000_scheduled";
    await createBackupFixture(root, oldMonthlyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-01T08:00:00.000Z",
    });
    await createBackupFixture(root, "manual/2026-07-05_120000_manual", {
      backupType: "manual",
      createdAt: "2026-07-05T12:00:00.000Z",
    });
    await createBackupFixture(root, "pre-migration/2026-07-06_120000_pre-migration", {
      backupType: "pre-migration",
      createdAt: "2026-07-06T12:00:00.000Z",
    });
    await createBackupFixture(root, "support-packages/must-never-be-retained-or-deleted", {
      backupType: "manual",
      createdAt: "2026-07-07T12:00:00.000Z",
    });

    const items = await backupServiceTestHooks.scanBackupRoot(root);
    const originalOrder = items.map((item) => item.id);
    const dailyPlan = backupServiceTestHooks.planScheduledBackupRetention(
      items,
      createRetentionConfig({ daily: 2 }),
      "daily"
    );
    assert.equal(dailyPlan.keepCount, 2);
    assert.deepEqual(dailyPlan.removeItems.map((item) => item.relativePath), [
      transitionalDailyPath,
      legacyDailyPath,
    ]);
    assert.deepEqual(items.map((item) => item.id), originalOrder, "Retention planning must not mutate inventory order");

    const tiedDailyPlan = backupServiceTestHooks.planScheduledBackupRetention(
      items,
      createRetentionConfig({ daily: 1 }),
      "daily"
    );
    assert.deepEqual(tiedDailyPlan.removeItems.map((item) => item.relativePath), [
      secondTiedDailyPath,
      transitionalDailyPath,
      legacyDailyPath,
    ]);

    const monthlyPlan = backupServiceTestHooks.planScheduledBackupRetention(
      items,
      createRetentionConfig({ monthly: 0 }),
      "monthly"
    );
    assert.equal(monthlyPlan.keepCount, 1, "Retention must always protect the newest backup");
    assert.deepEqual(monthlyPlan.removeItems.map((item) => item.relativePath), [oldMonthlyPath]);

    const hourlyPlan = backupServiceTestHooks.planScheduledBackupRetention(
      items,
      createRetentionConfig({ hourly: 1 }),
      "hourly"
    );
    assert.equal(hourlyPlan.removeItems.length, 0);
    assert.equal(
      [...dailyPlan.removeItems, ...monthlyPlan.removeItems].some(
        (item) => item.type !== BackupJobType.SCHEDULED || item.scheduleFrequency === null
      ),
      false
    );
  });
}

async function testRetentionCleanupDeletesOnlyPlannedTemporaryFolders() {
  await withTemporaryBackupRoot(async (root) => {
    const removedPath = "daily/2026-07-01_120000_scheduled";
    const keptTransitionalPath = "scheduled/2026-07-02_120000_daily_scheduled";
    const keptCanonicalPath = "scheduled/daily/2026-07-03_120000_scheduled";
    const protectedMonthlyPath = "scheduled/monthly/2026-07-04_120000_scheduled";
    const protectedManualPath = "manual/2026-07-05_120000_manual";
    const protectedPreMigrationPath = "pre-migration/2026-07-06_120000_pre-migration";
    const protectedSupportPath = "support-packages/must-never-be-retained-or-deleted";

    await createBackupFixture(root, removedPath, {
      backupType: "scheduled",
      createdAt: "2026-07-01T12:00:00.000Z",
    });
    await createBackupFixture(root, keptTransitionalPath, {
      backupType: "scheduled",
      createdAt: "2026-07-02T12:00:00.000Z",
    });
    await createBackupFixture(root, keptCanonicalPath, {
      backupType: "scheduled",
      createdAt: "2026-07-03T12:00:00.000Z",
    });
    await createBackupFixture(root, protectedMonthlyPath, {
      backupType: "scheduled",
      createdAt: "2026-07-04T12:00:00.000Z",
    });
    await createBackupFixture(root, protectedManualPath, {
      backupType: "manual",
      createdAt: "2026-07-05T12:00:00.000Z",
    });
    await createBackupFixture(root, protectedPreMigrationPath, {
      backupType: "pre-migration",
      createdAt: "2026-07-06T12:00:00.000Z",
    });
    await createBackupFixture(root, protectedSupportPath, {
      backupType: "manual",
      createdAt: "2026-07-07T12:00:00.000Z",
    });
    await writeFile(
      path.join(root, "backup-config.json"),
      `${JSON.stringify({ frequency: "daily", retention: { daily: 2 } }, null, 2)}\n`,
      "utf8"
    );

    type PersistenceCall = {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    const updateCalls: PersistenceCall[] = [];
    const auditCalls: Array<{ data: Record<string, unknown> }> = [];
    prismaAny.backupJob.updateMany = async (input: PersistenceCall) => {
      updateCalls.push(input);
      return { count: 1 };
    };
    prismaAny.auditLog.create = async (input: { data: Record<string, unknown> }) => {
      auditCalls.push(input);
      return { id: "backup-service-test-audit" };
    };

    try {
      const result = await backupServiceTestHooks.cleanupScheduledBackupRetention(root, "daily");
      assert.deepEqual(result, { deletedCount: 1, keepCount: 2 });

      const removedLocation = path.join(root, ...removedPath.split("/"));
      assert.equal(await pathExists(removedLocation), false);
      for (const protectedPath of [
        keptTransitionalPath,
        keptCanonicalPath,
        protectedMonthlyPath,
        protectedManualPath,
        protectedPreMigrationPath,
        protectedSupportPath,
      ]) {
        assert.equal(await pathExists(path.join(root, ...protectedPath.split("/"))), true, `${protectedPath} must remain`);
      }

      assert.deepEqual(updateCalls, [
        {
          where: { location: removedLocation },
          data: {
            location: null,
            manifestPath: null,
            logPath: null,
            errorMessage: "Backup files were removed by scheduled retention cleanup.",
          },
        },
      ]);

      assert.equal(auditCalls.length, 1);
      const auditData = auditCalls[0]?.data;
      assert.ok(auditData);
      assert.equal(auditData["actorType"], "SYSTEM");
      assert.equal(auditData["action"], "backup.retention.delete");
      assert.equal(auditData["targetId"], backupServiceTestHooks.encodeBackupId(removedPath));
      assert.equal(auditData["success"], true);
      assert.deepEqual(auditData["metadata"], {
        location: removedLocation,
        folderName: path.basename(removedLocation),
        relativePath: removedPath,
        scheduleFrequency: "daily",
        keepCount: 2,
      });

      const retentionState = JSON.parse(await readFile(path.join(root, ".retention-state.json"), "utf8")) as {
        lastCleanupAt?: unknown;
      };
      assert.equal(typeof retentionState.lastCleanupAt, "string");
      assert.equal(Number.isNaN(Date.parse(String(retentionState.lastCleanupAt))), false);
    } finally {
      prismaAny.backupJob.updateMany = originalPrismaFns.backupJobUpdateMany;
      prismaAny.auditLog.create = originalPrismaFns.auditLogCreate;
    }
  });
}

async function testRestoreMaintenancePersistenceQuiescesAndResumesRuntime() {
  const {
    registerRestoreMaintenanceRuntime,
    restoreMaintenanceRuntimeTestHooks,
  } = require("../../shared/restore-maintenance-runtime") as typeof import("../../shared/restore-maintenance-runtime");
  restoreMaintenanceRuntimeTestHooks.reset();
  const order: string[] = [];
  prismaAny.systemSetting.upsert = async (input: { update: { value: string } }) => {
    const state = JSON.parse(input.update.value) as { enabled: boolean };
    order.push(state.enabled ? "persist-active" : "persist-inactive");
    return { key: "restore.maintenance" };
  };
  registerRestoreMaintenanceRuntime({
    pause: async () => { order.push("pause-runtime"); },
    resume: async () => { order.push("resume-runtime"); },
  }, false);
  const inactiveFields = {
    restoreJobId: null,
    startedAt: null,
    startedById: null,
    startedByRole: null,
    reason: null,
    selectedBackupFolderName: null,
    selectedBackupPath: null,
    emergencyBackupPath: null,
    handoffPath: null,
  };
  const context = {
    actor: { id: "maintenance-owner", role: AdminRole.GYM_OWNER },
    meta: {},
  };

  try {
    await backupServiceTestHooks.writeRestoreMaintenanceState({
      ...inactiveFields,
      enabled: true,
      restoreJobId: "restore-job-test",
    }, context);
    await backupServiceTestHooks.writeRestoreMaintenanceState({
      ...inactiveFields,
      enabled: false,
    }, context);
    assert.deepEqual(order, [
      "persist-active",
      "pause-runtime",
      "persist-inactive",
      "resume-runtime",
    ]);
  } finally {
    prismaAny.systemSetting.upsert = originalPrismaFns.systemSettingUpsert;
    restoreMaintenanceRuntimeTestHooks.reset();
  }
}

async function testRestartReconciliationAndOrphanCleanup() {
  const now = new Date("2026-08-25T08:00:00.000Z");
  let updateInput: unknown = null;
  prismaAny.operationRun.updateMany = async (input: unknown) => {
    updateInput = input;
    return { count: 2 };
  };
  try {
    const result = await backupServiceTestHooks.reconcileStaleOperationRuns(now);
    assert.deepEqual(result, { count: 2 });
    const update = updateInput as { where: { status: { in: string[] }; updatedAt: { lt: Date } }; data: Record<string, unknown> };
    assert.deepEqual(update.where.status.in, ["PENDING", "RUNNING"]);
    assert.ok(update.where.updatedAt.lt.getTime() < now.getTime());
    assert.equal(update.data["status"], "FAILED");
    assert.equal(update.data["step"], "interrupted");
    assert.equal(update.data["percent"], 100);
    assert.equal(update.data["finishedAt"], now);
  } finally {
    prismaAny.operationRun.updateMany = originalPrismaFns.operationRunUpdateMany;
  }

  const suffix = `${process.pid}-${Date.now()}`;
  const staleDir = path.join(os.tmpdir(), `atlasgym-backup-import-zip-orphan-${suffix}`);
  const freshDir = path.join(os.tmpdir(), `atlasgym-backup-import-zip-fresh-${suffix}`);
  const unrelatedDir = path.join(os.tmpdir(), `backup-unrelated-${suffix}`);
  for (const candidate of [staleDir, freshDir, unrelatedDir]) {
    assert.ok(isStrictlyInside(candidate, os.tmpdir()));
  }
  try {
    await Promise.all([mkdir(staleDir), mkdir(freshDir), mkdir(unrelatedDir)]);
    const staleTime = new Date(now.getTime() - 365 * 24 * 60 * 60_000);
    await Promise.all([utimes(staleDir, staleTime, staleTime), utimes(unrelatedDir, staleTime, staleTime)]);
    assert.equal(await backupServiceTestHooks.cleanupOrphanBackupImportExtractionDirs(now), 1);
    await assert.rejects(stat(staleDir), (error: NodeJS.ErrnoException) => error.code === "ENOENT");
    assert.equal((await stat(freshDir)).isDirectory(), true);
    assert.equal((await stat(unrelatedDir)).isDirectory(), true);
  } finally {
    await Promise.all([staleDir, freshDir, unrelatedDir].map((candidate) => rm(candidate, { recursive: true, force: true })));
  }
}

async function run() {
  const tests: Array<{ name: string; execute: () => Promise<void> }> = [
    { name: "backup IDs round-trip and reject unsafe layouts", execute: testBackupIdRoundTripsAndRejectsUnsafeLayouts },
    {
      name: "scanner finds canonical, transitional, and legacy backup fixtures",
      execute: testScannerFindsCanonicalTransitionalAndLegacyFixtures,
    },
    {
      name: "restore-test report fields normalize persisted and compatibility schemas",
      execute: testRestoreTestReportContractNormalizesPersistedAndCompatibilityFields,
    },
    { name: "schedule boundaries cover every frequency", execute: testScheduleBoundariesForEveryFrequency },
    { name: "latest scheduled backup is isolated by frequency", execute: testLatestScheduledBackupIsIsolatedByFrequency },
    {
      name: "retention planner selects only oldest target-frequency backups",
      execute: testRetentionPlannerSelectsOnlyOldestTargetFrequency,
    },
    {
      name: "retention cleanup deletes only planned temporary folders",
      execute: testRetentionCleanupDeletesOnlyPlannedTemporaryFolders,
    },
    {
      name: "restore maintenance persistence quiesces and resumes runtime",
      execute: testRestoreMaintenancePersistenceQuiescesAndResumesRuntime,
    },
    {
      name: "restart reconciliation fails stale operations and removes only safe orphan extraction folders",
      execute: testRestartReconciliationAndOrphanCleanup,
    },
  ];

  for (const test of tests) {
    await test.execute();
    console.log(`ok - ${test.name}`);
  }

  console.log(`Backup service tests passed (${tests.length}/${tests.length}).`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    restorePrismaFunctions();
  });
