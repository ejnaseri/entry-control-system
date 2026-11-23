import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AdminRole,
  AuditActor,
  BackupJobType,
  BackupStatus,
  BackupVerificationStatus,
  OperationRunStatus,
  OperationRunType,
  Prisma,
  RestoreJobStatus,
  SettingValueType,
} from "@prisma/client";
import { env, isProduction } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  resumeRuntimeAfterRestoreMaintenance,
  suspendRuntimeForRestoreMaintenance,
} from "../../shared/restore-maintenance-runtime";
import type {
  BackupCreateInput,
  BackupExternalCopyInput,
  BackupListQuery,
  BackupScheduleConfigInput,
  BackupStorageConfigInput,
  RestoreConfirmInput,
  RestoreMaintenanceInput,
  RestorePrepareInput,
} from "./backup.schemas";
import { inspectBackupZipBeforeExtraction } from "./backup-zip-policy";
import { runExternalProcess } from "./external-process";

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type BackupActor = {
  id: string;
  role: AdminRole;
  sessionId?: string;
};

export type BackupActionContext = {
  actor: BackupActor;
  meta: RequestMeta;
};

type BackupManifest = {
  backupType?: string;
  scheduleFrequency?: string;
  createdAt?: string;
  databaseName?: string;
  schema?: string;
  appCommit?: string | null;
  fileName?: string;
  sizeBytes?: number;
  sha256?: string;
  operator?: string | null;
  notes?: string | null;
};

export type BackupImportUploadFile = {
  originalname: string;
  path: string;
  size: number;
};

type RestoreTestReport = {
  testedAt?: string;
  testDatabaseName?: string;
  sourceBackup?: string;
  cleanup?: boolean;
  counts?: Record<string, number | null>;
};

type ProductionRestoreReport = {
  status?: string;
  completedAt?: string;
  sourceBackup?: string;
  sourceSha256?: string;
  databaseName?: string;
  migrationReminder?: string;
};

type PostRestoreCheckStatus = "passed" | "warning" | "failed";

type PostRestoreCheckItem = {
  name: string;
  label: string;
  status: PostRestoreCheckStatus;
  value: string | number | null;
  details: string | null;
};

type PostRestoreCheckFile = {
  status?: string;
  checkedAt?: string;
  sourceBackup?: {
    id?: string;
    folderName?: string;
    sha256?: string | null;
  };
  productionRestoreReport?: {
    fileName?: string;
    completedAt?: string;
    status?: string | null;
  };
  checks?: PostRestoreCheckItem[];
};

type RestoreHandoffFile = {
  restoreJobId?: string;
  createdAt?: string;
  selectedBackup?: {
    folderName?: string;
    path?: string;
    sha256?: string;
    sizeBytes?: number | string;
  };
};

type RestoreSidecarHandoff = {
  fileName: string;
  path: string;
  createdAt: string;
  restoreJobId: string | null;
  selectedBackupFolderName: string | null;
};

type RestoreSidecarReport = {
  fileName: string;
  path: string;
  status: string | null;
  completedAt: string;
  sourceBackup: string | null;
  sourceSha256: string | null;
  databaseName: string | null;
  migrationReminder: string | null;
};

type RestoreSidecarPostCheck = {
  fileName: string;
  path: string;
  status: string | null;
  checkedAt: string;
  sourceBackup: string | null;
  sourceSha256: string | null;
  productionReportFileName: string | null;
  checks: PostRestoreCheckItem[];
};

type RestoreSidecarSummary = {
  hasHandoff: boolean;
  handoffCreatedAt: string | null;
  productionRestoreStatus: string | null;
  productionRestoreCompletedAt: string | null;
  postRestoreStatus: string | null;
  postRestoreCheckedAt: string | null;
};

const EMPTY_RESTORE_SIDECAR_SUMMARY: RestoreSidecarSummary = {
  hasHandoff: false,
  handoffCreatedAt: null,
  productionRestoreStatus: null,
  productionRestoreCompletedAt: null,
  postRestoreStatus: null,
  postRestoreCheckedAt: null,
};

type RestoreMaintenanceState = {
  enabled: boolean;
  restoreJobId: string | null;
  startedAt: string | null;
  startedById: string | null;
  startedByRole: AdminRole | null;
  reason: string | null;
  selectedBackupFolderName: string | null;
  selectedBackupPath: string | null;
  emergencyBackupPath: string | null;
  handoffPath: string | null;
};

type BackupRetentionConfig = {
  hourly: number;
  daily: number;
  weekly: number;
  monthly: number;
  yearly: number;
  preMigration: number;
  manualAutoDelete: boolean;
};

type BackupExternalCopyConfig = {
  enabled: boolean;
  lastTarget: string;
  lastCopiedAt: string | null;
};

const BACKUP_SCHEDULE_FREQUENCIES = ["hourly", "daily", "weekly", "monthly", "yearly"] as const;

type BackupScheduleFrequency = (typeof BACKUP_SCHEDULE_FREQUENCIES)[number];

type BackupScheduleRule = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  time: string;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
};

type BackupScheduleProfiles = Record<BackupScheduleFrequency, BackupScheduleRule>;

type BackupScheduleConfig = {
  enabled: boolean;
  backupRoot: string;
  frequency: BackupScheduleFrequency;
  dailyTime: string;
  schedule: BackupScheduleRule;
  profiles: BackupScheduleProfiles;
  retention: BackupRetentionConfig;
  externalCopy: BackupExternalCopyConfig;
};

type BackupRetentionStatus = {
  scheduledBackups: number;
  keepCount: number;
  cleanupCandidates: number;
  lastCleanupAt: string | null;
};

type BackupScheduleProfileStatus = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  nextRunAt: string | null;
  dueNow: boolean;
  scheduledBackups: number;
  keepCount: number;
  cleanupCandidates: number;
  lastScheduledBackup: ReturnType<typeof serializeJob> | null;
};

type BackupExternalCopyStatus = BackupExternalCopyConfig & {
  latestVerifiedBackupAt: string | null;
  reminderDue: boolean;
};

type BackupExternalDrive = {
  id: string;
  rootPath: string;
  label: string | null;
  fileSystem: string | null;
  driveType: string;
  busType: string | null;
  sizeBytes: string | null;
  freeBytes: string | null;
};

type BackupExternalCopyStatusSummary = {
  availableDrives: BackupExternalDrive[];
};

type BackupScheduleStatus = {
  configPath: string;
  configExists: boolean;
  schedulerRunning: boolean;
  config: BackupScheduleConfig;
  nextRunAt: string | null;
  dueNow: boolean;
  lastScheduledBackup: ReturnType<typeof serializeJob> | null;
  retention: BackupRetentionStatus;
  profiles: Record<BackupScheduleFrequency, BackupScheduleProfileStatus>;
  externalCopy: BackupExternalCopyStatus;
};

type BackupStorageSource = "environment" | "configured" | "default";

type BackupStorageHealth = {
  exists: boolean;
  writable: boolean;
  outsideProject: boolean;
  ok: boolean;
  message: string | null;
};

type BackupStorageStatus = {
  currentRoot: string;
  recommendedRoot: string;
  source: BackupStorageSource;
  envLocked: boolean;
  configPath: string;
  configExists: boolean;
  isRecommended: boolean;
  needsSetup: boolean;
  health: BackupStorageHealth;
};

type BackupFolderInfo = {
  id: string;
  type: BackupJobType;
  relativePath: string;
  typeDir: string;
  folderName: string;
  scheduleFrequency: BackupScheduleFrequency | null;
  location: string;
  manifestPath: string;
  logPath: string;
  dumpPath: string;
  hasManifest: boolean;
  hasDump: boolean;
  createdAt: Date;
  sizeBytes: bigint | null;
  sha256: string | null;
  databaseName: string | null;
  schema: string | null;
  operator: string | null;
  notes: string | null;
};

const backupJobSelect = {
  id: true,
  type: true,
  status: true,
  verificationStatus: true,
  startedAt: true,
  finishedAt: true,
  verifiedAt: true,
  location: true,
  backupRoot: true,
  manifestPath: true,
  logPath: true,
  scheduleFrequency: true,
  sizeBytes: true,
  sha256: true,
  errorMessage: true,
  triggeredById: true,
  updatedAt: true,
  triggeredBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
    },
  },
} satisfies Prisma.BackupJobSelect;

type BackupJobRow = Prisma.BackupJobGetPayload<{ select: typeof backupJobSelect }>;

const restoreJobSelect = {
  id: true,
  status: true,
  selectedBackupId: true,
  selectedBackupPath: true,
  selectedBackupFolderName: true,
  selectedBackupSha256: true,
  selectedBackupSizeBytes: true,
  restoreTestDatabase: true,
  restoreTestPassedAt: true,
  restoreTestReportPath: true,
  emergencyBackupJobId: true,
  emergencyBackupPath: true,
  handoffPath: true,
  restoreScriptPath: true,
  restoreCommand: true,
  maintenanceStartedAt: true,
  maintenanceEndedAt: true,
  productionRestoreReportPath: true,
  productionRestoreStatus: true,
  productionRestoreCompletedAt: true,
  postRestoreCheckedAt: true,
  postRestoreSummary: true,
  requestedById: true,
  requestedAt: true,
  preparedAt: true,
  finishedAt: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  requestedBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
    },
  },
  emergencyBackupJob: {
    select: backupJobSelect,
  },
} satisfies Prisma.RestoreJobSelect;

type RestoreJobRow = Prisma.RestoreJobGetPayload<{ select: typeof restoreJobSelect }>;

const operationRunSelect = {
  id: true,
  type: true,
  status: true,
  step: true,
  percent: true,
  message: true,
  errorMessage: true,
  targetType: true,
  targetId: true,
  result: true,
  metadata: true,
  startedById: true,
  startedAt: true,
  finishedAt: true,
  createdAt: true,
  updatedAt: true,
  startedBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      role: true,
    },
  },
} satisfies Prisma.OperationRunSelect;

type OperationRunRow = Prisma.OperationRunGetPayload<{ select: typeof operationRunSelect }>;

const SERVER_ROOT = path.resolve(__dirname, "../../..");
const PROJECT_ROOT = path.resolve(SERVER_ROOT, "..");
const BACKUP_SCRIPT_PATH = path.join(PROJECT_ROOT, "scripts", "backup-database.ps1");
const RESTORE_TEST_SCRIPT_PATH = path.join(PROJECT_ROOT, "scripts", "restore-test.ps1");
const RESTORE_PRODUCTION_SCRIPT_PATH = path.join(PROJECT_ROOT, "scripts", "restore-production.ps1");
const SERVER_ENV_FILE = path.join(SERVER_ROOT, ".env");
const DEFAULT_BACKUP_ROOT = isProduction ? "C:\\ProgramData\\AtlasGym\\backups" : "E:\\AtlasGymBackups";
const BACKUP_STORAGE_CONFIG_FILE_NAME = "backup-storage.json";
const BACKUP_STORAGE_CONFIG_DIR = isProduction ? "C:\\ProgramData\\AtlasGym" : DEFAULT_BACKUP_ROOT;
const BACKUP_STORAGE_CONFIG_PATH = path.join(BACKUP_STORAGE_CONFIG_DIR, BACKUP_STORAGE_CONFIG_FILE_NAME);
const PRODUCTION_RESTORE_CONFIRM_PHRASE = "RESTORE ATLASGYM DATABASE";
const SCHEDULED_BACKUP_DIR = "scheduled";
const LEGACY_DAILY_SCHEDULED_BACKUP_DIR = "daily";
const SCHEDULED_BACKUP_FREQUENCY_DIRS = BACKUP_SCHEDULE_FREQUENCIES;
const BACKUP_TYPE_DIRS: Array<{ type: BackupJobType; dir: string }> = [
  { type: BackupJobType.MANUAL, dir: "manual" },
  { type: BackupJobType.SCHEDULED, dir: SCHEDULED_BACKUP_DIR },
  { type: BackupJobType.SCHEDULED, dir: LEGACY_DAILY_SCHEDULED_BACKUP_DIR },
  { type: BackupJobType.PRE_MIGRATION, dir: "pre-migration" },
];
const BACKUP_IMPORT_REQUIRED_FILES = ["database.dump", "manifest.json", "backup.log"] as const;
const BACKUP_IMPORT_REQUIRED_FILE_SET = new Set<string>(BACKUP_IMPORT_REQUIRED_FILES);
const BACKUP_SUPPORT_PACKAGE_FILES = ["database.dump", "manifest.json", "backup.log"] as const;
const BACKUP_IMPORT_ZIP_TEMP_BASE_PREFIX = "atlasgym-backup-import-zip-";
const BACKUP_IMPORT_ZIP_TEMP_PREFIX = `${BACKUP_IMPORT_ZIP_TEMP_BASE_PREFIX}${process.pid}-`;
const BACKUP_IMPORT_MAX_MANIFEST_BYTES = 1024 * 1024;
const BACKUP_IMPORT_MAX_LOG_BYTES = 10 * 1024 * 1024;
const BACKUP_MANIFEST_MISSING_MESSAGE = "Backup manifest is missing";
const BACKUP_DUMP_MISSING_MESSAGE = "Backup dump file is missing";
const RESTORE_MAINTENANCE_SETTING_KEY = "restore.maintenance";
const BACKUP_CONFIG_FILE_NAME = "backup-config.json";
const BACKUP_SCHEDULER_INTERVAL_MS = (() => {
  const parsed = Number(process.env["ATLASGYM_BACKUP_SCHEDULER_INTERVAL_MS"] ?? 60_000);
  return Number.isFinite(parsed) ? Math.max(30_000, parsed) : 60_000;
})();
const DEFAULT_BACKUP_DAILY_TIME = "23:30";
const DEFAULT_BACKUP_SCHEDULE_RULE: BackupScheduleRule = {
  enabled: false,
  frequency: "daily",
  time: DEFAULT_BACKUP_DAILY_TIME,
  minute: 30,
  dayOfWeek: 1,
  dayOfMonth: 1,
  month: 1,
};
const BACKUP_RETENTION_STATE_FILE_NAME = ".retention-state.json";
const DEFAULT_BACKUP_RETENTION: BackupRetentionConfig = {
  hourly: 24,
  daily: 14,
  weekly: 8,
  monthly: 6,
  yearly: 5,
  preMigration: 10,
  manualAutoDelete: false,
};
const DEFAULT_BACKUP_EXTERNAL_COPY: BackupExternalCopyConfig = {
  enabled: false,
  lastTarget: "",
  lastCopiedAt: null,
};
const INACTIVE_RESTORE_MAINTENANCE: RestoreMaintenanceState = {
  enabled: false,
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

let activeBackupJobId: string | null = null;
let activeRestoreJobId: string | null = null;
let backupSchedulerStop: (() => Promise<void>) | null = null;

function parseBackupStorageConfig(value: unknown) {
  if (!isRecord(value)) return null;
  const backupRoot = typeof value["backupRoot"] === "string" ? value["backupRoot"].trim() : "";
  return backupRoot ? { backupRoot } : null;
}

function readBackupStorageConfigSync() {
  try {
    return parseBackupStorageConfig(JSON.parse(readFileSync(BACKUP_STORAGE_CONFIG_PATH, "utf8")) as unknown);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return null;
    logger.warn("Unable to read backup storage config; using default backup root", {
      configPath: BACKUP_STORAGE_CONFIG_PATH,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function getBackupRootSource(): { root: string; source: BackupStorageSource; configExists: boolean } {
  const configExists = existsSync(BACKUP_STORAGE_CONFIG_PATH);
  if (env.ATLASGYM_BACKUP_ROOT) {
    return { root: env.ATLASGYM_BACKUP_ROOT, source: "environment", configExists };
  }

  const configured = readBackupStorageConfigSync();
  if (configured?.backupRoot) {
    return { root: configured.backupRoot, source: "configured", configExists };
  }

  return { root: DEFAULT_BACKUP_ROOT, source: "default", configExists };
}

function getBackupRoot() {
  const root = path.resolve(getBackupRootSource().root);
  assertPathOutsideProject(root);
  return root;
}

function assertPathOutsideProject(targetPath: string) {
  if (isSameOrInside(targetPath, PROJECT_ROOT)) {
    throw new HttpError(400, "Backup root must be outside the project directory");
  }
}

function assertPathInsideRoot(targetPath: string, rootPath: string) {
  if (!isSameOrInside(targetPath, rootPath)) {
    throw new HttpError(400, "Backup path is outside the configured backup root");
  }
}

async function inspectBackupStorageRoot(rootPath: string): Promise<BackupStorageHealth> {
  const root = path.resolve(rootPath);
  let outsideProject = true;

  try {
    assertPathOutsideProject(root);
  } catch (error) {
    outsideProject = false;
    return {
      exists: false,
      writable: false,
      outsideProject,
      ok: false,
      message: error instanceof Error ? error.message : "Backup path is not allowed",
    };
  }

  try {
    const existing = await stat(root).catch((error) => {
      if (isNodeError(error, "ENOENT")) return null;
      throw error;
    });

    if (existing && !existing.isDirectory()) {
      return {
        exists: true,
        writable: false,
        outsideProject,
        ok: false,
        message: "Backup path points to a file",
      };
    }

    await mkdir(root, { recursive: true });
    const testPath = path.join(root, `.atlasgym-write-test-${randomUUID()}.tmp`);
    assertPathInsideRoot(testPath, root);
    await writeFile(testPath, "ok", "utf8");
    await rm(testPath, { force: true });

    return {
      exists: true,
      writable: true,
      outsideProject,
      ok: true,
      message: null,
    };
  } catch (error) {
    return {
      exists: existsSync(root),
      writable: false,
      outsideProject,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function validateBackupRootCandidate(backupRoot: string) {
  const candidate = backupRoot.trim();
  if (!candidate) {
    throw new HttpError(400, "Backup storage path is required");
  }
  if (process.platform === "win32" && candidate.startsWith("\\\\") && !candidate.startsWith("\\\\?\\")) {
    throw new HttpError(400, "Backup storage path must be a local drive path");
  }
  if (!path.isAbsolute(candidate)) {
    throw new HttpError(400, "Backup storage path must be an absolute local path");
  }

  const root = path.resolve(candidate);
  assertPathOutsideProject(root);
  const health = await inspectBackupStorageRoot(root);
  if (!health.ok) {
    throw new HttpError(400, health.message ?? "Backup storage path is not writable");
  }
  return root;
}

export async function getBackupStorageStatus(): Promise<BackupStorageStatus> {
  const recommendedRoot = path.resolve(DEFAULT_BACKUP_ROOT);
  const source = getBackupRootSource();
  const currentRoot = path.resolve(source.root);
  const health = await inspectBackupStorageRoot(currentRoot);
  const isRecommended = normalizePathKey(currentRoot) === normalizePathKey(recommendedRoot);

  return {
    currentRoot,
    recommendedRoot,
    source: source.source,
    envLocked: Boolean(env.ATLASGYM_BACKUP_ROOT),
    configPath: BACKUP_STORAGE_CONFIG_PATH,
    configExists: source.configExists,
    isRecommended,
    needsSetup: !health.ok,
    health,
  };
}

export async function updateBackupStorageRoot(input: BackupStorageConfigInput, context: BackupActionContext) {
  if (env.ATLASGYM_BACKUP_ROOT) {
    throw new HttpError(409, "Backup storage is managed by the server environment");
  }

  const previous = getBackupRootSource();
  const previousRoot = path.resolve(previous.root);
  let scheduleConfigToCarry: BackupScheduleConfig | null = null;

  try {
    scheduleConfigToCarry = (await readBackupConfig(previousRoot)).config;
  } catch (error) {
    logger.warn("Unable to read previous backup schedule config before storage update", {
      backupRoot: previousRoot,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const root = await validateBackupRootCandidate(input.backupRoot);
  await mkdir(BACKUP_STORAGE_CONFIG_DIR, { recursive: true });
  await writeFile(
    BACKUP_STORAGE_CONFIG_PATH,
    `${JSON.stringify(
      {
        appName: "AtlasGym",
        backupRoot: root,
        updatedAt: new Date().toISOString(),
        updatedBy: context.actor.id,
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const currentConfig = scheduleConfigToCarry ?? (await readBackupConfig(root)).config;
  await writeBackupConfig(currentConfig);
  await writeBackupAudit({
    context,
    action: "backup.storage.update",
    targetId: root,
    targetType: "BackupStorage",
    success: true,
    metadata: {
      previousRoot,
      backupRoot: root,
      source: "configured",
      configPath: BACKUP_STORAGE_CONFIG_PATH,
    },
  });

  return getBackupStorageStatus();
}

export async function useRecommendedBackupStorage(context: BackupActionContext) {
  return updateBackupStorageRoot({ backupRoot: DEFAULT_BACKUP_ROOT }, context);
}

function runPowerShellJson(script: string, timeoutMs = 30_000) {
  if (process.platform !== "win32") {
    return Promise.resolve("[]");
  }

  return runExternalProcess({
    command: "powershell.exe",
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    cwd: PROJECT_ROOT,
    timeoutMs,
    timeoutMessage: `PowerShell query timed out after ${timeoutMs}ms`,
    failureMessage: "PowerShell query failed",
    sanitizeOutput: sanitizeProcessOutput,
  }).then(({ stdout }) => stdout.trim() || "[]");
}

function normalizeExternalDriveRecord(value: unknown): BackupExternalDrive | null {
  if (!isRecord(value)) return null;
  const rawRoot = typeof value["rootPath"] === "string" ? value["rootPath"] : "";
  if (!rawRoot || !path.isAbsolute(rawRoot)) return null;
  const rootPath = path.parse(path.resolve(rawRoot)).root;
  if (!rootPath) return null;

  const label = typeof value["label"] === "string" && value["label"].trim() ? value["label"].trim().slice(0, 80) : null;
  const fileSystem =
    typeof value["fileSystem"] === "string" && value["fileSystem"].trim() ? value["fileSystem"].trim().slice(0, 32) : null;
  const driveType = typeof value["driveType"] === "string" && value["driveType"].trim() ? value["driveType"].trim().slice(0, 32) : "External";
  const busType = typeof value["busType"] === "string" && value["busType"].trim() ? value["busType"].trim().slice(0, 32) : null;
  const sizeBytes = typeof value["sizeBytes"] === "number" || typeof value["sizeBytes"] === "string" ? String(value["sizeBytes"]) : null;
  const freeBytes = typeof value["freeBytes"] === "number" || typeof value["freeBytes"] === "string" ? String(value["freeBytes"]) : null;

  return {
    id: Buffer.from(rootPath.toLowerCase(), "utf8").toString("base64url"),
    rootPath,
    label,
    fileSystem,
    driveType,
    busType,
    sizeBytes,
    freeBytes,
  };
}

export async function listExternalBackupDrives(): Promise<BackupExternalDrive[]> {
  if (process.platform !== "win32") return [];

  const script = String.raw`
$ErrorActionPreference = 'Stop'
$items = @{}
function Add-Drive([string]$DriveLetter, [string]$DriveType, [string]$BusType) {
  if ([string]::IsNullOrWhiteSpace($DriveLetter)) { return }
  $letter = $DriveLetter.TrimEnd(':').ToUpperInvariant()
  $deviceId = $letter + ':'
  $root = $deviceId + '\'
  try {
    $logical = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$deviceId'" -ErrorAction SilentlyContinue
    if (-not $logical) { return }
    if ($logical.DriveType -notin @(2, 3)) { return }
    if (-not (Test-Path -LiteralPath $root)) { return }
    $items[$root] = [pscustomobject]@{
      rootPath = $root
      label = [string]$logical.VolumeName
      fileSystem = [string]$logical.FileSystem
      driveType = $DriveType
      busType = $BusType
      sizeBytes = if ($logical.Size -ne $null) { [string]$logical.Size } else { $null }
      freeBytes = if ($logical.FreeSpace -ne $null) { [string]$logical.FreeSpace } else { $null }
    }
  } catch {}
}
try {
  Get-CimInstance Win32_LogicalDisk -ErrorAction SilentlyContinue |
    Where-Object { $_.DriveType -eq 2 } |
    ForEach-Object { Add-Drive $_.DeviceID 'Removable' 'Removable' }
} catch {}
try {
  Get-Disk -ErrorAction SilentlyContinue |
    Where-Object { $_.BusType -in @('USB', 'SD', 'MMC') } |
    ForEach-Object {
      $disk = $_
      Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue |
        Where-Object { $_.DriveLetter } |
        ForEach-Object { Add-Drive ([string]$_.DriveLetter) 'External' ([string]$disk.BusType) }
    }
} catch {}
$drives = @($items.Values | Sort-Object rootPath)
if ($drives.Count -eq 0) { '[]' } else { $drives | ConvertTo-Json -Depth 4 -Compress }
`;

  try {
    const output = await runPowerShellJson(script);
    const parsed = JSON.parse(output) as unknown;
    const values = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const drives = values.map(normalizeExternalDriveRecord).filter((drive): drive is BackupExternalDrive => Boolean(drive));
    const backupRootDrive = path.parse(path.resolve(getBackupRoot())).root;
    const projectDrive = path.parse(path.resolve(PROJECT_ROOT)).root;
    return drives.filter((drive) => {
      const driveKey = normalizePathKey(drive.rootPath);
      return driveKey !== normalizePathKey(backupRootDrive) && driveKey !== normalizePathKey(projectDrive);
    });
  } catch (error) {
    logger.warn("Unable to list external backup drives", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function isSameOrInside(targetPath: string, parentPath: string) {
  const target = path.resolve(targetPath);
  const parent = path.resolve(parentPath);
  const normalizedTarget = process.platform === "win32" ? target.toLowerCase() : target;
  const normalizedParent = process.platform === "win32" ? parent.toLowerCase() : parent;
  const relative = path.relative(normalizedParent, normalizedTarget);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function getTypeDir(type: BackupJobType) {
  return BACKUP_TYPE_DIRS.find((item) => item.type === type)?.dir ?? "manual";
}

function getTypeDirs(type: BackupJobType) {
  const dirs = BACKUP_TYPE_DIRS.filter((item) => item.type === type).map((item) => item.dir);
  return dirs.length > 0 ? dirs : [getTypeDir(type)];
}

function getRetentionKeepCount(retention: BackupRetentionConfig, frequency: BackupScheduleFrequency) {
  return Math.max(1, retention[frequency]);
}

function assertPathInsideBackupTypeRoots(targetPath: string, root: string, type: BackupJobType) {
  if (getTypeDirs(type).some((dir) => isSameOrInside(targetPath, path.join(root, dir)))) {
    return;
  }
  throw new HttpError(400, "Backup path is outside the expected backup type directory");
}

function getBackupConfigPath(root = getBackupRoot()) {
  const configPath = path.join(root, BACKUP_CONFIG_FILE_NAME);
  assertPathInsideRoot(configPath, root);
  return configPath;
}

function getRetentionStatePath(root = getBackupRoot()) {
  const statePath = path.join(root, BACKUP_RETENTION_STATE_FILE_NAME);
  assertPathInsideRoot(statePath, root);
  return statePath;
}

function defaultScheduleRuleForFrequency(frequency: BackupScheduleFrequency): BackupScheduleRule {
  return {
    ...DEFAULT_BACKUP_SCHEDULE_RULE,
    enabled: false,
    frequency,
  };
}

function defaultScheduleProfiles(): BackupScheduleProfiles {
  return BACKUP_SCHEDULE_FREQUENCIES.reduce((profiles, frequency) => {
    profiles[frequency] = defaultScheduleRuleForFrequency(frequency);
    return profiles;
  }, {} as BackupScheduleProfiles);
}

function defaultBackupConfig(root = getBackupRoot()): BackupScheduleConfig {
  const profiles = defaultScheduleProfiles();
  return {
    enabled: false,
    backupRoot: root,
    frequency: DEFAULT_BACKUP_SCHEDULE_RULE.frequency,
    dailyTime: DEFAULT_BACKUP_DAILY_TIME,
    schedule: { ...profiles[DEFAULT_BACKUP_SCHEDULE_RULE.frequency] },
    profiles,
    retention: { ...DEFAULT_BACKUP_RETENTION },
    externalCopy: { ...DEFAULT_BACKUP_EXTERNAL_COPY },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDailyTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/u.test(value);
}

function isScheduleFrequency(value: unknown): value is BackupScheduleFrequency {
  return typeof value === "string" && (BACKUP_SCHEDULE_FREQUENCIES as readonly string[]).includes(value);
}

function numberFromConfig(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function parseScheduleTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  return {
    hours: numberFromConfig(hours, 0, 0, 23),
    minutes: numberFromConfig(minutes, 0, 0, 59),
  };
}

function normalizeScheduleRule(
  value: unknown,
  frequency: BackupScheduleFrequency,
  fallback: BackupScheduleRule,
  enabledFallback = fallback.enabled
): BackupScheduleRule {
  const source = isRecord(value) ? value : {};
  const time = isDailyTime(source["time"]) ? source["time"] : fallback.time;
  const timeParts = parseScheduleTime(time);
  return {
    enabled: typeof source["enabled"] === "boolean" ? source["enabled"] : enabledFallback,
    frequency,
    time,
    minute: numberFromConfig(source["minute"], timeParts.minutes, 0, 59),
    dayOfWeek: numberFromConfig(source["dayOfWeek"], fallback.dayOfWeek, 0, 6),
    dayOfMonth: numberFromConfig(source["dayOfMonth"], fallback.dayOfMonth, 1, 31),
    month: numberFromConfig(source["month"], fallback.month, 1, 12),
  };
}

function normalizeBackupConfig(value: unknown, root = getBackupRoot()): BackupScheduleConfig {
  const defaults = defaultBackupConfig(root);
  const source = isRecord(value) ? value : {};
  const scheduleSource = isRecord(source["schedule"]) ? source["schedule"] : {};
  const profilesSource = isRecord(source["profiles"]) ? source["profiles"] : null;
  const retention = isRecord(source["retention"]) ? source["retention"] : {};
  const externalCopy = isRecord(source["externalCopy"]) ? source["externalCopy"] : {};
  const legacyDailyTime = isDailyTime(source["dailyTime"]) ? source["dailyTime"] : defaults.dailyTime;
  const scheduleTime = isDailyTime(scheduleSource["time"]) ? scheduleSource["time"] : legacyDailyTime;
  const scheduleFrequency = isScheduleFrequency(source["frequency"])
    ? source["frequency"]
    : isScheduleFrequency(scheduleSource["frequency"])
      ? scheduleSource["frequency"]
      : defaults.frequency;
  const legacySchedule = normalizeScheduleRule(
    {
      ...scheduleSource,
      time: scheduleTime,
    },
    scheduleFrequency,
    {
      ...defaults.profiles[scheduleFrequency],
      time: scheduleTime,
    },
    typeof source["enabled"] === "boolean" ? source["enabled"] : defaults.profiles[scheduleFrequency].enabled
  );
  const profiles = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, frequency) => {
    const profileSource = profilesSource ? profilesSource[frequency] : frequency === scheduleFrequency ? legacySchedule : null;
    result[frequency] = normalizeScheduleRule(profileSource, frequency, defaults.profiles[frequency]);
    return result;
  }, {} as BackupScheduleProfiles);
  if (!profilesSource) {
    profiles[scheduleFrequency] = legacySchedule;
  }
  const schedule = profiles[scheduleFrequency] ?? legacySchedule;

  return {
    enabled: typeof source["enabled"] === "boolean" ? source["enabled"] : defaults.enabled,
    backupRoot: root,
    frequency: schedule.frequency,
    dailyTime: schedule.time,
    schedule,
    profiles,
    retention: {
      hourly: numberFromConfig(retention["hourly"], defaults.retention.hourly, 1, 168),
      daily: numberFromConfig(retention["daily"], defaults.retention.daily, 1, 365),
      weekly: numberFromConfig(retention["weekly"], defaults.retention.weekly, 0, 104),
      monthly: numberFromConfig(retention["monthly"], defaults.retention.monthly, 0, 60),
      yearly: numberFromConfig(retention["yearly"], defaults.retention.yearly, 0, 25),
      preMigration: numberFromConfig(retention["preMigration"], defaults.retention.preMigration, 1, 365),
      manualAutoDelete:
        typeof retention["manualAutoDelete"] === "boolean" ? retention["manualAutoDelete"] : defaults.retention.manualAutoDelete,
    },
    externalCopy: {
      enabled: typeof externalCopy["enabled"] === "boolean" ? externalCopy["enabled"] : defaults.externalCopy.enabled,
      lastTarget:
        typeof externalCopy["lastTarget"] === "string" ? externalCopy["lastTarget"].slice(0, 160) : defaults.externalCopy.lastTarget,
      lastCopiedAt:
        typeof externalCopy["lastCopiedAt"] === "string" ? externalCopy["lastCopiedAt"] : defaults.externalCopy.lastCopiedAt,
    },
  };
}

async function readBackupConfig(root = getBackupRoot()) {
  const configPath = getBackupConfigPath(root);
  try {
    const content = await readFile(configPath, "utf8");
    return {
      config: normalizeBackupConfig(JSON.parse(content) as unknown, root),
      configPath,
      exists: true,
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return {
        config: defaultBackupConfig(root),
        configPath,
        exists: false,
      };
    }
    logger.warn("Unable to read backup config; using defaults", {
      configPath,
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      config: defaultBackupConfig(root),
      configPath,
      exists: false,
    };
  }
}

function mergeBackupConfig(current: BackupScheduleConfig, input: BackupScheduleConfigInput): BackupScheduleConfig {
  const inputSchedule = isRecord(input.schedule) ? input.schedule : {};
  const inputProfiles = isRecord(input.profiles) ? input.profiles : {};
  const selectedFrequency =
    input.frequency ??
    (isScheduleFrequency(inputSchedule["frequency"]) ? inputSchedule["frequency"] : undefined) ??
    current.frequency;
  const nextSchedule = {
    ...current.profiles[selectedFrequency],
    ...inputSchedule,
    frequency: selectedFrequency,
  };
  const profiles = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, frequency) => {
    const profilePatch = isRecord(inputProfiles[frequency]) ? inputProfiles[frequency] : null;
    const baseProfile = frequency === selectedFrequency && Object.keys(inputSchedule).length > 0 ? nextSchedule : current.profiles[frequency];
    result[frequency] = normalizeScheduleRule(
      profilePatch ? { ...baseProfile, ...profilePatch } : baseProfile,
      frequency,
      current.profiles[frequency]
    );
    return result;
  }, {} as BackupScheduleProfiles);

  if (!input.profiles && Object.keys(inputSchedule).length > 0 && typeof input.enabled === "boolean") {
    profiles[selectedFrequency] = {
      ...profiles[selectedFrequency],
      enabled: input.enabled,
    };
  }

  return normalizeBackupConfig(
    {
      ...current,
      ...input,
      frequency: selectedFrequency,
      schedule: nextSchedule,
      profiles,
      retention: {
        ...current.retention,
        ...(input.retention ?? {}),
      },
      externalCopy: {
        ...current.externalCopy,
        ...(input.externalCopy ?? {}),
      },
    },
    current.backupRoot
  );
}

async function writeBackupConfig(config: BackupScheduleConfig) {
  const root = getBackupRoot();
  const normalized = normalizeBackupConfig(config, root);
  const configPath = getBackupConfigPath(root);
  await mkdir(root, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return { config: normalized, configPath };
}

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Monthly/yearly schedules intentionally fall back to month end for shorter months.
function clampScheduledDayOfMonth(year: number, monthIndex: number, dayOfMonth: number) {
  return Math.min(dayOfMonth, lastDayOfMonth(year, monthIndex));
}

function createScheduledDate(year: number, monthIndex: number, dayOfMonth: number, time: string) {
  const { hours, minutes } = parseScheduleTime(time);
  const scheduledAt = new Date(year, monthIndex, clampScheduledDayOfMonth(year, monthIndex, dayOfMonth));
  scheduledAt.setHours(hours, minutes, 0, 0);
  return scheduledAt;
}

function getScheduleWindow(rule: BackupScheduleRule, now: Date) {
  if (rule.frequency === "hourly") {
    const currentRunAt = new Date(now);
    currentRunAt.setMinutes(rule.minute, 0, 0);
    const nextRunAt = new Date(currentRunAt);
    if (now >= currentRunAt) {
      nextRunAt.setHours(nextRunAt.getHours() + 1);
    }
    return { currentRunAt, nextRunAt: now >= currentRunAt ? nextRunAt : currentRunAt };
  }

  if (rule.frequency === "weekly") {
    const currentRunAt = createScheduledDate(now.getFullYear(), now.getMonth(), now.getDate(), rule.time);
    currentRunAt.setDate(currentRunAt.getDate() + (rule.dayOfWeek - now.getDay()));
    const nextRunAt = new Date(currentRunAt);
    if (now >= currentRunAt) {
      nextRunAt.setDate(nextRunAt.getDate() + 7);
    }
    return { currentRunAt, nextRunAt: now >= currentRunAt ? nextRunAt : currentRunAt };
  }

  if (rule.frequency === "monthly") {
    const currentRunAt = createScheduledDate(now.getFullYear(), now.getMonth(), rule.dayOfMonth, rule.time);
    const nextRunAt = createScheduledDate(now.getFullYear(), now.getMonth() + 1, rule.dayOfMonth, rule.time);
    return { currentRunAt, nextRunAt: now >= currentRunAt ? nextRunAt : currentRunAt };
  }

  if (rule.frequency === "yearly") {
    const monthIndex = rule.month - 1;
    const currentRunAt = createScheduledDate(now.getFullYear(), monthIndex, rule.dayOfMonth, rule.time);
    const nextRunAt = createScheduledDate(now.getFullYear() + 1, monthIndex, rule.dayOfMonth, rule.time);
    return { currentRunAt, nextRunAt: now >= currentRunAt ? nextRunAt : currentRunAt };
  }

  const currentRunAt = createScheduledDate(now.getFullYear(), now.getMonth(), now.getDate(), rule.time);
  const nextRunAt = new Date(currentRunAt);
  if (now >= currentRunAt) {
    nextRunAt.setDate(nextRunAt.getDate() + 1);
  }
  return { currentRunAt, nextRunAt: now >= currentRunAt ? nextRunAt : currentRunAt };
}

function computeNextScheduledRun(rule: BackupScheduleRule, latestScheduledBackupAt: Date | null, automationEnabled: boolean, now = new Date()) {
  if (!automationEnabled || !rule.enabled) return { currentRunAt: null, nextRunAt: null, dueNow: false };

  const { currentRunAt, nextRunAt } = getScheduleWindow(rule, now);
  const alreadyRanCurrentWindow = Boolean(latestScheduledBackupAt && latestScheduledBackupAt >= currentRunAt);
  const dueNow = now >= currentRunAt && !alreadyRanCurrentWindow;

  return {
    currentRunAt: currentRunAt.toISOString(),
    nextRunAt: nextRunAt.toISOString(),
    dueNow,
  };
}

function normalizeBackupRelativePath(value: string) {
  const slashNormalized = value.replace(/\\/gu, "/");
  if (
    !slashNormalized ||
    path.posix.isAbsolute(slashNormalized) ||
    path.win32.isAbsolute(slashNormalized)
  ) {
    throw new Error("Invalid backup relative path");
  }

  const normalized = slashNormalized.split("/");
  if (
    normalized.length < 2 ||
    normalized.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        part.includes("\0") ||
        /^[A-Za-z]:/u.test(part) ||
        path.posix.isAbsolute(part) ||
        path.win32.isAbsolute(part)
    )
  ) {
    throw new Error("Invalid backup relative path");
  }

  return normalized.join("/");
}

function backupRelativePathFromParts(typeDir: string, folderName: string) {
  return normalizeBackupRelativePath(`${typeDir}/${folderName.replace(/\\/gu, "/")}`);
}

function encodeBackupId(typeDirOrRelativePath: string, folderName?: string) {
  const relativePath = folderName ? backupRelativePathFromParts(typeDirOrRelativePath, folderName) : normalizeBackupRelativePath(typeDirOrRelativePath);
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

function isSupportedBackupRelativePath(relativePath: string) {
  const parts = relativePath.split("/");
  const typeDir = parts[0];
  const secondPart = parts[1];
  if (!typeDir || !secondPart) return false;

  if (typeDir === "manual" || typeDir === "pre-migration" || typeDir === LEGACY_DAILY_SCHEDULED_BACKUP_DIR) {
    return parts.length === 2;
  }

  if (typeDir !== SCHEDULED_BACKUP_DIR) return false;
  if (parts.length === 2) {
    return !isScheduleFrequency(secondPart);
  }
  return parts.length === 3 && isScheduleFrequency(secondPart);
}

function decodeBackupId(id: string) {
  try {
    if (!id || !/^[A-Za-z0-9_-]+$/u.test(id)) {
      throw new Error("Invalid backup id");
    }
    const decoded = Buffer.from(id, "base64url").toString("utf8");
    if (Buffer.from(decoded, "utf8").toString("base64url") !== id) {
      throw new Error("Invalid backup id");
    }
    const relativePath = normalizeBackupRelativePath(decoded);
    if (!isSupportedBackupRelativePath(relativePath)) {
      throw new Error("Invalid backup id");
    }
    const parts = relativePath.split("/");
    const typeDir = parts[0];
    const folderName = parts[parts.length - 1];
    if (!typeDir || !folderName) throw new Error("Invalid backup id");
    return { typeDir, folderName, relativePath };
  } catch {
    throw new HttpError(400, "Invalid backup id");
  }
}

function backupTypeFromTypeDir(typeDir: string) {
  return BACKUP_TYPE_DIRS.find((item) => item.dir === typeDir)?.type ?? BackupJobType.MANUAL;
}

function scheduledFrequencyFromManifest(value: string | undefined) {
  return isScheduleFrequency(value) ? value : null;
}

function inferScheduledFrequencyFromRelativePath(relativePath: string, manifest: BackupManifest | null) {
  const manifestFrequency = scheduledFrequencyFromManifest(manifest?.scheduleFrequency);
  if (manifestFrequency) return manifestFrequency;

  const parts = normalizeBackupRelativePath(relativePath).split("/");
  const [typeDir, maybeFrequency, maybeFolderName] = parts;
  if (typeDir === SCHEDULED_BACKUP_DIR && maybeFrequency && maybeFolderName && isScheduleFrequency(maybeFrequency)) {
    return maybeFrequency;
  }
  if (typeDir === LEGACY_DAILY_SCHEDULED_BACKUP_DIR) {
    return "daily";
  }
  const folderName = parts[parts.length - 1] ?? "";
  const match = folderName.match(/_(hourly|daily|weekly|monthly|yearly)_scheduled(?:_|$)/u);
  return scheduledFrequencyFromManifest(match?.[1]);
}

function getFallbackTypeForRelativePath(relativePath: string) {
  const [typeDir] = normalizeBackupRelativePath(relativePath).split("/");
  return typeDir ? backupTypeFromTypeDir(typeDir) : BackupJobType.MANUAL;
}

function typeFromManifest(value: string | undefined, fallback: BackupJobType) {
  if (value === "scheduled") return BackupJobType.SCHEDULED;
  if (value === "pre-migration") return BackupJobType.PRE_MIGRATION;
  if (value === "manual") return BackupJobType.MANUAL;
  return fallback;
}

function typeToScriptValue(type: BackupJobType) {
  if (type === BackupJobType.SCHEDULED) return "scheduled";
  if (type === BackupJobType.PRE_MIGRATION) return "pre-migration";
  return "manual";
}

type BackupImportRequiredFile = (typeof BACKUP_IMPORT_REQUIRED_FILES)[number];
type NormalizedImportFile = BackupImportUploadFile & {
  fileName: string;
  originalParts: string[];
};

function isRequiredImportFileName(fileName: string): fileName is BackupImportRequiredFile {
  return BACKUP_IMPORT_REQUIRED_FILE_SET.has(fileName);
}

function isOptionalImportFileName(fileName: string) {
  if (fileName === "support-summary.json") return true;
  return /^(restore-test-report|production-restore-report|production-restore-handoff|post-restore-check)_[A-Za-z0-9_-]+\.json$/u.test(fileName);
}

function isBackupZipFileName(fileName: string) {
  return fileName.toLowerCase().endsWith(".zip");
}

function normalizeImportFile(file: BackupImportUploadFile): NormalizedImportFile {
  const normalizedName = file.originalname.replace(/\\/gu, "/").trim();
  if (!normalizedName || normalizedName.startsWith("/") || /^[A-Za-z]:\//u.test(normalizedName) || normalizedName.includes("\0")) {
    throw new HttpError(400, "Backup import contains an unsafe file name");
  }

  const originalParts = normalizedName.split("/").filter((part) => part && part !== ".");
  if (!originalParts.length || originalParts.some((part) => part === ".." || path.isAbsolute(part))) {
    throw new HttpError(400, "Backup import contains an unsafe file path");
  }

  const fileName = originalParts[originalParts.length - 1];
  if (!fileName) {
    throw new HttpError(400, "Backup import contains an empty file name");
  }
  if (!isRequiredImportFileName(fileName) && !isOptionalImportFileName(fileName)) {
    throw new HttpError(400, `Backup import rejected unsupported file: ${fileName}`);
  }

  return { ...file, fileName, originalParts };
}

function collectImportFiles(files: BackupImportUploadFile[]) {
  if (!files.length) {
    throw new HttpError(400, "Backup import requires database.dump, manifest.json, and backup.log");
  }
  if (files.length > 24) {
    throw new HttpError(400, "Backup import contains too many files");
  }

  const requiredFiles = new Map<BackupImportRequiredFile, NormalizedImportFile>();
  const optionalFileNames: string[] = [];

  for (const file of files) {
    const normalized = normalizeImportFile(file);
    if (!isRequiredImportFileName(normalized.fileName)) {
      optionalFileNames.push(normalized.fileName);
      continue;
    }
    if (requiredFiles.has(normalized.fileName)) {
      throw new HttpError(400, `Backup import contains duplicate file: ${normalized.fileName}`);
    }
    requiredFiles.set(normalized.fileName, normalized);
  }

  for (const fileName of BACKUP_IMPORT_REQUIRED_FILES) {
    if (!requiredFiles.has(fileName)) {
      throw new HttpError(400, `Backup import is missing ${fileName}`);
    }
  }

  return {
    dumpFile: requiredFiles.get("database.dump") as NormalizedImportFile,
    manifestFile: requiredFiles.get("manifest.json") as NormalizedImportFile,
    logFile: requiredFiles.get("backup.log") as NormalizedImportFile,
    optionalFileNames,
  };
}

async function collectExtractedImportFiles(root: string, current = root, files: BackupImportUploadFile[] = []): Promise<BackupImportUploadFile[]> {
  assertPathInsideRoot(current, root);
  const entries = await readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = path.join(current, entry.name);
    assertPathInsideRoot(filePath, root);
    if (entry.isDirectory()) {
      await collectExtractedImportFiles(root, filePath, files);
      continue;
    }
    if (!entry.isFile()) continue;
    if (files.length >= 25) {
      throw new HttpError(400, "Backup import contains too many files");
    }
    files.push({
      originalname: path.relative(root, filePath).split(path.sep).join("/"),
      path: filePath,
      size: (await stat(filePath)).size,
    });
  }

  return files;
}

function expandBackupImportArchive(archivePath: string, destinationDir: string) {
  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const script =
    "& { param([string]$ArchivePath, [string]$DestinationDir) $ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $ArchivePath -DestinationPath $DestinationDir -Force }";
  const timeoutMs = Math.max(env.ATLASGYM_BACKUP_TIMEOUT_MS, 300_000);

  return runExternalProcess({
    command,
    args: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script, archivePath, destinationDir],
    cwd: PROJECT_ROOT,
    timeoutMs,
    timeoutMessage: `Backup ZIP import timed out after ${timeoutMs}ms`,
    failureMessage: "Backup ZIP import failed",
    rejectNonEmptyStderr: true,
    sanitizeOutput: sanitizeProcessOutput,
  }).then(() => undefined);
}

function assertBackupImportExtractionDir(extractionDir: string) {
  const resolvedExtractionDir = path.resolve(extractionDir);
  const tempRoot = path.resolve(os.tmpdir());
  const relative = path.relative(tempRoot, resolvedExtractionDir);
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep) ||
    !relative.startsWith(BACKUP_IMPORT_ZIP_TEMP_PREFIX)
  ) {
    throw new Error("Refusing to clean up an unsafe backup ZIP extraction directory");
  }
}

async function cleanupBackupImportExtractionDir(extractionDir: string) {
  assertBackupImportExtractionDir(extractionDir);
  await rm(extractionDir, { recursive: true, force: true });
}

async function prepareImportFiles(files: BackupImportUploadFile[]) {
  if (files.length !== 1) {
    return { files, extractionDir: null, sourceKind: "folder" as const };
  }

  const file = files[0];
  if (!file) {
    throw new HttpError(400, "Backup ZIP import requires a file");
  }
  const originalName = file.originalname.replace(/\\/gu, "/").split("/").pop() ?? file.originalname;
  if (!isBackupZipFileName(originalName)) {
    return { files, extractionDir: null, sourceKind: "folder" as const };
  }

  const fileStat = await stat(file.path);
  if (!fileStat.isFile()) {
    throw new HttpError(400, "Backup ZIP import is not a file");
  }

  await inspectBackupZipBeforeExtraction(file.path);

  const extractionDir = await mkdtemp(path.join(os.tmpdir(), BACKUP_IMPORT_ZIP_TEMP_PREFIX));
  try {
    await expandBackupImportArchive(file.path, extractionDir);
    const extractedFiles = await collectExtractedImportFiles(extractionDir);
    if (!extractedFiles.length) {
      throw new HttpError(400, "Backup ZIP import is empty");
    }

    return { files: extractedFiles, extractionDir, sourceKind: "zip" as const };
  } catch (error) {
    await cleanupBackupImportExtractionDir(extractionDir).catch((cleanupError: unknown) => {
      logger.warn("Failed to remove unsuccessful backup ZIP extraction folder", {
        path: extractionDir,
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });
    throw error;
  }
}

async function assertImportSidecarSize(file: NormalizedImportFile, limitBytes: number) {
  const fileStat = await stat(file.path);
  if (!fileStat.isFile()) {
    throw new HttpError(400, `${file.fileName} is not a file`);
  }
  if (fileStat.size > limitBytes) {
    throw new HttpError(400, `${file.fileName} is too large`);
  }
}

async function readImportManifest(file: NormalizedImportFile) {
  await assertImportSidecarSize(file, BACKUP_IMPORT_MAX_MANIFEST_BYTES);
  try {
    return parseManifest(decodeManifestBuffer(await readFile(file.path)));
  } catch {
    throw new HttpError(400, "Backup manifest is invalid or unreadable");
  }
}

function assertImportManifest(manifest: BackupManifest) {
  if (manifest.fileName && manifest.fileName !== "database.dump") {
    throw new HttpError(400, "Backup manifest references an unsupported dump file name");
  }
  if (!manifest.sha256 || !/^[a-f0-9]{64}$/iu.test(manifest.sha256)) {
    throw new HttpError(400, "Backup manifest is missing a valid SHA-256 value");
  }
  if (typeof manifest.sizeBytes !== "number" || !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 0) {
    throw new HttpError(400, "Backup manifest is missing a valid dump size");
  }
}

async function verifyImportedDump(file: NormalizedImportFile, manifest: BackupManifest) {
  const dumpStat = await stat(file.path);
  if (!dumpStat.isFile()) {
    throw new HttpError(400, "database.dump is not a file");
  }

  const expectedHash = manifest.sha256 ?? "";
  const expectedSize = manifest.sizeBytes ?? null;
  const actualHash = await sha256File(file.path);
  const actualSize = dumpStat.size;
  const verified = actualHash.toLowerCase() === expectedHash.toLowerCase() && expectedSize === actualSize;
  if (!verified) {
    throw new HttpError(409, "Backup import verification failed", {
      expectedHash,
      actualHash,
      expectedSize,
      actualSize,
    });
  }

  return { expectedHash, actualHash, expectedSize, actualSize };
}

async function verifyBackupFolderContents(info: BackupFolderInfo) {
  if (!info.hasManifest) {
    throw new HttpError(409, BACKUP_MANIFEST_MISSING_MESSAGE);
  }
  if (!info.hasDump) {
    throw new HttpError(409, BACKUP_DUMP_MISSING_MESSAGE);
  }

  const manifest = await readManifestIfPresent(info.manifestPath);
  if (!manifest) {
    throw new HttpError(409, "Backup manifest is unreadable");
  }

  const dumpStat = await stat(info.dumpPath);
  const actualHash = await sha256File(info.dumpPath);
  const expectedHash = manifest.sha256 ?? "";
  const expectedSize = typeof manifest.sizeBytes === "number" ? manifest.sizeBytes : null;
  const verified = actualHash.toLowerCase() === expectedHash.toLowerCase() && (expectedSize === null || dumpStat.size === expectedSize);

  return {
    verified,
    expectedHash,
    actualHash,
    expectedSize,
    actualSize: dumpStat.size,
  };
}

function inferImportSourceName(files: NormalizedImportFile[], manifest: BackupManifest) {
  const parentNames = files
    .map((file) => (file.originalParts.length > 1 ? file.originalParts[file.originalParts.length - 2] : null))
    .filter((value): value is string => Boolean(value));
  const uniqueParents = new Set(parentNames);
  if (uniqueParents.size === 1) {
    return parentNames[0];
  }

  if (manifest.createdAt) {
    const createdAt = new Date(manifest.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      return `backup_${createdAt.toISOString().replace(/\D/gu, "").slice(0, 14)}`;
    }
  }

  return "backup";
}

function sanitizeBackupFolderPart(value: string | null | undefined) {
  const sanitized = (value ?? "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_.-]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 56);
  return sanitized || "backup";
}

async function createImportDestination(backupRoot: string, backupType: BackupJobType, files: NormalizedImportFile[], manifest: BackupManifest) {
  const typeDir = getTypeDir(backupType);
  const scheduleFrequency =
    backupType === BackupJobType.SCHEDULED ? scheduledFrequencyFromManifest(manifest.scheduleFrequency) ?? "daily" : null;
  const stamp = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const sourceName = sanitizeBackupFolderPart(inferImportSourceName(files, manifest));
  const suffix = randomUUID().replace(/-/gu, "").slice(0, 8);
  const folderName = `imported_${stamp}_${sourceName}_${suffix}`;
  const relativeFolderName = scheduleFrequency ? path.join(scheduleFrequency, folderName) : folderName;
  const destinationDir = path.join(backupRoot, typeDir, relativeFolderName);
  assertPathInsideRoot(destinationDir, backupRoot);
  await mkdir(path.dirname(destinationDir), { recursive: true });
  await mkdir(destinationDir);
  return { typeDir, folderName: relativeFolderName, destinationDir, scheduleFrequency };
}

type PostgresToolName = "pg_dump" | "createdb" | "dropdb" | "pg_restore" | "psql";

function resolvePostgresToolPath(name: PostgresToolName, override?: string | null) {
  if (override) return override;
  if (process.platform !== "win32") return null;

  const roots = ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL"];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

    for (const version of versions) {
      const candidate = path.join(root, version, "bin", `${name}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function resolvePgDumpPath() {
  return resolvePostgresToolPath("pg_dump", env.ATLASGYM_PG_DUMP_PATH);
}

function resolveRestoreToolPaths() {
  const createdbPath = resolvePostgresToolPath("createdb", env.ATLASGYM_CREATEDB_PATH);
  const dropdbPath = resolvePostgresToolPath("dropdb", env.ATLASGYM_DROPDB_PATH);
  const pgRestorePath = resolvePostgresToolPath("pg_restore", env.ATLASGYM_PG_RESTORE_PATH);
  const psqlPath = resolvePostgresToolPath("psql", env.ATLASGYM_PSQL_PATH);
  return {
    createdbPath,
    dropdbPath,
    pgRestorePath,
    psqlPath,
    available: Boolean(createdbPath && dropdbPath && pgRestorePath && psqlPath),
  };
}

function decodeManifestBuffer(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

function parseManifest(raw: string): BackupManifest {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid backup manifest");
  }
  return parsed as BackupManifest;
}

function serializeJob(job: BackupJobRow) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    verificationStatus: job.verificationStatus,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    verifiedAt: job.verifiedAt?.toISOString() ?? null,
    location: job.location,
    backupRoot: job.backupRoot,
    manifestPath: job.manifestPath,
    logPath: job.logPath,
    scheduleFrequency: job.scheduleFrequency,
    sizeBytes: job.sizeBytes?.toString() ?? null,
    sha256: job.sha256,
    errorMessage: job.errorMessage,
    triggeredBy: job.triggeredBy
      ? {
          id: job.triggeredBy.id,
          username: job.triggeredBy.username,
          fullName: job.triggeredBy.fullName,
          role: job.triggeredBy.role,
        }
      : null,
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeRestoreJob(job: RestoreJobRow) {
  return {
    id: job.id,
    status: job.status,
    selectedBackupId: job.selectedBackupId,
    selectedBackupPath: job.selectedBackupPath,
    selectedBackupFolderName: job.selectedBackupFolderName,
    selectedBackupSha256: job.selectedBackupSha256,
    selectedBackupSizeBytes: job.selectedBackupSizeBytes?.toString() ?? null,
    restoreTestDatabase: job.restoreTestDatabase,
    restoreTestPassedAt: job.restoreTestPassedAt?.toISOString() ?? null,
    restoreTestReportPath: job.restoreTestReportPath,
    emergencyBackupJobId: job.emergencyBackupJobId,
    emergencyBackupPath: job.emergencyBackupPath,
    handoffPath: job.handoffPath,
    restoreScriptPath: job.restoreScriptPath,
    restoreCommand: job.restoreCommand,
    maintenanceStartedAt: job.maintenanceStartedAt?.toISOString() ?? null,
    maintenanceEndedAt: job.maintenanceEndedAt?.toISOString() ?? null,
    productionRestoreReportPath: job.productionRestoreReportPath,
    productionRestoreStatus: job.productionRestoreStatus,
    productionRestoreCompletedAt: job.productionRestoreCompletedAt?.toISOString() ?? null,
    postRestoreCheckedAt: job.postRestoreCheckedAt?.toISOString() ?? null,
    postRestoreSummary: job.postRestoreSummary,
    requestedBy: job.requestedBy
      ? {
          id: job.requestedBy.id,
          username: job.requestedBy.username,
          fullName: job.requestedBy.fullName,
          role: job.requestedBy.role,
        }
      : null,
    requestedAt: job.requestedAt.toISOString(),
    preparedAt: job.preparedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    emergencyBackupJob: job.emergencyBackupJob ? serializeJob(job.emergencyBackupJob) : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeOperationRun(run: OperationRunRow) {
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    step: run.step,
    percent: run.percent,
    message: run.message,
    errorMessage: run.errorMessage,
    targetType: run.targetType,
    targetId: run.targetId,
    result: run.result,
    metadata: run.metadata,
    startedBy: run.startedBy
      ? {
          id: run.startedBy.id,
          username: run.startedBy.username,
          fullName: run.startedBy.fullName,
          role: run.startedBy.role,
        }
      : null,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function clampOperationPercent(percent: number) {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

type OperationRunCreateInput = {
  type: OperationRunType;
  step: string;
  percent: number;
  message?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
};

type OperationRunUpdateInput = {
  status?: OperationRunStatus;
  step?: string | null;
  percent?: number;
  message?: string | null;
  errorMessage?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  result?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  finishedAt?: Date | null;
};

async function createOperationRun(input: OperationRunCreateInput, context: BackupActionContext) {
  const data: Prisma.OperationRunUncheckedCreateInput = {
    type: input.type,
    status: OperationRunStatus.RUNNING,
    step: input.step,
    percent: clampOperationPercent(input.percent),
    startedById: context.actor.id,
    startedAt: new Date(),
  };

  if (input.message !== undefined) data.message = input.message;
  if (input.targetType !== undefined) data.targetType = input.targetType;
  if (input.targetId !== undefined) data.targetId = input.targetId;
  if (input.metadata !== undefined) data.metadata = input.metadata;

  return prisma.operationRun.create({
    data,
    select: operationRunSelect,
  });
}

async function updateOperationRun(id: string | null | undefined, input: OperationRunUpdateInput) {
  if (!id) return null;

  const data: Prisma.OperationRunUncheckedUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.step !== undefined) data.step = input.step;
  if (input.percent !== undefined) data.percent = clampOperationPercent(input.percent);
  if (input.message !== undefined) data.message = input.message;
  if (input.errorMessage !== undefined) data.errorMessage = input.errorMessage;
  if (input.targetType !== undefined) data.targetType = input.targetType;
  if (input.targetId !== undefined) data.targetId = input.targetId;
  if (input.result !== undefined) data.result = input.result;
  if (input.metadata !== undefined) data.metadata = input.metadata;
  if (input.finishedAt !== undefined) data.finishedAt = input.finishedAt;

  return prisma.operationRun.update({
    where: { id },
    data,
    select: operationRunSelect,
  }).catch((error: unknown) => {
    logger.warn("Unable to update operation run", {
      operationRunId: id,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
}

async function finishOperationRun(id: string | null | undefined, input: Omit<OperationRunUpdateInput, "status" | "finishedAt"> = {}) {
  return updateOperationRun(id, {
    ...input,
    status: OperationRunStatus.SUCCEEDED,
    percent: input.percent ?? 100,
    finishedAt: new Date(),
  });
}

async function failOperationRun(id: string | null | undefined, errorMessage: string, input: Omit<OperationRunUpdateInput, "status" | "errorMessage" | "finishedAt"> = {}) {
  return updateOperationRun(id, {
    ...input,
    status: OperationRunStatus.FAILED,
    errorMessage,
    finishedAt: new Date(),
  });
}

async function getActiveOperationRuns() {
  const runs = await prisma.operationRun.findMany({
    where: { status: { in: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING] } },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 10,
    select: operationRunSelect,
  });
  return runs.map(serializeOperationRun);
}

async function reconcileStaleOperationRuns(now = new Date()) {
  const staleAfterMs = Math.max(env.ATLASGYM_BACKUP_TIMEOUT_MS * 4, 15 * 60_000);
  const cutoff = new Date(now.getTime() - staleAfterMs);
  return prisma.operationRun.updateMany({
    where: {
      status: { in: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING] },
      updatedAt: { lt: cutoff },
    },
    data: {
      status: OperationRunStatus.FAILED,
      step: "interrupted",
      percent: 100,
      message: "Operation was interrupted before the application restarted.",
      errorMessage: "Operation was marked failed after exceeding the stale-operation window.",
      finishedAt: now,
    },
  });
}

async function cleanupOrphanBackupImportExtractionDirs(now = new Date()) {
  const tempRoot = path.resolve(os.tmpdir());
  const staleAfterMs = Math.max(env.ATLASGYM_BACKUP_TIMEOUT_MS * 4, 15 * 60_000);
  const entries = await readdir(tempRoot, { withFileTypes: true });
  let deletedCount = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(BACKUP_IMPORT_ZIP_TEMP_BASE_PREFIX)) continue;
    const candidate = path.resolve(tempRoot, entry.name);
    const relative = path.relative(tempRoot, candidate);
    if (!relative || path.isAbsolute(relative) || relative.includes(path.sep)) continue;
    const candidateStat = await stat(candidate).catch(() => null);
    if (!candidateStat || now.getTime() - candidateStat.mtimeMs <= staleAfterMs) continue;
    await rm(candidate, { recursive: true, force: true });
    deletedCount += 1;
  }
  return deletedCount;
}

export async function getOperationRun(id: string) {
  const run = await prisma.operationRun.findUnique({ where: { id }, select: operationRunSelect });
  if (!run) {
    throw new HttpError(404, "Operation run not found");
  }
  return serializeOperationRun(run);
}

async function findLatestRestoreOperationRunId(restoreJobId: string) {
  const run = await prisma.operationRun.findFirst({
    where: {
      type: OperationRunType.PREPARE_RECOVERY,
      targetType: "RestoreJob",
      targetId: restoreJobId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
  return run?.id ?? null;
}

async function findLatestOperationRunForTarget(input: {
  type: OperationRunType;
  targetType: string;
  targetId: string;
  statuses?: OperationRunStatus[];
}) {
  const run = await prisma.operationRun.findFirst({
    where: {
      type: input.type,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.statuses?.length ? { status: { in: input.statuses } } : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: operationRunSelect,
  });
  return run;
}

async function finishLatestOperationRunForTarget(
  input: {
    type: OperationRunType;
    targetType: string;
    targetId: string;
    statuses?: OperationRunStatus[];
  },
  update: Omit<OperationRunUpdateInput, "status" | "finishedAt"> = {}
) {
  const run = await findLatestOperationRunForTarget(input);
  return finishOperationRun(run?.id, update);
}

async function failLatestOperationRunForTarget(
  input: {
    type: OperationRunType;
    targetType: string;
    targetId: string;
    statuses?: OperationRunStatus[];
  },
  errorMessage: string,
  update: Omit<OperationRunUpdateInput, "status" | "errorMessage" | "finishedAt"> = {}
) {
  const run = await findLatestOperationRunForTarget(input);
  return failOperationRun(run?.id, errorMessage, update);
}

async function updateLatestRestoreOperationRun(restoreJobId: string, input: OperationRunUpdateInput) {
  return updateOperationRun(await findLatestRestoreOperationRunId(restoreJobId), input);
}

async function finishLatestRestoreOperationRun(restoreJobId: string, input: Omit<OperationRunUpdateInput, "status" | "finishedAt"> = {}) {
  return finishOperationRun(await findLatestRestoreOperationRunId(restoreJobId), input);
}

function serializeBackupItem(info: BackupFolderInfo, job?: BackupJobRow | null) {
  return {
    id: info.id,
    jobId: job?.id ?? null,
    type: job?.type ?? info.type,
    status: job?.status ?? BackupStatus.COMPLETED,
    verificationStatus: job?.verificationStatus ?? BackupVerificationStatus.NOT_VERIFIED,
    folderName: info.folderName,
    relativePath: info.relativePath,
    scheduleFrequency: job?.scheduleFrequency ?? info.scheduleFrequency,
    location: info.location,
    createdAt: info.createdAt.toISOString(),
    startedAt: job?.startedAt.toISOString() ?? info.createdAt.toISOString(),
    finishedAt: job?.finishedAt?.toISOString() ?? null,
    verifiedAt: job?.verifiedAt?.toISOString() ?? null,
    sizeBytes: (job?.sizeBytes ?? info.sizeBytes)?.toString() ?? null,
    sha256: job?.sha256 ?? info.sha256,
    databaseName: info.databaseName,
    schema: info.schema,
    operator: info.operator,
    notes: info.notes,
    hasManifest: info.hasManifest,
    hasDump: info.hasDump,
    errorMessage: job?.errorMessage ?? null,
    restoreSidecarSummary: EMPTY_RESTORE_SIDECAR_SUMMARY,
    triggeredBy: job?.triggeredBy
      ? {
          id: job.triggeredBy.id,
          username: job.triggeredBy.username,
          fullName: job.triggeredBy.fullName,
          role: job.triggeredBy.role,
        }
      : null,
  };
}

function serializeSyntheticJob(job: BackupJobRow) {
  return {
    id: `job:${job.id}`,
    jobId: job.id,
    type: job.type,
    status: job.status,
    verificationStatus: job.verificationStatus,
    folderName: null,
    relativePath: null,
    scheduleFrequency: job.scheduleFrequency,
    location: job.location,
    createdAt: job.startedAt.toISOString(),
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    verifiedAt: job.verifiedAt?.toISOString() ?? null,
    sizeBytes: job.sizeBytes?.toString() ?? null,
    sha256: job.sha256,
    databaseName: null,
    schema: null,
    operator: null,
    notes: null,
    hasManifest: Boolean(job.manifestPath),
    hasDump: Boolean(job.location),
    errorMessage: job.errorMessage,
    restoreSidecarSummary: EMPTY_RESTORE_SIDECAR_SUMMARY,
    triggeredBy: job.triggeredBy
      ? {
          id: job.triggeredBy.id,
          username: job.triggeredBy.username,
          fullName: job.triggeredBy.fullName,
          role: job.triggeredBy.role,
        }
      : null,
  };
}

type BackupListItem = ReturnType<typeof serializeBackupItem> | ReturnType<typeof serializeSyntheticJob>;

type BackupSupportPackageFile = {
  name: string;
  path: string;
  sizeBytes: string;
  sha256: string | null;
};

type BackupSupportPackageArchive = {
  fileName: string;
  path: string;
  sizeBytes: string;
  sha256: string;
};

async function writeBackupAudit(input: {
  context: BackupActionContext;
  action: string;
  targetId: string;
  success: boolean;
  targetType?: string | undefined;
  metadata?: Prisma.InputJsonObject | undefined;
}) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: input.context.actor.id,
    actorRole: input.context.actor.role,
    action: input.action,
    targetType: input.targetType ?? "BackupJob",
    targetId: input.targetId,
    success: input.success,
  };

  if (input.context.actor.sessionId) data.sessionId = input.context.actor.sessionId;
  if (input.context.meta.ipAddress) data.ipAddress = input.context.meta.ipAddress;
  if (input.context.meta.userAgent) data.userAgent = input.context.meta.userAgent;
  if (input.metadata) data.metadata = input.metadata;

  await prisma.auditLog.create({ data });
}

async function writeSystemBackupAudit(input: {
  action: string;
  targetId: string;
  success: boolean;
  targetType?: string | undefined;
  metadata?: Prisma.InputJsonObject | undefined;
}) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.SYSTEM,
    action: input.action,
    targetType: input.targetType ?? "BackupJob",
    targetId: input.targetId,
    success: input.success,
  };
  if (input.metadata) data.metadata = input.metadata;
  await prisma.auditLog.create({ data });
}

async function writeOptionalBackupAudit(input: {
  context?: BackupActionContext | null | undefined;
  action: string;
  targetId: string;
  success: boolean;
  targetType?: string | undefined;
  metadata?: Prisma.InputJsonObject | undefined;
}) {
  if (input.context) {
    await writeBackupAudit({
      context: input.context,
      action: input.action,
      targetId: input.targetId,
      success: input.success,
      targetType: input.targetType,
      metadata: input.metadata,
    });
    return;
  }

  await writeSystemBackupAudit({
    action: input.action,
    targetId: input.targetId,
    success: input.success,
    targetType: input.targetType,
    metadata: input.metadata,
  });
}

async function readManifestIfPresent(manifestPath: string) {
  try {
    return parseManifest(decodeManifestBuffer(await readFile(manifestPath)));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return null;
    }
    logger.warn("Unable to read backup manifest", { manifestPath, message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

function resolveBackupDumpPath(folderPath: string, manifest: BackupManifest | null) {
  const dumpFileName = manifest?.fileName ?? "database.dump";
  if (dumpFileName !== "database.dump") {
    throw new Error("Backup manifest references an unsupported dump file name");
  }

  const dumpPath = path.resolve(folderPath, dumpFileName);
  assertPathInsideRoot(dumpPath, folderPath);
  return dumpPath;
}

async function readBackupFolder(root: string, typeDir: string, folderName: string, fallbackType: BackupJobType): Promise<BackupFolderInfo> {
  const relativePath = backupRelativePathFromParts(typeDir, folderName);
  const folderPath = path.resolve(root, ...relativePath.split("/"));
  assertPathInsideRoot(folderPath, root);

  const manifestPath = path.join(folderPath, "manifest.json");
  const logPath = path.join(folderPath, "backup.log");
  const manifest = await readManifestIfPresent(manifestPath);
  const dumpPath = resolveBackupDumpPath(folderPath, manifest);

  const [folderStat, dumpStat] = await Promise.all([
    stat(folderPath),
    stat(dumpPath).catch((error: unknown) => {
      if (isNodeError(error, "ENOENT")) return null;
      throw error;
    }),
  ]);
  const createdAt = manifest?.createdAt ? new Date(manifest.createdAt) : folderStat.mtime;

  return {
    id: encodeBackupId(relativePath),
    type: typeFromManifest(manifest?.backupType, fallbackType),
    relativePath,
    typeDir,
    folderName: path.basename(folderPath),
    scheduleFrequency:
      typeFromManifest(manifest?.backupType, fallbackType) === BackupJobType.SCHEDULED
        ? inferScheduledFrequencyFromRelativePath(relativePath, manifest)
        : null,
    location: folderPath,
    manifestPath,
    logPath,
    dumpPath,
    hasManifest: Boolean(manifest),
    hasDump: Boolean(dumpStat),
    createdAt: Number.isNaN(createdAt.getTime()) ? folderStat.mtime : createdAt,
    sizeBytes: typeof manifest?.sizeBytes === "number" ? BigInt(manifest.sizeBytes) : dumpStat ? BigInt(dumpStat.size) : null,
    sha256: manifest?.sha256 ?? null,
    databaseName: manifest?.databaseName ?? null,
    schema: manifest?.schema ?? null,
    operator: manifest?.operator ?? null,
    notes: manifest?.notes ?? null,
  };
}

async function readBackupFolderById(root: string, id: string) {
  const decoded = decodeBackupId(id);
  const relativeParts = decoded.relativePath.split("/");
  const folderName = relativeParts.slice(1).join("/");
  return readBackupFolder(root, decoded.typeDir, folderName, getFallbackTypeForRelativePath(decoded.relativePath));
}

async function scanBackupRoot(root: string) {
  const items: BackupFolderInfo[] = [];

  const pushFolder = async (typeDir: string, folderName: string, fallbackType: BackupJobType) => {
    try {
      items.push(await readBackupFolder(root, typeDir, folderName, fallbackType));
    } catch (error) {
      logger.warn("Skipping unreadable backup folder", {
        folder: path.join(root, typeDir, folderName),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  for (const entry of BACKUP_TYPE_DIRS) {
    const typePath = path.join(root, entry.dir);
    let folders;
    try {
      folders = await readdir(typePath, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error, "ENOENT")) continue;
      throw error;
    }

    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      if (entry.dir === SCHEDULED_BACKUP_DIR && (SCHEDULED_BACKUP_FREQUENCY_DIRS as readonly string[]).includes(folder.name)) {
        const bucketPath = path.join(typePath, folder.name);
        const bucketFolders = await readdir(bucketPath, { withFileTypes: true }).catch((error: unknown) => {
          if (isNodeError(error, "ENOENT")) return [];
          throw error;
        });
        for (const bucketFolder of bucketFolders) {
          if (!bucketFolder.isDirectory()) continue;
          await pushFolder(entry.dir, path.join(folder.name, bucketFolder.name), entry.type);
        }
        continue;
      }

      await pushFolder(entry.dir, folder.name, entry.type);
    }
  }

  return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

async function getBackupJobs(limit = 100) {
  return prisma.backupJob.findMany({
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: limit,
    select: backupJobSelect,
  });
}

async function getLatestScheduledBackupAtForFrequency(root: string, frequency: BackupScheduleFrequency) {
  const [latestJob, folders] = await Promise.all([
    prisma.backupJob.findFirst({
      where: { type: BackupJobType.SCHEDULED, status: BackupStatus.COMPLETED, scheduleFrequency: frequency },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true },
    }),
    scanBackupRoot(root),
  ]);
  const latestFolder = folders
    .filter((item) => item.type === BackupJobType.SCHEDULED && item.scheduleFrequency === frequency)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  const candidates = [latestJob?.startedAt ?? null, latestFolder?.createdAt ?? null].filter((value): value is Date => Boolean(value));
  return candidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

function normalizePathKey(value: string | null | undefined) {
  if (!value) return null;
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function normalizeRestoreMaintenance(value: unknown): RestoreMaintenanceState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return INACTIVE_RESTORE_MAINTENANCE;
  }
  const record = value as Record<string, unknown>;
  return {
    enabled: record["enabled"] === true,
    restoreJobId: typeof record["restoreJobId"] === "string" ? record["restoreJobId"] : null,
    startedAt: typeof record["startedAt"] === "string" ? record["startedAt"] : null,
    startedById: typeof record["startedById"] === "string" ? record["startedById"] : null,
    startedByRole: typeof record["startedByRole"] === "string" && record["startedByRole"] in AdminRole ? (record["startedByRole"] as AdminRole) : null,
    reason: typeof record["reason"] === "string" ? record["reason"] : null,
    selectedBackupFolderName: typeof record["selectedBackupFolderName"] === "string" ? record["selectedBackupFolderName"] : null,
    selectedBackupPath: typeof record["selectedBackupPath"] === "string" ? record["selectedBackupPath"] : null,
    emergencyBackupPath: typeof record["emergencyBackupPath"] === "string" ? record["emergencyBackupPath"] : null,
    handoffPath: typeof record["handoffPath"] === "string" ? record["handoffPath"] : null,
  };
}

async function readRestoreMaintenanceState() {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: RESTORE_MAINTENANCE_SETTING_KEY },
    select: { value: true, updatedAt: true },
  });
  if (!setting) {
    return {
      ...INACTIVE_RESTORE_MAINTENANCE,
      updatedAt: null,
    };
  }

  try {
    return {
      ...normalizeRestoreMaintenance(JSON.parse(setting.value)),
      updatedAt: setting.updatedAt.toISOString(),
    };
  } catch {
    return {
      ...INACTIVE_RESTORE_MAINTENANCE,
      updatedAt: setting.updatedAt.toISOString(),
    };
  }
}

async function writeRestoreMaintenanceState(state: RestoreMaintenanceState, context: BackupActionContext) {
  const value = JSON.stringify(state);
  const updatedAt = new Date();

  await prisma.systemSetting.upsert({
    where: { key: RESTORE_MAINTENANCE_SETTING_KEY },
    update: {
      value,
      valueType: SettingValueType.JSON,
      updatedById: context.actor.id,
      updatedAt,
    },
    create: {
      key: RESTORE_MAINTENANCE_SETTING_KEY,
      value,
      valueType: SettingValueType.JSON,
      updatedById: context.actor.id,
      updatedAt,
    },
  });

  if (state.enabled) {
    await suspendRuntimeForRestoreMaintenance();
  } else {
    await resumeRuntimeAfterRestoreMaintenance();
  }
}

export async function getRestoreMaintenanceStatus() {
  return readRestoreMaintenanceState();
}

function filterBackupItem(item: ReturnType<typeof serializeBackupItem> | ReturnType<typeof serializeSyntheticJob>, query: BackupListQuery) {
  if (query.status && item.status !== query.status) return false;
  if (!query.search) return true;
  const search = query.search.toLowerCase();
  const haystack = [
    item.folderName,
    item.relativePath,
    item.location,
    item.scheduleFrequency,
    item.sha256,
    item.databaseName,
    item.schema,
    item.operator,
    item.notes,
    item.errorMessage,
    item.triggeredBy?.username,
    item.triggeredBy?.fullName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function summarizeRestoreSidecars(sidecars: Awaited<ReturnType<typeof readRestoreSidecars>>): RestoreSidecarSummary {
  const latestHandoff = sidecars.handoffs[0] ?? null;
  const latestReport = sidecars.reports[0] ?? null;
  const latestPostCheck = sidecars.postChecks[0] ?? null;
  return {
    hasHandoff: Boolean(latestHandoff),
    handoffCreatedAt: latestHandoff?.createdAt ?? null,
    productionRestoreStatus: latestReport?.status ?? null,
    productionRestoreCompletedAt: latestReport?.completedAt ?? null,
    postRestoreStatus: latestPostCheck?.status ?? null,
    postRestoreCheckedAt: latestPostCheck?.checkedAt ?? null,
  };
}

async function enrichBackupListItemWithRestoreSummary(item: BackupListItem): Promise<BackupListItem> {
  if (!item.location) return item;
  try {
    return {
      ...item,
      restoreSidecarSummary: summarizeRestoreSidecars(await readRestoreSidecars(item.location)),
    };
  } catch (error) {
    logger.warn("Unable to read backup restore sidecar summary", {
      location: item.location,
      message: error instanceof Error ? error.message : String(error),
    });
    return item;
  }
}

export async function getBackupSettings() {
  const root = getBackupRoot();
  const pgDumpPath = resolvePgDumpPath();
  const restoreTools = resolveRestoreToolPaths();
  const rootStat = await stat(root).catch((error: unknown) => {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  });
  const scriptStat = await stat(BACKUP_SCRIPT_PATH).catch((error: unknown) => {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  });

  const activeJob = await prisma.backupJob.findFirst({
    where: { status: BackupStatus.RUNNING },
    orderBy: { startedAt: "desc" },
    select: backupJobSelect,
  });

  return {
    backupRoot: root,
    rootExists: Boolean(rootStat?.isDirectory()),
    scriptPath: BACKUP_SCRIPT_PATH,
    scriptExists: Boolean(scriptStat?.isFile()),
    pgDumpPath,
    pgDumpAvailable: Boolean(pgDumpPath),
    restoreTools,
    timeoutMs: env.ATLASGYM_BACKUP_TIMEOUT_MS,
    activeJob: activeJob ? serializeJob(activeJob) : null,
    activeOperationRuns: await getActiveOperationRuns(),
    restoreMaintenance: await getRestoreMaintenanceStatus(),
    storage: await getBackupStorageStatus(),
    schedule: await getBackupScheduleStatus(),
    externalCopy: {
      availableDrives: await listExternalBackupDrives(),
    } satisfies BackupExternalCopyStatusSummary,
  };
}

async function readRetentionState(root = getBackupRoot()) {
  const statePath = getRetentionStatePath(root);
  try {
    const parsed = JSON.parse(await readFile(statePath, "utf8")) as unknown;
    if (!isRecord(parsed)) return { lastCleanupAt: null };
    return {
      lastCleanupAt: typeof parsed["lastCleanupAt"] === "string" ? parsed["lastCleanupAt"] : null,
    };
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return { lastCleanupAt: null };
    logger.warn("Unable to read backup retention state", {
      statePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return { lastCleanupAt: null };
  }
}

async function writeRetentionState(root = getBackupRoot()) {
  const statePath = getRetentionStatePath(root);
  await mkdir(root, { recursive: true });
  await writeFile(statePath, `${JSON.stringify({ lastCleanupAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

export async function getBackupScheduleStatus(): Promise<BackupScheduleStatus> {
  const root = getBackupRoot();
  const [{ config, configPath, exists }, latestScheduledBackup, latestVerifiedBackup, scheduledJobs, folderItems, retentionState] = await Promise.all([
    readBackupConfig(root),
    prisma.backupJob.findFirst({
      where: { type: BackupJobType.SCHEDULED, status: BackupStatus.COMPLETED },
      orderBy: { startedAt: "desc" },
      select: backupJobSelect,
    }),
    prisma.backupJob.findFirst({
      where: { status: BackupStatus.COMPLETED, verificationStatus: BackupVerificationStatus.VERIFIED },
      orderBy: [{ verifiedAt: "desc" }, { startedAt: "desc" }],
      select: backupJobSelect,
    }),
    prisma.backupJob.findMany({
      where: { type: BackupJobType.SCHEDULED, status: BackupStatus.COMPLETED },
      orderBy: { startedAt: "desc" },
      select: backupJobSelect,
    }),
    scanBackupRoot(root),
    readRetentionState(root),
  ]);
  const profiles = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, frequency) => {
    const profile = config.profiles[frequency];
    const latestJob = scheduledJobs.find((job) => job.scheduleFrequency === frequency) ?? null;
    const profileBackups = folderItems
      .filter((item) => item.type === BackupJobType.SCHEDULED && item.scheduleFrequency === frequency)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const latestFolder = profileBackups[0];
    const latestScheduledBackupAt =
      [latestJob?.startedAt ?? null, latestFolder?.createdAt ?? null]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const schedule = computeNextScheduledRun(profile, latestScheduledBackupAt, config.enabled);
    const keepCount = getRetentionKeepCount(config.retention, frequency);
    result[frequency] = {
      enabled: profile.enabled,
      frequency,
      nextRunAt: schedule.nextRunAt,
      dueNow: schedule.dueNow,
      scheduledBackups: profileBackups.length,
      keepCount,
      cleanupCandidates: Math.max(0, profileBackups.length - keepCount),
      lastScheduledBackup: latestJob ? serializeJob(latestJob) : null,
    };
    return result;
  }, {} as Record<BackupScheduleFrequency, BackupScheduleProfileStatus>);
  const nextProfileRun = BACKUP_SCHEDULE_FREQUENCIES.map((frequency) => profiles[frequency])
    .filter((profile) => profile.enabled && profile.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime())[0];
  const selectedProfileStatus = profiles[config.frequency];
  const latestVerifiedAt = latestVerifiedBackup?.verifiedAt?.toISOString() ?? latestVerifiedBackup?.startedAt.toISOString() ?? null;
  const lastCopiedAt = config.externalCopy.lastCopiedAt;
  const reminderDue = Boolean(
    config.externalCopy.enabled &&
      latestVerifiedAt &&
      (!lastCopiedAt || new Date(lastCopiedAt).getTime() < new Date(latestVerifiedAt).getTime())
  );

  return {
    configPath,
    configExists: exists,
    schedulerRunning: Boolean(backupSchedulerStop),
    config,
    nextRunAt: nextProfileRun?.nextRunAt ?? null,
    dueNow: BACKUP_SCHEDULE_FREQUENCIES.some((frequency) => profiles[frequency].dueNow),
    lastScheduledBackup: latestScheduledBackup ? serializeJob(latestScheduledBackup) : null,
    retention: {
      scheduledBackups: selectedProfileStatus.scheduledBackups,
      keepCount: selectedProfileStatus.keepCount,
      cleanupCandidates: selectedProfileStatus.cleanupCandidates,
      lastCleanupAt: retentionState["lastCleanupAt"],
    },
    profiles,
    externalCopy: {
      ...config.externalCopy,
      latestVerifiedBackupAt: latestVerifiedAt,
      reminderDue,
    },
  };
}

export async function updateBackupScheduleConfig(input: BackupScheduleConfigInput, context: BackupActionContext) {
  const root = getBackupRoot();
  const current = await readBackupConfig(root);
  const merged = mergeBackupConfig(current.config, input);
  const saved = await writeBackupConfig(merged);
  await writeBackupAudit({
    context,
    action: "backup.schedule.update",
    targetId: saved.configPath,
    targetType: "BackupConfig",
    success: true,
    metadata: {
      enabled: saved.config.enabled,
      frequency: saved.config.frequency,
      dailyTime: saved.config.dailyTime,
      schedule: saved.config.schedule,
      profiles: saved.config.profiles,
      retention: saved.config.retention,
      externalCopy: {
        enabled: saved.config.externalCopy.enabled,
        lastTarget: saved.config.externalCopy.lastTarget,
      },
    },
  });
  return getBackupScheduleStatus();
}

export async function listBackups(query: BackupListQuery) {
  const root = getBackupRoot();
  const [folderItems, jobs] = await Promise.all([scanBackupRoot(root), getBackupJobs()]);
  const jobsByLocation = new Map<string, BackupJobRow>();

  for (const job of jobs) {
    const key = normalizePathKey(job.location);
    if (key) jobsByLocation.set(key, job);
  }

  const usedJobIds = new Set<string>();
  const items: BackupListItem[] = folderItems.map((item) => {
    const job = jobsByLocation.get(normalizePathKey(item.location) ?? "");
    if (job) usedJobIds.add(job.id);
    return serializeBackupItem(item, job ?? null);
  });

  for (const job of jobs) {
    if (usedJobIds.has(job.id)) continue;
    if (job.status === BackupStatus.RUNNING || job.status === BackupStatus.FAILED || job.location) {
      items.push(serializeSyntheticJob(job));
    }
  }

  const filtered = items
    .filter((item) => filterBackupItem(item, query))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  const total = filtered.length;
  const start = (query.page - 1) * query.limit;
  const paged = filtered.slice(start, start + query.limit);
  const enriched = await Promise.all(paged.map((item) => enrichBackupListItemWithRestoreSummary(item)));

  return {
    items: enriched,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    settings: await getBackupSettings(),
  };
}

export async function getBackupJob(id: string) {
  const job = await prisma.backupJob.findUnique({ where: { id }, select: backupJobSelect });
  if (!job) {
    throw new HttpError(404, "Backup job not found");
  }
  return serializeJob(job);
}

export async function getRestoreJob(id: string) {
  const job = await prisma.restoreJob.findUnique({ where: { id }, select: restoreJobSelect });
  if (!job) {
    throw new HttpError(404, "Restore job not found");
  }
  return serializeRestoreJob(job);
}

async function readRestoreSidecars(folderPath: string) {
  const entries = await readdir(folderPath, { withFileTypes: true }).catch((error: unknown) => {
    if (isNodeError(error, "ENOENT")) return [];
    throw error;
  });

  const handoffs: RestoreSidecarHandoff[] = [];
  const reports: RestoreSidecarReport[] = [];
  const postChecks: RestoreSidecarPostCheck[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^(production-restore-(handoff|report)|post-restore-check)_[A-Za-z0-9_-]+\.json$/u.test(entry.name)) continue;

    const filePath = path.join(folderPath, entry.name);
    assertPathInsideRoot(filePath, folderPath);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > BACKUP_IMPORT_MAX_MANIFEST_BYTES) continue;

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(decodeManifestBuffer(await readFile(filePath)));
    } catch {
      parsed = null;
    }

    if (entry.name.startsWith("production-restore-handoff_")) {
      const handoff = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as RestoreHandoffFile) : {};
      handoffs.push({
        fileName: entry.name,
        path: filePath,
        createdAt: typeof handoff.createdAt === "string" ? handoff.createdAt : fileStat.mtime.toISOString(),
        restoreJobId: typeof handoff.restoreJobId === "string" ? handoff.restoreJobId : null,
        selectedBackupFolderName: handoff.selectedBackup?.folderName ?? null,
      });
    } else if (entry.name.startsWith("production-restore-report_")) {
      const report = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as ProductionRestoreReport) : {};
      reports.push({
        fileName: entry.name,
        path: filePath,
        status: typeof report.status === "string" ? report.status : null,
        completedAt: typeof report.completedAt === "string" ? report.completedAt : fileStat.mtime.toISOString(),
        sourceBackup: typeof report.sourceBackup === "string" ? report.sourceBackup : null,
        sourceSha256: typeof report.sourceSha256 === "string" ? report.sourceSha256 : null,
        databaseName: typeof report.databaseName === "string" ? report.databaseName : null,
        migrationReminder: typeof report.migrationReminder === "string" ? report.migrationReminder : null,
      });
    } else if (entry.name.startsWith("post-restore-check_")) {
      const check = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as PostRestoreCheckFile) : {};
      postChecks.push({
        fileName: entry.name,
        path: filePath,
        status: typeof check.status === "string" ? check.status : null,
        checkedAt: typeof check.checkedAt === "string" ? check.checkedAt : fileStat.mtime.toISOString(),
        sourceBackup: typeof check.sourceBackup?.folderName === "string" ? check.sourceBackup.folderName : null,
        sourceSha256: typeof check.sourceBackup?.sha256 === "string" ? check.sourceBackup.sha256 : null,
        productionReportFileName:
          typeof check.productionRestoreReport?.fileName === "string" ? check.productionRestoreReport.fileName : null,
        checks: Array.isArray(check.checks) ? check.checks.slice(0, 24) : [],
      });
    }
  }

  const byNewest = <T extends { createdAt?: string | null; completedAt?: string | null; checkedAt?: string | null }>(a: T, b: T) =>
    new Date(b.createdAt ?? b.completedAt ?? b.checkedAt ?? 0).getTime() -
    new Date(a.createdAt ?? a.completedAt ?? a.checkedAt ?? 0).getTime();

  return {
    handoffs: handoffs.sort(byNewest).slice(0, 5),
    reports: reports.sort(byNewest).slice(0, 5),
    postChecks: postChecks.sort(byNewest).slice(0, 5),
  };
}

export async function getBackupDetails(id: string) {
  if (id.startsWith("job:")) {
    return {
      job: await getBackupJob(id.slice(4)),
      backup: null,
      manifest: null,
      logLines: [],
      restoreSidecars: { handoffs: [], reports: [], postChecks: [] },
      restoreJob: null,
    };
  }

  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  const job = await prisma.backupJob.findFirst({
    where: { location: info.location },
    orderBy: { startedAt: "desc" },
    select: backupJobSelect,
  });
  const manifest = await readManifestIfPresent(info.manifestPath);
  const logLines = await readLogLines(info.logPath);
  const restoreSidecars = await readRestoreSidecars(info.location);
  const restoreJob = await prisma.restoreJob.findFirst({
    where: { selectedBackupId: id },
    orderBy: { requestedAt: "desc" },
    select: restoreJobSelect,
  });

  return {
    backup: serializeBackupItem(info, job),
    job: job ? serializeJob(job) : null,
    manifest,
    logLines,
    restoreSidecars,
    restoreJob: restoreJob ? serializeRestoreJob(restoreJob) : null,
  };
}

export async function startManualBackup(input: BackupCreateInput, context: BackupActionContext) {
  if (activeBackupJobId) {
    throw new HttpError(409, "A backup is already running", { activeBackupJobId });
  }
  activeBackupJobId = "starting";

  try {
    const backupRoot = getBackupRoot();
    await assertNoRunningBackup();
    const job = await prisma.backupJob.create({
      data: {
        type: BackupJobType.MANUAL,
        status: BackupStatus.RUNNING,
        backupRoot,
        triggeredById: context.actor.id,
      },
      select: backupJobSelect,
    });

    activeBackupJobId = job.id;
    const operationRun = await createOperationRun(
      {
        type: OperationRunType.SAFE_BACKUP,
        step: "creating",
        percent: 18,
        message: "Creating safe backup",
        targetType: "BackupJob",
        targetId: job.id,
        metadata: {
          backupRoot,
          notes: input.notes ?? null,
        },
      },
      context
    );
    await writeBackupAudit({
      context,
      action: "backup.manual.start",
      targetId: job.id,
      success: true,
      metadata: { backupRoot },
    });

    void runBackupJob(job.id, backupRoot, input, context, operationRun.id).catch((error: unknown) => {
      logger.error("Backup job runner failed", {
        jobId: job.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      ...serializeJob(job),
      operationRun: serializeOperationRun(operationRun),
    };
  } catch (error) {
    activeBackupJobId = null;
    throw error;
  }
}

export async function startScheduledBackupNow(context: BackupActionContext, frequency?: BackupScheduleFrequency) {
  const job = await startScheduledBackup("manual-trigger", context, frequency);
  return { job: serializeJob(job) };
}

async function startScheduledBackup(
  source: "scheduler" | "manual-trigger",
  context?: BackupActionContext | null,
  frequency?: BackupScheduleFrequency
): Promise<BackupJobRow> {
  if (activeBackupJobId) {
    throw new HttpError(409, "A backup is already running", { activeBackupJobId });
  }
  activeBackupJobId = "starting";

  try {
    const backupRoot = getBackupRoot();
    await assertNoRunningBackup();
    const { config } = await readBackupConfig(backupRoot);
    const scheduleFrequency = frequency ?? config.frequency;
    const data: Prisma.BackupJobUncheckedCreateInput = {
      type: BackupJobType.SCHEDULED,
      status: BackupStatus.RUNNING,
      backupRoot,
      scheduleFrequency,
    };
    if (context?.actor.id) data.triggeredById = context.actor.id;
    const job = await prisma.backupJob.create({
      data,
      select: backupJobSelect,
    });

    activeBackupJobId = job.id;
    await writeOptionalBackupAudit({
      context,
      action: "backup.scheduled.start",
      targetId: job.id,
      success: true,
      metadata: {
        backupRoot,
        source,
        scheduleFrequency,
      },
    });

    void runScheduledBackupJob(job.id, backupRoot, source, scheduleFrequency, context).catch((error: unknown) => {
      logger.error("Scheduled backup job runner failed", {
        jobId: job.id,
        source,
        scheduleFrequency,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return job;
  } catch (error) {
    activeBackupJobId = null;
    throw error;
  }
}

export async function importBackupFiles(files: BackupImportUploadFile[], context: BackupActionContext) {
  if (activeBackupJobId) {
    throw new HttpError(409, "A backup is already running", { activeBackupJobId });
  }
  activeBackupJobId = "importing";

  let job: BackupJobRow | null = null;
  let operationRun: OperationRunRow | null = null;
  let destinationDir: string | null = null;
  let extractionDir: string | null = null;

  try {
    const backupRoot = getBackupRoot();
    await assertNoRunningBackup();
    job = await prisma.backupJob.create({
      data: {
        type: BackupJobType.MANUAL,
        status: BackupStatus.RUNNING,
        backupRoot,
        triggeredById: context.actor.id,
      },
      select: backupJobSelect,
    });
    activeBackupJobId = job.id;
    operationRun = await createOperationRun(
      {
        type: OperationRunType.IMPORT_BACKUP,
        step: "scanning",
        percent: 12,
        message: "Scanning selected backup files",
        targetType: "BackupJob",
        targetId: job.id,
        metadata: {
          fileCount: files.length,
          originalNames: files.map((file) => file.originalname).slice(0, 24),
        },
      },
      context
    );

    await writeBackupAudit({
      context,
      action: "backup.import.start",
      targetId: job.id,
      success: true,
      metadata: {
        fileCount: files.length,
        originalNames: files.map((file) => file.originalname).slice(0, 24),
      },
    });

    const preparedImport = await prepareImportFiles(files);
    extractionDir = preparedImport.extractionDir;
    await updateOperationRun(operationRun.id, {
      step: "checking",
      percent: 32,
      message: "Checking required backup files",
      metadata: {
        fileCount: preparedImport.files.length,
        sourceKind: preparedImport.sourceKind,
      },
    });
    const { dumpFile, manifestFile, logFile, optionalFileNames } = collectImportFiles(preparedImport.files);
    await assertImportSidecarSize(logFile, BACKUP_IMPORT_MAX_LOG_BYTES);
    const manifest = await readImportManifest(manifestFile);
    assertImportManifest(manifest);
    await updateOperationRun(operationRun.id, { step: "uploading", percent: 52, message: "Verifying backup hash and size" });
    const verification = await verifyImportedDump(dumpFile, manifest);
    const backupType = typeFromManifest(manifest.backupType, BackupJobType.MANUAL);
    const destination = await createImportDestination(backupRoot, backupType, [dumpFile, manifestFile, logFile], manifest);
    destinationDir = destination.destinationDir;
    await updateOperationRun(operationRun.id, { step: "registering", percent: 78, message: "Registering imported backup" });

    const destDumpPath = path.join(destinationDir, "database.dump");
    const destManifestPath = path.join(destinationDir, "manifest.json");
    const destLogPath = path.join(destinationDir, "backup.log");
    assertPathInsideRoot(destDumpPath, destinationDir);
    assertPathInsideRoot(destManifestPath, destinationDir);
    assertPathInsideRoot(destLogPath, destinationDir);
    await copyFile(dumpFile.path, destDumpPath);
    await copyFile(manifestFile.path, destManifestPath);
    await copyFile(logFile.path, destLogPath);

    const info = await readBackupFolder(backupRoot, destination.typeDir, destination.folderName, backupType);
    const verifiedAt = new Date();
    job = await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        type: backupType,
        status: BackupStatus.COMPLETED,
        verificationStatus: BackupVerificationStatus.VERIFIED,
        finishedAt: verifiedAt,
        verifiedAt,
        location: info.location,
        backupRoot,
        manifestPath: info.manifestPath,
        logPath: info.logPath,
        scheduleFrequency: info.scheduleFrequency,
        sizeBytes: BigInt(verification.actualSize),
        sha256: verification.actualHash,
        errorMessage: null,
      },
      select: backupJobSelect,
    });

    await writeBackupAudit({
      context,
      action: "backup.import.success",
      targetId: job.id,
      success: true,
      metadata: {
        location: info.location,
        backupType,
        scheduleFrequency: info.scheduleFrequency,
        sourceKind: preparedImport.sourceKind,
        sizeBytes: verification.actualSize.toString(),
        sha256: verification.actualHash,
        ignoredOptionalFiles: optionalFileNames,
      },
    });

    const serializedBackup = serializeBackupItem(info, job);
    const serializedJob = serializeJob(job);
    const finishedOperationRun = await finishOperationRun(operationRun.id, {
      step: "completed",
      message: "Backup import completed",
      result: {
        backupId: serializedBackup.id,
        backupJobId: job.id,
        sourceKind: preparedImport.sourceKind,
        location: info.location,
        sizeBytes: verification.actualSize.toString(),
        sha256: verification.actualHash,
      },
    });

    return {
      job: serializedJob,
      backup: serializedBackup,
      verification: {
        status: BackupVerificationStatus.VERIFIED,
        verifiedAt: verifiedAt.toISOString(),
        expectedHash: verification.expectedHash,
        actualHash: verification.actualHash,
        expectedSize: verification.expectedSize,
        actualSize: verification.actualSize,
      },
      operationRun: finishedOperationRun ? serializeOperationRun(finishedOperationRun) : serializeOperationRun(operationRun),
    };
  } catch (error) {
    if (destinationDir) {
      await rm(destinationDir, { recursive: true, force: true }).catch((cleanupError: unknown) => {
        logger.warn("Failed to clean up incomplete imported backup", {
          destinationDir,
          message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      });
    }

    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    if (job) {
      await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: BackupStatus.FAILED,
          verificationStatus: BackupVerificationStatus.NOT_VERIFIED,
          finishedAt: new Date(),
          verifiedAt: null,
          location: null,
          manifestPath: null,
          logPath: null,
          scheduleFrequency: null,
          sizeBytes: null,
          sha256: null,
          errorMessage: message,
        },
      });
    }
    await failOperationRun(operationRun?.id, message, {
      step: "failed",
      percent: 100,
      message: "Backup import failed",
      result: {
        backupJobId: job?.id ?? null,
      },
    });
    if (job) {
      await writeBackupAudit({
        context,
        action: "backup.import.failed",
        targetId: job.id,
        success: false,
        metadata: { errorMessage: message },
      }).catch((auditError: unknown) => {
        logger.error("Unable to write backup import failure audit", {
          jobId: job?.id,
          message: auditError instanceof Error ? auditError.message : String(auditError),
        });
      });
    }

    if (error instanceof HttpError) throw error;
    logger.error("Backup import failed", { jobId: job?.id, message });
    throw new HttpError(500, "Backup import failed");
  } finally {
    if (extractionDir) {
      await cleanupBackupImportExtractionDir(extractionDir).catch((error: unknown) => {
        logger.warn("Failed to remove temporary backup ZIP extraction folder", {
          path: extractionDir,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }
    if (activeBackupJobId === "importing" || (job && activeBackupJobId === job.id)) {
      activeBackupJobId = null;
    }
    await Promise.all(
      files.map((file) =>
        rm(file.path, { force: true }).catch((error: unknown) => {
          logger.warn("Failed to remove temporary backup import file", {
            path: file.path,
            message: error instanceof Error ? error.message : String(error),
          });
        })
      )
    );
  }
}

async function assertNoRunningBackup() {
  const running = await prisma.backupJob.findFirst({
    where: { status: BackupStatus.RUNNING },
    orderBy: { startedAt: "desc" },
    select: backupJobSelect,
  });

  if (!running) return;

  const staleAfterMs = env.ATLASGYM_BACKUP_TIMEOUT_MS * 2;
  const isStale = Date.now() - running.startedAt.getTime() > staleAfterMs;
  if (!isStale) {
    throw new HttpError(409, "A backup is already running", { activeBackupJobId: running.id });
  }

  await prisma.backupJob.update({
    where: { id: running.id },
    data: {
      status: BackupStatus.FAILED,
      finishedAt: new Date(),
      errorMessage: "Backup job was marked failed because it stayed running after the timeout window.",
    },
  });
  await prisma.operationRun.updateMany({
    where: {
      status: { in: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING] },
      targetType: "BackupJob",
      targetId: running.id,
    },
    data: {
      status: OperationRunStatus.FAILED,
      step: "interrupted",
      percent: 100,
      message: "Backup operation was interrupted before the application restarted.",
      errorMessage: "Backup job exceeded the timeout window.",
      finishedAt: new Date(),
    },
  });
}

async function runBackupJob(
  jobId: string,
  backupRoot: string,
  input: BackupCreateInput,
  context: BackupActionContext,
  operationRunId?: string | null
) {
  try {
    await updateOperationRun(operationRunId, { step: "creating", percent: 35, message: "Backup script is running" });
    const result = await runBackupScript(backupRoot, input, jobId);
    const folderPath = await resolveCompletedBackupFolder(backupRoot, result.stdout, BackupJobType.MANUAL);
    const { typeDir, folderName } = relativeBackupParts(backupRoot, folderPath);
    const info = await readBackupFolder(backupRoot, typeDir, folderName, BackupJobType.MANUAL);
    const job = await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.COMPLETED,
        finishedAt: new Date(),
        location: info.location,
        backupRoot,
        manifestPath: info.manifestPath,
        logPath: info.logPath,
        sizeBytes: info.sizeBytes,
        sha256: info.sha256,
        errorMessage: null,
      },
      select: backupJobSelect,
    });

    await writeBackupAudit({
      context,
      action: "backup.manual.success",
      targetId: jobId,
      success: true,
      metadata: {
        location: info.location,
        sizeBytes: info.sizeBytes?.toString() ?? null,
        sha256: info.sha256,
      },
    });

    await updateOperationRun(operationRunId, {
      step: "verifying",
      percent: 78,
      message: "Backup files were created; waiting for verification",
      targetType: "BackupJob",
      targetId: jobId,
      result: {
        backupJobId: jobId,
        backupId: info.id,
        location: info.location,
        sizeBytes: info.sizeBytes?.toString() ?? null,
        sha256: info.sha256,
      },
    });

    logger.info("Backup completed", { jobId, location: job.location, sizeBytes: job.sizeBytes?.toString() });
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await writeBackupAudit({
      context,
      action: "backup.manual.failed",
      targetId: jobId,
      success: false,
      metadata: { errorMessage: message },
    });
    await failOperationRun(operationRunId, message, {
      step: "failed",
      percent: 100,
      message: "Safe backup failed",
      result: {
        backupJobId: jobId,
      },
    });
  } finally {
    if (activeBackupJobId === jobId) {
      activeBackupJobId = null;
    }
  }
}

async function runScheduledBackupJob(
  jobId: string,
  backupRoot: string,
  source: "scheduler" | "manual-trigger",
  scheduleFrequency: BackupScheduleFrequency,
  context?: BackupActionContext | null
) {
  try {
    const result = await runBackupScriptForType({
      backupRoot,
      type: BackupJobType.SCHEDULED,
      operator: source === "scheduler" ? "scheduler" : `admin:${jobId}`,
      notes: source === "scheduler" ? `App scheduled backup job ${jobId}` : `App scheduled backup test job ${jobId}`,
      scheduleFrequency,
    });
    const folderPath = await resolveCompletedBackupFolder(backupRoot, result.stdout, BackupJobType.SCHEDULED);
    const { typeDir, folderName } = relativeBackupParts(backupRoot, folderPath);
    const info = await readBackupFolder(backupRoot, typeDir, folderName, BackupJobType.SCHEDULED);
    const verification = await verifyBackupFolderContents(info);
    if (!verification.verified) {
      throw new HttpError(409, "Scheduled backup verification failed", {
        expectedHash: verification.expectedHash,
        actualHash: verification.actualHash,
        expectedSize: verification.expectedSize,
        actualSize: verification.actualSize,
      });
    }

    const verifiedAt = new Date();
    const job = await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.COMPLETED,
        verificationStatus: BackupVerificationStatus.VERIFIED,
        finishedAt: verifiedAt,
        verifiedAt,
        location: info.location,
        backupRoot,
        manifestPath: info.manifestPath,
        logPath: info.logPath,
        scheduleFrequency: info.scheduleFrequency ?? scheduleFrequency,
        sizeBytes: BigInt(verification.actualSize),
        sha256: verification.actualHash,
        errorMessage: null,
      },
      select: backupJobSelect,
    });

    await writeOptionalBackupAudit({
      context,
      action: "backup.scheduled.success",
      targetId: jobId,
      success: true,
      metadata: {
        location: info.location,
        source,
        sizeBytes: verification.actualSize.toString(),
        sha256: verification.actualHash,
        scheduleFrequency,
      },
    });

    const retention = await cleanupScheduledBackupRetention(backupRoot, info.scheduleFrequency ?? scheduleFrequency);
    logger.info("Scheduled backup completed", {
      jobId,
      location: job.location,
      sizeBytes: job.sizeBytes?.toString(),
      retentionDeleted: retention.deletedCount,
      scheduleFrequency,
    });
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await writeOptionalBackupAudit({
      context,
      action: "backup.scheduled.failed",
      targetId: jobId,
      success: false,
      metadata: { source, errorMessage: message },
    });
  } finally {
    if (activeBackupJobId === jobId) {
      activeBackupJobId = null;
    }
  }
}

function planScheduledBackupRetention(
  items: readonly BackupFolderInfo[],
  retention: BackupRetentionConfig,
  frequency: BackupScheduleFrequency
) {
  const keepCount = getRetentionKeepCount(retention, frequency);
  const scheduledBackups = items
    .filter((item) => item.type === BackupJobType.SCHEDULED && item.scheduleFrequency === frequency)
    .sort((a, b) => {
      const createdAtDifference = b.createdAt.getTime() - a.createdAt.getTime();
      if (createdAtDifference !== 0) return createdAtDifference;
      if (a.relativePath === b.relativePath) return 0;
      return a.relativePath < b.relativePath ? -1 : 1;
    });

  return {
    keepCount,
    removeItems: scheduledBackups.slice(keepCount),
  };
}

async function cleanupScheduledBackupRetention(root = getBackupRoot(), frequency?: BackupScheduleFrequency) {
  const { config } = await readBackupConfig(root);
  const activeFrequency = frequency ?? config.frequency;
  const { keepCount, removeItems } = planScheduledBackupRetention(
    await scanBackupRoot(root),
    config.retention,
    activeFrequency
  );

  for (const item of removeItems) {
    assertPathInsideBackupTypeRoots(item.location, root, BackupJobType.SCHEDULED);
    await rm(item.location, { recursive: true, force: true });
    await prisma.backupJob.updateMany({
      where: { location: item.location },
      data: {
        location: null,
        manifestPath: null,
        logPath: null,
        errorMessage: "Backup files were removed by scheduled retention cleanup.",
      },
    });
    await writeSystemBackupAudit({
      action: "backup.retention.delete",
      targetId: item.id,
      success: true,
      metadata: {
        location: item.location,
        folderName: item.folderName,
        relativePath: item.relativePath,
        scheduleFrequency: item.scheduleFrequency,
        keepCount,
      },
    });
  }

  if (removeItems.length > 0) {
    await writeRetentionState(root);
  }

  return {
    deletedCount: removeItems.length,
    keepCount,
  };
}

export function startBackupScheduler() {
  if (backupSchedulerStop) return backupSchedulerStop;
  if (env.NODE_ENV === "test") return () => undefined;

  let activeRun: Promise<void> | null = null;
  const run = () => {
    if (activeRun) return activeRun;
    activeRun = Promise.all([
      reconcileStaleOperationRuns(),
      cleanupOrphanBackupImportExtractionDirs(),
    ])
      .then(() => runBackupSchedulerTick())
      .then(() => undefined)
      .catch((error) => {
        logger.error("Backup scheduler failed", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      })
      .finally(() => {
        activeRun = null;
      });
    return activeRun;
  };

  void run();
  const intervalId = setInterval(run, Math.max(30_000, BACKUP_SCHEDULER_INTERVAL_MS));
  backupSchedulerStop = async () => {
    clearInterval(intervalId);
    backupSchedulerStop = null;
    await activeRun;
  };
  return backupSchedulerStop;
}

async function runBackupSchedulerTick() {
  const root = getBackupRoot();
  const { config } = await readBackupConfig(root);
  if (!config.enabled) return false;

  const maintenance = await getRestoreMaintenanceStatus();
  if (maintenance.enabled) return false;
  if (activeBackupJobId) return false;

  const dueProfiles = (
    await Promise.all(
      BACKUP_SCHEDULE_FREQUENCIES.map(async (frequency) => {
        const profile = config.profiles[frequency];
        const latestScheduledBackupAt = await getLatestScheduledBackupAtForFrequency(root, frequency);
        const schedule = computeNextScheduledRun(profile, latestScheduledBackupAt, config.enabled);
        return { frequency, schedule };
      })
    )
  )
    .filter((item) => item.schedule.dueNow)
    .sort((a, b) => {
      const aTime = a.schedule.currentRunAt ? new Date(a.schedule.currentRunAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.schedule.currentRunAt ? new Date(b.schedule.currentRunAt).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return BACKUP_SCHEDULE_FREQUENCIES.indexOf(a.frequency) - BACKUP_SCHEDULE_FREQUENCIES.indexOf(b.frequency);
    });
  const nextDueProfile = dueProfiles[0];
  if (!nextDueProfile) return false;

  await startScheduledBackup("scheduler", null, nextDueProfile.frequency);
  return true;
}

async function startEmergencyBackupForRestore(
  restoreJobId: string,
  selectedBackup: BackupFolderInfo,
  input: RestorePrepareInput,
  context: BackupActionContext,
  operationRunId?: string | null
) {
  if (activeBackupJobId) {
    throw new HttpError(409, "A backup is already running", { activeBackupJobId });
  }
  activeBackupJobId = "starting";

  try {
    const backupRoot = getBackupRoot();
    await assertNoRunningBackup();
    const job = await prisma.backupJob.create({
      data: {
        type: BackupJobType.PRE_MIGRATION,
        status: BackupStatus.RUNNING,
        backupRoot,
        triggeredById: context.actor.id,
      },
      select: backupJobSelect,
    });

    activeBackupJobId = job.id;
    await writeBackupAudit({
      context,
      action: "backup.restore.emergencyBackup.start",
      targetId: job.id,
      success: true,
      metadata: {
        restoreJobId,
        selectedBackupId: selectedBackup.id,
        selectedBackupPath: selectedBackup.location,
        backupRoot,
      },
    });

    void runRestoreEmergencyBackupJob(job.id, restoreJobId, backupRoot, selectedBackup, input, context, operationRunId).catch((error: unknown) => {
      logger.error("Restore emergency backup runner failed", {
        jobId: job.id,
        restoreJobId,
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return job;
  } catch (error) {
    activeBackupJobId = null;
    throw error;
  }
}

async function runRestoreEmergencyBackupJob(
  jobId: string,
  restoreJobId: string,
  backupRoot: string,
  selectedBackup: BackupFolderInfo,
  input: RestorePrepareInput,
  context: BackupActionContext,
  operationRunId?: string | null
) {
  try {
    await updateOperationRun(operationRunId, { step: "emergencyBackup", percent: 60, message: "Emergency backup is running" });
    const result = await runBackupScriptForType({
      backupRoot,
      type: BackupJobType.PRE_MIGRATION,
      operator: `restore:${restoreJobId}`,
      notes: input.notes
        ? `Emergency backup before restore ${restoreJobId}: ${input.notes}`
        : `Emergency backup before restore ${restoreJobId}`,
    });
    const folderPath = await resolveCompletedBackupFolder(backupRoot, result.stdout, BackupJobType.PRE_MIGRATION);
    const { typeDir, folderName } = relativeBackupParts(backupRoot, folderPath);
    const info = await readBackupFolder(backupRoot, typeDir, folderName, BackupJobType.PRE_MIGRATION);
    const verification = await verifyBackupFolderContents(info);
    if (!verification.verified) {
      throw new HttpError(409, "Emergency backup verification failed", {
        expectedHash: verification.expectedHash,
        actualHash: verification.actualHash,
        expectedSize: verification.expectedSize,
        actualSize: verification.actualSize,
      });
    }
    const verifiedAt = new Date();

    await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.COMPLETED,
        verificationStatus: BackupVerificationStatus.VERIFIED,
        finishedAt: verifiedAt,
        verifiedAt,
        location: info.location,
        backupRoot,
        manifestPath: info.manifestPath,
        logPath: info.logPath,
        sizeBytes: BigInt(verification.actualSize),
        sha256: verification.actualHash,
        errorMessage: null,
      },
      select: backupJobSelect,
    });

    await prisma.restoreJob.update({
      where: { id: restoreJobId },
      data: {
        status: RestoreJobStatus.READY_FOR_CONFIRMATION,
        emergencyBackupPath: info.location,
        preparedAt: new Date(),
        errorMessage: null,
      },
    });
    await updateOperationRun(operationRunId, {
      step: "confirmation",
      percent: 82,
      message: "Ready for final recovery confirmation",
      result: {
        restoreJobId,
        selectedBackupId: selectedBackup.id,
        selectedBackupPath: selectedBackup.location,
        emergencyBackupJobId: jobId,
        emergencyBackupPath: info.location,
        emergencyBackupSha256: verification.actualHash,
      },
    });

    await writeBackupAudit({
      context,
      action: "backup.restore.emergencyBackup.success",
      targetId: jobId,
      success: true,
      metadata: {
        restoreJobId,
        selectedBackupId: selectedBackup.id,
        emergencyBackupPath: info.location,
        sizeBytes: verification.actualSize.toString(),
        sha256: verification.actualHash,
        verifiedAt: verifiedAt.toISOString(),
      },
    });

    await writeBackupAudit({
      context,
      action: "backup.restore.prepare.ready",
      targetId: restoreJobId,
      targetType: "RestoreJob",
      success: true,
      metadata: {
        selectedBackupId: selectedBackup.id,
        selectedBackupPath: selectedBackup.location,
        emergencyBackupJobId: jobId,
        emergencyBackupPath: info.location,
      },
    });
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await prisma.backupJob.update({
      where: { id: jobId },
      data: {
        status: BackupStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await prisma.restoreJob.update({
      where: { id: restoreJobId },
      data: {
        status: RestoreJobStatus.FAILED,
        finishedAt: new Date(),
        errorMessage: message,
      },
    });
    await writeBackupAudit({
      context,
      action: "backup.restore.emergencyBackup.failed",
      targetId: jobId,
      success: false,
      metadata: {
        restoreJobId,
        selectedBackupId: selectedBackup.id,
        errorMessage: message,
      },
    });
    await writeBackupAudit({
      context,
      action: "backup.restore.prepare.failed",
      targetId: restoreJobId,
      targetType: "RestoreJob",
      success: false,
      metadata: {
        selectedBackupId: selectedBackup.id,
        selectedBackupPath: selectedBackup.location,
        errorMessage: message,
      },
    });
    await failOperationRun(operationRunId, message, {
      step: "failed",
      percent: 100,
      message: "Emergency backup failed during recovery preparation",
      result: {
        restoreJobId,
        selectedBackupId: selectedBackup.id,
        emergencyBackupJobId: jobId,
      },
    });
  } finally {
    if (activeBackupJobId === jobId) {
      activeBackupJobId = null;
    }
  }
}

function runBackupScript(backupRoot: string, input: BackupCreateInput, jobId: string) {
  return runBackupScriptForType({
    backupRoot,
    type: BackupJobType.MANUAL,
    operator: `admin:${jobId}`,
    notes: input.notes ? `App manual backup: ${input.notes}` : `App manual backup job ${jobId}`,
  });
}

function runBackupScriptForType(input: {
  backupRoot: string;
  type: BackupJobType;
  operator: string;
  notes: string;
  scheduleFrequency?: BackupScheduleFrequency;
}) {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    BACKUP_SCRIPT_PATH,
    "-Type",
    typeToScriptValue(input.type),
    "-BackupRoot",
    input.backupRoot,
    "-EnvFile",
    SERVER_ENV_FILE,
    "-Operator",
    input.operator,
    "-Notes",
    input.notes,
  ];

  if (input.type === BackupJobType.SCHEDULED && input.scheduleFrequency) {
    args.push("-ScheduleFrequency", input.scheduleFrequency);
  }

  const pgDumpPath = resolvePgDumpPath();
  if (pgDumpPath) {
    args.push("-PgDumpPath", pgDumpPath);
  }

  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  return runExternalProcess({
    command,
    args,
    cwd: PROJECT_ROOT,
    timeoutMs: env.ATLASGYM_BACKUP_TIMEOUT_MS,
    timeoutMessage: `Backup timed out after ${env.ATLASGYM_BACKUP_TIMEOUT_MS}ms`,
    failureMessage: "Backup script failed",
    sanitizeOutput: sanitizeProcessOutput,
  }).then(({ stdout, stderr }) => ({
    stdout: sanitizeProcessOutput(stdout),
    stderr: sanitizeProcessOutput(stderr),
  }));
}

function runRestoreTestScript(backupPath: string, testDatabaseName: string) {
  const restoreTools = resolveRestoreToolPaths();
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    RESTORE_TEST_SCRIPT_PATH,
    "-BackupPath",
    backupPath,
    "-TestDatabaseName",
    testDatabaseName,
    "-EnvFile",
    SERVER_ENV_FILE,
    "-Cleanup",
  ];
  if (restoreTools.createdbPath) {
    args.push("-CreatedbPath", restoreTools.createdbPath);
  }
  if (restoreTools.dropdbPath) {
    args.push("-DropdbPath", restoreTools.dropdbPath);
  }
  if (restoreTools.pgRestorePath) {
    args.push("-PgRestorePath", restoreTools.pgRestorePath);
  }
  if (restoreTools.psqlPath) {
    args.push("-PsqlPath", restoreTools.psqlPath);
  }
  const timeoutMs = Math.max(env.ATLASGYM_BACKUP_TIMEOUT_MS * 2, 180_000);

  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  return runExternalProcess({
    command,
    args,
    cwd: PROJECT_ROOT,
    timeoutMs,
    timeoutMessage: `Restore test timed out after ${timeoutMs}ms`,
    failureMessage: "Restore test failed",
    sanitizeOutput: sanitizeProcessOutput,
  }).then(({ stdout, stderr }) => ({
    stdout: sanitizeProcessOutput(stdout),
    stderr: sanitizeProcessOutput(stderr),
  }));
}

function sanitizeProcessOutput(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/giu, "postgresql://***")
    .replace(/(password=)[^\s"']+/giu, "$1***")
    .replace(/(DATABASE_URL=)[^\s"']+/giu, "$1***");
}

async function resolveCompletedBackupFolder(backupRoot: string, stdout: string, expectedType: BackupJobType) {
  const match = stdout.match(/^\s*Folder:\s*(.+)$/im);
  if (match?.[1]) {
    const folderPath = path.resolve(match[1].trim());
    assertPathInsideRoot(folderPath, backupRoot);
    return folderPath;
  }

  const folders = await scanBackupRoot(backupRoot);
  const latest = folders.find((item) => item.type === expectedType);
  if (!latest) {
    throw new Error("Backup completed but no backup folder could be resolved");
  }
  return latest.location;
}

function relativeBackupParts(backupRoot: string, folderPath: string) {
  const relative = path.relative(backupRoot, folderPath);
  const parts = normalizeBackupRelativePath(relative).split("/");
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    throw new Error("Backup folder path is not in an expected type/folder format");
  }
  return { typeDir: parts[0], folderName: parts.slice(1).join("/"), relativePath: parts.join("/") };
}

function createFileStamp() {
  return new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
}

async function getDirectorySizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);
    assertPathInsideRoot(entryPath, dirPath);
    if (entry.isDirectory()) {
      total += await getDirectorySizeBytes(entryPath);
    } else if (entry.isFile()) {
      total += (await stat(entryPath)).size;
    }
  }
  return total;
}

async function copySupportPackageFile(input: {
  sourceDir: string;
  destinationDir: string;
  fileName: (typeof BACKUP_SUPPORT_PACKAGE_FILES)[number];
  sha256?: string | null;
}) {
  const sourcePath = path.join(input.sourceDir, input.fileName);
  const destinationPath = path.join(input.destinationDir, input.fileName);
  assertPathInsideRoot(sourcePath, input.sourceDir);
  assertPathInsideRoot(destinationPath, input.destinationDir);

  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile()) {
    throw new HttpError(409, `Backup support package requires ${input.fileName}`);
  }

  await copyFile(sourcePath, destinationPath);
  return {
    name: input.fileName,
    path: destinationPath,
    sizeBytes: sourceStat.size.toString(),
    sha256: input.sha256 ?? (input.fileName === "database.dump" ? await sha256File(destinationPath) : null),
  } satisfies BackupSupportPackageFile;
}

async function createSupportPackageArchive(input: { sourceDir: string; destinationPath: string }): Promise<BackupSupportPackageArchive> {
  const command = process.platform === "win32" ? "powershell.exe" : "pwsh";
  const script =
    "& { param([string]$SourceDir, [string]$DestinationPath) $ErrorActionPreference = 'Stop'; if (Test-Path -LiteralPath $DestinationPath) { Remove-Item -LiteralPath $DestinationPath -Force }; Compress-Archive -LiteralPath $SourceDir -DestinationPath $DestinationPath -Force }";
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script, input.sourceDir, input.destinationPath];
  const timeoutMs = Math.max(env.ATLASGYM_BACKUP_TIMEOUT_MS, 300_000);

  await runExternalProcess({
    command,
    args,
    cwd: PROJECT_ROOT,
    timeoutMs,
    timeoutMessage: `Support package ZIP timed out after ${timeoutMs}ms`,
    failureMessage: "Support package ZIP failed",
    sanitizeOutput: sanitizeProcessOutput,
  });

  const archiveStat = await stat(input.destinationPath);
  if (!archiveStat.isFile()) {
    throw new Error("Support package ZIP was not created");
  }

  return {
    fileName: path.basename(input.destinationPath),
    path: input.destinationPath,
    sizeBytes: archiveStat.size.toString(),
    sha256: await sha256File(input.destinationPath),
  };
}

function driveRootFromInput(value: string) {
  if (!value.trim() || !path.isAbsolute(value)) {
    throw new HttpError(400, "External drive root is required");
  }
  return path.parse(path.resolve(value)).root;
}

async function resolveExternalDrive(driveRoot: string) {
  const requestedRoot = driveRootFromInput(driveRoot);
  const drives = await listExternalBackupDrives();
  const drive = drives.find((item) => normalizePathKey(item.rootPath) === normalizePathKey(requestedRoot));
  if (!drive) {
    throw new HttpError(400, "No supported external drive is connected");
  }
  return drive;
}

async function resolveExternalCopySource(input: BackupExternalCopyInput) {
  const root = getBackupRoot();
  if (input.backupId) {
    if (input.backupId.startsWith("job:")) {
      throw new HttpError(400, "External copy requires a completed backup folder");
    }
    const info = await readBackupFolderById(root, input.backupId);
    const job = await prisma.backupJob.findFirst({
      where: { location: info.location },
      orderBy: { startedAt: "desc" },
      select: backupJobSelect,
    });
    return { root, id: input.backupId, info, job };
  }

  const latestJob = await prisma.backupJob.findFirst({
    where: {
      status: BackupStatus.COMPLETED,
      verificationStatus: BackupVerificationStatus.VERIFIED,
      location: { not: null },
    },
    orderBy: [{ verifiedAt: "desc" }, { startedAt: "desc" }],
    select: backupJobSelect,
  });
  if (!latestJob?.location) {
    throw new HttpError(409, "No verified backup is available for external copy");
  }

  const parts = relativeBackupParts(root, latestJob.location);
  const info = await readBackupFolder(root, parts.typeDir, parts.folderName, getFallbackTypeForRelativePath(parts.relativePath));
  return { root, id: info.id, info, job: latestJob };
}

export async function copyBackupToExternalDrive(input: BackupExternalCopyInput, context: BackupActionContext) {
  const drive = await resolveExternalDrive(input.driveRoot);
  const source = await resolveExternalCopySource(input);

  if (source.job && source.job.status !== BackupStatus.COMPLETED) {
    throw new HttpError(409, "External copy requires a completed backup");
  }

  const destinationRoot = path.join(drive.rootPath, "AtlasGymBackups", "external-copies");
  const destinationFolderName = `${createFileStamp()}_${sanitizeBackupFolderPart(source.info.folderName)}_external_${randomUUID().replace(/-/gu, "").slice(0, 8)}`;
  const finalDestination = path.join(destinationRoot, destinationFolderName);
  const temporaryDestination = path.join(destinationRoot, `.${destinationFolderName}.copying`);
  assertPathInsideRoot(destinationRoot, drive.rootPath);
  assertPathInsideRoot(finalDestination, destinationRoot);
  assertPathInsideRoot(temporaryDestination, destinationRoot);

  const copiedAt = new Date().toISOString();
  let sourceSize = 0;

  try {
    const verification = await verifyBackup(source.id, context);
    if (verification.verification.status !== BackupVerificationStatus.VERIFIED) {
      throw new HttpError(409, "Backup must verify before external copy");
    }

    sourceSize = await getDirectorySizeBytes(source.info.location);
    const freeBytes = drive.freeBytes ? Number(drive.freeBytes) : Number.NaN;
    if (Number.isFinite(freeBytes) && freeBytes > 0 && freeBytes < sourceSize + 10 * 1024 * 1024) {
      throw new HttpError(409, "External drive does not have enough free space");
    }

    await mkdir(destinationRoot, { recursive: true });
    await rm(temporaryDestination, { recursive: true, force: true });
    await cp(source.info.location, temporaryDestination, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });

    const copiedInfo: BackupFolderInfo = {
      ...source.info,
      location: temporaryDestination,
      dumpPath: path.join(temporaryDestination, "database.dump"),
      manifestPath: path.join(temporaryDestination, "manifest.json"),
      logPath: path.join(temporaryDestination, "backup.log"),
    };
    const copiedVerification = await verifyBackupFolderContents(copiedInfo);
    if (!copiedVerification.verified) {
      throw new HttpError(409, "External copy verification failed", copiedVerification);
    }

    const summaryPath = path.join(temporaryDestination, "external-copy-summary.json");
    assertPathInsideRoot(summaryPath, temporaryDestination);
    await writeFile(
      summaryPath,
      `${JSON.stringify(
        {
          appName: "AtlasGym",
          packageType: "external-backup-copy",
          copiedAt,
          sourceBackup: {
            id: source.info.id,
            type: typeToScriptValue(source.info.type),
            scheduleFrequency: source.info.scheduleFrequency,
            folderName: source.info.folderName,
            relativePath: source.info.relativePath,
            location: source.info.location,
            sizeBytes: copiedVerification.actualSize,
            sha256: copiedVerification.actualHash,
          },
          destination: {
            driveRoot: drive.rootPath,
            folderName: destinationFolderName,
          },
          verification: copiedVerification,
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await rename(temporaryDestination, finalDestination);

    const currentConfig = (await readBackupConfig(source.root)).config;
    await writeBackupConfig(
      mergeBackupConfig(currentConfig, {
        externalCopy: {
          enabled: true,
          lastTarget: finalDestination,
          lastCopiedAt: copiedAt,
        },
      })
    );

    await writeBackupAudit({
      context,
      action: "backup.externalCopy.success",
      targetId: source.job?.id ?? source.id,
      targetType: source.job?.id ? "BackupJob" : "Backup",
      success: true,
      metadata: {
        backupId: source.id,
        sourcePath: source.info.location,
        destinationPath: finalDestination,
        driveRoot: drive.rootPath,
        sizeBytes: copiedVerification.actualSize.toString(),
        sha256: copiedVerification.actualHash,
      },
    });

    return {
      copiedAt,
      drive,
      destinationPath: finalDestination,
      sourceBackup: serializeBackupItem(source.info, source.job),
      verification: {
        status: BackupVerificationStatus.VERIFIED,
        expectedHash: copiedVerification.expectedHash,
        actualHash: copiedVerification.actualHash,
        expectedSize: copiedVerification.expectedSize,
        actualSize: copiedVerification.actualSize,
      },
      sizeBytes: sourceSize.toString(),
    };
  } catch (error) {
    await rm(temporaryDestination, { recursive: true, force: true }).catch(() => undefined);
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await writeBackupAudit({
      context,
      action: "backup.externalCopy.failed",
      targetId: source.job?.id ?? source.id,
      targetType: source.job?.id ? "BackupJob" : "Backup",
      success: false,
      metadata: {
        backupId: source.id,
        sourcePath: source.info.location,
        destinationPath: finalDestination,
        driveRoot: drive.rootPath,
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function createBackupSupportPackage(id: string, context: BackupActionContext) {
  if (id.startsWith("job:")) {
    throw new HttpError(400, "Support package requires a completed backup folder");
  }

  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  const job = await prisma.backupJob.findFirst({
    where: { location: info.location },
    orderBy: { startedAt: "desc" },
    select: backupJobSelect,
  });

  if (job && job.status !== BackupStatus.COMPLETED) {
    throw new HttpError(409, "Support package requires a completed backup");
  }

  const operationRun = await createOperationRun(
    {
      type: OperationRunType.SUPPORT_PACKAGE,
      step: "checking",
      percent: 10,
      message: "Preparing support package",
      targetType: job?.id ? "BackupJob" : "Backup",
      targetId: job?.id ?? id,
      metadata: {
        backupId: id,
        sourceLocation: info.location,
      },
    },
    context
  );
  const exportedAt = new Date().toISOString();
  const packageRoot = path.join(root, "support-packages");
  assertPathInsideRoot(packageRoot, root);

  const packageFolderName = `${createFileStamp()}_${sanitizeBackupFolderPart(info.folderName)}_support_${randomUUID().replace(/-/gu, "").slice(0, 8)}`;
  const packageDir = path.join(packageRoot, packageFolderName);
  assertPathInsideRoot(packageDir, packageRoot);
  const archiveFileName = `${packageFolderName}.zip`;
  const archivePath = path.join(packageRoot, archiveFileName);
  assertPathInsideRoot(archivePath, packageRoot);

  try {
    await updateOperationRun(operationRun.id, { step: "verifying", percent: 32, message: "Verifying source backup" });
    const verification = await verifyBackup(id, context);
    await updateOperationRun(operationRun.id, { step: "packaging", percent: 62, message: "Creating support ZIP package" });

    await mkdir(packageRoot, { recursive: true });
    await mkdir(packageDir);

    const packageFiles: BackupSupportPackageFile[] = [];
    for (const fileName of BACKUP_SUPPORT_PACKAGE_FILES) {
      packageFiles.push(
        await copySupportPackageFile({
          sourceDir: info.location,
          destinationDir: packageDir,
          fileName,
          sha256: fileName === "database.dump" ? verification.verification.actualHash : null,
        })
      );
    }

    const manifest = await readManifestIfPresent(info.manifestPath);
    const summary = {
      appName: "AtlasGym",
      packageType: "backup-support-package",
      exportedAt,
      warning: "This package excludes application secrets, .env files, database passwords, and raw restore commands.",
      sourceBackup: {
        id: info.id,
        type: typeToScriptValue(info.type),
        folderName: info.folderName,
        createdAt: info.createdAt.toISOString(),
        databaseName: info.databaseName,
        schema: info.schema,
        sizeBytes: verification.verification.actualSize,
        sha256: verification.verification.actualHash,
        manifestAppCommit: manifest?.appCommit ?? null,
      },
      verification: {
        status: verification.verification.status,
        verifiedAt: verification.verification.verifiedAt,
        expectedHash: verification.verification.expectedHash,
        actualHash: verification.verification.actualHash,
        expectedSize: verification.verification.expectedSize,
        actualSize: verification.verification.actualSize,
      },
      includedFiles: packageFiles.map((file) => ({
        name: file.name,
        sizeBytes: file.sizeBytes,
        sha256: file.sha256,
      })),
    };

    const summaryPath = path.join(packageDir, "support-summary.json");
    assertPathInsideRoot(summaryPath, packageDir);
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    const summaryStat = await stat(summaryPath);
    packageFiles.push({
      name: "support-summary.json",
      path: summaryPath,
      sizeBytes: summaryStat.size.toString(),
      sha256: await sha256File(summaryPath),
    });

    const totalSizeBytes = packageFiles.reduce((total, file) => total + BigInt(file.sizeBytes), 0n);
    const archive = await createSupportPackageArchive({ sourceDir: packageDir, destinationPath: archivePath });
    await rm(packageDir, { recursive: true, force: true });
    const includedFiles = packageFiles.map((file) => ({
      name: file.name,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    }));

    await writeBackupAudit({
      context,
      action: "backup.supportPackage.created",
      targetId: job?.id ?? info.id,
      success: true,
      metadata: {
        backupId: id,
        sourceLocation: info.location,
        stagingFolderName: packageFolderName,
        totalSizeBytes: totalSizeBytes.toString(),
        archivePath: archive.path,
        archiveFileName: archive.fileName,
        archiveSizeBytes: archive.sizeBytes,
        archiveSha256: archive.sha256,
        includedFiles: includedFiles.map((file) => file.name),
      },
    });

    const finishedOperationRun = await finishOperationRun(operationRun.id, {
      step: "completed",
      message: "Support package ZIP is ready",
      result: {
        backupId: id,
        sourceFolderName: info.folderName,
        archivePath: archive.path,
        archiveFileName: archive.fileName,
        archiveSizeBytes: archive.sizeBytes,
        archiveSha256: archive.sha256,
        includedFiles: includedFiles.map((file) => file.name),
      },
    });

    return {
      backup: verification.backup,
      verification: verification.verification,
      supportPackage: {
        sourceFolderName: info.folderName,
        createdAt: exportedAt,
        archive,
        includedFiles,
      },
      operationRun: finishedOperationRun ? serializeOperationRun(finishedOperationRun) : serializeOperationRun(operationRun),
    };
  } catch (error) {
    await rm(packageDir, { recursive: true, force: true }).catch((cleanupError: unknown) => {
      logger.warn("Failed to clean up incomplete support package", {
        packageDir,
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });
    await rm(archivePath, { force: true }).catch((cleanupError: unknown) => {
      logger.warn("Failed to clean up incomplete support package ZIP", {
        archivePath,
        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    });

    await writeBackupAudit({
      context,
      action: "backup.supportPackage.failed",
      targetId: job?.id ?? info.id,
      success: false,
      metadata: {
        backupId: id,
        sourceLocation: info.location,
        errorMessage: sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000),
      },
    });

    await failOperationRun(operationRun.id, sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000), {
      step: "failed",
      percent: 100,
      message: "Support package failed",
      result: {
        backupId: id,
        sourceLocation: info.location,
      },
    });

    if (error instanceof HttpError) throw error;
    throw new HttpError(500, `Support package failed: ${sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000)}`);
  }
}

export async function runBackupRestoreTest(id: string, context: BackupActionContext) {
  if (id.startsWith("job:")) {
    throw new HttpError(400, "Restore test requires a completed backup folder");
  }

  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  await assertBackupReadyForRestoreTest(info);

  const verification = await verifyBackup(id, context);
  const testDatabaseName = createRestoreTestDatabaseName(info.folderName);
  await writeBackupAudit({
    context,
    action: "backup.restoreTest.start",
    targetId: info.id,
    success: true,
    metadata: {
      backupId: id,
      location: info.location,
      testDatabaseName,
    },
  });

  try {
    const result = await runRestoreTestScript(info.location, testDatabaseName);
    const output = sanitizeProcessOutput(`${result.stdout}\n${result.stderr}`.trim());
    const reportPath = parseRestoreTestReportPath(output);
    const report = reportPath ? await readRestoreTestReport(reportPath, info.location) : null;
    const counts = report?.counts ?? parseRestoreTestCounts(output);
    const testedAt = report?.testedAt && !Number.isNaN(new Date(report.testedAt).getTime())
      ? new Date(report.testedAt).toISOString()
      : new Date().toISOString();

    await writeBackupAudit({
      context,
      action: "backup.restoreTest.success",
      targetId: info.id,
      success: true,
      metadata: {
        backupId: id,
        location: info.location,
        testDatabaseName,
        cleanup: report?.cleanup ?? true,
        reportPath,
        counts,
      },
    });

    return {
      backup: verification.backup,
      verification: verification.verification,
      restoreTest: {
        status: "PASSED",
        testedAt,
        testDatabaseName,
        cleanup: report?.cleanup ?? true,
        reportPath,
        counts,
        outputLines: outputToLines(output),
      },
    };
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await writeBackupAudit({
      context,
      action: "backup.restoreTest.failed",
      targetId: info.id,
      success: false,
      metadata: {
        backupId: id,
        location: info.location,
        testDatabaseName,
        errorMessage: message,
      },
    });
    throw new HttpError(500, `Restore test failed: ${message}`);
  }
}

export async function prepareProductionRestore(id: string, input: RestorePrepareInput, context: BackupActionContext) {
  if (id.startsWith("job:")) {
    throw new HttpError(400, "Restore preparation requires a completed backup folder");
  }

  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  await assertBackupReadyForRestoreTest(info);

  if (context.actor.role !== AdminRole.VENDOR_OWNER) {
    const blockedJob = await prisma.restoreJob.create({
      data: {
        status: RestoreJobStatus.BLOCKED,
        selectedBackupId: id,
        selectedBackupPath: info.location,
        selectedBackupFolderName: info.folderName,
        selectedBackupSha256: info.sha256,
        selectedBackupSizeBytes: info.sizeBytes,
        requestedById: context.actor.id,
        finishedAt: new Date(),
        errorMessage: "Production restore requires vendor maintenance activation.",
      },
      select: restoreJobSelect,
    });
    await writeBackupAudit({
      context,
      action: "backup.restore.prepare.blocked",
      targetId: blockedJob.id,
      targetType: "RestoreJob",
      success: false,
      metadata: {
        selectedBackupId: id,
        selectedBackupPath: info.location,
        reason: "VENDOR_OWNER_REQUIRED",
      },
    });
    throw new HttpError(403, "Production restore requires vendor maintenance activation", {
      restoreJob: serializeRestoreJob(blockedJob),
    });
  }

  if (activeRestoreJobId) {
    throw new HttpError(409, "A restore preparation is already running", { activeRestoreJobId });
  }
  activeRestoreJobId = "starting";

  let restoreJob: RestoreJobRow | null = null;
  let operationRun: OperationRunRow | null = null;
  try {
    await assertNoActiveRestoreJob();
    restoreJob = await prisma.restoreJob.create({
      data: {
        status: RestoreJobStatus.TESTING,
        selectedBackupId: id,
        selectedBackupPath: info.location,
        selectedBackupFolderName: info.folderName,
        selectedBackupSha256: info.sha256,
        selectedBackupSizeBytes: info.sizeBytes,
        requestedById: context.actor.id,
      },
      select: restoreJobSelect,
    });
    activeRestoreJobId = restoreJob.id;
    operationRun = await createOperationRun(
      {
        type: OperationRunType.PREPARE_RECOVERY,
        step: "checking",
        percent: 10,
        message: "Checking selected backup for recovery",
        targetType: "RestoreJob",
        targetId: restoreJob.id,
        metadata: {
          selectedBackupId: id,
          selectedBackupPath: info.location,
          selectedBackupFolderName: info.folderName,
          notes: input.notes ?? null,
        },
      },
      context
    );

    await writeBackupAudit({
      context,
      action: "backup.restore.prepare.requested",
      targetId: restoreJob.id,
      targetType: "RestoreJob",
      success: true,
      metadata: {
        selectedBackupId: id,
        selectedBackupPath: info.location,
        notes: input.notes ?? null,
      },
    });

    await updateOperationRun(operationRun.id, { step: "restoreTesting", percent: 22, message: "Running disposable restore test" });
    const restoreTest = await runBackupRestoreTest(id, context);
    const testedAt = new Date(restoreTest.restoreTest.testedAt);
    restoreJob = await prisma.restoreJob.update({
      where: { id: restoreJob.id },
      data: {
        status: RestoreJobStatus.TEST_PASSED,
        restoreTestDatabase: restoreTest.restoreTest.testDatabaseName,
        restoreTestPassedAt: Number.isNaN(testedAt.getTime()) ? new Date() : testedAt,
        restoreTestReportPath: restoreTest.restoreTest.reportPath,
        errorMessage: null,
      },
      select: restoreJobSelect,
    });

    await writeBackupAudit({
      context,
      action: "backup.restore.prepare.testPassed",
      targetId: restoreJob.id,
      targetType: "RestoreJob",
      success: true,
      metadata: {
        selectedBackupId: id,
        selectedBackupPath: info.location,
        testDatabaseName: restoreTest.restoreTest.testDatabaseName,
        reportPath: restoreTest.restoreTest.reportPath,
      },
    });

    await updateOperationRun(operationRun.id, {
      step: "emergencyBackup",
      percent: 54,
      message: "Creating emergency backup before recovery handoff",
      result: {
        restoreJobId: restoreJob.id,
        restoreTestDatabase: restoreTest.restoreTest.testDatabaseName,
        restoreTestReportPath: restoreTest.restoreTest.reportPath,
      },
    });
    const emergencyBackup = await startEmergencyBackupForRestore(restoreJob.id, info, input, context, operationRun.id);
    restoreJob = await prisma.restoreJob.update({
      where: { id: restoreJob.id },
      data: {
        status: RestoreJobStatus.EMERGENCY_BACKUP_RUNNING,
        emergencyBackupJobId: emergencyBackup.id,
      },
      select: restoreJobSelect,
    });

    return {
      restoreJob: serializeRestoreJob(restoreJob),
      restoreTest: restoreTest.restoreTest,
      emergencyBackup: serializeJob(emergencyBackup),
      nextStep: "WAIT_FOR_EMERGENCY_BACKUP",
      operationRun: serializeOperationRun(operationRun),
    };
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    if (restoreJob) {
      restoreJob = await prisma.restoreJob.update({
        where: { id: restoreJob.id },
        data: {
          status: RestoreJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: message,
        },
        select: restoreJobSelect,
      });
      await writeBackupAudit({
        context,
        action: "backup.restore.prepare.failed",
        targetId: restoreJob.id,
        targetType: "RestoreJob",
        success: false,
        metadata: {
          selectedBackupId: id,
          selectedBackupPath: info.location,
          errorMessage: message,
        },
      });
    }
    await failOperationRun(operationRun?.id, message, {
      step: "failed",
      percent: 100,
      message: "Recovery preparation failed",
      result: {
        restoreJobId: restoreJob?.id ?? null,
        selectedBackupId: id,
      },
    });
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, `Restore preparation failed: ${message}`);
  } finally {
    if (activeRestoreJobId === "starting" || (restoreJob && activeRestoreJobId === restoreJob.id)) {
      activeRestoreJobId = null;
    }
  }
}

export async function confirmProductionRestoreHandoff(id: string, input: RestoreConfirmInput, context: BackupActionContext) {
  if (context.actor.role !== AdminRole.VENDOR_OWNER) {
    throw new HttpError(403, "Production restore requires vendor maintenance activation");
  }

  const restoreJob = await prisma.restoreJob.findUnique({
    where: { id },
    select: restoreJobSelect,
  });
  if (!restoreJob) {
    throw new HttpError(404, "Restore job not found");
  }
  if (restoreJob.status !== RestoreJobStatus.READY_FOR_CONFIRMATION) {
    throw new HttpError(409, "Restore job is not ready for final confirmation", {
      restoreJob: serializeRestoreJob(restoreJob),
    });
  }
  if (!restoreJob.selectedBackupFolderName || input.folderName !== restoreJob.selectedBackupFolderName) {
    await writeBackupAudit({
      context,
      action: "backup.restore.confirm.failed",
      targetId: restoreJob.id,
      targetType: "RestoreJob",
      success: false,
      metadata: { reason: "FOLDER_NAME_MISMATCH" },
    });
    throw new HttpError(400, "Typed backup folder name does not match");
  }
  if (input.phrase !== PRODUCTION_RESTORE_CONFIRM_PHRASE) {
    await writeBackupAudit({
      context,
      action: "backup.restore.confirm.failed",
      targetId: restoreJob.id,
      targetType: "RestoreJob",
      success: false,
      metadata: { reason: "PHRASE_MISMATCH" },
    });
    throw new HttpError(400, "Typed restore phrase does not match");
  }
  if (!restoreJob.emergencyBackupJob || restoreJob.emergencyBackupJob.status !== BackupStatus.COMPLETED || !restoreJob.emergencyBackupPath) {
    throw new HttpError(409, "Emergency backup must complete before final restore confirmation", {
      restoreJob: serializeRestoreJob(restoreJob),
    });
  }

  const root = getBackupRoot();
  const selectedBackup = await readBackupFolderById(root, restoreJob.selectedBackupId);
  if (normalizePathKey(selectedBackup.location) !== normalizePathKey(restoreJob.selectedBackupPath)) {
    throw new HttpError(409, "Selected backup path changed after preparation");
  }
  await assertBackupReadyForRestoreTest(selectedBackup);

  const verification = await verifyBackup(restoreJob.selectedBackupId, context);
  const timestamp = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const handoffPath = path.join(selectedBackup.location, `production-restore-handoff_${timestamp}.json`);
  assertPathInsideRoot(handoffPath, selectedBackup.location);
  const restoreTools = resolveRestoreToolPaths();
  const commandArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    RESTORE_PRODUCTION_SCRIPT_PATH,
    "-BackupPath",
    selectedBackup.location,
    "-BackupRoot",
    root,
    "-ExpectedFolderName",
    selectedBackup.folderName,
    "-ConfirmPhrase",
    PRODUCTION_RESTORE_CONFIRM_PHRASE,
    "-EnvFile",
    SERVER_ENV_FILE,
  ];
  if (restoreTools.pgRestorePath) {
    commandArgs.push("-PgRestorePath", restoreTools.pgRestorePath);
  }
  if (restoreTools.psqlPath) {
    commandArgs.push("-PsqlPath", restoreTools.psqlPath);
  }
  const handoff = {
    restoreJobId: restoreJob.id,
    createdAt: new Date().toISOString(),
    selectedBackup: {
      id: restoreJob.selectedBackupId,
      folderName: selectedBackup.folderName,
      path: selectedBackup.location,
      sha256: verification.verification.actualHash,
      sizeBytes: verification.verification.actualSize,
    },
    emergencyBackup: {
      jobId: restoreJob.emergencyBackupJobId,
      path: restoreJob.emergencyBackupPath,
      sha256: restoreJob.emergencyBackupJob.sha256,
      sizeBytes: restoreJob.emergencyBackupJob.sizeBytes?.toString() ?? null,
    },
    runbook: [
      "Stop the AtlasGym application server.",
      "Confirm device polling and background jobs are stopped.",
      "Run the restore-production.ps1 command from this handoff.",
      "Run server migrations after restore if the script report asks for it.",
      "Start the application server again.",
      "Check health, members, devices, entry logs, dashboard, payments, and backup page.",
    ],
    command: {
      executable: process.platform === "win32" ? "powershell.exe" : "pwsh",
      cwd: PROJECT_ROOT,
      args: commandArgs,
    },
  };
  await writeFile(handoffPath, JSON.stringify(handoff, null, 2), "utf8");

  const updatedRestoreJob = await prisma.restoreJob.update({
    where: { id: restoreJob.id },
    data: {
      handoffPath,
      restoreScriptPath: RESTORE_PRODUCTION_SCRIPT_PATH,
      restoreCommand: handoff.command as Prisma.InputJsonObject,
      errorMessage: null,
    },
    select: restoreJobSelect,
  });

  await writeBackupAudit({
    context,
    action: "backup.restore.confirm.handoffCreated",
    targetId: restoreJob.id,
    targetType: "RestoreJob",
    success: true,
    metadata: {
      selectedBackupId: restoreJob.selectedBackupId,
      selectedBackupPath: selectedBackup.location,
      emergencyBackupPath: restoreJob.emergencyBackupPath,
      handoffPath,
    },
  });

  const operationRun = await updateLatestRestoreOperationRun(restoreJob.id, {
    step: "handoff",
    percent: 92,
    message: "Controlled restore handoff file is ready",
    result: {
      restoreJobId: restoreJob.id,
      selectedBackupId: restoreJob.selectedBackupId,
      selectedBackupPath: selectedBackup.location,
      emergencyBackupPath: restoreJob.emergencyBackupPath,
      handoffPath,
      restoreScriptPath: RESTORE_PRODUCTION_SCRIPT_PATH,
    },
  });

  return {
    restoreJob: serializeRestoreJob(updatedRestoreJob),
    handoffPath,
    scriptPath: RESTORE_PRODUCTION_SCRIPT_PATH,
    confirmationPhrase: PRODUCTION_RESTORE_CONFIRM_PHRASE,
    command: handoff.command,
    postRestoreChecklist: handoff.runbook.slice(4),
    operationRun: operationRun ? serializeOperationRun(operationRun) : null,
  };
}

export async function startRestoreMaintenanceMode(id: string, input: RestoreMaintenanceInput, context: BackupActionContext) {
  if (context.actor.role !== AdminRole.VENDOR_OWNER) {
    throw new HttpError(403, "Only vendor maintenance can start restore maintenance mode");
  }

  const restoreJob = await prisma.restoreJob.findUnique({
    where: { id },
    select: restoreJobSelect,
  });
  if (!restoreJob) {
    throw new HttpError(404, "Restore job not found");
  }
  if (restoreJob.status !== RestoreJobStatus.READY_FOR_CONFIRMATION || !restoreJob.handoffPath) {
    throw new HttpError(409, "Restore handoff must be created before maintenance mode can start", {
      restoreJob: serializeRestoreJob(restoreJob),
    });
  }

  const startedAt = new Date();
  const state: RestoreMaintenanceState = {
    enabled: true,
    restoreJobId: restoreJob.id,
    startedAt: startedAt.toISOString(),
    startedById: context.actor.id,
    startedByRole: context.actor.role,
    reason: input.reason ?? "Controlled production restore handoff ready",
    selectedBackupFolderName: restoreJob.selectedBackupFolderName,
    selectedBackupPath: restoreJob.selectedBackupPath,
    emergencyBackupPath: restoreJob.emergencyBackupPath,
    handoffPath: restoreJob.handoffPath,
  };

  await writeRestoreMaintenanceState(state, context);
  const updatedRestoreJob = await prisma.restoreJob.update({
    where: { id: restoreJob.id },
    data: {
      maintenanceStartedAt: startedAt,
      maintenanceEndedAt: null,
    },
    select: restoreJobSelect,
  });

  await writeBackupAudit({
    context,
    action: "backup.restore.maintenance.started",
    targetId: restoreJob.id,
    targetType: "RestoreJob",
    success: true,
    metadata: {
      selectedBackupId: restoreJob.selectedBackupId,
      selectedBackupPath: restoreJob.selectedBackupPath,
      handoffPath: restoreJob.handoffPath,
      reason: state.reason,
    },
  });

  const operationRun = await finishLatestRestoreOperationRun(restoreJob.id, {
    step: "completed",
    message: "Restore maintenance mode is active",
    result: {
      restoreJobId: restoreJob.id,
      selectedBackupId: restoreJob.selectedBackupId,
      selectedBackupPath: restoreJob.selectedBackupPath,
      emergencyBackupPath: restoreJob.emergencyBackupPath,
      handoffPath: restoreJob.handoffPath,
      maintenanceStartedAt: startedAt.toISOString(),
    },
  });

  return {
    maintenance: {
      ...state,
      updatedAt: new Date().toISOString(),
    },
    restoreJob: serializeRestoreJob(updatedRestoreJob),
    operationRun: operationRun ? serializeOperationRun(operationRun) : null,
  };
}

export async function clearRestoreMaintenanceMode(input: RestoreMaintenanceInput, context: BackupActionContext) {
  if (context.actor.role !== AdminRole.VENDOR_OWNER && context.actor.role !== AdminRole.GYM_OWNER) {
    throw new HttpError(403, "Only vendor maintenance or a gym owner can clear restore maintenance mode");
  }

  const current = await readRestoreMaintenanceState();
  await writeRestoreMaintenanceState(INACTIVE_RESTORE_MAINTENANCE, context);

  let restoreJob = null;
  if (current.restoreJobId) {
    restoreJob = await prisma.restoreJob.update({
      where: { id: current.restoreJobId },
      data: {
        maintenanceEndedAt: new Date(),
      },
      select: restoreJobSelect,
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return null;
      throw error;
    });
  }

  await writeBackupAudit({
    context,
    action: "backup.restore.maintenance.cleared",
    targetId: current.restoreJobId ?? RESTORE_MAINTENANCE_SETTING_KEY,
    targetType: current.restoreJobId ? "RestoreJob" : "SystemSetting",
    success: true,
    metadata: {
      reason: input.reason ?? null,
      previousState: current,
    } as Prisma.InputJsonObject,
  });

  return {
    maintenance: {
      ...INACTIVE_RESTORE_MAINTENANCE,
      updatedAt: new Date().toISOString(),
    },
    restoreJob: restoreJob ? serializeRestoreJob(restoreJob) : null,
  };
}

function postRestoreCheck(name: string, label: string, status: PostRestoreCheckStatus, value: string | number | null = null, details: string | null = null) {
  return { name, label, status, value, details } satisfies PostRestoreCheckItem;
}

function normalizeCheckError(error: unknown) {
  return sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 300);
}

async function runCountPostRestoreCheck(name: string, label: string, count: () => Promise<number>) {
  try {
    return postRestoreCheck(name, label, "passed", await count());
  } catch (error) {
    return postRestoreCheck(name, label, "failed", null, normalizeCheckError(error));
  }
}

async function runPostRestoreHealthChecks(input: {
  backupId: string;
  backupFolderName: string;
  backupSha256: string | null;
  report: RestoreSidecarReport;
}) {
  const checks: PostRestoreCheckItem[] = [];

  checks.push(postRestoreCheck("api_request", "Application API accepted the check request", "passed", "ok"));

  try {
    const rows = await prisma.$queryRaw<Array<{ database_name: string }>>`select current_database() as database_name`;
    checks.push(postRestoreCheck("database_connection", "Database connection", "passed", rows[0]?.database_name ?? "connected"));
  } catch (error) {
    checks.push(postRestoreCheck("database_connection", "Database connection", "failed", null, normalizeCheckError(error)));
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ failed_count: number }>>`
      select count(*)::int as failed_count
      from "_prisma_migrations"
      where finished_at is null and rolled_back_at is null
    `;
    const failedCount = Number(rows[0]?.failed_count ?? 0);
    checks.push(
      postRestoreCheck(
        "prisma_migrations",
        "Prisma migration state",
        failedCount === 0 ? "passed" : "failed",
        failedCount,
        failedCount === 0 ? null : "One or more migrations are unfinished."
      )
    );
  } catch (error) {
    checks.push(postRestoreCheck("prisma_migrations", "Prisma migration state", "failed", null, normalizeCheckError(error)));
  }

  if (input.report.sourceSha256) {
    const hashMatches = input.backupSha256?.toLowerCase() === input.report.sourceSha256.toLowerCase();
    checks.push(
      postRestoreCheck(
        "source_backup_hash",
        "Restored backup matches selected source",
        hashMatches ? "passed" : "failed",
        shortenForReport(input.report.sourceSha256),
        hashMatches ? null : "The production restore report hash does not match this backup."
      )
    );
  } else {
    checks.push(postRestoreCheck("source_backup_hash", "Restored backup matches selected source", "warning", null, "Production report did not include a source hash."));
  }

  const adminUsers = await runCountPostRestoreCheck("admin_users", "Admin users", () => prisma.adminUser.count());
  checks.push(
    adminUsers.status === "passed" && Number(adminUsers.value) < 1
      ? postRestoreCheck("admin_users", "Admin users", "failed", 0, "No admin user exists after restore.")
      : adminUsers
  );

  checks.push(await runCountPostRestoreCheck("members", "Members", () => prisma.member.count()));
  checks.push(await runCountPostRestoreCheck("memberships", "Memberships", () => prisma.membership.count()));
  checks.push(await runCountPostRestoreCheck("payments", "Payments", () => prisma.payment.count()));
  checks.push(await runCountPostRestoreCheck("attendance_logs", "Attendance logs", () => prisma.attendanceLog.count()));
  checks.push(await runCountPostRestoreCheck("devices", "Devices", () => prisma.device.count()));
  checks.push(await runCountPostRestoreCheck("device_users", "Device users", () => prisma.deviceUser.count()));
  checks.push(await runCountPostRestoreCheck("inbox_items", "Inbox items", () => prisma.inboxItem.count()));

  const status: "passed" | "failed" = checks.some((check) => check.status === "failed") ? "failed" : "passed";
  const counts = Object.fromEntries(
    checks
      .filter((check) => typeof check.value === "number")
      .map((check) => [check.name, check.value])
  );

  return {
    appName: "AtlasGym",
    reportType: "post-restore-check",
    status,
    checkedAt: new Date().toISOString(),
    sourceBackup: {
      id: input.backupId,
      folderName: input.backupFolderName,
      sha256: input.backupSha256,
    },
    productionRestoreReport: {
      fileName: input.report.fileName,
      completedAt: input.report.completedAt,
      status: input.report.status,
    },
    summary: {
      counts,
      passed: checks.filter((check) => check.status === "passed").length,
      warnings: checks.filter((check) => check.status === "warning").length,
      failed: checks.filter((check) => check.status === "failed").length,
    },
    checks,
  };
}

function shortenForReport(value: string) {
  return value.length <= 16 ? value : `${value.slice(0, 8)}...${value.slice(-8)}`;
}

export async function runPostRestoreCheck(id: string, context: BackupActionContext) {
  if (id.startsWith("job:")) {
    throw new HttpError(400, "Post-restore check requires a completed backup folder");
  }

  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  await assertBackupReadyForRestoreTest(info);
  const operationRun = await createOperationRun(
    {
      type: OperationRunType.POST_RESTORE_CHECK,
      step: "checkingBackup",
      percent: 10,
      message: "Checking selected backup before post-restore validation",
      targetType: "BackupFolder",
      targetId: id,
      metadata: {
        folderName: info.folderName,
        location: info.location,
      },
    },
    context
  );

  try {
    await updateOperationRun(operationRun.id, { step: "checkingReport", percent: 24, message: "Checking production restore report" });
    const sidecars = await readRestoreSidecars(info.location);
    const latestReport = sidecars.reports[0] ?? null;
    if (!latestReport) {
      throw new HttpError(409, "Production restore report is required before post-restore checks can run");
    }
    if (latestReport.status?.toLowerCase() !== "succeeded") {
      throw new HttpError(409, "Production restore report is not successful");
    }

    await updateOperationRun(operationRun.id, { step: "verifyingBackup", percent: 38, message: "Verifying restored source backup" });
    const verification = await verifyBackup(id, context);
    await updateOperationRun(operationRun.id, { step: "runningChecks", percent: 58, message: "Checking current application database" });
    const report = await runPostRestoreHealthChecks({
      backupId: id,
      backupFolderName: info.folderName,
      backupSha256: verification.verification.actualHash,
      report: latestReport,
    });

    await updateOperationRun(operationRun.id, { step: "writingReport", percent: 78, message: "Writing post-restore check report" });
    const reportFileName = `post-restore-check_${createFileStamp()}_${randomUUID().replace(/-/gu, "").slice(0, 8)}.json`;
    const reportPath = path.join(info.location, reportFileName);
    assertPathInsideRoot(reportPath, info.location);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    let updatedRestoreJob: RestoreJobRow | null = null;
    const restoreJob = await prisma.restoreJob.findFirst({
      where: { selectedBackupId: id },
      orderBy: { requestedAt: "desc" },
      select: restoreJobSelect,
    });

    if (restoreJob) {
      const completedAt = new Date(latestReport.completedAt);
      const checkedAt = new Date(report.checkedAt);
      updatedRestoreJob = await prisma.restoreJob.update({
        where: { id: restoreJob.id },
        data: {
          status: report.status === "passed" ? RestoreJobStatus.COMPLETED : restoreJob.status,
          productionRestoreReportPath: latestReport.path,
          productionRestoreStatus: latestReport.status,
          productionRestoreCompletedAt: Number.isNaN(completedAt.getTime()) ? null : completedAt,
          postRestoreCheckedAt: Number.isNaN(checkedAt.getTime()) ? new Date() : checkedAt,
          postRestoreSummary: report as Prisma.InputJsonObject,
          finishedAt: report.status === "passed" ? (Number.isNaN(checkedAt.getTime()) ? new Date() : checkedAt) : restoreJob.finishedAt,
          errorMessage: report.status === "passed" ? null : "Post-restore check failed.",
        },
        select: restoreJobSelect,
      });
    }

    await writeBackupAudit({
      context,
      action: report.status === "passed" ? "backup.restore.postCheck.success" : "backup.restore.postCheck.failed",
      targetId: updatedRestoreJob?.id ?? id,
      targetType: updatedRestoreJob ? "RestoreJob" : "BackupJob",
      success: report.status === "passed",
      metadata: {
        backupId: id,
        backupPath: info.location,
        reportPath,
        productionRestoreReportPath: latestReport.path,
        status: report.status,
        failedChecks: report.checks.filter((check) => check.status === "failed").map((check) => check.name),
        warningChecks: report.checks.filter((check) => check.status === "warning").map((check) => check.name),
      },
    });

    const result = {
      backupId: id,
      restoreJobId: updatedRestoreJob?.id ?? null,
      reportPath,
      productionRestoreReportPath: latestReport.path,
      status: report.status,
      summary: report.summary,
    };
    const completedOperationRun =
      report.status === "passed"
        ? await finishOperationRun(operationRun.id, {
            step: "completed",
            message: "Post-restore check passed",
            result,
          })
        : await failOperationRun(operationRun.id, "Post-restore check failed.", {
            step: "failed",
            percent: 100,
            message: "Post-restore check found a problem",
            result,
          });

    return {
      backup: verification.backup,
      verification: verification.verification,
      postRestoreCheck: {
        fileName: reportFileName,
        path: reportPath,
        status: report.status,
        checkedAt: report.checkedAt,
        sourceBackup: report.sourceBackup.folderName,
        sourceSha256: report.sourceBackup.sha256,
        productionReportFileName: report.productionRestoreReport.fileName,
        checks: report.checks,
      },
      restoreJob: updatedRestoreJob ? serializeRestoreJob(updatedRestoreJob) : null,
      operationRun: completedOperationRun ? serializeOperationRun(completedOperationRun) : serializeOperationRun(operationRun),
    };
  } catch (error) {
    const message = sanitizeProcessOutput(error instanceof Error ? error.message : String(error)).slice(0, 1000);
    await failOperationRun(operationRun.id, message, {
      step: "failed",
      percent: 100,
      message: "Post-restore check failed",
      result: {
        backupId: id,
        location: info.location,
      },
    });
    throw error;
  }
}

async function assertNoActiveRestoreJob() {
  const active = await prisma.restoreJob.findFirst({
    where: {
      status: {
        in: [
          RestoreJobStatus.TESTING,
          RestoreJobStatus.EMERGENCY_BACKUP_RUNNING,
          RestoreJobStatus.RESTORE_RUNNING,
        ],
      },
    },
    orderBy: { requestedAt: "desc" },
    select: restoreJobSelect,
  });

  if (active) {
    throw new HttpError(409, "A restore workflow is already active", {
      restoreJob: serializeRestoreJob(active),
    });
  }
}

async function assertBackupReadyForRestoreTest(info: BackupFolderInfo) {
  if (!info.hasManifest) {
    throw new HttpError(409, "Backup manifest is missing");
  }
  if (!info.hasDump) {
    throw new HttpError(409, "Backup dump file is missing");
  }
  const logStat = await stat(info.logPath).catch((error: unknown) => {
    if (isNodeError(error, "ENOENT")) return null;
    throw error;
  });
  if (!logStat?.isFile()) {
    throw new HttpError(409, "Backup log file is missing");
  }
}

function createRestoreTestDatabaseName(folderName: string) {
  const stamp = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const safeFolder = folderName.replace(/[^A-Za-z0-9_]/gu, "_").slice(0, 20);
  return `atlasgym_restore_test_${stamp}_${safeFolder}`.slice(0, 63);
}

function parseRestoreTestReportPath(output: string) {
  const match = output.match(/^Report:\s*(.+)$/im);
  return match?.[1]?.trim() ?? null;
}

function parseRestoreTestCounts(output: string) {
  const counts: Record<string, number | null> = {};
  for (const match of output.matchAll(/^Count\s+([A-Za-z0-9_]+)\s*=\s*(\d+)$/gim)) {
    const name = match[1];
    const value = match[2];
    if (name && value) counts[name] = Number(value);
  }
  return counts;
}

async function readRestoreTestReport(reportPath: string, backupPath: string) {
  const resolved = path.resolve(reportPath);
  assertPathInsideRoot(resolved, backupPath);
  const parsed = JSON.parse(decodeManifestBuffer(await readFile(resolved))) as unknown;
  if (!isRecord(parsed)) return null;

  const persistedTimestamp = normalizeRestoreTestTimestamp(parsed["createdAt"]);
  const compatibilityTimestamp = normalizeRestoreTestTimestamp(parsed["testedAt"]);
  const testedAt = persistedTimestamp ?? compatibilityTimestamp ?? undefined;
  const testDatabaseName = readNonEmptyString(parsed["testDatabaseName"])
    ?? readNonEmptyString(parsed["testDatabase"]);
  const sourceBackup = readNonEmptyString(parsed["sourceBackup"]);
  const cleanup = typeof parsed["cleanupRequested"] === "boolean"
    ? parsed["cleanupRequested"]
    : typeof parsed["cleanup"] === "boolean"
      ? parsed["cleanup"]
      : undefined;
  const counts = normalizeRestoreTestCounts(parsed["counts"]);

  return {
    ...(testedAt ? { testedAt } : {}),
    ...(testDatabaseName ? { testDatabaseName } : {}),
    ...(sourceBackup ? { sourceBackup } : {}),
    ...(cleanup !== undefined ? { cleanup } : {}),
    ...(counts ? { counts } : {}),
  } satisfies RestoreTestReport;
}

function normalizeRestoreTestTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRestoreTestCounts(value: unknown) {
  if (!isRecord(value)) return undefined;
  const counts: Record<string, number | null> = {};
  for (const [name, count] of Object.entries(value)) {
    if (!/^[A-Za-z0-9_]+$/u.test(name)) return undefined;
    if (count !== null && (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) {
      return undefined;
    }
    counts[name] = count;
  }
  return counts;
}

function outputToLines(output: string) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-80);
}

async function writeBackupVerificationFailureAuditBestEffort(input: {
  context: BackupActionContext;
  backupId: string;
  jobId: string | null;
  metadata: Prisma.InputJsonObject;
}) {
  await writeBackupAudit({
    context: input.context,
    action: "backup.verify.failed",
    targetId: input.jobId ?? input.backupId,
    success: false,
    metadata: input.metadata,
  }).catch((auditError: unknown) => {
    logger.error("Unable to write backup verification failure audit", {
      backupId: input.backupId,
      jobId: input.jobId,
      message: auditError instanceof Error ? auditError.message : String(auditError),
    });
  });
}

export async function verifyBackup(id: string, context: BackupActionContext) {
  const root = getBackupRoot();
  const info = await readBackupFolderById(root, id);
  let verification: Awaited<ReturnType<typeof verifyBackupFolderContents>>;
  try {
    verification = await verifyBackupFolderContents(info);
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 409) throw error;
    const missingArtifactPath =
      error.message === BACKUP_MANIFEST_MISSING_MESSAGE
        ? info.manifestPath
        : error.message === BACKUP_DUMP_MISSING_MESSAGE
          ? info.dumpPath
          : null;
    if (!missingArtifactPath) throw error;
    const missingArtifactMessage = error.message;

    const artifactIsPhysicallyMissing = await stat(missingArtifactPath).then(
      () => false,
      (artifactStatError: unknown) => {
        if (isNodeError(artifactStatError, "ENOENT")) return true;
        throw error;
      }
    );
    if (!artifactIsPhysicallyMissing) throw error;

    let job = await prisma.backupJob.findFirst({
      where: { location: info.location },
      orderBy: { startedAt: "desc" },
      select: backupJobSelect,
    });
    if (!job) throw error;

    job = await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        verificationStatus: BackupVerificationStatus.FAILED,
        verifiedAt: null,
        scheduleFrequency: info.scheduleFrequency,
        errorMessage: missingArtifactMessage,
      },
      select: backupJobSelect,
    });

    await failLatestOperationRunForTarget(
      {
        type: OperationRunType.SAFE_BACKUP,
        targetType: "BackupJob",
        targetId: job.id,
        statuses: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING],
      },
      missingArtifactMessage,
      {
        step: "failed",
        percent: 100,
        message: "Safe backup verification failed",
        result: {
          backupId: id,
          backupJobId: job.id,
          location: info.location,
          errorMessage: missingArtifactMessage,
        },
      }
    );

    await writeBackupVerificationFailureAuditBestEffort({
      context,
      backupId: id,
      jobId: job.id,
      metadata: {
        backupId: id,
        location: info.location,
        scheduleFrequency: info.scheduleFrequency,
        errorMessage: missingArtifactMessage,
      },
    });
    throw error;
  }
  const verificationCheckedAt = new Date();
  let job = await prisma.backupJob.findFirst({
    where: { location: info.location },
    orderBy: { startedAt: "desc" },
    select: backupJobSelect,
  });
  let operationRun: OperationRunRow | null = null;

  if (job) {
    job = await prisma.backupJob.update({
      where: { id: job.id },
      data: {
        verificationStatus: verification.verified ? BackupVerificationStatus.VERIFIED : BackupVerificationStatus.FAILED,
        verifiedAt: verification.verified ? verificationCheckedAt : null,
        scheduleFrequency: info.scheduleFrequency,
        sha256: verification.actualHash,
        sizeBytes: BigInt(verification.actualSize),
        errorMessage: verification.verified ? null : "Backup verification failed: manifest hash or size mismatch.",
      },
      select: backupJobSelect,
    });

    if (verification.verified) {
      operationRun = await finishLatestOperationRunForTarget(
        {
          type: OperationRunType.SAFE_BACKUP,
          targetType: "BackupJob",
          targetId: job.id,
          statuses: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING],
        },
        {
          step: "completed",
          message: "Safe backup created and verified",
          result: {
            backupId: id,
            backupJobId: job.id,
            location: info.location,
            sizeBytes: verification.actualSize.toString(),
            sha256: verification.actualHash,
            verifiedAt: verificationCheckedAt.toISOString(),
          },
        }
      );
    } else {
      operationRun = await failLatestOperationRunForTarget(
        {
          type: OperationRunType.SAFE_BACKUP,
          targetType: "BackupJob",
          targetId: job.id,
          statuses: [OperationRunStatus.PENDING, OperationRunStatus.RUNNING],
        },
        "Backup verification failed: manifest hash or size mismatch.",
        {
          step: "failed",
          percent: 100,
          message: "Safe backup verification failed",
          result: {
            backupId: id,
            backupJobId: job.id,
            location: info.location,
            expectedHash: verification.expectedHash,
            actualHash: verification.actualHash,
            expectedSize: verification.expectedSize,
            actualSize: verification.actualSize,
          },
        }
      );
    }
  }

  const verificationAuditMetadata: Prisma.InputJsonObject = {
    backupId: id,
    location: info.location,
    scheduleFrequency: info.scheduleFrequency,
    expectedHash: verification.expectedHash,
    actualHash: verification.actualHash,
    expectedSize: verification.expectedSize,
    actualSize: verification.actualSize,
  };
  if (verification.verified) {
    await writeBackupAudit({
      context,
      action: "backup.verify.success",
      targetId: job?.id ?? id,
      success: true,
      metadata: verificationAuditMetadata,
    });
  } else {
    await writeBackupVerificationFailureAuditBestEffort({
      context,
      backupId: id,
      jobId: job?.id ?? null,
      metadata: verificationAuditMetadata,
    });
  }

  if (!verification.verified) {
    throw new HttpError(409, "Backup verification failed", {
      expectedHash: verification.expectedHash,
      actualHash: verification.actualHash,
      expectedSize: verification.expectedSize,
      actualSize: verification.actualSize,
    });
  }

  return {
    backup: serializeBackupItem(info, job),
    verification: {
      status: BackupVerificationStatus.VERIFIED,
      verifiedAt: verificationCheckedAt.toISOString(),
      expectedHash: verification.expectedHash,
      actualHash: verification.actualHash,
      expectedSize: verification.expectedSize,
      actualSize: verification.actualSize,
    },
    operationRun: operationRun ? serializeOperationRun(operationRun) : null,
  };
}

function sha256File(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function readLogLines(logPath: string) {
  try {
    const content = await readFile(logPath, "utf8");
    return sanitizeProcessOutput(content)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-60);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return [];
    throw error;
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code;
}

export const backupServiceTestHooks = {
  cleanupOrphanBackupImportExtractionDirs,
  cleanupScheduledBackupRetention,
  computeNextScheduledRun,
  decodeBackupId,
  encodeBackupId,
  getLatestScheduledBackupAtForFrequency,
  planScheduledBackupRetention,
  reconcileStaleOperationRuns,
  readBackupFolderById,
  readRestoreTestReport,
  scanBackupRoot,
  writeRestoreMaintenanceState,
};
