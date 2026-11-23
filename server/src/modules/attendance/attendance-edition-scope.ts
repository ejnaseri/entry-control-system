import { MemberType, type Prisma } from "@prisma/client";
import type { AppEdition } from "../../shared/app-identity";

export const ATTENDANCE_DATA_SCOPES = {
  FULL_LEGACY: "FULL_LEGACY",
  STRICT_STAFF: "STRICT_STAFF",
} as const;

export type AttendanceDataScope = (typeof ATTENDANCE_DATA_SCOPES)[keyof typeof ATTENDANCE_DATA_SCOPES];

export function getAttendanceDataScope(edition: AppEdition): AttendanceDataScope {
  return edition === "ATTENDANCE"
    ? ATTENDANCE_DATA_SCOPES.STRICT_STAFF
    : ATTENDANCE_DATA_SCOPES.FULL_LEGACY;
}

export function isStrictStaffAttendanceScope(scope: AttendanceDataScope): boolean {
  return scope === ATTENDANCE_DATA_SCOPES.STRICT_STAFF;
}

export function buildStrictStaffMemberWhere(): Prisma.MemberWhereInput {
  return {
    memberType: MemberType.STAFF,
    isStaff: true,
  };
}
