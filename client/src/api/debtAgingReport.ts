import { api } from "./client";

export type DebtAgingQuery = {
  dateField?: "CREATED_AT" | "START_DATE" | "END_DATE" | "ACTIVATED_AT";
  from?: string;
  to?: string;
  status?: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  planId?: string;
  memberType?: "all" | "customer" | "staff";
  staffGroupId?: string;
  search?: string;
  bucket1?: number;
  bucket2?: number;
  bucket3?: number;
  sortBy?: "remaining" | "daysPastDue" | "memberName" | "status" | "endDate";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type DebtAgingReportItem = {
  membershipId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  memberType: "STAFF" | "CUSTOMER";
  staffGroupName: string | null;
  planId: string | null;
  planName: string | null;
  status: string;
  referenceDate: string;
  startDate: string;
  endDate: string;
  due: number;
  paid: number;
  remaining: number;
  daysPastDue: number;
  bucket: string;
  lastPaymentDate: string | null;
};

export type DebtAgingReportResponse = {
  generatedAt: string;
  filters: {
    dateField: NonNullable<DebtAgingQuery["dateField"]>;
    from: string | null;
    to: string | null;
    status: DebtAgingQuery["status"] | null;
    planId: string | null;
    memberType: NonNullable<DebtAgingQuery["memberType"]>;
    staffGroupId: string | null;
    search: string | null;
    bucket1: number;
    bucket2: number;
    bucket3: number;
    sortBy: NonNullable<DebtAgingQuery["sortBy"]>;
    sortDir: NonNullable<DebtAgingQuery["sortDir"]>;
  };
  kpis: {
    totalOutstanding: number;
    countDebtors: number;
    avgDebt: number;
    largestDebt: number;
    collectionRate: number;
  };
  charts: {
    bucketTotals: Array<{ bucket: string; label: string; count: number; totalOutstanding: number }>;
    monthlyTrend: Array<{ monthKey: string; label: string; totalOutstanding: number; countDebtors: number }>;
  };
  items: DebtAgingReportItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const getDebtAgingReport = (params: DebtAgingQuery) =>
  api.get<DebtAgingReportResponse>("/api/v1/reports/debt-aging", { params });

export const downloadDebtAgingCsv = (params: Omit<DebtAgingQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/debt-aging/export.csv", {
    params,
    responseType: "blob",
  });

export const downloadDebtAgingXlsx = (params: Omit<DebtAgingQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/debt-aging/export.xlsx", {
    params,
    responseType: "blob",
  });
