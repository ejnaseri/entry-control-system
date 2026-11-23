import { api } from "./client";

export type MembershipReportQuery = {
  lang?: "en" | "fa" | "ps";
  preset?: "LAST_30_DAYS" | "LAST_90_DAYS" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "ALL";
  dateField?: "CREATED_AT" | "START_DATE" | "END_DATE" | "ACTIVATED_AT";
  from?: string;
  to?: string;
  status?: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  planId?: string;
  memberId?: string;
  search?: string;
  remaining?: "ALL" | "WITH_DEBT" | "SETTLED";
  autoRenew?: boolean;
  expiringInDays?: number;
  skip?: number;
  take?: number;
  sortBy?: "CREATED_AT" | "START_DATE" | "END_DATE" | "TOTAL_DUE" | "TOTAL_PAID" | "REMAINING" | "DAYS_LEFT";
  sortDir?: "asc" | "desc";
};

export type MembershipReportItem = {
  id: string;
  member: {
    id: string;
    code: string;
    firstName: string;
    lastName: string | null;
    fullName: string;
    phone: string | null;
  };
  plan: {
    id: string;
    name: string;
    durationValue: number;
    durationUnit: string;
  } | null;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "CANCELLED";
  startDate: string;
  endDate: string;
  createdAt: string;
  activatedAt: string | null;
  autoRenew: boolean;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  lifecycle: "FIRST_TIME" | "RENEWAL";
  daysLeft: number | null;
  isExpiredByDate: boolean;
  isExpiringSoon: boolean;
};

export type MembershipReportResponse = {
  generatedAt: string;
  filters: {
    preset: NonNullable<MembershipReportQuery["preset"]>;
    dateField: NonNullable<MembershipReportQuery["dateField"]>;
    from: string | null;
    to: string | null;
    status: MembershipReportQuery["status"] | null;
    planId: string | null;
    memberId: string | null;
    search: string | null;
    remaining: NonNullable<MembershipReportQuery["remaining"]>;
    autoRenew: boolean | null;
    expiringInDays: number | null;
    sortBy: NonNullable<MembershipReportQuery["sortBy"]>;
    sortDir: NonNullable<MembershipReportQuery["sortDir"]>;
  };
  total: number;
  skip: number;
  take: number;
  summary: {
    totalMemberships: number;
    active: number;
    pending: number;
    expired: number;
    suspended: number;
    cancelled: number;
    renewals: number;
    firstTimers: number;
    autoRenewEnabled: number;
    expiringSoon: number;
    debtors: number;
    totalDue: number;
    totalPaid: number;
    totalRemaining: number;
    collectionRatePct: number;
    averageDuePerMembership: number;
  };
  charts: {
    statusSplit: Array<{ status: MembershipReportItem["status"]; count: number }>;
    lifecycleSplit: Array<{ type: MembershipReportItem["lifecycle"]; count: number }>;
    monthlyTrend: Array<{
      monthKey: string;
      label: string;
      memberships: number;
      renewals: number;
      firstTimers: number;
      totalDue: number;
      totalPaid: number;
      totalRemaining: number;
    }>;
    expiringBuckets: Array<{ bucket: "0-7" | "8-30" | "31-60" | "61+"; count: number }>;
    topPlans: Array<{
      planId: string;
      planName: string;
      memberships: number;
      active: number;
      totalDue: number;
      totalPaid: number;
      totalRemaining: number;
    }>;
    topDebtors: Array<{
      membershipId: string;
      memberId: string;
      memberName: string;
      planName: string | null;
      remaining: number;
      endDate: string;
      daysLeft: number | null;
    }>;
  };
  items: MembershipReportItem[];
};

export const getMembershipReport = (params: MembershipReportQuery) =>
  api.get<MembershipReportResponse>("/api/v1/membership-report", { params });

export const downloadMembershipReportCsv = (params: MembershipReportQuery) =>
  api.get<Blob>("/api/v1/membership-report/export.csv", { params, responseType: "blob" });
