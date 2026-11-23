import { z } from "zod";
import { attendanceReportFiltersSchema } from "../reports-attendance/reports-attendance.schemas";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const attendanceComplianceQuerySchema = attendanceReportFiltersSchema.merge(
  z.object({
    viewBy: z.preprocess(emptyToUndefined, z.enum(["member", "group"]).default("member")).default("member"),
    sortBy: z
      .preprocess(
        emptyToUndefined,
        z
          .enum(["score", "lateMinutes", "lateCount", "absentDays", "deniedCount", "noCheckoutCount", "name"])
          .default("score")
      )
      .default("score"),
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("asc")).default("asc"),
    lateMinutesWeight: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(5).default(0.05)).default(0.05),
    lateCountWeight: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(20).default(1)).default(1),
    absentWeight: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(50).default(8)).default(8),
    noCheckoutWeight: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(50).default(4)).default(4),
    deniedWeight: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(50).default(6)).default(6),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
    pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)).default(20),
  })
);

export const attendanceComplianceExportQuerySchema = attendanceComplianceQuerySchema.omit({ page: true, pageSize: true }).extend({
  lang: reportExportLanguageSchema,
});

export type AttendanceComplianceQuery = z.infer<typeof attendanceComplianceQuerySchema>;
export type AttendanceComplianceExportQuery = z.infer<typeof attendanceComplianceExportQuerySchema>;
