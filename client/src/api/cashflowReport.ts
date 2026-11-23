import { api } from "./client";

export type CashflowGroupBy = "day" | "week" | "month";

export type CashflowQuery = {
  from?: string;
  to?: string;
  groupBy?: CashflowGroupBy;
  includePayroll?: boolean;
};

export type CashflowTrendRow = {
  periodKey: string;
  label: string;
  inflow: number;
  refunds: number;
  membershipNet: number;
  expenseOutflow: number;
  expenseAdjustments: number;
  expenseNetOutflow: number;
  payrollOutflow: number;
  totalOutflow: number;
  netCash: number;
};

export type CashflowExpenseCategoryRow = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  grossOutflow: number;
  adjustments: number;
  netOutflow: number;
  sharePct: number;
};

export type CashflowReportResponse = {
  generatedAt: string;
  filters: {
    from: string;
    to: string;
    groupBy: CashflowGroupBy;
    includePayroll: boolean;
  };
  summary: {
    membershipInflow: number;
    membershipRefunds: number;
    membershipNet: number;
    expenseGrossOutflow: number;
    expenseAdjustments: number;
    expenseNetOutflow: number;
    payrollOutflow: number;
    totalOutflow: number;
    netCash: number;
    transactionCounts: {
      membershipPayments: number;
      expenseEntries: number;
      payrollPayments: number;
    };
  };
  charts: {
    trend: CashflowTrendRow[];
    expenseByCategory: CashflowExpenseCategoryRow[];
  };
};

export const getCashflowReport = (params: CashflowQuery) => api.get<CashflowReportResponse>("/api/v1/reports/cashflow", { params });

export const downloadCashflowCsv = (params: CashflowQuery) =>
  api.get<Blob>("/api/v1/reports/cashflow/export.csv", {
    params,
    responseType: "blob",
  });

export const downloadCashflowXlsx = (params: CashflowQuery) =>
  api.get<Blob>("/api/v1/reports/cashflow/export.xlsx", {
    params,
    responseType: "blob",
  });
