import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BACKUP_ZIP_LIMITS, inspectBackupZipBeforeExtraction } from "./backup-zip-policy";
import { runExternalProcess } from "./external-process";

type ZipEntry = { name: string; compressedBytes?: number; expandedBytes?: number; flags?: number; madeBy?: number; externalAttributes?: number };

function createMetadataZip(entries: readonly ZipEntry[]) {
  const centralRecords: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const record = Buffer.alloc(46 + name.length);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(entry.madeBy ?? 0x0314, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE((entry.flags ?? 0) | 0x800, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt32LE(entry.compressedBytes ?? 10, 20);
    record.writeUInt32LE(entry.expandedBytes ?? 10, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(entry.externalAttributes ?? 0, 38);
    name.copy(record, 46);
    centralRecords.push(record);
  }
  const central = Buffer.concat(centralRecords);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([central, eocd]);
}

async function withZip(entries: readonly ZipEntry[], run: (filePath: string) => Promise<void>) {
  const root = await mkdtemp(path.join(os.tmpdir(), "backup-zip-policy-test-"));
  try {
    const filePath = path.join(root, "fixture.zip");
    await writeFile(filePath, createMetadataZip(entries));
    await run(filePath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function testSafeArchiveMetadataPasses() {
  await withZip(
    [
      { name: "export/database.dump", compressedBytes: 50, expandedBytes: 100 },
      { name: "export/manifest.json" },
      { name: "export/backup.log" },
    ],
    async (filePath) => {
      assert.deepEqual(await inspectBackupZipBeforeExtraction(filePath), {
        entryCount: 3,
        fileCount: 3,
        expandedBytes: 120,
      });
    }
  );
}

async function testUnsafePathsAndLinksFailClosed() {
  for (const entry of [
    { name: "../database.dump" },
    { name: "a/b/c/d/e/database.dump" },
    { name: "export/customer.csv" },
    { name: "export/database.dump", madeBy: 0x0314, externalAttributes: 0xa0000000 },
    { name: "export/database.dump", flags: 0x1 },
  ]) {
    await withZip([entry], async (filePath) => {
      await assert.rejects(inspectBackupZipBeforeExtraction(filePath));
    });
  }
}

async function testZipBombQuotasFailBeforeExtraction() {
  await withZip(
    [{ name: "database.dump", compressedBytes: 1, expandedBytes: BACKUP_ZIP_LIMITS.maxCompressionRatio + 1 }],
    async (filePath) => {
      await assert.rejects(inspectBackupZipBeforeExtraction(filePath), /compression ratio is unsafe/u);
    }
  );

  const tooMany = Array.from({ length: BACKUP_ZIP_LIMITS.maxEntries + 1 }, (_, index) => ({
    name: index % 3 === 0 ? `wrapper-${index}/` : `restore-test-report_${index}.json`,
  }));
  await withZip(tooMany, async (filePath) => {
    await assert.rejects(inspectBackupZipBeforeExtraction(filePath), /too many entries/u);
  });
}

async function testTimeoutSettlesOnlyAfterChildClose() {
  const startedAt = Date.now();
  await assert.rejects(
    runExternalProcess({
      command: process.execPath,
      args: ["-e", "setInterval(() => {}, 1000)"],
      cwd: process.cwd(),
      timeoutMs: 75,
      timeoutMessage: "fixture timed out",
      failureMessage: "fixture failed",
    }),
    /fixture timed out/u
  );
  assert.ok(Date.now() - startedAt >= 70, "timeout must not settle before its deadline");
}

async function testFullDatabaseAndRestoreSafetyContracts() {
  const repositoryRoot = path.resolve(__dirname, "../../../..");
  const [backupScript, restoreTestScript, productionRestoreScript, apiSmokeScript, editionConfig] = await Promise.all([
    readFile(path.join(repositoryRoot, "scripts", "backup-database.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts", "restore-test.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts", "restore-production.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "scripts", "verify-restore-api.ps1"), "utf8"),
    readFile(path.join(repositoryRoot, "server", "src", "config", "env.ts"), "utf8"),
  ]);

  assert.match(backupScript, /"--format=custom"/u);
  assert.doesNotMatch(backupScript, /--(?:exclude-)?table(?:=|\b)/u, "Backup must remain a full-database dump");
  assert.doesNotMatch(
    backupScript,
    /APP_EDITION|APP_TIMEZONE|ATTENDANCE_POLICY|ATTENDANCE_AUTO_CHECKOUT_ENABLED/u,
    "External runtime config must not enter the database backup manifest"
  );
  assert.match(editionConfig, /APP_EDITION/u, "Edition must remain an external runtime configuration");

  for (const token of [
    "ConfirmPhrase", "ExpectedFolderName", "known backup type folder", "manifest.json",
    "Backup SHA-256 does not match manifest", "Backup size does not match manifest", "active database connections",
  ]) {
    assert.ok(productionRestoreScript.includes(token), `Production restore safety contract is missing: ${token}`);
  }
  assert.match(restoreTestScript, /\^atlasgym_restore_test_/u);
  assert.match(restoreTestScript, /if \(\$Cleanup -and \$created -and \$dropdb\)/u);
  for (const endpoint of ["/api/v1/health", "/api/v1/auth/me", "/api/v1/devices", "/api/v1/attendance", "/api/v1/dashboard/summary"]) {
    assert.ok(apiSmokeScript.includes(endpoint), `Post-restore API smoke is missing ${endpoint}`);
  }
}

async function run() {
  await testSafeArchiveMetadataPasses();
  await testUnsafePathsAndLinksFailClosed();
  await testZipBombQuotasFailBeforeExtraction();
  await testTimeoutSettlesOnlyAfterChildClose();
  await testFullDatabaseAndRestoreSafetyContracts();
  console.log("Backup ZIP preflight and external-process hardening tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
