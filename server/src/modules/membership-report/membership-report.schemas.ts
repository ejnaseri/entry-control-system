import { MembershipStatus } from "@prisma/client";
import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const membershipReportQuerySchema = z.object({
  preset: z
    .preprocess(
      emptyToUndefined,
      z.enum(["LAST_30_DAYS", "LAST_90_DAYS", "THIS_MONTH", "LAST_MONTH", "THIS_YEAR", "ALL"]).default("LAST_90_DAYS")
    )
    .default("LAST_90_DAYS"),
  dateField: z
    .preprocess(emptyToUndefined, z.enum(["CREATED_AT", "START_DATE", "END_DATE", "ACTIVATED_AT"]).default("CREATED_AT"))
    .default("CREATED_AT"),
  from: z.preprocess(emptyToUndefined, z.string().optional()),
  to: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(MembershipStatus).optional()),
  planId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid plan id").optional()),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  remaining: z.preprocess(emptyToUndefined, z.enum(["ALL", "WITH_DEBT", "SETTLED"]).default("ALL")).default("ALL"),
  autoRenew: z.preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return value;
  }, z.boolean().optional()),
  expiringInDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).optional()),
  skip: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(0)).default(0),
  take: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)).default(50),
  sortBy: z
    .preprocess(
      emptyToUndefined,
      z.enum(["CREATED_AT", "START_DATE", "END_DATE", "TOTAL_DUE", "TOTAL_PAID", "REMAINING", "DAYS_LEFT"]).default("END_DATE")
    )
    .default("END_DATE"),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")).default("desc"),
  lang: reportExportLanguageSchema,
});

export type MembershipReportQuery = z.infer<typeof membershipReportQuerySchema>;
