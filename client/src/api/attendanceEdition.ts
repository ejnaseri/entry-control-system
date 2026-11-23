import { api } from "./client";

export type EntryEventType = "IN" | "OUT";
export type EntrySource = "DEVICE" | "MANUAL" | "API";
export type EntryResult = "AUTHORIZED" | "DENIED";

export type StaffEntryLog = {
  id: string;
  createdAt: string;
  recordedAt: string;
  memberId: string;
  memberCode: string;
  memberFullName: string;
  memberType: "STAFF";
  memberStatus?: string | null;
  memberPhone?: string | null;
  memberRole?: string | null;
  memberTitle?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  eventType: EntryEventType;
  source: EntrySource;
  isAuthorized: boolean;
  reason?: string | null;
};

export type StaffEntryLogsResponse = {
  items: StaffEntryLog[];
  page: number;
  pageSize: number;
  total: number;
  summary: { totalIn: number; totalOut: number; uniqueVisitors: number; deniedAttempts: number };
};

export type StaffEntryLogsQuery = {
  memberId?: string;
  deviceId?: string;
  from?: string;
  to?: string;
  eventType?: EntryEventType | "ALL";
  source?: EntrySource | "ALL";
  result?: EntryResult | "ALL";
  search?: string;
  page?: number;
  pageSize?: number;
};

export type AttendanceDeviceOption = { id: string; name: string };

export const listStaffEntryLogs = (params?: StaffEntryLogsQuery) =>
  api.get<StaffEntryLogsResponse>("/api/v1/attendance", { params });
export const downloadStaffEntryLogsCsv = (params: StaffEntryLogsQuery & { lang: "en" | "fa" | "ps" }) =>
  api.get<Blob>("/api/v1/attendance/export.csv", { params, responseType: "blob" });
export const downloadStaffEntryLogsXlsx = (params: StaffEntryLogsQuery & { lang: "en" | "fa" | "ps" }) =>
  api.get<Blob>("/api/v1/attendance/export.xlsx", { params, responseType: "blob" });
export const listAttendanceDeviceOptions = () =>
  api.get<AttendanceDeviceOption[]>("/api/v1/attendance/options/devices");
export const createStaffManualEntry = (payload: { memberId: string; eventType: EntryEventType; occurredAt?: string; notes?: string }) =>
  api.post<StaffEntryLog>("/api/v1/attendance/manual", payload);

export type DailyStatus = "ABSENT" | "LATE" | "PRESENT" | "INSIDE";
export type DailyWarning = "NO_CHECKOUT" | "NO_SHIFT" | "MULTIPLE_EVENTS";
export type StaffDailyRow = {
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
  status: DailyStatus;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  lateMinutes?: number | null;
  earlyMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  overtimeMinutes?: number | null;
  durationMinutes?: number | null;
  confirmedDurationMinutes: number;
  pairedSessionCount: number;
  hasOpenSession: boolean;
  openSessionSince: string | null;
  liveDurationMinutes: number | null;
  lastEventType?: EntryEventType | null;
  deviceName?: string | null;
  warnings: DailyWarning[];
  isJustified: boolean;
  justificationReason?: string | null;
  hasShift: boolean;
};

export type StaffDailyResponse = {
  date: string;
  summary: { present: number; absent: number; late: number; inside: number; justified: number; unscheduledPresentCount: number; deniedCount: number };
  warnings: { noCheckout: number; noShift: number; multipleEvents: number };
  rows: StaffDailyRow[];
};

export type StaffDailyQuery = { date?: string; staffGroupId?: string; shiftId?: string; search?: string; mode?: "primary" | "all" };

export const listStaffDailyAttendance = (params?: StaffDailyQuery) =>
  api.get<StaffDailyResponse>("/api/v1/attendance/daily", { params });
export const saveStaffJustification = (payload: { memberId: string; date: string; reason?: string }) =>
  api.post("/api/v1/attendance/justifications", payload);
export const removeStaffJustification = (memberId: string, date: string) =>
  api.delete("/api/v1/attendance/justifications", { params: { memberId, date } });
