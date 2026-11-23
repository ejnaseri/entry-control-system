import { AdminPermission, AdminRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { env, runtimeOptionalFeatureFlags } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { resolveEffectivePermissions } from "./auth.permission-policy";

const allPermissions = Object.values(AdminPermission);

const businessOwnerPermissions = allPermissions.filter(
  (permission) => permission !== AdminPermission.RESTORE_DATABASE && permission !== AdminPermission.LICENSE_ACTIVATE
);

const adminPermissions = businessOwnerPermissions.filter((permission) => permission !== AdminPermission.AUDIT_LOG_VIEW);

const managerPermissions = [
  AdminPermission.SIGN_IN,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.MEMBERS_WRITE,
  AdminPermission.MEMBERSHIPS_WRITE,
  AdminPermission.MEMBERSHIPS_CANCEL,
  AdminPermission.PAYMENTS_RECORD,
  AdminPermission.PAYMENTS_REVERSE,
  AdminPermission.FINANCIAL_REPORTS_VIEW,
  AdminPermission.FINANCIAL_EXPORT,
  AdminPermission.ATTENDANCE_EXPORT,
  AdminPermission.EXPENSES_MANAGE,
  AdminPermission.PAYROLL_MANAGE,
  AdminPermission.ATTENDANCE_VIEW,
  AdminPermission.ATTENDANCE_MANUAL,
  AdminPermission.ATTENDANCE_JUSTIFY,
  AdminPermission.DEVICES_VIEW,
  AdminPermission.DEVICES_DIAGNOSTICS,
  AdminPermission.DOOR_UNLOCK,
];

const receptionPermissions = [
  AdminPermission.SIGN_IN,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.MEMBERS_WRITE,
  AdminPermission.MEMBERSHIPS_WRITE,
  AdminPermission.PAYMENTS_RECORD,
  AdminPermission.ATTENDANCE_VIEW,
  AdminPermission.ATTENDANCE_MANUAL,
  AdminPermission.ATTENDANCE_JUSTIFY,
  AdminPermission.DEVICES_VIEW,
];

const accountantPermissions = [
  AdminPermission.SIGN_IN,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.PAYMENTS_RECORD,
  AdminPermission.PAYMENTS_REVERSE,
  AdminPermission.FINANCIAL_REPORTS_VIEW,
  AdminPermission.FINANCIAL_EXPORT,
  AdminPermission.EXPENSES_MANAGE,
  AdminPermission.PAYROLL_MANAGE,
  AdminPermission.ATTENDANCE_VIEW,
];

const deviceOperatorPermissions = [
  AdminPermission.SIGN_IN,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.ATTENDANCE_VIEW,
  AdminPermission.DEVICES_VIEW,
  AdminPermission.DEVICES_DIAGNOSTICS,
  AdminPermission.DEVICES_USER_SYNC,
  AdminPermission.DEVICES_ENROLL,
  AdminPermission.DOOR_UNLOCK,
];

const readOnlyAuditorPermissions = [
  AdminPermission.SIGN_IN,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.FINANCIAL_REPORTS_VIEW,
  AdminPermission.ATTENDANCE_VIEW,
  AdminPermission.DEVICES_VIEW,
];

const staffPermissions = [AdminPermission.SIGN_IN, AdminPermission.ATTENDANCE_VIEW];

export const ATTENDANCE_ROLE_PERMISSION_BUNDLES = Object.freeze({
  [AdminRole.GYM_OWNER]: Object.freeze([
    AdminPermission.SIGN_IN,
    AdminPermission.ADMIN_USERS_MANAGE,
    AdminPermission.ROLES_MANAGE,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.MEMBERS_WRITE,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.ATTENDANCE_EXPORT,
    AdminPermission.ATTENDANCE_MANUAL,
    AdminPermission.ATTENDANCE_JUSTIFY,
    AdminPermission.DEVICES_VIEW,
    AdminPermission.DEVICES_DIAGNOSTICS,
    AdminPermission.DEVICES_USER_SYNC,
    AdminPermission.DEVICES_ENROLL,
    AdminPermission.DEVICES_CLEAR_LOGS,
    AdminPermission.DOOR_UNLOCK,
    AdminPermission.BACKUP_CREATE,
    AdminPermission.BACKUP_SETTINGS_MANAGE,
    AdminPermission.AUDIT_LOG_VIEW,
    AdminPermission.SYSTEM_SETTINGS_MANAGE,
  ]),
  [AdminRole.MANAGER]: Object.freeze([
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.MEMBERS_WRITE,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.ATTENDANCE_EXPORT,
    AdminPermission.ATTENDANCE_MANUAL,
    AdminPermission.ATTENDANCE_JUSTIFY,
    AdminPermission.DEVICES_VIEW,
    AdminPermission.DEVICES_USER_SYNC,
    AdminPermission.DEVICES_ENROLL,
  ]),
  [AdminRole.OPERATOR]: Object.freeze([
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.ATTENDANCE_MANUAL,
    AdminPermission.ATTENDANCE_JUSTIFY,
    AdminPermission.DEVICES_VIEW,
  ]),
  [AdminRole.DEVICE_OPERATOR]: Object.freeze([
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.DEVICES_VIEW,
    AdminPermission.DEVICES_DIAGNOSTICS,
    AdminPermission.DEVICES_USER_SYNC,
    AdminPermission.DEVICES_ENROLL,
    AdminPermission.DEVICES_CLEAR_LOGS,
  ]),
  [AdminRole.READ_ONLY_AUDITOR]: Object.freeze([
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.AUDIT_LOG_VIEW,
  ]),
  [AdminRole.VENDOR_OWNER]: Object.freeze([...allPermissions]),
} satisfies Partial<Record<AdminRole, readonly AdminPermission[]>>);

export const defaultRolePermissions: Partial<Record<AdminRole, AdminPermission[]>> = {
  [AdminRole.VENDOR_OWNER]: allPermissions,
  [AdminRole.GYM_OWNER]: businessOwnerPermissions,
  [AdminRole.ADMIN]: adminPermissions,
  [AdminRole.MANAGER]: managerPermissions,
  [AdminRole.RECEPTION]: receptionPermissions,
  [AdminRole.ACCOUNTANT]: accountantPermissions,
  [AdminRole.DEVICE_OPERATOR]: deviceOperatorPermissions,
  [AdminRole.READ_ONLY_AUDITOR]: readOnlyAuditorPermissions,
  [AdminRole.STAFF]: staffPermissions,
  [AdminRole.SUPER_ADMIN]: adminPermissions,
  [AdminRole.OPERATOR]: receptionPermissions,
};

type TransactionClient = Prisma.TransactionClient;

export async function ensureDefaultRolePermissions(tx: TransactionClient = prisma) {
  const rows = Object.entries(defaultRolePermissions).flatMap(([role, permissions]) =>
    (permissions ?? []).map((permission) => ({
      role: role as AdminRole,
      permission,
    }))
  );

  for (const row of rows) {
    await tx.adminRolePermission.upsert({
      where: {
        role_permission: row,
      },
      update: {},
      create: row,
    });
  }
}

export async function listEffectivePermissions(adminUserId: string, role: AdminRole) {
  const [roleRows, overrides] = await Promise.all([
    prisma.adminRolePermission.findMany({
      where: { role },
      select: { permission: true },
    }),
    prisma.adminUserPermission.findMany({
      where: { adminUserId },
      select: { permission: true, mode: true },
    }),
  ]);

  const attendanceBundle = ATTENDANCE_ROLE_PERMISSION_BUNDLES[role as keyof typeof ATTENDANCE_ROLE_PERMISSION_BUNDLES];
  return resolveEffectivePermissions({
    edition: env.APP_EDITION,
    optionalFeatureFlags: runtimeOptionalFeatureFlags,
    rolePermissions: env.APP_EDITION === "ATTENDANCE" && attendanceBundle
      ? attendanceBundle
      : roleRows.map((row) => row.permission),
    overrides,
  });
}
