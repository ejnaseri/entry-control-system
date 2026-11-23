import { api } from "./client";

export type AttendanceReportFilterParams = {
  from: string;
  to: string;
  memberId?: string;
  memberType?: "staff" | "customer" | "both";
  shiftMode?: "primary" | "all" | "ignoreShifts";
  shiftId?: string;
  staffGroupId?: string;
  deviceId?: string;
  eventType?: "all" | "in" | "out" | "denied";
  search?: string;
  onlyAnomalies?: boolean;
};

export type AttendanceReportPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type AttendanceReportSummaryResponse = {
  range: { from: string; to: string };
  kpis: {
    presentDays: number;
    absentDays: number;
    lateCount: number;
    lateMinutes: number;
    earlyLeaveCount: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    justifiedCount: number;
    unscheduledPresentCount: number;
    deniedCount: number;
    noCheckoutCount: number;
  };
};

export type AttendanceReportDailyItem = {
  date: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceReportDailyResponse = {
  items: AttendanceReportDailyItem[];
  pageInfo: AttendanceReportPageInfo;
};

export type AttendanceReportMemberItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER";
  expectedShifts: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justifiedCount: number;
  unscheduledPresentCount: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceReportMembersResponse = {
  items: AttendanceReportMemberItem[];
  pageInfo: AttendanceReportPageInfo;
};

export type AttendanceReportMembersSortBy =
  | "memberName"
  | "expectedShifts"
  | "presentDays"
  | "absentDays"
  | "lateCount"
  | "lateMinutes"
  | "earlyLeaveCount"
  | "earlyLeaveMinutes"
  | "overtimeMinutes"
  | "justifiedCount"
  | "unscheduledPresentCount"
  | "deniedCount"
  | "noCheckoutCount";

export type AttendanceReportEvidenceItem = {
  id: string;
  timestamp: string;
  memberId: string | null;
  memberName: string;
  memberType: "STAFF" | "CUSTOMER" | "UNKNOWN";
  eventType: "IN" | "OUT" | "DENIED";
  deviceId: string | null;
  deviceName: string | null;
  source: "DEVICE" | "MANUAL" | "API";
  authorized: boolean;
  result: "authorized" | "denied";
  denyReason: string | null;
  notes: string | null;
};

export type AttendanceReportEvidenceResponse = {
  items: AttendanceReportEvidenceItem[];
  pageInfo: AttendanceReportPageInfo;
};

type WithPagination = {
  page?: number;
  pageSize?: number;
};

type MembersQuery = WithPagination & {
  sortBy?: AttendanceReportMembersSortBy;
  sortDir?: "asc" | "desc";
};

type EvidenceQuery = WithPagination & {
  sortDir?: "asc" | "desc";
};

export const getAttendanceReportSummary = (filters: AttendanceReportFilterParams) =>
  api.get<AttendanceReportSummaryResponse>("/api/v1/reports/attendance/summary", {
    params: filters,
  });

export const getAttendanceReportDaily = (
  filters: AttendanceReportFilterParams,
  page = 1,
  pageSize = 20
) =>
  api.get<AttendanceReportDailyResponse>("/api/v1/reports/attendance/daily", {
    params: { ...filters, page, pageSize },
  });

export const getAttendanceReportMembers = (
  filters: AttendanceReportFilterParams,
  query: MembersQuery = {}
) =>
  api.get<AttendanceReportMembersResponse>("/api/v1/reports/attendance/members", {
    params: { page: 1, pageSize: 20, sortBy: "memberName", sortDir: "asc", ...filters, ...query },
  });

export const getAttendanceReportEvidence = (
  filters: AttendanceReportFilterParams,
  query: EvidenceQuery = {}
) =>
  api.get<AttendanceReportEvidenceResponse>("/api/v1/reports/attendance/evidence", {
    params: { page: 1, pageSize: 20, sortDir: "desc", ...filters, ...query },
  });

export type AttendanceReportExportLanguage = "en" | "fa" | "ps";
type AttendanceReportExportParams = AttendanceReportFilterParams & { lang: AttendanceReportExportLanguage };

export const downloadAttendanceReportXlsx = (filters: AttendanceReportExportParams) =>
  api.get<Blob>("/api/v1/reports/attendance/export.xlsx", {
    params: filters,
    responseType: "blob",
  });

export const downloadAttendanceReportPdf = (filters: AttendanceReportExportParams) =>
  api.get<Blob>("/api/v1/reports/attendance/export.pdf", {
    params: filters,
    responseType: "blob",
  });

export const downloadAttendanceReportCsv = (
  filters: AttendanceReportFilterParams,
  variant: "daily" | "members" | "evidence",
  lang: AttendanceReportExportLanguage,
  sortBy: AttendanceReportMembersSortBy = "memberName",
  sortDir: "asc" | "desc" = "asc"
) =>
  api.get<Blob>("/api/v1/reports/attendance/export.csv", {
    params: { ...filters, variant, lang, sortBy, sortDir },
    responseType: "blob",
  });

export const recordAttendanceClientCsvExport = (payload: {
  variant: "daily-attendance" | "entry-logs";
  rowCount: number;
  lang: AttendanceReportExportLanguage;
  filters: {
    date?: string;
    from?: string;
    to?: string;
    memberType?: string;
    eventType?: string;
    source?: string;
    deviceId?: string;
    memberId?: string;
    searchApplied?: boolean;
    summaryFilterApplied?: boolean;
  };
}) => api.post("/api/v1/reports/attendance/client-export-audit", payload);
