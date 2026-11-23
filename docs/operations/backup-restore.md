# Backup and Restore Plan

Last reviewed: 2026-08-26

This document defines the backup and restore policy for the local/offline Entry Control System installation. The application is expected to run on the customer's own Windows machine, not on a hosted or always-online server.

## Current Decision

- Backups are local-first.
- The primary backup target must be on the same machine, but outside the project directory.
- Manual external copies to a USB drive, memory card, or external hard drive are supported as an operational step.
- The application should create a complete PostgreSQL backup first, then copy the completed backup to external media. Do not write the primary backup directly to removable media.
- Restore is a controlled operation with application downtime.
- Backup UI is implemented for manual backups, inventory, details, and verification.
- Safe backup creation, support package export, backup import registration, recovery preparation, restore handoff, maintenance start, and post-restore check are tracked as durable `OperationRun` records so long-running assistant progress can be audited and later resumed/polled from the backend.
- Production restore remains a controlled handoff workflow and must not run as a one-click normal UI action.

## Recommended Local Paths

Preferred production path:

```text
C:\ProgramData\EntryControlSystem\backups
```

Acceptable local path for this current workstation:

```text
E:\AtlasGymBackups
```

Do not store backups inside:

```text
E:\EntryControlSystem
```

The project directory is source/application state, not backup storage. Backups in the repo are easy to delete accidentally, copy into Git, or overwrite during development.

## Backup Scope

At the current project state, the important runtime data is stored in PostgreSQL:

- Members, customer profiles, staff profiles, and shifts
- Membership plans, memberships, status, expiry, debt, and activation state
- Payments, payroll payments, expenses, and reversals
- Attendance logs, manual attendance, device users, and access violations
- Device configuration, K40 status/cursors, inbox alerts, and device feed
- Sound settings and uploaded sound assets
- Prisma migration state

No separate persistent upload folder is currently required for backup because uploaded sound files are stored in `SoundAsset.data` in the database.

Do not include these in normal data backups:

- `.env` files
- `runtime.env` and other external installation config
- License Entitlements/Leases/Control/Recovery tokens, installation private keys, `state\licensing`, clock/revision anchors and the external License incident journal
- passwords, API keys, device communication keys, or secrets
- `node_modules`
- `dist`
- local build/cache folders
- Git metadata

Secrets need their own secure installation record, not a normal data backup bundle.

Emergency database Backup remains available during every License lock through the restricted authenticated facade, or through the elevated signed recovery CLI authorizing the Guardian service over one-time IPC when program integrity prevents Node from running. Restore never carries or changes authoritative License State.

## Backup Types

| Type | Trigger | Purpose |
| --- | --- | --- |
| `manual` | User/operator starts it | Before risky work, before maintenance, or before copying to external media |
| `scheduled` | Automatic local schedule profiles: hourly, daily, weekly, monthly, and/or yearly | Routine protection against data loss, grouped by schedule frequency |
| `pre-migration` | Before schema/app updates | Safe rollback point before database-changing work |

## Format

Use PostgreSQL custom-format backups:

```powershell
pg_dump -Fc --no-owner --no-acl --file "<backup-file>.dump" "<DATABASE_URL>"
```

Reason:

- `pg_restore` can restore this format reliably.
- It is more controllable than plain SQL for real database recovery.
- It is the right default before migrations and production data changes.

Each backup bundle should include:

- `database.dump`
- `manifest.json`
- `backup.log`

## Current Scripts

The initial Windows scripts live in the project `scripts` folder:

```text
scripts\backup-database.ps1
scripts\restore-test.ps1
scripts\verify-restore-api.ps1
scripts\restore-api-smoke-server.js
```

Backup creation is now available from the protected Settings UI. Backup bundle import is available as safe inventory registration only: the app validates the bundle and copies it into the managed backup root, but it does not restore production data. Production restore remains a controlled handoff workflow and must not run as a one-click normal UI action.

If PostgreSQL client tools are on `PATH`, a manual backup can be run with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup-database.ps1 -Type manual
```

On the current workstation, PostgreSQL 17 tools are installed but are not on `PATH`, so use explicit tool paths:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\backup-database.ps1 `
  -Type manual `
  -PgDumpPath "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
```

The script reads `DATABASE_URL` from `server\.env` by default, writes to `E:\AtlasGymBackups` by default, refuses to write inside the project directory, writes to an `.inprogress` folder first, and only creates the final backup folder after `pg_dump` succeeds.

Run a restore verification against a separate temporary database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore-test.ps1 `
  -BackupPath "E:\AtlasGymBackups\manual\<backup-folder>" `
  -CreatedbPath "C:\Program Files\PostgreSQL\17\bin\createdb.exe" `
  -DropdbPath "C:\Program Files\PostgreSQL\17\bin\dropdb.exe" `
  -PgRestorePath "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -PsqlPath "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  -Cleanup
```

`restore-test.ps1` only allows test database names that start with `atlasgym_restore_test_`. It does not restore over the production database.

The restore-test sidecar written beside the selected backup uses the established on-disk fields `createdAt`, `testDatabaseName`, `cleanupRequested`, `sourceBackup`, and `counts` (plus status/hash/connection metadata). The backend normalizes these to the existing API fields `testedAt`, `testDatabaseName`, and `cleanup`; it also accepts the earlier backend aliases `testedAt`, `testDatabase`, and `cleanup` when reading compatibility fixtures or imported reports. Valid on-disk fields take precedence. `cleanupRequested` records the script request; for an in-app successful restore-test, the process exits successfully only after the requested cleanup command completes. Existing report sidecars do not need migration, and the client response shape is unchanged.

For the strongest practical verification, restore without `-Cleanup`, run the API smoke test against that restored database, then drop the temporary database:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore-test.ps1 `
  -BackupPath "E:\AtlasGymBackups\manual\<backup-folder>" `
  -TestDatabaseName "atlasgym_restore_test_app_YYYYMMDD_HHMM" `
  -CreatedbPath "C:\Program Files\PostgreSQL\17\bin\createdb.exe" `
  -DropdbPath "C:\Program Files\PostgreSQL\17\bin\dropdb.exe" `
  -PgRestorePath "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" `
  -PsqlPath "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
  -DropExisting

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-restore-api.ps1 `
  -TestDatabaseName "atlasgym_restore_test_app_YYYYMMDD_HHMM" `
  -Port 4101 `
  -PsqlPath "C:\Program Files\PostgreSQL\17\bin\psql.exe"
```

`verify-restore-api.ps1` creates a temporary authenticated smoke-test session inside the restored test database, then starts a temporary API server from `server/dist/app` only. It does not run `server/dist/index`, so K40 polling and inbox scheduling are not started during restore verification.

Recommended folder shape:

```text
E:\AtlasGymBackups\
  scheduled\
    hourly\
      2026-05-31_223000_scheduled\
        database.dump
        manifest.json
        backup.log
    daily\
      2026-05-31_233000_scheduled\
        database.dump
        manifest.json
        backup.log
    weekly\
      2026-05-31_233000_scheduled\
    monthly\
      2026-05-01_233000_scheduled\
    yearly\
      2026-01-01_233000_scheduled\
  manual\
    2026-05-31_121500_manual\
      database.dump
      manifest.json
      backup.log
  pre-migration\
    2026-06-01_090000_pre-migration\
      database.dump
      manifest.json
      backup.log
```

Legacy compatibility:

- Older automatic backups may exist under `E:\AtlasGymBackups\daily\2026-..._scheduled`.
- Transitional scheduled backups may exist directly under `E:\AtlasGymBackups\scheduled\2026-..._monthly_scheduled`.
- The application must continue to inventory, verify, export, restore-test, and prepare recovery from these legacy folders. New automatic backups use `scheduled\<frequency>\<folder>`.

Recommended `manifest.json` fields:

```json
{
  "appName": "AtlasGym",
  "backupType": "manual",
  "createdAt": "2026-05-31T23:30:00+04:30",
  "databaseName": "ecs_db",
  "schema": "public",
  "appCommit": "unknown",
  "prismaMigrationStatus": "unknown",
  "fileName": "database.dump",
  "sizeBytes": 0,
  "sha256": "unknown",
  "operator": "local-admin",
  "notes": ""
}
```

## Retention Policy

Default retention:

| Backup class | Keep |
| --- | --- |
| Hourly | 24 backups |
| Daily | 14 backups |
| Weekly | 8 backups |
| Monthly | 6 backups |
| Yearly | 5 backups |
| Manual | Never delete automatically unless explicitly configured |
| Pre-migration | Keep at least the latest 10 |

Retention is configurable from the application for scheduled backups, but the source of truth is a local config file, not only the database. If the database is damaged, backup settings still need to be recoverable.

Recommended future config location:

```text
C:\ProgramData\EntryControlSystem\config\backup-config.json
```

Current workstation alternative:

```text
E:\AtlasGymBackups\backup-config.json
```

Current config shape:

```json
{
  "enabled": true,
  "backupRoot": "E:\\AtlasGymBackups",
  "frequency": "daily",
  "dailyTime": "23:30",
  "schedule": {
    "enabled": true,
    "frequency": "daily",
    "time": "23:30",
    "minute": 30,
    "dayOfWeek": 1,
    "dayOfMonth": 1,
    "month": 1
  },
  "profiles": {
    "hourly": {
      "enabled": false,
      "frequency": "hourly",
      "time": "23:30",
      "minute": 30,
      "dayOfWeek": 1,
      "dayOfMonth": 1,
      "month": 1
    },
    "daily": {
      "enabled": true,
      "frequency": "daily",
      "time": "23:30",
      "minute": 30,
      "dayOfWeek": 1,
      "dayOfMonth": 1,
      "month": 1
    },
    "weekly": {
      "enabled": false,
      "frequency": "weekly",
      "time": "23:30",
      "minute": 30,
      "dayOfWeek": 1,
      "dayOfMonth": 1,
      "month": 1
    },
    "monthly": {
      "enabled": true,
      "frequency": "monthly",
      "time": "23:30",
      "minute": 30,
      "dayOfWeek": 1,
      "dayOfMonth": 1,
      "month": 1
    },
    "yearly": {
      "enabled": false,
      "frequency": "yearly",
      "time": "23:30",
      "minute": 30,
      "dayOfWeek": 1,
      "dayOfMonth": 1,
      "month": 1
    }
  },
  "retention": {
    "hourly": 24,
    "daily": 14,
    "weekly": 8,
    "monthly": 6,
    "yearly": 5,
    "preMigration": 10,
    "manualAutoDelete": false
  },
  "externalCopy": {
    "enabled": false,
    "lastTarget": ""
  }
}
```

Settings > Backups can edit this file through the protected schedule settings API. `BackupJob` records in the database should be treated as history/logs, not as the only place where backup policy lives. The top-level `enabled` flag is the master automation switch; each `profiles.<frequency>.enabled` flag controls whether that frequency runs. Automated cleanup deletes only older backups in the completed backup's scheduled frequency bucket beyond that bucket's configured keep count. Manual, imported manual, support-package, and emergency/pre-migration backups are not auto-deleted by scheduled cleanup.

Monthly and yearly schedules accept day-of-month values from 1 to 31. If the selected day does not exist in a shorter month, the scheduler runs the backup on that month's final day instead of failing or skipping the profile.

## External Copy Policy

For USB/external media:

1. Create the backup locally first.
2. Verify the local backup file exists and has a checksum.
3. Copy the completed backup folder to the external drive.
4. Recompute or compare the checksum after copy.
5. Eject the drive safely.

Do not use removable media as the only backup location. A disconnected or unreliable drive can produce partial backups.

If the external drive leaves the gym, encrypt it or use a protected drive. Backups include personal, financial, attendance, and device access data.

## Restore Rules

Restore is a downtime operation.

Before restore:

1. Stop the application server.
2. Stop device polling/background jobs.
3. Record the current date/time and reason for restore.
4. Take a final emergency backup of the current database if PostgreSQL is still readable.
5. Restore into a separate test database first when possible.

Test restore command shape:

```powershell
createdb "<restore_test_db>"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "<restore_test_db>" "<backup-file>.dump"
```

Production restore command shape:

```powershell
pg_restore --clean --if-exists --no-owner --no-acl --dbname "<production_db>" "<backup-file>.dump"
```

Only run production restore after confirming the selected backup is the intended one.

The controlled helper script for production restore is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restore-production.ps1 `
  -BackupPath "<backup-folder>" `
  -BackupRoot "<configured-backup-root>" `
  -ExpectedFolderName "<selected-backup-folder-name>" `
  -ConfirmPhrase "RESTORE ATLASGYM DATABASE" `
  -EnvFile "server\.env"
```

This script refuses backup folders outside the configured backup root, requires `database.dump`, `manifest.json`, and `backup.log`, verifies the manifest SHA-256 and size, refuses restore-test databases as the target, and by default refuses to run while active database connections exist. Stop the application server before running it.

## In-App Restore/Import Phase 2 Decision

Restore/import is more dangerous than backup because it can replace or roll back the production database. The application must not expose a one-click restore button.

In this project, "import" has a narrower safe meaning than production restore: the app may import an existing backup bundle into the configured backup root after validating `database.dump`, `manifest.json`, and `backup.log`. Import must reject unsupported files, verify the manifest SHA-256 and size, record audit history, and leave the production database unchanged. After import, the operator can run restore-test against the imported backup before any restore preparation.

Minimum safe in-app workflow:

1. Show restore only to `RESTORE_DATABASE` users, and keep production restore vendor-maintenance-only until the maintenance activation flow exists.
2. Require the selected backup to be inside the configured backup root.
3. Require `database.dump`, `manifest.json`, and `backup.log` to exist.
4. Verify the backup checksum against `manifest.json`.
5. Run a restore test into a temporary database before any production restore is allowed.
6. Create a fresh emergency backup of the current production database immediately before restore.
7. Pause device polling, background jobs, and normal app access.
8. Require explicit confirmation with a restore phrase. The selected backup folder name should be displayed as a locked value from the restore job, and the controlled restore script must still validate the expected folder name from the handoff.
9. Execute the production restore from a controlled restore script or helper process, not from normal request handling while the API is serving business traffic. The Settings UI creates a handoff file after typed confirmation; it does not run production restore while the API is serving normal traffic.
10. Record audit logs before restore, after emergency backup, after test restore, after production restore, and on failure.
11. After restore, run health/API smoke checks and show the operator a post-restore checklist.

The app now provides restore preparation, disposable restore-test validation, emergency backup creation, controlled handoff generation, restore-maintenance gating, selected-backup display for production restore report sidecars, and an in-app post-restore check after the server is restarted. It still must not run production restore as a normal one-click request while serving traffic; final production restore remains a controlled script handoff after the server is stopped.

## Restore Verification

After running `scripts\restore-production.ps1` and restarting the app, open Settings > Backups, select the restored backup, and run the Post-restore check. The app verifies the selected backup again, reads the latest `production-restore-report_*.json`, checks the current database connection, Prisma migration state, selected-backup hash, admin-user availability, and key table reads, then writes `post-restore-check_*.json` beside the backup.

The manual checklist is still useful if the automatic check reports a warning or if the operator wants a visual business-flow pass. After restore, verify:

- Prisma migration status is healthy.
- `/api/v1/health` returns OK.
- Members list loads.
- Devices page loads.
- K40 device config is present.
- Entry Logs load.
- Attendance/dashboard summary loads.
- Payments/memberships are visible.
- Inbox opens.

Minimum database count checks:

```sql
select count(*) from "Member";
select count(*) from "Membership";
select count(*) from "Payment";
select count(*) from "AttendanceLog";
select count(*) from "Device";
select count(*) from "DeviceUser";
select count(*) from "InboxItem";
```

If the restore was done because of a bad migration or corrupted data, compare these counts against the manifest or the expected known state.

## Security Notes

- Never commit backups to Git.
- Never send raw backup files through untrusted chat or email.
- Do not place `.env` files inside backup bundles.
- Store database credentials separately in the installation record.
- Limit backup folder permissions to the machine owner/operator.
- Encrypt external copies when they leave the local machine.

## Implementation Roadmap

1. Document policy and manual procedure. Done on 2026-05-31.
2. Add local backup script using `pg_dump -Fc`. Done on 2026-05-31.
3. Add restore-test script that restores into a separate database. Done on 2026-05-31.
4. Add checksum and manifest generation. Done on 2026-05-31.
5. Add API smoke verification against a restored test database. Done on 2026-05-31.
6. Add protected manual backup UI. Done on 2026-06-16.
7. Verify a UI-created backup and run restore-test against it. Done on 2026-06-17.
8. Add safe backup import into the managed backup inventory. Done on 2026-06-20.
9. Add Restore Phase 2 production execution with maintenance mode, pre-restore emergency backup, restore-test gate, controlled production restore, audit logging, and post-restore verification. Controlled handoff, maintenance mode, emergency backup, restore-test gate, the guarded `restore-production.ps1` helper, UI display for production restore report sidecars, and in-app post-restore checks are implemented.
10. Add scheduled backup setup and retention cleanup for scheduled backups. Done: backend scheduler/config, schedule run-now, local `backup-config.json`, frequency buckets, multi-profile schedule controls, per-frequency retention, and UI controls are implemented; direct-service, browser, and filesystem QA passed on 2026-07-05.
11. Add optional external-copy helper. Done: removable-drive discovery, copy of the latest verified backup, destination manifest/hash/size verification, `external-copy-summary.json`, and persisted status are implemented; real USB/HDD browser/filesystem QA passed on 2026-07-06.
12. Add a permanent backup regression suite. Core-service stage is current through 2026-08-01: `backup.service.test.ts` and `test:backups` pass 7/7 deterministic ID/scanner/restore-report/schedule/latest-frequency/retention scenarios. The restore-report case normalizes the established PowerShell/on-disk fields and former backend aliases, validates timestamps/counts and preserves the selected-backup path guard without a real restore. HTTP Router stage done on 2026-07-31 and reconfirmed on 2026-08-01: `backup.api.integration.test.ts` and `test:backups-api-integration` pass 5/5 isolated groups covering all 25 endpoints, injected resolved-auth contexts, exact backup permission/status/argument contracts, representative validation, safe HTTP errors, Multer limits, and upload-boundary cleanup with no database or external process. Real-service failure stage done through 2026-08-01: `backup.workflow.integration.runner.ts`, `backup.workflow.failure.integration.test.ts`, and `test:backups-workflow-integration` pass 9/9 against a freshly migrated, loopback-only disposable PostgreSQL database. Five cases cover invalid import, Audit isolation, populated-destination rollback, and real valid-incomplete/corrupt ZIP extraction. Two Verify cases retain same-size hash-mismatch state and failure-audit isolation. The third and fourth Verify cases use a dedicated STAFF session with a `BACKUP_SETTINGS_MANAGE` override plus existing Job/RUNNING SAFE_BACKUP state: one physical dump/log bundle has no `manifest.json`, and one valid manifest/log bundle has no `database.dump`. They prove exact 409 responses only after COMPLETED/FAILED verification with null `verifiedAt` and preserved artifact metadata, FAILED/100 runs before attributed failure Audits, unchanged retained files, empty uploads and zero RUNNING rows. Every run removes the exact database and guarded temp roots. Remaining stages are separately distinguished unreadable-manifest Verify state, size-only mismatch and manifest-without-`sizeBytes` policy, filesystem-only/scanned backups without a `BackupJob`, Verify success-audit failure, support/restore failures, remaining AuditLog/service-role gates, full-app restore-maintenance behavior, the non-destructive restore-safety matrix, pre-extraction archive expansion quotas, subprocess-timeout close handling, and broader external-process/restart/concurrency/stale-run `OperationRun` semantics.
