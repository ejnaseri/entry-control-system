import { api } from "./client";

export type AttendanceMemberType = "CUSTOMER" | "STAFF";
export type AttendanceEventType = "IN" | "OUT";
export type AttendanceSource = "DEVICE" | "MANUAL" | "API";

export type AttendanceItem = {
  id: string;
  createdAt: string;
  recordedAt: string;
  memberId: string;
  memberCode: string;
  memberFullName: string;
  memberType: AttendanceMemberType;
  memberStatus?: string | null;
  memberPhone?: string | null;
  memberRole?: string | null;
  memberTitle?: string | null;
  membershipId?: string | null;
  membershipStatus?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  eventType: AttendanceEventType;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason?: string | null;
};

export type AttendanceSummary = {
  totalIn: number;
  totalOut: number;
  uniqueVisitors: number;
  deniedAttempts: number;
};

export type AttendanceResponse = {
  items: AttendanceItem[];
  page: number;
  pageSize: number;
  total: number;
  summary?: AttendanceSummary;
};

export type AttendanceListParams = {
  memberType?: "CUSTOMER" | "STAFF" | "ALL";
  memberId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
  eventType?: "IN" | "OUT" | "ALL";
  source?: "DEVICE" | "MANUAL" | "API" | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
};

export const listAttendance = (params?: AttendanceListParams) =>
  api.get<AttendanceResponse>("/api/v1/attendance", { params });

export type ManualAttendancePayload = {
  memberId: string;
  eventType: "IN" | "OUT";
  occurredAt?: string;
  notes?: string;
};

export const createManualAttendance = (payload: ManualAttendancePayload) =>
  api.post<AttendanceItem>("/api/v1/attendance/manual", payload);

export type DailyAttendanceStatus = "ABSENT" | "LATE" | "PRESENT" | "INSIDE";
export type DailyAttendanceWarning = "NO_CHECKOUT" | "NO_SHIFT" | "MULTIPLE_EVENTS";

export type DailyAttendanceRow = {
  memberId: string;
  memberCode: string;
  memberFullName: string;
  memberPhone?: string | null;
  staffGroupId?: string | null;
  staffGroupName?: string | null;
  shiftId?: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  graceMinutes: number;
  status: DailyAttendanceStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  overtimeMinutes?: number | null;
  durationMinutes?: number | null;
  confirmedDurationMinutes: number;
  hasOpenSession: boolean;
  openSessionSince: string | null;
  liveDurationMinutes: number | null;
  lastEventType?: AttendanceEventType | null;
  deviceName?: string | null;
  warnings: DailyAttendanceWarning[];
  isJustified: boolean;
  justificationReason?: string | null;
  hasShift: boolean;
};

export type DailyAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  inside: number;
  justified: number;
  unscheduledPresentCount: number;
  deniedCount: number;
};

export type DailyAttendanceWarningsSummary = {
  noCheckout: number;
  noShift: number;
  multipleEvents: number;
};

export type DailyAttendanceResponse = {
  date: string;
  summary: DailyAttendanceSummary;
  warnings: DailyAttendanceWarningsSummary;
  rows: DailyAttendanceRow[];
};

export type DailyAttendanceParams = {
  date?: string;
  staffGroupId?: string;
  shiftId?: string;
  search?: string;
  mode?: "primary" | "all";
};

export const listDailyAttendance = (params?: DailyAttendanceParams) =>
  api.get<DailyAttendanceResponse>("/api/v1/attendance/daily", { params });

export type AttendanceJustificationPayload = {
  memberId: string;
  date: string;
  reason?: string;
};

export const createAttendanceJustification = (payload: AttendanceJustificationPayload) =>
  api.post("/api/v1/attendance/justifications", payload);

export const deleteAttendanceJustification = (params: Pick<AttendanceJustificationPayload, "memberId" | "date">) =>
  api.delete("/api/v1/attendance/justifications", { params });
