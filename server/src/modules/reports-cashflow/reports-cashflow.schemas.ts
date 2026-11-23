import { z } from "zod";
import { reportExportLanguageSchema } from "../reports/shared/report-export.i18n";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
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

export const cashflowQuerySchema = z.object({
  from: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Use YYYY-MM-DD").optional()),
  to: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Use YYYY-MM-DD").optional()),
  groupBy: z.preprocess(emptyToUndefined, z.enum(["day", "week", "month"]).default("day")).default("day"),
  includePayroll: z.preprocess(coerceBoolean, z.boolean().default(true)).default(true),
});

export const cashflowExportQuerySchema = cashflowQuerySchema.extend({
  lang: reportExportLanguageSchema,
});

export type CashflowQuery = z.infer<typeof cashflowQuerySchema>;
export type CashflowExportQuery = z.infer<typeof cashflowExportQuerySchema>;
export type CashflowGroupBy = CashflowQuery["groupBy"];
