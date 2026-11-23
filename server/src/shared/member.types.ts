export type MemberType = "STAFF" | "CUSTOMER";
export type RoleType = "EMPLOYEE" | "MANAGER" | "OWNER" | "ADMIN" | "COACH" | "RECEPTION" | "OTHER";
export type OvertimeRateType = "PER_HOUR" | "PERCENTAGE";
export type SalaryType = "MONTHLY" | "HOURLY" | "PER_SHIFT";

export type TimeRange = { from: string; to: string };
export type DayAccess = { weekday: number; ranges: TimeRange[] }; // 0 = Saturday, 6 = Friday

export type MemberRoleInput = {
  roleType: RoleType;
  isStaff: boolean;
  customTitle?: string;
};

export type MemberAccessInput = {
  allowedDays: number[];
  allowedTimeRanges: DayAccess[];
};

export type MemberOvertimePolicyInput = {
  allowOvertime: boolean;
  overtimeRateType?: OvertimeRateType | null;
  overtimeAmount?: number | null;
  maxOvertimePerDay?: number | null;
};

export type MemberShiftInput = {
  id?: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays?: number[];
  graceMinutes?: number;
  earlyAccessMinutes?: number;
  salaryType: SalaryType;
  salaryAmount: number;
  isActive?: boolean;
};

export type MemberExtraShiftInput = {
  shiftId: string;
  rateOverride?: number | null;
  isActive?: boolean;
};

export type MemberWizardPayload = {
  memberType: MemberType;
  code: string;
  fingerId?: number | null;
  firstName: string;
  lastName?: string | null;
  fatherName?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  birthDate?: string | null;
  nationalId?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  status?: "ACTIVE" | "EXPIRED" | "DEBTOR" | "BLOCKED";
  role: MemberRoleInput;
  access: MemberAccessInput;
  overtime: MemberOvertimePolicyInput;
  shifts: MemberShiftInput[];
  staffGroupId?: string | null;
  extraShifts?: MemberExtraShiftInput[];
};

export type FullMemberProfile = {
  member: {
    id: string;
    code: string;
    fingerId?: number | null;
    memberType: MemberType;
    firstName: string;
    lastName?: string | null;
    fatherName?: string | null;
    phone?: string | null;
    email?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
    birthDate?: Date | string | null;
    nationalId?: string | null;
    photoUrl?: string | null;
    status: "ACTIVE" | "EXPIRED" | "DEBTOR" | "BLOCKED";
    notes?: string | null;
    roleType?: RoleType | null;
    isStaff: boolean;
    customTitle?: string | null;
    staffGroupId?: string | null;
    staffGroup?: {
      id: string;
      name: string;
      description?: string | null;
      accessLevel?: string | null;
      shifts: MemberShiftInput[];
    } | null;
  };
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    membershipId?: string | null;
    paidAt?: Date | string | null;
    createdAt: Date | string;
    notes?: string | null;
    reference?: string | null;
  }>;
  attendanceLogs: Array<{
    id: string;
    recordedAt: Date | string;
    entryType: string;
    source: string;
    deviceUserId?: string | null;
    isAuthorized: boolean;
    reason?: string | null;
  }>;
  deviceUser?: {
    id: string;
    externalId: number;
    pin?: string | null;
    cardNumber?: string | null;
    deviceId?: string | null;
    lastSyncedAt?: Date | string | null;
  } | null;
  accessViolations: Array<{
    id: string;
    occurredAt: Date | string;
    reason: string;
    notes?: string | null;
  }>;
  doorEvents: Array<{
    id: string;
    triggerType: string;
    action: string;
    requestedAt: Date | string;
    success: boolean;
    notes?: string | null;
  }>;
  // Employee-only
  shifts?: Array<
    MemberShiftInput & {
      id: string;
      shiftId?: string | null;
      isFromGroup: boolean;
      rateOverride?: number | null;
    }
  >;
  overtimePolicy?: (MemberOvertimePolicyInput & { id: string }) | null;
  accessPolicy?: (MemberAccessInput & {
    id: string;
    rules: { id: string; weekday: number; fromTime: string; toTime: string }[];
    maxEntriesPerDay?: number | null;
  }) | null;
  // Customer-only
  memberships?: Array<{
    id: string;
    planId: string;
    plan?: { id: string; name: string; durationDays: number };
    startDate: Date | string;
    endDate: Date | string;
    status: string;
    basePrice: number;
    discount: number;
    totalDue: number;
    totalPaid: number;
    activatedAt?: Date | string | null;
  }>;
  aggregates: {
    totalPaid: number;
    totalDue: number;
    outstandingBalance: number;
    creditBalance: number;
    attendanceDays: number;
    attendanceLogs: number;
    lateArrivals: number;
    overtimeHours: number;
  };
};

export type CustomerMembershipInput = {
  planId: string;
  startDate: string;
  endDate?: string;
  price: number;
  discount?: number;
  paidAmount?: number;
  status: "ACTIVE" | "PENDING" | "DEBTOR" | "EXPIRED";
};

export type CustomerAccessInput = MemberAccessInput & {
  maxEntriesPerDay?: number | null;
};

export type CustomerFormPayload = MemberWizardPayload & {
  membership: CustomerMembershipInput;
  customerAccess: CustomerAccessInput;
  totalPaidAmount?: number;
  totalDebtAmount?: number;
};
