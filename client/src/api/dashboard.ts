import { api } from "./client";

export type DashboardRange = "24h" | "7d";

export type DashboardSummary = {
  activeMembers: { value: number; deltaPct: number | null };
  insideNow: { value: number; deltaPct: number | null };
  expiringSoon: { value: number; deltaPct: number | null };
  debtors: { value: number; deltaPct: number | null };
  revenueToday: { value: number; deltaPct: number | null; currency: string };
  todaysEntries: { value: number; deltaPct: number | null };
  deniedReasonsToday: Array<{ reason: string; count: number; pct: number }>;
  peakHoursToday: Array<{ label: string; total: number }>;
  entriesSeries: {
    range: DashboardRange;
    points: Array<{ label: string; authorized: number; denied: number; total: number }>;
  };
};

export type DashboardDetailType = "activeMembers" | "insideNow" | "expiringSoon" | "debtors" | "revenueToday" | "todaysEntries";

export type DashboardActiveMemberDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  planName: string | null;
  endDate: string;
};

export type DashboardExpiringMemberDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  planName: string | null;
  endDate: string;
  daysLeft: number;
};

export type DashboardDebtorDetail = {
  memberId: string;
  code: string;
  fullName: string;
  phone: string | null;
  debtAmount: number;
};

export type DashboardEntryDetail = {
  id: string;
  recordedAt: string;
  entryType: string;
  memberId: string | null;
  memberCode: string | null;
  memberName: string | null;
  externalUserId: number | null;
};

export type DashboardRevenueDetail = {
  id: string;
  paidAt: string | null;
  createdAt: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
};

export type DashboardDetails =
  | { type: "activeMembers"; total: number; items: DashboardActiveMemberDetail[] }
  | { type: "insideNow"; total: number; items: DashboardEntryDetail[] }
  | { type: "expiringSoon"; total: number; items: DashboardExpiringMemberDetail[] }
  | { type: "debtors"; total: number; items: DashboardDebtorDetail[] }
  | { type: "revenueToday"; total: number; items: DashboardRevenueDetail[] }
  | { type: "todaysEntries"; total: number; items: DashboardEntryDetail[] };

export type ReportsDashboardSummary = {
  activeMembers: number;
  totalPaidThisMonth: number;
  expiringThisWeek: number;
  staffPresentToday: number;
  generatedAt: string;
};

export async function getDashboardSummary(range: DashboardRange) {
  const res = await api.get<DashboardSummary>("/api/v1/dashboard/summary", {
    params: { range },
  });
  return res.data;
}

export async function getDashboardDetails(type: DashboardDetailType, limit = 20) {
  const res = await api.get<DashboardDetails>("/api/v1/dashboard/details", {
    params: { type, limit },
  });
  return res.data;
}

export async function getReportsDashboardSummary(): Promise<ReportsDashboardSummary> {
  const res = await api.get<ReportsDashboardSummary>("/api/v1/dashboard/reports-summary");
  return res.data;
}
