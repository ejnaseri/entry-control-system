import { BackupStatus } from "@prisma/client";
import { z } from "zod";

const optionalQueryString = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

export const backupListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.nativeEnum(BackupStatus).optional()
  ),
  search: optionalQueryString(160),
});

export const backupCreateSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

const scheduleTimeSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Backup schedule time must use HH:mm format");

const backupScheduleFrequencySchema = z.enum(["hourly", "daily", "weekly", "monthly", "yearly"]);

const backupScheduleRuleSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: backupScheduleFrequencySchema.optional(),
  time: scheduleTimeSchema.optional(),
  minute: z.coerce.number().int().min(0).max(59).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const backupScheduleProfilesSchema = z
  .object({
    hourly: backupScheduleRuleSchema.optional(),
    daily: backupScheduleRuleSchema.optional(),
    weekly: backupScheduleRuleSchema.optional(),
    monthly: backupScheduleRuleSchema.optional(),
    yearly: backupScheduleRuleSchema.optional(),
  })
  .optional();

export const backupScheduleConfigSchema = z.object({
  enabled: z.boolean().optional(),
  frequency: backupScheduleFrequencySchema.optional(),
  dailyTime: scheduleTimeSchema.optional(),
  schedule: backupScheduleRuleSchema.optional(),
  profiles: backupScheduleProfilesSchema,
  retention: z
    .object({
      hourly: z.coerce.number().int().min(1).max(168).optional(),
      daily: z.coerce.number().int().min(1).max(365).optional(),
      weekly: z.coerce.number().int().min(0).max(104).optional(),
      monthly: z.coerce.number().int().min(0).max(60).optional(),
      yearly: z.coerce.number().int().min(0).max(25).optional(),
      preMigration: z.coerce.number().int().min(1).max(365).optional(),
      manualAutoDelete: z.boolean().optional(),
    })
    .optional(),
  externalCopy: z
    .object({
      enabled: z.boolean().optional(),
      lastTarget: z.string().trim().max(160).optional(),
      lastCopiedAt: z.string().datetime().nullable().optional(),
    })
    .optional(),
});

export const backupScheduledRunNowSchema = z.object({
  frequency: backupScheduleFrequencySchema.optional(),
});

export const backupExternalCopySchema = z.object({
  driveRoot: z.string().trim().min(2).max(32),
  backupId: z.string().trim().min(1).max(512).optional(),
});

export const backupStorageConfigSchema = z.object({
  backupRoot: z.string().trim().min(3).max(260),
});

export const backupIdParamSchema = z.object({
  id: z.string().trim().min(1).max(300),
});

export const backupJobIdParamSchema = z.object({
  id: z.string().cuid("Invalid backup job id"),
});

export const restoreJobIdParamSchema = z.object({
  id: z.string().cuid("Invalid restore job id"),
});

export const operationRunIdParamSchema = z.object({
  id: z.string().cuid("Invalid operation run id"),
});

export const restorePrepareSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const restoreConfirmSchema = z.object({
  folderName: z.string().trim().min(1).max(160),
  phrase: z.string().trim().min(1).max(80),
});

export const restoreMaintenanceSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type BackupListQuery = z.infer<typeof backupListQuerySchema>;
export type BackupCreateInput = z.infer<typeof backupCreateSchema>;
export type BackupExternalCopyInput = z.infer<typeof backupExternalCopySchema>;
export type BackupScheduleConfigInput = z.infer<typeof backupScheduleConfigSchema>;
export type BackupStorageConfigInput = z.infer<typeof backupStorageConfigSchema>;
export type RestorePrepareInput = z.infer<typeof restorePrepareSchema>;
export type RestoreConfirmInput = z.infer<typeof restoreConfirmSchema>;
export type RestoreMaintenanceInput = z.infer<typeof restoreMaintenanceSchema>;
