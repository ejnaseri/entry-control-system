import { AuditActor, type AdminRole, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { StaffGroupInput } from "./staff-group.schemas";
import { deleteStaffGroupRecord, findStaffGroupWithShifts, listStaffGroups as listGroupsRepo, staffGroupInclude } from "./staff-group.repository";

type TransactionClient = Prisma.TransactionClient;
type StaffGroupWithShifts = Prisma.StaffGroupGetPayload<{ include: typeof staffGroupInclude }>;

export type StaffGroupActionContext = {
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

type StaffGroupAuditInput = {
  action: "staff_group.created" | "staff_group.updated" | "staff_group.deleted";
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

export function listStaffGroups() {
  return listGroupsRepo();
}

export async function getStaffGroup(id: string) {
  const group = await findStaffGroupWithShifts(id);
  if (!group) {
    throw new HttpError(404, "Staff group not found", { id });
  }
  return group;
}

export async function createStaffGroup(input: StaffGroupInput, context: StaffGroupActionContext) {
  return prisma.$transaction(async (tx) => {
    const group = await tx.staffGroup.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        accessLevel: input.accessLevel ?? null,
      },
    });
    await createGroupShifts(tx, group.id, input.shifts);
    const created = await tx.staffGroup.findUniqueOrThrow({ where: { id: group.id }, include: staffGroupInclude });
    await tx.auditLog.create({
      data: buildStaffGroupAuditData(context, {
        action: "staff_group.created",
        targetId: created.id,
        afterData: toStaffGroupAuditJson(created),
      }),
    });
    return created;
  });
}

export async function updateStaffGroup(id: string, input: StaffGroupInput, context: StaffGroupActionContext) {
  return prisma.$transaction(async (tx) => {
    const before = await findStaffGroupWithShifts(id, tx);
    if (!before) {
      throw new HttpError(404, "Staff group not found", { id });
    }
    await tx.staffGroup.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description ?? null,
        accessLevel: input.accessLevel ?? null,
      },
    });
    await tx.staffGroupShift.deleteMany({ where: { staffGroupId: id } });
    await createGroupShifts(tx, id, input.shifts);
    await syncGroupShiftsToMembers(tx, id);
    const updated = await tx.staffGroup.findUniqueOrThrow({ where: { id }, include: staffGroupInclude });
    await tx.auditLog.create({
      data: buildStaffGroupAuditData(context, {
        action: "staff_group.updated",
        targetId: updated.id,
        beforeData: toStaffGroupAuditJson(before),
        afterData: toStaffGroupAuditJson(updated),
        metadata: { changedFields: getStaffGroupChangedFields(before, updated) },
      }),
    });
    return updated;
  });
}

export async function removeStaffGroup(id: string, context: StaffGroupActionContext) {
  await prisma.$transaction(async (tx) => {
    const group = await tx.staffGroup.findUnique({
      where: { id },
      include: {
        ...staffGroupInclude,
        _count: { select: { members: true, payrollPolicies: true } },
      },
    });
    if (!group) {
      throw new HttpError(404, "Staff group not found", { id });
    }
    const shiftIds = group.shifts.map((shift) => shift.id);
    const linkedMemberShiftCount = shiftIds.length
      ? await tx.memberShift.count({ where: { shiftId: { in: shiftIds } } })
      : 0;
    await deleteStaffGroupRecord(id, tx);
    await tx.auditLog.create({
      data: buildStaffGroupAuditData(context, {
        action: "staff_group.deleted",
        targetId: id,
        beforeData: toStaffGroupAuditJson(group),
        afterData: { id, deleted: true },
        metadata: {
          mode: "HARD_DELETE",
          linkedMemberCount: group._count.members,
          shiftTemplateCount: group.shifts.length,
          linkedMemberShiftCount,
          deletedPayrollPolicyCount: group._count.payrollPolicies,
        },
      }),
    });
  });
}

function createGroupShifts(tx: TransactionClient, staffGroupId: string, shifts: StaffGroupInput["shifts"]) {
  if (!shifts?.length) return Promise.resolve();
  return tx.staffGroupShift.createMany({
    data: shifts.map((shift) => ({
      staffGroupId,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays,
      graceMinutes: shift.graceMinutes,
      earlyAccessMinutes: shift.earlyAccessMinutes ?? 15,
      salaryType: shift.salaryType,
      salaryAmount: shift.salaryAmount,
      isActive: shift.isActive ?? true,
    })),
  });
}

async function syncGroupShiftsToMembers(tx: TransactionClient, staffGroupId: string) {
  const group = await tx.staffGroup.findUnique({
    where: { id: staffGroupId },
    include: {
      shifts: true,
      members: { select: { id: true } },
    },
  });
  if (!group) return;
  const memberIds = group.members.map((member) => member.id);
  if (memberIds.length === 0) return;

  await tx.memberShift.deleteMany({
    where: { memberId: { in: memberIds }, isFromGroup: true },
  });

  if (group.shifts.length === 0) return;
  const data = memberIds.flatMap((memberId) =>
    group.shifts.map((shift) => ({
      memberId,
      shiftId: shift.id,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
      graceMinutes: shift.graceMinutes ?? 0,
      earlyAccessMinutes: shift.earlyAccessMinutes ?? 15,
      salaryType: shift.salaryType,
      salaryAmount: shift.salaryAmount,
      rateOverride: null,
      isFromGroup: true,
      isActive: shift.isActive ?? true,
    }))
  );

  if (data.length > 0) {
    await tx.memberShift.createMany({ data });
  }
}

function buildStaffGroupAuditData(
  context: StaffGroupActionContext,
  input: StaffGroupAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: "StaffGroup",
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

function toStaffGroupAuditJson(group: StaffGroupWithShifts): Prisma.InputJsonObject {
  return {
    id: group.id,
    name: group.name,
    accessLevel: group.accessLevel ?? "",
    shifts: toShiftPolicyAuditJson(group),
  };
}

function toShiftPolicyAuditJson(group: StaffGroupWithShifts): Prisma.InputJsonArray {
  return group.shifts
    .map((shift) => ({
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: [...shift.weekdays].sort((a, b) => a - b),
      graceMinutes: shift.graceMinutes,
      earlyAccessMinutes: shift.earlyAccessMinutes,
      salaryType: shift.salaryType,
      salaryAmount: Number(shift.salaryAmount),
      isActive: shift.isActive,
    }))
    .sort((left, right) =>
      `${left.shiftName}\u0000${left.shiftStart}\u0000${left.shiftEnd}`.localeCompare(
        `${right.shiftName}\u0000${right.shiftStart}\u0000${right.shiftEnd}`
      )
    );
}

function getStaffGroupChangedFields(before: StaffGroupWithShifts, after: StaffGroupWithShifts) {
  const values: Array<[string, unknown, unknown]> = [
    ["name", before.name, after.name],
    ["description", before.description, after.description],
    ["accessLevel", before.accessLevel, after.accessLevel],
    ["shifts", toShiftPolicyAuditJson(before), toShiftPolicyAuditJson(after)],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => JSON.stringify(beforeValue) !== JSON.stringify(afterValue))
    .map(([field]) => field);
}
