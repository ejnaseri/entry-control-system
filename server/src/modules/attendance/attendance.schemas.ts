import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const attendanceListQuerySchema = z.object({
  memberType: z.enum(["CUSTOMER", "STAFF", "ALL"]).default("ALL"),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
  deviceId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid device id").optional()),
  from: z.preprocess(emptyToUndefined, z.string().optional()),
  to: z.preprocess(emptyToUndefined, z.string().optional()),
  eventType: z.enum(["IN", "OUT", "ALL"]).default("ALL"),
  source: z.enum(["DEVICE", "MANUAL", "API", "ALL"]).default("ALL"),
  result: z.enum(["AUTHORIZED", "DENIED", "ALL"]).default("ALL"),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export type AttendanceListQuery = z.infer<typeof attendanceListQuerySchema>;

export const attendanceEntryLogsExportQuerySchema = attendanceListQuerySchema
  .omit({ memberType: true, page: true, pageSize: true })
  .extend({ lang: reportExportLanguageSchema })
  .strict();

export type AttendanceEntryLogsExportQuery = z.infer<typeof attendanceEntryLogsExportQuerySchema>;

export const attendanceManualCreateSchema = z.object({
  memberId: z.string().cuid("Invalid member id"),
  eventType: z.enum(["IN", "OUT"]),
  occurredAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type AttendanceManualCreateInput = z.infer<typeof attendanceManualCreateSchema>;

export const attendanceDailyQuerySchema = z.object({
  date: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional()),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
  staffGroupId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional()),
  shiftId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid shift id").optional()),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  mode: z.enum(["primary", "all"]).default("primary"),
});

export type AttendanceDailyQuery = z.infer<typeof attendanceDailyQuerySchema>;

export const attendanceJustificationSchema = z.object({
  memberId: z.string().cuid("Invalid member id"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  reason: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export const attendanceJustificationDeleteSchema = attendanceJustificationSchema.pick({
  memberId: true,
  date: true,
});

export type AttendanceJustificationInput = z.infer<typeof attendanceJustificationSchema>;
