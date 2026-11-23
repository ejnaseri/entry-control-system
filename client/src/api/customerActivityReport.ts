import { api } from "./client";

export type CustomerActivityReportFilters = {
  search?: string;
  inactiveDays?: number;
  engagementWindowDays?: number;
  lowEngagementMaxVisits?: number;
};

export type CustomerActivityReportPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type CustomerActivitySummaryResponse = {
  generatedAt: string;
  filters: {
    search: string | null;
    inactiveDays: number;
    engagementWindowDays: number;
    lowEngagementMaxVisits: number;
  };
  kpis: {
    activeCustomers: number;
    visitedToday: number;
    inactive7Days: number;
    inactive30Days: number;
    lowEngagement: number;
  };
  tabs: {
    visitedToday: number;
    inactiveMembers: number;
    lowEngagement: number;
  };
};

export type CustomerActivityVisitedTodayItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  planName: string | null;
  membershipEndDate: string;
  daysUntilExpiry: number;
  firstVisitAt: string;
  lastVisitAt: string;
  visitEvents: number;
};

export type CustomerActivityInactiveMemberItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  planName: string | null;
  membershipEndDate: string;
  daysUntilExpiry: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  state: "NEVER" | "INACTIVE";
};

export type CustomerActivityLowEngagementItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberPhone: string | null;
  planName: string | null;
  membershipEndDate: string;
  daysUntilExpiry: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  visitDays: number;
};

export type CustomerActivityVisitedTodayResponse = {
  items: CustomerActivityVisitedTodayItem[];
  pageInfo: CustomerActivityReportPageInfo;
};

export type CustomerActivityInactiveMembersResponse = {
  items: CustomerActivityInactiveMemberItem[];
  pageInfo: CustomerActivityReportPageInfo;
};

export type CustomerActivityLowEngagementResponse = {
  items: CustomerActivityLowEngagementItem[];
  pageInfo: CustomerActivityReportPageInfo;
};

type TabExportQuery = CustomerActivityReportFilters & {
  tab: "visitedToday" | "inactiveMembers" | "lowEngagement";
};

export const getCustomerActivitySummary = (filters: CustomerActivityReportFilters) =>
  api.get<CustomerActivitySummaryResponse>("/api/v1/reports/customer-activity/summary", {
    params: filters,
  });

export const getCustomerActivityVisitedToday = (
  filters: CustomerActivityReportFilters,
  page = 1,
  pageSize = 20
) =>
  api.get<CustomerActivityVisitedTodayResponse>("/api/v1/reports/customer-activity/visited-today", {
    params: { ...filters, page, pageSize },
  });

export const getCustomerActivityInactiveMembers = (
  filters: CustomerActivityReportFilters,
  page = 1,
  pageSize = 20
) =>
  api.get<CustomerActivityInactiveMembersResponse>("/api/v1/reports/customer-activity/inactive-members", {
    params: { ...filters, page, pageSize },
  });

export const getCustomerActivityLowEngagement = (
  filters: CustomerActivityReportFilters,
  page = 1,
  pageSize = 20
) =>
  api.get<CustomerActivityLowEngagementResponse>("/api/v1/reports/customer-activity/low-engagement", {
    params: { ...filters, page, pageSize },
  });

export const downloadCustomerActivityCsv = (query: TabExportQuery) =>
  api.get<Blob>("/api/v1/reports/customer-activity/export.csv", {
    params: query,
    responseType: "blob",
  });

export const downloadCustomerActivityXlsx = (query: TabExportQuery) =>
  api.get<Blob>("/api/v1/reports/customer-activity/export.xlsx", {
    params: query,
    responseType: "blob",
  });
