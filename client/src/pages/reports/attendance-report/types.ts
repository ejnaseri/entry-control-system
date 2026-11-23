import type {
  AttendanceReportDailyItem,
  AttendanceReportEvidenceItem,
  AttendanceReportMemberItem,
  AttendanceReportPageInfo,
  AttendanceReportSummaryResponse,
} from "../../../api/reportsAttendance";

export type DatePreset = "today" | "thisWeek" | "thisMonth" | "custom";
export type ReportTab = "daily" | "members" | "evidence" | "timecard";

export type AttendanceReportFilters = {
  preset: DatePreset;
  from: string;
  to: string;
  memberId: string;
  memberType: "both" | "staff" | "customer";
  eventType: "all" | "in" | "out" | "denied";
  shiftMode: "primary" | "all" | "ignoreShifts";
  shiftId: string;
  staffGroupId: string;
  deviceId: string;
  onlyAnomalies: boolean;
};

export type ExportKind = "csvDaily" | "csvMembers" | "csvEvidence" | "xlsx" | "pdf";

export type Kpis = AttendanceReportSummaryResponse["kpis"];

export const PAGE_SIZE = 20;
export const CSV_PAGE_SIZE = 200;
export const DRAWER_PAGE_SIZE = 120;
export const MAX_CLIENT_EVIDENCE_EXPORT = 20000;

export const EMPTY_PAGE: AttendanceReportPageInfo = {
  page: 1,
  pageSize: PAGE_SIZE,
  totalItems: 0,
  totalPages: 1,
};

export const EMPTY_KPIS: Kpis = {
  presentDays: 0,
  absentDays: 0,
  lateCount: 0,
  lateMinutes: 0,
  earlyLeaveCount: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 0,
  justifiedCount: 0,
  unscheduledPresentCount: 0,
  deniedCount: 0,
  noCheckoutCount: 0,
};

export type DailyItem = AttendanceReportDailyItem;
export type MemberItem = AttendanceReportMemberItem;
export type EvidenceItem = AttendanceReportEvidenceItem;
