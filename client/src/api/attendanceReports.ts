import { api } from "./client";
import type {
  AttendanceReportDailyResponse,
  AttendanceReportEvidenceResponse,
  AttendanceReportMembersResponse,
  AttendanceReportMembersSortBy,
  AttendanceReportSummaryResponse,
} from "./reportsAttendance";

export type AttendanceReportReadFilters = {
  from: string;
  to: string;
  memberId?: string;
  shiftMode?: "primary" | "all" | "ignoreShifts";
  shiftId?: string;
  staffGroupId?: string;
  deviceId?: string;
  eventType?: "all" | "in" | "out" | "denied";
  onlyAnomalies?: boolean;
};

export type AttendanceReportExportLanguage = "en" | "fa" | "ps";

export type AttendanceReportOptions = {
  employees: Array<{ id: string; code: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  shifts: Array<{ id: string; name: string; start: string; end: string }>;
  devices: Array<{ id: string; name: string }>;
};

export type MonthlyTimecardDay = {
  date: string;
  status: "ABSENT" | "LATE" | "PRESENT" | "INSIDE" | "JUSTIFIED";
  shiftName: string;
  scheduledMinutes: number;
  actualMinutes: number;
  pairedSessionCount: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  missingPunch: boolean;
  invalidPunch: boolean;
  justified: boolean;
  unscheduled: boolean;
};

export type MonthlyTimecardItem = {
  memberId: string;
  memberCode: string;
  memberName: string;
  staffGroupId: string | null;
  staffGroupName: string | null;
  totals: {
    scheduledMinutes: number;
    actualMinutes: number;
    pairedSessionCount: number;
    presentDays: number;
    absentDays: number;
    justifiedDays: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    missingPunchDays: number;
    invalidPunchDays: number;
    unscheduledDays: number;
  };
  days: MonthlyTimecardDay[];
};

export type MonthlyTimecardResponse = {
  month: string;
  items: MonthlyTimecardItem[];
  pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

export const getAttendanceReportOptions = () =>
  api.get<AttendanceReportOptions>("/api/v1/reports/attendance/options");

export const getAttendanceReportSummary = (filters: AttendanceReportReadFilters) =>
  api.get<AttendanceReportSummaryResponse>("/api/v1/reports/attendance/summary", { params: filters });

export const getAttendanceReportDaily = (filters: AttendanceReportReadFilters, page = 1, pageSize = 20) =>
  api.get<AttendanceReportDailyResponse>("/api/v1/reports/attendance/daily", { params: { ...filters, page, pageSize } });

export const getAttendanceReportEmployees = (
  filters: AttendanceReportReadFilters,
  query: { page?: number; pageSize?: number; sortBy?: AttendanceReportMembersSortBy; sortDir?: "asc" | "desc" } = {}
) => api.get<AttendanceReportMembersResponse>("/api/v1/reports/attendance/members", {
  params: { page: 1, pageSize: 20, sortBy: "memberName", sortDir: "asc", ...filters, ...query },
});

export const getAttendanceReportEvidence = (
  filters: AttendanceReportReadFilters,
  query: { page?: number; pageSize?: number; sortDir?: "asc" | "desc" } = {}
) => api.get<AttendanceReportEvidenceResponse>("/api/v1/reports/attendance/evidence", {
  params: { page: 1, pageSize: 20, sortDir: "desc", ...filters, ...query },
});

export const getAttendanceMonthlyTimecard = (
  query: { month: string; memberId?: string; staffGroupId?: string; page?: number; pageSize?: number }
) => api.get<MonthlyTimecardResponse>("/api/v1/reports/attendance/timecard", { params: query });

export const downloadAttendanceMonthlyTimecard = (
  format: "csv" | "xlsx" | "pdf",
  query: { month: string; memberId?: string; staffGroupId?: string; lang: AttendanceReportExportLanguage }
) => api.get<Blob>(`/api/v1/reports/attendance/timecard/export.${format}`, { params: query, responseType: "blob" });

export const downloadAttendanceReportCsv = (
  filters: AttendanceReportReadFilters,
  variant: "daily" | "members" | "evidence",
  lang: AttendanceReportExportLanguage,
  sortBy: AttendanceReportMembersSortBy = "memberName",
  sortDir: "asc" | "desc" = "asc"
) => api.get<Blob>("/api/v1/reports/attendance/export.csv", {
  params: { ...filters, variant, lang, sortBy, sortDir },
  responseType: "blob",
});

export const downloadAttendanceReportXlsx = (
  filters: AttendanceReportReadFilters,
  lang: AttendanceReportExportLanguage
) => api.get<Blob>("/api/v1/reports/attendance/export.xlsx", {
  params: { ...filters, lang },
  responseType: "blob",
});

export const downloadAttendanceReportPdf = (
  filters: AttendanceReportReadFilters,
  lang: AttendanceReportExportLanguage
) => api.get<Blob>("/api/v1/reports/attendance/export.pdf", {
  params: { ...filters, lang },
  responseType: "blob",
});
