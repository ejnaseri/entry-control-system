import { api } from "./client";

export type RenewalForecastQuery = {
  horizonDays?: number;
  includeExpired?: boolean;
  showOnlyDebtors?: boolean;
  planId?: string;
  status?: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  memberType?: "all" | "customer" | "staff";
  search?: string;
  sortBy?: "daysLeft" | "remaining" | "endDate" | "memberName";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type RenewalForecastItem = {
  membershipId: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER";
  planId: string | null;
  planName: string | null;
  currentStatus: string;
  expireDate: string;
  daysLeft: number;
  due: number;
  paid: number;
  remaining: number;
  autoRenew: boolean;
  lastPaymentDate: string | null;
  suggestedAction: "Call" | "SMS" | "Visit";
};

export type RenewalForecastReportResponse = {
  generatedAt: string;
  filters: {
    horizonDays: number;
    includeExpired: boolean;
    showOnlyDebtors: boolean;
    planId: string | null;
    status: RenewalForecastQuery["status"] | null;
    memberType: NonNullable<RenewalForecastQuery["memberType"]>;
    search: string | null;
    sortBy: NonNullable<RenewalForecastQuery["sortBy"]>;
    sortDir: NonNullable<RenewalForecastQuery["sortDir"]>;
  };
  kpis: {
    expiringCount: number;
    expiringRevenueAtRisk: number;
    expectedRenewals: number;
    renewalRatePct: number;
    debtAtRisk: number;
  };
  charts: {
    expirationsTimeline: Array<{ key: string; label: string; count: number; totalDue: number; totalRemaining: number }>;
    byPlan: Array<{ planId: string; planName: string; count: number; totalDue: number; totalRemaining: number }>;
  };
  items: RenewalForecastItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const getRenewalForecastReport = (params: RenewalForecastQuery) =>
  api.get<RenewalForecastReportResponse>("/api/v1/reports/renewal-forecast", { params });

export const downloadRenewalForecastCsv = (params: Omit<RenewalForecastQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/renewal-forecast/export.csv", {
    params,
    responseType: "blob",
  });

export const downloadRenewalForecastXlsx = (params: Omit<RenewalForecastQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/renewal-forecast/export.xlsx", {
    params,
    responseType: "blob",
  });

export type RenewalForecastPdfData = {
  filename: string;
  contentType: string;
  data: string;
};

export const downloadRenewalForecastPdf = (params: Omit<RenewalForecastQuery, "page" | "pageSize">) =>
  api.get<RenewalForecastPdfData>("/api/v1/reports/renewal-forecast/export-pdf-data", { params });
