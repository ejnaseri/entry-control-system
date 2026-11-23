import { api } from "./client";

export type BackupJobType = "MANUAL" | "SCHEDULED" | "PRE_MIGRATION";
export type BackupStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type BackupVerificationStatus = "NOT_VERIFIED" | "VERIFIED" | "FAILED";
export type BackupScheduleFrequency = "hourly" | "daily" | "weekly" | "monthly" | "yearly";
export type BackupStorageSource = "environment" | "configured" | "default";
export type OperationRunType = "SAFE_BACKUP" | "IMPORT_BACKUP" | "SUPPORT_PACKAGE" | "PREPARE_RECOVERY" | "POST_RESTORE_CHECK";
export type OperationRunStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type RestoreJobStatus =
  | "REQUESTED"
  | "BLOCKED"
  | "TESTING"
  | "TEST_PASSED"
  | "EMERGENCY_BACKUP_RUNNING"
  | "READY_FOR_CONFIRMATION"
  | "RESTORE_RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type BackupAdminRef = {
  id: string;
  username: string;
  fullName: string | null;
  role: string;
};

export type BackupJob = {
  id: string;
  type: BackupJobType;
  status: BackupStatus;
  verificationStatus: BackupVerificationStatus;
  startedAt: string;
  finishedAt: string | null;
  verifiedAt: string | null;
  location: string | null;
  backupRoot: string | null;
  manifestPath: string | null;
  logPath: string | null;
  scheduleFrequency: BackupScheduleFrequency | null;
  sizeBytes: string | null;
  sha256: string | null;
  errorMessage: string | null;
  triggeredBy: BackupAdminRef | null;
  updatedAt: string;
};

export type OperationRun = {
  id: string;
  type: OperationRunType;
  status: OperationRunStatus;
  step: string | null;
  percent: number;
  message: string | null;
  errorMessage: string | null;
  targetType: string | null;
  targetId: string | null;
  result: unknown;
  metadata: unknown;
  startedBy: BackupAdminRef | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BackupJobWithOperation = BackupJob & {
  operationRun?: OperationRun | null;
};

export type BackupExternalDrive = {
  id: string;
  rootPath: string;
  label: string | null;
  fileSystem: string | null;
  driveType: string;
  busType: string | null;
  sizeBytes: string | null;
  freeBytes: string | null;
};

export type BackupScheduleRule = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  time: string;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
};

export type BackupScheduleProfiles = Record<BackupScheduleFrequency, BackupScheduleRule>;

export type BackupScheduleStatus = {
  configPath: string;
  configExists: boolean;
  schedulerRunning: boolean;
  config: {
    enabled: boolean;
    backupRoot: string;
    frequency: BackupScheduleFrequency;
    dailyTime: string;
    schedule: BackupScheduleRule;
    profiles: BackupScheduleProfiles;
    retention: {
      hourly: number;
      daily: number;
      weekly: number;
      monthly: number;
      yearly: number;
      preMigration: number;
      manualAutoDelete: boolean;
    };
    externalCopy: {
      enabled: boolean;
      lastTarget: string;
      lastCopiedAt: string | null;
    };
  };
  nextRunAt: string | null;
  dueNow: boolean;
  lastScheduledBackup: BackupJob | null;
  retention: {
    scheduledBackups: number;
    keepCount: number;
    cleanupCandidates: number;
    lastCleanupAt: string | null;
  };
  profiles: Record<
    BackupScheduleFrequency,
    {
      enabled: boolean;
      frequency: BackupScheduleFrequency;
      nextRunAt: string | null;
      dueNow: boolean;
      scheduledBackups: number;
      keepCount: number;
      cleanupCandidates: number;
      lastScheduledBackup: BackupJob | null;
    }
  >;
  externalCopy: {
    enabled: boolean;
    lastTarget: string;
    lastCopiedAt: string | null;
    latestVerifiedBackupAt: string | null;
    reminderDue: boolean;
  };
};

export type BackupScheduleConfigInput = {
  enabled?: boolean;
  frequency?: BackupScheduleFrequency;
  dailyTime?: string;
  schedule?: Partial<BackupScheduleRule>;
  profiles?: Partial<Record<BackupScheduleFrequency, Partial<BackupScheduleRule>>>;
  retention?: {
    hourly?: number;
    daily?: number;
    weekly?: number;
    monthly?: number;
    yearly?: number;
    preMigration?: number;
    manualAutoDelete?: boolean;
  };
  externalCopy?: {
    enabled?: boolean;
    lastTarget?: string;
    lastCopiedAt?: string | null;
  };
};

export type BackupStorageStatus = {
  currentRoot: string;
  recommendedRoot: string;
  source: BackupStorageSource;
  envLocked: boolean;
  configPath: string;
  configExists: boolean;
  isRecommended: boolean;
  needsSetup: boolean;
  health: {
    exists: boolean;
    writable: boolean;
    outsideProject: boolean;
    ok: boolean;
    message: string | null;
  };
};

export type BackupStorageConfigInput = {
  backupRoot: string;
};

export type BackupItem = {
  id: string;
  jobId: string | null;
  type: BackupJobType;
  status: BackupStatus;
  verificationStatus: BackupVerificationStatus;
  folderName: string | null;
  relativePath: string | null;
  scheduleFrequency: BackupScheduleFrequency | null;
  location: string | null;
  createdAt: string;
  startedAt: string;
  finishedAt: string | null;
  verifiedAt: string | null;
  sizeBytes: string | null;
  sha256: string | null;
  databaseName: string | null;
  schema: string | null;
  operator: string | null;
  notes: string | null;
  hasManifest: boolean;
  hasDump: boolean;
  errorMessage: string | null;
  restoreSidecarSummary: {
    hasHandoff: boolean;
    handoffCreatedAt: string | null;
    productionRestoreStatus: string | null;
    productionRestoreCompletedAt: string | null;
    postRestoreStatus: string | null;
    postRestoreCheckedAt: string | null;
  };
  triggeredBy: BackupAdminRef | null;
};

export type BackupSettings = {
  backupRoot: string;
  rootExists: boolean;
  scriptPath: string;
  scriptExists: boolean;
  pgDumpPath: string | null;
  pgDumpAvailable: boolean;
  restoreTools: {
    createdbPath: string | null;
    dropdbPath: string | null;
    pgRestorePath: string | null;
    psqlPath: string | null;
    available: boolean;
  };
  timeoutMs: number;
  activeJob: BackupJob | null;
  activeOperationRuns: OperationRun[];
  restoreMaintenance: RestoreMaintenanceStatus;
  storage: BackupStorageStatus;
  schedule: BackupScheduleStatus;
  externalCopy: {
    availableDrives: BackupExternalDrive[];
  };
};

export type RestoreMaintenanceStatus = {
  enabled: boolean;
  restoreJobId: string | null;
  startedAt: string | null;
  startedById: string | null;
  startedByRole: string | null;
  reason: string | null;
  selectedBackupFolderName: string | null;
  selectedBackupPath: string | null;
  emergencyBackupPath: string | null;
  handoffPath: string | null;
  updatedAt: string | null;
};

export type BackupListResponse = {
  items: BackupItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  settings: BackupSettings;
};

export type BackupDetailsResponse = {
  backup: BackupItem | null;
  job: BackupJob | null;
  manifest: Record<string, unknown> | null;
  logLines: string[];
  restoreJob: RestoreJob | null;
  restoreSidecars: {
    handoffs: Array<{
      fileName: string;
      path: string;
      createdAt: string;
      restoreJobId: string | null;
      selectedBackupFolderName: string | null;
    }>;
    reports: Array<{
      fileName: string;
      path: string;
      status: string | null;
      completedAt: string;
      sourceBackup: string | null;
      sourceSha256: string | null;
      databaseName: string | null;
      migrationReminder: string | null;
    }>;
    postChecks: Array<{
      fileName: string;
      path: string;
      status: string | null;
      checkedAt: string;
      sourceBackup: string | null;
      sourceSha256: string | null;
      productionReportFileName: string | null;
      checks: PostRestoreCheckItem[];
    }>;
  };
};

export type BackupVerificationResponse = {
  backup: BackupItem;
  verification: {
    status: BackupVerificationStatus;
    verifiedAt: string;
    expectedHash: string;
    actualHash: string;
    expectedSize: number | null;
    actualSize: number;
  };
  operationRun?: OperationRun | null;
};

export type BackupRestoreTestResponse = BackupVerificationResponse & {
  restoreTest: {
    status: "PASSED";
    testedAt: string;
    testDatabaseName: string;
    cleanup: boolean;
    reportPath: string | null;
    counts: Record<string, number | null>;
    outputLines: string[];
  };
};

export type BackupImportResponse = BackupVerificationResponse & {
  job: BackupJob;
  operationRun?: OperationRun | null;
};

export type BackupSupportPackageResponse = BackupVerificationResponse & {
  supportPackage: {
    sourceFolderName: string;
    createdAt: string;
    archive: {
      fileName: string;
      path: string;
      sizeBytes: string;
      sha256: string;
    };
    includedFiles: Array<{
      name: string;
      sizeBytes: string;
      sha256: string | null;
    }>;
  };
  operationRun?: OperationRun | null;
};

export type BackupExternalCopyResponse = {
  copiedAt: string;
  drive: BackupExternalDrive;
  destinationPath: string;
  sourceBackup: BackupItem;
  verification: {
    status: "VERIFIED";
    expectedHash: string;
    actualHash: string;
    expectedSize: number | null;
    actualSize: number;
  };
  sizeBytes: string;
};

export type PostRestoreCheckItem = {
  name: string;
  label: string;
  status: "passed" | "warning" | "failed";
  value: string | number | null;
  details: string | null;
};

export type BackupPostRestoreCheckResponse = BackupVerificationResponse & {
  postRestoreCheck: {
    fileName: string;
    path: string;
    status: "passed" | "failed";
    checkedAt: string;
    sourceBackup: string | null;
    sourceSha256: string | null;
    productionReportFileName: string | null;
    checks: PostRestoreCheckItem[];
  };
  restoreJob: RestoreJob | null;
  operationRun?: OperationRun | null;
};

export type RestoreJob = {
  id: string;
  status: RestoreJobStatus;
  selectedBackupId: string;
  selectedBackupPath: string;
  selectedBackupFolderName: string | null;
  selectedBackupSha256: string | null;
  selectedBackupSizeBytes: string | null;
  restoreTestDatabase: string | null;
  restoreTestPassedAt: string | null;
  restoreTestReportPath: string | null;
  emergencyBackupJobId: string | null;
  emergencyBackupPath: string | null;
  handoffPath: string | null;
  restoreScriptPath: string | null;
  restoreCommand: unknown;
  maintenanceStartedAt: string | null;
  maintenanceEndedAt: string | null;
  productionRestoreReportPath: string | null;
  productionRestoreStatus: string | null;
  productionRestoreCompletedAt: string | null;
  postRestoreCheckedAt: string | null;
  postRestoreSummary: unknown;
  requestedBy: BackupAdminRef | null;
  requestedAt: string;
  preparedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  emergencyBackupJob: BackupJob | null;
  createdAt: string;
  updatedAt: string;
};

export type RestorePrepareResponse = {
  restoreJob: RestoreJob;
  restoreTest: BackupRestoreTestResponse["restoreTest"];
  emergencyBackup: BackupJob;
  nextStep: "WAIT_FOR_EMERGENCY_BACKUP";
  operationRun?: OperationRun | null;
};

export type RestoreConfirmResponse = {
  restoreJob: RestoreJob;
  handoffPath: string;
  scriptPath: string;
  confirmationPhrase: string;
  command: {
    executable: string;
    cwd: string;
    args: string[];
  };
  postRestoreChecklist: string[];
  operationRun?: OperationRun | null;
};

export type RestoreMaintenanceResponse = {
  maintenance: RestoreMaintenanceStatus;
  restoreJob: RestoreJob | null;
  operationRun?: OperationRun | null;
};

export type BackupListParams = {
  page?: number;
  limit?: number;
  status?: BackupStatus | "";
  search?: string;
};

export async function listBackups(params: BackupListParams = {}) {
  const res = await api.get<BackupListResponse>("/api/v1/backups", { params });
  return res.data;
}

export async function getBackupSettings() {
  const res = await api.get<BackupSettings>("/api/v1/backups/settings");
  return res.data;
}

export async function getBackupScheduleStatus() {
  const res = await api.get<BackupScheduleStatus>("/api/v1/backups/schedule");
  return res.data;
}

export async function updateBackupScheduleConfig(payload: BackupScheduleConfigInput) {
  const res = await api.put<BackupScheduleStatus>("/api/v1/backups/schedule", payload);
  return res.data;
}

export async function getBackupStorageStatus() {
  const res = await api.get<BackupStorageStatus>("/api/v1/backups/storage");
  return res.data;
}

export async function selectRecommendedBackupStorage() {
  const res = await api.post<BackupStorageStatus>("/api/v1/backups/storage/recommended");
  return res.data;
}

export async function updateBackupStorageRoot(payload: BackupStorageConfigInput) {
  const res = await api.put<BackupStorageStatus>("/api/v1/backups/storage", payload);
  return res.data;
}

export async function listExternalBackupDrives() {
  const res = await api.get<{ drives: BackupExternalDrive[] }>("/api/v1/backups/external-drives");
  return res.data;
}

export async function copyBackupToExternalDrive(payload: { driveRoot: string; backupId?: string }) {
  const res = await api.post<BackupExternalCopyResponse>("/api/v1/backups/external-copy", payload);
  return res.data;
}

export async function runScheduledBackupNow(payload?: { frequency?: BackupScheduleFrequency }) {
  const res = await api.post<{ job: BackupJob }>("/api/v1/backups/scheduled/run-now", payload ?? {});
  return res.data;
}

export async function getBackupDetails(id: string) {
  const res = await api.get<BackupDetailsResponse>(`/api/v1/backups/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getBackupJob(id: string) {
  const res = await api.get<BackupJob>(`/api/v1/backups/jobs/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createManualBackup(notes?: string) {
  const res = await api.post<BackupJobWithOperation>("/api/v1/backups/manual", { notes });
  return res.data;
}

export async function getOperationRun(id: string) {
  const res = await api.get<OperationRun>(`/api/v1/backups/operation-runs/${encodeURIComponent(id)}`);
  return res.data;
}

export async function importBackup(files: File[]) {
  const form = new FormData();
  for (const file of files) {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    form.append("files", file, relativePath || file.name);
  }
  const res = await api.post<BackupImportResponse>("/api/v1/backups/import", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function verifyBackup(id: string) {
  const res = await api.post<BackupVerificationResponse>(`/api/v1/backups/${encodeURIComponent(id)}/verify`);
  return res.data;
}

export async function createBackupSupportPackage(id: string) {
  const res = await api.post<BackupSupportPackageResponse>(`/api/v1/backups/${encodeURIComponent(id)}/support-package`);
  return res.data;
}

export async function runBackupRestoreTest(id: string) {
  const res = await api.post<BackupRestoreTestResponse>(`/api/v1/backups/${encodeURIComponent(id)}/restore-test`);
  return res.data;
}

export async function runPostRestoreCheck(id: string) {
  const res = await api.post<BackupPostRestoreCheckResponse>(`/api/v1/backups/${encodeURIComponent(id)}/post-restore-check`);
  return res.data;
}

export async function prepareProductionRestore(id: string, notes?: string) {
  const res = await api.post<RestorePrepareResponse>(`/api/v1/backups/${encodeURIComponent(id)}/restore/prepare`, { notes });
  return res.data;
}

export async function getRestoreJob(id: string) {
  const res = await api.get<RestoreJob>(`/api/v1/backups/restore-jobs/${encodeURIComponent(id)}`);
  return res.data;
}

export async function confirmProductionRestoreHandoff(id: string, payload: { folderName: string; phrase: string }) {
  const res = await api.post<RestoreConfirmResponse>(`/api/v1/backups/restore-jobs/${encodeURIComponent(id)}/confirm`, payload);
  return res.data;
}

export async function getRestoreMaintenanceStatus() {
  const res = await api.get<RestoreMaintenanceStatus>("/api/v1/backups/maintenance");
  return res.data;
}

export async function startRestoreMaintenanceMode(id: string, reason?: string) {
  const res = await api.post<RestoreMaintenanceResponse>(`/api/v1/backups/restore-jobs/${encodeURIComponent(id)}/maintenance/start`, { reason });
  return res.data;
}

export async function clearRestoreMaintenanceMode(reason?: string) {
  const res = await api.post<RestoreMaintenanceResponse>("/api/v1/backups/maintenance/clear", { reason });
  return res.data;
}
