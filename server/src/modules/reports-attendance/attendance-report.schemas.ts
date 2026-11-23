import { z } from "zod";
import {
  attendanceReportDailyQuerySchema,
  attendanceReportEvidenceQuerySchema,
  attendanceReportExportQuerySchema,
  attendanceReportCsvExportQuerySchema,
  attendanceReportMembersQuerySchema,
  attendanceReportSummaryQuerySchema,
} from "./reports-attendance.schemas";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

function forceStaff<T extends Record<string, unknown>>(input: T) {
  return { ...input, memberType: "staff" as const };
}

export const attendanceEditionReportSummaryQuerySchema = attendanceReportSummaryQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

export const attendanceEditionReportDailyQuerySchema = attendanceReportDailyQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

export const attendanceEditionReportMembersQuerySchema = attendanceReportMembersQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

export const attendanceEditionReportEvidenceQuerySchema = attendanceReportEvidenceQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

export const attendanceEditionReportExportQuerySchema = attendanceReportExportQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

export const attendanceEditionReportCsvExportQuerySchema = attendanceReportCsvExportQuerySchema
  .omit({ memberType: true })
  .strict()
  .transform(forceStaff);

const monthlyTimecardFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Use YYYY-MM"),
  memberId: z.string().cuid("Invalid member id").optional(),
  staffGroupId: z.string().cuid("Invalid staff group id").optional(),
});

export const attendanceMonthlyTimecardQuerySchema = monthlyTimecardFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const attendanceMonthlyTimecardExportQuerySchema = monthlyTimecardFiltersSchema.extend({
  lang: reportExportLanguageSchema,
}).strict();

export type AttendanceEditionReportSummaryQuery = z.infer<typeof attendanceEditionReportSummaryQuerySchema>;
export type AttendanceEditionReportDailyQuery = z.infer<typeof attendanceEditionReportDailyQuerySchema>;
export type AttendanceEditionReportMembersQuery = z.infer<typeof attendanceEditionReportMembersQuerySchema>;
export type AttendanceEditionReportEvidenceQuery = z.infer<typeof attendanceEditionReportEvidenceQuerySchema>;
export type AttendanceEditionReportExportQuery = z.infer<typeof attendanceEditionReportExportQuerySchema>;
export type AttendanceEditionReportCsvExportQuery = z.infer<typeof attendanceEditionReportCsvExportQuerySchema>;
export type AttendanceMonthlyTimecardQuery = z.infer<typeof attendanceMonthlyTimecardQuerySchema>;
export type AttendanceMonthlyTimecardExportQuery = z.infer<typeof attendanceMonthlyTimecardExportQuerySchema>;
