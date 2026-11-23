import { AdminPermission, PermissionMode } from "@prisma/client";
import {
  getEffectiveFeatures,
  type Capability,
  type OptionalFeatureFlags,
} from "../../config/capabilities";
import type { AppEdition } from "../../config/env";

function freezeCapabilities(...capabilities: Capability[]): readonly Capability[] {
  return Object.freeze(capabilities);
}

export const PERMISSION_CAPABILITY_ALLOWLIST: Readonly<
  Record<AdminPermission, readonly Capability[]>
> = Object.freeze({
  [AdminPermission.SIGN_IN]: freezeCapabilities("AUTH"),
  [AdminPermission.ADMIN_USERS_MANAGE]: freezeCapabilities("ADMIN_USERS"),
  [AdminPermission.ROLES_MANAGE]: freezeCapabilities("ADMIN_USERS"),
  [AdminPermission.MEMBERS_VIEW]: freezeCapabilities("CUSTOMERS", "EMPLOYEES", "STAFF_GROUPS"),
  [AdminPermission.MEMBERS_WRITE]: freezeCapabilities("CUSTOMERS", "EMPLOYEES"),
  [AdminPermission.MEMBERS_DELETE]: freezeCapabilities("CUSTOMERS"),
  [AdminPermission.MEMBERSHIPS_WRITE]: freezeCapabilities("MEMBERSHIPS"),
  [AdminPermission.MEMBERSHIPS_CANCEL]: freezeCapabilities("MEMBERSHIPS"),
  [AdminPermission.PAYMENTS_RECORD]: freezeCapabilities("CUSTOMER_PAYMENTS"),
  [AdminPermission.PAYMENTS_REVERSE]: freezeCapabilities("CUSTOMER_PAYMENTS"),
  [AdminPermission.FINANCIAL_REPORTS_VIEW]: freezeCapabilities("FINANCIAL_REPORTS"),
  [AdminPermission.FINANCIAL_EXPORT]: freezeCapabilities("FINANCIAL_REPORTS"),
  [AdminPermission.ATTENDANCE_EXPORT]: freezeCapabilities("ATTENDANCE_EXPORT"),
  [AdminPermission.EXPENSES_MANAGE]: freezeCapabilities("EXPENSES"),
  [AdminPermission.PAYROLL_MANAGE]: freezeCapabilities("PAYROLL"),
  [AdminPermission.ATTENDANCE_VIEW]: freezeCapabilities(
    "ATTENDANCE_COMPLIANCE",
    "ATTENDANCE_DAILY",
    "ATTENDANCE_DASHBOARD",
    "ATTENDANCE_REPORTS",
    "ENTRY_LOGS"
  ),
  [AdminPermission.ATTENDANCE_MANUAL]: freezeCapabilities("ATTENDANCE_DAILY"),
  [AdminPermission.ATTENDANCE_JUSTIFY]: freezeCapabilities("ATTENDANCE_DAILY"),
  [AdminPermission.DEVICES_VIEW]: freezeCapabilities("DEVICES"),
  [AdminPermission.DEVICES_DIAGNOSTICS]: freezeCapabilities("DEVICE_DIAGNOSTICS"),
  [AdminPermission.DEVICES_USER_SYNC]: freezeCapabilities("DEVICES"),
  [AdminPermission.DEVICES_ENROLL]: freezeCapabilities("DEVICES"),
  [AdminPermission.DEVICES_CLEAR_LOGS]: freezeCapabilities("DEVICE_DIAGNOSTICS"),
  [AdminPermission.DOOR_UNLOCK]: freezeCapabilities("DOOR_CONTROL"),
  [AdminPermission.SOUND_SETTINGS_MANAGE]: freezeCapabilities("SOUNDS"),
  [AdminPermission.BACKUP_CREATE]: freezeCapabilities("BACKUPS"),
  [AdminPermission.BACKUP_SETTINGS_MANAGE]: freezeCapabilities("BACKUPS"),
  [AdminPermission.RESTORE_DATABASE]: freezeCapabilities("BACKUPS"),
  [AdminPermission.LICENSE_VIEW]: freezeCapabilities(),
  [AdminPermission.LICENSE_ACTIVATE]: freezeCapabilities(),
  [AdminPermission.AUDIT_LOG_VIEW]: freezeCapabilities("AUDIT_LOGS"),
  [AdminPermission.SYSTEM_SETTINGS_MANAGE]: freezeCapabilities("DEVICES", "MEMBERSHIPS", "STAFF_GROUPS"),
});

export const ATTENDANCE_DENIED_PERMISSIONS: readonly AdminPermission[] = Object.freeze([
  AdminPermission.MEMBERS_DELETE,
  AdminPermission.MEMBERSHIPS_WRITE,
  AdminPermission.MEMBERSHIPS_CANCEL,
  AdminPermission.PAYMENTS_RECORD,
  AdminPermission.PAYMENTS_REVERSE,
  AdminPermission.FINANCIAL_REPORTS_VIEW,
  AdminPermission.FINANCIAL_EXPORT,
  AdminPermission.EXPENSES_MANAGE,
  AdminPermission.PAYROLL_MANAGE,
  AdminPermission.LICENSE_VIEW,
  AdminPermission.LICENSE_ACTIVATE,
]);

const attendanceDeniedPermissionSet = new Set(ATTENDANCE_DENIED_PERMISSIONS);

export type PermissionOverride = Readonly<{
  permission: AdminPermission;
  mode: PermissionMode;
}>;

export type PermissionResolutionInput = Readonly<{
  edition: AppEdition;
  optionalFeatureFlags?: OptionalFeatureFlags;
  rolePermissions: readonly AdminPermission[];
  overrides: readonly PermissionOverride[];
}>;

function comparePermissions(left: AdminPermission, right: AdminPermission): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sortPermissions(permissions: Iterable<AdminPermission>): AdminPermission[] {
  return [...permissions].sort(comparePermissions);
}

function applyPermissionOverrides(
  rolePermissions: readonly AdminPermission[],
  overrides: readonly PermissionOverride[]
): AdminPermission[] {
  const permissions = new Set(rolePermissions);

  for (const override of overrides) {
    if (override.mode === PermissionMode.ALLOW) {
      permissions.add(override.permission);
    }
  }

  // A DENY is applied last so it remains authoritative even if malformed input
  // contains both modes for one permission. The database uniqueness constraint
  // normally prevents that state.
  for (const override of overrides) {
    if (override.mode === PermissionMode.DENY) {
      permissions.delete(override.permission);
    }
  }

  return sortPermissions(permissions);
}

export function resolvePermissionsForFeatures(
  input: PermissionResolutionInput,
  effectiveFeatures: readonly Capability[]
): AdminPermission[] {
  const permissionsAfterOverrides = applyPermissionOverrides(input.rolePermissions, input.overrides);

  // FULL is intentionally an identity boundary for the existing permission
  // behavior, including permissions without a dedicated capability.
  if (input.edition === "FULL") {
    return permissionsAfterOverrides;
  }

  const enabledFeatures = new Set(effectiveFeatures);
  return permissionsAfterOverrides.filter((permission) => {
    if (attendanceDeniedPermissionSet.has(permission)) {
      return false;
    }

    return PERMISSION_CAPABILITY_ALLOWLIST[permission].some((capability) => enabledFeatures.has(capability));
  });
}

export function resolveEffectivePermissions(input: PermissionResolutionInput): AdminPermission[] {
  return resolvePermissionsForFeatures(
    input,
    getEffectiveFeatures(input.edition, input.optionalFeatureFlags)
  );
}
