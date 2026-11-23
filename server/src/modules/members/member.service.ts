import {
  AdminRole,
  AuditActor,
  DeviceConnectionType,
  DeviceType,
  MemberStatus,
  MemberType,
  MembershipStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { logger } from "../../config/logger";
import { HttpError } from "../../middlewares/error-handler";
import { prisma } from "../../lib/prisma";
import type {
  MemberMembershipCancelInput,
  CustomerWizardInput,
  ListMemberQuery,
  MemberMembershipRenewInput,
  MemberPaymentCreateInput,
  MemberWizardInput,
} from "./member.schemas";
import {
  findAttendanceLogsByMember,
  findMemberByCode,
  findMemberByContact,
  findMemberById,
  findMemberWithDetails,
  findMembers as findMembersRepo,
  findMembershipsByMember,
  findPaymentsByMember,
  memberDetailsInclude,
  findMembershipPlan,
  findMemberFull,
} from "./member.repository";
import { findStaffGroupShiftsByIds, findStaffGroupWithShifts } from "../staff-groups/staff-group.repository";
import type { FullMemberProfile } from "../../shared/member.types";
import { deleteDeviceUser } from "../devices/deviceManager";
import { FULL_DEVICE_DATA_SCOPE } from "../devices/device-edition-scope";

type MemberWithDetails = Prisma.MemberGetPayload<{ include: typeof memberDetailsInclude }>;
type MemberFull = Prisma.MemberGetPayload<{ include: typeof import("./member.repository").memberFullInclude }>;
type TransactionClient = Prisma.TransactionClient;
type ShiftLikeInput = {
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays?: number[] | null;
  graceMinutes?: number | null;
  earlyAccessMinutes?: number | null;
  salaryType: Prisma.MemberShiftUncheckedCreateInput["salaryType"];
  salaryAmount: Prisma.MemberShiftUncheckedCreateInput["salaryAmount"];
  isActive?: boolean | null;
};
type ExtraShiftInput = {
  shiftId: string;
  rateOverride?: number | null;
  isActive?: boolean;
};
type PreparedShift = Prisma.MemberShiftCreateManyInput;
type MemberListItem = Awaited<ReturnType<typeof findMembersRepo>>["items"][number];

export type MemberActionContext = {
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

export type MembershipActionContext = MemberActionContext;

type MemberAuditAction = "member.created" | "member.updated" | "member.shifts.updated" | "member.deleted";

type MemberAuditInput = {
  action: MemberAuditAction;
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

type MembershipAuditInput = {
  action: "membership.created" | "membership.renewed" | "membership.updated" | "membership.cancelled";
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

type MembershipPaymentAuditInput = {
  targetId: string;
  beforeData: Prisma.InputJsonObject;
  afterData: Prisma.InputJsonObject;
  metadata: Prisma.InputJsonObject;
};

export async function listMembers(query: ListMemberQuery) {
  const { items, total } = await findMembersRepo(query);
  return {
    items: items.map((item) => ({
      ...item,
      status: resolveMemberListStatus(item),
    })),
    total,
    skip: query.skip,
    take: query.take,
  };
}

export async function createMember(input: MemberWizardInput, context: MemberActionContext): Promise<MemberWithDetails> {
  await ensureUniqueContact(input.email, input.phone);
  if (input.code) {
    await ensureUniqueCode(input.code);
  }
  const code = input.code ?? (await generateMemberCode());
  const data = buildMemberWriteData(input, code) as Prisma.MemberUncheckedCreateInput;

  const group = input.memberType === MemberType.STAFF && input.staffGroupId ? await ensureStaffGroupWithShifts(input.staffGroupId) : null;
  const extraShiftTemplates =
    input.memberType === MemberType.STAFF && input.extraShifts?.length
      ? await loadExtraShiftTemplates(input.extraShifts as ExtraShiftInput[])
      : [];

  if (input.memberType === MemberType.CUSTOMER) {
    return createCustomerMember(input as CustomerWizardInput, data, context);
  }

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({ data });
    await syncDeviceUser(tx, member.id, code);
    await upsertAccessPolicy(tx, member.id, input.access);
    await upsertOvertimePolicy(tx, member.id, input.overtime);
    const preparedShifts = prepareMemberShifts({
      memberId: member.id,
      ...(group?.shifts ? { groupShifts: group.shifts } : {}),
      ...(input.extraShifts ? { extraShifts: input.extraShifts as ExtraShiftInput[] } : {}),
      extraShiftTemplates,
      ...(input.shifts ? { customShifts: input.shifts } : {}),
    });
    await replaceShifts(tx, member.id, preparedShifts);
    await tx.staffProfile.upsert({
      where: { memberId: member.id },
      create: { memberId: member.id },
      update: {},
    });
    const refreshed = await tx.member.findUniqueOrThrow({ where: { id: member.id }, include: memberDetailsInclude });
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.created",
        targetId: member.id,
        afterData: toMemberAuditJson(refreshed),
        metadata: buildMemberCreateDeleteMetadata(refreshed),
      }),
    });
    return refreshed;
  });
}

export async function getMember(memberId: string): Promise<MemberWithDetails> {
  return ensureMemberDetails(memberId);
}

export async function getMemberFullProfile(memberId: string): Promise<FullMemberProfile> {
  const member = await findMemberFull(memberId);
  if (!member) {
    throw new HttpError(404, "Member not found", { memberId });
  }

  const isEmployee = member.memberType === MemberType.STAFF || member.isStaff;
  const paymentRows = member.payments ?? [];
  const appliedPaid = roundCurrency(
    paymentRows.reduce(
      (sum, p) => sum + (p.status === PaymentStatus.PAID && p.membershipId ? asAmount(p.amount) : 0),
      0
    )
  );
  const creditBalance = roundCurrency(
    paymentRows.reduce(
      (sum, p) => sum + (p.status === PaymentStatus.PAID && !p.membershipId ? asAmount(p.amount) : 0),
      0
    )
  );
  const totalDue = isEmployee ? 0 : roundCurrency((member.memberships ?? []).reduce((sum, m) => sum + asAmount(m.totalDue), 0));
  const outstandingBalance = Math.max(0, roundCurrency(totalDue - appliedPaid));
  const attendanceLogs = member.attendanceLogs ?? [];
  const attendanceDays = new Set(attendanceLogs.map((log) => new Date(log.recordedAt).toDateString())).size;

  return {
    member: {
      id: member.id,
      code: member.code,
      fingerId: member.fingerId ?? null,
      memberType: member.memberType,
      firstName: member.firstName,
      lastName: member.lastName,
      fatherName: member.fatherName,
      phone: member.phone,
      email: member.email,
      gender: member.gender,
      birthDate: member.birthDate,
      nationalId: member.nationalId,
      photoUrl: member.photoUrl,
      status: member.status,
      notes: member.notes,
      roleType: member.roleType,
      isStaff: member.isStaff,
      customTitle: member.customTitle,
      staffGroupId: member.staffGroupId,
      staffGroup: member.staffGroup
        ? {
            id: member.staffGroup.id,
            name: member.staffGroup.name,
            description: member.staffGroup.description,
            accessLevel: member.staffGroup.accessLevel,
            shifts: member.staffGroup.shifts.map((s) => ({
              id: s.id,
              shiftName: s.shiftName,
              shiftStart: s.shiftStart,
              shiftEnd: s.shiftEnd,
              weekdays: s.weekdays,
              graceMinutes: s.graceMinutes,
              earlyAccessMinutes: s.earlyAccessMinutes,
              salaryType: s.salaryType,
              salaryAmount: Number(s.salaryAmount),
              isActive: s.isActive,
            })),
          }
        : null,
    },
    ...(isEmployee
      ? {
          shifts:
            member.shifts?.map((shift) => ({
              id: shift.id,
              shiftId: shift.shiftId,
              shiftName: shift.shiftName,
              shiftStart: shift.shiftStart,
              shiftEnd: shift.shiftEnd,
              weekdays: shift.weekdays,
              graceMinutes: shift.graceMinutes,
              earlyAccessMinutes: shift.earlyAccessMinutes,
              salaryType: shift.salaryType,
              salaryAmount: Number(shift.salaryAmount),
              rateOverride: shift.rateOverride ? Number(shift.rateOverride) : null,
              isFromGroup: shift.isFromGroup,
              isActive: shift.isActive,
            })) ?? [],
        }
      : {}),
    overtimePolicy:
      isEmployee && member.overtimePolicy
        ? {
            id: member.overtimePolicy.id,
            allowOvertime: member.overtimePolicy.allowOvertime,
            overtimeRateType: member.overtimePolicy.overtimeRateType ?? null,
            overtimeAmount: member.overtimePolicy.overtimeAmount !== null ? Number(member.overtimePolicy.overtimeAmount) : null,
            maxOvertimePerDay:
              member.overtimePolicy.maxOvertimePerDay !== null ? Number(member.overtimePolicy.maxOvertimePerDay) : null,
          }
        : null,
    accessPolicy:
      isEmployee && member.accessPolicy
        ? {
            id: member.accessPolicy.id,
            allowedDays: member.accessPolicy.allowedDays ?? [],
            allowedTimeRanges:
              member.accessPolicy.rules?.reduce<Array<{ weekday: number; ranges: Array<{ from: string; to: string }> }>>(
                (acc, rule) => {
                  const existing = acc.find((entry) => entry.weekday === rule.weekday);
                  if (existing) {
                    existing.ranges.push({ from: rule.fromTime, to: rule.toTime });
                  } else {
                    acc.push({ weekday: rule.weekday, ranges: [{ from: rule.fromTime, to: rule.toTime }] });
                  }
                  return acc;
                },
                []
              ) ?? [],
            rules: member.accessPolicy.rules?.map((r) => ({
              id: r.id,
              weekday: r.weekday,
              fromTime: r.fromTime,
              toTime: r.toTime,
            })) ?? [],
            maxEntriesPerDay: (member.accessPolicy as any).maxEntriesPerDay ?? null,
          }
        : null,
    ...(!isEmployee
      ? {
          memberships:
            member.memberships?.map((m) => ({
              id: m.id,
              planId: m.planId,
              ...(m.plan ? { plan: { id: m.plan.id, name: m.plan.name, durationDays: m.plan.durationDays } } : {}),
              startDate: m.startDate,
              endDate: m.endDate,
              status: m.status,
              basePrice: Number(m.basePrice),
              discount: Number(m.discount ?? 0),
              totalDue: Number(m.totalDue ?? 0),
              totalPaid: Number(m.totalPaid ?? 0),
              activatedAt: m.activatedAt ?? null,
            })) ?? [],
        }
      : {}),
    payments:
      member.payments?.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        membershipId: p.membershipId ?? null,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        notes: p.notes,
        reference: p.reference,
      })) ?? [],
    attendanceLogs:
      member.attendanceLogs?.map((log) => ({
        id: log.id,
        recordedAt: log.recordedAt,
        entryType: log.entryType,
        source: log.source,
        deviceUserId: log.deviceUserId,
        isAuthorized: log.isAuthorized,
        reason: log.reason,
      })) ?? [],
    deviceUser: member.deviceUser
      ? {
          id: member.deviceUser.id,
          externalId: member.deviceUser.externalId,
          pin: member.deviceUser.pin,
          cardNumber: member.deviceUser.cardNumber,
          deviceId: member.deviceUser.deviceId,
          lastSyncedAt: member.deviceUser.lastSyncedAt,
        }
      : null,
    accessViolations:
      member.accessWarnings?.map((v) => ({
        id: v.id,
        occurredAt: v.occurredAt,
        reason: v.reason,
        notes: v.notes,
      })) ?? [],
    doorEvents:
      member.doorEvents?.map((d) => ({
        id: d.id,
        triggerType: d.triggerType,
        action: d.action,
        requestedAt: d.requestedAt,
        success: d.success,
        notes: d.notes,
      })) ?? [],
    aggregates: {
      totalPaid: appliedPaid,
      totalDue,
      outstandingBalance,
      creditBalance,
      attendanceDays,
      attendanceLogs: attendanceLogs.length,
      lateArrivals: 0,
      overtimeHours: 0,
    },
  };
}
export async function updateMember(
  memberId: string,
  input: MemberWizardInput,
  context: MemberActionContext
): Promise<MemberWithDetails> {
  await ensureMember(memberId);
  await ensureUniqueContact(input.email, input.phone, memberId);
  if (input.code) {
    await ensureUniqueCode(input.code, memberId);
  }

  const group = input.memberType === MemberType.STAFF && input.staffGroupId ? await ensureStaffGroupWithShifts(input.staffGroupId) : null;
  const extraShiftTemplates =
    input.memberType === MemberType.STAFF && input.extraShifts?.length
      ? await loadExtraShiftTemplates(input.extraShifts as ExtraShiftInput[])
      : [];

  if (input.memberType === MemberType.CUSTOMER) {
    return updateCustomerMember(memberId, input as CustomerWizardInput, context);
  }

  return prisma.$transaction(async (tx) => {
    const beforeMember = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: memberDetailsInclude });
    await tx.member.update({
      where: { id: memberId },
      data: buildMemberWriteData(input) as Prisma.MemberUpdateInput,
    });
    if (input.code) {
      await syncDeviceUser(tx, memberId, input.code);
    }
    await upsertAccessPolicy(tx, memberId, input.access);
    await upsertOvertimePolicy(tx, memberId, input.overtime);
    const preparedShifts = prepareMemberShifts({
      memberId,
      ...(group?.shifts ? { groupShifts: group.shifts } : {}),
      ...(input.extraShifts ? { extraShifts: input.extraShifts as ExtraShiftInput[] } : {}),
      extraShiftTemplates,
      ...(input.shifts ? { customShifts: input.shifts } : {}),
    });
    await replaceShifts(tx, memberId, preparedShifts);
    await tx.staffProfile.upsert({
      where: { memberId },
      create: { memberId },
      update: {},
    });
    const refreshed = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: memberDetailsInclude });
    await writeMemberUpdateAudits(tx, context, beforeMember, refreshed);
    return refreshed;
  });
}

export async function removeMember(memberId: string, context: MemberActionContext) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    include: memberDetailsInclude,
  });
  if (!member) {
    throw new HttpError(404, "Member not found", { memberId });
  }

  await prisma.$transaction(async (tx) => {
    await tx.member.delete({ where: { id: memberId } });
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.deleted",
        targetId: memberId,
        beforeData: toMemberAuditJson(member),
        metadata: buildMemberCreateDeleteMetadata(member),
      }),
    });
  });

  await removeDeviceUserFingerprints(member).catch((error) => {
    logger.warn("Failed to remove device user on member delete", {
      memberId,
      message: (error as Error).message,
    });
  });
}

export async function assignMemberShifts(
  memberId: string,
  payload: {
    staffGroupId?: string | null;
    extraShifts?: ExtraShiftInput[];
    shifts?: ShiftLikeInput[];
  },
  context: MemberActionContext
) {
  const member = await ensureMember(memberId);
  const group = payload.staffGroupId ? await ensureStaffGroupWithShifts(payload.staffGroupId) : null;
  const extraTemplates = payload.extraShifts?.length ? await loadExtraShiftTemplates(payload.extraShifts) : [];

  return prisma.$transaction(async (tx) => {
    const beforeMember = await tx.member.findUniqueOrThrow({ where: { id: member.id }, include: memberDetailsInclude });
    await tx.member.update({
      where: { id: member.id },
      data: { staffGroupId: payload.staffGroupId ?? null },
    });
    const preparedShifts = prepareMemberShifts({
      memberId: member.id,
      ...(group?.shifts ? { groupShifts: group.shifts } : {}),
      ...(payload.extraShifts ? { extraShifts: payload.extraShifts } : {}),
      extraShiftTemplates: extraTemplates,
      ...(payload.shifts ? { customShifts: payload.shifts } : {}),
    });
    await replaceShifts(tx, member.id, preparedShifts);
    const refreshed = await tx.member.findUniqueOrThrow({ where: { id: member.id }, include: memberDetailsInclude });
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.shifts.updated",
        targetId: member.id,
        beforeData: toMemberShiftAuditJson(beforeMember),
        afterData: toMemberShiftAuditJson(refreshed),
        metadata: {
          memberType: refreshed.memberType,
          shiftCountBefore: beforeMember.shifts.length,
          shiftCountAfter: refreshed.shifts.length,
        },
      }),
    });
    return refreshed;
  });
}

export async function listMemberMemberships(memberId: string) {
  await ensureMember(memberId);
  return findMembershipsByMember(memberId);
}

export async function createMemberMembership(
  memberId: string,
  input: MemberMembershipRenewInput,
  context: MembershipActionContext
) {
  const member = await ensureMember(memberId);
  if (member.memberType === MemberType.STAFF || member.isStaff) {
    throw new HttpError(400, "Membership renewals are only for customers", { memberId });
  }

  const plan = await findMembershipPlan(input.planId);
  if (!plan) {
    throw new HttpError(400, "Membership plan not found");
  }

  const periods = Math.max(1, Math.floor(input.periods ?? 1));
  const paidAmount = roundCurrency(Number(input.paidAmount ?? 0));
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (input.paidAt && Number.isNaN(paidAt.getTime())) {
    throw new HttpError(400, "Invalid paidAt timestamp", { paidAt: input.paidAt });
  }

  const totalDue = roundCurrency(asAmount(plan.basePrice) * periods);
  const notes = input.notes?.trim() || null;

  return prisma.$transaction(async (tx) => {
    await ensureNoOtherActiveMembership(tx, memberId, undefined, [MembershipStatus.ACTIVE, MembershipStatus.PENDING]);
    const lastMembership = await tx.membership.findFirst({
      where: { memberId },
      orderBy: { endDate: "desc" },
    });
    const now = new Date();
    const baseStart = lastMembership?.endDate ?? now;
    const startDate = baseStart > now ? baseStart : now;
    const endDate = addPlanDuration(startDate, plan.durationValue, plan.durationUnit ?? "MONTHS", periods);
    const membership = await tx.membership.create({
      data: {
        memberId,
        planId: plan.id,
        startDate,
        endDate,
        expiresAt: endDate,
        status: MembershipStatus.PENDING,
        basePrice: totalDue,
        discount: 0,
        totalDue,
        totalPaid: 0,
        autoRenew: false,
        notes,
        createdByAdminId: context.actor.id,
      },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
      },
    });

    let paymentEffect = { appliedAmount: 0, creditAmount: 0 };
    if (paidAmount > 0) {
      paymentEffect = await applyPaymentSplitToMembership(tx, {
        memberId,
        membershipId: membership.id,
        amount: paidAmount,
        paidAt,
        baseNote: "Membership renewal",
        userNotes: notes,
        recordedByAdminId: context.actor.id,
      });
    }

    await syncMembershipTotalPaidFromLedger(tx, membership.id, { allowLegacyFallback: false });
    const totals = await calculateMemberTotalsFromLedger(tx, memberId, { allowLegacyFallback: true });
    await syncCustomerProfileTotals(tx, memberId, totals);

    const refreshed = await tx.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
      },
    });
    await tx.auditLog.create({
      data: buildMembershipAuditData(context, {
        action: lastMembership ? "membership.renewed" : "membership.created",
        targetId: refreshed.id,
        afterData: toMembershipAuditJson(refreshed),
        metadata: {
          memberId,
          previousMembershipId: lastMembership?.id ?? "",
          periods,
          paidAmountRequested: paidAmount,
          appliedAmount: paymentEffect.appliedAmount,
          creditAmount: paymentEffect.creditAmount,
          memberTotalPaid: totals.totalPaid,
          memberTotalDebt: totals.totalDebt,
          memberCreditBalance: totals.creditBalance,
        },
      }),
    });

    return refreshed;
  });
}

export async function cancelMemberMembership(
  memberId: string,
  membershipId: string,
  input: MemberMembershipCancelInput,
  context: MembershipActionContext
) {
  await ensureMember(memberId);

  const refundAt = input.refundAt ? new Date(input.refundAt) : new Date();
  if (input.refundAt && Number.isNaN(refundAt.getTime())) {
    throw new HttpError(400, "Invalid refundAt timestamp", { refundAt: input.refundAt });
  }
  const notes = input.notes?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const membership = await tx.membership.findFirst({
      where: { id: membershipId, memberId },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
      },
    });
    if (!membership) {
      throw new HttpError(404, "Membership not found", { memberId, membershipId });
    }
    if (membership.status === MembershipStatus.CANCELLED) {
      throw new HttpError(400, "Membership already cancelled", { membershipId });
    }

    const paidSummary = await tx.payment.aggregate({
      where: { memberId, membershipId, status: PaymentStatus.PAID },
      _sum: { amount: true },
    });
    const refundableAmount = Math.max(0, roundCurrency(asAmount(paidSummary._sum.amount)));

    if (refundableAmount > 0) {
      await createPaymentRecord(tx, {
        memberId,
        membershipId,
        amount: -refundableAmount,
        paidAt: refundAt,
        notes: buildPaymentNotes("Membership cancellation refund", notes, null),
        recordedByAdminId: context.actor.id,
      });
    }

    const now = new Date();
    const currentNotes = membership.notes?.trim() || null;
    const cancellationNote = notes ? `Cancelled membership: ${notes}` : "Cancelled membership";
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        status: MembershipStatus.CANCELLED,
        endDate: membership.endDate > now ? now : membership.endDate,
        expiresAt: membership.expiresAt > now ? now : membership.expiresAt,
        basePrice: 0,
        discount: 0,
        totalDue: 0,
        notes: [currentNotes, cancellationNote].filter(Boolean).join(" | "),
      },
    });

    await syncMembershipTotalPaidFromLedger(tx, membership.id, { allowLegacyFallback: false });
    const totals = await calculateMemberTotalsFromLedger(tx, memberId, { allowLegacyFallback: true });
    await syncCustomerProfileTotals(tx, memberId, totals);

    const refreshed = await tx.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
      },
    });

    await tx.auditLog.create({
      data: buildMembershipAuditData(context, {
        action: "membership.cancelled",
        targetId: membership.id,
        beforeData: toMembershipAuditJson(membership),
        afterData: toMembershipAuditJson(refreshed),
        metadata: {
          memberId,
          refundedAmount: refundableAmount,
          memberTotalPaid: totals.totalPaid,
          memberTotalDebt: totals.totalDebt,
          memberCreditBalance: totals.creditBalance,
        },
      }),
    });

    return {
      membership: refreshed,
      refundedAmount: refundableAmount,
    };
  });
}

export async function listMemberPayments(memberId: string) {
  await ensureMember(memberId);
  return findPaymentsByMember(memberId);
}

export async function createMemberPayment(
  memberId: string,
  input: MemberPaymentCreateInput,
  context: MembershipActionContext
) {
  const member = await ensureMember(memberId);

  const amount = roundCurrency(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Payment amount must be greater than 0", { amount });
  }

  const membershipId = input.membershipId ?? null;

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    throw new HttpError(400, "Invalid paidAt timestamp", { paidAt: input.paidAt });
  }
  const notes = input.notes?.trim() || null;

  return prisma.$transaction(async (tx) => {
    let primaryPayment = null as Awaited<ReturnType<typeof createPaymentRecord>> | null;
    let appliedPayment = null as Awaited<ReturnType<typeof createPaymentRecord>> | null;
    let creditPayment = null as Awaited<ReturnType<typeof createPaymentRecord>> | null;
    let membershipBefore = null as Prisma.MembershipGetPayload<Record<string, never>> | null;
    let appliedAmount = 0;
    let creditAmount = 0;
    const totalsBefore = await calculateMemberTotalsFromLedger(tx, memberId, { allowLegacyFallback: true });

    if (membershipId) {
      const membership = await tx.membership.findFirst({ where: { id: membershipId, memberId } });
      if (!membership) {
        throw new HttpError(400, "Membership does not belong to member", { memberId, membershipId });
      }
      membershipBefore = membership;
      const split = await applyPaymentSplitToMembership(tx, {
        memberId,
        membershipId,
        amount,
        paidAt,
        baseNote: "Applied to membership",
        userNotes: notes,
        recordedByAdminId: context.actor.id,
      });
      primaryPayment = split.primaryPayment;
      appliedPayment = split.appliedPayment;
      creditPayment = split.creditPayment;
      appliedAmount = split.appliedAmount;
      creditAmount = split.creditAmount;
    } else {
      creditPayment = await createPaymentRecord(tx, {
        memberId,
        membershipId: null,
        amount,
        paidAt,
        notes: buildPaymentNotes("Member credit", notes, null),
        recordedByAdminId: context.actor.id,
      });
      primaryPayment = creditPayment;
      creditAmount = amount;
    }

    if (membershipId) {
      await syncMembershipTotalPaidFromLedger(tx, membershipId, { allowLegacyFallback: false });
    }

    const totalsAfter = await calculateMemberTotalsFromLedger(tx, memberId, { allowLegacyFallback: true });
    if (member.memberType !== MemberType.STAFF && !member.isStaff) {
      await syncCustomerProfileTotals(tx, memberId, totalsAfter);
    }

    if (!primaryPayment) {
      throw new HttpError(500, "Unable to create payment");
    }

    const membershipAfter = membershipId
      ? await tx.membership.findUnique({ where: { id: membershipId } })
      : null;
    const ledgerEntries: Prisma.InputJsonObject[] = [];
    const paymentIds: string[] = [];
    if (appliedPayment) {
      ledgerEntries.push(toMembershipPaymentAuditJson(appliedPayment));
      paymentIds.push(appliedPayment.id);
    }
    if (creditPayment && creditPayment.id !== appliedPayment?.id) {
      ledgerEntries.push(toMembershipPaymentAuditJson(creditPayment));
      paymentIds.push(creditPayment.id);
    }

    await tx.auditLog.create({
      data: buildMembershipPaymentAuditData(context, {
        targetId: primaryPayment.id,
        beforeData: toMembershipPaymentFinancialAuditJson(memberId, membershipBefore, totalsBefore),
        afterData: toMembershipPaymentFinancialAuditJson(memberId, membershipAfter, totalsAfter),
        metadata: {
          requestedAmount: amount,
          appliedAmount,
          creditAmount,
          primaryPaymentId: primaryPayment.id,
          appliedPaymentId: appliedPayment?.id ?? "",
          creditPaymentId: creditPayment?.id ?? "",
          paymentIds,
          method: primaryPayment.method,
          currency: primaryPayment.currency,
          reference: primaryPayment.reference ?? "",
          paidAt: primaryPayment.paidAt?.toISOString() ?? paidAt.toISOString(),
          ledgerEntries,
        },
      }),
    });
    return primaryPayment;
  });
}

export async function listMemberAttendance(memberId: string) {
  await ensureMember(memberId);
  return findAttendanceLogsByMember(memberId);
}

async function generateMemberCode(attempt = 0): Promise<string> {
  const prefix = "ECS";
  const random = Math.floor(1000 + Math.random() * 9000);
  const code = `${prefix}-${random}`.toUpperCase();

  const exists = await findMemberByCode(code);
  if (exists) {
    if (attempt > 5) {
      throw new Error("Unable to generate a unique member code.");
    }
    return generateMemberCode(attempt + 1);
  }
  return code;
}

async function ensureMember(memberId: string) {
  const member = await findMemberById(memberId);
  if (!member) {
    throw new HttpError(404, "Member not found", { memberId });
  }
  return member;
}

async function ensureMemberDetails(memberId: string) {
  const member = await findMemberWithDetails(memberId);
  if (!member) {
    throw new HttpError(404, "Member not found", { memberId });
  }
  return member;
}

async function ensureStaffGroupWithShifts(staffGroupId: string) {
  const group = await findStaffGroupWithShifts(staffGroupId);
  if (!group) {
    throw new HttpError(404, "Staff group not found", { staffGroupId });
  }
  if (!group.shifts || group.shifts.length === 0) {
    throw new HttpError(400, "Selected staff group has no shift templates", { staffGroupId });
  }
  return group;
}

async function removeDeviceUserFingerprints(member: {
  id: string;
  code: string;
  deviceUser: { externalId: number; deviceId: string | null } | null;
}) {
  const externalId =
    member.deviceUser?.externalId ??
    (Number.isInteger(Number(member.code)) ? Number(member.code) : null);
  if (externalId === null || externalId === undefined) {
    return;
  }
  if (!Number.isInteger(externalId) || externalId <= 0) {
    return;
  }

  const userId = String(externalId);
  const deviceIds = member.deviceUser?.deviceId
    ? [member.deviceUser.deviceId]
    : await listFingerprintDeviceIds();

  for (const deviceId of deviceIds) {
    try {
      await deleteDeviceUser(deviceId, { userId }, FULL_DEVICE_DATA_SCOPE);
    } catch (error) {
      logger.warn("Device user deletion failed", {
        memberId: member.id,
        deviceId,
        userId,
        message: (error as Error).message,
      });
    }
  }
}

async function listFingerprintDeviceIds(): Promise<string[]> {
  const devices = await prisma.device.findMany({
    where: {
      type: DeviceType.FINGERPRINT,
      connectionType: { in: [DeviceConnectionType.ZKTECO_PULL_SDK, DeviceConnectionType.NETWORK] },
      enabled: true,
    },
    select: { id: true },
  });
  return devices.map((device) => device.id);
}

async function ensureUniqueContact(email?: string, phone?: string, ignoreId?: string) {
  if (!email && !phone) return;
  const existing = await findMemberByContact(email, phone);
  if (existing && existing.id !== ignoreId) {
    throw new HttpError(409, "A member already exists with the provided phone/email.", {
      memberId: existing.id,
    });
  }
}

async function ensureUniqueCode(code: string, ignoreId?: string) {
  const existing = await findMemberByCode(code);
  if (existing && existing.id !== ignoreId) {
    throw new HttpError(409, "Member code already exists. Use a unique device/user ID.", { memberId: existing.id });
  }
}

async function syncDeviceUser(tx: TransactionClient, memberId: string, code: string) {
  const externalId = Number(code);
  if (!Number.isInteger(externalId) || externalId <= 0) {
    logger.warn("Member code is not a positive numeric device user ID; cannot sync DeviceUser", { memberId, code });
    return;
  }

  const deviceUserByMember = await tx.deviceUser.findUnique({
    where: { memberId },
    select: { id: true, externalId: true, memberId: true },
  });
  const deviceUserByExternalId = await tx.deviceUser.findUnique({
    where: { externalId },
    select: { id: true, externalId: true, memberId: true },
  });

  if (deviceUserByExternalId?.memberId && deviceUserByExternalId.memberId !== memberId) {
    throw new HttpError(
      409,
      `Device user ID ${externalId} is already linked to another member. Save was not completed. Use a different member code or remove the existing device link first.`,
      {
        code: String(externalId),
        memberId,
        conflictingMemberId: deviceUserByExternalId.memberId,
      }
    );
  }

  if (deviceUserByMember && deviceUserByExternalId && deviceUserByMember.id !== deviceUserByExternalId.id) {
    await tx.deviceUser.update({
      where: { id: deviceUserByMember.id },
      data: { memberId: null },
    });
    await tx.deviceUser.update({
      where: { id: deviceUserByExternalId.id },
      data: { memberId },
    });
    return;
  }

  if (deviceUserByMember) {
    await tx.deviceUser.update({
      where: { id: deviceUserByMember.id },
      data: { externalId, memberId },
    });
    return;
  }

  if (deviceUserByExternalId) {
    await tx.deviceUser.update({
      where: { id: deviceUserByExternalId.id },
      data: { memberId },
    });
    return;
  }

  await tx.deviceUser.create({ data: { externalId, memberId } });
}

export const memberServiceTestHooks = {
  syncDeviceUser,
  calculateMemberTotalsFromLedger,
};

function buildMemberWriteData(input: MemberWizardInput, code?: string): Prisma.MemberUncheckedCreateInput | Prisma.MemberUpdateInput {
  return {
    ...(code ? { code } : input.code ? { code: input.code } : {}),
    ...(input.fingerId !== undefined ? { fingerId: input.fingerId } : {}),
    status: input.status ?? MemberStatus.ACTIVE,
    memberType: input.memberType,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    fatherName: input.fatherName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    gender: input.gender ?? null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    nationalId: input.nationalId ?? null,
    photoUrl: input.photoUrl ?? null,
    notes: input.notes ?? null,
    roleType: input.role.roleType,
    isStaff: input.role.isStaff,
    customTitle: input.role.customTitle ?? null,
    staffGroupId: input.memberType === MemberType.STAFF ? input.staffGroupId ?? null : null,
  };
}

async function upsertAccessPolicy(tx: TransactionClient, memberId: string, access: MemberWizardInput["access"]) {
  const allowedDays = Array.from(new Set(access.allowedDays)).sort((a, b) => a - b);
  const normalizedRules =
    access.allowedTimeRanges
      ?.filter((entry) => allowedDays.includes(entry.weekday))
      .flatMap((entry) => entry.ranges.map((range) => ({ weekday: entry.weekday, fromTime: range.from, toTime: range.to }))) ?? [];

  await tx.memberAccessPolicy.upsert({
    where: { memberId },
    create: {
      memberId,
      allowedDays,
      rules: { create: normalizedRules },
      maxEntriesPerDay: (access as any).maxEntriesPerDay ?? null,
    },
    update: {
      allowedDays,
      rules: {
        deleteMany: {},
        create: normalizedRules,
      },
      maxEntriesPerDay: (access as any).maxEntriesPerDay ?? null,
    },
  });
}

async function upsertOvertimePolicy(tx: TransactionClient, memberId: string, overtime: MemberWizardInput["overtime"]) {
  const allowOvertime = overtime.allowOvertime;
  const overtimeRateType = allowOvertime ? overtime.overtimeRateType ?? null : null;
  const overtimeAmount = allowOvertime ? overtime.overtimeAmount ?? null : null;
  const maxOvertimePerDay = allowOvertime ? overtime.maxOvertimePerDay ?? null : null;

  await tx.memberOvertimePolicy.upsert({
    where: { memberId },
    create: {
      memberId,
      allowOvertime,
      overtimeRateType,
      overtimeAmount,
      maxOvertimePerDay,
    },
    update: {
      allowOvertime,
      overtimeRateType,
      overtimeAmount,
      maxOvertimePerDay,
    },
  });
}

async function replaceShifts(tx: TransactionClient, memberId: string, shifts: PreparedShift[] | undefined | null) {
  await tx.memberShift.deleteMany({ where: { memberId } });
  if (!shifts || shifts.length === 0) {
    return;
  }
  await tx.memberShift.createMany({
    data: shifts.map((shift) => ({ ...shift, memberId })),
  });
}

async function createCustomerMember(
  input: CustomerWizardInput,
  baseData: Prisma.MemberUncheckedCreateInput,
  context: MembershipActionContext
): Promise<MemberWithDetails> {
  const plan = await findMembershipPlan(input.membership.planId);
  if (!plan) {
    throw new HttpError(400, "Membership plan not found");
  }
  const startDate = new Date(input.membership.startDate);
  const endDate = input.membership.endDate ? new Date(input.membership.endDate) : addDays(startDate, plan.durationDays);
  const totalDue = roundCurrency(Math.max(0, input.membership.price - (input.membership.discount ?? 0)));
  const paidAmount = roundCurrency(input.membership.paidAmount ?? 0);

  return prisma.$transaction(async (tx) => {
    const member = await tx.member.create({
      data: {
        ...baseData,
        memberType: MemberType.CUSTOMER,
      },
    });
    await syncDeviceUser(tx, member.id, baseData.code as string);
    const accessPolicy = await tx.memberAccessPolicy.upsert({
      where: { memberId: member.id },
      create: {
        memberId: member.id,
        allowedDays: Array.from(new Set(input.customerAccess.allowedDays)).sort((a, b) => a - b),
        maxEntriesPerDay: input.customerAccess.maxEntriesPerDay ?? null,
        rules: {
          create:
            input.customerAccess.allowedTimeRanges?.flatMap((entry) =>
              entry.ranges.map((range) => ({ weekday: entry.weekday, fromTime: range.from, toTime: range.to }))
            ) ?? [],
        },
      },
      update: {},
    });
    const membership = await tx.membership.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        startDate,
        endDate,
        expiresAt: endDate,
        status: MembershipStatus.PENDING,
        basePrice: input.membership.price,
        discount: input.membership.discount ?? 0,
        totalDue,
        totalPaid: 0,
        autoRenew: false,
        createdByAdminId: context.actor.id,
      },
    });
    let paymentEffect = { appliedAmount: 0, creditAmount: 0 };
    if (paidAmount > 0) {
      paymentEffect = await applyPaymentSplitToMembership(tx, {
        memberId: member.id,
        membershipId: membership.id,
        amount: paidAmount,
        paidAt: new Date(),
        baseNote: "Initial membership payment",
        userNotes: null,
        recordedByAdminId: context.actor.id,
      });
    }
    await syncMembershipTotalPaidFromLedger(tx, membership.id, { allowLegacyFallback: false });
    const totals = await calculateMemberTotalsFromLedger(tx, member.id);
    await tx.customerProfile.create({
      data: {
        memberId: member.id,
        totalPaidAmount: toWholeAmount(totals.totalPaid),
        totalDebtAmount: toWholeAmount(totals.totalDebt),
        defaultAccessPolicyId: accessPolicy.id,
      },
    });
    await upsertOvertimePolicy(tx, member.id, input.overtime);
    const preparedShifts = prepareMemberShifts({
      memberId: member.id,
      extraShiftTemplates: [],
      ...(input.shifts ? { customShifts: input.shifts } : {}),
    });
    await replaceShifts(tx, member.id, preparedShifts);
    const refreshedMembership = await tx.membership.findUniqueOrThrow({
      where: { id: membership.id },
      include: {
        plan: { select: { id: true, name: true, durationDays: true } },
      },
    });
    await tx.auditLog.create({
      data: buildMembershipAuditData(context, {
        action: "membership.created",
        targetId: membership.id,
        afterData: toMembershipAuditJson(refreshedMembership),
        metadata: {
          memberId: member.id,
          paidAmountRequested: paidAmount,
          appliedAmount: paymentEffect.appliedAmount,
          creditAmount: paymentEffect.creditAmount,
          memberTotalPaid: totals.totalPaid,
          memberTotalDebt: totals.totalDebt,
          memberCreditBalance: totals.creditBalance,
        },
      }),
    });
    const refreshed = await tx.member.findUniqueOrThrow({ where: { id: member.id }, include: memberDetailsInclude });
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.created",
        targetId: member.id,
        afterData: toMemberAuditJson(refreshed),
        metadata: buildMemberCreateDeleteMetadata(refreshed),
      }),
    });
    return refreshed;
  });
}

async function updateCustomerMember(
  memberId: string,
  input: CustomerWizardInput,
  context: MemberActionContext
): Promise<MemberWithDetails> {
  const plan = await findMembershipPlan(input.membership.planId);
  if (!plan) {
    throw new HttpError(400, "Membership plan not found");
  }
  const startDate = new Date(input.membership.startDate);
  const endDate = input.membership.endDate ? new Date(input.membership.endDate) : addDays(startDate, plan.durationDays);
  const totalDue = roundCurrency(Math.max(0, input.membership.price - (input.membership.discount ?? 0)));
  const paidAmount = roundCurrency(input.membership.paidAmount ?? 0);

  return prisma.$transaction(async (tx) => {
    const beforeMember = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: memberDetailsInclude });
    await tx.member.update({
      where: { id: memberId },
      data: { ...buildMemberWriteData(input), memberType: MemberType.CUSTOMER },
    });
    if (input.code) {
      await ensureUniqueCode(input.code, memberId);
      await syncDeviceUser(tx, memberId, input.code);
    }
    await upsertAccessPolicy(tx, memberId, input.customerAccess);
    await upsertOvertimePolicy(tx, memberId, input.overtime);
    const preparedShifts = prepareMemberShifts({
      memberId,
      extraShiftTemplates: [],
      ...(input.shifts ? { customShifts: input.shifts } : {}),
    });
    await replaceShifts(tx, memberId, preparedShifts);
    const existingMembership = await tx.membership.findFirst({
      where: { memberId },
      orderBy: { createdAt: "desc" },
      include: { plan: { select: { id: true, name: true, durationDays: true } } },
    });
    await ensureNoOtherActiveMembership(tx, memberId, existingMembership?.id);
    let membershipId: string;
    if (existingMembership) {
      await tx.membership.update({
        where: { id: existingMembership.id },
        data: {
          planId: plan.id,
          startDate,
          endDate,
          expiresAt: endDate,
          status: existingMembership.status ?? MembershipStatus.PENDING,
          basePrice: input.membership.price,
          discount: input.membership.discount ?? 0,
          totalDue,
          totalPaid: existingMembership.totalPaid ?? 0,
        },
      });
      membershipId = existingMembership.id;
    } else {
      const createdMembership = await tx.membership.create({
        data: {
          memberId,
          planId: plan.id,
          startDate,
          endDate,
          expiresAt: endDate,
          status: MembershipStatus.PENDING,
          basePrice: input.membership.price,
          discount: input.membership.discount ?? 0,
          totalDue,
          totalPaid: 0,
          autoRenew: false,
          createdByAdminId: context.actor.id,
        },
      });
      membershipId = createdMembership.id;
    }
    const existingPayments = await calculateMembershipPaymentTotals(tx, membershipId);
    let paymentEffect = { appliedAmount: 0, creditAmount: 0 };
    if (paidAmount > 0 && !existingPayments.hasPayments) {
      paymentEffect = await applyPaymentSplitToMembership(tx, {
        memberId,
        membershipId,
        amount: paidAmount,
        paidAt: new Date(),
        baseNote: "Initial membership payment",
        userNotes: null,
        recordedByAdminId: context.actor.id,
      });
    }
    await syncMembershipTotalPaidFromLedger(tx, membershipId, { allowLegacyFallback: true });
    const totals = await calculateMemberTotalsFromLedger(tx, memberId, { allowLegacyFallback: true });
    await syncCustomerProfileTotals(tx, memberId, totals);
    const refreshedMembership = await tx.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: { plan: { select: { id: true, name: true, durationDays: true } } },
    });
    const auditInput: MembershipAuditInput = {
      action: existingMembership ? "membership.updated" : "membership.created",
      targetId: membershipId,
      afterData: toMembershipAuditJson(refreshedMembership),
      metadata: {
        memberId,
        paidAmountRequested: paidAmount,
        appliedAmount: paymentEffect.appliedAmount,
        creditAmount: paymentEffect.creditAmount,
        memberTotalPaid: totals.totalPaid,
        memberTotalDebt: totals.totalDebt,
        memberCreditBalance: totals.creditBalance,
      },
    };
    if (existingMembership) {
      auditInput.beforeData = toMembershipAuditJson(existingMembership);
    }
    await tx.auditLog.create({ data: buildMembershipAuditData(context, auditInput) });
    const refreshed = await tx.member.findUniqueOrThrow({ where: { id: memberId }, include: memberDetailsInclude });
    await writeMemberUpdateAudits(tx, context, beforeMember, refreshed);
    return refreshed;
  });
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addPlanDuration(start: Date, durationValue: number, unit: string, periods: number) {
  const total = Math.max(1, durationValue) * Math.max(1, periods);
  if (unit === "DAYS") {
    return addDays(start, total);
  }
  return addMonths(start, total);
}

async function ensureNoOtherActiveMembership(
  tx: TransactionClient,
  memberId: string,
  ignoreMembershipId?: string,
  statuses: MembershipStatus[] = [MembershipStatus.ACTIVE]
) {
  const now = new Date();
  const existing = await tx.membership.findFirst({
    where: {
      memberId,
      status: { in: statuses },
      endDate: { gte: now },
      ...(ignoreMembershipId ? { id: { not: ignoreMembershipId } } : {}),
    },
  });
  if (existing) {
    throw new HttpError(400, "Member already has an active membership", {
      memberId,
      membershipId: existing.id,
    });
  }
}

function resolveMemberListStatus(member: MemberListItem): MemberStatus {
  if (member.status === MemberStatus.BLOCKED || member.status === MemberStatus.DEBTOR || member.status === MemberStatus.EXPIRED) {
    return member.status;
  }

  const memberType = member.memberType ?? (member.isStaff ? MemberType.STAFF : MemberType.CUSTOMER);
  if (memberType !== MemberType.CUSTOMER) {
    return member.status;
  }

  const memberships = Array.isArray(member.memberships) ? member.memberships : [];
  if (memberships.length === 0) {
    return member.status;
  }

  const now = new Date();
  const hasCurrentMembership = memberships.some(
    (membership) =>
      (membership.status === MembershipStatus.ACTIVE || membership.status === MembershipStatus.PENDING) &&
      membership.endDate >= now
  );

  if (hasCurrentMembership) {
    return MemberStatus.ACTIVE;
  }

  const hasExpiredMembership = memberships.some((membership) => membership.endDate < now);
  if (hasExpiredMembership) {
    return MemberStatus.EXPIRED;
  }

  return member.status;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function asAmount(value: Prisma.Decimal | number | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function toWholeAmount(value: number) {
  return Math.round(value);
}

async function writeMemberUpdateAudits(
  tx: TransactionClient,
  context: MemberActionContext,
  beforeMember: MemberWithDetails,
  afterMember: MemberWithDetails
) {
  const changedFields = getChangedMemberFields(beforeMember, afterMember);
  if (changedFields.length > 0) {
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.updated",
        targetId: afterMember.id,
        beforeData: toMemberAuditJson(beforeMember),
        afterData: toMemberAuditJson(afterMember),
        metadata: { changedFields },
      }),
    });
  }

  const beforeShifts = toMemberShiftAuditJson(beforeMember);
  const afterShifts = toMemberShiftAuditJson(afterMember);
  if (stableJson(beforeShifts) !== stableJson(afterShifts)) {
    await tx.auditLog.create({
      data: buildMemberAuditData(context, {
        action: "member.shifts.updated",
        targetId: afterMember.id,
        beforeData: beforeShifts,
        afterData: afterShifts,
        metadata: {
          memberType: afterMember.memberType,
          shiftCountBefore: beforeMember.shifts.length,
          shiftCountAfter: afterMember.shifts.length,
        },
      }),
    });
  }
}

function buildMemberAuditData(
  context: MemberActionContext,
  input: MemberAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: "Member",
    targetId: input.targetId,
    success: true,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.afterData) data.afterData = input.afterData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toMemberAuditJson(member: MemberWithDetails): Prisma.InputJsonObject {
  const accessRules = (member.accessPolicy?.rules ?? [])
    .map((rule) => ({ weekday: rule.weekday, fromTime: rule.fromTime, toTime: rule.toTime }))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)));

  return {
    id: member.id,
    code: member.code,
    memberType: member.memberType,
    status: member.status,
    roleType: member.roleType ?? "",
    isStaff: member.isStaff,
    staffGroupId: member.staffGroupId ?? "",
    archivedAt: member.archivedAt?.toISOString() ?? "",
    shiftCount: member.shifts.length,
    hasDeviceUser: Boolean(member.deviceUser),
    accessPolicy: member.accessPolicy
      ? {
          allowedDays: [...member.accessPolicy.allowedDays].sort((a, b) => a - b),
          maxEntriesPerDay: member.accessPolicy.maxEntriesPerDay ?? "",
          rules: accessRules,
        }
      : {},
    overtimePolicy: member.overtimePolicy
      ? {
          allowOvertime: member.overtimePolicy.allowOvertime,
          overtimeRateType: member.overtimePolicy.overtimeRateType ?? "",
          overtimeAmount:
            member.overtimePolicy.overtimeAmount === null ? "" : asAmount(member.overtimePolicy.overtimeAmount),
          maxOvertimePerDay:
            member.overtimePolicy.maxOvertimePerDay === null
              ? ""
              : asAmount(member.overtimePolicy.maxOvertimePerDay),
        }
      : {},
  };
}

function toMemberShiftAuditJson(member: MemberWithDetails): Prisma.InputJsonObject {
  const shifts = member.shifts
    .map((shift) => ({
      templateShiftId: shift.shiftId ?? "",
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: [...shift.weekdays].sort((a, b) => a - b),
      graceMinutes: shift.graceMinutes,
      earlyAccessMinutes: shift.earlyAccessMinutes,
      salaryType: shift.salaryType,
      salaryAmount: asAmount(shift.salaryAmount),
      rateOverride: shift.rateOverride === null ? "" : asAmount(shift.rateOverride),
      isFromGroup: shift.isFromGroup,
      isActive: shift.isActive,
    }))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)));

  return {
    memberId: member.id,
    memberType: member.memberType,
    staffGroupId: member.staffGroupId ?? "",
    shifts,
  };
}

function buildMemberCreateDeleteMetadata(member: MemberWithDetails): Prisma.InputJsonObject {
  return {
    memberType: member.memberType,
    status: member.status,
    shiftCount: member.shifts.length,
    hasDeviceLink: Boolean(member.deviceUser),
  };
}

function getChangedMemberFields(beforeMember: MemberWithDetails, afterMember: MemberWithDetails) {
  const values: Array<[string, unknown, unknown]> = [
    ["code", beforeMember.code, afterMember.code],
    ["fingerId", beforeMember.fingerId, afterMember.fingerId],
    ["memberType", beforeMember.memberType, afterMember.memberType],
    ["firstName", beforeMember.firstName, afterMember.firstName],
    ["lastName", beforeMember.lastName, afterMember.lastName],
    ["fatherName", beforeMember.fatherName, afterMember.fatherName],
    ["phone", beforeMember.phone, afterMember.phone],
    ["email", beforeMember.email, afterMember.email],
    ["gender", beforeMember.gender, afterMember.gender],
    ["birthDate", beforeMember.birthDate?.toISOString() ?? null, afterMember.birthDate?.toISOString() ?? null],
    ["nationalId", beforeMember.nationalId, afterMember.nationalId],
    ["photoUrl", beforeMember.photoUrl, afterMember.photoUrl],
    ["status", beforeMember.status, afterMember.status],
    ["isBlacklisted", beforeMember.isBlacklisted, afterMember.isBlacklisted],
    ["notes", beforeMember.notes, afterMember.notes],
    ["roleType", beforeMember.roleType, afterMember.roleType],
    ["isStaff", beforeMember.isStaff, afterMember.isStaff],
    ["customTitle", beforeMember.customTitle, afterMember.customTitle],
    ["staffGroupId", beforeMember.staffGroupId, afterMember.staffGroupId],
    ["archivedAt", beforeMember.archivedAt?.toISOString() ?? null, afterMember.archivedAt?.toISOString() ?? null],
    ["accessPolicy", toMemberAuditJson(beforeMember)["accessPolicy"], toMemberAuditJson(afterMember)["accessPolicy"]],
    [
      "overtimePolicy",
      toMemberAuditJson(beforeMember)["overtimePolicy"],
      toMemberAuditJson(afterMember)["overtimePolicy"],
    ],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => stableJson(beforeValue) !== stableJson(afterValue))
    .map(([field]) => field);
}

function stableJson(value: unknown) {
  return JSON.stringify(value);
}

function toMembershipAuditJson(membership: {
  id: string;
  memberId: string;
  planId: string;
  startDate: Date;
  endDate: Date;
  expiresAt: Date;
  status: MembershipStatus;
  basePrice: Prisma.Decimal | number;
  discount: Prisma.Decimal | number;
  totalDue: Prisma.Decimal | number;
  totalPaid: Prisma.Decimal | number;
  autoRenew: boolean;
  activatedAt: Date | null;
  plan?: { id: string; name: string; durationDays: number } | null;
}): Prisma.InputJsonObject {
  return {
    id: membership.id,
    memberId: membership.memberId,
    planId: membership.planId,
    planName: membership.plan?.name ?? "",
    startDate: membership.startDate.toISOString(),
    endDate: membership.endDate.toISOString(),
    expiresAt: membership.expiresAt.toISOString(),
    status: membership.status,
    basePrice: asAmount(membership.basePrice),
    discount: asAmount(membership.discount),
    totalDue: asAmount(membership.totalDue),
    totalPaid: asAmount(membership.totalPaid),
    autoRenew: membership.autoRenew,
    activatedAt: membership.activatedAt?.toISOString() ?? "",
  };
}

function buildMembershipAuditData(
  context: MembershipActionContext,
  input: MembershipAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: "Membership",
    targetId: input.targetId,
    success: true,
    afterData: input.afterData,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toMembershipPaymentAuditJson(
  payment: Awaited<ReturnType<typeof createPaymentRecord>>
): Prisma.InputJsonObject {
  return {
    id: payment.id,
    memberId: payment.memberId,
    membershipId: payment.membershipId ?? "",
    amount: asAmount(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    reference: payment.reference ?? "",
    paidAt: payment.paidAt?.toISOString() ?? "",
  };
}

function toMembershipPaymentFinancialAuditJson(
  memberId: string,
  membership: {
    id: string;
    status: MembershipStatus;
    totalDue: Prisma.Decimal | number;
    totalPaid: Prisma.Decimal | number;
  } | null,
  totals: {
    totalPaid: number;
    totalDue: number;
    totalDebt: number;
    creditBalance: number;
  }
): Prisma.InputJsonObject {
  return {
    memberId,
    membershipId: membership?.id ?? "",
    membershipStatus: membership?.status ?? "",
    membershipTotalDue: asAmount(membership?.totalDue),
    membershipTotalPaid: asAmount(membership?.totalPaid),
    memberTotalDue: totals.totalDue,
    memberTotalPaid: totals.totalPaid,
    memberTotalDebt: totals.totalDebt,
    memberCreditBalance: totals.creditBalance,
  };
}

function buildMembershipPaymentAuditData(
  context: MembershipActionContext,
  input: MembershipPaymentAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: "membership.payment.recorded",
    targetType: "Payment",
    targetId: input.targetId,
    success: true,
    beforeData: input.beforeData,
    afterData: input.afterData,
    metadata: input.metadata,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  return data;
}

async function createPaymentRecord(
  tx: TransactionClient,
  input: {
    memberId: string;
    membershipId: string | null;
    amount: number;
    paidAt: Date;
    notes: string | null;
    recordedByAdminId: string | null;
  }
) {
  const paymentId = generatePaymentId();
  const reference = buildReceiptNo(paymentId, input.paidAt);
  return tx.payment.create({
    data: {
      id: paymentId,
      memberId: input.memberId,
      membershipId: input.membershipId,
      amount: input.amount,
      currency: "AFN",
      method: "CASH",
      paidAt: input.paidAt,
      reference,
      notes: input.notes ?? null,
      recordedByAdminId: input.recordedByAdminId ?? null,
    },
  });
}

async function calculateMembershipPaymentTotals(tx: TransactionClient, membershipId: string) {
  const summary = await tx.payment.aggregate({
    where: { membershipId, status: PaymentStatus.PAID },
    _sum: { amount: true },
    _count: { _all: true },
  });
  const totalPaid = roundCurrency(asAmount(summary._sum.amount));
  const hasPayments = (summary._count?._all ?? 0) > 0;
  return { totalPaid, hasPayments };
}

async function applyPaymentSplitToMembership(
  tx: TransactionClient,
  input: {
    memberId: string;
    membershipId: string;
    amount: number;
    paidAt: Date;
    baseNote: string;
    userNotes: string | null;
    recordedByAdminId?: string | null;
  }
) {
  const membership = await tx.membership.findUnique({
    where: { id: input.membershipId },
    select: { basePrice: true, discount: true },
  });
  if (!membership) {
    throw new HttpError(400, "Membership not found", { membershipId: input.membershipId });
  }

  const totalDue = roundCurrency(Math.max(0, asAmount(membership.basePrice) - asAmount(membership.discount)));
  const paidBefore = (await calculateMembershipPaymentTotals(tx, input.membershipId)).totalPaid;
  const remaining = Math.max(0, roundCurrency(totalDue - paidBefore));
  const appliedAmount = remaining > 0 ? Math.min(input.amount, remaining) : 0;
  const creditAmount = roundCurrency(input.amount - appliedAmount);
  const isSplit = appliedAmount > 0 && creditAmount > 0;

  let primaryPayment: Awaited<ReturnType<typeof createPaymentRecord>> | null = null;
  let appliedPayment: Awaited<ReturnType<typeof createPaymentRecord>> | null = null;
  let creditPayment: Awaited<ReturnType<typeof createPaymentRecord>> | null = null;

  if (appliedAmount > 0) {
    appliedPayment = await createPaymentRecord(tx, {
      memberId: input.memberId,
      membershipId: input.membershipId,
      amount: appliedAmount,
      paidAt: input.paidAt,
      notes: buildPaymentNotes(input.baseNote, input.userNotes, isSplit ? "Split from overpayment" : null),
      recordedByAdminId: input.recordedByAdminId ?? null,
    });
    primaryPayment = appliedPayment;
  }

  if (creditAmount > 0) {
    creditPayment = await createPaymentRecord(tx, {
      memberId: input.memberId,
      membershipId: null,
      amount: creditAmount,
      paidAt: input.paidAt,
      notes: buildPaymentNotes(
        "Member credit",
        input.userNotes,
        appliedAmount > 0 ? "Split from overpayment" : "Membership fully paid"
      ),
      recordedByAdminId: input.recordedByAdminId ?? null,
    });
    if (!primaryPayment) {
      primaryPayment = creditPayment;
    }
  }

  if (!primaryPayment) {
    throw new HttpError(400, "Payment amount results in no ledger entries", { amount: input.amount });
  }

  return { primaryPayment, appliedPayment, creditPayment, appliedAmount, creditAmount };
}

async function calculateMemberTotalsFromLedger(
  tx: TransactionClient,
  memberId: string,
  options: { allowLegacyFallback?: boolean } = {}
) {
  if (options.allowLegacyFallback) {
    const [memberships, creditSummary] = await Promise.all([
      tx.membership.findMany({
        where: { memberId },
        select: {
          totalDue: true,
          totalPaid: true,
          payments: {
            where: { status: PaymentStatus.PAID },
            select: { amount: true },
          },
        },
      }),
      tx.payment.aggregate({
        where: { memberId, membershipId: null, status: PaymentStatus.PAID },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);

    let totalDue = 0;
    let totalPaid = 0;
    let hasAppliedPayments = false;

    memberships.forEach((membership) => {
      totalDue += asAmount(membership.totalDue);
      if (membership.payments.length > 0) {
        hasAppliedPayments = true;
        totalPaid += membership.payments.reduce((sum, payment) => sum + asAmount(payment.amount), 0);
      } else {
        totalPaid += asAmount(membership.totalPaid);
      }
    });

    totalDue = roundCurrency(totalDue);
    totalPaid = roundCurrency(totalPaid);
    const creditBalance = roundCurrency(asAmount(creditSummary._sum.amount));
    const totalDebt = Math.max(0, roundCurrency(totalDue - totalPaid));
    return { totalPaid, totalDue, totalDebt, creditBalance, hasAppliedPayments };
  }

  const [appliedSummary, creditSummary, dueSummary] = await Promise.all([
    tx.payment.aggregate({
      where: { memberId, membershipId: { not: null }, status: PaymentStatus.PAID },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    tx.payment.aggregate({
      where: { memberId, membershipId: null, status: PaymentStatus.PAID },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    tx.membership.aggregate({
      where: { memberId },
      _sum: { totalDue: true },
    }),
  ]);
  const totalPaid = roundCurrency(asAmount(appliedSummary._sum.amount));
  const creditBalance = roundCurrency(asAmount(creditSummary._sum.amount));
  const totalDue = roundCurrency(asAmount(dueSummary._sum.totalDue));
  const totalDebt = Math.max(0, roundCurrency(totalDue - totalPaid));
  const hasAppliedPayments = (appliedSummary._count?._all ?? 0) > 0;
  return { totalPaid, totalDue, totalDebt, creditBalance, hasAppliedPayments };
}

async function syncMembershipTotalPaidFromLedger(
  tx: TransactionClient,
  membershipId: string,
  options: { allowLegacyFallback: boolean }
) {
  const totals = await calculateMembershipPaymentTotals(tx, membershipId);
  if (!totals.hasPayments && options.allowLegacyFallback) {
    return totals;
  }
  await tx.membership.update({
    where: { id: membershipId },
    data: { totalPaid: totals.totalPaid },
  });
  return totals;
}

async function syncCustomerProfileTotals(
  tx: TransactionClient,
  memberId: string,
  totals: { totalPaid: number; totalDebt: number; creditBalance: number; hasAppliedPayments: boolean }
) {
  await tx.customerProfile.upsert({
    where: { memberId },
    create: {
      memberId,
      totalPaidAmount: toWholeAmount(totals.totalPaid),
      totalDebtAmount: toWholeAmount(totals.totalDebt),
    },
    update: {
      totalPaidAmount: toWholeAmount(totals.totalPaid),
      totalDebtAmount: toWholeAmount(totals.totalDebt),
    },
  });
}

function buildPaymentNotes(baseNote: string, userNotes: string | null, suffix: string | null) {
  const parts = [baseNote];
  if (suffix) {
    parts.push(suffix);
  }
  if (userNotes) {
    parts.push(userNotes);
  }
  return parts.join(" | ");
}

function generatePaymentId() {
  return randomUUID().replace(/-/g, "");
}

function buildReceiptNo(paymentId: string, paidAt: Date) {
  const dateStamp = formatDateStamp(paidAt);
  const shortId = paymentId.slice(-8);
  return `ECS-${dateStamp}-${shortId.toUpperCase()}`;
}

function formatDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function prepareMemberShifts(params: {
  memberId: string;
  groupShifts?: (ShiftLikeInput & { id: string })[] | null;
  extraShifts?: ExtraShiftInput[] | undefined;
  extraShiftTemplates: (ShiftLikeInput & { id: string })[];
  customShifts?: ShiftLikeInput[] | undefined;
}): PreparedShift[] {
  const { memberId, groupShifts, extraShifts, extraShiftTemplates, customShifts } = params;
  const defaultWeekdays = [0, 1, 2, 3, 4, 5, 6];

  const prepared: PreparedShift[] = [];

  // Group shifts (read-only defaults)
  (groupShifts ?? []).forEach((shift) => {
    prepared.push({
      memberId,
      shiftId: shift.id,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays ?? defaultWeekdays,
      graceMinutes: shift.graceMinutes ?? 0,
      earlyAccessMinutes: shift.earlyAccessMinutes ?? 15,
      salaryType: shift.salaryType,
      salaryAmount: shift.salaryAmount,
      rateOverride: null,
      isFromGroup: true,
      isActive: shift.isActive ?? true,
    });
  });

  // Extra shifts selected from templates
  const extraById = new Map<string, ExtraShiftInput>();
  (extraShifts ?? []).forEach((s) => extraById.set(s.shiftId, s));
  extraShiftTemplates.forEach((template) => {
    const extraConfig = extraById.get(template.id);
    const override = extraConfig?.rateOverride ?? null;
    prepared.push({
      memberId,
      shiftId: template.id,
      shiftName: template.shiftName,
      shiftStart: template.shiftStart,
      shiftEnd: template.shiftEnd,
      weekdays: template.weekdays ?? defaultWeekdays,
      graceMinutes: template.graceMinutes ?? 0,
      earlyAccessMinutes: template.earlyAccessMinutes ?? 15,
      salaryType: template.salaryType,
      salaryAmount: override ?? template.salaryAmount,
      rateOverride: override,
      isFromGroup: false,
      isActive: extraConfig?.isActive ?? template.isActive ?? true,
    });
  });

  // Custom/manual shifts (no template)
  (customShifts ?? []).forEach((shift) => {
    prepared.push({
      memberId,
      shiftId: null,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays ?? defaultWeekdays,
      graceMinutes: shift.graceMinutes ?? 0,
      earlyAccessMinutes: shift.earlyAccessMinutes ?? 15,
      salaryType: shift.salaryType,
      salaryAmount: shift.salaryAmount,
      rateOverride: null,
      isFromGroup: false,
      isActive: shift.isActive ?? true,
    } as PreparedShift);
  });

  return prepared;
}

async function loadExtraShiftTemplates(extra: ExtraShiftInput[]): Promise<(ShiftLikeInput & { id: string })[]> {
  const ids = Array.from(new Set(extra.map((s) => s.shiftId)));
  const templates = await findStaffGroupShiftsByIds(ids);
  if (templates.length !== ids.length) {
    const missing = ids.filter((id) => !templates.find((t) => t.id === id));
    throw new HttpError(404, "Some shifts were not found", { shiftIds: missing });
  }
  return templates;
}
