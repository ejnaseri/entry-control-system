import { MembershipStatus } from "@prisma/client";
import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const debtAgingQuerySchema = z
  .object({
    dateField: z
      .preprocess(emptyToUndefined, z.enum(["CREATED_AT", "START_DATE", "END_DATE", "ACTIVATED_AT"]).default("END_DATE"))
      .default("END_DATE"),
    from: z.preprocess(emptyToUndefined, z.string().optional()),
    to: z.preprocess(emptyToUndefined, z.string().optional()),
    status: z.preprocess(emptyToUndefined, z.nativeEnum(MembershipStatus).optional()),
    planId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid plan id").optional()),
    memberType: z.preprocess(emptyToUndefined, z.enum(["all", "customer", "staff"]).default("all")).default("all"),
    staffGroupId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional()),
    search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    bucket1: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(365).default(30)).default(30),
    bucket2: z.preprocess(emptyToUndefined, z.coerce.number().int().min(2).max(730).default(60)).default(60),
    bucket3: z.preprocess(emptyToUndefined, z.coerce.number().int().min(3).max(1095).default(90)).default(90),
    sortBy: z
      .preprocess(
        emptyToUndefined,
        z.enum(["remaining", "daysPastDue", "memberName", "status", "endDate"]).default("remaining")
      )
      .default("remaining"),
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")).default("desc"),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
    pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)).default(20),
  })
  .superRefine((value, ctx) => {
    if (value.bucket2 <= value.bucket1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bucket2"],
        message: "bucket2 must be greater than bucket1",
      });
    }
    if (value.bucket3 <= value.bucket2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bucket3"],
        message: "bucket3 must be greater than bucket2",
      });
    }
  });

export const debtAgingExportQuerySchema = debtAgingQuerySchema.omit({ page: true, pageSize: true }).extend({
  lang: reportExportLanguageSchema,
});

export type DebtAgingQuery = z.infer<typeof debtAgingQuerySchema>;
export type DebtAgingExportQuery = z.infer<typeof debtAgingExportQuerySchema>;
