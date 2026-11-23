import { MemberType, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { ListEmployeesQuery } from "./employee.schemas";

const operationalShiftSelect = {
  id: true,
  shiftId: true,
  shiftName: true,
  shiftStart: true,
  shiftEnd: true,
  weekdays: true,
  graceMinutes: true,
  earlyAccessMinutes: true,
  isFromGroup: true,
  isActive: true,
} as const satisfies Prisma.MemberShiftSelect;

const operationalGroupShiftSelect = {
  id: true,
  shiftName: true,
  shiftStart: true,
  shiftEnd: true,
  weekdays: true,
  graceMinutes: true,
  earlyAccessMinutes: true,
  isActive: true,
} as const satisfies Prisma.StaffGroupShiftSelect;

export const employeeSummarySelect = {
  id: true,
  code: true,
  memberType: true,
  isStaff: true,
  firstName: true,
  lastName: true,
  phone: true,
  photoUrl: true,
  status: true,
  roleType: true,
  customTitle: true,
  staffGroupId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  staffGroup: { select: { id: true, name: true } },
} as const satisfies Prisma.MemberSelect;

export const employeeDetailSelect = {
  id: true,
  code: true,
  memberType: true,
  isStaff: true,
  firstName: true,
  lastName: true,
  fatherName: true,
  phone: true,
  email: true,
  gender: true,
  birthDate: true,
  nationalId: true,
  photoUrl: true,
  status: true,
  notes: true,
  roleType: true,
  customTitle: true,
  staffGroupId: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  staffProfile: {
    select: {
      position: true,
      department: true,
      systemRole: true,
    },
  },
  staffGroup: {
    select: {
      id: true,
      name: true,
      description: true,
      accessLevel: true,
      shifts: { select: operationalGroupShiftSelect, orderBy: { createdAt: "asc" } },
    },
  },
  accessPolicy: {
    select: {
      allowedDays: true,
      maxEntriesPerDay: true,
      rules: {
        select: { weekday: true, fromTime: true, toTime: true },
        orderBy: [{ weekday: "asc" }, { fromTime: "asc" }],
      },
    },
  },
  overtimePolicy: {
    select: {
      allowOvertime: true,
      maxOvertimePerDay: true,
    },
  },
  shifts: {
    select: operationalShiftSelect,
    orderBy: { createdAt: "asc" },
  },
} as const satisfies Prisma.MemberSelect;

export const employeeAttendanceSelect = {
  id: true,
  recordedAt: true,
  entryType: true,
  source: true,
  isAuthorized: true,
  reason: true,
} as const satisfies Prisma.AttendanceLogSelect;

export type EmployeeSummaryRow = Prisma.MemberGetPayload<{ select: typeof employeeSummarySelect }>;
export type EmployeeDetailRow = Prisma.MemberGetPayload<{ select: typeof employeeDetailSelect }>;
export type EmployeeAttendanceRow = Prisma.AttendanceLogGetPayload<{ select: typeof employeeAttendanceSelect }>;

const employeeStaffGroupOptionSelect = {
  id: true,
  name: true,
  description: true,
  accessLevel: true,
  shifts: { select: operationalGroupShiftSelect, orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.StaffGroupSelect;

export function employeeStaffScope(): Prisma.MemberWhereInput {
  return {
    memberType: MemberType.STAFF,
    isStaff: true,
  };
}

export function employeeByIdWhere(id: string): Prisma.MemberWhereInput {
  return {
    AND: [{ id }, employeeStaffScope()],
  };
}

function buildEmployeeListWhere(query: ListEmployeesQuery): Prisma.MemberWhereInput {
  const filters: Prisma.MemberWhereInput[] = [employeeStaffScope()];
  if (!query.includeArchived) filters.push({ archivedAt: null });
  if (query.status) filters.push({ status: query.status });
  if (query.staffGroupId) filters.push({ staffGroupId: query.staffGroupId });
  if (query.search?.trim()) {
    const contains = query.search.trim();
    filters.push({
      OR: [
        { firstName: { contains, mode: "insensitive" } },
        { lastName: { contains, mode: "insensitive" } },
        { phone: { contains, mode: "insensitive" } },
        { code: { contains, mode: "insensitive" } },
      ],
    });
  }
  return { AND: filters };
}

export async function findEmployees(query: ListEmployeesQuery) {
  const where = buildEmployeeListWhere(query);
  const [items, total] = await prisma.$transaction([
    prisma.member.findMany({
      where,
      select: employeeSummarySelect,
      orderBy: { createdAt: "desc" },
      skip: query.skip,
      take: query.take,
    }),
    prisma.member.count({ where }),
  ]);
  return { items, total };
}

export function findEmployeeById(id: string) {
  return prisma.member.findFirst({ where: employeeByIdWhere(id), select: employeeDetailSelect });
}

export function findEmployeeIdentity(id: string) {
  return prisma.member.findFirst({ where: employeeByIdWhere(id), select: { id: true } });
}

export function findEmployeeAttendance(id: string) {
  return prisma.attendanceLog.findMany({
    where: { memberId: id, member: { is: employeeStaffScope() } },
    select: employeeAttendanceSelect,
    orderBy: { recordedAt: "desc" },
    take: 50,
  });
}

export function findEmployeeStaffGroupOptions() {
  return prisma.staffGroup.findMany({
    select: employeeStaffGroupOptionSelect,
    orderBy: { name: "asc" },
  });
}

export const employeeRepositoryTestHooks = {
  buildEmployeeListWhere,
  operationalGroupShiftSelect,
  operationalShiftSelect,
  employeeStaffGroupOptionSelect,
};
