import { z } from "zod";
import { HttpError } from "../../middlewares/error-handler";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const coerceBoolean = (value: unknown) => {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
};

export const attendanceReportFiltersSchema = z.object({
  from: z.preprocess(emptyToUndefined, z.string().min(1, "from is required")),
  to: z.preprocess(emptyToUndefined, z.string().min(1, "to is required")),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
  memberType: z.preprocess(emptyToUndefined, z.enum(["staff", "customer", "both"]).default("both")).default("both"),
  shiftMode: z
    .preprocess(emptyToUndefined, z.enum(["primary", "all", "ignoreShifts"]).default("primary"))
    .default("primary"),
  shiftId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid shift id").optional()),
  staffGroupId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional()),
  deviceId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid device id").optional()),
  eventType: z.preprocess(emptyToUndefined, z.enum(["all", "in", "out", "denied"]).default("all")).default("all"),
  search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  onlyAnomalies: z.preprocess(coerceBoolean, z.boolean().default(false)).default(false),
});

const paginationSchema = z.object({
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(25)).default(25),
});

export const attendanceReportSummaryQuerySchema = attendanceReportFiltersSchema;

export const attendanceReportDailyQuerySchema = attendanceReportFiltersSchema.merge(paginationSchema);

export const attendanceReportMembersQuerySchema = attendanceReportFiltersSchema.merge(
  paginationSchema.extend({
    sortBy: z
      .preprocess(
        emptyToUndefined,
        z
          .enum([
            "memberName",
            "expectedShifts",
            "presentDays",
            "absentDays",
            "lateCount",
            "lateMinutes",
            "earlyLeaveCount",
            "earlyLeaveMinutes",
            "overtimeMinutes",
            "justifiedCount",
            "unscheduledPresentCount",
            "deniedCount",
            "noCheckoutCount",
          ])
          .default("memberName")
      )
      .default("memberName"),
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("asc")).default("asc"),
  })
);

export const attendanceReportEvidenceQuerySchema = attendanceReportFiltersSchema.merge(
  paginationSchema.extend({
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")).default("desc"),
  })
);

export const attendanceReportExportQuerySchema = attendanceReportFiltersSchema.extend({
  includeEvidence: z.preprocess(coerceBoolean, z.boolean().default(true)).default(true),
  lang: reportExportLanguageSchema,
});

export const attendanceReportCsvExportQuerySchema = attendanceReportFiltersSchema.extend({
  variant: z.enum(["daily", "members", "evidence"]),
  sortBy: z
    .preprocess(
      emptyToUndefined,
      z
        .enum([
          "memberName",
          "expectedShifts",
          "presentDays",
          "absentDays",
          "lateCount",
          "lateMinutes",
          "earlyLeaveCount",
          "earlyLeaveMinutes",
          "overtimeMinutes",
          "justifiedCount",
          "unscheduledPresentCount",
          "deniedCount",
          "noCheckoutCount",
        ])
        .default("memberName")
    )
    .default("memberName"),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("asc")).default("asc"),
  lang: reportExportLanguageSchema,
});

export const attendanceClientCsvAuditSchema = z.object({
  variant: z.enum(["daily-attendance", "entry-logs"]),
  rowCount: z.coerce.number().int().min(0).max(100_000),
  lang: reportExportLanguageSchema,
  filters: z
    .object({
      date: z.string().max(40).optional(),
      from: z.string().max(40).optional(),
      to: z.string().max(40).optional(),
      memberType: z.string().max(30).optional(),
      eventType: z.string().max(30).optional(),
      source: z.string().max(30).optional(),
      deviceId: z.string().max(80).optional(),
      memberId: z.string().max(80).optional(),
      searchApplied: z.boolean().optional(),
      summaryFilterApplied: z.boolean().optional(),
    })
    .strict(),
});

export type AttendanceReportFiltersInput = z.infer<typeof attendanceReportFiltersSchema>;
export type AttendanceReportSummaryQueryInput = z.infer<typeof attendanceReportSummaryQuerySchema>;
export type AttendanceReportDailyQueryInput = z.infer<typeof attendanceReportDailyQuerySchema>;
export type AttendanceReportMembersQueryInput = z.infer<typeof attendanceReportMembersQuerySchema>;
export type AttendanceReportEvidenceQueryInput = z.infer<typeof attendanceReportEvidenceQuerySchema>;
export type AttendanceReportExportQueryInput = z.infer<typeof attendanceReportExportQuerySchema>;
export type AttendanceReportCsvExportQueryInput = z.infer<typeof attendanceReportCsvExportQuerySchema>;
export type AttendanceClientCsvAuditInput = z.infer<typeof attendanceClientCsvAuditSchema>;

export type AttendanceReportFilters = AttendanceReportFiltersInput & {
  fromDate: Date;
  toDate: Date;
  toExclusive: Date;
  dayCount: number;
};

export function normalizeAttendanceReportFilters(input: AttendanceReportFiltersInput): AttendanceReportFilters {
  const fromDate = parseDateInput(input.from, "from", false);
  const toDate = parseDateInput(input.to, "to", true);
  if (fromDate > toDate) {
    throw new HttpError(400, "Invalid date range", { from: input.from, to: input.to });
  }

  const fromStart = startOfDay(fromDate);
  const toStart = startOfDay(toDate);
  const dayCount = Math.floor((toStart.getTime() - fromStart.getTime()) / 86400000) + 1;

  return {
    ...input,
    fromDate: fromStart,
    toDate: toStart,
    toExclusive: addDays(toStart, 1),
    dayCount,
  };
}

function parseDateInput(value: string, field: string, endOfDay: boolean): Date {
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDateOnly.test(value)) {
    const [yearStr = "0", monthStr = "0", dayStr = "0"] = value.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const parsed = new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
    if (Number.isNaN(parsed.getTime())) {
      throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, `Invalid ${field} date`, { [field]: value });
  }
  return parsed;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
