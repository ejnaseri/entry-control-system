import { MembershipStatus } from "@prisma/client";
import { z } from "zod";
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

export const renewalForecastQuerySchema = z.object({
  horizonDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).default(30)).default(30),
  includeExpired: z.preprocess(coerceBoolean, z.boolean().default(false)).default(false),
  showOnlyDebtors: z.preprocess(coerceBoolean, z.boolean().default(false)).default(false),
  planId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid plan id").optional()),
  status: z.preprocess(emptyToUndefined, z.nativeEnum(MembershipStatus).optional()),
  memberType: z.preprocess(emptyToUndefined, z.enum(["all", "customer", "staff"]).default("customer")).default("customer"),
  search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  sortBy: z.preprocess(emptyToUndefined, z.enum(["daysLeft", "remaining", "endDate", "memberName"]).default("daysLeft")).default("daysLeft"),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("asc")).default("asc"),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)).default(20),
});

export const renewalForecastExportQuerySchema = renewalForecastQuerySchema.omit({ page: true, pageSize: true }).extend({
  lang: reportExportLanguageSchema,
});

export type RenewalForecastQuery = z.infer<typeof renewalForecastQuerySchema>;
export type RenewalForecastExportQuery = z.infer<typeof renewalForecastExportQuerySchema>;
