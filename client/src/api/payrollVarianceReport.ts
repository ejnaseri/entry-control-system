import { api } from "./client";

export type PayrollVarianceQuery = {
  year: number;
  month: number;
  memberId?: string;
  staffGroupId?: string;
  search?: string;
  sortBy?: "variance" | "absoluteVariance" | "suggestedPay" | "actualPaid" | "memberName";
  sortDir?: "asc" | "desc";
  smallThreshold?: number;
  mediumThreshold?: number;
  page?: number;
  pageSize?: number;
};

export type PayrollVarianceItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  staffGroupName: string | null;
  period: { year: number; month: number };
  suggestedPay: number;
  actualPaid: number;
  variance: number;
  absoluteVariance: number;
  varianceRate: number;
  varianceReason: string | null;
  paymentStatus: string;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  breakdown: {
    baseAmount: number;
    deductions: number;
    additions: number;
    totalAdjustment: number;
    suggestedPay: number;
    absentDays: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    justifiedDays: number;
  } | null;
};

export type PayrollVarianceReportResponse = {
  generatedAt: string;
  filters: {
    year: number;
    month: number;
    memberId: string | null;
    staffGroupId: string | null;
    search: string | null;
    sortBy: NonNullable<PayrollVarianceQuery["sortBy"]>;
    sortDir: NonNullable<PayrollVarianceQuery["sortDir"]>;
    smallThreshold: number;
    mediumThreshold: number;
  };
  kpis: {
    totalSuggested: number;
    totalPaid: number;
    totalVariance: number;
    varianceRate: number;
    topVarianceEmployees: Array<{ memberId: string; memberName: string; variance: number }>;
  };
  charts: {
    suggestedVsPaid: Array<{ label: string; suggested: number; paid: number; variance: number }>;
    varianceBuckets: Record<"zero" | "small" | "medium" | "large", number>;
  };
  items: PayrollVarianceItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const getPayrollVarianceReport = (params: PayrollVarianceQuery) =>
  api.get<PayrollVarianceReportResponse>("/api/v1/reports/payroll-variance", { params });

export const downloadPayrollVarianceCsv = (params: Omit<PayrollVarianceQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/payroll-variance/export.csv", {
    params,
    responseType: "blob",
  });

export const downloadPayrollVarianceXlsx = (params: Omit<PayrollVarianceQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/payroll-variance/export.xlsx", {
    params,
    responseType: "blob",
  });
