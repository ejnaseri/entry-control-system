import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertTriangle,
  IconCalendar,
  IconCalendarMonth,
  IconCalendarStats,
  IconCalendarWeek,
  IconCircleCheck,
  IconCircleX,
  IconClipboardCopy,
  IconClock,
  IconDatabaseExport,
  IconEye,
  IconFileDescription,
  IconFolderOpen,
  IconLoader2,
  IconPlayerPlay,
  IconRefresh,
  IconReportAnalytics,
  IconSearch,
  IconShieldCheck,
  IconUpload,
} from "@tabler/icons-react";
import { useAuth } from "../../auth/AuthContext";
import {
  clearRestoreMaintenanceMode,
  copyBackupToExternalDrive,
  createBackupSupportPackage,
  createManualBackup,
  confirmProductionRestoreHandoff,
  getBackupDetails,
  getBackupJob,
  getOperationRun,
  getRestoreJob,
  importBackup,
  listBackups,
  prepareProductionRestore,
  runPostRestoreCheck,
  runScheduledBackupNow,
  startRestoreMaintenanceMode,
  updateBackupScheduleConfig,
  updateBackupStorageRoot,
  selectRecommendedBackupStorage,
  verifyBackup,
  type BackupExternalCopyResponse,
  type BackupExternalDrive,
  type BackupScheduleFrequency,
  type BackupScheduleConfigInput,
  type BackupScheduleStatus,
  type BackupStorageStatus,
  type BackupDetailsResponse,
  type BackupItem,
  type BackupJob,
  type BackupJobType,
  type BackupListResponse,
  type BackupPostRestoreCheckResponse,
  type BackupRestoreTestResponse,
  type BackupStatus,
  type BackupSupportPackageResponse,
  type BackupVerificationStatus,
  type OperationRun,
  type RestoreConfirmResponse,
  type RestoreJob,
  type RestoreMaintenanceStatus,
} from "../../api/backups";
import { isApiError } from "../../api/client";
import { useGlobalLoading } from "../../components/GlobalLoadingContext";
import { useToast } from "../../components/ToastContext";
import { Button } from "../../components/ui/Button";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../../components/ui/DataTable";
import { PageHeader } from "../../components/ui/PageHeader";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { Tooltip, type TooltipSide } from "../../components/ui/Tooltip";
import { rtlLanguages } from "../../i18n/config";

const PAGE_SIZE = 10;

const statusOptions: Array<"" | BackupStatus> = ["", "RUNNING", "COMPLETED", "FAILED", "PENDING"];
type BackupTextFn = (key: string, options?: Record<string, unknown>) => string;
type DirectoryInputAttributes = InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
};
type BackupFolderPickerWindow = Window & {
  atlasGymDesktop?: {
    chooseBackupFolder?: () => Promise<string | null>;
  };
};
type SafeBackupStepId = "idle" | "checking" | "creating" | "verifying" | "completed" | "failed";
type SafeBackupRunStatus = "idle" | "running" | "succeeded" | "failed";
type SafeBackupRun = {
  operationRunId: string | null;
  status: SafeBackupRunStatus;
  step: SafeBackupStepId;
  percent: number;
  startedAt: number | null;
  finishedAt: number | null;
  jobId: string | null;
  backupId: string | null;
  error: string | null;
};
type SmartImportStepId = "idle" | "scanning" | "checking" | "uploading" | "registering" | "completed" | "failed";
type SmartImportRunStatus = "idle" | "running" | "succeeded" | "failed";
type SmartImportSelectionSummary = {
  sourceKind: "folder" | "zip";
  folderName: string;
  fileCount: number;
  requiredCount: number;
  optionalCount: number;
  missingFiles: string[];
  unsupportedFiles: string[];
  duplicateFiles: string[];
};
type SmartImportRun = {
  operationRunId: string | null;
  status: SmartImportRunStatus;
  step: SmartImportStepId;
  percent: number;
  startedAt: number | null;
  finishedAt: number | null;
  backupId: string | null;
  selection: SmartImportSelectionSummary | null;
  error: string | null;
};
type SupportPackageStepId = "idle" | "checking" | "verifying" | "packaging" | "completed" | "failed";
type SupportPackageRunStatus = "idle" | "running" | "succeeded" | "failed";
type SupportPackageRun = {
  operationRunId: string | null;
  status: SupportPackageRunStatus;
  step: SupportPackageStepId;
  percent: number;
  startedAt: number | null;
  finishedAt: number | null;
  backupId: string | null;
  error: string | null;
};
type RestoreSidecarReport = BackupDetailsResponse["restoreSidecars"]["reports"][number];
type RestoreSidecarPostCheck = BackupDetailsResponse["restoreSidecars"]["postChecks"][number];
type PostRestoreCheckResult = BackupPostRestoreCheckResponse["postRestoreCheck"] | RestoreSidecarPostCheck;
type RecoveryAssistantStepId = "idle" | "checking" | "restoreTesting" | "emergencyBackup" | "confirmation" | "handoff" | "maintenance" | "completed" | "failed";
type RecoveryAssistantRunStatus = "idle" | "running" | "ready" | "succeeded" | "failed";
type RecoveryAssistantRun = {
  operationRunId: string | null;
  status: RecoveryAssistantRunStatus;
  step: RecoveryAssistantStepId;
  percent: number;
  startedAt: number | null;
  finishedAt: number | null;
  backupId: string | null;
  restoreJobId: string | null;
  error: string | null;
};
type BackupScheduleDraft = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  profiles: Record<BackupScheduleFrequency, BackupScheduleProfileDraft>;
  externalCopyEnabled: boolean;
  externalCopyTarget: string;
};
type BackupScheduleProfileDraft = {
  enabled: boolean;
  dailyTime: string;
  minute: string;
  dayOfWeek: string;
  dayOfMonth: string;
  month: string;
  retention: string;
};

const directoryInputAttributes: DirectoryInputAttributes = {
  webkitdirectory: "",
  directory: "",
};

const SAFE_BACKUP_STEPS = ["checking", "creating", "verifying", "completed"] as const;
const SMART_IMPORT_STEPS = ["scanning", "checking", "uploading", "registering", "completed"] as const;
const SUPPORT_PACKAGE_STEPS = ["checking", "verifying", "packaging", "completed"] as const;
const RECOVERY_ASSISTANT_STEPS = ["checking", "restoreTesting", "emergencyBackup", "confirmation", "handoff", "maintenance"] as const;
const IMPORT_REQUIRED_FILE_NAMES = ["database.dump", "manifest.json", "backup.log"] as const;
const IMPORT_REQUIRED_FILE_SET = new Set<string>(IMPORT_REQUIRED_FILE_NAMES);
const IMPORT_OPTIONAL_FILE_PATTERN = /^(restore-test-report|production-restore-report|production-restore-handoff|post-restore-check)_[A-Za-z0-9_-]+\.json$/u;
const BACKUP_SCHEDULE_FREQUENCIES: BackupScheduleFrequency[] = ["hourly", "daily", "weekly", "monthly", "yearly"];
const BACKUP_WEEKDAY_VALUES = ["0", "1", "2", "3", "4", "5", "6"] as const;
const BACKUP_MONTH_VALUES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
const BACKUP_WEEKDAY_LABEL_KEYS: Record<(typeof BACKUP_WEEKDAY_VALUES)[number], string> = {
  "0": "sunday",
  "1": "monday",
  "2": "tuesday",
  "3": "wednesday",
  "4": "thursday",
  "5": "friday",
  "6": "saturday",
};
const BACKUP_MONTH_LABEL_KEYS: Record<(typeof BACKUP_MONTH_VALUES)[number], string> = {
  "1": "january",
  "2": "february",
  "3": "march",
  "4": "april",
  "5": "may",
  "6": "june",
  "7": "july",
  "8": "august",
  "9": "september",
  "10": "october",
  "11": "november",
  "12": "december",
};
const BACKUP_SCHEDULE_DEFAULT_RETENTION: Record<BackupScheduleFrequency, string> = {
  hourly: "24",
  daily: "14",
  weekly: "8",
  monthly: "6",
  yearly: "5",
};

function createDefaultScheduleProfileDraft(frequency: BackupScheduleFrequency): BackupScheduleProfileDraft {
  return {
    enabled: false,
    dailyTime: "23:30",
    minute: "30",
    dayOfWeek: "1",
    dayOfMonth: "1",
    month: "1",
    retention: BACKUP_SCHEDULE_DEFAULT_RETENTION[frequency],
  };
}

function createDefaultScheduleProfilesDraft(): Record<BackupScheduleFrequency, BackupScheduleProfileDraft> {
  return BACKUP_SCHEDULE_FREQUENCIES.reduce((profiles, frequency) => {
    profiles[frequency] = createDefaultScheduleProfileDraft(frequency);
    return profiles;
  }, {} as Record<BackupScheduleFrequency, BackupScheduleProfileDraft>);
}
const SAFE_BACKUP_INITIAL_RUN: SafeBackupRun = {
  operationRunId: null,
  status: "idle",
  step: "idle",
  percent: 0,
  startedAt: null,
  finishedAt: null,
  jobId: null,
  backupId: null,
  error: null,
};
const SMART_IMPORT_INITIAL_RUN: SmartImportRun = {
  operationRunId: null,
  status: "idle",
  step: "idle",
  percent: 0,
  startedAt: null,
  finishedAt: null,
  backupId: null,
  selection: null,
  error: null,
};
const SUPPORT_PACKAGE_INITIAL_RUN: SupportPackageRun = {
  operationRunId: null,
  status: "idle",
  step: "idle",
  percent: 0,
  startedAt: null,
  finishedAt: null,
  backupId: null,
  error: null,
};
const RECOVERY_ASSISTANT_INITIAL_RUN: RecoveryAssistantRun = {
  operationRunId: null,
  status: "idle",
  step: "idle",
  percent: 0,
  startedAt: null,
  finishedAt: null,
  backupId: null,
  restoreJobId: null,
  error: null,
};
const BACKUP_SCHEDULE_INITIAL_DRAFT: BackupScheduleDraft = {
  enabled: false,
  frequency: "daily",
  profiles: createDefaultScheduleProfilesDraft(),
  externalCopyEnabled: false,
  externalCopyTarget: "",
};

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function getImportFileName(file: File) {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const parts = relativePath.replace(/\\/gu, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] || file.name;
}

function isImportZipFile(file: File) {
  return getImportFileName(file).toLowerCase().endsWith(".zip");
}

function isOptionalImportFileName(fileName: string) {
  return fileName === "support-summary.json" || IMPORT_OPTIONAL_FILE_PATTERN.test(fileName);
}

function getImportFolderName(files: File[]) {
  const parentNames = files
    .map((file) => {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
      const parts = relativePath.replace(/\\/gu, "/").split("/").filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 2] : null;
    })
    .filter((value): value is string => Boolean(value));
  const uniqueParents = new Set(parentNames);
  if (uniqueParents.size === 1) return parentNames[0];
  return files.length ? "selected backup folder" : "-";
}

function summarizeImportSelection(files: File[]): SmartImportSelectionSummary {
  if (files.length === 1 && isImportZipFile(files[0])) {
    return {
      sourceKind: "zip",
      folderName: files[0].name,
      fileCount: 1,
      requiredCount: 3,
      optionalCount: 0,
      missingFiles: [],
      unsupportedFiles: [],
      duplicateFiles: [],
    };
  }

  const fileNames = files.map(getImportFileName);
  const counts = new Map<string, number>();
  const unsupportedFiles: string[] = [];
  let optionalCount = 0;

  for (const fileName of fileNames) {
    counts.set(fileName, (counts.get(fileName) ?? 0) + 1);
    if (IMPORT_REQUIRED_FILE_SET.has(fileName)) continue;
    if (isOptionalImportFileName(fileName)) {
      optionalCount += 1;
      continue;
    }
    unsupportedFiles.push(fileName);
  }

  const missingFiles = IMPORT_REQUIRED_FILE_NAMES.filter((fileName) => !counts.has(fileName));
  const duplicateFiles = Array.from(counts.entries())
    .filter(([fileName, count]) => IMPORT_REQUIRED_FILE_SET.has(fileName) && count > 1)
    .map(([fileName]) => fileName);

  return {
    sourceKind: "folder",
    folderName: getImportFolderName(files),
    fileCount: files.length,
    requiredCount: IMPORT_REQUIRED_FILE_NAMES.filter((fileName) => counts.has(fileName)).length,
    optionalCount,
    missingFiles,
    unsupportedFiles,
    duplicateFiles,
  };
}

function getImportSelectionError(summary: SmartImportSelectionSummary, t: BackupTextFn) {
  if (summary.sourceKind === "zip") return null;
  if (summary.fileCount > 24) return t("settings.backups.importAssistant.errors.tooMany");
  if (summary.missingFiles.length) return `${t("settings.backups.importAssistant.errors.missing")}: ${summary.missingFiles.join(", ")}`;
  if (summary.duplicateFiles.length) return `${t("settings.backups.importAssistant.errors.duplicate")}: ${summary.duplicateFiles.join(", ")}`;
  if (summary.unsupportedFiles.length) return `${t("settings.backups.importAssistant.errors.unsupported")}: ${summary.unsupportedFiles.slice(0, 4).join(", ")}`;
  return null;
}

function getSmartImportErrorMessage(error: unknown, t: BackupTextFn, sourceKind: SmartImportSelectionSummary["sourceKind"] | null = null) {
  const message = getErrorMessage(error, t("settings.backups.errors.import"));
  const normalized = message.toLowerCase();
  if (sourceKind === "zip") {
    if (
      normalized.includes("backup zip") ||
      normalized.includes("too many files") ||
      normalized.includes("unsupported file") ||
      normalized.includes("missing ") ||
      normalized.includes("duplicate file") ||
      normalized.includes("unsafe file") ||
      normalized.includes("invalid or unreadable") ||
      normalized.includes("sha-256") ||
      normalized.includes("verification failed") ||
      normalized.includes("dump size")
    ) {
      return t("settings.backups.importAssistant.errors.invalidZip");
    }
  }
  if (normalized.includes("missing database.dump")) return `${t("settings.backups.importAssistant.errors.missing")}: database.dump`;
  if (normalized.includes("missing manifest.json")) return `${t("settings.backups.importAssistant.errors.missing")}: manifest.json`;
  if (normalized.includes("missing backup.log")) return `${t("settings.backups.importAssistant.errors.missing")}: backup.log`;
  if (normalized.includes("duplicate file")) return message.replace("Backup import contains duplicate file", t("settings.backups.importAssistant.errors.duplicate"));
  if (normalized.includes("unsupported file")) return message.replace("Backup import rejected unsupported file", t("settings.backups.importAssistant.errors.unsupported"));
  if (normalized.includes("too many files")) return t("settings.backups.importAssistant.errors.tooMany");
  if (normalized.includes("unsafe file name")) return t("settings.backups.importAssistant.errors.unsafe");
  if (normalized.includes("invalid or unreadable")) return t("settings.backups.importAssistant.errors.invalidManifest");
  if (normalized.includes("sha-256") || normalized.includes("verification failed") || normalized.includes("dump size")) return t("settings.backups.importAssistant.errors.hashMismatch");
  return message;
}

function shortenHash(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 20) return value;
  return `${value.slice(0, 12)}...${value.slice(-8)}`;
}

function buildSupportSummaryText({
  backup,
  result,
  locale,
  t,
}: {
  backup: BackupItem;
  result: BackupSupportPackageResponse;
  locale: string;
  t: BackupTextFn;
}) {
  const labels = {
    title: t("settings.backups.supportSummary.title"),
    backupFolder: t("settings.backups.supportSummary.backupFolder"),
    backupType: t("settings.backups.supportSummary.backupType"),
    backupStatus: t("settings.backups.supportSummary.backupStatus"),
    verification: t("settings.backups.supportSummary.verification"),
    started: t("settings.backups.supportSummary.started"),
    createdBy: t("settings.backups.supportSummary.createdBy"),
    backupSize: t("settings.backups.supportSummary.backupSize"),
    backupSha: t("settings.backups.supportSummary.backupSha"),
    supportPackage: t("settings.backups.supportSummary.supportPackage"),
    zipFile: t("settings.backups.supportSummary.zipFile"),
    zipSize: t("settings.backups.supportSummary.zipSize"),
    zipSha: t("settings.backups.supportSummary.zipSha"),
    includedFiles: t("settings.backups.supportSummary.includedFiles"),
    safetyNote: t("settings.backups.supportSummary.safetyNote"),
    customerInstruction: t("settings.backups.supportSummary.customerInstruction"),
  };

  return [
    labels.title,
    "",
    `${labels.backupFolder}: ${backup.folderName ?? result.supportPackage.sourceFolderName}`,
    `${labels.backupType}: ${backupTypeLabel(t, backup)}`,
    `${labels.backupStatus}: ${t(`settings.backups.status.${backup.status}`)}`,
    `${labels.verification}: ${t(`settings.backups.verification.${backup.verificationStatus}`)}`,
    `${labels.started}: ${formatDateTime(backup.startedAt, locale)}`,
    `${labels.createdBy}: ${getBackupOwner(backup)}`,
    `${labels.backupSize}: ${formatBytes(backup.sizeBytes)}`,
    `${labels.backupSha}: ${backup.sha256 ?? "-"}`,
    "",
    `${labels.supportPackage}:`,
    `${labels.zipFile}: ${result.supportPackage.archive.path}`,
    `${labels.zipSize}: ${formatBytes(result.supportPackage.archive.sizeBytes)}`,
    `${labels.zipSha}: ${result.supportPackage.archive.sha256}`,
    `${labels.includedFiles}: ${result.supportPackage.includedFiles.map((file) => file.name).join(", ")}`,
    "",
    labels.safetyNote,
    labels.customerInstruction,
  ].join("\n");
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asJsonRecord(value: unknown) {
  return isJsonRecord(value) ? value : {};
}

function readStringField(value: unknown, key: string) {
  const record = asJsonRecord(value);
  return typeof record[key] === "string" ? record[key] : null;
}

function readNumberField(value: unknown, key: string) {
  const record = asJsonRecord(value);
  const field = record[key];
  if (typeof field === "number" && Number.isFinite(field)) return field;
  if (typeof field === "string" && field.trim()) {
    const parsed = Number(field);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStringArrayField(value: unknown, key: string) {
  const record = asJsonRecord(value);
  const field = record[key];
  return Array.isArray(field) ? field.filter((item): item is string => typeof item === "string") : [];
}

function parseOperationTimestamp(value: string | null | undefined, fallback: number | null = null) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeOperationPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isOperationRunActive(run: OperationRun) {
  return run.status === "PENDING" || run.status === "RUNNING";
}

function operationRunStatus(run: OperationRun): SafeBackupRunStatus {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "succeeded";
  return "running";
}

function isKnownStep<T extends readonly string[]>(steps: T, step: string | null | undefined): step is T[number] {
  return typeof step === "string" && (steps as readonly string[]).includes(step);
}

function pathBasename(value: string | null | undefined) {
  if (!value) return null;
  const parts = value.replace(/\\/gu, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? value;
}

function operationRunBackupId(run: OperationRun) {
  const resultBackupId = readStringField(run.result, "backupId") ?? readStringField(run.result, "selectedBackupId");
  if (resultBackupId) return resultBackupId;
  const metadataBackupId = readStringField(run.metadata, "backupId") ?? readStringField(run.metadata, "selectedBackupId");
  if (metadataBackupId) return metadataBackupId;
  return run.targetType === "Backup" ? run.targetId : null;
}

function operationRunBackupJobId(run: OperationRun) {
  return readStringField(run.result, "backupJobId") ?? (run.targetType === "BackupJob" ? run.targetId : null);
}

function operationRunRestoreJobId(run: OperationRun) {
  return readStringField(run.result, "restoreJobId") ?? (run.targetType === "RestoreJob" ? run.targetId : null);
}

function safeBackupStepFromOperationRun(run: OperationRun): SafeBackupStepId {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "completed";
  return isKnownStep(SAFE_BACKUP_STEPS, run.step) ? run.step : "creating";
}

function smartImportStepFromOperationRun(run: OperationRun): SmartImportStepId {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "completed";
  return isKnownStep(SMART_IMPORT_STEPS, run.step) ? run.step : "scanning";
}

function supportPackageStepFromOperationRun(run: OperationRun): SupportPackageStepId {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "completed";
  return isKnownStep(SUPPORT_PACKAGE_STEPS, run.step) ? run.step : "checking";
}

function recoveryStepFromOperationRun(run: OperationRun): RecoveryAssistantStepId {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "completed";
  return isKnownStep(RECOVERY_ASSISTANT_STEPS, run.step) ? run.step : "checking";
}

function recoveryStatusFromOperationRun(run: OperationRun, step: RecoveryAssistantStepId): RecoveryAssistantRunStatus {
  if (run.status === "FAILED" || run.status === "CANCELLED") return "failed";
  if (run.status === "SUCCEEDED") return "succeeded";
  if (step === "confirmation" || step === "handoff" || step === "maintenance") return "ready";
  return "running";
}

function smartImportSelectionFromOperationRun(run: OperationRun, current: SmartImportRun): SmartImportSelectionSummary | null {
  if (current.selection) return current.selection;

  const result = asJsonRecord(run.result);
  const metadata = asJsonRecord(run.metadata);
  const sourceKindValue = readStringField(result, "sourceKind") ?? readStringField(metadata, "sourceKind");
  const sourceKind: SmartImportSelectionSummary["sourceKind"] = sourceKindValue === "zip" ? "zip" : "folder";
  const originalNames = readStringArrayField(metadata, "originalNames");
  const location = readStringField(result, "location");
  const fileCount = readNumberField(metadata, "fileCount") ?? (sourceKind === "zip" ? 1 : originalNames.length);
  const folderName =
    sourceKind === "zip"
      ? originalNames[0] ?? pathBasename(location) ?? "selected ZIP"
      : pathBasename(location) ?? originalNames[0] ?? "selected backup";

  return {
    sourceKind,
    folderName,
    fileCount,
    requiredCount: run.status === "SUCCEEDED" || sourceKind === "zip" ? 3 : Math.min(3, fileCount),
    optionalCount: 0,
    missingFiles: [],
    unsupportedFiles: [],
    duplicateFiles: [],
  };
}

function safeBackupRunFromOperationRun(run: OperationRun, current: SafeBackupRun): SafeBackupRun {
  return {
    ...current,
    operationRunId: run.id,
    status: operationRunStatus(run),
    step: safeBackupStepFromOperationRun(run),
    percent: normalizeOperationPercent(run.percent),
    startedAt: parseOperationTimestamp(run.startedAt, current.startedAt),
    finishedAt: parseOperationTimestamp(run.finishedAt, current.finishedAt),
    jobId: operationRunBackupJobId(run) ?? current.jobId,
    backupId: operationRunBackupId(run) ?? current.backupId,
    error: run.errorMessage ?? null,
  };
}

function smartImportRunFromOperationRun(run: OperationRun, current: SmartImportRun): SmartImportRun {
  return {
    ...current,
    operationRunId: run.id,
    status: operationRunStatus(run),
    step: smartImportStepFromOperationRun(run),
    percent: normalizeOperationPercent(run.percent),
    startedAt: parseOperationTimestamp(run.startedAt, current.startedAt),
    finishedAt: parseOperationTimestamp(run.finishedAt, current.finishedAt),
    backupId: operationRunBackupId(run) ?? current.backupId,
    selection: smartImportSelectionFromOperationRun(run, current),
    error: run.errorMessage ?? null,
  };
}

function supportPackageRunFromOperationRun(run: OperationRun, current: SupportPackageRun): SupportPackageRun {
  return {
    ...current,
    operationRunId: run.id,
    status: operationRunStatus(run),
    step: supportPackageStepFromOperationRun(run),
    percent: normalizeOperationPercent(run.percent),
    startedAt: parseOperationTimestamp(run.startedAt, current.startedAt),
    finishedAt: parseOperationTimestamp(run.finishedAt, current.finishedAt),
    backupId: operationRunBackupId(run) ?? current.backupId,
    error: run.errorMessage ?? null,
  };
}

function recoveryAssistantRunFromOperationRun(run: OperationRun, current: RecoveryAssistantRun): RecoveryAssistantRun {
  const step = recoveryStepFromOperationRun(run);
  return {
    ...current,
    operationRunId: run.id,
    status: recoveryStatusFromOperationRun(run, step),
    step,
    percent: normalizeOperationPercent(run.percent),
    startedAt: parseOperationTimestamp(run.startedAt, current.startedAt),
    finishedAt: parseOperationTimestamp(run.finishedAt, current.finishedAt),
    backupId: operationRunBackupId(run) ?? current.backupId,
    restoreJobId: operationRunRestoreJobId(run) ?? current.restoreJobId,
    error: run.errorMessage ?? null,
  };
}

function isBackupScheduleFrequency(value: unknown): value is BackupScheduleFrequency {
  return typeof value === "string" && BACKUP_SCHEDULE_FREQUENCIES.includes(value as BackupScheduleFrequency);
}

function timeMinuteValue(value: string | null | undefined) {
  const minute = Number((value ?? "").split(":")[1]);
  return Number.isInteger(minute) ? String(Math.max(0, Math.min(59, minute))) : "30";
}

function clampScheduleNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function scheduleFrequencyLabel(t: BackupTextFn, frequency: BackupScheduleFrequency) {
  return t(`settings.backups.schedule.${frequency}`);
}

function backupTypeLabel(t: BackupTextFn, backup: Pick<BackupItem, "type" | "scheduleFrequency">) {
  const base = t(`settings.backups.type.${backup.type}`);
  if (backup.type === "SCHEDULED" && backup.scheduleFrequency) {
    return `${base} / ${scheduleFrequencyLabel(t, backup.scheduleFrequency)}`;
  }
  return base;
}

function activeRetentionValue(draft: BackupScheduleDraft) {
  return retentionValueForFrequency(draft, draft.frequency);
}

function activeScheduleProfilesLabel(t: BackupTextFn, draft: BackupScheduleDraft) {
  const activeProfiles = BACKUP_SCHEDULE_FREQUENCIES.filter((frequency) => draft.profiles[frequency]?.enabled).map((frequency) =>
    scheduleFrequencyLabel(t, frequency)
  );
  return activeProfiles.length > 0 ? activeProfiles.join(", ") : t("settings.backups.schedule.statusOff");
}

function retentionValueForFrequency(draft: BackupScheduleDraft, frequency: BackupScheduleFrequency) {
  return draft.profiles[frequency]?.retention ?? BACKUP_SCHEDULE_DEFAULT_RETENTION[frequency];
}

function weekdayLabel(t: BackupTextFn, value: string) {
  const key = BACKUP_WEEKDAY_LABEL_KEYS[value as (typeof BACKUP_WEEKDAY_VALUES)[number]];
  return key ? t(`settings.backups.schedule.${key}`) : "-";
}

function monthLabel(t: BackupTextFn, value: string) {
  const key = BACKUP_MONTH_LABEL_KEYS[value as (typeof BACKUP_MONTH_VALUES)[number]];
  return key ? t(`settings.backups.schedule.${key}`) : "-";
}

function formatScheduleDraftTiming(t: BackupTextFn, draft: BackupScheduleDraft) {
  const profile = draft.profiles[draft.frequency] ?? createDefaultScheduleProfileDraft(draft.frequency);
  if (draft.frequency === "hourly") {
    return `${t("settings.backups.schedule.hourly")} - ${t("settings.backups.schedule.minuteOfHour")} ${profile.minute || "0"}`;
  }
  if (draft.frequency === "weekly") {
    return `${weekdayLabel(t, profile.dayOfWeek)}, ${profile.dailyTime || "-"}`;
  }
  if (draft.frequency === "monthly") {
    return `${t("settings.backups.schedule.dayOfMonth")} ${profile.dayOfMonth || "1"}, ${profile.dailyTime || "-"}`;
  }
  if (draft.frequency === "yearly") {
    return `${monthLabel(t, profile.month)} ${profile.dayOfMonth || "1"}, ${profile.dailyTime || "-"}`;
  }
  return profile.dailyTime || "-";
}

function scheduleDraftFromStatus(status: BackupScheduleStatus | null | undefined): BackupScheduleDraft {
  if (!status) return BACKUP_SCHEDULE_INITIAL_DRAFT;
  const schedule = status.config.schedule;
  const frequency = isBackupScheduleFrequency(status.config.frequency)
    ? status.config.frequency
    : isBackupScheduleFrequency(schedule?.frequency)
      ? schedule.frequency
      : BACKUP_SCHEDULE_INITIAL_DRAFT.frequency;
  const profiles = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, item) => {
    const source = status.config.profiles?.[item] ?? (item === frequency ? schedule : null);
    const defaults = createDefaultScheduleProfileDraft(item);
    const dailyTime = source?.time || (item === frequency ? status.config.dailyTime : null) || defaults.dailyTime;
    result[item] = {
      enabled: Boolean(source?.enabled),
      dailyTime,
      minute: String(source?.minute ?? timeMinuteValue(dailyTime)),
      dayOfWeek: String(source?.dayOfWeek ?? defaults.dayOfWeek),
      dayOfMonth: String(source?.dayOfMonth ?? defaults.dayOfMonth),
      month: String(source?.month ?? defaults.month),
      retention: String(status.config.retention[item] || defaults.retention),
    };
    return result;
  }, {} as Record<BackupScheduleFrequency, BackupScheduleProfileDraft>);
  return {
    enabled: status.config.enabled,
    frequency,
    profiles,
    externalCopyEnabled: status.config.externalCopy.enabled,
    externalCopyTarget: status.config.externalCopy.lastTarget ?? "",
  };
}

export function BackupsPage() {
  const { t: translate, i18n } = useTranslation();
  const { push } = useToast();
  const { auth, hasPermission } = useAuth();
  const t = useCallback(
    (key: string, options?: Record<string, unknown>) => translate(key, options) as string,
    [translate],
  );
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [data, setData] = useState<BackupListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [supportPackagingId, setSupportPackagingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [restorePreparingId, setRestorePreparingId] = useState<string | null>(null);
  const [restoreConfirming, setRestoreConfirming] = useState(false);
  const [restoreMaintenanceSubmitting, setRestoreMaintenanceSubmitting] = useState<"start" | "clear" | null>(null);
  const [restoreTestResult, setRestoreTestResult] = useState<BackupRestoreTestResponse | null>(null);
  const [postRestoreCheckingId, setPostRestoreCheckingId] = useState<string | null>(null);
  const [postRestoreCheckResult, setPostRestoreCheckResult] = useState<BackupPostRestoreCheckResponse | null>(null);
  const [restoreJob, setRestoreJob] = useState<RestoreJob | null>(null);
  const [restoreConfirmResult, setRestoreConfirmResult] = useState<RestoreConfirmResponse | null>(null);
  const [restoreMaintenance, setRestoreMaintenance] = useState<RestoreMaintenanceStatus | null>(null);
  const [safeBackupRun, setSafeBackupRun] = useState<SafeBackupRun>(SAFE_BACKUP_INITIAL_RUN);
  const [smartImportRun, setSmartImportRun] = useState<SmartImportRun>(SMART_IMPORT_INITIAL_RUN);
  const [supportPackageRun, setSupportPackageRun] = useState<SupportPackageRun>(SUPPORT_PACKAGE_INITIAL_RUN);
  const [supportPackageResult, setSupportPackageResult] = useState<BackupSupportPackageResponse | null>(null);
  const [recoveryAssistantRun, setRecoveryAssistantRun] = useState<RecoveryAssistantRun>(RECOVERY_ASSISTANT_INITIAL_RUN);
  const [scheduleDraft, setScheduleDraft] = useState<BackupScheduleDraft>(BACKUP_SCHEDULE_INITIAL_DRAFT);
  const [scheduleManagerOpen, setScheduleManagerOpen] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleRunning, setScheduleRunning] = useState(false);
  const [storageEditing, setStorageEditing] = useState(false);
  const [storagePathDraft, setStoragePathDraft] = useState("");
  const [storageSaving, setStorageSaving] = useState<"recommended" | "custom" | null>(null);
  const [storagePickerOpening, setStoragePickerOpening] = useState(false);
  const [externalCopying, setExternalCopying] = useState(false);
  const [externalDriveRoot, setExternalDriveRoot] = useState("");
  const [externalCopyResult, setExternalCopyResult] = useState<BackupExternalCopyResponse | null>(null);
  const [restoreConfirmPhrase, setRestoreConfirmPhrase] = useState("");
  const [status, setStatus] = useState<"" | BackupStatus>("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<BackupDetailsResponse | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importZipInputRef = useRef<HTMLInputElement | null>(null);
  const detailsPanelRef = useRef<HTMLDivElement | null>(null);
  const settledOperationRunIdsRef = useRef<Set<string>>(new Set());

  const hasRunningBackup = Boolean(data?.settings.activeJob || data?.items.some((item) => item.status === "RUNNING"));
  const hasBackupCreatePermission = hasPermission("BACKUP_CREATE");
  const hasBackupManagePermission = hasPermission("BACKUP_SETTINGS_MANAGE");
  const hasRestorePermission = hasPermission("RESTORE_DATABASE");
  const isVendorMaintenance = auth?.user.role === "VENDOR_OWNER";
  const canClearRestoreMaintenance = Boolean(hasBackupManagePermission && (auth?.user.role === "GYM_OWNER" || auth?.user.role === "VENDOR_OWNER"));
  const backupToolsAvailable = Boolean(data?.settings.scriptExists && data?.settings.pgDumpAvailable);
  const storageFolderPickerAvailable =
    typeof window !== "undefined" &&
    typeof (window as BackupFolderPickerWindow).atlasGymDesktop?.chooseBackupFolder === "function";
  const canCreateBackup = hasBackupCreatePermission && backupToolsAvailable;
  const canCreateSafeBackup = canCreateBackup && hasBackupManagePermission;
  const canImportBackup = hasBackupCreatePermission && !hasRunningBackup;
  const blockingLoad = loading && !data;

  useGlobalLoading(blockingLoad, {
    message: t("common.messages.loading"),
    subtitle: t("settings.backups.title"),
  });

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const result = await listBackups({ page, limit: PAGE_SIZE, status, search });
        setData(result);
        setRestoreMaintenance(result.settings.restoreMaintenance);
      } catch (error) {
        push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.load")) });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [page, push, search, status, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setScheduleDraft(scheduleDraftFromStatus(data?.settings.schedule));
  }, [data?.settings.schedule]);

  useEffect(() => {
    const currentRoot = data?.settings.storage.currentRoot;
    if (!currentRoot || storageEditing) return;
    setStoragePathDraft(currentRoot);
  }, [data?.settings.storage.currentRoot, storageEditing]);

  const externalDriveKey = useMemo(
    () => (data?.settings.externalCopy.availableDrives ?? []).map((drive) => drive.rootPath).join("|"),
    [data?.settings.externalCopy.availableDrives],
  );

  useEffect(() => {
    const drives = data?.settings.externalCopy.availableDrives ?? [];
    setExternalDriveRoot((current) => {
      if (current && drives.some((drive) => drive.rootPath === current)) return current;
      return drives[0]?.rootPath ?? "";
    });
  }, [data?.settings.externalCopy.availableDrives, externalDriveKey]);

  useEffect(() => {
    if (!hasRunningBackup) return;
    const timer = window.setInterval(() => {
      void load(true);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasRunningBackup, load]);

  useEffect(() => {
    if (!restoreJob || !["TESTING", "EMERGENCY_BACKUP_RUNNING"].includes(restoreJob.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const next = await getRestoreJob(restoreJob.id);
        setRestoreJob(next);
        if (next.emergencyBackupJob?.status === "COMPLETED") {
          await load(true);
        }
      } catch {
        window.clearInterval(timer);
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [load, restoreJob]);

  const applyDetails = useCallback((nextDetails: BackupDetailsResponse) => {
    setDetails(nextDetails);
    if (nextDetails.restoreJob) {
      setRestoreJob(nextDetails.restoreJob);
      setRestoreConfirmResult((current) => (current?.restoreJob.id === nextDetails.restoreJob?.id ? current : null));
    }
  }, []);

  const applyOperationRun = useCallback((run: OperationRun) => {
    const backupId = operationRunBackupId(run);
    switch (run.type) {
      case "SAFE_BACKUP":
        setSafeBackupRun((current) => safeBackupRunFromOperationRun(run, current));
        break;
      case "IMPORT_BACKUP":
        setSmartImportRun((current) => smartImportRunFromOperationRun(run, current));
        break;
      case "SUPPORT_PACKAGE":
        setSupportPackageRun((current) => supportPackageRunFromOperationRun(run, current));
        break;
      case "PREPARE_RECOVERY":
        setRecoveryAssistantRun((current) => recoveryAssistantRunFromOperationRun(run, current));
        break;
      default:
        break;
    }

    if (backupId && ["SAFE_BACKUP", "IMPORT_BACKUP", "SUPPORT_PACKAGE", "PREPARE_RECOVERY"].includes(run.type)) {
      setSelectedId((current) => current ?? backupId);
    }
  }, []);

  const handleOperationRunSettled = useCallback(
    async (run: OperationRun) => {
      if (settledOperationRunIdsRef.current.has(run.id)) return;
      settledOperationRunIdsRef.current.add(run.id);

      const backupId = operationRunBackupId(run);
      const restoreJobId = operationRunRestoreJobId(run);
      if (restoreJobId && run.type === "PREPARE_RECOVERY") {
        try {
          setRestoreJob(await getRestoreJob(restoreJobId));
        } catch {
          // A list refresh below will recover if the restore job is still present.
        }
      }

      await load(true);
      if (backupId) {
        setSelectedId(backupId);
        try {
          applyDetails(await getBackupDetails(backupId));
        } catch {
          // The operation result remains visible even if details refresh fails.
        }
      }
    },
    [applyDetails, load],
  );

  useEffect(() => {
    for (const run of data?.settings.activeOperationRuns ?? []) {
      applyOperationRun(run);
    }
  }, [applyOperationRun, data?.settings.activeOperationRuns]);

  const trackedOperationRunKey = useMemo(() => {
    const ids = new Set<string>();
    for (const run of data?.settings.activeOperationRuns ?? []) {
      ids.add(run.id);
    }
    if (safeBackupRun.operationRunId && safeBackupRun.status === "running") {
      ids.add(safeBackupRun.operationRunId);
    }
    if (smartImportRun.operationRunId && smartImportRun.status === "running") {
      ids.add(smartImportRun.operationRunId);
    }
    if (supportPackageRun.operationRunId && supportPackageRun.status === "running") {
      ids.add(supportPackageRun.operationRunId);
    }
    if (recoveryAssistantRun.operationRunId && (recoveryAssistantRun.status === "running" || recoveryAssistantRun.status === "ready")) {
      ids.add(recoveryAssistantRun.operationRunId);
    }
    return Array.from(ids).sort().join("|");
  }, [
    data?.settings.activeOperationRuns,
    recoveryAssistantRun.operationRunId,
    recoveryAssistantRun.status,
    safeBackupRun.operationRunId,
    safeBackupRun.status,
    smartImportRun.operationRunId,
    smartImportRun.status,
    supportPackageRun.operationRunId,
    supportPackageRun.status,
  ]);

  useEffect(() => {
    const ids = trackedOperationRunKey.split("|").filter(Boolean);
    if (!ids.length) return;

    let cancelled = false;
    const syncRuns = async () => {
      for (const id of ids) {
        try {
          const run = await getOperationRun(id);
          if (cancelled) return;
          applyOperationRun(run);

          if (run.type === "PREPARE_RECOVERY") {
            const restoreJobId = operationRunRestoreJobId(run);
            if (restoreJobId) {
              try {
                setRestoreJob(await getRestoreJob(restoreJobId));
              } catch {
                // The next list/details refresh will reconcile stale restore jobs.
              }
            }
          }

          if (!isOperationRunActive(run)) {
            await handleOperationRunSettled(run);
          }
        } catch {
          // If a run disappears or the server restarts, the next list refresh is the source of truth.
        }
      }
    };

    void syncRuns();
    const timer = window.setInterval(() => void syncRuns(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [applyOperationRun, handleOperationRunSettled, trackedOperationRunKey]);

  const selectedBackup = useMemo(
    () => data?.items.find((item) => item.id === selectedId) ?? details?.backup ?? null,
    [data?.items, details?.backup, selectedId],
  );

  const waitForBackupCompletion = async (job: BackupJob) => {
    let latest = job;
    for (let attempt = 0; attempt < 140; attempt += 1) {
      if (latest.status === "COMPLETED" || latest.status === "FAILED") return latest;
      await delay(2500);
      latest = await getBackupJob(job.id);
      setSafeBackupRun((current) =>
        current.jobId === job.id && current.status === "running" && current.step === "creating"
          ? { ...current, percent: Math.min(68, 24 + attempt) }
          : current,
      );
    }
    throw new Error(t("settings.backups.errors.safeBackupTimeout"));
  };

  const loadFirstBackupPage = async () => {
    const result = await listBackups({ page: 1, limit: PAGE_SIZE });
    setStatus("");
    setSearchDraft("");
    setSearch("");
    setPage(1);
    setData(result);
    setRestoreMaintenance(result.settings.restoreMaintenance);
    return result;
  };

  const findBackupItemByJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await loadFirstBackupPage();
      const item = result.items.find((candidate) => candidate.jobId === jobId);
      if (item) return item;
      await delay(750);
    }
    throw new Error(t("settings.backups.errors.safeBackupNotFound"));
  };

  const waitForRestorePreparationReady = async (job: RestoreJob) => {
    let latest = job;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (latest.status === "READY_FOR_CONFIRMATION" || latest.status === "FAILED" || latest.status === "BLOCKED" || latest.status === "CANCELLED") return latest;
      await delay(2500);
      latest = await getRestoreJob(job.id);
      setRestoreJob(latest);
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === job.id && current.status === "running"
          ? { ...current, step: "emergencyBackup", percent: Math.min(78, 54 + attempt) }
          : current,
      );
    }
    throw new Error(t("settings.backups.errors.restorePrepareTimeout"));
  };

  const handleCreateSafeBackup = async () => {
    setCreating(true);
    const startedAt = Date.now();
    setSafeBackupRun({ ...SAFE_BACKUP_INITIAL_RUN, status: "running", step: "checking", percent: 6, startedAt });
    try {
      await delay(250);
      setSafeBackupRun((current) => ({ ...current, step: "creating", percent: 16 }));
      const job = await createManualBackup(notes.trim() || undefined);
      setNotes("");
      if (job.operationRun) applyOperationRun(job.operationRun);
      setSafeBackupRun((current) => ({ ...current, operationRunId: job.operationRun?.id ?? current.operationRunId, jobId: job.id, step: "creating", percent: 24 }));

      const completedJob = await waitForBackupCompletion(job);
      if (completedJob.status !== "COMPLETED") {
        throw new Error(completedJob.errorMessage || t("settings.backups.errors.create"));
      }

      setSafeBackupRun((current) => ({ ...current, step: "verifying", percent: 72 }));
      const backup = await findBackupItemByJob(job.id);
      setSelectedId(backup.id);
      setSafeBackupRun((current) => ({ ...current, backupId: backup.id, step: "verifying", percent: 84 }));

      const verification = await verifyBackup(backup.id);
      if (verification.operationRun) applyOperationRun(verification.operationRun);
      await loadFirstBackupPage();
      applyDetails(await getBackupDetails(backup.id));
      setSafeBackupRun((current) => ({ ...current, status: "succeeded", step: "completed", percent: 100, finishedAt: Date.now() }));
      push({ kind: "success", title: t("settings.backups.messages.safeBackupReady") });
    } catch (error) {
      const message = getErrorMessage(error, t("settings.backups.errors.safeBackup"));
      setSafeBackupRun((current) => ({ ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() }));
      push({ kind: "error", title: message });
      await load(true);
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    try {
      const profiles = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, frequency) => {
        const profile = scheduleDraft.profiles[frequency] ?? createDefaultScheduleProfileDraft(frequency);
        const time = profile.dailyTime || createDefaultScheduleProfileDraft(frequency).dailyTime;
        result[frequency] = {
          enabled: profile.enabled,
          frequency,
          time,
          minute: clampScheduleNumber(profile.minute, Number(createDefaultScheduleProfileDraft(frequency).minute), 0, 59),
          dayOfWeek: clampScheduleNumber(profile.dayOfWeek, Number(createDefaultScheduleProfileDraft(frequency).dayOfWeek), 0, 6),
          dayOfMonth: clampScheduleNumber(profile.dayOfMonth, Number(createDefaultScheduleProfileDraft(frequency).dayOfMonth), 1, 31),
          month: clampScheduleNumber(profile.month, Number(createDefaultScheduleProfileDraft(frequency).month), 1, 12),
        };
        return result;
      }, {} as NonNullable<BackupScheduleConfigInput["profiles"]>);
      const retention = BACKUP_SCHEDULE_FREQUENCIES.reduce((result, frequency) => {
        const profile = scheduleDraft.profiles[frequency] ?? createDefaultScheduleProfileDraft(frequency);
        const parsed = Number(profile.retention);
        const min = frequency === "hourly" || frequency === "daily" ? 1 : 0;
        result[frequency] = Number.isInteger(parsed) && parsed >= min ? parsed : Number(BACKUP_SCHEDULE_DEFAULT_RETENTION[frequency]);
        return result;
      }, {} as NonNullable<BackupScheduleConfigInput["retention"]>);
      const selectedProfile = profiles[scheduleDraft.frequency] ?? profiles.daily;
      const selectedTime = selectedProfile?.time ?? createDefaultScheduleProfileDraft(scheduleDraft.frequency).dailyTime;
      const payload: BackupScheduleConfigInput = {
        enabled: scheduleDraft.enabled,
        frequency: scheduleDraft.frequency,
        dailyTime: selectedTime,
        schedule: selectedProfile,
        profiles,
        retention,
        externalCopy: {
          enabled: scheduleDraft.externalCopyEnabled,
          lastTarget: scheduleDraft.externalCopyTarget.trim(),
        },
      };
      const schedule = await updateBackupScheduleConfig(payload);
      setData((current) => (current ? { ...current, settings: { ...current.settings, schedule } } : current));
      setScheduleDraft(scheduleDraftFromStatus(schedule));
      push({ kind: "success", title: t("settings.backups.messages.scheduleSaved") });
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.scheduleSave")) });
      await load(true);
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleCopyExternalBackup = async () => {
    if (!externalDriveRoot) {
      push({ kind: "error", title: t("settings.backups.errors.externalDriveMissing") });
      return;
    }
    setExternalCopying(true);
    setExternalCopyResult(null);
    try {
      const result = await copyBackupToExternalDrive({ driveRoot: externalDriveRoot });
      setExternalCopyResult(result);
      push({ kind: "success", title: t("settings.backups.messages.externalCopyReady") });
      await load(true);
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.externalCopy")) });
      await load(true);
    } finally {
      setExternalCopying(false);
    }
  };

  const handleRunScheduledNow = async () => {
    setScheduleRunning(true);
    try {
      const result = await runScheduledBackupNow({ frequency: scheduleDraft.frequency });
      push({ kind: "success", title: t("settings.backups.messages.scheduledStarted") });

      const completedJob = await waitForBackupCompletion(result.job);
      if (completedJob.status !== "COMPLETED") {
        throw new Error(completedJob.errorMessage || t("settings.backups.errors.scheduledRun"));
      }

      const backup = await findBackupItemByJob(result.job.id);
      setSelectedId(backup.id);
      await loadFirstBackupPage();
      applyDetails(await getBackupDetails(backup.id));
      push({ kind: "success", title: t("settings.backups.messages.scheduledReady") });
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.scheduledRun")) });
      await load(true);
    } finally {
      setScheduleRunning(false);
    }
  };

  const applyBackupStorageStatus = useCallback((storage: BackupStorageStatus) => {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        settings: {
          ...current.settings,
          backupRoot: storage.currentRoot,
          rootExists: storage.health.exists,
          storage,
          schedule: {
            ...current.settings.schedule,
            config: {
              ...current.settings.schedule.config,
              backupRoot: storage.currentRoot,
            },
          },
        },
      };
    });
    setStoragePathDraft(storage.currentRoot);
  }, []);

  const handleUseRecommendedStorage = async () => {
    setStorageSaving("recommended");
    try {
      const storage = await selectRecommendedBackupStorage();
      applyBackupStorageStatus(storage);
      setStorageEditing(false);
      push({ kind: "success", title: t("settings.backups.messages.storageSaved") });
      await load(true);
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.storageSave")) });
      await load(true);
    } finally {
      setStorageSaving(null);
    }
  };

  const handleSaveStoragePath = async () => {
    const backupRoot = storagePathDraft.trim();
    if (!backupRoot) {
      push({ kind: "error", title: t("settings.backups.errors.storagePathRequired") });
      return;
    }

    setStorageSaving("custom");
    try {
      const storage = await updateBackupStorageRoot({ backupRoot });
      applyBackupStorageStatus(storage);
      setStorageEditing(false);
      push({ kind: "success", title: t("settings.backups.messages.storageSaved") });
      await load(true);
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.storageSave")) });
      await load(true);
    } finally {
      setStorageSaving(null);
    }
  };

  const handleChooseStorageFolder = async () => {
    setStorageEditing(true);
    setStoragePickerOpening(true);
    try {
      const backupWindow = window as BackupFolderPickerWindow;
      const selectedPath = await backupWindow.atlasGymDesktop?.chooseBackupFolder?.();
      if (selectedPath?.trim()) {
        setStoragePathDraft(selectedPath.trim());
        return;
      }

      push({ kind: "info", title: t("settings.backups.errors.storagePickerUnavailable") });
    } finally {
      setStoragePickerOpening(false);
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setImporting(true);
    const startedAt = Date.now();
    const selection = summarizeImportSelection(files);
    setSmartImportRun({ ...SMART_IMPORT_INITIAL_RUN, status: "running", step: "scanning", percent: 8, startedAt, selection });
    try {
      await delay(200);
      const selectionError = getImportSelectionError(selection, t);
      if (selectionError) {
        throw new Error(selectionError);
      }

      setSmartImportRun((current) => ({ ...current, step: "checking", percent: 26 }));
      await delay(200);
      setSmartImportRun((current) => ({ ...current, step: "uploading", percent: 46 }));
      const result = await importBackup(files);
      if (result.operationRun) applyOperationRun(result.operationRun);
      setSmartImportRun((current) => ({
        ...current,
        operationRunId: result.operationRun?.id ?? current.operationRunId,
        step: "registering",
        percent: Math.max(result.operationRun?.percent ?? 82, 82),
        backupId: result.backup.id,
      }));

      setRestoreTestResult(null);
      setRestoreJob(null);
      setRestoreConfirmResult(null);
      setSelectedId(result.backup.id);
      await loadFirstBackupPage();
      try {
        applyDetails(await getBackupDetails(result.backup.id));
      } catch (detailsError) {
        push({ kind: "error", title: getErrorMessage(detailsError, t("settings.backups.errors.details")) });
      }
      setSmartImportRun((current) => ({
        ...(result.operationRun ? smartImportRunFromOperationRun(result.operationRun, current) : current),
        status: "succeeded",
        step: "completed",
        percent: 100,
        finishedAt: Date.now(),
      }));
      push({ kind: "success", title: t("settings.backups.messages.imported") });
    } catch (error) {
      const message = getSmartImportErrorMessage(error, t, selection.sourceKind);
      setSmartImportRun((current) => ({ ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() }));
      push({ kind: "error", title: message });
      await load(true);
    } finally {
      setImporting(false);
    }
  };

  const handleDetails = async (item: BackupItem) => {
    setSelectedId(item.id);
    setDetailsLoading(true);
    try {
      applyDetails(await getBackupDetails(item.id));
      window.setTimeout(() => detailsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.details")) });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleVerify = async (item: BackupItem) => {
    setVerifyingId(item.id);
    try {
      await verifyBackup(item.id);
      push({ kind: "success", title: t("settings.backups.messages.verified") });
      await load(true);
      if (selectedId === item.id) {
        applyDetails(await getBackupDetails(item.id));
      }
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.verify")) });
      await load(true);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleCreateSupportPackage = async (item: BackupItem) => {
    setSupportPackagingId(item.id);
    setSupportPackageResult(null);
    const startedAt = Date.now();
    setSupportPackageRun({ ...SUPPORT_PACKAGE_INITIAL_RUN, status: "running", step: "checking", percent: 10, startedAt, backupId: item.id });
    try {
      await delay(200);
      setSupportPackageRun((current) => ({ ...current, step: "verifying", percent: 36 }));
      const result = await createBackupSupportPackage(item.id);
      if (result.operationRun) applyOperationRun(result.operationRun);
      setSupportPackageRun((current) => ({
        ...current,
        operationRunId: result.operationRun?.id ?? current.operationRunId,
        step: "packaging",
        percent: Math.max(result.operationRun?.percent ?? 78, 78),
      }));
      setSupportPackageResult(result);
      setSelectedId(item.id);
      await load(true);
      applyDetails(await getBackupDetails(item.id));
      setSupportPackageRun((current) => ({
        ...(result.operationRun ? supportPackageRunFromOperationRun(result.operationRun, current) : current),
        status: "succeeded",
        step: "completed",
        percent: 100,
        finishedAt: Date.now(),
      }));
      push({ kind: "success", title: t("settings.backups.messages.supportPackageReady") });
    } catch (error) {
      const message = getErrorMessage(error, t("settings.backups.errors.supportPackage"));
      setSupportPackageRun((current) => ({ ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() }));
      push({ kind: "error", title: message });
      await load(true);
    } finally {
      setSupportPackagingId(null);
    }
  };

  const handleCopySupportSummary = async (item: BackupItem, result: BackupSupportPackageResponse) => {
    try {
      await copyTextToClipboard(buildSupportSummaryText({ backup: item, result, locale: i18n.language, t }));
      push({ kind: "success", title: t("settings.backups.messages.supportSummaryCopied") });
    } catch {
      push({ kind: "error", title: t("settings.backups.errors.supportSummaryCopy") });
    }
  };

  const handlePostRestoreCheck = async (item: BackupItem) => {
    setPostRestoreCheckingId(item.id);
    setPostRestoreCheckResult(null);
    try {
      const result = await runPostRestoreCheck(item.id);
      if (result.operationRun) applyOperationRun(result.operationRun);
      setPostRestoreCheckResult(result);
      if (result.restoreJob) setRestoreJob(result.restoreJob);
      setSelectedId(item.id);
      await load(true);
      applyDetails(await getBackupDetails(item.id));
      push({
        kind: result.postRestoreCheck.status === "passed" ? "success" : "error",
        title:
          result.postRestoreCheck.status === "passed"
            ? t("settings.backups.messages.postRestoreCheckPassed")
            : t("settings.backups.messages.postRestoreCheckFailed"),
      });
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.postRestoreCheck")) });
      await load(true);
      if (selectedId === item.id) {
        try {
          applyDetails(await getBackupDetails(item.id));
        } catch {
          // The original error is already visible to the operator.
        }
      }
    } finally {
      setPostRestoreCheckingId(null);
    }
  };

  const handlePrepareRestore = async (item: BackupItem) => {
    setRestorePreparingId(item.id);
    const startedAt = Date.now();
    setRecoveryAssistantRun({ ...RECOVERY_ASSISTANT_INITIAL_RUN, status: "running", step: "checking", percent: 8, startedAt, backupId: item.id });
    try {
      await delay(250);
      setRecoveryAssistantRun((current) => ({ ...current, step: "restoreTesting", percent: 22 }));
      const result = await prepareProductionRestore(item.id, notes.trim() || undefined);
      if (result.operationRun) applyOperationRun(result.operationRun);
      setRestoreTestResult({
        backup: item,
        verification: {
          status: "VERIFIED",
          verifiedAt: result.restoreTest.testedAt,
          expectedHash: item.sha256 ?? "",
          actualHash: item.sha256 ?? "",
          expectedSize: item.sizeBytes ? Number(item.sizeBytes) : null,
          actualSize: item.sizeBytes ? Number(item.sizeBytes) : 0,
        },
        restoreTest: result.restoreTest,
      });
      setRestoreJob(result.restoreJob);
      setRestoreConfirmResult(null);
      setRestoreConfirmPhrase("");
      setRecoveryAssistantRun((current) => ({
        ...current,
        operationRunId: result.operationRun?.id ?? current.operationRunId,
        restoreJobId: result.restoreJob.id,
        step: "emergencyBackup",
        percent: Math.max(result.operationRun?.percent ?? 54, 54),
      }));
      push({ kind: "success", title: t("settings.backups.messages.restorePrepareStarted") });

      const readyJob = await waitForRestorePreparationReady(result.restoreJob);
      setRestoreJob(readyJob);
      if (readyJob.status !== "READY_FOR_CONFIRMATION") {
        throw new Error(readyJob.errorMessage || t("settings.backups.errors.restorePrepare"));
      }
      setRecoveryAssistantRun((current) => ({ ...current, status: "ready", step: "confirmation", percent: 82, restoreJobId: readyJob.id }));
      await load(true);
      setSelectedId(item.id);
      applyDetails(await getBackupDetails(item.id));
    } catch (error) {
      const message = getErrorMessage(error, t("settings.backups.errors.restorePrepare"));
      setRecoveryAssistantRun((current) => ({ ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() }));
      push({ kind: "error", title: message });
      await load(true);
    } finally {
      setRestorePreparingId(null);
    }
  };

  const handleConfirmRestore = async (restoreJobId: string) => {
    const selectedFolderName =
      restoreJob?.id === restoreJobId
        ? restoreJob.selectedBackupFolderName
        : details?.restoreJob?.id === restoreJobId
          ? details.restoreJob.selectedBackupFolderName
          : null;
    if (!selectedFolderName) {
      push({ kind: "error", title: t("settings.backups.errors.restoreConfirmMissingFolder") });
      return;
    }

    setRestoreConfirming(true);
    setRestoreConfirmResult(null);
    try {
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId ? { ...current, status: "running", step: "handoff", percent: 88, error: null } : current,
      );
      const result = await confirmProductionRestoreHandoff(restoreJobId, {
        folderName: selectedFolderName,
        phrase: restoreConfirmPhrase.trim(),
      });
      if (result.operationRun) applyOperationRun(result.operationRun);
      setRestoreConfirmResult(result);
      setRestoreJob(result.restoreJob);
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId
          ? { ...current, operationRunId: result.operationRun?.id ?? current.operationRunId, status: "ready", step: "maintenance", percent: 94, error: null }
          : current,
      );
      push({ kind: "success", title: t("settings.backups.messages.restoreHandoffReady") });
      if (selectedId) {
        applyDetails(await getBackupDetails(selectedId));
      }
    } catch (error) {
      const message = getErrorMessage(error, t("settings.backups.errors.restoreConfirm"));
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId ? { ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() } : current,
      );
      push({ kind: "error", title: message });
    } finally {
      setRestoreConfirming(false);
    }
  };

  const handleStartRestoreMaintenance = async (restoreJobId: string) => {
    setRestoreMaintenanceSubmitting("start");
    try {
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId ? { ...current, status: "running", step: "maintenance", percent: 96, error: null } : current,
      );
      const result = await startRestoreMaintenanceMode(restoreJobId, notes.trim() || undefined);
      if (result.operationRun) applyOperationRun(result.operationRun);
      setRestoreMaintenance(result.maintenance);
      if (result.restoreJob) setRestoreJob(result.restoreJob);
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId
          ? { ...current, operationRunId: result.operationRun?.id ?? current.operationRunId, status: "succeeded", step: "completed", percent: 100, finishedAt: Date.now() }
          : current,
      );
      push({ kind: "success", title: t("settings.backups.messages.restoreMaintenanceStarted") });
      await load(true);
    } catch (error) {
      const message = getErrorMessage(error, t("settings.backups.errors.restoreMaintenanceStart"));
      setRecoveryAssistantRun((current) =>
        current.restoreJobId === restoreJobId ? { ...current, status: "failed", step: "failed", error: message, finishedAt: Date.now() } : current,
      );
      push({ kind: "error", title: message });
    } finally {
      setRestoreMaintenanceSubmitting(null);
    }
  };

  const handleClearRestoreMaintenance = async () => {
    setRestoreMaintenanceSubmitting("clear");
    try {
      const result = await clearRestoreMaintenanceMode("Restore maintenance cleared from Settings > Backups");
      setRestoreMaintenance(result.maintenance);
      if (result.restoreJob) setRestoreJob(result.restoreJob);
      push({ kind: "success", title: t("settings.backups.messages.restoreMaintenanceCleared") });
      await load(true);
    } catch (error) {
      push({ kind: "error", title: getErrorMessage(error, t("settings.backups.errors.restoreMaintenanceClear")) });
    } finally {
      setRestoreMaintenanceSubmitting(null);
    }
  };

  const applyFilters = () => {
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const resetFilters = () => {
    setStatus("");
    setSearchDraft("");
    setSearch("");
    setPage(1);
  };

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const meta = data?.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
  const statusCounts = useMemo(
    () =>
      items.reduce<Record<BackupStatus, number>>(
        (counts, item) => {
          counts[item.status] += 1;
          return counts;
        },
        { PENDING: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0 },
      ),
    [items],
  );
  const latestVerifiedBackup =
    items.find((item) => item.status === "COMPLETED" && item.verificationStatus === "VERIFIED" && item.type !== "PRE_MIGRATION") ??
    items.find((item) => item.status === "COMPLETED" && item.verificationStatus === "VERIFIED") ??
    null;
  const lastSafeBackup = latestVerifiedBackup;
  const quickActionBackup =
    selectedBackup?.status === "COMPLETED" && selectedBackup.verificationStatus === "VERIFIED" ? selectedBackup : latestVerifiedBackup;
  const protectionScore = calculateProtectionScore({
    lastSafeBackup,
    schedule: data?.settings.schedule ?? null,
    failedCount: statusCounts.FAILED,
    backupToolsAvailable,
  });
  const showAdvancedTools =
    safeBackupRun.status !== "idle" ||
    smartImportRun.status !== "idle" ||
    creating ||
    importing;

  const handleQuickRestore = () => {
    if (!quickActionBackup) {
      push({ kind: "error", title: t("settings.backups.errors.noVerifiedBackup") });
      return;
    }
    void handleDetails(quickActionBackup);
  };

  const handleQuickSupportPackage = () => {
    if (!quickActionBackup) {
      push({ kind: "error", title: t("settings.backups.errors.noVerifiedBackup") });
      return;
    }
    void handleCreateSupportPackage(quickActionBackup);
  };

  return (
    <div className="settings-compact backups-page text-sm" data-testid="backups-page" dir={isRtl ? "rtl" : "ltr"}>
      <div className="backups-workspace backups-workspace--dashboard">
        <main className="min-w-0 space-y-2.5">
          <PageHeader
            icon={<IconShieldCheck aria-hidden="true" />}
            title={t("settings.backups.title")}
            description={t("settings.backups.subtitle")}
            actions={(
              <Button
                type="button"
                onClick={() => void load(true)}
                size="sm"
                startIcon={<IconRefresh className="h-3.5 w-3.5" stroke={1.8} />}
                variant="secondary"
              >
                {t("settings.backups.actions.refresh")}
              </Button>
            )}
          />

          <ProtectionOverviewCard
            score={protectionScore}
            lastBackup={lastSafeBackup}
            schedule={data?.settings.schedule ?? null}
            failedCount={statusCounts.FAILED}
            locale={i18n.language}
            t={t}
          />

          <QuickActionsPanel
            t={t}
            creating={creating}
            importing={importing}
            supportPackaging={Boolean(supportPackagingId)}
            canCreate={canCreateSafeBackup && !hasRunningBackup}
            canImport={canImportBackup}
            hasRestoreCandidate={Boolean(quickActionBackup)}
            onCreate={() => void handleCreateSafeBackup()}
            onImport={() => importZipInputRef.current?.click()}
            onRestore={handleQuickRestore}
            onDownload={handleQuickSupportPackage}
            onSupportPackage={handleQuickSupportPackage}
          />

          {restoreMaintenance?.enabled ? (
            <RestoreMaintenanceBanner
              maintenance={restoreMaintenance}
              canClear={canClearRestoreMaintenance}
              clearing={restoreMaintenanceSubmitting === "clear"}
              locale={i18n.language}
              t={t}
              onClear={() => void handleClearRestoreMaintenance()}
            />
          ) : null}

          <section className="grid gap-2.5 xl:grid-cols-2 2xl:grid-cols-[minmax(0,0.92fr)_minmax(320px,0.72fr)_minmax(340px,0.86fr)]">
            <ScheduledBackupCard
              t={t}
              status={data?.settings.schedule ?? null}
              draft={scheduleDraft}
              running={scheduleRunning}
              canManage={hasBackupManagePermission}
              backupToolsAvailable={backupToolsAvailable}
              hasRunningBackup={hasRunningBackup}
              locale={i18n.language}
              onOpenManager={() => setScheduleManagerOpen(true)}
              onRunNow={() => void handleRunScheduledNow()}
            />

            <BackupStorageSetupCard
              t={t}
              storage={data?.settings.storage ?? null}
              canManage={hasBackupManagePermission}
              editing={storageEditing}
              saving={storageSaving}
              pickerOpening={storagePickerOpening}
              pickerAvailable={storageFolderPickerAvailable}
              pathDraft={storagePathDraft}
              onPathDraftChange={setStoragePathDraft}
              onStartEdit={() => setStorageEditing(true)}
              onCancelEdit={() => {
                setStorageEditing(false);
                setStoragePathDraft(data?.settings.storage.currentRoot ?? "");
              }}
              onChooseFolder={() => void handleChooseStorageFolder()}
              onUseRecommended={() => void handleUseRecommendedStorage()}
              onSaveCustom={() => void handleSaveStoragePath()}
            />

            <ExternalBackupCopyCard
              t={t}
              status={data?.settings.schedule ?? null}
              drives={data?.settings.externalCopy.availableDrives ?? []}
              selectedDriveRoot={externalDriveRoot}
              copying={externalCopying}
              result={externalCopyResult}
              canManage={hasBackupManagePermission}
              locale={i18n.language}
              onDriveChange={setExternalDriveRoot}
              onRefresh={() => void load(true)}
              onCopy={() => void handleCopyExternalBackup()}
            />
          </section>

          {scheduleManagerOpen ? (
            <ScheduleManagerModal
              t={t}
              status={data?.settings.schedule ?? null}
              draft={scheduleDraft}
              saving={scheduleSaving}
              running={scheduleRunning}
              canManage={hasBackupManagePermission}
              backupToolsAvailable={backupToolsAvailable}
              hasRunningBackup={hasRunningBackup}
              locale={i18n.language}
              onDraftChange={setScheduleDraft}
              onSave={() => void handleSaveSchedule()}
              onRunNow={() => void handleRunScheduledNow()}
              onClose={() => setScheduleManagerOpen(false)}
            />
          ) : null}

          <section className="overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] shadow-sm">
            <div className="border-b border-[var(--card-border)] px-4 py-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("settings.backups.dashboard.recentBackups")}</h2>
            </div>
            <div className="grid gap-2 border-b border-[var(--card-border)] p-2.5 lg:grid-cols-[160px_minmax(0,1fr)_auto_auto_auto]">
              <DropdownSelect
                value={status}
                onChange={(value) => {
                  setStatus(value as "" | BackupStatus);
                  setPage(1);
                }}
                buttonClassName="form-input min-h-[34px] text-xs"
                ariaLabel={t("settings.backups.fields.status")}
                options={statusOptions.map((option) => ({ value: option, label: option ? t(`settings.backups.status.${option}`) : t("settings.backups.status.all") }))}
              />
              <span className="relative block">
                <IconSearch className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] ltr:right-3 rtl:left-3" stroke={1.8} />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters();
                  }}
                  className="form-input min-h-[34px] text-xs ltr:pr-9 rtl:pl-9"
                  placeholder={t("settings.backups.placeholders.search")}
                />
              </span>
              <Button
                type="button"
                onClick={applyFilters}
                size="sm"
                startIcon={<IconSearch className="h-3.5 w-3.5" stroke={1.8} />}
                variant="primary"
              >
                {t("settings.backups.actions.apply")}
              </Button>
              <Button
                type="button"
                onClick={resetFilters}
                size="sm"
                startIcon={<IconRefresh className="h-3.5 w-3.5" stroke={1.8} />}
                variant="ghost"
              >
                {t("settings.backups.actions.reset")}
              </Button>
              <Button
                type="button"
                onClick={() => void load(true)}
                size="sm"
                startIcon={<IconRefresh className="h-3.5 w-3.5" stroke={1.8} />}
                variant="secondary"
              >
                {t("settings.backups.actions.refresh")}
              </Button>
            </div>

            <div className="p-2.5 pt-0">
              <DataTableShell className="mt-2.5" data-testid="backups-table">
                <DataTable variant="compact" className="backup-jobs-table">
                  <DataTableHead>
                    <DataTableRow>
                      <DataTableHeaderCell>{t("settings.backups.table.started")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("settings.backups.table.type")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("settings.backups.table.status")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("settings.backups.table.verification")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("settings.backups.table.recovery")}</DataTableHeaderCell>
                      <DataTableHeaderCell>{t("settings.backups.table.size")}</DataTableHeaderCell>
                      <DataTableHeaderCell className="hidden 2xl:table-cell">{t("settings.backups.table.createdBy")}</DataTableHeaderCell>
                      <DataTableHeaderCell align="end">{t("settings.backups.table.actions")}</DataTableHeaderCell>
                    </DataTableRow>
                  </DataTableHead>
                  <DataTableBody>
                    {items.length ? (
                      items.map((item) => (
                        <DataTableRow key={item.id} className={selectedId === item.id ? "app-table-row--selected" : undefined}>
                          <DataTableCell>
                            <div className="whitespace-nowrap font-semibold text-[var(--text-primary)]">{formatShortDateTime(item.startedAt, i18n.language)}</div>
                          </DataTableCell>
                          <DataTableCell className="whitespace-nowrap">
                            <BackupTypeChip backup={item} />
                          </DataTableCell>
                          <DataTableCell className="whitespace-nowrap">
                            <StatusChip status={item.status} />
                            {item.errorMessage ? <p className="backup-table-error mt-1 max-w-[200px] truncate text-[11px]">{item.errorMessage}</p> : null}
                          </DataTableCell>
                          <DataTableCell className="whitespace-nowrap">
                            <VerificationChip status={item.verificationStatus} />
                          </DataTableCell>
                          <DataTableCell className="whitespace-nowrap">
                            <RecoveryStateChip summary={item.restoreSidecarSummary} />
                          </DataTableCell>
                          <DataTableCell>{formatBytes(item.sizeBytes)}</DataTableCell>
                          <DataTableCell className="hidden 2xl:table-cell">
                            <span className="block max-w-[92px] truncate font-semibold text-[var(--text-primary)]">
                              {getBackupOwner(item)}
                            </span>
                          </DataTableCell>
                          <DataTableCell align="end">
                            <div className="flex justify-end gap-1.5">
                              <ActionIconButton label={t("settings.backups.actions.details")} tooltipSide={isRtl ? "right" : "left"} onClick={() => void handleDetails(item)}>
                                <IconEye className="h-4 w-4" stroke={1.8} />
                              </ActionIconButton>
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))
                    ) : (
                      <DataTableEmptyRow colSpan={8}>{loading ? t("common.messages.loading") : t("settings.backups.table.empty")}</DataTableEmptyRow>
                    )}
                  </DataTableBody>
                </DataTable>
              </DataTableShell>
              <PaginationControls
                className="mt-3"
                page={meta.page}
                pageSize={meta.limit}
                totalItems={meta.total}
                totalPages={meta.totalPages}
                onPageChange={setPage}
                showFirstLast
                maxPageButtons={5}
              />
            </div>
          </section>

          {selectedBackup ? (
            <div ref={detailsPanelRef} className="backup-details-inline scroll-mt-4">
              <BackupDetailsPanel
                backup={selectedBackup}
                details={details}
                detailsLoading={detailsLoading}
                restoreTestResult={restoreTestResult}
                supportPackageRun={supportPackageRun}
                supportPackageResult={supportPackageResult}
                postRestoreCheckResult={postRestoreCheckResult}
                restoreJob={restoreJob}
                recoveryAssistantRun={recoveryAssistantRun}
                restoreConfirmResult={restoreConfirmResult}
                restoreConfirmPhrase={restoreConfirmPhrase}
                canManage={hasBackupManagePermission}
                canPrepareRestore={hasRestorePermission}
                isVendorMaintenance={isVendorMaintenance}
                backupToolsAvailable={backupToolsAvailable}
                hasRunningBackup={hasRunningBackup}
                verifying={Boolean(selectedBackup && verifyingId === selectedBackup.id)}
                supportPackaging={Boolean(selectedBackup && supportPackagingId === selectedBackup.id)}
                postRestoreChecking={Boolean(selectedBackup && postRestoreCheckingId === selectedBackup.id)}
                restorePreparing={Boolean(selectedBackup && restorePreparingId === selectedBackup.id)}
                restoreConfirming={restoreConfirming}
                restoreMaintenance={restoreMaintenance}
                restoreMaintenanceSubmitting={restoreMaintenanceSubmitting}
                locale={i18n.language}
                t={t}
                onConfirmPhraseChange={setRestoreConfirmPhrase}
                onVerify={(backup) => void handleVerify(backup)}
                onCreateSupportPackage={(backup) => void handleCreateSupportPackage(backup)}
                onCopySupportSummary={(backup, result) => void handleCopySupportSummary(backup, result)}
                onPostRestoreCheck={(backup) => void handlePostRestoreCheck(backup)}
                onPrepareRestore={(backup) => void handlePrepareRestore(backup)}
                onConfirmRestore={(restoreJobId) => void handleConfirmRestore(restoreJobId)}
                onStartRestoreMaintenance={(restoreJobId) => void handleStartRestoreMaintenance(restoreJobId)}
              />
            </div>
          ) : null}

          <details open={showAdvancedTools ? true : undefined} className="backup-advanced-tools rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-bold text-[var(--text-primary)]">
              <span>{t("settings.backups.dashboard.advancedTools")}</span>
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{t("settings.backups.dashboard.advancedToolsHint")}</span>
            </summary>
            <section className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.96fr)]">
              <SystemHealthCard
                t={t}
                root={data?.settings.backupRoot ?? "-"}
                rootReady={Boolean(data?.settings.rootExists)}
                scriptReady={Boolean(data?.settings.scriptExists)}
                pgDumpReady={Boolean(data?.settings.pgDumpAvailable)}
                pgDumpPath={data?.settings.pgDumpPath ?? null}
                timeoutMs={data?.settings.timeoutMs ?? 0}
                hasRunningBackup={hasRunningBackup}
                onRefresh={() => void load(true)}
              />

              <div className="grid gap-3">
                <SafeBackupAssistantCard
                  t={t}
                  run={safeBackupRun}
                  notes={notes}
                  creating={creating}
                  importing={importing}
                  canCreate={canCreateSafeBackup}
                  hasRunningBackup={hasRunningBackup}
                  onNotesChange={setNotes}
                  onCreate={() => void handleCreateSafeBackup()}
                />

                <SmartImportAssistantCard
                  t={t}
                  run={smartImportRun}
                  importing={importing}
                  creating={creating}
                  canImport={canImportBackup}
                  importInputRef={importInputRef}
                  importZipInputRef={importZipInputRef}
                  onImport={(event) => void handleImportBackup(event)}
                />
              </div>
            </section>
          </details>
        </main>
      </div>
    </div>
  );
}

function ProtectionOverviewCard({
  score,
  lastBackup,
  schedule,
  failedCount,
  locale,
  t,
}: {
  score: number;
  lastBackup: BackupItem | null;
  schedule: BackupScheduleStatus | null;
  failedCount: number;
  locale: string;
  t: BackupTextFn;
}) {
  const tone = getProtectionTone(score);
  const scheduleActive = Boolean(schedule?.config.enabled && schedule.schedulerRunning);
  const externalCopyCurrent = isExternalCopyCurrent(schedule);
  const externalCopyStatus = !schedule?.externalCopy.latestVerifiedBackupAt
    ? "-"
    : externalCopyCurrent
      ? t("settings.backups.dashboard.copied")
      : t("settings.backups.dashboard.pending");

  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3.5 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[210px_repeat(4,minmax(0,1fr))] xl:items-center">
        <div className="flex items-center gap-3">
          <div
            className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full p-1.5"
            style={{ background: `conic-gradient(${tone.color} ${score * 3.6}deg, rgba(148, 163, 184, 0.22) 0deg)` }}
            aria-label={`${t("settings.backups.dashboard.protectionScore")} ${score}%`}
          >
            <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-card)]">
              <IconCircleCheck className="h-5 w-5" style={{ color: tone.color }} stroke={2} />
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[var(--text-secondary)]">{t("settings.backups.dashboard.protectionScore")}</p>
            <p className="mt-0.5 text-3xl font-black leading-none text-[var(--text-primary)]">{score}%</p>
            <p className="mt-0.5 text-[11px] font-bold" style={{ color: tone.color }}>
              {t(tone.labelKey)}
            </p>
          </div>
        </div>

        <ProtectionMetric
          icon={<IconFileDescription className="h-5 w-5" stroke={1.8} />}
          tone="emerald"
          label={t("settings.backups.dashboard.lastBackup")}
          value={lastBackup ? formatRelativeTime(lastBackup.startedAt, locale) : "-"}
        />
        <ProtectionMetric
          icon={<IconShieldCheck className="h-5 w-5" stroke={1.8} />}
          tone="emerald"
          label={t("settings.backups.dashboard.verified")}
          value={lastBackup?.verificationStatus === "VERIFIED" ? t("settings.backups.labels.yes") : t("settings.backups.labels.no")}
        />
        <ProtectionMetric
          icon={<IconClock className="h-5 w-5" stroke={1.8} />}
          tone={scheduleActive ? "emerald" : "amber"}
          label={t("settings.backups.dashboard.schedule")}
          value={scheduleActive ? t("settings.backups.dashboard.active") : t("settings.backups.dashboard.off")}
        />
        <ProtectionMetric
          icon={failedCount > 0 || !externalCopyCurrent ? <IconAlertTriangle className="h-5 w-5" stroke={1.8} /> : <IconCircleCheck className="h-5 w-5" stroke={1.8} />}
          tone={failedCount > 0 || !externalCopyCurrent ? "amber" : "emerald"}
          label={t("settings.backups.dashboard.externalCopy")}
          value={externalCopyStatus}
        />
      </div>
    </section>
  );
}

function ProtectionMetric({
  icon,
  tone,
  label,
  value,
}: {
  icon: ReactNode;
  tone: "emerald" | "amber" | "blue";
  label: string;
  value: string;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-300"
      : tone === "amber"
        ? "border-amber-400/35 bg-amber-500/10 text-amber-600 dark:text-amber-300"
        : "border-brand-400/35 bg-brand-500/10 text-brand-500 dark:text-brand-200";

  return (
    <div className="flex min-h-[58px] items-center gap-2 border-t border-[var(--card-border)] pt-2 xl:border-l xl:border-t-0 xl:pt-0 ltr:xl:pl-3 rtl:xl:border-l-0 rtl:xl:border-r rtl:xl:pr-3">
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-[var(--text-secondary)]">{label}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

function QuickActionsPanel({
  t,
  creating,
  importing,
  supportPackaging,
  canCreate,
  canImport,
  hasRestoreCandidate,
  onCreate,
  onImport,
  onRestore,
  onDownload,
  onSupportPackage,
}: {
  t: BackupTextFn;
  creating: boolean;
  importing: boolean;
  supportPackaging: boolean;
  canCreate: boolean;
  canImport: boolean;
  hasRestoreCandidate: boolean;
  onCreate: () => void;
  onImport: () => void;
  onRestore: () => void;
  onDownload: () => void;
  onSupportPackage: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3.5 shadow-sm">
      <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.dashboard.quickActions")}</h2>
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <QuickActionButton
          icon={creating ? <IconLoader2 className="h-5 w-5 animate-spin" stroke={1.8} /> : <IconDatabaseExport className="h-5 w-5" stroke={1.8} />}
          label={t("settings.backups.actions.create")}
          disabled={!canCreate || creating || importing}
          onClick={onCreate}
        />
        <QuickActionButton
          icon={importing ? <IconLoader2 className="h-5 w-5 animate-spin" stroke={1.8} /> : <IconUpload className="h-5 w-5" stroke={1.8} />}
          label={t("settings.backups.actions.import")}
          disabled={!canImport || creating || importing}
          onClick={onImport}
        />
        <QuickActionButton
          icon={<IconRefresh className="h-5 w-5" stroke={1.8} />}
          label={t("settings.backups.dashboard.restore")}
          disabled={!hasRestoreCandidate}
          onClick={onRestore}
        />
        <QuickActionButton
          icon={supportPackaging ? <IconLoader2 className="h-5 w-5 animate-spin" stroke={1.8} /> : <IconFolderOpen className="h-5 w-5" stroke={1.8} />}
          label={t("settings.backups.dashboard.download")}
          disabled={!hasRestoreCandidate || supportPackaging}
          onClick={onDownload}
        />
        <QuickActionButton
          icon={supportPackaging ? <IconLoader2 className="h-5 w-5 animate-spin" stroke={1.8} /> : <IconReportAnalytics className="h-5 w-5" stroke={1.8} />}
          label={t("settings.backups.dashboard.supportPackage")}
          disabled={!hasRestoreCandidate || supportPackaging}
          onClick={onSupportPackage}
        />
      </div>
    </section>
  );
}

function QuickActionButton({ icon, label, disabled, onClick }: { icon: ReactNode; label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] px-3 py-2.5 text-center text-brand-600 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-400/60 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:text-brand-200"
    >
      <span className="inline-flex h-7 w-7 items-center justify-center">{icon}</span>
      <span className="text-[11px] font-bold text-[var(--text-primary)]">{label}</span>
    </button>
  );
}

function RestoreMaintenanceBanner({
  maintenance,
  canClear,
  clearing,
  locale,
  t,
  onClear,
}: {
  maintenance: RestoreMaintenanceStatus;
  canClear: boolean;
  clearing: boolean;
  locale: string;
  t: BackupTextFn;
  onClear: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-500/15 text-amber-500">
            <IconAlertTriangle className="h-5 w-5" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.restoreMaintenance.activeTitle")}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{t("settings.backups.restoreMaintenance.activeDescription")}</p>
            <div className="mt-2 grid gap-1.5 text-[11px] md:grid-cols-2">
              <DetailMini label={t("settings.backups.restoreMaintenance.selectedBackup")} value={maintenance.selectedBackupFolderName ?? "-"} />
              <DetailMini label={t("settings.backups.restoreMaintenance.startedAt")} value={formatDateTime(maintenance.startedAt, locale)} />
              <DetailMini label={t("settings.backups.restoreMaintenance.reason")} value={maintenance.reason ?? "-"} />
              <DetailMini label={t("settings.backups.restoreMaintenance.restoreJob")} value={maintenance.restoreJobId ?? "-"} />
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={!canClear || clearing}
          onClick={onClear}
          className="inline-flex min-h-[34px] shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-[var(--bg-card)] px-3 text-[11px] font-bold text-[var(--text-primary)] transition hover:border-amber-400 hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {clearing ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconCircleCheck className="h-4 w-4" stroke={1.8} />}
          {t("settings.backups.actions.clearMaintenance")}
        </button>
      </div>
    </section>
  );
}

function SafeBackupAssistantCard({
  t,
  run,
  notes,
  creating,
  importing,
  canCreate,
  hasRunningBackup,
  onNotesChange,
  onCreate,
}: {
  t: BackupTextFn;
  run: SafeBackupRun;
  notes: string;
  creating: boolean;
  importing: boolean;
  canCreate: boolean;
  hasRunningBackup: boolean;
  onNotesChange: (value: string) => void;
  onCreate: () => void;
}) {
  const activeIndex = SAFE_BACKUP_STEPS.findIndex((step) => step === run.step);
  const statusKey =
    run.status === "failed"
      ? "settings.backups.safeBackup.status.failed"
      : run.status === "succeeded"
        ? "settings.backups.safeBackup.status.succeeded"
        : run.status === "running"
          ? `settings.backups.safeBackup.steps.${run.step}`
          : "settings.backups.safeBackup.status.ready";

  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
            <IconShieldCheck className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.safeBackup.title")}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{t("settings.backups.safeBackup.description")}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--card-border)] bg-[var(--bg-panel)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {run.percent}%
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t(statusKey)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              {run.startedAt ? `${t("settings.backups.safeBackup.elapsed")}: ${formatElapsedMs(run.startedAt, run.finishedAt)}` : t("settings.backups.safeBackup.readyHint")}
            </p>
          </div>
          {run.status === "running" ? <IconLoader2 className="h-4 w-4 shrink-0 animate-spin text-brand-200" stroke={1.8} /> : null}
          {run.status === "succeeded" ? <IconCircleCheck className="h-4 w-4 shrink-0 text-emerald-300" stroke={1.8} /> : null}
          {run.status === "failed" ? <IconAlertTriangle className="h-4 w-4 shrink-0 text-rose-300" stroke={1.8} /> : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div className={`h-full rounded-full transition-all duration-500 ${run.status === "failed" ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: `${run.percent}%` }} />
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
          {SAFE_BACKUP_STEPS.map((step, index) => {
            const done = run.status === "succeeded" || (run.status === "running" && activeIndex > index);
            const current = run.status === "running" && activeIndex === index;
            return (
              <div
                key={step}
                className={`flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2 text-[10px] font-semibold ${
                  done
                    ? "border-emerald-400/35 bg-emerald-500/10 text-[var(--color-neon)]"
                    : current
                      ? "border-brand-400/40 bg-brand-500/10 text-[var(--color-primary)]"
                      : "border-[var(--card-border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {done ? <IconCircleCheck className="h-3.5 w-3.5 shrink-0" stroke={1.8} /> : current ? <IconLoader2 className="h-3.5 w-3.5 shrink-0 animate-spin" stroke={1.8} /> : <IconClock className="h-3.5 w-3.5 shrink-0" stroke={1.8} />}
                <span className="truncate">{t(`settings.backups.safeBackup.steps.${step}`)}</span>
              </div>
            );
          })}
        </div>
        {run.error ? <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold leading-4 text-rose-300">{run.error}</p> : null}
      </div>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold text-[var(--text-secondary)]">{t("settings.backups.fields.notes")}</span>
        <textarea
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          disabled={creating || run.status === "running"}
          className="form-input min-h-[58px] resize-none text-xs"
          maxLength={500}
          placeholder={t("settings.backups.placeholders.notes")}
        />
      </label>

      <div className="mt-2.5 flex flex-wrap items-end justify-between gap-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{t("settings.backups.fields.createdBy")}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--text-primary)]">{t("settings.backups.labels.currentUser")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={creating || importing || run.status === "running" || hasRunningBackup || !canCreate}
            onClick={onCreate}
            className="inline-flex min-h-[34px] min-w-[150px] items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[11px] font-semibold !text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.8} />}
            {t("settings.backups.actions.createSafe")}
          </button>
        </div>
      </div>
    </section>
  );
}

function SmartImportAssistantCard({
  t,
  run,
  importing,
  creating,
  canImport,
  importInputRef,
  importZipInputRef,
  onImport,
}: {
  t: BackupTextFn;
  run: SmartImportRun;
  importing: boolean;
  creating: boolean;
  canImport: boolean;
  importInputRef: { current: HTMLInputElement | null };
  importZipInputRef: { current: HTMLInputElement | null };
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const activeIndex = SMART_IMPORT_STEPS.findIndex((step) => step === run.step);
  const statusKey =
    run.status === "failed"
      ? "settings.backups.importAssistant.status.failed"
      : run.status === "succeeded"
        ? "settings.backups.importAssistant.status.succeeded"
        : run.status === "running"
          ? `settings.backups.importAssistant.steps.${run.step}`
          : "settings.backups.importAssistant.status.ready";

  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300">
            <IconUpload className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.importAssistant.title")}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{t("settings.backups.importAssistant.description")}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--card-border)] bg-[var(--bg-panel)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {run.percent}%
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t(statusKey)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              {run.startedAt ? `${t("settings.backups.safeBackup.elapsed")}: ${formatElapsedMs(run.startedAt, run.finishedAt)}` : t("settings.backups.importAssistant.readyHint")}
            </p>
          </div>
          {run.status === "running" ? <IconLoader2 className="h-4 w-4 shrink-0 animate-spin text-brand-200" stroke={1.8} /> : null}
          {run.status === "succeeded" ? <IconCircleCheck className="h-4 w-4 shrink-0 text-emerald-300" stroke={1.8} /> : null}
          {run.status === "failed" ? <IconAlertTriangle className="h-4 w-4 shrink-0 text-rose-300" stroke={1.8} /> : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div className={`h-full rounded-full transition-all duration-500 ${run.status === "failed" ? "bg-rose-500" : "bg-sky-500"}`} style={{ width: `${run.percent}%` }} />
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-5">
          {SMART_IMPORT_STEPS.map((step, index) => {
            const done = run.status === "succeeded" || (run.status === "running" && activeIndex > index);
            const current = run.status === "running" && activeIndex === index;
            return (
              <div
                key={step}
                className={`flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2 text-[10px] font-semibold ${
                  done
                    ? "border-emerald-400/35 bg-emerald-500/10 text-[var(--color-neon)]"
                    : current
                      ? "border-sky-400/40 bg-sky-500/10 text-[var(--color-primary)]"
                      : "border-[var(--card-border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {done ? <IconCircleCheck className="h-3.5 w-3.5 shrink-0" stroke={1.8} /> : current ? <IconLoader2 className="h-3.5 w-3.5 shrink-0 animate-spin" stroke={1.8} /> : <IconClock className="h-3.5 w-3.5 shrink-0" stroke={1.8} />}
                <span className="truncate">{t(`settings.backups.importAssistant.steps.${step}`)}</span>
              </div>
            );
          })}
        </div>
        {run.selection ? (
          <div className="mt-2 grid gap-1.5 text-[10px] text-[var(--text-secondary)] sm:grid-cols-3">
            <p className="truncate rounded-lg border border-[var(--card-border)] bg-[var(--bg-subtle)] px-2 py-1.5">
              <span className="font-semibold text-[var(--text-primary)]">
                {run.selection.sourceKind === "zip" ? t("settings.backups.importAssistant.package") : t("settings.backups.importAssistant.folder")}:
              </span>{" "}
              {run.selection.folderName}
            </p>
            <p className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-subtle)] px-2 py-1.5">
              <span className="font-semibold text-[var(--text-primary)]">{t("settings.backups.importAssistant.files")}:</span> {run.selection.fileCount}
            </p>
            <p className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-subtle)] px-2 py-1.5">
              <span className="font-semibold text-[var(--text-primary)]">{t("settings.backups.importAssistant.required")}:</span> {run.selection.requiredCount}/3
            </p>
          </div>
        ) : null}
        {run.error ? <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold leading-4 text-rose-300">{run.error}</p> : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <p className="max-w-[340px] text-[10px] leading-4 text-[var(--text-muted)]">{t("settings.backups.importAssistant.noRestoreHint")}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <input
            {...directoryInputAttributes}
            ref={importInputRef}
            type="file"
            multiple
            accept=".dump,.json,.log"
            className="hidden"
            onChange={onImport}
          />
          <input ref={importZipInputRef} type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden" onChange={onImport} />
          <button
            type="button"
            disabled={importing || creating || run.status === "running" || !canImport}
            onClick={() => importZipInputRef.current?.click()}
            className="inline-flex min-h-[34px] min-w-[130px] items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 text-[11px] font-semibold !text-white shadow-sm transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconUpload className="h-3.5 w-3.5" stroke={1.8} />}
            {t("settings.backups.actions.importZip")}
          </button>
          <button
            type="button"
            disabled={importing || creating || run.status === "running" || !canImport}
            onClick={() => importInputRef.current?.click()}
            className="inline-flex min-h-[34px] min-w-[150px] items-center justify-center gap-1.5 rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 text-[11px] font-semibold text-[var(--color-primary)] transition hover:border-sky-400/70 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {importing ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />}
            {t("settings.backups.actions.importFolder")}
          </button>
        </div>
      </div>
    </section>
  );
}

function SupportPackageCard({
  backup,
  run,
  result,
  canCreate,
  packaging,
  t,
  onCreate,
  onCopySummary,
}: {
  backup: BackupItem;
  run: SupportPackageRun;
  result: BackupSupportPackageResponse | null;
  canCreate: boolean;
  packaging: boolean;
  t: BackupTextFn;
  onCreate: (backup: BackupItem) => void;
  onCopySummary: (backup: BackupItem, result: BackupSupportPackageResponse) => void;
}) {
  const runApplies = run.backupId === backup.id;
  const status: SupportPackageRunStatus = result ? "succeeded" : runApplies ? run.status : "idle";
  const step: SupportPackageStepId = result ? "completed" : runApplies ? run.step : "idle";
  const percent = result ? 100 : runApplies ? run.percent : 0;
  const activeIndex = SUPPORT_PACKAGE_STEPS.findIndex((item) => item === step);
  const statusKey =
    status === "failed"
      ? "settings.backups.supportPackage.status.failed"
      : status === "succeeded"
        ? "settings.backups.supportPackage.status.succeeded"
        : status === "running"
          ? `settings.backups.supportPackage.steps.${step}`
          : "settings.backups.supportPackage.status.ready";
  const disabled = !canCreate || packaging || status === "running";

  return (
    <div className="rounded-xl border border-cyan-300/35 bg-cyan-500/10 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <IconFolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" stroke={1.8} />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--text-primary)]">{t("settings.backups.supportPackage.title")}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{t("settings.backups.supportPackage.description")}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {percent}%
        </span>
      </div>

      <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t(statusKey)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              {runApplies && run.startedAt ? `${t("settings.backups.safeBackup.elapsed")}: ${formatElapsedMs(run.startedAt, run.finishedAt)}` : t("settings.backups.supportPackage.readyHint")}
            </p>
          </div>
          {status === "running" ? <IconLoader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-300" stroke={1.8} /> : null}
          {status === "succeeded" ? <IconCircleCheck className="h-4 w-4 shrink-0 text-emerald-300" stroke={1.8} /> : null}
          {status === "failed" ? <IconAlertTriangle className="h-4 w-4 shrink-0 text-rose-300" stroke={1.8} /> : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div className={`h-full rounded-full transition-all duration-500 ${status === "failed" ? "bg-rose-500" : "bg-cyan-500"}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {SUPPORT_PACKAGE_STEPS.map((item, index) => {
            const done = status === "succeeded" || (status === "running" && activeIndex > index);
            const current = status === "running" && activeIndex === index;
            return (
              <div
                key={item}
                className={`flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2 text-[10px] font-semibold ${
                  done
                    ? "border-emerald-400/35 bg-emerald-500/10 text-[var(--color-neon)]"
                    : current
                      ? "border-cyan-400/40 bg-cyan-500/10 text-[var(--color-primary)]"
                      : "border-[var(--card-border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {done ? <IconCircleCheck className="h-3.5 w-3.5 shrink-0" stroke={1.8} /> : current ? <IconLoader2 className="h-3.5 w-3.5 shrink-0 animate-spin" stroke={1.8} /> : <IconClock className="h-3.5 w-3.5 shrink-0" stroke={1.8} />}
                <span className="truncate">{t(`settings.backups.supportPackage.steps.${item}`)}</span>
              </div>
            );
          })}
        </div>
        {runApplies && run.error ? <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold leading-4 text-rose-300">{run.error}</p> : null}
      </div>

      {result ? (
        <div className="mt-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-2 text-[11px]">
          <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.supportPackage.resultTitle")}</p>
          <DetailMini label={t("settings.backups.supportPackage.archive")} value={result.supportPackage.archive.path} />
          <DetailMini label={t("settings.backups.supportPackage.archiveSize")} value={formatBytes(result.supportPackage.archive.sizeBytes)} />
          <DetailMini label={t("settings.backups.supportPackage.source")} value={result.supportPackage.sourceFolderName} />
          <DetailMini label={t("settings.backups.supportPackage.files")} value={result.supportPackage.includedFiles.map((file) => file.name).join(", ")} />
          <div className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2">
            <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.supportPackage.sendTitle")}</p>
            <p className="mt-1 leading-4 text-[var(--text-secondary)]">{t("settings.backups.supportPackage.sendHint")}</p>
            <button
              type="button"
              onClick={() => onCopySummary(backup, result)}
              className="mt-2 inline-flex min-h-[32px] w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-500/10 px-3 text-[11px] font-bold text-[var(--color-neon)] transition hover:border-emerald-500/70 hover:bg-emerald-500/15"
            >
              <IconClipboardCopy className="h-3.5 w-3.5" stroke={1.8} />
              {t("settings.backups.actions.copySupportSummary")}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-[320px] text-[10px] leading-4 text-[var(--text-muted)]">
          {canCreate ? t("settings.backups.supportPackage.noSecretsHint") : t("settings.backups.supportPackage.verifyFirst")}
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onCreate(backup)}
          className="inline-flex min-h-[34px] min-w-[150px] items-center justify-center gap-1.5 rounded-lg border border-cyan-400/45 bg-cyan-500/10 px-3 text-[11px] font-bold text-[var(--color-primary)] transition hover:border-cyan-500/70 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {packaging || status === "running" ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />}
          {t("settings.backups.actions.createSupportPackage")}
        </button>
      </div>
    </div>
  );
}

function RecoveryAssistantCard({
  backup,
  run,
  currentRestoreJob,
  currentRestoreHandoffPath,
  maintenanceRestoreJobId,
  restoreConfirmPhrase,
  canRunRestorePrepare,
  canConfirmRestore,
  canStartMaintenance,
  canPrepareRestore,
  isVendorMaintenance,
  restorePreparing,
  restoreConfirming,
  restoreMaintenance,
  restoreMaintenanceSubmitting,
  t,
  onConfirmPhraseChange,
  onPrepareRestore,
  onConfirmRestore,
  onStartRestoreMaintenance,
}: {
  backup: BackupItem;
  run: RecoveryAssistantRun;
  currentRestoreJob: RestoreJob | null;
  currentRestoreHandoffPath: string | null;
  maintenanceRestoreJobId: string | null;
  restoreConfirmPhrase: string;
  canRunRestorePrepare: boolean;
  canConfirmRestore: boolean;
  canStartMaintenance: boolean;
  canPrepareRestore: boolean;
  isVendorMaintenance: boolean;
  restorePreparing: boolean;
  restoreConfirming: boolean;
  restoreMaintenance: RestoreMaintenanceStatus | null;
  restoreMaintenanceSubmitting: "start" | "clear" | null;
  t: BackupTextFn;
  onConfirmPhraseChange: (value: string) => void;
  onPrepareRestore: (backup: BackupItem) => void;
  onConfirmRestore: (restoreJobId: string) => void;
  onStartRestoreMaintenance: (restoreJobId: string) => void;
}) {
  const runApplies = run.backupId === backup.id || (currentRestoreJob?.id && run.restoreJobId === currentRestoreJob.id);
  const hasDetachedHandoff = Boolean(currentRestoreHandoffPath && !currentRestoreJob);
  const derivedStep: RecoveryAssistantStepId = restoreMaintenance?.enabled
    ? "completed"
    : currentRestoreHandoffPath
      ? "maintenance"
      : currentRestoreJob?.status === "READY_FOR_CONFIRMATION"
        ? "confirmation"
        : currentRestoreJob?.status === "EMERGENCY_BACKUP_RUNNING"
          ? "emergencyBackup"
          : currentRestoreJob?.status === "TESTING"
            ? "restoreTesting"
            : currentRestoreJob?.status === "FAILED" || currentRestoreJob?.status === "BLOCKED" || currentRestoreJob?.status === "CANCELLED"
              ? "failed"
              : "idle";
  const step = runApplies && run.step !== "idle" ? run.step : derivedStep;
  const status: RecoveryAssistantRunStatus = runApplies && run.status !== "idle"
    ? run.status
    : step === "failed"
      ? "failed"
      : step === "completed"
        ? "succeeded"
        : step === "confirmation" || step === "maintenance"
          ? "ready"
          : "idle";
  const percent = runApplies && run.percent ? run.percent : step === "completed" ? 100 : step === "maintenance" ? 94 : step === "confirmation" ? 82 : step === "emergencyBackup" ? 64 : step === "restoreTesting" ? 28 : 0;
  const activeIndex = RECOVERY_ASSISTANT_STEPS.findIndex((item) => item === step);
  const statusKey =
    status === "failed"
      ? "settings.backups.recoveryAssistant.status.failed"
      : status === "succeeded"
        ? "settings.backups.recoveryAssistant.status.succeeded"
        : status === "ready"
          ? `settings.backups.recoveryAssistant.status.${step === "maintenance" ? "handoffReady" : "ready"}`
          : status === "running"
            ? `settings.backups.recoveryAssistant.steps.${step}`
            : "settings.backups.recoveryAssistant.status.idle";
  const actionDisabled = !isVendorMaintenance || !canRunRestorePrepare || restorePreparing || status === "running" || Boolean(restoreMaintenance?.enabled);
  const canShowMaintenanceAction = Boolean(currentRestoreHandoffPath && (currentRestoreJob?.status === "READY_FOR_CONFIRMATION" || maintenanceRestoreJobId));

  return (
    <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" stroke={1.8} />
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--text-primary)]">{t("settings.backups.recoveryAssistant.title")}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">
              {isVendorMaintenance ? t("settings.backups.recoveryAssistant.description") : t("settings.backups.restorePrepare.vendorOnly")}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
          {percent}%
        </span>
      </div>

      <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t(statusKey)}</p>
            <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
              {runApplies && run.startedAt ? `${t("settings.backups.safeBackup.elapsed")}: ${formatElapsedMs(run.startedAt, run.finishedAt)}` : t("settings.backups.recoveryAssistant.readyHint")}
            </p>
          </div>
          {status === "running" ? <IconLoader2 className="h-4 w-4 shrink-0 animate-spin text-amber-500" stroke={1.8} /> : null}
          {status === "succeeded" || status === "ready" ? <IconCircleCheck className="h-4 w-4 shrink-0 text-emerald-300" stroke={1.8} /> : null}
          {status === "failed" ? <IconAlertTriangle className="h-4 w-4 shrink-0 text-rose-300" stroke={1.8} /> : null}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div className={`h-full rounded-full transition-all duration-500 ${status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${percent}%` }} />
        </div>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {RECOVERY_ASSISTANT_STEPS.map((item, index) => {
            const done = status === "succeeded" || (activeIndex > index && activeIndex >= 0);
            const current = status === "running" && activeIndex === index;
            return (
              <div
                key={item}
                className={`flex min-h-[32px] items-center gap-1.5 rounded-lg border px-2 text-[10px] font-semibold ${
                  done
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-300"
                    : current
                      ? "border-amber-400/40 bg-amber-500/10 text-amber-500"
                      : "border-[var(--card-border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                {done ? <IconCircleCheck className="h-3.5 w-3.5 shrink-0" stroke={1.8} /> : current ? <IconLoader2 className="h-3.5 w-3.5 shrink-0 animate-spin" stroke={1.8} /> : <IconClock className="h-3.5 w-3.5 shrink-0" stroke={1.8} />}
                <span className="truncate">{t(`settings.backups.recoveryAssistant.steps.${item}`)}</span>
              </div>
            );
          })}
        </div>
        {runApplies && run.error ? <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[10px] font-semibold leading-4 text-rose-300">{run.error}</p> : null}
      </div>

      {currentRestoreJob ? (
        <div className="mt-2 grid gap-1.5 text-[11px]">
          <DetailMini label={t("settings.backups.restorePrepare.status")} value={t(`settings.backups.restorePrepare.status.${currentRestoreJob.status}`)} />
          <DetailMini label={t("settings.backups.restorePrepare.testDatabase")} value={currentRestoreJob.restoreTestDatabase ?? "-"} />
          <DetailMini label={t("settings.backups.restorePrepare.emergencyStatus")} value={currentRestoreJob.emergencyBackupJob ? t(`settings.backups.status.${currentRestoreJob.emergencyBackupJob.status}`) : "-"} />
        </div>
      ) : null}

      {currentRestoreJob?.status === "READY_FOR_CONFIRMATION" && !currentRestoreHandoffPath ? (
        <div className="mt-2 space-y-2 rounded-lg border border-amber-400/30 bg-[var(--bg-subtle)] p-2">
          <p className="text-[11px] font-semibold leading-5 text-[var(--text-primary)]">{t("settings.backups.restoreConfirm.warning")}</p>
          <div className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] p-2">
            <p className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">{t("settings.backups.restoreConfirm.folderLabel")}</p>
            <p className="mt-1 break-all font-mono text-[11px] font-semibold text-[var(--text-primary)]">{currentRestoreJob.selectedBackupFolderName ?? "-"}</p>
          </div>
          <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
            {t("settings.backups.restoreConfirm.phraseLabel")}
            <input
              value={restoreConfirmPhrase}
              onChange={(event) => onConfirmPhraseChange(event.target.value)}
              className="mt-1 h-8 w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2 text-[11px] text-[var(--text-primary)] outline-none focus:border-blue-400"
              placeholder="RESTORE ATLASGYM DATABASE"
            />
          </label>
          <button
            type="button"
            disabled={!canConfirmRestore || restoreConfirming}
            onClick={() => onConfirmRestore(currentRestoreJob.id)}
            className="inline-flex min-h-[34px] w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 text-[11px] font-bold !text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {restoreConfirming ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconAlertTriangle className="h-4 w-4" stroke={1.8} />}
            {t("settings.backups.actions.confirmRestore")}
          </button>
          {!canConfirmRestore ? <p className="text-[10px] font-semibold leading-4 text-amber-600 dark:text-amber-300">{t("settings.backups.restoreConfirm.enableHint")}</p> : null}
        </div>
      ) : null}

      {currentRestoreHandoffPath ? (
        <div className="mt-2 rounded-lg border border-emerald-400/35 bg-emerald-500/10 p-2 text-[11px]">
          <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.restoreConfirm.handoffReady")}</p>
          {hasDetachedHandoff ? (
            <p className="mt-1 leading-4 text-[var(--text-secondary)]">{t("settings.backups.restoreMaintenance.detachedHandoffHint")}</p>
          ) : null}
        </div>
      ) : null}

      {canShowMaintenanceAction ? (
        <>
          <p className="mt-2 text-[10px] font-semibold leading-4 text-[var(--text-secondary)]">
            {isVendorMaintenance ? t("settings.backups.restoreMaintenance.readyHint") : t("settings.backups.restoreMaintenance.vendorOnlyStart")}
          </p>
          <button
            type="button"
            disabled={!canStartMaintenance || restoreMaintenanceSubmitting === "start"}
            onClick={() => {
              if (maintenanceRestoreJobId) onStartRestoreMaintenance(maintenanceRestoreJobId);
            }}
            className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-[11px] font-bold !text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-700 disabled:!text-slate-100 disabled:opacity-100"
          >
            {restoreMaintenanceSubmitting === "start" ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconShieldCheck className="h-4 w-4" stroke={1.8} />}
            {restoreMaintenance?.enabled ? t("settings.backups.restoreMaintenance.activeTitle") : t("settings.backups.actions.startMaintenance")}
          </button>
        </>
      ) : null}

      {!currentRestoreJob ? (
        <button
          type="button"
          disabled={actionDisabled || !canPrepareRestore}
          onClick={() => onPrepareRestore(backup)}
          className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 text-[11px] font-bold !text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {restorePreparing ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconDatabaseExport className="h-4 w-4" stroke={1.8} />}
          {t("settings.backups.actions.prepareRecovery")}
        </button>
      ) : null}
    </div>
  );
}

function SystemHealthCard({
  t,
  root,
  rootReady,
  scriptReady,
  pgDumpReady,
  pgDumpPath,
  timeoutMs,
  hasRunningBackup,
  onRefresh,
}: {
  t: BackupTextFn;
  root: string;
  rootReady: boolean;
  scriptReady: boolean;
  pgDumpReady: boolean;
  pgDumpPath: string | null;
  timeoutMs: number;
  hasRunningBackup: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
            <IconShieldCheck className="h-4 w-4" stroke={1.8} />
          </span>
          <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.health.title")}</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-brand-200 transition hover:bg-brand-500/10"
          aria-label={t("settings.backups.actions.refresh")}
          title={t("settings.backups.actions.refresh")}
        >
          <IconRefresh className="h-4 w-4" stroke={1.8} />
        </button>
      </div>
      <div className="mt-3 grid gap-x-4 gap-y-2.5 md:grid-cols-2">
        <HealthRow label={t("settings.backups.fields.backupRoot")} value={root} good={rootReady} />
        <HealthRow label={t("settings.backups.fields.timeout")} value={formatDuration(timeoutMs)} good />
        <HealthRow label={t("settings.backups.fields.pgDump")} value={pgDumpPath ?? t("settings.backups.labels.missing")} good={pgDumpReady} />
        <HealthRow label={t("settings.backups.fields.running")} value={hasRunningBackup ? t("settings.backups.labels.running") : t("settings.backups.labels.idle")} good={!hasRunningBackup} />
        <HealthRow label={t("settings.backups.fields.script")} value="backup.ps1" good={scriptReady} />
        <HealthRow label={t("settings.backups.health.audit")} value={t("settings.backups.labels.ready")} good />
      </div>
    </section>
  );
}

function ScheduledBackupCard({
  t,
  status,
  draft,
  running,
  canManage,
  backupToolsAvailable,
  hasRunningBackup,
  locale,
  onOpenManager,
  onRunNow,
}: {
  t: BackupTextFn;
  status: BackupScheduleStatus | null;
  draft: BackupScheduleDraft;
  running: boolean;
  canManage: boolean;
  backupToolsAvailable: boolean;
  hasRunningBackup: boolean;
  locale: string;
  onOpenManager: () => void;
  onRunNow: () => void;
}) {
  const canRunNow = canManage && backupToolsAvailable && !hasRunningBackup && !running;
  const backupRoot = status?.config.backupRoot ?? "-";

  return (
    <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-500">
            <IconClock className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.schedule.title")}</h2>
            <p className="mt-0.5 max-w-lg text-[11px] leading-4 text-[var(--text-secondary)]">{t("settings.backups.schedule.description")}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${draft.enabled ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-white/5 dark:text-slate-300"}`}>
          {draft.enabled ? t("settings.backups.schedule.statusOn") : t("settings.backups.schedule.statusOff")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2 xl:grid-cols-3">
        <ScheduleStatMini label={t("settings.backups.fields.status")} value={draft.enabled ? t("settings.backups.schedule.statusOn") : t("settings.backups.schedule.statusOff")} />
        <ScheduleStatMini label={t("settings.backups.schedule.activeProfiles")} value={activeScheduleProfilesLabel(t, draft)} />
        <ScheduleStatMini label={t("settings.backups.schedule.runTiming")} value={formatScheduleDraftTiming(t, draft)} />
        <ScheduleStatMini label={t("settings.backups.schedule.retentionTitle")} value={activeRetentionValue(draft)} />
        <DetailMini label={t("settings.backups.schedule.nextRun")} value={formatDateTime(status?.nextRunAt, locale)} />
        <DetailMini label={t("settings.backups.schedule.scheduler")} value={status?.schedulerRunning ? t("settings.backups.labels.running") : t("settings.backups.labels.idle")} />
      </div>

      <div className="mt-3 rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-2.5">
        <div className="flex items-start gap-2">
          <IconShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" stroke={1.8} />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">{t("settings.backups.schedule.recommendedTitle")}</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-secondary)]">{t("settings.backups.schedule.recommendedDaily")}</p>
            <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-muted)]" title={backupRoot}>
              {t("settings.backups.schedule.safePath")}: {backupRoot}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={!canManage}
          onClick={onOpenManager}
          className="inline-flex min-h-[34px] min-w-[132px] items-center justify-center gap-1.5 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] px-3 text-[11px] font-bold text-brand-600 transition hover:border-brand-400/60 hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-brand-200"
        >
          <IconClock className="h-3.5 w-3.5" stroke={1.8} />
          {t("settings.backups.actions.manageSchedule")}
        </button>
        <button
          type="button"
          disabled={!canRunNow}
          onClick={onRunNow}
          className="inline-flex min-h-[34px] min-w-[132px] items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[11px] font-bold !text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.8} />}
          {t("settings.backups.actions.runScheduledNow")}
        </button>
      </div>
    </section>
  );
}

function ScheduleManagerModal({
  t,
  status,
  draft,
  saving,
  running,
  canManage,
  backupToolsAvailable,
  hasRunningBackup,
  locale,
  onDraftChange,
  onSave,
  onRunNow,
  onClose,
}: {
  t: BackupTextFn;
  status: BackupScheduleStatus | null;
  draft: BackupScheduleDraft;
  saving: boolean;
  running: boolean;
  canManage: boolean;
  backupToolsAvailable: boolean;
  hasRunningBackup: boolean;
  locale: string;
  onDraftChange: (value: BackupScheduleDraft) => void;
  onSave: () => void;
  onRunNow: () => void;
  onClose: () => void;
}) {
  const disabled = !canManage || saving || running;
  const canRunNow = canManage && backupToolsAvailable && !hasRunningBackup && !running;
  const backupRoot = status?.config.backupRoot ?? "-";
  const scheduleOptions: Array<{ id: BackupScheduleFrequency; label: string; hint: string; sub: string; icon: ReactNode }> = [
    {
      id: "hourly",
      label: t("settings.backups.schedule.hourly"),
      hint: t("settings.backups.schedule.hourlyHint"),
      sub: t("settings.backups.schedule.hourlySub"),
      icon: <IconClock className="h-4 w-4" stroke={1.8} />,
    },
    {
      id: "daily",
      label: t("settings.backups.schedule.daily"),
      hint: t("settings.backups.schedule.dailyHint"),
      sub: t("settings.backups.schedule.dailySub"),
      icon: <IconCalendar className="h-4 w-4" stroke={1.8} />,
    },
    {
      id: "weekly",
      label: t("settings.backups.schedule.weekly"),
      hint: t("settings.backups.schedule.weeklyHint"),
      sub: t("settings.backups.schedule.weeklySub"),
      icon: <IconCalendarWeek className="h-4 w-4" stroke={1.8} />,
    },
    {
      id: "monthly",
      label: t("settings.backups.schedule.monthly"),
      hint: t("settings.backups.schedule.monthlyHint"),
      sub: t("settings.backups.schedule.monthlySub"),
      icon: <IconCalendarMonth className="h-4 w-4" stroke={1.8} />,
    },
    {
      id: "yearly",
      label: t("settings.backups.schedule.yearly"),
      hint: t("settings.backups.schedule.yearlyHint"),
      sub: t("settings.backups.schedule.yearlySub"),
      icon: <IconCalendarStats className="h-4 w-4" stroke={1.8} />,
    },
  ];
  const currentOption = scheduleOptions.find((option) => option.id === draft.frequency) ?? scheduleOptions[1];
  const retentionOptions = Array.from(
    new Set(
      [
        "5",
        "7",
        "8",
        "14",
        "24",
        "30",
        "60",
        "90",
        "180",
        "365",
        ...BACKUP_SCHEDULE_FREQUENCIES.map((frequency) => draft.profiles[frequency]?.retention),
      ].filter(Boolean)
    )
  );
  const schedulerStatus = status?.schedulerRunning ? t("settings.backups.labels.running") : t("settings.backups.labels.idle");
  const selectedProfile = draft.profiles[draft.frequency] ?? createDefaultScheduleProfileDraft(draft.frequency);
  const selectedRetentionValue = selectedProfile.retention;
  const updateProfile = (frequency: BackupScheduleFrequency, patch: Partial<BackupScheduleProfileDraft>) => {
    const currentProfile = draft.profiles[frequency] ?? createDefaultScheduleProfileDraft(frequency);
    onDraftChange({
      ...draft,
      profiles: {
        ...draft.profiles,
        [frequency]: {
          ...currentProfile,
          ...patch,
        },
      },
    });
  };
  const updateSelectedProfile = (patch: Partial<BackupScheduleProfileDraft>) => updateProfile(draft.frequency, patch);

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/6 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-schedule-manager-title"
        className="flex max-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl shadow-black/20"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--card-border)] bg-[var(--bg-card)] px-5 py-3 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-400/30 bg-brand-500/10 text-[var(--color-primary)]">
              <IconClock className="h-5 w-5" stroke={1.8} />
            </span>
            <h2 id="backup-schedule-manager-title" className="min-w-0 truncate text-base font-black text-[var(--text-primary)]">
              {t("settings.backups.schedule.automationTitle")}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <label className="relative inline-flex h-6 w-11 cursor-pointer items-center">
              <input
                type="checkbox"
                checked={draft.enabled}
                disabled={disabled}
                onChange={(event) => onDraftChange({ ...draft, enabled: event.target.checked })}
                className="peer sr-only"
                aria-label={t("settings.backups.schedule.enabled")}
              />
              <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-700" />
              <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 rtl:left-auto rtl:right-0.5 rtl:peer-checked:-translate-x-5" />
            </label>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition hover:bg-rose-500/10 hover:text-rose-500"
              aria-label={t("settings.backups.actions.close")}
            >
              <IconCircleX className="h-4 w-4" stroke={1.8} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-2.5">
              <h3 className="mb-2.5 px-1 text-[11px] font-black text-[var(--text-primary)]">1. {t("settings.backups.schedule.scheduleType")}</h3>
              <div className="overflow-hidden rounded-lg border border-[var(--card-border)]">
                {scheduleOptions.map((option) => {
                  const active = draft.frequency === option.id;
                  const profile = draft.profiles[option.id] ?? createDefaultScheduleProfileDraft(option.id);
                  return (
                    <div
                      key={option.id}
                      className={`flex items-center gap-2 border-b border-[var(--card-border)] px-2.5 py-2 transition last:border-b-0 ${
                        active
                          ? "bg-brand-500/15 text-[var(--text-primary)]"
                          : "bg-[var(--bg-card)] text-[var(--text-primary)]"
                      }`}
                    >
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onDraftChange({ ...draft, frequency: option.id })}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left transition hover:text-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 rtl:text-right"
                      >
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            active
                              ? "border-brand-500 bg-brand-600 !text-white"
                              : "border-[var(--card-border)] bg-[var(--bg-panel)] text-[var(--text-secondary)]"
                          }`}
                        >
                          {option.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black">{option.label}</span>
                          <span className="block text-[9px] font-semibold leading-3 text-[var(--text-secondary)]">{option.sub}</span>
                        </span>
                      </button>
                      <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={profile.enabled}
                          disabled={disabled}
                          onChange={(event) => updateProfile(option.id, { enabled: event.target.checked })}
                          className="peer sr-only"
                          aria-label={`${option.label} ${t("settings.backups.schedule.enabled")}`}
                        />
                        <span className="h-5 w-9 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-slate-700" />
                        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4 rtl:left-auto rtl:right-0.5 rtl:peer-checked:-translate-x-4" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-3.5">
                <h3 className="text-[12px] font-black text-[var(--color-primary)]">2. {t("settings.backups.schedule.scheduleSettings")}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2 text-[10px]">
                  <span className="inline-flex shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black text-[var(--color-neon)]">
                    {t("settings.backups.schedule.recommendedBadge")}
                  </span>
                  <p className="min-w-0 flex-1 leading-4 text-[var(--text-secondary)]">
                    <span className="font-bold text-[var(--text-primary)]">{scheduleFrequencyLabel(t, draft.frequency)}:</span> {currentOption.hint}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {draft.frequency === "hourly" ? (
                      <label className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {t("settings.backups.schedule.minuteOfHourLabel")}
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={selectedProfile.minute}
                          disabled={disabled}
                          onChange={(event) => updateSelectedProfile({ minute: event.target.value })}
                          className="form-input mt-1 min-h-[34px] text-xs"
                        />
                        <span className="mt-1 block text-[9px] leading-3 text-[var(--text-muted)]">{t("settings.backups.schedule.minuteOfHourHelp")}</span>
                      </label>
                    ) : (
                      <label className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {t("settings.backups.schedule.runTime")}
                        <input
                          type="time"
                          value={selectedProfile.dailyTime}
                          disabled={disabled}
                          onChange={(event) => updateSelectedProfile({ dailyTime: event.target.value, minute: timeMinuteValue(event.target.value) })}
                          className="form-input mt-1 min-h-[34px] text-xs"
                        />
                      </label>
                    )}

                    {draft.frequency === "weekly" ? (
                      <label className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {t("settings.backups.schedule.dayOfWeek")}
                        <DropdownSelect
                          value={selectedProfile.dayOfWeek}
                          disabled={disabled}
                          onChange={(value) => updateSelectedProfile({ dayOfWeek: value })}
                          buttonClassName="form-input mt-1 min-h-[34px] text-xs"
                          ariaLabel={t("settings.backups.schedule.dayOfWeek")}
                          options={BACKUP_WEEKDAY_VALUES.map((value) => ({ value, label: weekdayLabel(t, value) }))}
                        />
                      </label>
                    ) : null}

                    {draft.frequency === "monthly" || draft.frequency === "yearly" ? (
                      <label className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {t("settings.backups.schedule.dayOfMonth")}
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={selectedProfile.dayOfMonth}
                          disabled={disabled}
                          onChange={(event) => updateSelectedProfile({ dayOfMonth: event.target.value })}
                          className="form-input mt-1 min-h-[34px] text-xs"
                        />
                        <span className="mt-1 block text-[9px] leading-3 text-[var(--text-muted)]">{t("settings.backups.schedule.dayOfMonthHelp")}</span>
                      </label>
                    ) : null}

                    {draft.frequency === "yearly" ? (
                      <label className="rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        {t("settings.backups.schedule.month")}
                        <DropdownSelect
                          value={selectedProfile.month}
                          disabled={disabled}
                          onChange={(value) => updateSelectedProfile({ month: value })}
                          buttonClassName="form-input mt-1 min-h-[34px] text-xs"
                          ariaLabel={t("settings.backups.schedule.month")}
                          options={BACKUP_MONTH_VALUES.map((value) => ({ value, label: monthLabel(t, value) }))}
                        />
                      </label>
                    ) : null}
                </div>
                <div className="mt-3 rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] p-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-[var(--text-primary)]">{t("settings.backups.schedule.retentionTitle")}</p>
                      <p className="mt-0.5 text-[10px] leading-3 text-[var(--text-secondary)]">
                        {scheduleFrequencyLabel(t, draft.frequency)} / {t("settings.backups.schedule.retentionDaily")}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-brand-400/30 bg-brand-500/10 px-2 py-0.5 text-[9px] font-black text-[var(--color-primary)]">
                      {selectedRetentionValue} {t("settings.backups.schedule.backupsUnit")}
                    </span>
                  </div>
                  <label className="mt-2 block text-[10px] font-semibold text-[var(--text-secondary)]">
                    {t("settings.backups.schedule.keepLastBackups")}
                    <DropdownSelect
                      value={selectedRetentionValue}
                      disabled={disabled}
                      onChange={(value) => updateSelectedProfile({ retention: value })}
                      buttonClassName="form-input mt-1 min-h-[34px] max-w-[220px] text-xs"
                      ariaLabel={t("settings.backups.schedule.keepLastBackups")}
                      options={retentionOptions.map((value) => ({ value, label: value }))}
                    />
                  </label>
                  <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">{t("settings.backups.schedule.olderDeleted")}</p>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-4">
            <h3 className="mb-2.5 text-[12px] font-black text-[var(--text-primary)]">{t("settings.backups.schedule.statusTitle")}</h3>
            <div className="grid gap-3 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
              <ScheduleStatusItem icon={<IconClock className="h-4 w-4" stroke={1.8} />} label={t("settings.backups.schedule.nextRun")} value={formatDateTime(status?.nextRunAt, locale)} />
              <ScheduleStatusItem icon={<IconCircleCheck className="h-4 w-4" stroke={1.8} />} label={t("settings.backups.schedule.scheduler")} value={schedulerStatus} good={Boolean(status?.schedulerRunning)} />
              <ScheduleStatusItem icon={<IconFolderOpen className="h-4 w-4" stroke={1.8} />} label={t("settings.backups.schedule.backupLocation")} value={backupRoot} />
              <ScheduleStatusItem icon={<IconDatabaseExport className="h-4 w-4" stroke={1.8} />} label={t("settings.backups.schedule.retentionTitle")} value={`${activeRetentionValue(draft)} ${t("settings.backups.schedule.backupsUnit")}`} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--card-border)] bg-[var(--bg-card)] px-5 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[36px] min-w-[118px] items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] px-4 text-xs font-bold text-[var(--text-secondary)] transition hover:border-brand-400/60 hover:text-[var(--color-primary)]"
          >
            {t("settings.backups.actions.cancel")}
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canRunNow}
              onClick={onRunNow}
              className="inline-flex min-h-[36px] min-w-[160px] items-center justify-center gap-1.5 rounded-lg border border-brand-400/35 bg-[var(--bg-panel)] px-4 text-xs font-bold text-[var(--color-primary)] transition hover:bg-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconPlayerPlay className="h-3.5 w-3.5" stroke={1.8} />}
              {t("settings.backups.actions.runScheduledNow")}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onSave}
              className="inline-flex min-h-[36px] min-w-[145px] items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 text-xs font-bold !text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconCircleCheck className="h-3.5 w-3.5" stroke={1.8} />}
              {t("settings.backups.actions.saveSchedule")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ScheduleStatusItem({ icon, label, value, good }: { icon: ReactNode; label: string; value: string; good?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${good ? "border-emerald-400/30 bg-emerald-500/10 text-[var(--color-neon)]" : "border-brand-400/30 bg-brand-500/10 text-[var(--color-primary)]"}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold text-[var(--text-secondary)]">{label}</span>
        <span className={`mt-0.5 block break-words text-[11px] font-black ${good ? "text-[var(--color-neon)]" : "text-[var(--text-primary)]"}`}>{value}</span>
      </span>
    </div>
  );
}

function BackupStorageSetupCard({
  t,
  storage,
  canManage,
  editing,
  saving,
  pickerOpening,
  pickerAvailable,
  pathDraft,
  onPathDraftChange,
  onStartEdit,
  onCancelEdit,
  onChooseFolder,
  onUseRecommended,
  onSaveCustom,
}: {
  t: BackupTextFn;
  storage: BackupStorageStatus | null;
  canManage: boolean;
  editing: boolean;
  saving: "recommended" | "custom" | null;
  pickerOpening: boolean;
  pickerAvailable: boolean;
  pathDraft: string;
  onPathDraftChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChooseFolder: () => void;
  onUseRecommended: () => void;
  onSaveCustom: () => void;
}) {
  const ready = Boolean(storage?.health.ok);
  const locked = Boolean(storage?.envLocked);
  const disabled = !canManage || locked || Boolean(saving);
  const sourceLabel = storage ? t(`settings.backups.storage.source.${storage.source}`) : "-";
  const currentPath = storage?.currentRoot ?? "-";
  const recommendedPath = storage?.recommendedRoot ?? "-";

  return (
    <section className="rounded-2xl border border-cyan-400/30 bg-[var(--bg-card)] p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/35 bg-cyan-500/10 text-[var(--color-primary)]">
            <IconFolderOpen className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.storage.title")}</h2>
            <p className="mt-0.5 max-w-lg text-[11px] leading-4 text-[var(--text-secondary)]">{t("settings.backups.storage.description")}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            ready
              ? "border-emerald-400/35 bg-emerald-500/10 text-[var(--color-neon)]"
              : "border-amber-400/50 bg-amber-500/15 text-[var(--color-amber)]"
          }`}
        >
          {locked ? t("settings.backups.storage.managed") : ready ? t("settings.backups.storage.ready") : t("settings.backups.storage.needsSetup")}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
        <ScheduleStatMini label={t("settings.backups.storage.currentPath")} value={currentPath} />
        <ScheduleStatMini label={t("settings.backups.storage.status")} value={ready ? t("settings.backups.storage.ready") : t("settings.backups.storage.needsSetup")} />
        <ScheduleStatMini label={t("settings.backups.storage.source")} value={sourceLabel} />
        <ScheduleStatMini label={t("settings.backups.storage.recommendedPath")} value={recommendedPath} />
      </div>

      <div className="mt-3 rounded-xl border border-cyan-400/25 bg-[var(--bg-panel)] p-2.5 text-[11px]">
        <div className="grid gap-2 sm:grid-cols-2">
          <HealthRow label={t("settings.backups.storage.writable")} value={storage?.health.writable ? t("settings.backups.labels.yes") : t("settings.backups.labels.no")} good={Boolean(storage?.health.writable)} />
          <HealthRow label={t("settings.backups.storage.outsideProject")} value={storage?.health.outsideProject ? t("settings.backups.labels.yes") : t("settings.backups.labels.no")} good={Boolean(storage?.health.outsideProject)} />
        </div>
        <p className="mt-2 text-[10px] leading-4 text-[var(--text-secondary)]">
          {locked ? t("settings.backups.storage.envLockedHint") : t("settings.backups.storage.recommendedHint")}
        </p>
        {storage?.health.message ? (
          <p className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 px-2.5 py-2 text-[10px] font-semibold text-[var(--color-amber)]">
            {storage.health.message}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-2.5">
          <label className="text-[10px] font-bold text-[var(--text-secondary)]">
            {t("settings.backups.storage.customPath")}
            <input
              value={pathDraft}
              disabled={Boolean(saving)}
              onChange={(event) => onPathDraftChange(event.target.value)}
              className="form-input mt-1 min-h-[34px] text-xs"
              placeholder={recommendedPath}
            />
          </label>
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-muted)]">{t("settings.backups.storage.pathHelp")}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {pickerAvailable ? (
              <button
                type="button"
                onClick={onChooseFolder}
                disabled={disabled || pickerOpening}
                className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg border border-cyan-400/45 bg-cyan-500/10 px-3 text-[11px] font-bold text-[var(--color-primary)] transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pickerOpening ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />}
                {t("settings.backups.storage.chooseFolder")}
              </button>
            ) : (
              <span className="text-[10px] font-semibold text-[var(--text-muted)]">{t("settings.backups.storage.browserPathMode")}</span>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={Boolean(saving)}
                className="inline-flex min-h-[32px] items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--bg-card)] px-3 text-[11px] font-bold text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("settings.backups.actions.cancel")}
              </button>
              <button
                type="button"
                onClick={onSaveCustom}
                disabled={Boolean(saving)}
                className="inline-flex min-h-[32px] items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[11px] font-bold !text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving === "custom" ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconCircleCheck className="h-3.5 w-3.5" stroke={1.8} />}
                {t("settings.backups.storage.saveLocation")}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onUseRecommended}
            disabled={disabled || Boolean(storage?.isRecommended)}
            className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-cyan-400/45 bg-cyan-500/10 px-3 text-[11px] font-bold text-[var(--color-primary)] transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving === "recommended" ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconShieldCheck className="h-3.5 w-3.5" stroke={1.8} />}
            {t("settings.backups.storage.useRecommended")}
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            disabled={disabled}
            className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[11px] font-bold !text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />
            {t("settings.backups.storage.changeLocation")}
          </button>
        </div>
      )}
    </section>
  );
}

function ExternalBackupCopyCard({
  t,
  status,
  drives,
  selectedDriveRoot,
  copying,
  result,
  canManage,
  locale,
  onDriveChange,
  onRefresh,
  onCopy,
}: {
  t: BackupTextFn;
  status: BackupScheduleStatus | null;
  drives: BackupExternalDrive[];
  selectedDriveRoot: string;
  copying: boolean;
  result: BackupExternalCopyResponse | null;
  canManage: boolean;
  locale: string;
  onDriveChange: (value: string) => void;
  onRefresh: () => void;
  onCopy: () => void;
}) {
  const selectedDrive = drives.find((drive) => drive.rootPath === selectedDriveRoot) ?? null;
  const copyCurrent = isExternalCopyCurrent(status);
  const canCopy = canManage && Boolean(status?.externalCopy.latestVerifiedBackupAt) && Boolean(selectedDrive) && !copying;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-400/35 bg-[var(--bg-card)] p-3.5 shadow-sm">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold text-[var(--text-primary)]">{t("settings.backups.dashboard.externalReminderTitle")}</h2>
            <p className="mt-1 max-w-xl text-[11px] leading-4 text-[var(--text-secondary)]">{t("settings.backups.dashboard.externalReminderBody")}</p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
              copyCurrent
                ? "border-emerald-400/35 bg-emerald-500/10 text-[var(--color-neon)]"
                : selectedDrive
                  ? "border-blue-400/35 bg-blue-500/10 text-brand-600"
                  : "border-amber-400/50 bg-amber-500/15 text-[var(--color-amber)]"
            }`}
          >
            {copyCurrent
              ? t("settings.backups.dashboard.copied")
              : selectedDrive
                ? t("settings.backups.dashboard.ready")
                : t("settings.backups.dashboard.noExternalDrive")}
          </span>
        </div>

        <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
          <DetailMini label={t("settings.backups.dashboard.latestVerified")} value={formatDateTime(status?.externalCopy.latestVerifiedBackupAt, locale)} />
          <DetailMini label={t("settings.backups.dashboard.lastCopied")} value={formatDateTime(status?.externalCopy.lastCopiedAt, locale)} />
        </div>

        <div className="mt-3 grid gap-2">
          <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            {t("settings.backups.dashboard.externalDrive")}
          </label>
          <DropdownSelect
            value={selectedDriveRoot}
            disabled={!canManage || copying || drives.length === 0}
            onChange={onDriveChange}
            buttonClassName="form-input min-h-[34px] border-amber-400/35 bg-[var(--bg-panel)] text-xs"
            ariaLabel={t("settings.backups.dashboard.externalDrive")}
            options={drives.length === 0 ? [{ value: "", label: t("settings.backups.dashboard.noExternalDrive") }] : drives.map((drive) => ({ value: drive.rootPath, label: drive.label ? `${drive.label} - ${drive.rootPath}` : drive.rootPath }))}
          />
          {selectedDrive ? (
            <p className="text-[10px] leading-4 text-[var(--text-secondary)]">
              {t("settings.backups.dashboard.freeSpace")}: {formatBytes(selectedDrive.freeBytes)} / {formatBytes(selectedDrive.sizeBytes)}
            </p>
          ) : (
            <p className="text-[10px] leading-4 text-[var(--text-secondary)]">{t("settings.backups.dashboard.connectDriveHint")}</p>
          )}
        </div>

        {result ? (
          <div className="mt-3 rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-[11px] text-[var(--text-primary)]">
            <p className="font-bold">{t("settings.backups.dashboard.externalCopyComplete")}</p>
            <DetailMini label={t("settings.backups.dashboard.externalDestination")} value={result.destinationPath} />
            <DetailMini label={t("settings.backups.table.size")} value={formatBytes(result.sizeBytes)} />
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={copying}
            onClick={onRefresh}
            className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3 text-[11px] font-bold text-[var(--color-amber)] transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <IconRefresh className={`h-3.5 w-3.5 ${copying ? "animate-spin" : ""}`} stroke={1.8} />
            {t("settings.backups.dashboard.refreshDrives")}
          </button>
          <button
            type="button"
            disabled={!canCopy}
            onClick={onCopy}
            className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 text-[11px] font-bold !text-white shadow-sm transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copying ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" stroke={1.8} /> : <IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />}
            {copying ? t("settings.backups.dashboard.copying") : t("settings.backups.dashboard.copyLatest")}
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-5 hidden rotate-12 text-amber-400/45 md:block rtl:left-5 rtl:right-auto">
        <IconFolderOpen className="h-12 w-12" stroke={1.2} />
      </div>
    </section>
  );
}

function isExternalCopyCurrent(status: BackupScheduleStatus | null) {
  const latestVerifiedAt = status?.externalCopy.latestVerifiedBackupAt;
  const lastCopiedAt = status?.externalCopy.lastCopiedAt;
  if (!latestVerifiedAt || !lastCopiedAt) return false;
  return new Date(lastCopiedAt).getTime() >= new Date(latestVerifiedAt).getTime();
}

function HealthRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="grid grid-cols-[18px_minmax(92px,0.62fr)_minmax(0,1fr)_28px] items-center gap-1.5 text-[11px]">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${good ? "bg-emerald-500/12 text-[var(--color-neon)]" : "bg-rose-500/12 text-rose-400"}`}>
        {good ? <IconCircleCheck className="h-3 w-3" stroke={2} /> : <IconAlertTriangle className="h-3 w-3" stroke={2} />}
      </span>
      <span className="font-semibold text-[var(--text-primary)]">{label}</span>
      <span className="truncate text-[var(--text-secondary)]" title={value}>{value}</span>
      <span className={`text-[10px] font-bold ${good ? "text-[var(--color-neon)]" : "text-rose-400"}`}>{good ? "OK" : "!"}</span>
    </div>
  );
}

function BackupDetailsPanel({
  backup,
  details,
  detailsLoading,
  restoreTestResult,
  supportPackageRun,
  supportPackageResult,
  postRestoreCheckResult,
  restoreJob,
  recoveryAssistantRun,
  restoreConfirmResult,
  restoreConfirmPhrase,
  canManage,
  canPrepareRestore,
  isVendorMaintenance,
  backupToolsAvailable,
  hasRunningBackup,
  verifying,
  supportPackaging,
  postRestoreChecking,
  restorePreparing,
  restoreConfirming,
  restoreMaintenance,
  restoreMaintenanceSubmitting,
  locale,
  t,
  onConfirmPhraseChange,
  onVerify,
  onCreateSupportPackage,
  onCopySupportSummary,
  onPostRestoreCheck,
  onPrepareRestore,
  onConfirmRestore,
  onStartRestoreMaintenance,
}: {
  backup: BackupItem | null;
  details: BackupDetailsResponse | null;
  detailsLoading: boolean;
  restoreTestResult: BackupRestoreTestResponse | null;
  supportPackageRun: SupportPackageRun;
  supportPackageResult: BackupSupportPackageResponse | null;
  postRestoreCheckResult: BackupPostRestoreCheckResponse | null;
  restoreJob: RestoreJob | null;
  recoveryAssistantRun: RecoveryAssistantRun;
  restoreConfirmResult: RestoreConfirmResponse | null;
  restoreConfirmPhrase: string;
  canManage: boolean;
  canPrepareRestore: boolean;
  isVendorMaintenance: boolean;
  backupToolsAvailable: boolean;
  hasRunningBackup: boolean;
  verifying: boolean;
  supportPackaging: boolean;
  postRestoreChecking: boolean;
  restorePreparing: boolean;
  restoreConfirming: boolean;
  restoreMaintenance: RestoreMaintenanceStatus | null;
  restoreMaintenanceSubmitting: "start" | "clear" | null;
  locale: string;
  t: BackupTextFn;
  onConfirmPhraseChange: (value: string) => void;
  onVerify: (backup: BackupItem) => void;
  onCreateSupportPackage: (backup: BackupItem) => void;
  onCopySupportSummary: (backup: BackupItem, result: BackupSupportPackageResponse) => void;
  onPostRestoreCheck: (backup: BackupItem) => void;
  onPrepareRestore: (backup: BackupItem) => void;
  onConfirmRestore: (restoreJobId: string) => void;
  onStartRestoreMaintenance: (restoreJobId: string) => void;
}) {
  const backupIsVerified = backup?.verificationStatus === "VERIFIED";
  const canRunBackupAction = Boolean(backup && canManage && backup.hasDump && backup.hasManifest && backup.status === "COMPLETED");
  const canRunRestorePrepare = Boolean(
    backup &&
      canPrepareRestore &&
      isVendorMaintenance &&
      backupToolsAvailable &&
      !hasRunningBackup &&
      backupIsVerified &&
      backup.hasDump &&
      backup.hasManifest &&
      backup.status === "COMPLETED"
  );
  const currentRestoreJob = backup && restoreJob?.selectedBackupId === backup.id ? restoreJob : null;
  const canConfirmRestore = Boolean(
    currentRestoreJob &&
      currentRestoreJob.status === "READY_FOR_CONFIRMATION" &&
      currentRestoreJob.selectedBackupFolderName &&
      restoreConfirmPhrase.trim() === "RESTORE ATLASGYM DATABASE"
  );
  const latestHandoff = details?.restoreSidecars.handoffs[0] ?? null;
  const latestReport = details?.restoreSidecars.reports[0] ?? null;
  const latestPostCheck = details?.restoreSidecars.postChecks[0] ?? null;
  const currentRestoreConfirmResult = currentRestoreJob && restoreConfirmResult?.restoreJob.id === currentRestoreJob.id ? restoreConfirmResult : null;
  const currentRestoreHandoffPath = currentRestoreConfirmResult?.handoffPath ?? currentRestoreJob?.handoffPath ?? latestHandoff?.path ?? null;
  const currentRestoreScriptPath = currentRestoreConfirmResult?.scriptPath ?? currentRestoreJob?.restoreScriptPath ?? null;
  const maintenanceRestoreJobId = currentRestoreJob?.id ?? latestHandoff?.restoreJobId ?? null;
  const hasReadyRestoreJob = currentRestoreJob?.status === "READY_FOR_CONFIRMATION" || Boolean(!currentRestoreJob && latestHandoff?.restoreJobId);
  const canStartMaintenance = Boolean(
    maintenanceRestoreJobId &&
      currentRestoreHandoffPath &&
      hasReadyRestoreJob &&
      isVendorMaintenance &&
      !restoreMaintenance?.enabled
  );
  const activeSupportPackageResult = supportPackageResult?.backup.id === backup?.id ? supportPackageResult : null;
  const activePostRestoreCheckResult =
    postRestoreCheckResult?.backup.id === backup?.id ? postRestoreCheckResult?.postRestoreCheck ?? null : null;
  const canRunPostRestoreCheck = Boolean(
    backup &&
      canManage &&
      backupIsVerified &&
      backup.hasDump &&
      backup.hasManifest &&
      backup.status === "COMPLETED" &&
      latestReport?.status?.toLowerCase() === "succeeded"
  );
  const shouldShowRecoveryAssistant = Boolean(
    backup &&
      backupIsVerified &&
      (canPrepareRestore || currentRestoreJob || currentRestoreHandoffPath || backup.restoreSidecarSummary.hasHandoff)
  );

  return (
    <aside className="min-w-0 rounded-2xl border border-[var(--card-border)] bg-[var(--bg-card)] shadow-sm xl:sticky xl:top-2.5 xl:max-h-[calc(100vh-1.25rem)] xl:overflow-auto">
      <div className="border-b border-[var(--card-border)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("settings.backups.details.title")}</h2>
            {backup ? <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">{backup.folderName ?? backup.location ?? backup.jobId}</p> : null}
          </div>
        </div>
        {backup ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusChip status={backup.status} />
            <VerificationChip status={backup.verificationStatus} />
          </div>
        ) : null}
      </div>

      {backup ? (
        <div className="space-y-3 p-3">
          <div className="space-y-2.5">
            <DetailRow icon={<IconFolderOpen className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.table.folder")} value={backup.folderName ?? "-"} />
            <DetailRow icon={<IconDatabaseExport className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.fields.type")} value={backupTypeLabel(t, backup)} />
            {backup.type === "SCHEDULED" ? (
              <DetailRow icon={<IconClock className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.schedule.frequency")} value={backup.scheduleFrequency ? scheduleFrequencyLabel(t, backup.scheduleFrequency) : "-"} />
            ) : null}
            <DetailRow icon={<IconClock className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.table.started")} value={formatDateTime(backup.startedAt, locale)} />
            <DetailRow icon={<IconShieldCheck className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.table.size")} value={formatBytes(backup.sizeBytes)} />
            <DetailRow icon={<IconCircleCheck className="h-3.5 w-3.5" stroke={1.8} />} label={t("settings.backups.fields.createdBy")} value={getBackupOwner(backup)} />
          </div>

          {restoreTestResult?.backup.id === backup.id ? (
            <div className="rounded-xl border border-sky-300/35 bg-sky-500/10 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">{t("settings.backups.restoreTest.title")}</h3>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{t("settings.backups.restoreTest.description")}</p>
                </div>
                <span className="inline-flex items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-200">
                  {t("settings.backups.restoreTest.passed")}
                </span>
              </div>
              <div className="mt-2 grid gap-1.5 text-[11px]">
                <DetailMini label={t("settings.backups.restoreTest.database")} value={restoreTestResult.restoreTest.testDatabaseName} />
                <DetailMini label={t("settings.backups.restoreTest.cleanup")} value={restoreTestResult.restoreTest.cleanup ? t("settings.backups.labels.yes") : t("settings.backups.labels.no")} />
              </div>
            </div>
          ) : null}

          {latestReport ? <ProductionRestoreReportCard report={latestReport} locale={locale} t={t} /> : null}

          {latestReport ? (
            <PostRestoreCheckCard
              backup={backup}
              latestReport={latestReport}
              latestCheck={latestPostCheck}
              result={activePostRestoreCheckResult}
              checking={postRestoreChecking}
              canRun={canRunPostRestoreCheck}
              locale={locale}
              t={t}
              onRun={onPostRestoreCheck}
            />
          ) : null}

          {canManage ? <BackupNextActionCard backup={backup} canRunBackupAction={canRunBackupAction} verifying={verifying} t={t} onVerify={onVerify} /> : null}

          {shouldShowRecoveryAssistant ? (
            <RecoveryAssistantCard
              backup={backup}
              run={recoveryAssistantRun}
              currentRestoreJob={currentRestoreJob}
              currentRestoreHandoffPath={currentRestoreHandoffPath}
              maintenanceRestoreJobId={maintenanceRestoreJobId}
              restoreConfirmPhrase={restoreConfirmPhrase}
              canRunRestorePrepare={canRunRestorePrepare}
              canConfirmRestore={canConfirmRestore}
              canStartMaintenance={canStartMaintenance}
              canPrepareRestore={canPrepareRestore}
              isVendorMaintenance={isVendorMaintenance}
              restorePreparing={restorePreparing}
              restoreConfirming={restoreConfirming}
              restoreMaintenance={restoreMaintenance}
              restoreMaintenanceSubmitting={restoreMaintenanceSubmitting}
              t={t}
              onConfirmPhraseChange={onConfirmPhraseChange}
              onPrepareRestore={onPrepareRestore}
              onConfirmRestore={onConfirmRestore}
              onStartRestoreMaintenance={onStartRestoreMaintenance}
            />
          ) : null}

          {canManage && backupIsVerified ? (
            <SupportPackageCard
              backup={backup}
              run={supportPackageRun}
              result={activeSupportPackageResult}
              canCreate={canRunBackupAction}
              packaging={supportPackaging}
              t={t}
              onCreate={onCreateSupportPackage}
              onCopySummary={onCopySupportSummary}
            />
          ) : null}

          <AdvancedBackupDetails
            backup={backup}
            details={details}
            detailsLoading={detailsLoading}
            supportPackageResult={activeSupportPackageResult}
            currentRestoreHandoffPath={currentRestoreHandoffPath}
            currentRestoreScriptPath={currentRestoreScriptPath}
            latestHandoff={latestHandoff}
            latestReport={latestReport}
            latestPostCheck={latestPostCheck}
            locale={locale}
            t={t}
          />
        </div>
      ) : (
        <div className="p-3">
          <div className="rounded-xl border border-dashed border-[var(--card-border)] p-4 text-center">
            <IconEye className="mx-auto h-7 w-7 text-[var(--text-muted)]" stroke={1.8} />
            <p className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">{t("settings.backups.details.selectTitle")}</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{t("settings.backups.details.selectBody")}</p>
          </div>
        </div>
      )}
    </aside>
  );
}

function ProductionRestoreReportCard({ report, locale, t }: { report: RestoreSidecarReport; locale: string; t: BackupTextFn }) {
  const succeeded = report.status?.toLowerCase() === "succeeded";
  const title = succeeded ? t("settings.backups.productionRestoreReport.successTitle") : t("settings.backups.productionRestoreReport.title");
  const description = succeeded ? t("settings.backups.productionRestoreReport.successDescription") : t("settings.backups.productionRestoreReport.description");

  return (
    <div className={`rounded-xl border p-2.5 ${succeeded ? "border-emerald-300/35 bg-emerald-500/10" : "border-amber-300/45 bg-amber-500/10"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${succeeded ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-300/45 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
            <IconReportAnalytics className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--text-primary)]">{title}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{description}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${succeeded ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200"}`}>
          {report.status ?? "-"}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 text-[11px]">
        <DetailMini label={t("settings.backups.restoreSidecars.completedAt")} value={formatDateTime(report.completedAt, locale)} />
        <DetailMini label={t("settings.backups.restoreSidecars.database")} value={report.databaseName ?? "-"} />
        <DetailMini label={t("settings.backups.productionRestoreReport.sourceHash")} value={shortenHash(report.sourceSha256)} />
      </div>
      {report.migrationReminder ? (
        <p className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] px-2 py-1.5 text-[10px] leading-4 text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">{t("settings.backups.productionRestoreReport.migrationReminder")}: </span>
          {report.migrationReminder}
        </p>
      ) : null}
    </div>
  );
}

function PostRestoreCheckCard({
  backup,
  latestReport,
  latestCheck,
  result,
  checking,
  canRun,
  locale,
  t,
  onRun,
}: {
  backup: BackupItem;
  latestReport: RestoreSidecarReport;
  latestCheck: RestoreSidecarPostCheck | null;
  result: PostRestoreCheckResult | null;
  checking: boolean;
  canRun: boolean;
  locale: string;
  t: BackupTextFn;
  onRun: (backup: BackupItem) => void;
}) {
  const activeCheck = result ?? latestCheck;
  const passed = activeCheck?.status === "passed";
  const failed = activeCheck?.status === "failed";
  const statusText = passed
    ? t("settings.backups.postRestoreCheck.status.passed")
    : failed
      ? t("settings.backups.postRestoreCheck.status.failed")
      : t("settings.backups.postRestoreCheck.status.ready");
  const disabled = checking || !canRun || latestReport.status?.toLowerCase() !== "succeeded";

  return (
    <div className={`rounded-xl border p-2.5 ${failed ? "border-rose-300/35 bg-rose-500/10" : "border-emerald-300/35 bg-emerald-500/10"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${failed ? "border-rose-300/35 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-emerald-300/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
            <IconShieldCheck className="h-4 w-4" stroke={1.8} />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-[var(--text-primary)]">{t("settings.backups.postRestoreCheck.title")}</h3>
            <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{t("settings.backups.postRestoreCheck.description")}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${failed ? "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-200" : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"}`}>
          {statusText}
        </span>
      </div>

      {activeCheck ? (
        <div className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] p-2">
          <div className="grid gap-1.5 text-[11px]">
            <DetailMini label={t("settings.backups.postRestoreCheck.checkedAt")} value={formatDateTime(activeCheck.checkedAt, locale)} />
            <DetailMini label={t("settings.backups.postRestoreCheck.report")} value={activeCheck.productionReportFileName ?? latestReport.fileName} />
          </div>
          <div className="mt-2 grid gap-1.5">
            {activeCheck.checks.slice(0, 10).map((check) => (
              <div key={check.name} className="grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-1.5 rounded-lg border border-[var(--card-border)] bg-[var(--bg-subtle)] px-2 py-1.5 text-[10px]">
                <span className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ${check.status === "failed" ? "bg-rose-500/12 text-rose-300" : check.status === "warning" ? "bg-amber-500/12 text-amber-300" : "bg-emerald-500/12 text-emerald-300"}`}>
                  {check.status === "failed" ? <IconAlertTriangle className="h-3 w-3" stroke={2} /> : <IconCircleCheck className="h-3 w-3" stroke={2} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-[var(--text-primary)]">{check.label}</span>
                  {check.details ? <span className="mt-0.5 block text-[var(--text-secondary)]">{check.details}</span> : null}
                </span>
                <span className="font-mono font-semibold text-[var(--text-secondary)]">{check.value ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-[var(--card-border)] bg-[var(--bg-panel)] px-2 py-1.5 text-[10px] leading-4 text-[var(--text-secondary)]">
          {t("settings.backups.postRestoreCheck.readyHint")}
        </p>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => onRun(backup)}
        className="mt-2 inline-flex min-h-[34px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold !text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {checking ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconShieldCheck className="h-4 w-4" stroke={1.8} />}
        {t("settings.backups.actions.postRestoreCheck")}
      </button>
      {!canRun ? <p className="mt-1.5 text-[10px] font-semibold leading-4 text-[var(--text-muted)]">{t("settings.backups.postRestoreCheck.verifyFirst")}</p> : null}
    </div>
  );
}

function BackupNextActionCard({
  backup,
  canRunBackupAction,
  verifying,
  t,
  onVerify,
}: {
  backup: BackupItem;
  canRunBackupAction: boolean;
  verifying: boolean;
  t: BackupTextFn;
  onVerify: (backup: BackupItem) => void;
}) {
  if (backup.verificationStatus === "VERIFIED") return null;

  const canVerify = canRunBackupAction && !verifying;
  const isRunning = backup.status === "RUNNING";
  const isBlocked = !backup.hasDump || !backup.hasManifest || backup.status === "FAILED";
  const title = isRunning
    ? t("settings.backups.nextAction.runningTitle")
    : isBlocked
      ? t("settings.backups.nextAction.blockedTitle")
      : t("settings.backups.nextAction.verifyTitle");
  const description = isRunning
    ? t("settings.backups.nextAction.runningDescription")
    : isBlocked
      ? t("settings.backups.nextAction.blockedDescription")
      : t("settings.backups.nextAction.verifyDescription");

  return (
    <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/8 p-2.5">
      <div className="flex items-start gap-2">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-300/35 bg-emerald-500/10 text-emerald-300">
          <IconShieldCheck className="h-4 w-4" stroke={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-[var(--text-secondary)]">{description}</p>
        </div>
      </div>
      {!isRunning && !isBlocked ? (
        <button
          type="button"
          disabled={!canVerify}
          onClick={() => onVerify(backup)}
          className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-[11px] font-bold !text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifying ? <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.8} /> : <IconShieldCheck className="h-4 w-4" stroke={1.8} />}
          {t("settings.backups.actions.verify")}
        </button>
      ) : null}
    </div>
  );
}

function AdvancedBackupDetails({
  backup,
  details,
  detailsLoading,
  supportPackageResult,
  currentRestoreHandoffPath,
  currentRestoreScriptPath,
  latestHandoff,
  latestReport,
  latestPostCheck,
  locale,
  t,
}: {
  backup: BackupItem;
  details: BackupDetailsResponse | null;
  detailsLoading: boolean;
  supportPackageResult: BackupSupportPackageResponse | null;
  currentRestoreHandoffPath: string | null;
  currentRestoreScriptPath: string | null;
  latestHandoff: BackupDetailsResponse["restoreSidecars"]["handoffs"][number] | null;
  latestReport: BackupDetailsResponse["restoreSidecars"]["reports"][number] | null;
  latestPostCheck: BackupDetailsResponse["restoreSidecars"]["postChecks"][number] | null;
  locale: string;
  t: BackupTextFn;
}) {
  const hasRestoreSidecars = Boolean(currentRestoreHandoffPath || currentRestoreScriptPath || latestHandoff || latestReport || latestPostCheck);

  return (
    <details className="rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] p-2.5">
      <summary className="cursor-pointer text-[11px] font-bold text-[var(--text-primary)]">
        <span className="inline-flex items-center gap-1.5">
          <IconFileDescription className="h-3.5 w-3.5 text-[var(--text-muted)]" stroke={1.8} />
          {t("settings.backups.details.advancedTitle")}
        </span>
      </summary>
      <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-muted)]">{t("settings.backups.details.advancedDescription")}</p>

      <div className="mt-3 space-y-3">
        <div className="space-y-1.5 text-[11px]">
          <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.details.backupFilesTitle")}</p>
          <DetailMini label={t("settings.backups.fields.location")} value={backup.location ?? "-"} />
          <DetailMini label={t("settings.backups.fields.manifest")} value={details?.job?.manifestPath ?? "-"} />
          <DetailMini label={t("settings.backups.fields.log")} value={details?.job?.logPath ?? "-"} />
          <DetailMini label={t("settings.backups.table.sha")} value={backup.sha256 ?? "-"} />
        </div>

        {supportPackageResult ? (
          <div className="space-y-1.5 border-t border-[var(--card-border)] pt-3 text-[11px]">
            <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.supportPackage.title")}</p>
            <DetailMini label={t("settings.backups.supportPackage.archive")} value={supportPackageResult.supportPackage.archive.path} />
            <DetailMini label={t("settings.backups.supportPackage.archiveHash")} value={supportPackageResult.supportPackage.archive.sha256} />
            <DetailMini label={t("settings.backups.supportPackage.files")} value={supportPackageResult.supportPackage.includedFiles.map((file) => file.name).join(", ")} />
          </div>
        ) : null}

        {hasRestoreSidecars ? (
          <div className="space-y-1.5 border-t border-[var(--card-border)] pt-3 text-[11px]">
            <p className="font-bold text-[var(--text-primary)]">{t("settings.backups.restoreSidecars.title")}</p>
            {currentRestoreHandoffPath ? <DetailMini label={t("settings.backups.restoreConfirm.handoffPath")} value={currentRestoreHandoffPath} /> : null}
            {currentRestoreScriptPath ? <DetailMini label={t("settings.backups.restoreConfirm.scriptPath")} value={currentRestoreScriptPath} /> : null}
            {latestHandoff ? (
              <>
                <DetailMini label={t("settings.backups.restoreSidecars.handoff")} value={latestHandoff.fileName} />
                <DetailMini label={t("settings.backups.restoreSidecars.createdAt")} value={formatDateTime(latestHandoff.createdAt, locale)} />
                <DetailMini label={t("settings.backups.restoreConfirm.handoffPath")} value={latestHandoff.path} />
              </>
            ) : null}
            {latestReport ? (
              <>
                <DetailMini label={t("settings.backups.restoreSidecars.report")} value={latestReport.fileName} />
                <DetailMini label={t("settings.backups.restoreSidecars.status")} value={latestReport.status ?? "-"} />
                <DetailMini label={t("settings.backups.restoreSidecars.completedAt")} value={formatDateTime(latestReport.completedAt, locale)} />
                <DetailMini label={t("settings.backups.restoreSidecars.database")} value={latestReport.databaseName ?? "-"} />
                <DetailMini label={t("settings.backups.restoreSidecars.source")} value={latestReport.sourceBackup ?? "-"} />
              </>
            ) : null}
            {latestPostCheck ? (
              <>
                <DetailMini label={t("settings.backups.restoreSidecars.postCheck")} value={latestPostCheck.fileName} />
                <DetailMini label={t("settings.backups.postRestoreCheck.checkedAt")} value={formatDateTime(latestPostCheck.checkedAt, locale)} />
                <DetailMini label={t("settings.backups.restoreSidecars.status")} value={latestPostCheck.status ?? "-"} />
              </>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-[var(--card-border)] pt-3">
          <CodePanel
            title={t("settings.backups.details.manifestTitle")}
            language="json"
            loading={detailsLoading}
            emptyText={t("settings.backups.details.noManifest")}
            content={details?.manifest ? JSON.stringify(details.manifest, null, 2) : ""}
          />
        </div>
        <CodePanel
          title={t("settings.backups.details.logTitle")}
          language="log"
          loading={detailsLoading}
          emptyText={t("settings.backups.details.noLogs")}
          content={details?.logLines?.length ? details.logLines.join("\n") : ""}
        />
      </div>
    </details>
  );
}

function DetailRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="grid min-w-0 grid-cols-[18px_minmax(76px,0.46fr)_minmax(0,1fr)] gap-1.5 text-[11px]">
      <span className="mt-0.5 text-[var(--text-muted)]">{icon}</span>
      <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className="min-w-0 truncate font-semibold text-[var(--text-primary)]" title={value}>{value}</span>
    </div>
  );
}

function DetailMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-1.5">
      <span className="font-semibold text-[var(--text-secondary)]">{label}</span>
      <span className="break-all font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function ScheduleStatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--card-border)] bg-[var(--bg-panel)] px-2.5 py-2">
      <p className="truncate text-[10px] font-semibold text-[var(--text-secondary)]" title={label}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold text-[var(--text-primary)]" title={value}>
        {value}
      </p>
    </div>
  );
}

type CodeLanguage = "json" | "log";

function CodePanel({
  title,
  language,
  loading,
  emptyText,
  content,
}: {
  title: string;
  language: CodeLanguage;
  loading: boolean;
  emptyText: string;
  content: string;
}) {
  const code = loading ? "..." : content || emptyText;
  const hasCode = Boolean(content && !loading);

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold text-[var(--text-primary)]">{title}</h3>
        {loading ? <IconLoader2 className="h-3.5 w-3.5 animate-spin text-[var(--text-muted)]" stroke={1.8} /> : null}
      </div>
      <pre className="backup-code-panel">
        <code>{hasCode ? highlightCode(code, language) : <span className="backup-code-muted">{code}</span>}</code>
      </pre>
    </section>
  );
}

function highlightCode(content: string, language: CodeLanguage) {
  return language === "json" ? highlightJsonCode(content) : highlightLogCode(content);
}

function highlightJsonCode(content: string) {
  const parts: ReactNode[] = [];
  const tokenPattern = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],:]/g;
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const token = match[0];
    const stringToken = match[1];
    const keySeparator = match[2];
    const className = stringToken
      ? keySeparator
        ? "backup-code-key"
        : "backup-code-string"
      : /^(true|false)$/.test(token)
        ? "backup-code-bool"
        : token === "null"
          ? "backup-code-null"
          : /^-?\d/.test(token)
            ? "backup-code-number"
            : "backup-code-punctuation";

    if (stringToken) {
      parts.push(
        <span key={`json-${tokenIndex++}`} className={className}>
          {stringToken}
        </span>,
      );
      if (keySeparator) {
        parts.push(
          <span key={`json-${tokenIndex++}`} className="backup-code-punctuation">
            {keySeparator}
          </span>,
        );
      }
    } else {
      parts.push(
        <span key={`json-${tokenIndex++}`} className={className}>
          {token}
        </span>,
      );
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

function highlightLogCode(content: string) {
  const parts: ReactNode[] = [];
  const tokenPattern =
    /(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)|([A-Z]:\\[^\s]+)|\b(error|failed|failure|denied|exception)\b|\b(ok|success|succeeded|successfully|passed|completed|verified)\b|\b(backup|database|manifest|sha-256|pg_dump|root|dump)\b/gi;
  let lastIndex = 0;
  let tokenIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const token = match[0];
    const lowerToken = token.toLowerCase();
    const className = match[1]
      ? "backup-code-date"
      : match[2]
        ? "backup-code-path"
        : /error|failed|failure|denied|exception/.test(lowerToken)
          ? "backup-code-error"
          : /ok|success|succeeded|successfully|passed|completed|verified/.test(lowerToken)
            ? "backup-code-success"
            : "backup-code-word";

    parts.push(
      <span key={`log-${tokenIndex++}`} className={className}>
        {token}
      </span>,
    );
    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

function ActionIconButton({
  label,
  children,
  disabled,
  tone = "default",
  tooltipSide = "top",
  onClick,
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  tone?: "default" | "emerald" | "violet";
  tooltipSide?: TooltipSide;
  onClick: () => void;
}) {
  const toneClass = {
    default: "border-blue-500/30 bg-blue-500/10 text-[var(--color-primary)] hover:bg-blue-500/15",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-[var(--color-neon)] hover:bg-emerald-500/15",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-500 hover:bg-violet-500/15",
  } satisfies Record<"default" | "emerald" | "violet", string>;

  return (
    <Tooltip label={label} side={tooltipSide}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass[tone]}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function BackupTypeChip({ backup }: { backup: Pick<BackupItem, "type" | "scheduleFrequency"> }) {
  const { t } = useTranslation();
  const type = backup.type;
  const config = {
    MANUAL: "violet",
    SCHEDULED: "blue",
    PRE_MIGRATION: "amber",
  } satisfies Record<BackupJobType, string>;
  const label =
    type === "SCHEDULED" && backup.scheduleFrequency
      ? `${t(`settings.backups.type.${type}`)} / ${t(`settings.backups.schedule.${backup.scheduleFrequency}`)}`
      : t(`settings.backups.type.${type}`);
  return (
    <span className={`backup-chip backup-chip--${config[type]}`}>
      {label}
    </span>
  );
}

function StatusChip({ status }: { status: BackupStatus }) {
  const { t } = useTranslation();
  const config = {
    RUNNING: "blue",
    COMPLETED: "emerald",
    FAILED: "rose",
    PENDING: "amber",
  } satisfies Record<BackupStatus, string>;
  const Icon = status === "RUNNING" ? IconLoader2 : status === "FAILED" ? IconCircleX : status === "PENDING" ? IconClock : IconCircleCheck;
  return (
    <span className={`backup-chip backup-chip--${config[status]}`}>
      <Icon className={`h-3 w-3 ${status === "RUNNING" ? "animate-spin" : ""}`} stroke={1.8} />
      {t(`settings.backups.status.${status}`)}
    </span>
  );
}

function VerificationChip({ status }: { status: BackupVerificationStatus }) {
  const { t } = useTranslation();
  const config = {
    NOT_VERIFIED: "slate",
    VERIFIED: "emerald",
    FAILED: "rose",
  } satisfies Record<BackupVerificationStatus, string>;
  const Icon = status === "VERIFIED" ? IconShieldCheck : status === "FAILED" ? IconAlertTriangle : IconClock;
  return (
    <span className={`backup-chip backup-chip--${config[status]}`}>
      <Icon className="h-3 w-3" stroke={1.8} />
      {t(`settings.backups.verification.${status}`)}
    </span>
  );
}

function RecoveryStateChip({ summary }: { summary: BackupItem["restoreSidecarSummary"] }) {
  const { t } = useTranslation();
  const postStatus = summary.postRestoreStatus?.toLowerCase();
  const restoreStatus = summary.productionRestoreStatus?.toLowerCase();

  if (postStatus === "passed") {
    return (
      <span className="backup-chip backup-chip--emerald">
        <IconShieldCheck className="h-3 w-3" stroke={1.8} />
        {t("settings.backups.recoveryState.postCheckPassed")}
      </span>
    );
  }

  if (postStatus === "failed") {
    return (
      <span className="backup-chip backup-chip--rose">
        <IconAlertTriangle className="h-3 w-3" stroke={1.8} />
        {t("settings.backups.recoveryState.postCheckFailed")}
      </span>
    );
  }

  if (restoreStatus === "succeeded") {
    return (
      <span className="backup-chip backup-chip--emerald">
        <IconCircleCheck className="h-3 w-3" stroke={1.8} />
        {t("settings.backups.recoveryState.restored")}
      </span>
    );
  }

  if (restoreStatus) {
    return (
      <span className="backup-chip backup-chip--rose">
        <IconAlertTriangle className="h-3 w-3" stroke={1.8} />
        {t("settings.backups.recoveryState.restoreFailed")}
      </span>
    );
  }

  if (summary.hasHandoff) {
    return (
      <span className="backup-chip backup-chip--amber">
        <IconDatabaseExport className="h-3 w-3" stroke={1.8} />
        {t("settings.backups.recoveryState.handoffReady")}
      </span>
    );
  }

  return <span className="text-[11px] font-semibold text-[var(--text-muted)]">-</span>;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function getBackupOwner(item: BackupItem) {
  return item.triggeredBy?.fullName ?? item.triggeredBy?.username ?? item.operator ?? "-";
}

function calculateProtectionScore({
  lastSafeBackup,
  schedule,
  failedCount,
  backupToolsAvailable,
}: {
  lastSafeBackup: BackupItem | null;
  schedule: BackupScheduleStatus | null;
  failedCount: number;
  backupToolsAvailable: boolean;
}) {
  let score = 40;
  score += backupToolsAvailable ? 15 : -15;
  score += lastSafeBackup ? 30 : -20;
  score += schedule?.config.enabled ? 10 : -6;

  if (isExternalCopyCurrent(schedule)) {
    score += 12;
  } else {
    score -= 5;
  }

  if (lastSafeBackup?.startedAt) {
    const ageDays = (Date.now() - new Date(lastSafeBackup.startedAt).getTime()) / 86400000;
    if (ageDays > 7) score -= 18;
    else if (ageDays > 3) score -= 8;
  }

  score -= Math.min(20, failedCount * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getProtectionTone(score: number) {
  if (score >= 90) {
    return { color: "#10b981", labelKey: "settings.backups.dashboard.excellent" };
  }
  if (score >= 70) {
    return { color: "#3b82f6", labelKey: "settings.backups.dashboard.good" };
  }
  return { color: "#f59e0b", labelKey: "settings.backups.dashboard.needsAttention" };
}

function formatRelativeTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays <= 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return formatShortDateTime(value, locale);
}

function formatShortDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBytes(value: string | null | undefined) {
  if (!value) return "-";
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let current = bytes;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current >= 10 || unitIndex === 0 ? current.toFixed(0) : current.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(value: number) {
  if (!value) return "-";
  const minutes = Math.round(value / 60000);
  return `${minutes}m`;
}

function formatElapsedMs(startedAt: number, finishedAt: number | null) {
  const elapsedSeconds = Math.max(0, Math.round(((finishedAt ?? Date.now()) - startedAt) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function resolveDateLocale(locale: string) {
  const language = locale.toLowerCase().split("-")[0];
  if (language === "fa" || language === "prs") return "fa-AF";
  if (language === "ps") return "ps-AF";
  return "en-US";
}
