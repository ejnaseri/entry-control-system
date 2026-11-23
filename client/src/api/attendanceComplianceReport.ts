import { api } from "./client";

export type AttendanceComplianceQuery = {
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
  viewBy?: "member" | "group";
  sortBy?: "score" | "lateMinutes" | "lateCount" | "absentDays" | "deniedCount" | "noCheckoutCount" | "name";
  sortDir?: "asc" | "desc";
  lateMinutesWeight?: number;
  lateCountWeight?: number;
  absentWeight?: number;
  noCheckoutWeight?: number;
  deniedWeight?: number;
  page?: number;
  pageSize?: number;
};

export type AttendanceComplianceItem = {
  id: string;
  name: string;
  entityType: "member" | "group";
  memberType: "STAFF" | "CUSTOMER" | "MIXED";
  memberCount: number;
  score: number;
  expectedShifts: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  deniedCount: number;
  noCheckoutCount: number;
};

export type AttendanceComplianceReportResponse = {
  generatedAt: string;
  filters: {
    from: string;
    to: string;
    memberType: NonNullable<AttendanceComplianceQuery["memberType"]>;
    shiftMode: NonNullable<AttendanceComplianceQuery["shiftMode"]>;
    shiftId: string | null;
    staffGroupId: string | null;
    deviceId: string | null;
    eventType: NonNullable<AttendanceComplianceQuery["eventType"]>;
    search: string | null;
    onlyAnomalies: boolean;
    viewBy: NonNullable<AttendanceComplianceQuery["viewBy"]>;
    sortBy: NonNullable<AttendanceComplianceQuery["sortBy"]>;
    sortDir: NonNullable<AttendanceComplianceQuery["sortDir"]>;
    weights: {
      lateMinutesWeight: number;
      lateCountWeight: number;
      absentWeight: number;
      noCheckoutWeight: number;
      deniedWeight: number;
    };
  };
  kpis: {
    averageScore: number;
    bestScore: number;
    worstScore: number;
    evaluatedCount: number;
  };
  charts: {
    distribution: Array<{ bucket: string; count: number }>;
    topLowScores: Array<{ id: string; label: string; score: number }>;
  };
  items: AttendanceComplianceItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export const getAttendanceComplianceReport = (params: AttendanceComplianceQuery) =>
  api.get<AttendanceComplianceReportResponse>("/api/v1/reports/attendance-compliance", { params });

export const downloadAttendanceComplianceCsv = (params: Omit<AttendanceComplianceQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/attendance-compliance/export.csv", {
    params,
    responseType: "blob",
  });

export const downloadAttendanceComplianceXlsx = (params: Omit<AttendanceComplianceQuery, "page" | "pageSize">) =>
  api.get<Blob>("/api/v1/reports/attendance-compliance/export.xlsx", {
    params,
    responseType: "blob",
  });
