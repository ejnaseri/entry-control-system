import { api } from "./client";

export type AttendanceDashboardSummary = {
  date: string;
  generatedAt: string;
  employees: { active: number; scheduledToday: number };
  attendance: {
    present: number;
    onTime: number;
    late: number;
    absent: number;
    justified: number;
    insideNow: number;
    openSessions: number;
  };
  warnings: { missingCheckout: number; multipleEvents: number; noShift: number };
  punches: { total: number; denied: number; unknownIds: number };
  devices: {
    total: number;
    enabled: number;
    online: number;
    offline: number;
    lastSyncAt: string | null;
    lastEventAt: string | null;
  };
  trend: Array<{
    date: string;
    scheduled: number;
    present: number;
    late: number;
    absent: number;
    justified: number;
    exceptions: number;
  }>;
};

export type AttendanceDashboardDetailType = "active-employees" | "present" | "inside-now" | "late" | "absent";

export type AttendanceDashboardDetails = {
  type: AttendanceDashboardDetailType;
  date: string;
  total: number;
  items: Array<{
    memberId: string;
    memberCode: string;
    memberName: string;
    memberPhone: string | null;
    staffGroupName: string | null;
    shiftName: string | null;
    shiftTime: string | null;
    role: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: "ACTIVE" | "PRESENT" | "INSIDE" | "LATE" | "ABSENT";
    lateMinutes: number | null;
  }>;
};

export const getAttendanceDashboard = () =>
  api.get<AttendanceDashboardSummary>("/api/v1/dashboard/summary");

export const getAttendanceDashboardDetails = (type: AttendanceDashboardDetailType) =>
  api.get<AttendanceDashboardDetails>("/api/v1/dashboard/details", { params: { type, limit: 100 } });
