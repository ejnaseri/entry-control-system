import { api } from "./client";

export type PayrollSummary = {
  memberId: string;
  year: number;
  month: number;
  baseAmount: number;
  adjustments: number;
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  suggestion: {
    baseAmount: number;
    deductions: number;
    additions: number;
    totalAdjustment: number;
    suggestedPay: number;
    monthDays: number;
    assessedDays: number;
    expectedWorkDays: number;
    expectedShifts: number;
    expectedMinutes: number;
    absentShifts: number;
    absentDays: number;
    justifiedDays: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    items: Array<{
      type: "ABSENCE" | "LATE" | "EARLY_LEAVE" | "OVERTIME";
      amount: number;
      minutes?: number;
      shifts?: number;
      days?: number;
    }>;
  } | null;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    paidAt: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  availableFrom: { year: number; month: number };
};

export type PayrollPaymentBreakdown = {
  computedAt: string;
  period: { year: number; month: number };
  baseAmount: number;
  monthDays: number;
  assessedDays: number;
  expectedWorkDays: number;
  expectedShifts: number;
  expectedMinutes: number;
  absentShifts: number;
  absentDays: number;
  absentMinutes: number;
  justifiedDays: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  deductions: number;
  additions: number;
  totalAdjustment: number;
  suggestedPay: number;
  items: Array<{
    type: "ABSENCE" | "LATE" | "EARLY_LEAVE" | "OVERTIME";
    amount: number;
    minutes?: number;
    shifts?: number;
    days?: number;
  }>;
  policy: {
    id: string;
    scope: "GLOBAL" | "STAFF_GROUP" | "MEMBER";
    memberId: string | null;
    staffGroupId: string | null;
    allowAttendanceDeductions: boolean;
    absenceMode: "PROPORTIONAL" | "FIXED";
    absenceDeductionAmount: number | null;
    lateMode: "PROPORTIONAL" | "FIXED";
    lateDeductionAmount: number | null;
    lateIgnoreMinutes: number;
    earlyLeaveMode: "PROPORTIONAL" | "FIXED";
    earlyLeaveDeductionAmount: number | null;
    earlyLeaveIgnoreMinutes: number;
  } | null;
  daily: Array<{
    date: string;
    expectedShifts: number;
    absentShifts: number;
    absentMinutes: number;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    justified: boolean;
  }>;
};

export type PayrollReportItem = {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  breakdown: PayrollPaymentBreakdown | null;
  period: { year: number; month: number; status: "UNPAID" | "PARTIAL" | "PAID"; totalDue: number };
  member: { id: string; firstName: string; lastName: string | null; code: string };
};

export type PayrollReportResponse = {
  items: PayrollReportItem[];
  total: number;
  summary: { totalPaid: number };
};

export type PayrollOutstandingItem = {
  member: { id: string; firstName: string; lastName: string | null; code: string };
  period: { year: number; month: number };
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  source: "PERIOD" | "ESTIMATE";
};

export type PayrollOutstandingResponse = {
  items: PayrollOutstandingItem[];
  total: number;
  summary: { totalDue: number; totalPaid: number; totalBalance: number };
};

export type PayrollPaymentCreateInput = {
  memberId: string;
  year: number;
  month: number;
  amount: number;
  paidAt?: string;
  notes?: string;
};

export const getPayrollSummary = (params: { memberId: string; year: number; month: number }) =>
  api.get<PayrollSummary>("/api/v1/payroll/summary", { params });

export const getPayrollReport = (params: { year: number; month: number; memberId?: string; skip?: number; take?: number }) =>
  api.get<PayrollReportResponse>("/api/v1/payroll/report", { params });

export const getPayrollOutstanding = (params: { year: number; month: number; take?: number; search?: string }) =>
  api.get<PayrollOutstandingResponse>("/api/v1/payroll/outstanding", { params });

export const createPayrollPayment = (payload: PayrollPaymentCreateInput) =>
  api.post<PayrollSummary>("/api/v1/payroll/payments", payload);
