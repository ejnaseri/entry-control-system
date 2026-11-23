import { api } from "./client";
import type {
  MemberType,
  MemberShiftInput,
  MemberWizardPayload,
  MemberExtraShiftInput,
  OvertimeRateType,
  RoleType,
  SalaryType,
  FullMemberProfile,
} from "../shared/memberTypes";
import type { StaffGroup } from "./staffGroups";

export type MemberStatus = "ACTIVE" | "EXPIRED" | "DEBTOR" | "BLOCKED";

export type MemberAccessRule = {
  id: string;
  weekday: number;
  fromTime: string;
  toTime: string;
};

export type MemberAccessPolicy = {
  id: string;
  memberId: string;
  allowedDays: number[];
  rules: MemberAccessRule[];
  maxEntriesPerDay?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MemberOvertimePolicy = {
  id: string;
  memberId: string;
  allowOvertime: boolean;
  overtimeRateType?: OvertimeRateType | null;
  overtimeAmount?: number | null;
  maxOvertimePerDay?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type MemberShift = MemberShiftInput & {
  id: string;
  shiftId?: string | null;
  isFromGroup?: boolean;
  rateOverride?: number | null;
  memberId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Member = {
  id: string;
  code: string;
  fingerId?: number | null;
  memberType?: MemberType;
  firstName: string;
  lastName?: string | null;
  fatherName?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  birthDate?: string | null;
  nationalId?: string | null;
  notes?: string | null;
  status: MemberStatus;
  photoUrl?: string | null;
  expiresAt?: string | null;
  lastAttendance?: string | null;
  createdAt: string;
  updatedAt: string;
  roleType?: RoleType | null;
  isStaff: boolean;
  customTitle?: string | null;
  accessPolicy?: MemberAccessPolicy | null;
  overtimePolicy?: MemberOvertimePolicy | null;
  shifts?: MemberShift[];
  salaryType?: SalaryType; // legacy compatibility
  staffGroupId?: string | null;
  staffGroup?: StaffGroup | null;
  extraShifts?: MemberExtraShiftInput[];
  memberships?: Array<{
    id: string;
    endDate?: string | null;
    status?: string | null;
  }>;
  deviceUser?: {
    id: string;
    externalId: number;
    pin?: string | null;
    cardNumber?: string | null;
    deviceId?: string | null;
    lastSyncedAt?: string | null;
  } | null;
};

export type PaginatedMembers = {
  items: Member[];
  total: number;
  skip: number;
  take: number;
};

export const getMembers = (params?: Record<string, unknown>) =>
  api.get<PaginatedMembers>("/api/v1/members", { params });

export const getMember = (id: string) => api.get<Member>(`/api/v1/members/${id}`);
export const getMemberFull = (id: string) => api.get<FullMemberProfile>(`/api/v1/members/${id}/full`);

export const createMember = (data: MemberWizardPayload) => api.post<Member>("/api/v1/members", data);

export const updateMember = (id: string, data: MemberWizardPayload) =>
  api.put<Member>(`/api/v1/members/${id}`, data);

export const deleteMember = (id: string) => api.delete(`/api/v1/members/${id}`);

export const getMemberMemberships = (id: string) =>
  api.get(`/api/v1/members/${id}/memberships`);

export const getMemberPayments = (id: string) =>
  api.get(`/api/v1/members/${id}/payments`);

export type MemberMembershipRenewInput = {
  planId: string;
  periods?: number;
  paidAmount?: number;
  paidAt?: string;
  notes?: string;
};

export const createMemberMembership = (id: string, payload: MemberMembershipRenewInput) =>
  api.post(`/api/v1/members/${id}/memberships`, payload);

export type MemberMembershipCancelInput = {
  refundAt?: string;
  notes?: string;
};

export const cancelMemberMembership = (id: string, membershipId: string, payload?: MemberMembershipCancelInput) =>
  api.post(`/api/v1/members/${id}/memberships/${membershipId}/cancel`, payload ?? {});

export type MemberPaymentCreateInput = {
  amount: number;
  membershipId?: string;
  paidAt?: string;
  notes?: string;
};

export const createMemberPayment = (id: string, payload: MemberPaymentCreateInput) =>
  api.post(`/api/v1/members/${id}/payments`, payload);

export const getMemberAttendance = (id: string) =>
  api.get(`/api/v1/members/${id}/attendance`);
