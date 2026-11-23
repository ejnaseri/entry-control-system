import assert from "node:assert/strict";
import { AdminRole } from "@prisma/client";
import {
  adminUserCreateSchema,
  attendanceAdminUserCreateSchema,
  attendanceAdminUserUpdateSchema,
  attendanceManageableAdminRoles,
  getManageableAdminRoles,
  manageableAdminRoles,
} from "./admin-user.schemas";

const safeAttendanceRoles = [
  AdminRole.GYM_OWNER,
  AdminRole.MANAGER,
  AdminRole.OPERATOR,
  AdminRole.DEVICE_OPERATOR,
  AdminRole.READ_ONLY_AUDITOR,
];
const hiddenLegacyRoles = [
  AdminRole.ADMIN,
  AdminRole.SUPER_ADMIN,
  AdminRole.RECEPTION,
  AdminRole.ACCOUNTANT,
  AdminRole.STAFF,
  AdminRole.VENDOR_OWNER,
];
const basePayload = { username: "attendance.operator", password: "Strong-Password-42!" };

assert.deepEqual(attendanceManageableAdminRoles, safeAttendanceRoles);
assert.deepEqual(getManageableAdminRoles("ATTENDANCE"), safeAttendanceRoles);
assert.deepEqual(getManageableAdminRoles("FULL"), manageableAdminRoles);
assert.ok(Object.isFrozen(attendanceManageableAdminRoles));

for (const role of safeAttendanceRoles) {
  assert.equal(attendanceAdminUserCreateSchema.safeParse({ ...basePayload, role }).success, true, role);
  assert.equal(attendanceAdminUserUpdateSchema.safeParse({ role }).success, true, role);
}
for (const role of hiddenLegacyRoles) {
  assert.equal(attendanceAdminUserCreateSchema.safeParse({ ...basePayload, role }).success, false, role);
  assert.equal(attendanceAdminUserUpdateSchema.safeParse({ role }).success, false, role);
}

assert.equal(adminUserCreateSchema.safeParse({ ...basePayload, role: AdminRole.RECEPTION }).success, true);
assert.equal(adminUserCreateSchema.safeParse({ ...basePayload, role: AdminRole.OPERATOR }).success, false);
console.log("ok - Attendance admin role selector and write schemas enforce the approved 3.6 mapping");
