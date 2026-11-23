import { api } from "./client";

export type EmployeeStatus = "ACTIVE" | "BLOCKED";
export type EmployeeGender = "MALE" | "FEMALE" | "OTHER";
export type EmployeeRole = "EMPLOYEE" | "MANAGER" | "OWNER" | "ADMIN" | "COACH" | "RECEPTION" | "OTHER";

export type EmployeeShiftInput = {
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
  earlyAccessMinutes: number;
  isActive: boolean;
};

export type EmployeePayload = {
  code: string;
  firstName: string;
  lastName?: string;
  fatherName?: string;
  phone?: string;
  email?: string;
  gender?: EmployeeGender;
  birthDate?: string;
  nationalId?: string;
  photoUrl?: string;
  status: EmployeeStatus;
  notes?: string;
  role: { roleType: EmployeeRole; customTitle?: string };
  profile: { position?: string; department?: string; systemRole?: string };
  access: {
    allowedDays: number[];
    allowedTimeRanges: Array<{ weekday: number; ranges: Array<{ from: string; to: string }> }>;
  };
  overtime: { allowOvertime: boolean; maxOvertimePerDay?: number };
  staffGroupId?: string;
  shifts: EmployeeShiftInput[];
  extraShifts: Array<{ shiftId: string; isActive: boolean }>;
};

export type EmployeeSummary = {
  id: string;
  code: string;
  memberType: "STAFF";
  isStaff: true;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: EmployeeStatus;
  roleType: EmployeeRole | null;
  customTitle: string | null;
  staffGroupId: string | null;
  staffGroup: { id: string; name: string } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDetail = EmployeeSummary & {
  fatherName: string | null;
  email: string | null;
  gender: EmployeeGender | null;
  birthDate: string | null;
  nationalId: string | null;
  notes: string | null;
  active: boolean;
  profile: { position: string | null; department: string | null; systemRole: string | null } | null;
  staffGroup: ({
    id: string;
    name: string;
    description: string | null;
    accessLevel: string | null;
    shifts: Array<EmployeeShiftInput & { id: string }>;
  }) | null;
  access: {
    allowedDays: number[];
    allowedTimeRanges: Array<{ weekday: number; ranges: Array<{ from: string; to: string }> }>;
    maxEntriesPerDay: number | null;
  } | null;
  overtime: { allowOvertime: boolean; maxOvertimePerDay: number | null } | null;
  shifts: Array<EmployeeShiftInput & { id: string; shiftId: string | null; isFromGroup: boolean }>;
};

export type EmployeeAttendance = {
  id: string;
  entryType: "IN" | "OUT";
  recordedAt: string;
  source: string;
  isAuthorized: boolean;
  reason: string | null;
};

export type EmployeeListQuery = {
  status?: EmployeeStatus;
  staffGroupId?: string;
  search?: string;
  includeArchived?: boolean;
  take?: number;
  skip?: number;
};

export type EmployeeStaffGroupOption = {
  id: string;
  name: string;
  description: string | null;
  accessLevel: string | null;
  shifts: Array<EmployeeShiftInput & { id: string }>;
};

export const listEmployees = (query: EmployeeListQuery) =>
  api.get<{ items: EmployeeSummary[]; total: number; skip: number; take: number }>("/api/v1/employees", { params: query });
export const getEmployee = (id: string) => api.get<EmployeeDetail>(`/api/v1/employees/${id}`);
export const createEmployee = (payload: EmployeePayload) => api.post<EmployeeDetail>("/api/v1/employees", payload);
export const updateEmployee = (id: string, payload: EmployeePayload) =>
  api.put<EmployeeDetail>(`/api/v1/employees/${id}`, payload);
export const setEmployeeArchived = (id: string, archived: boolean) =>
  api.patch<EmployeeDetail>(`/api/v1/employees/${id}/archive`, { archived });
export const listEmployeeAttendance = (id: string) =>
  api.get<EmployeeAttendance[]>(`/api/v1/employees/${id}/attendance`);
export const listEmployeeStaffGroupOptions = () =>
  api.get<EmployeeStaffGroupOption[]>("/api/v1/employees/options/staff-groups");
