import { api } from "./client";
import type { SalaryType } from "../shared/memberTypes";
import type { StaffGroup } from "./staffGroups";

export type ShiftTemplate = {
  id: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays?: number[];
  graceMinutes?: number;
  earlyAccessMinutes?: number;
  salaryType: SalaryType;
  salaryAmount: number;
  isActive: boolean;
  staffGroup?: Pick<StaffGroup, "id" | "name" | "accessLevel"> | null;
};

export const getShiftTemplates = () => api.get<ShiftTemplate[]>("/api/v1/shifts");
