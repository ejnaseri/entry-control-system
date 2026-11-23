import {
  AdminRole,
  AttendanceType,
  AuditActor,
  MemberType,
  OvertimeRateType,
  PaymentStatus,
  PayrollCalcMode,
  PayrollPolicyScope,
  PayrollStatus,
  SalaryType,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { PayrollOutstandingQuery, PayrollPaymentCreateInput, PayrollReportQuery, PayrollSummaryQuery } from "./payroll.schemas";

type PayrollSuggestionItem = {
  type: "ABSENCE" | "LATE" | "EARLY_LEAVE" | "OVERTIME";
  amount: number;
  minutes?: number;
  shifts?: number;
  days?: number;
};

type PayrollSuggestion = {
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
  items: PayrollSuggestionItem[];
};

type PayrollPolicySnapshot = {
  id: string;
  scope: PayrollPolicyScope;
  memberId: string | null;
  staffGroupId: string | null;
  allowAttendanceDeductions: boolean;
  absenceMode: PayrollCalcMode;
  absenceDeductionAmount: number | null;
  lateMode: PayrollCalcMode;
  lateDeductionAmount: number | null;
  lateIgnoreMinutes: number;
  earlyLeaveMode: PayrollCalcMode;
  earlyLeaveDeductionAmount: number | null;
  earlyLeaveIgnoreMinutes: number;
};

type PayrollDaySummary = {
  date: string;
  expectedShifts: number;
  absentShifts: number;
  absentMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  justified: boolean;
};

type PayrollPaymentBreakdown = {
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
  items: PayrollSuggestionItem[];
  policy: PayrollPolicySnapshot | null;
  daily: PayrollDaySummary[];
};

type PayrollSummary = {
  memberId: string;
  year: number;
  month: number;
  baseAmount: number;
  adjustments: number;
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: PayrollStatus;
  suggestion: PayrollSuggestion | null;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    paidAt: Date | null;
    notes: string | null;
    createdAt: Date;
  }>;
  availableFrom: { year: number; month: number };
};

type PayrollReportItem = {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  breakdown: PayrollPaymentBreakdown | null;
  period: { year: number; month: number; status: PayrollStatus; totalDue: number };
  member: { id: string; firstName: string; lastName: string | null; code: string };
};

type PayrollReportResponse = {
  items: PayrollReportItem[];
  total: number;
  summary: {
    totalPaid: number;
  };
};

type PayrollOutstandingItem = {
  member: { id: string; firstName: string; lastName: string | null; code: string };
  period: { year: number; month: number };
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: PayrollStatus;
  source: "PERIOD" | "ESTIMATE";
};

type PayrollOutstandingResponse = {
  items: PayrollOutstandingItem[];
  total: number;
  summary: { totalDue: number; totalPaid: number; totalBalance: number };
};

export type PayrollActionContext = {
  actor: {
    id: string;
    role: AdminRole;
    sessionId?: string;
  };
  meta: {
    ipAddress?: string;
    userAgent?: string;
  };
};

type PayrollPaymentFinancialAuditState = {
  memberId: string;
  payrollPeriodId: string;
  year: number;
  month: number;
  baseAmount: number;
  adjustments: number;
  totalDue: number;
  paidAmount: number;
  balance: number;
  status: PayrollStatus;
  periodExisted: boolean;
};

function resolvePayrollTotals(params: {
  baseAmount: number;
  suggestion?: PayrollSuggestion | null | undefined;
  adjustments?: number | undefined;
  totalDue?: number | undefined;
}) {
  const { baseAmount, suggestion, adjustments = 0, totalDue } = params;
  if (suggestion) {
    return {
      adjustments: roundCurrency(suggestion.totalAdjustment),
      totalDue: roundCurrency(suggestion.suggestedPay),
    };
  }

  const fallbackAdjustments = roundCurrency(safeNumber(adjustments));
  const fallbackTotalDue =
    totalDue !== undefined ? roundCurrency(safeNumber(totalDue)) : roundCurrency(safeNumber(baseAmount) + fallbackAdjustments);

  return {
    adjustments: fallbackAdjustments,
    totalDue: Math.max(0, fallbackTotalDue),
  };
}

export async function getPayrollSummary(query: PayrollSummaryQuery): Promise<PayrollSummary> {
  const member = await loadStaffMember(query.memberId);
  const availableFrom = assertPayrollPeriod(member.createdAt, query.year, query.month);

  const period = await prisma.payrollPeriod.findUnique({
    where: { memberId_year_month: { memberId: query.memberId, year: query.year, month: query.month } },
    include: { payments: { orderBy: { createdAt: "desc" } } },
  });

  if (!period) {
    const baseAmount = calculateBaseAmount(member.shifts ?? [], query.year, query.month);
    const breakdownResult = await buildPayrollBreakdown(member, query.year, query.month, baseAmount);
    const suggestion = breakdownResult?.suggestion ?? null;
    const payrollTotals = resolvePayrollTotals({ baseAmount, suggestion });
    const status = resolvePayrollStatus(payrollTotals.totalDue, 0);
    return {
      memberId: query.memberId,
      year: query.year,
      month: query.month,
      baseAmount,
      adjustments: payrollTotals.adjustments,
      totalDue: payrollTotals.totalDue,
      paidAmount: 0,
      balance: payrollTotals.totalDue,
      status,
      suggestion,
      payments: [],
      availableFrom,
    };
  }

  const paidAmount = roundCurrency(
    period.payments.reduce((sum, payment) => sum + (payment.status === PaymentStatus.PAID ? asAmount(payment.amount) : 0), 0)
  );
  const baseAmount = asAmount(period.baseAmount);
  const breakdownResult = await buildPayrollBreakdown(member, period.year, period.month, baseAmount);
  const suggestion = breakdownResult?.suggestion ?? null;
  const payrollTotals = resolvePayrollTotals({
    baseAmount,
    suggestion,
    adjustments: asAmount(period.adjustments),
    totalDue: asAmount(period.totalDue),
  });
  const status = resolvePayrollStatus(payrollTotals.totalDue, paidAmount);

  return {
    memberId: period.memberId,
    year: period.year,
    month: period.month,
    baseAmount,
    adjustments: payrollTotals.adjustments,
    totalDue: payrollTotals.totalDue,
    paidAmount,
    balance: Math.max(0, roundCurrency(payrollTotals.totalDue - paidAmount)),
    status,
    suggestion,
    payments: period.payments.map((payment) => ({
      id: payment.id,
      amount: asAmount(payment.amount),
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      createdAt: payment.createdAt,
    })),
    availableFrom,
  };
}

export async function getPayrollReport(query: PayrollReportQuery): Promise<PayrollReportResponse> {
  const where: Prisma.PayrollPaymentWhereInput = {
    payrollPeriod: {
      year: query.year,
      month: query.month,
      ...(query.memberId ? { memberId: query.memberId } : {}),
    },
  };

  const [items, total, aggregate] = await prisma.$transaction([
    prisma.payrollPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: query.skip,
      take: query.take,
      include: {
        payrollPeriod: {
          select: {
            year: true,
            month: true,
            status: true,
            totalDue: true,
            member: { select: { id: true, firstName: true, lastName: true, code: true } },
          },
        },
      },
    }),
    prisma.payrollPayment.count({ where }),
    prisma.payrollPayment.aggregate({
      where: { ...where, status: PaymentStatus.PAID },
      _sum: { amount: true },
    }),
  ]);

  return {
    items: items.map((payment) => ({
      id: payment.id,
      amount: asAmount(payment.amount),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt,
      notes: payment.notes,
      createdAt: payment.createdAt,
      breakdown: (payment.breakdown as PayrollPaymentBreakdown | null) ?? null,
      period: {
        year: payment.payrollPeriod.year,
        month: payment.payrollPeriod.month,
        status: payment.payrollPeriod.status,
        totalDue: asAmount(payment.payrollPeriod.totalDue),
      },
      member: {
        id: payment.payrollPeriod.member.id,
        firstName: payment.payrollPeriod.member.firstName,
        lastName: payment.payrollPeriod.member.lastName ?? null,
        code: payment.payrollPeriod.member.code,
      },
    })),
    total,
    summary: { totalPaid: asAmount(aggregate._sum.amount) },
  };
}

export async function getPayrollOutstanding(query: PayrollOutstandingQuery): Promise<PayrollOutstandingResponse> {
  const now = new Date();
  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth() + 1;
  if (query.year > maxYear || (query.year === maxYear && query.month > maxMonth)) {
    return { items: [], total: 0, summary: { totalDue: 0, totalPaid: 0, totalBalance: 0 } };
  }

  const search = query.search?.trim();
  const memberSearch: Prisma.MemberWhereInput = search
    ? {
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const periods = await prisma.payrollPeriod.findMany({
    where: {
      year: query.year,
      month: query.month,
      status: { in: [PayrollStatus.UNPAID, PayrollStatus.PARTIAL] },
      member: {
        is: {
          isStaff: true,
          archivedAt: null,
          ...memberSearch,
        },
      },
    },
    include: {
      member: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          code: true,
          createdAt: true,
          staffGroupId: true,
          shifts: {
            select: {
              salaryType: true,
              salaryAmount: true,
              weekdays: true,
              shiftStart: true,
              shiftEnd: true,
              graceMinutes: true,
              isActive: true,
            },
          },
          overtimePolicy: {
            select: {
              allowOvertime: true,
              overtimeRateType: true,
              overtimeAmount: true,
              maxOvertimePerDay: true,
            },
          },
        },
      },
      payments: { where: { status: PaymentStatus.PAID }, select: { amount: true } },
    },
  });

  const periodItems = (
    await Promise.all(
      periods.map(async (period) => {
      if (!isPayrollMonthAllowed(period.member.createdAt, query.year, query.month, now)) return null;
      const paidAmount = roundCurrency(period.payments.reduce((sum, payment) => sum + asAmount(payment.amount), 0));
      const baseAmount = asAmount(period.baseAmount);
      const breakdownResult = await buildPayrollBreakdown(
        {
          id: period.member.id,
          createdAt: period.member.createdAt,
          shifts: period.member.shifts,
          overtimePolicy: period.member.overtimePolicy,
          staffGroupId: period.member.staffGroupId,
        },
        period.year,
        period.month,
        baseAmount
      );
      const payrollTotals = resolvePayrollTotals({
        baseAmount,
        suggestion: breakdownResult?.suggestion,
        adjustments: asAmount(period.adjustments),
        totalDue: asAmount(period.totalDue),
      });
      if (payrollTotals.totalDue <= 0) return null;
      const status = resolvePayrollStatus(payrollTotals.totalDue, paidAmount);
      if (status === PayrollStatus.PAID) return null;
      return {
        member: {
          id: period.member.id,
          firstName: period.member.firstName,
          lastName: period.member.lastName ?? null,
          code: period.member.code,
        },
        period: { year: period.year, month: period.month },
        totalDue: payrollTotals.totalDue,
        paidAmount,
        balance: Math.max(0, roundCurrency(payrollTotals.totalDue - paidAmount)),
        status,
        source: "PERIOD",
      };
      })
    )
  ).filter(Boolean) as PayrollOutstandingItem[];

  const missingMembers = await prisma.member.findMany({
    where: {
      isStaff: true,
      archivedAt: null,
      shifts: { some: { isActive: true } },
      payrollPeriods: { none: { year: query.year, month: query.month } },
      ...memberSearch,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      code: true,
      createdAt: true,
      staffGroupId: true,
      shifts: {
        select: {
          salaryType: true,
          salaryAmount: true,
          weekdays: true,
          shiftStart: true,
          shiftEnd: true,
          graceMinutes: true,
          isActive: true,
        },
      },
      overtimePolicy: {
        select: {
          allowOvertime: true,
          overtimeRateType: true,
          overtimeAmount: true,
          maxOvertimePerDay: true,
        },
      },
    },
  });

  const missingItems = (
    await Promise.all(
      missingMembers.map(async (member) => {
      if (!isPayrollMonthAllowed(member.createdAt, query.year, query.month, now)) return null;
      const baseAmount = calculateBaseAmount(member.shifts ?? [], query.year, query.month);
      const breakdownResult = await buildPayrollBreakdown(member, query.year, query.month, baseAmount);
      const payrollTotals = resolvePayrollTotals({ baseAmount, suggestion: breakdownResult?.suggestion });
      if (payrollTotals.totalDue <= 0) return null;
      return {
        member: {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName ?? null,
          code: member.code,
        },
        period: { year: query.year, month: query.month },
        totalDue: payrollTotals.totalDue,
        paidAmount: 0,
        balance: payrollTotals.totalDue,
        status: PayrollStatus.UNPAID,
        source: "ESTIMATE",
      };
      })
    )
  ).filter(Boolean) as PayrollOutstandingItem[];

  const items = [...periodItems, ...missingItems]
    .sort((a, b) => {
      if (a.balance !== b.balance) return b.balance - a.balance;
      return a.member.firstName.localeCompare(b.member.firstName);
    })
    .slice(0, query.take);

  const summary = items.reduce(
    (acc, item) => {
      acc.totalDue += item.totalDue;
      acc.totalPaid += item.paidAmount;
      acc.totalBalance += item.balance;
      return acc;
    },
    { totalDue: 0, totalPaid: 0, totalBalance: 0 }
  );

  return {
    items,
    total: items.length,
    summary: {
      totalDue: roundCurrency(summary.totalDue),
      totalPaid: roundCurrency(summary.totalPaid),
      totalBalance: roundCurrency(summary.totalBalance),
    },
  };
}

export async function createPayrollPayment(
  input: PayrollPaymentCreateInput,
  context: PayrollActionContext
): Promise<PayrollSummary> {
  const member = await loadStaffMember(input.memberId);
  const availableFrom = assertPayrollPeriod(member.createdAt, input.year, input.month);

  const amount = roundCurrency(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Payment amount must be greater than 0", { amount });
  }

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (input.paidAt && Number.isNaN(paidAt.getTime())) {
    throw new HttpError(400, "Invalid paidAt timestamp", { paidAt: input.paidAt });
  }

  return prisma.$transaction(async (tx) => {
    let period = await tx.payrollPeriod.findUnique({
      where: { memberId_year_month: { memberId: input.memberId, year: input.year, month: input.month } },
    });
    const periodExisted = Boolean(period);

    const baseAmount = period ? asAmount(period.baseAmount) : calculateBaseAmount(member.shifts ?? [], input.year, input.month);
    const breakdownResult = await buildPayrollBreakdown(
      member,
      input.year,
      input.month,
      baseAmount
    );
    const payrollTotals = resolvePayrollTotals({
      baseAmount,
      suggestion: breakdownResult?.suggestion,
      adjustments: period ? asAmount(period.adjustments) : 0,
      totalDue: period ? asAmount(period.totalDue) : undefined,
    });

    const paidBeforeAggregate = period
      ? await tx.payrollPayment.aggregate({
          where: { payrollPeriodId: period.id, status: PaymentStatus.PAID },
          _sum: { amount: true },
        })
      : null;
    const paidBefore = roundCurrency(asAmount(paidBeforeAggregate?._sum.amount));
    const beforeTotalDue = period ? asAmount(period.totalDue) : payrollTotals.totalDue;
    const beforeData: PayrollPaymentFinancialAuditState = {
      memberId: input.memberId,
      payrollPeriodId: period?.id ?? "",
      year: input.year,
      month: input.month,
      baseAmount: period ? asAmount(period.baseAmount) : baseAmount,
      adjustments: period ? asAmount(period.adjustments) : payrollTotals.adjustments,
      totalDue: beforeTotalDue,
      paidAmount: paidBefore,
      balance: Math.max(0, roundCurrency(beforeTotalDue - paidBefore)),
      status: period?.status ?? resolvePayrollStatus(beforeTotalDue, paidBefore),
      periodExisted,
    };

    if (!period) {
      period = await tx.payrollPeriod.create({
        data: {
          memberId: input.memberId,
          year: input.year,
          month: input.month,
          baseAmount,
          adjustments: payrollTotals.adjustments,
          totalDue: payrollTotals.totalDue,
          status: PayrollStatus.UNPAID,
        },
      });
    }

    const payment = await tx.payrollPayment.create({
      data: {
        payrollPeriodId: period.id,
        amount,
        paidAt,
        notes: input.notes?.trim() || null,
        recordedByAdminId: context.actor.id,
        breakdown: breakdownResult ? (breakdownResult.breakdown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    const aggregate = await tx.payrollPayment.aggregate({
      where: { payrollPeriodId: period.id, status: PaymentStatus.PAID },
      _sum: { amount: true },
    });

    const paidAmount = roundCurrency(asAmount(aggregate._sum.amount));
    const status = resolvePayrollStatus(payrollTotals.totalDue, paidAmount);

    await tx.payrollPeriod.update({
      where: { id: period.id },
      data: {
        baseAmount,
        adjustments: payrollTotals.adjustments,
        totalDue: payrollTotals.totalDue,
        status,
      },
    });

    const refreshed = await tx.payrollPeriod.findUniqueOrThrow({
      where: { id: period.id },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    beforeData.payrollPeriodId = period.id;
    const afterData: PayrollPaymentFinancialAuditState = {
      memberId: refreshed.memberId,
      payrollPeriodId: refreshed.id,
      year: refreshed.year,
      month: refreshed.month,
      baseAmount,
      adjustments: payrollTotals.adjustments,
      totalDue: payrollTotals.totalDue,
      paidAmount,
      balance: Math.max(0, roundCurrency(payrollTotals.totalDue - paidAmount)),
      status,
      periodExisted: true,
    };
    await tx.auditLog.create({
      data: buildPayrollPaymentAuditData(context, {
        payment,
        beforeData,
        afterData,
      }),
    });

    const summary: PayrollSummary = {
      memberId: refreshed.memberId,
      year: refreshed.year,
      month: refreshed.month,
      baseAmount,
      adjustments: payrollTotals.adjustments,
      totalDue: payrollTotals.totalDue,
      paidAmount,
      balance: Math.max(0, roundCurrency(payrollTotals.totalDue - paidAmount)),
      status,
      suggestion: null,
      payments: refreshed.payments.map((payment) => ({
        id: payment.id,
        amount: asAmount(payment.amount),
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        paidAt: payment.paidAt,
        notes: payment.notes,
        createdAt: payment.createdAt,
      })),
      availableFrom,
    };
    summary.suggestion =
      breakdownResult?.suggestion ??
      (await buildPayrollBreakdown(member, summary.year, summary.month, summary.baseAmount))?.suggestion ??
      null;
    return summary;
  });
}

function buildPayrollPaymentAuditData(
  context: PayrollActionContext,
  input: {
    payment: {
      id: string;
      payrollPeriodId: string;
      amount: Prisma.Decimal | number;
      currency: string;
      method: string;
      status: PaymentStatus;
      paidAt: Date | null;
    };
    beforeData: PayrollPaymentFinancialAuditState;
    afterData: PayrollPaymentFinancialAuditState;
  }
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: "payroll.payment.recorded",
    targetType: "PayrollPayment",
    targetId: input.payment.id,
    success: true,
    beforeData: input.beforeData,
    afterData: input.afterData,
    metadata: {
      paymentId: input.payment.id,
      payrollPeriodId: input.payment.payrollPeriodId,
      amount: asAmount(input.payment.amount),
      currency: input.payment.currency,
      method: input.payment.method,
      status: input.payment.status,
      paidAt: input.payment.paidAt?.toISOString() ?? "",
    },
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  return data;
}

async function loadStaffMember(memberId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: {
      shifts: true,
      overtimePolicy: true,
      staffGroup: { select: { id: true, name: true } },
    },
  });
  if (!member) {
    throw new HttpError(404, "Member not found", { memberId });
  }
  const isStaff = member.memberType === MemberType.STAFF || member.isStaff;
  if (!isStaff) {
    throw new HttpError(400, "Payroll is only available for staff members", { memberId });
  }
  return member;
}

async function buildPayrollBreakdown(
  member: {
    id: string;
    createdAt: Date;
    shifts?: Array<{
      salaryType: SalaryType;
      salaryAmount: unknown;
      weekdays?: number[] | null;
      shiftStart: string;
      shiftEnd: string;
      graceMinutes?: number | null;
      isActive?: boolean | null;
    }> | null;
    overtimePolicy?: {
      allowOvertime: boolean;
      overtimeRateType: OvertimeRateType | null;
      overtimeAmount: unknown | null;
      maxOvertimePerDay: unknown | null;
    } | null;
    staffGroup?: { id: string; name: string } | null;
    staffGroupId?: string | null;
  },
  year: number,
  month: number,
  baseAmount: number
): Promise<{ suggestion: PayrollSuggestion; breakdown: PayrollPaymentBreakdown } | null> {
  const policy = await resolvePayrollPolicy(member.id, member.staffGroupId ?? null);
  const shifts = (member.shifts ?? []).filter((shift) => shift.isActive !== false);
  if (!policy && shifts.length === 0) {
    return null;
  }

  const metrics = await calculateMonthlyAttendanceMetrics({
    memberId: member.id,
    shifts,
    year,
    month,
    lateIgnoreMinutes: policy?.lateIgnoreMinutes ?? 0,
    earlyLeaveIgnoreMinutes: policy?.earlyLeaveIgnoreMinutes ?? 0,
    maxOvertimePerDay: member.overtimePolicy?.maxOvertimePerDay ?? null,
  });

  const baseRatePerMinute =
    metrics.expectedMinutes > 0 ? safeNumber(baseAmount) / metrics.expectedMinutes : 0;

  const absenceDeduction = policy?.allowAttendanceDeductions
    ? policy.absenceMode === PayrollCalcMode.FIXED
      ? safeNumber(policy.absenceDeductionAmount) * metrics.absentShifts
      : baseRatePerMinute * metrics.absentMinutes
    : 0;

  const lateDeduction = policy?.allowAttendanceDeductions
    ? policy.lateMode === PayrollCalcMode.FIXED
      ? safeNumber(policy.lateDeductionAmount) * metrics.lateMinutes
      : baseRatePerMinute * metrics.lateMinutes
    : 0;

  const earlyLeaveDeduction = policy?.allowAttendanceDeductions
    ? policy.earlyLeaveMode === PayrollCalcMode.FIXED
      ? safeNumber(policy.earlyLeaveDeductionAmount) * metrics.earlyLeaveMinutes
      : baseRatePerMinute * metrics.earlyLeaveMinutes
    : 0;

  const overtimeAddition = calculateOvertimeAddition({
    overtimeMinutes: metrics.overtimeMinutes,
    ...(member.overtimePolicy !== undefined ? { overtimePolicy: member.overtimePolicy } : {}),
    baseRatePerMinute,
  });

  const deductions = roundCurrency(absenceDeduction + lateDeduction + earlyLeaveDeduction);
  const additions = roundCurrency(overtimeAddition);
  const totalAdjustment = roundCurrency(additions - deductions);
  const suggestedPay = Math.max(0, roundCurrency(safeNumber(baseAmount) + totalAdjustment));

  const items: PayrollSuggestionItem[] = [];
  if (absenceDeduction > 0) {
    items.push({
      type: "ABSENCE",
      amount: roundCurrency(absenceDeduction),
      shifts: metrics.absentShifts,
      days: metrics.absentDays,
    });
  }
  if (lateDeduction > 0) {
    items.push({ type: "LATE", amount: roundCurrency(lateDeduction), minutes: metrics.lateMinutes });
  }
  if (earlyLeaveDeduction > 0) {
    items.push({ type: "EARLY_LEAVE", amount: roundCurrency(earlyLeaveDeduction), minutes: metrics.earlyLeaveMinutes });
  }
  if (overtimeAddition > 0) {
    items.push({ type: "OVERTIME", amount: roundCurrency(overtimeAddition), minutes: metrics.overtimeMinutes });
  }

  const suggestion: PayrollSuggestion = {
    baseAmount: roundCurrency(safeNumber(baseAmount)),
    deductions,
    additions,
    totalAdjustment,
    suggestedPay,
    monthDays: metrics.monthDays,
    assessedDays: metrics.assessedDays,
    expectedWorkDays: metrics.expectedWorkDays,
    expectedShifts: metrics.expectedShifts,
    expectedMinutes: metrics.expectedMinutes,
    absentShifts: metrics.absentShifts,
    absentDays: metrics.absentDays,
    justifiedDays: metrics.justifiedDays,
    lateMinutes: metrics.lateMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    overtimeMinutes: metrics.overtimeMinutes,
    items,
  };

  const policySnapshot = policy
    ? {
      id: policy.id,
      scope: policy.scope,
      memberId: policy.memberId ?? null,
      staffGroupId: policy.staffGroupId ?? null,
      allowAttendanceDeductions: policy.allowAttendanceDeductions,
      absenceMode: policy.absenceMode,
      absenceDeductionAmount: policy.absenceDeductionAmount ? asAmount(policy.absenceDeductionAmount) : null,
      lateMode: policy.lateMode,
      lateDeductionAmount: policy.lateDeductionAmount ? asAmount(policy.lateDeductionAmount) : null,
      lateIgnoreMinutes: policy.lateIgnoreMinutes,
      earlyLeaveMode: policy.earlyLeaveMode,
      earlyLeaveDeductionAmount: policy.earlyLeaveDeductionAmount ? asAmount(policy.earlyLeaveDeductionAmount) : null,
      earlyLeaveIgnoreMinutes: policy.earlyLeaveIgnoreMinutes,
    }
    : null;

  const breakdown: PayrollPaymentBreakdown = {
    computedAt: new Date().toISOString(),
    period: { year, month },
    baseAmount: suggestion.baseAmount,
    monthDays: metrics.monthDays,
    assessedDays: metrics.assessedDays,
    expectedWorkDays: metrics.expectedWorkDays,
    expectedShifts: metrics.expectedShifts,
    expectedMinutes: metrics.expectedMinutes,
    absentShifts: metrics.absentShifts,
    absentDays: metrics.absentDays,
    absentMinutes: metrics.absentMinutes,
    justifiedDays: metrics.justifiedDays,
    lateMinutes: metrics.lateMinutes,
    earlyLeaveMinutes: metrics.earlyLeaveMinutes,
    overtimeMinutes: metrics.overtimeMinutes,
    deductions,
    additions,
    totalAdjustment,
    suggestedPay,
    items,
    policy: policySnapshot,
    daily: metrics.daily,
  };

  return { suggestion, breakdown };
}

async function resolvePayrollPolicy(memberId: string, staffGroupId: string | null) {
  const memberPolicy = await prisma.payrollPolicy.findFirst({
    where: { scope: PayrollPolicyScope.MEMBER, memberId },
    orderBy: { createdAt: "desc" },
  });
  if (memberPolicy) return memberPolicy;

  if (staffGroupId) {
    const groupPolicy = await prisma.payrollPolicy.findFirst({
      where: { scope: PayrollPolicyScope.STAFF_GROUP, staffGroupId },
      orderBy: { createdAt: "desc" },
    });
    if (groupPolicy) return groupPolicy;
  }

  return prisma.payrollPolicy.findFirst({
    where: { scope: PayrollPolicyScope.GLOBAL },
    orderBy: { createdAt: "desc" },
  });
}

async function calculateMonthlyAttendanceMetrics(params: {
  memberId: string;
  shifts: Array<{
    shiftStart: string;
    shiftEnd: string;
    weekdays?: number[] | null;
    graceMinutes?: number | null;
  }>;
  year: number;
  month: number;
  lateIgnoreMinutes: number;
  earlyLeaveIgnoreMinutes: number;
  maxOvertimePerDay: unknown | null;
}) {
  const { memberId, shifts, year, month, lateIgnoreMinutes, earlyLeaveIgnoreMinutes, maxOvertimePerDay } = params;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const assessmentCutoff = getPayrollAssessmentCutoff(year, month);
  const hasOvernightShift = shifts.some((shift) => isCrossMidnight(shift.shiftStart, shift.shiftEnd));
  const logWindowEnd = assessmentCutoff ?? (hasOvernightShift ? addDays(monthEnd, 1) : monthEnd);
  const justificationWindowEnd = assessmentCutoff ? addDays(startOfDay(assessmentCutoff), 1) : monthEnd;

  const logs = await prisma.attendanceLog.findMany({
    where: { memberId, isAuthorized: true, recordedAt: { gte: monthStart, lt: logWindowEnd } },
    orderBy: { recordedAt: "asc" },
  });

  const justifications = await prisma.attendanceJustification.findMany({
    where: { memberId, date: { gte: monthStart, lt: justificationWindowEnd } },
    select: { date: true },
  });

  const logsByDay = new Map<string, typeof logs>();
  logs.forEach((log) => {
    const key = log.recordedAt.toDateString();
    const list = logsByDay.get(key) ?? [];
    list.push(log);
    logsByDay.set(key, list);
  });

  const justifiedDays = new Set(justifications.map((record) => record.date.toDateString()));
  const absentDays = new Set<string>();

  let expectedShifts = 0;
  let expectedMinutes = 0;
  let absentShifts = 0;
  let absentMinutes = 0;
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;
  const dailyOvertimeCapMinutes = resolveDailyOvertimeCapMinutes(maxOvertimePerDay);
  const daily: PayrollDaySummary[] = [];

  const cursor = new Date(monthStart);
  while (cursor < monthEnd) {
    const weekday = toScheduleWeekday(cursor);
    const dayKey = cursor.toDateString();
    const dayLogs = logsByDay.get(dayKey) ?? [];
    const nextDayLogs = hasOvernightShift ? logsByDay.get(addDays(cursor, 1).toDateString()) ?? [] : [];
    const combinedLogs = hasOvernightShift ? [...dayLogs, ...nextDayLogs] : dayLogs;

    const dayIsJustified = justifiedDays.has(dayKey);
    const daySummary: PayrollDaySummary = {
      date: formatDateKey(cursor),
      expectedShifts: 0,
      absentShifts: 0,
      absentMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      justified: dayIsJustified,
    };

    shifts.forEach((shift) => {
      const weekdays = shift.weekdays && shift.weekdays.length ? shift.weekdays : [0, 1, 2, 3, 4, 5, 6];
      if (!weekdays.includes(weekday)) return;
      const duration = getShiftDurationMinutes(shift.shiftStart, shift.shiftEnd);
      expectedShifts += 1;
      expectedMinutes += duration;
      const { endAt } = computeShiftWindow(cursor, shift.shiftStart, shift.shiftEnd);
      if (assessmentCutoff && endAt > assessmentCutoff) {
        return;
      }
      daySummary.expectedShifts += 1;

      const shiftLogs = filterLogsForShift(combinedLogs, shift, cursor);
      const metrics = computeAttendanceMetrics({
        logs: shiftLogs,
        dayStart: cursor,
        hasShift: true,
        shiftStart: shift.shiftStart,
        shiftEnd: shift.shiftEnd,
        graceMinutes: shift.graceMinutes ?? 0,
      });

      if (metrics.status === "ABSENT") {
        if (dayIsJustified) {
          return;
        }
        absentShifts += 1;
        absentMinutes += duration;
        daySummary.absentShifts += 1;
        daySummary.absentMinutes += duration;
        absentDays.add(dayKey);
        return;
      }

      if (metrics.lateMinutes && metrics.lateMinutes > lateIgnoreMinutes) {
        lateMinutes += metrics.lateMinutes;
        daySummary.lateMinutes += metrics.lateMinutes;
      }
      if (metrics.earlyLeaveMinutes && metrics.earlyLeaveMinutes > earlyLeaveIgnoreMinutes) {
        earlyLeaveMinutes += metrics.earlyLeaveMinutes;
        daySummary.earlyLeaveMinutes += metrics.earlyLeaveMinutes;
      }
      if (metrics.overtimeMinutes) {
        daySummary.overtimeMinutes += metrics.overtimeMinutes;
      }
    });

    if (daySummary.overtimeMinutes > 0) {
      daySummary.overtimeMinutes =
        dailyOvertimeCapMinutes === null
          ? daySummary.overtimeMinutes
          : Math.min(daySummary.overtimeMinutes, dailyOvertimeCapMinutes);
      overtimeMinutes += daySummary.overtimeMinutes;
    }

    if (daySummary.expectedShifts > 0) {
      daily.push(daySummary);
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    monthDays: daysInMonth(year, month),
    assessedDays: getAssessedDayCount(monthStart, monthEnd, assessmentCutoff),
    expectedWorkDays: daily.length,
    expectedShifts,
    expectedMinutes,
    absentShifts,
    absentMinutes,
    absentDays: absentDays.size,
    justifiedDays: justifiedDays.size,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    daily,
  };
}

function resolveDailyOvertimeCapMinutes(value: unknown) {
  if (value === null || value === undefined) return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * 60);
}

function calculateOvertimeAddition(params: {
  overtimeMinutes: number;
  overtimePolicy?: { allowOvertime: boolean; overtimeRateType: OvertimeRateType | null; overtimeAmount: unknown | null } | null;
  baseRatePerMinute: number;
}) {
  const { overtimeMinutes, overtimePolicy, baseRatePerMinute } = params;
  if (!overtimePolicy?.allowOvertime) return 0;
  if (!overtimeMinutes || overtimeMinutes <= 0) return 0;
  const amount = safeNumber(overtimePolicy.overtimeAmount);
  if (!amount) return 0;
  if (overtimePolicy.overtimeRateType === OvertimeRateType.PERCENTAGE) {
    return baseRatePerMinute * overtimeMinutes * (amount / 100);
  }
  return (overtimeMinutes / 60) * amount;
}

function assertPayrollPeriod(createdAt: Date, year: number, month: number) {
  const minYear = createdAt.getFullYear();
  const minMonth = createdAt.getMonth() + 1;
  if (year < minYear || (year === minYear && month < minMonth)) {
    throw new HttpError(400, "Payroll period is before member start date", {
      year,
      month,
      minYear,
      minMonth,
    });
  }

  const now = new Date();
  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth() + 1;
  if (year > maxYear || (year === maxYear && month > maxMonth)) {
    throw new HttpError(400, "Payroll period cannot be in the future", {
      year,
      month,
      maxYear,
      maxMonth,
    });
  }

  return { year: minYear, month: minMonth };
}

function isPayrollMonthAllowed(createdAt: Date, year: number, month: number, now = new Date()) {
  const minYear = createdAt.getFullYear();
  const minMonth = createdAt.getMonth() + 1;
  if (year < minYear || (year === minYear && month < minMonth)) return false;
  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth() + 1;
  if (year > maxYear || (year === maxYear && month > maxMonth)) return false;
  return true;
}

function getPayrollAssessmentCutoff(year: number, month: number, now = new Date()) {
  if (year !== now.getFullYear() || month !== now.getMonth() + 1) return null;
  return now;
}

function getAssessedDayCount(monthStart: Date, monthEnd: Date, assessmentCutoff: Date | null) {
  if (!assessmentCutoff) {
    return daysInMonth(monthStart.getFullYear(), monthStart.getMonth() + 1);
  }
  const cutoffDay = startOfDay(assessmentCutoff);
  if (cutoffDay < monthStart) return 0;
  const monthLastDay = addDays(monthEnd, -1);
  const effectiveCutoff = cutoffDay > monthLastDay ? monthLastDay : cutoffDay;
  return daysBetweenInclusive(monthStart, effectiveCutoff);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function daysBetweenInclusive(start: Date, end: Date) {
  const startTime = startOfDay(start).getTime();
  const endTime = startOfDay(end).getTime();
  return Math.floor((endTime - startTime) / (24 * 60 * 60 * 1000)) + 1;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function calculateBaseAmount(shifts: Array<{ salaryType: SalaryType; salaryAmount: unknown; weekdays?: number[] | null; shiftStart: string; shiftEnd: string; isActive?: boolean | null }>, year: number, month: number) {
  return roundCurrency(
    shifts.reduce((sum, shift) => {
      if (shift.isActive === false) return sum;
      const amount = asAmount(shift.salaryAmount);
      if (!amount) return sum;
      if (shift.salaryType === SalaryType.MONTHLY) {
        return sum + amount;
      }

      const weekdays = shift.weekdays && shift.weekdays.length ? shift.weekdays : [0, 1, 2, 3, 4, 5, 6];
      const occurrences = countOccurrencesInMonth(year, month, weekdays);
      if (shift.salaryType === SalaryType.PER_SHIFT) {
        return sum + amount * occurrences;
      }

      const durationMinutes = getShiftDurationMinutes(shift.shiftStart, shift.shiftEnd);
      const hours = durationMinutes / 60;
      return sum + amount * hours * occurrences;
    }, 0)
  );
}

function countOccurrencesInMonth(year: number, month: number, weekdays: number[]) {
  const target = new Set(weekdays);
  let count = 0;
  let cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    const storedDay = toStoredWeekday(cursor.getUTCDay());
    if (target.has(storedDay)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function toStoredWeekday(jsDay: number) {
  return (jsDay + 1) % 7;
}

function getShiftDurationMinutes(start: string, end: string) {
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  if (endMinutes >= startMinutes) return endMinutes - startMinutes;
  return 24 * 60 - startMinutes + endMinutes;
}

const SHIFT_MATCH_BUFFER_MINUTES = 120;

function filterLogsForShift(
  logs: Array<{ recordedAt: Date; entryType: AttendanceType }>,
  shift: { shiftStart: string; shiftEnd: string },
  dayStart: Date
) {
  if (logs.length === 0) return [];
  const { startAt, endAt } = computeShiftWindow(dayStart, shift.shiftStart, shift.shiftEnd);
  const windowStart = addMinutes(startAt, -SHIFT_MATCH_BUFFER_MINUTES);
  const windowEnd = addMinutes(endAt, SHIFT_MATCH_BUFFER_MINUTES);
  return logs.filter((log) => log.recordedAt >= windowStart && log.recordedAt <= windowEnd);
}

function computeAttendanceMetrics(params: {
  logs: Array<{ recordedAt: Date; entryType: AttendanceType }>;
  dayStart: Date;
  hasShift: boolean;
  shiftStart?: string;
  shiftEnd?: string;
  graceMinutes?: number;
}) {
  const { logs, dayStart, hasShift, shiftStart, shiftEnd, graceMinutes = 0 } = params;
  const checkInAt = logs.find((log) => log.entryType === AttendanceType.IN)?.recordedAt ?? null;
  const checkOutAt = [...logs].reverse().find((log) => log.entryType === AttendanceType.OUT)?.recordedAt ?? null;
  const lastEventType = logs.at(-1)?.entryType ?? null;
  const inside = Boolean(checkInAt && (!checkOutAt || lastEventType === AttendanceType.IN));

  let lateMinutes: number | null = null;
  let earlyLeaveMinutes: number | null = null;
  let overtimeMinutes: number | null = null;

  if (hasShift && shiftStart && shiftEnd) {
    const { startAt: shiftStartAt, endAt: shiftEndAt } = computeShiftWindow(dayStart, shiftStart, shiftEnd);
    if (checkInAt) {
      const lateThreshold = addMinutes(shiftStartAt, graceMinutes);
      lateMinutes = Math.max(0, minutesBetween(checkInAt, lateThreshold));
    }
    if (checkOutAt) {
      earlyLeaveMinutes = checkOutAt < shiftEndAt ? Math.max(0, minutesBetween(shiftEndAt, checkOutAt)) : 0;
      overtimeMinutes = checkOutAt > shiftEndAt ? Math.max(0, minutesBetween(checkOutAt, shiftEndAt)) : 0;
    }
  }

  const status = !checkInAt
    ? "ABSENT"
    : inside
      ? "INSIDE"
      : lateMinutes && lateMinutes > 0
        ? "LATE"
        : "PRESENT";

  return {
    status,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
  };
}

function addMinutes(date: Date, minutes: number): Date {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyTime(base: Date, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(base);
  next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return next;
}

function computeShiftWindow(dayStart: Date, shiftStart: string, shiftEnd: string) {
  const startAt = applyTime(dayStart, shiftStart);
  let endAt = applyTime(dayStart, shiftEnd);
  if (isCrossMidnight(shiftStart, shiftEnd)) {
    endAt = addDays(endAt, 1);
  }
  if (endAt < startAt) {
    endAt = addDays(endAt, 1);
  }
  return { startAt, endAt };
}

function isCrossMidnight(shiftStart: string, shiftEnd: string) {
  return timeToMinutes(shiftEnd) <= timeToMinutes(shiftStart);
}

function minutesBetween(later: Date, earlier: Date) {
  return Math.floor((later.getTime() - earlier.getTime()) / 60000);
}

function toScheduleWeekday(date: Date) {
  return (date.getDay() + 1) % 7;
}

function timeToMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  return hours * 60 + minutes;
}

function parseMinutes(value: string) {
  const [hoursPart = "0", minutesPart = "0"] = value.split(":");
  const hours = Number(hoursPart);
  const minutes = Number(minutesPart);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function resolvePayrollStatus(totalDue: number, paidAmount: number) {
  if (totalDue <= 0) return PayrollStatus.PAID;
  if (paidAmount <= 0) return PayrollStatus.UNPAID;
  if (paidAmount < totalDue) return PayrollStatus.PARTIAL;
  return PayrollStatus.PAID;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function asAmount(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function safeNumber(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}
