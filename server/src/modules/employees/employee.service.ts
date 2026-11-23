import { AdminRole, AuditActor, MemberStatus, MemberType, Prisma, SalaryType } from "@prisma/client";
import { HttpError } from "../../middlewares/error-handler";
import { prisma } from "../../lib/prisma";
import {
  employeeByIdWhere,
  employeeDetailSelect,
  findEmployeeAttendance,
  findEmployeeById,
  findEmployeeIdentity,
  findEmployeeStaffGroupOptions,
  findEmployees,
  type EmployeeDetailRow,
  type EmployeeAttendanceRow,
  type EmployeeSummaryRow,
} from "./employee.repository";
import type {
  EmployeeArchiveInput,
  EmployeeCreateInput,
  EmployeeShiftAssignmentInput,
  EmployeeUpdateInput,
  ListEmployeesQuery,
} from "./employee.schemas";
import { syncEmployeeDeviceUserLink } from "./employee.device-user.repository";

type TransactionClient = Prisma.TransactionClient;
type OperationalShiftInput = EmployeeCreateInput["shifts"][number];
type ExtraShiftInput = EmployeeCreateInput["extraShifts"][number];

export type EmployeeActionContext = Readonly<{
  actor: Readonly<{
    id: string;
    role: AdminRole;
    sessionId?: string | undefined;
  }>;
  meta: Readonly<{
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  }>;
}>;

type PreparedEmployeeShift = {
  memberId: string;
  shiftId: string | null;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
  earlyAccessMinutes: number;
  salaryType: SalaryType;
  salaryAmount: number;
  rateOverride: null;
  isFromGroup: boolean;
  isActive: boolean;
};

function employeeNotFound(): never {
  throw new HttpError(404, "Employee not found");
}

function toEmployeeSummary(row: EmployeeSummaryRow) {
  return {
    id: row.id,
    code: row.code,
    memberType: MemberType.STAFF,
    isStaff: true,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    photoUrl: row.photoUrl,
    status: row.status,
    roleType: row.roleType,
    customTitle: row.customTitle,
    staffGroupId: row.staffGroupId,
    staffGroup: row.staffGroup ? { id: row.staffGroup.id, name: row.staffGroup.name } : null,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEmployeeDetail(row: EmployeeDetailRow) {
  const allowedTimeRanges =
    row.accessPolicy?.rules.reduce<Array<{ weekday: number; ranges: Array<{ from: string; to: string }> }>>(
      (entries, rule) => {
        const existing = entries.find((entry) => entry.weekday === rule.weekday);
        if (existing) existing.ranges.push({ from: rule.fromTime, to: rule.toTime });
        else entries.push({ weekday: rule.weekday, ranges: [{ from: rule.fromTime, to: rule.toTime }] });
        return entries;
      },
      []
    ) ?? [];

  return {
    id: row.id,
    code: row.code,
    memberType: MemberType.STAFF,
    isStaff: true,
    firstName: row.firstName,
    lastName: row.lastName,
    fatherName: row.fatherName,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    birthDate: row.birthDate,
    nationalId: row.nationalId,
    photoUrl: row.photoUrl,
    status: row.status,
    notes: row.notes,
    roleType: row.roleType,
    customTitle: row.customTitle,
    profile: row.staffProfile
      ? {
          position: row.staffProfile.position,
          department: row.staffProfile.department,
          systemRole: row.staffProfile.systemRole,
        }
      : null,
    staffGroupId: row.staffGroupId,
    staffGroup: row.staffGroup
      ? {
          id: row.staffGroup.id,
          name: row.staffGroup.name,
          description: row.staffGroup.description,
          accessLevel: row.staffGroup.accessLevel,
          shifts: row.staffGroup.shifts.map((shift) => ({
            id: shift.id,
            shiftName: shift.shiftName,
            shiftStart: shift.shiftStart,
            shiftEnd: shift.shiftEnd,
            weekdays: shift.weekdays,
            graceMinutes: shift.graceMinutes,
            earlyAccessMinutes: shift.earlyAccessMinutes,
            isActive: shift.isActive,
          })),
        }
      : null,
    archivedAt: row.archivedAt,
    active: row.archivedAt === null,
    access: row.accessPolicy
      ? {
          allowedDays: row.accessPolicy.allowedDays,
          allowedTimeRanges,
          maxEntriesPerDay: row.accessPolicy.maxEntriesPerDay,
        }
      : null,
    overtime: row.overtimePolicy
      ? {
          allowOvertime: row.overtimePolicy.allowOvertime,
          maxOvertimePerDay:
            row.overtimePolicy.maxOvertimePerDay === null ? null : Number(row.overtimePolicy.maxOvertimePerDay),
        }
      : null,
    shifts: row.shifts.map((shift) => ({
      id: shift.id,
      shiftId: shift.shiftId,
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays,
      graceMinutes: shift.graceMinutes,
      earlyAccessMinutes: shift.earlyAccessMinutes,
      isFromGroup: shift.isFromGroup,
      isActive: shift.isActive,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toEmployeeAttendance(row: EmployeeAttendanceRow) {
  return {
    id: row.id,
    entryType: row.entryType,
    recordedAt: row.recordedAt,
    source: row.source,
    isAuthorized: row.isAuthorized,
    reason: row.reason,
  };
}

function toAuditSnapshot(row: EmployeeDetailRow): Prisma.InputJsonObject {
  const detail = toEmployeeDetail(row);
  return {
    id: detail.id,
    code: detail.code,
    memberType: detail.memberType,
    isStaff: detail.isStaff,
    status: detail.status,
    roleType: detail.roleType ?? "",
    customTitle: detail.customTitle ?? "",
    staffGroupId: detail.staffGroupId ?? "",
    archivedAt: detail.archivedAt?.toISOString() ?? "",
    profile: detail.profile ?? {},
    access: detail.access ?? {},
    overtime: detail.overtime ?? {},
    shifts: detail.shifts.map((shift) => ({
      shiftId: shift.shiftId ?? "",
      shiftName: shift.shiftName,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      weekdays: shift.weekdays,
      graceMinutes: shift.graceMinutes,
      earlyAccessMinutes: shift.earlyAccessMinutes,
      isFromGroup: shift.isFromGroup,
      isActive: shift.isActive,
    })),
  };
}

function getChangedEmployeeFields(before: EmployeeDetailRow, after: EmployeeDetailRow) {
  const beforeDetail = toEmployeeDetail(before);
  const afterDetail = toEmployeeDetail(after);
  const values: Array<[string, unknown, unknown]> = [
    ["code", beforeDetail.code, afterDetail.code],
    ["firstName", beforeDetail.firstName, afterDetail.firstName],
    ["lastName", beforeDetail.lastName, afterDetail.lastName],
    ["fatherName", beforeDetail.fatherName, afterDetail.fatherName],
    ["phone", beforeDetail.phone, afterDetail.phone],
    ["email", beforeDetail.email, afterDetail.email],
    ["gender", beforeDetail.gender, afterDetail.gender],
    ["birthDate", beforeDetail.birthDate?.toISOString() ?? null, afterDetail.birthDate?.toISOString() ?? null],
    ["nationalId", beforeDetail.nationalId, afterDetail.nationalId],
    ["photoUrl", beforeDetail.photoUrl, afterDetail.photoUrl],
    ["status", beforeDetail.status, afterDetail.status],
    ["notes", beforeDetail.notes, afterDetail.notes],
    ["roleType", beforeDetail.roleType, afterDetail.roleType],
    ["customTitle", beforeDetail.customTitle, afterDetail.customTitle],
    ["profile", beforeDetail.profile, afterDetail.profile],
    ["staffGroupId", beforeDetail.staffGroupId, afterDetail.staffGroupId],
    ["archivedAt", beforeDetail.archivedAt?.toISOString() ?? null, afterDetail.archivedAt?.toISOString() ?? null],
    ["access", beforeDetail.access, afterDetail.access],
    ["overtime", beforeDetail.overtime, afterDetail.overtime],
    ["shifts", beforeDetail.shifts, afterDetail.shifts],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => JSON.stringify(beforeValue) !== JSON.stringify(afterValue))
    .map(([field]) => field);
}

function buildAuditData(
  context: EmployeeActionContext,
  input: {
    action: "member.created" | "member.updated" | "member.shifts.updated";
    targetId: string;
    beforeData?: Prisma.InputJsonObject;
    afterData: Prisma.InputJsonObject;
    metadata?: Prisma.InputJsonObject;
  }
): Prisma.AuditLogUncheckedCreateInput {
  return {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    ...(context.actor.sessionId ? { sessionId: context.actor.sessionId } : {}),
    action: input.action,
    targetType: "Member",
    targetId: input.targetId,
    success: true,
    ...(context.meta.ipAddress ? { ipAddress: context.meta.ipAddress } : {}),
    ...(context.meta.userAgent ? { userAgent: context.meta.userAgent } : {}),
    ...(input.beforeData ? { beforeData: input.beforeData } : {}),
    afterData: input.afterData,
    metadata: {
      domain: "EMPLOYEE",
      memberType: MemberType.STAFF,
      ...(input.metadata ?? {}),
    },
  };
}

async function requireEmployeeInTransaction(tx: TransactionClient, employeeId: string) {
  const row = await tx.member.findFirst({ where: employeeByIdWhere(employeeId), select: employeeDetailSelect });
  if (!row) employeeNotFound();
  return row;
}

async function readEmployeeInTransaction(tx: TransactionClient, employeeId: string) {
  const row = await tx.member.findFirst({ where: employeeByIdWhere(employeeId), select: employeeDetailSelect });
  if (!row) employeeNotFound();
  return row;
}

async function ensureUniqueEmployeeCode(tx: TransactionClient, code: string, excludeId?: string) {
  const duplicate = await tx.member.findFirst({
    where: {
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
      code,
    },
    select: { id: true },
  });
  if (duplicate) throw new HttpError(409, "Employee code already exists");
}

function employeeMutationWhere(employeeId: string, updatedAt: Date): Prisma.MemberWhereInput {
  return { ...employeeByIdWhere(employeeId), updatedAt };
}

function employeeChanged(): never {
  throw new HttpError(409, "Employee was changed by another request; reload and try again");
}

async function upsertAccessPolicy(tx: TransactionClient, memberId: string, access: EmployeeCreateInput["access"]) {
  const allowedDays = Array.from(new Set(access.allowedDays)).sort((left, right) => left - right);
  const rules = access.allowedTimeRanges
    .filter((entry) => allowedDays.includes(entry.weekday))
    .flatMap((entry) => entry.ranges.map((range) => ({ weekday: entry.weekday, fromTime: range.from, toTime: range.to })));
  await tx.memberAccessPolicy.upsert({
    where: { memberId },
    create: { memberId, allowedDays, rules: { create: rules } },
    update: { allowedDays, rules: { deleteMany: {}, create: rules } },
  });
}

async function upsertOvertimePolicy(tx: TransactionClient, memberId: string, overtime: EmployeeCreateInput["overtime"]) {
  await tx.memberOvertimePolicy.upsert({
    where: { memberId },
    create: {
      memberId,
      allowOvertime: overtime.allowOvertime,
      overtimeRateType: null,
      overtimeAmount: null,
      maxOvertimePerDay: overtime.maxOvertimePerDay ?? null,
    },
    update: {
      allowOvertime: overtime.allowOvertime,
      overtimeRateType: null,
      overtimeAmount: null,
      maxOvertimePerDay: overtime.maxOvertimePerDay ?? null,
    },
  });
}

async function loadPreparedShifts(
  tx: TransactionClient,
  memberId: string,
  payload: { staffGroupId?: string | undefined; shifts: OperationalShiftInput[]; extraShifts: ExtraShiftInput[] }
) {
  const prepared = new Map<string, PreparedEmployeeShift>();
  if (payload.staffGroupId) {
    const group = await tx.staffGroup.findUnique({
      where: { id: payload.staffGroupId },
      select: {
        id: true,
        shifts: {
          select: {
            id: true,
            shiftName: true,
            shiftStart: true,
            shiftEnd: true,
            weekdays: true,
            graceMinutes: true,
            earlyAccessMinutes: true,
            isActive: true,
          },
        },
      },
    });
    if (!group) throw new HttpError(404, "Staff group not found");
    for (const shift of group.shifts) {
      prepared.set(`template:${shift.id}`, neutralShift(memberId, shift, shift.id, true));
    }
  }

  if (payload.extraShifts.length > 0) {
    const ids = Array.from(new Set(payload.extraShifts.map((shift) => shift.shiftId)));
    const templates = await tx.staffGroupShift.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        shiftName: true,
        shiftStart: true,
        shiftEnd: true,
        weekdays: true,
        graceMinutes: true,
        earlyAccessMinutes: true,
        isActive: true,
      },
    });
    if (templates.length !== ids.length) throw new HttpError(404, "Some shifts were not found");
    const requested = new Map(payload.extraShifts.map((shift) => [shift.shiftId, shift]));
    for (const template of templates) {
      prepared.set(
        `template:${template.id}`,
        neutralShift(memberId, { ...template, isActive: requested.get(template.id)?.isActive ?? template.isActive }, template.id, false)
      );
    }
  }

  payload.shifts.forEach((shift, index) => {
    prepared.set(`custom:${index}`, neutralShift(memberId, shift, null, false));
  });
  return [...prepared.values()];
}

async function validateEmployeeSchedule(
  tx: TransactionClient,
  payload: { staffGroupId?: string | undefined; extraShifts: ExtraShiftInput[] }
) {
  if (payload.staffGroupId) {
    const group = await tx.staffGroup.findUnique({
      where: { id: payload.staffGroupId },
      select: { id: true, shifts: { select: { id: true }, take: 1 } },
    });
    if (!group) throw new HttpError(404, "Staff group not found", { staffGroupId: payload.staffGroupId });
    if (group.shifts.length === 0) {
      throw new HttpError(400, "Selected staff group has no shift templates", { staffGroupId: payload.staffGroupId });
    }
  }

  if (payload.extraShifts.length > 0) {
    const ids = Array.from(new Set(payload.extraShifts.map((shift) => shift.shiftId)));
    const templates = await tx.staffGroupShift.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (templates.length !== ids.length) throw new HttpError(404, "Some shifts were not found");
  }
}

function neutralShift(
  memberId: string,
  shift: OperationalShiftInput,
  shiftId: string | null,
  isFromGroup: boolean
): PreparedEmployeeShift {
  return {
    memberId,
    shiftId,
    shiftName: shift.shiftName,
    shiftStart: shift.shiftStart,
    shiftEnd: shift.shiftEnd,
    weekdays: [...shift.weekdays],
    graceMinutes: shift.graceMinutes,
    earlyAccessMinutes: shift.earlyAccessMinutes,
    salaryType: SalaryType.MONTHLY,
    salaryAmount: 0,
    rateOverride: null,
    isFromGroup,
    isActive: shift.isActive,
  };
}

async function replaceEmployeeShifts(tx: TransactionClient, memberId: string, shifts: PreparedEmployeeShift[]) {
  await tx.memberShift.deleteMany({ where: { memberId } });
  if (shifts.length > 0) await tx.memberShift.createMany({ data: shifts });
}

function baseMemberData(input: EmployeeCreateInput | EmployeeUpdateInput): Prisma.MemberUncheckedUpdateInput {
  return {
    code: input.code,
    memberType: MemberType.STAFF,
    isStaff: true,
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    fatherName: input.fatherName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    gender: input.gender ?? null,
    birthDate: input.birthDate ? new Date(input.birthDate) : null,
    nationalId: input.nationalId ?? null,
    photoUrl: input.photoUrl ?? null,
    status: input.status,
    notes: input.notes ?? null,
    roleType: input.role.roleType,
    customTitle: input.role.customTitle ?? null,
    staffGroupId: input.staffGroupId ?? null,
  };
}

async function syncEmployeeRelations(
  tx: TransactionClient,
  memberId: string,
  input: EmployeeCreateInput | EmployeeUpdateInput
) {
  await tx.staffProfile.upsert({
    where: { memberId },
    create: {
      memberId,
      position: input.profile.position ?? null,
      department: input.profile.department ?? null,
      systemRole: input.profile.systemRole ?? null,
    },
    update: {
      position: input.profile.position ?? null,
      department: input.profile.department ?? null,
      systemRole: input.profile.systemRole ?? null,
    },
  });
  await upsertAccessPolicy(tx, memberId, input.access);
  await upsertOvertimePolicy(tx, memberId, input.overtime);
  const shifts = await loadPreparedShifts(tx, memberId, input);
  await replaceEmployeeShifts(tx, memberId, shifts);
}

export async function listEmployees(query: ListEmployeesQuery) {
  const { items, total } = await findEmployees(query);
  return { items: items.map(toEmployeeSummary), total, skip: query.skip, take: query.take };
}

export async function listEmployeeStaffGroupOptions() {
  return findEmployeeStaffGroupOptions();
}

export async function getEmployee(employeeId: string) {
  const row = await findEmployeeById(employeeId);
  if (!row) employeeNotFound();
  return toEmployeeDetail(row);
}

export async function createEmployee(input: EmployeeCreateInput, context: EmployeeActionContext) {
  return prisma.$transaction(async (tx) => {
    await ensureUniqueEmployeeCode(tx, input.code);
    await validateEmployeeSchedule(tx, input);
    const member = await tx.member.create({
      data: {
        ...baseMemberData(input),
        archivedAt: null,
      } as Prisma.MemberUncheckedCreateInput,
      select: { id: true },
    });
    await syncEmployeeDeviceUserLink(tx, member.id, input.code);
    await syncEmployeeRelations(tx, member.id, input);
    const after = await readEmployeeInTransaction(tx, member.id);
    await tx.auditLog.create({
      data: buildAuditData(context, {
        action: "member.created",
        targetId: member.id,
        afterData: toAuditSnapshot(after),
      }),
    });
    return toEmployeeDetail(after);
  });
}

export async function updateEmployee(employeeId: string, input: EmployeeUpdateInput, context: EmployeeActionContext) {
  return prisma.$transaction(async (tx) => {
    const before = await requireEmployeeInTransaction(tx, employeeId);
    const codeChanged = input.code !== before.code;
    await ensureUniqueEmployeeCode(tx, input.code, employeeId);
    await validateEmployeeSchedule(tx, input);
    const updated = await tx.member.updateMany({
      where: employeeMutationWhere(employeeId, before.updatedAt),
      data: baseMemberData(input),
    });
    if (updated.count !== 1) employeeChanged();
    if (codeChanged) await syncEmployeeDeviceUserLink(tx, employeeId, input.code);
    await syncEmployeeRelations(tx, employeeId, input);
    const after = await readEmployeeInTransaction(tx, employeeId);
    await tx.auditLog.create({
      data: buildAuditData(context, {
        action: "member.updated",
        targetId: employeeId,
        beforeData: toAuditSnapshot(before),
        afterData: toAuditSnapshot(after),
        metadata: { changedFields: getChangedEmployeeFields(before, after) },
      }),
    });
    return toEmployeeDetail(after);
  });
}

export async function assignEmployeeShifts(
  employeeId: string,
  input: EmployeeShiftAssignmentInput,
  context: EmployeeActionContext
) {
  return prisma.$transaction(async (tx) => {
    const before = await requireEmployeeInTransaction(tx, employeeId);
    await validateEmployeeSchedule(tx, input);
    const updated = await tx.member.updateMany({
      where: employeeMutationWhere(employeeId, before.updatedAt),
      data: { memberType: MemberType.STAFF, isStaff: true, staffGroupId: input.staffGroupId ?? null },
    });
    if (updated.count !== 1) employeeChanged();
    const shifts = await loadPreparedShifts(tx, employeeId, input);
    await replaceEmployeeShifts(tx, employeeId, shifts);
    const after = await readEmployeeInTransaction(tx, employeeId);
    await tx.auditLog.create({
      data: buildAuditData(context, {
        action: "member.shifts.updated",
        targetId: employeeId,
        beforeData: toAuditSnapshot(before),
        afterData: toAuditSnapshot(after),
        metadata: { changedFields: getChangedEmployeeFields(before, after) },
      }),
    });
    return toEmployeeDetail(after);
  });
}

export async function setEmployeeArchived(
  employeeId: string,
  input: EmployeeArchiveInput,
  context: EmployeeActionContext
) {
  return prisma.$transaction(async (tx) => {
    const before = await requireEmployeeInTransaction(tx, employeeId);
    const updated = await tx.member.updateMany({
      where: employeeMutationWhere(employeeId, before.updatedAt),
      data: {
        memberType: MemberType.STAFF,
        isStaff: true,
        archivedAt: input.archived ? new Date() : null,
        status: input.archived ? MemberStatus.BLOCKED : MemberStatus.ACTIVE,
      },
    });
    if (updated.count !== 1) employeeChanged();
    const after = await readEmployeeInTransaction(tx, employeeId);
    await tx.auditLog.create({
      data: buildAuditData(context, {
        action: "member.updated",
        targetId: employeeId,
        beforeData: toAuditSnapshot(before),
        afterData: toAuditSnapshot(after),
        metadata: {
          operation: input.archived ? "ARCHIVE" : "RESTORE",
          changedFields: getChangedEmployeeFields(before, after),
        },
      }),
    });
    return toEmployeeDetail(after);
  });
}

export async function listEmployeeAttendance(employeeId: string) {
  const employee = await findEmployeeIdentity(employeeId);
  if (!employee) employeeNotFound();
  return (await findEmployeeAttendance(employeeId)).map(toEmployeeAttendance);
}

export const employeeServiceTestHooks = {
  baseMemberData,
  buildAuditData,
  getChangedEmployeeFields,
  employeeMutationWhere,
  neutralShift,
  toAuditSnapshot,
  toEmployeeAttendance,
  toEmployeeDetail,
  toEmployeeSummary,
  validateEmployeeSchedule,
};
