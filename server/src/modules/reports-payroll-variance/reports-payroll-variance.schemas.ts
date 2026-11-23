import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const payrollVarianceQuerySchema = z
  .object({
    year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(2000).max(2100)),
    month: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(12)),
    memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id").optional()),
    staffGroupId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid staff group id").optional()),
    search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
    sortBy: z
      .preprocess(
        emptyToUndefined,
        z.enum(["variance", "absoluteVariance", "suggestedPay", "actualPaid", "memberName"]).default("absoluteVariance")
      )
      .default("absoluteVariance"),
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")).default("desc"),
    smallThreshold: z.preprocess(emptyToUndefined, z.coerce.number().min(1).max(1_000_000).default(1000)).default(1000),
    mediumThreshold: z.preprocess(emptyToUndefined, z.coerce.number().min(1).max(10_000_000).default(5000)).default(5000),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
    pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(20)).default(20),
  })
  .superRefine((value, ctx) => {
    if (value.mediumThreshold <= value.smallThreshold) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediumThreshold"],
        message: "mediumThreshold must be greater than smallThreshold",
      });
    }
  });

export const payrollVarianceExportQuerySchema = payrollVarianceQuerySchema.omit({ page: true, pageSize: true }).extend({
  lang: reportExportLanguageSchema,
});

export type PayrollVarianceQuery = z.infer<typeof payrollVarianceQuerySchema>;
export type PayrollVarianceExportQuery = z.infer<typeof payrollVarianceExportQuerySchema>;
