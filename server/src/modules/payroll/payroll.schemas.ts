import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" || value === null ? undefined : value);

export const payrollSummaryQuerySchema = z.object({
  memberId: z.string().cuid("Invalid member id"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type PayrollSummaryQuery = z.infer<typeof payrollSummaryQuerySchema>;

export const payrollReportQuerySchema = z.object({
  year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(2000).max(2100)),
  month: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(12)),
  memberId: z.preprocess(emptyToUndefined, z.string().cuid("Invalid member id")).optional(),
  skip: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).default(0)),
  take: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
});

export type PayrollReportQuery = z.infer<typeof payrollReportQuerySchema>;

export const payrollOutstandingQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  take: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(200).default(50)),
  search: z.preprocess(emptyToUndefined, z.string().max(100)).optional(),
});

export type PayrollOutstandingQuery = z.infer<typeof payrollOutstandingQuerySchema>;

export const payrollPaymentCreateSchema = z.object({
  memberId: z.string().cuid("Invalid member id"),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paidAt: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

export type PayrollPaymentCreateInput = z.infer<typeof payrollPaymentCreateSchema>;
