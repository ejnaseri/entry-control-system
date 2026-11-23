import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

const baseCustomerActivityReportSchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  inactiveDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).default(7)).default(7),
  engagementWindowDays: z.preprocess(emptyToUndefined, z.coerce.number().int().min(7).max(180).default(30)).default(30),
  lowEngagementMaxVisits: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(60).default(3)).default(3),
});

const paginationSchema = z.object({
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)).default(20),
});

export const customerActivitySummaryQuerySchema = baseCustomerActivityReportSchema;

export const customerActivityVisitedTodayQuerySchema = baseCustomerActivityReportSchema.merge(paginationSchema);

export const customerActivityInactiveMembersQuerySchema = baseCustomerActivityReportSchema.merge(paginationSchema);

export const customerActivityLowEngagementQuerySchema = baseCustomerActivityReportSchema.merge(paginationSchema);

export const customerActivityExportQuerySchema = baseCustomerActivityReportSchema.extend({
  tab: z.preprocess(
    emptyToUndefined,
    z.enum(["visitedToday", "inactiveMembers", "lowEngagement"]).default("visitedToday")
  ).default("visitedToday"),
  lang: reportExportLanguageSchema,
});

export type CustomerActivitySummaryQuery = z.infer<typeof customerActivitySummaryQuerySchema>;
export type CustomerActivityVisitedTodayQuery = z.infer<typeof customerActivityVisitedTodayQuerySchema>;
export type CustomerActivityInactiveMembersQuery = z.infer<typeof customerActivityInactiveMembersQuerySchema>;
export type CustomerActivityLowEngagementQuery = z.infer<typeof customerActivityLowEngagementQuerySchema>;
export type CustomerActivityExportQuery = z.infer<typeof customerActivityExportQuerySchema>;
