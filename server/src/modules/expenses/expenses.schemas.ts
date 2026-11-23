import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const coerceBoolean = (value: unknown) => {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
  }
  return value;
};

const expenseStatusEnum = z.enum(["POSTED", "REVERSED"]);

export const expenseCategoryListQuerySchema = z.object({
  includeInactive: z.preprocess(coerceBoolean, z.boolean().default(false)).default(false),
});

export type ExpenseCategoryListQuery = z.infer<typeof expenseCategoryListQuerySchema>;

export const expenseCategoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Category name is required").max(80),
});

export type ExpenseCategoryCreateInput = z.infer<typeof expenseCategoryCreateSchema>;

export const expenseListQuerySchema = z.object({
  from: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Use YYYY-MM-DD").optional()),
  to: z.preprocess(emptyToUndefined, z.string().regex(dateRegex, "Use YYYY-MM-DD").optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  status: z.preprocess(emptyToUndefined, expenseStatusEnum.optional()),
  search: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  sortBy: z.preprocess(emptyToUndefined, z.enum(["occurredAt", "amount"]).default("occurredAt")).default("occurredAt"),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).default("desc")).default("desc"),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).default(1)).default(1),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(25)).default(25),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export const expenseCreateSchema = z.object({
  categoryId: z.string().min(1, "Category is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  occurredAt: z.preprocess(emptyToUndefined, z.string().optional()),
  vendorName: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  reference: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const expenseReverseParamSchema = z.object({
  id: z.string().min(1, "Invalid expense id"),
});

export const expenseReverseSchema = z.object({
  occurredAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type ExpenseReverseInput = z.infer<typeof expenseReverseSchema>;
