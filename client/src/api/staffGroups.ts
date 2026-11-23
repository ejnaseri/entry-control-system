import { api } from "./client";
import type { SalaryType } from "../shared/memberTypes";

export type StaffGroupShift = {
  id: string;
  staffGroupId: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays?: number[];
  graceMinutes?: number;
  earlyAccessMinutes?: number;
  salaryType: SalaryType;
  salaryAmount: number;
  isActive: boolean;
};

export type StaffGroup = {
  id: string;
  name: string;
  description?: string | null;
  accessLevel?: string | null;
  shifts: StaffGroupShift[];
  createdAt?: string;
  updatedAt?: string;
};

export type StaffGroupPayload = {
  name: string;
  description?: string | null;
  accessLevel?: string | null;
  shifts: Array<{
    shiftName: string;
    shiftStart: string;
    shiftEnd: string;
    weekdays?: number[];
    graceMinutes?: number;
    earlyAccessMinutes?: number;
    salaryType: SalaryType;
    salaryAmount: number;
    isActive?: boolean;
  }>;
};

export const getStaffGroups = () => api.get<StaffGroup[]>("/api/v1/staff-groups");
export const getStaffGroup = (id: string) => api.get<StaffGroup>(`/api/v1/staff-groups/${id}`);
export const createStaffGroup = (payload: StaffGroupPayload) => api.post<StaffGroup>("/api/v1/staff-groups", payload);
export const updateStaffGroup = (id: string, payload: StaffGroupPayload) => api.put<StaffGroup>(`/api/v1/staff-groups/${id}`, payload);
export const deleteStaffGroup = (id: string) => api.delete(`/api/v1/staff-groups/${id}`);
