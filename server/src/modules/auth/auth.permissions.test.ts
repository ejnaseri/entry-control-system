import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import path from "node:path";
import { AdminPermission, AdminRole, PermissionMode } from "@prisma/client";
import {
  CAPABILITY_NAMES,
  CODE_READY_FEATURES_BY_EDITION,
  type Capability,
} from "../../config/capabilities";
import {
  ATTENDANCE_DENIED_PERMISSIONS,
  PERMISSION_CAPABILITY_ALLOWLIST,
  resolveEffectivePermissions,
  resolvePermissionsForFeatures,
  type PermissionOverride,
} from "./auth.permission-policy";
import { ATTENDANCE_ROLE_PERMISSION_BUNDLES } from "./auth.permissions";

const WRAPPER_PROBE = "--probe-list-effective-permissions";
const TEST_DATABASE_URL = "postgresql://permission_test:permission_test@127.0.0.1:1/permission_test";
const ALL_PERMISSIONS = Object.values(AdminPermission);

const EXPECTED_PERMISSION_CAPABILITIES = {
  [AdminPermission.SIGN_IN]: ["AUTH"],
  [AdminPermission.ADMIN_USERS_MANAGE]: ["ADMIN_USERS"],
  [AdminPermission.ROLES_MANAGE]: ["ADMIN_USERS"],
  [AdminPermission.MEMBERS_VIEW]: ["CUSTOMERS", "EMPLOYEES", "STAFF_GROUPS"],
  [AdminPermission.MEMBERS_WRITE]: ["CUSTOMERS", "EMPLOYEES"],
  [AdminPermission.MEMBERS_DELETE]: ["CUSTOMERS"],
  [AdminPermission.MEMBERSHIPS_WRITE]: ["MEMBERSHIPS"],
  [AdminPermission.MEMBERSHIPS_CANCEL]: ["MEMBERSHIPS"],
  [AdminPermission.PAYMENTS_RECORD]: ["CUSTOMER_PAYMENTS"],
  [AdminPermission.PAYMENTS_REVERSE]: ["CUSTOMER_PAYMENTS"],
  [AdminPermission.FINANCIAL_REPORTS_VIEW]: ["FINANCIAL_REPORTS"],
  [AdminPermission.FINANCIAL_EXPORT]: ["FINANCIAL_REPORTS"],
  [AdminPermission.ATTENDANCE_EXPORT]: ["ATTENDANCE_EXPORT"],
  [AdminPermission.EXPENSES_MANAGE]: ["EXPENSES"],
  [AdminPermission.PAYROLL_MANAGE]: ["PAYROLL"],
  [AdminPermission.ATTENDANCE_VIEW]: [
    "ATTENDANCE_COMPLIANCE",
    "ATTENDANCE_DAILY",
    "ATTENDANCE_DASHBOARD",
    "ATTENDANCE_REPORTS",
    "ENTRY_LOGS",
  ],
  [AdminPermission.ATTENDANCE_MANUAL]: ["ATTENDANCE_DAILY"],
  [AdminPermission.ATTENDANCE_JUSTIFY]: ["ATTENDANCE_DAILY"],
  [AdminPermission.DEVICES_VIEW]: ["DEVICES"],
  [AdminPermission.DEVICES_DIAGNOSTICS]: ["DEVICE_DIAGNOSTICS"],
  [AdminPermission.DEVICES_USER_SYNC]: ["DEVICES"],
  [AdminPermission.DEVICES_ENROLL]: ["DEVICES"],
  [AdminPermission.DEVICES_CLEAR_LOGS]: ["DEVICE_DIAGNOSTICS"],
  [AdminPermission.DOOR_UNLOCK]: ["DOOR_CONTROL"],
  [AdminPermission.SOUND_SETTINGS_MANAGE]: ["SOUNDS"],
  [AdminPermission.BACKUP_CREATE]: ["BACKUPS"],
  [AdminPermission.BACKUP_SETTINGS_MANAGE]: ["BACKUPS"],
  [AdminPermission.RESTORE_DATABASE]: ["BACKUPS"],
  [AdminPermission.LICENSE_VIEW]: [],
  [AdminPermission.LICENSE_ACTIVATE]: [],
  [AdminPermission.AUDIT_LOG_VIEW]: ["AUDIT_LOGS"],
  [AdminPermission.SYSTEM_SETTINGS_MANAGE]: ["DEVICES", "MEMBERSHIPS", "STAFF_GROUPS"],
} as const satisfies Record<AdminPermission, readonly Capability[]>;

const EXPECTED_ATTENDANCE_DENYLIST = [
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
] as const;

const PHASE_TWO_CORE_FEATURES = [
  "AUTH",
  "ATTENDANCE_DAILY",
  "EMPLOYEES",
  "ENTRY_LOGS",
  "DEVICES",
  "STAFF_GROUPS",
] as const satisfies readonly Capability[];

const EXPECTED_PHASE_TWO_OWNER_PERMISSIONS = [
  AdminPermission.ATTENDANCE_JUSTIFY,
  AdminPermission.ATTENDANCE_MANUAL,
  AdminPermission.ATTENDANCE_VIEW,
  AdminPermission.DEVICES_ENROLL,
  AdminPermission.DEVICES_USER_SYNC,
  AdminPermission.DEVICES_VIEW,
  AdminPermission.MEMBERS_VIEW,
  AdminPermission.MEMBERS_WRITE,
  AdminPermission.SIGN_IN,
  AdminPermission.SYSTEM_SETTINGS_MANAGE,
] as const;

function compareIdentifiers(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sortedPermissions(permissions: readonly AdminPermission[]): AdminPermission[] {
  return [...permissions].sort(compareIdentifiers);
}

function assertSortedAndUnique(permissions: readonly AdminPermission[], label: string): void {
  assert.deepEqual(permissions, sortedPermissions(permissions), `${label} should have stable ordering`);
  assert.equal(new Set(permissions).size, permissions.length, `${label} should not contain duplicates`);
}

function resolveForFeatures(
  edition: "FULL" | "ATTENDANCE",
  rolePermissions: readonly AdminPermission[],
  overrides: readonly PermissionOverride[],
  effectiveFeatures: readonly Capability[]
): AdminPermission[] {
  return resolvePermissionsForFeatures(
    { edition, rolePermissions, overrides },
    effectiveFeatures
  );
}

function testExactPermissionCapabilityPolicy(): void {
  assert.equal(ALL_PERMISSIONS.length, 32);
  assert.deepEqual(
    Object.keys(PERMISSION_CAPABILITY_ALLOWLIST).sort(compareIdentifiers),
    [...ALL_PERMISSIONS].sort(compareIdentifiers)
  );
  assert.deepEqual(PERMISSION_CAPABILITY_ALLOWLIST, EXPECTED_PERMISSION_CAPABILITIES);
  assert.deepEqual(ATTENDANCE_DENIED_PERMISSIONS, EXPECTED_ATTENDANCE_DENYLIST);
  assert.ok(Object.isFrozen(PERMISSION_CAPABILITY_ALLOWLIST));
  assert.ok(Object.isFrozen(ATTENDANCE_DENIED_PERMISSIONS));

  for (const [permission, capabilities] of Object.entries(PERMISSION_CAPABILITY_ALLOWLIST)) {
    assert.ok(ALL_PERMISSIONS.includes(permission as AdminPermission));
    assert.ok(Object.isFrozen(capabilities), `${permission} capability list should be frozen`);
    assert.equal(new Set(capabilities).size, capabilities.length, `${permission} capabilities should be unique`);
    for (const capability of capabilities) {
      assert.ok(CAPABILITY_NAMES.includes(capability), `${permission} maps to unknown capability ${capability}`);
    }
  }
}

function testAttendanceRoleBundlesMatchApprovedMapping(): void {
  assert.ok(Object.isFrozen(ATTENDANCE_ROLE_PERMISSION_BUNDLES));
  const expected = {
    [AdminRole.GYM_OWNER]: [
      AdminPermission.SIGN_IN, AdminPermission.ADMIN_USERS_MANAGE, AdminPermission.ROLES_MANAGE,
      AdminPermission.MEMBERS_VIEW, AdminPermission.MEMBERS_WRITE, AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.ATTENDANCE_EXPORT,
      AdminPermission.ATTENDANCE_MANUAL, AdminPermission.ATTENDANCE_JUSTIFY, AdminPermission.DEVICES_VIEW,
      AdminPermission.DEVICES_DIAGNOSTICS, AdminPermission.DEVICES_USER_SYNC, AdminPermission.DEVICES_ENROLL,
      AdminPermission.DEVICES_CLEAR_LOGS, AdminPermission.DOOR_UNLOCK, AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE, AdminPermission.AUDIT_LOG_VIEW, AdminPermission.SYSTEM_SETTINGS_MANAGE,
    ],
    [AdminRole.MANAGER]: [
      AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW, AdminPermission.MEMBERS_WRITE,
      AdminPermission.ATTENDANCE_VIEW, AdminPermission.ATTENDANCE_EXPORT,
      AdminPermission.ATTENDANCE_MANUAL, AdminPermission.ATTENDANCE_JUSTIFY,
      AdminPermission.DEVICES_VIEW, AdminPermission.DEVICES_USER_SYNC, AdminPermission.DEVICES_ENROLL,
    ],
    [AdminRole.OPERATOR]: [
      AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW, AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.ATTENDANCE_MANUAL, AdminPermission.ATTENDANCE_JUSTIFY, AdminPermission.DEVICES_VIEW,
    ],
    [AdminRole.DEVICE_OPERATOR]: [
      AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW, AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.DEVICES_VIEW, AdminPermission.DEVICES_DIAGNOSTICS, AdminPermission.DEVICES_USER_SYNC,
      AdminPermission.DEVICES_ENROLL, AdminPermission.DEVICES_CLEAR_LOGS,
    ],
    [AdminRole.READ_ONLY_AUDITOR]: [
      AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW, AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.AUDIT_LOG_VIEW,
    ],
    [AdminRole.VENDOR_OWNER]: ALL_PERMISSIONS,
  };
  assert.deepEqual(ATTENDANCE_ROLE_PERMISSION_BUNDLES, expected);
  for (const permissions of Object.values(ATTENDANCE_ROLE_PERMISSION_BUNDLES)) {
    assert.ok(Object.isFrozen(permissions));
    assert.equal(
      (permissions as readonly AdminPermission[]).includes(AdminPermission.FINANCIAL_EXPORT),
      permissions === ATTENDANCE_ROLE_PERMISSION_BUNDLES.VENDOR_OWNER
    );
  }
  for (const [role, permissions] of Object.entries(ATTENDANCE_ROLE_PERMISSION_BUNDLES)) {
    assert.equal(
      (permissions as readonly AdminPermission[]).includes(AdminPermission.ATTENDANCE_EXPORT),
      role === AdminRole.GYM_OWNER || role === AdminRole.MANAGER || role === AdminRole.VENDOR_OWNER
    );
  }
}

function testFullEditionPreservesExistingBehavior(): void {
  const ownerPermissions = resolveEffectivePermissions({
    edition: "FULL",
    rolePermissions: ALL_PERMISSIONS,
    overrides: [],
  });
  assert.deepEqual(ownerPermissions, sortedPermissions(ALL_PERMISSIONS));

  const regularRolePermissions = [
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.FINANCIAL_EXPORT,
  ];
  const overrides: PermissionOverride[] = [
    { permission: AdminPermission.LICENSE_ACTIVATE, mode: PermissionMode.ALLOW },
    { permission: AdminPermission.DEVICES_VIEW, mode: PermissionMode.ALLOW },
    { permission: AdminPermission.MEMBERS_VIEW, mode: PermissionMode.DENY },
  ];
  const resolved = resolveEffectivePermissions({
    edition: "FULL",
    rolePermissions: regularRolePermissions,
    overrides,
  });

  assert.deepEqual(
    resolved,
    sortedPermissions([
      AdminPermission.SIGN_IN,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.FINANCIAL_EXPORT,
      AdminPermission.LICENSE_ACTIVATE,
      AdminPermission.DEVICES_VIEW,
    ])
  );
  assertSortedAndUnique(resolved, "FULL regular role output");

  const denyWins = resolveForFeatures(
    "FULL",
    [AdminPermission.ATTENDANCE_MANUAL],
    [
      { permission: AdminPermission.ATTENDANCE_MANUAL, mode: PermissionMode.DENY },
      { permission: AdminPermission.ATTENDANCE_MANUAL, mode: PermissionMode.ALLOW },
    ],
    []
  );
  assert.deepEqual(denyWins, []);
}

function testAttendanceAuthReadinessRemainsCapabilityFiltered(): void {
  assert.deepEqual(CODE_READY_FEATURES_BY_EDITION.ATTENDANCE, ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"]);

  const ownerPermissions = resolveEffectivePermissions({
    edition: "ATTENDANCE",
    rolePermissions: ALL_PERMISSIONS,
    overrides: [],
  });
  assert.deepEqual(
    ownerPermissions,
    sortedPermissions([
      AdminPermission.ATTENDANCE_JUSTIFY,
      AdminPermission.ATTENDANCE_MANUAL,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.ATTENDANCE_EXPORT,
      AdminPermission.ADMIN_USERS_MANAGE,
      AdminPermission.AUDIT_LOG_VIEW,
      AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE,
      AdminPermission.DEVICES_ENROLL,
      AdminPermission.DEVICES_USER_SYNC,
      AdminPermission.DEVICES_VIEW,
      AdminPermission.MEMBERS_VIEW,
      AdminPermission.MEMBERS_WRITE,
      AdminPermission.SIGN_IN,
      AdminPermission.SYSTEM_SETTINGS_MANAGE,
      AdminPermission.ROLES_MANAGE,
      AdminPermission.RESTORE_DATABASE,
    ])
  );

  const staleRoleAndAllow = resolveEffectivePermissions({
    edition: "ATTENDANCE",
    rolePermissions: [
      AdminPermission.SIGN_IN,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.FINANCIAL_REPORTS_VIEW,
    ],
    overrides: [
      { permission: AdminPermission.FINANCIAL_EXPORT, mode: PermissionMode.ALLOW },
      { permission: AdminPermission.LICENSE_ACTIVATE, mode: PermissionMode.ALLOW },
      { permission: AdminPermission.ATTENDANCE_VIEW, mode: PermissionMode.DENY },
    ],
  });
  assert.deepEqual(staleRoleAndAllow, [AdminPermission.SIGN_IN]);
}

function testAttendanceFutureCapabilityIntersection(): void {
  const ownerPermissions = resolveForFeatures(
    "ATTENDANCE",
    ALL_PERMISSIONS,
    [],
    PHASE_TWO_CORE_FEATURES
  );
  assert.deepEqual(ownerPermissions, EXPECTED_PHASE_TWO_OWNER_PERMISSIONS);
  assertSortedAndUnique(ownerPermissions, "ATTENDANCE owner output");

  const regularRole = resolveForFeatures(
    "ATTENDANCE",
    [
      AdminPermission.SIGN_IN,
      AdminPermission.MEMBERS_VIEW,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.DEVICES_VIEW,
      AdminPermission.FINANCIAL_EXPORT,
    ],
    [],
    PHASE_TWO_CORE_FEATURES
  );
  assert.deepEqual(
    regularRole,
    sortedPermissions([
      AdminPermission.SIGN_IN,
      AdminPermission.MEMBERS_VIEW,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.DEVICES_VIEW,
    ])
  );

  const staleRoleAndAllow = resolveForFeatures(
    "ATTENDANCE",
    [
      AdminPermission.SIGN_IN,
      AdminPermission.FINANCIAL_REPORTS_VIEW,
      AdminPermission.MEMBERSHIPS_WRITE,
      AdminPermission.LICENSE_VIEW,
    ],
    [
      { permission: AdminPermission.FINANCIAL_EXPORT, mode: PermissionMode.ALLOW },
      { permission: AdminPermission.PAYMENTS_REVERSE, mode: PermissionMode.ALLOW },
      { permission: AdminPermission.LICENSE_ACTIVATE, mode: PermissionMode.ALLOW },
    ],
    PHASE_TWO_CORE_FEATURES
  );
  assert.deepEqual(staleRoleAndAllow, [AdminPermission.SIGN_IN]);

  const deniedCorePermission = resolveForFeatures(
    "ATTENDANCE",
    ALL_PERMISSIONS,
    [
      { permission: AdminPermission.ATTENDANCE_MANUAL, mode: PermissionMode.DENY },
      { permission: AdminPermission.FINANCIAL_EXPORT, mode: PermissionMode.ALLOW },
    ],
    PHASE_TWO_CORE_FEATURES
  );
  assert.equal(deniedCorePermission.includes(AdminPermission.ATTENDANCE_MANUAL), false);
  assert.equal(deniedCorePermission.includes(AdminPermission.FINANCIAL_EXPORT), false);

  const authOnly = resolveForFeatures("ATTENDANCE", ALL_PERMISSIONS, [], ["AUTH"]);
  assert.deepEqual(authOnly, [AdminPermission.SIGN_IN]);
}

function testAttendanceHardDenyAndOptionalBoundaries(): void {
  const everyCapabilityEnabled = resolveForFeatures(
    "ATTENDANCE",
    ALL_PERMISSIONS,
    [],
    CAPABILITY_NAMES
  );
  for (const permission of EXPECTED_ATTENDANCE_DENYLIST) {
    assert.equal(
      everyCapabilityEnabled.includes(permission),
      false,
      `${permission} must remain denied in ATTENDANCE`
    );
  }

  const isolatedOptionalFeatures = resolveForFeatures(
    "ATTENDANCE",
    ALL_PERMISSIONS,
    [],
    [
      "ADMIN_USERS",
      "AUDIT_LOGS",
      "BACKUPS",
      "DEVICE_DIAGNOSTICS",
      "DOOR_CONTROL",
      "SOUNDS",
    ]
  );
  assert.deepEqual(
    isolatedOptionalFeatures,
    sortedPermissions([
      AdminPermission.ADMIN_USERS_MANAGE,
      AdminPermission.ROLES_MANAGE,
      AdminPermission.AUDIT_LOG_VIEW,
      AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE,
      AdminPermission.RESTORE_DATABASE,
      AdminPermission.DEVICES_DIAGNOSTICS,
      AdminPermission.DEVICES_CLEAR_LOGS,
      AdminPermission.DOOR_UNLOCK,
      AdminPermission.SOUND_SETTINGS_MANAGE,
    ])
  );
}

function buildProbeEnv(edition: "FULL" | "ATTENDANCE"): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (["APP_EDITION", "DATABASE_URL", "NODE_ENV"].includes(key.toUpperCase())) {
      delete childEnv[key];
    }
  }

  childEnv["APP_EDITION"] = edition;
  childEnv["DATABASE_URL"] = TEST_DATABASE_URL;
  childEnv["NODE_ENV"] = "test";
  childEnv["DOTENV_CONFIG_PATH"] = path.join(__dirname, `.auth-permissions-missing-${process.pid}.env`);
  childEnv["DOTENV_CONFIG_QUIET"] = "true";
  return childEnv;
}

function runWrapperProbe(edition: "FULL" | "ATTENDANCE"): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [__filename, WRAPPER_PROBE], {
    cwd: __dirname,
    encoding: "utf8",
    env: buildProbeEnv(edition),
    shell: false,
    timeout: 10_000,
    windowsHide: true,
  });
}

function describeProbe(result: SpawnSyncReturns<string>): string {
  return JSON.stringify({
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
}

function testDatabaseResolverWrapperUsesEditionPolicy(): void {
  for (const edition of ["FULL", "ATTENDANCE"] as const) {
    const result = runWrapperProbe(edition);
    assert.equal(result.error, undefined, describeProbe(result));
    assert.equal(result.signal, null, describeProbe(result));
    assert.equal(result.status, 0, describeProbe(result));

    const expected = edition === "FULL"
      ? sortedPermissions(ALL_PERMISSIONS.filter((permission) => permission !== AdminPermission.SIGN_IN))
      : sortedPermissions([
          AdminPermission.ATTENDANCE_JUSTIFY,
          AdminPermission.ATTENDANCE_MANUAL,
          AdminPermission.ATTENDANCE_VIEW,
          AdminPermission.ATTENDANCE_EXPORT,
          AdminPermission.ADMIN_USERS_MANAGE,
          AdminPermission.AUDIT_LOG_VIEW,
          AdminPermission.BACKUP_CREATE,
          AdminPermission.BACKUP_SETTINGS_MANAGE,
          AdminPermission.DEVICES_ENROLL,
          AdminPermission.DEVICES_USER_SYNC,
          AdminPermission.DEVICES_VIEW,
          AdminPermission.MEMBERS_VIEW,
          AdminPermission.MEMBERS_WRITE,
          AdminPermission.SYSTEM_SETTINGS_MANAGE,
          AdminPermission.ROLES_MANAGE,
          AdminPermission.RESTORE_DATABASE,
        ]);
    assert.equal(result.stdout, `WRAPPER_OK:${JSON.stringify(expected)}`);
  }
}

async function runWrapperProbeChild(): Promise<void> {
  const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
  const { listEffectivePermissions } = require("./auth.permissions") as typeof import("./auth.permissions");
  const prismaForTest = prisma as any;
  const originalRoleFindMany = prismaForTest.adminRolePermission.findMany;
  const originalOverrideFindMany = prismaForTest.adminUserPermission.findMany;

  prismaForTest.adminRolePermission.findMany = async () =>
    ALL_PERMISSIONS.map((permission) => ({ permission }));
  prismaForTest.adminUserPermission.findMany = async () => [
    { permission: AdminPermission.SIGN_IN, mode: PermissionMode.DENY },
    { permission: AdminPermission.FINANCIAL_EXPORT, mode: PermissionMode.ALLOW },
  ];

  try {
    const permissions = await listEffectivePermissions("permission-probe-user", AdminRole.VENDOR_OWNER);
    process.stdout.write(`WRAPPER_OK:${JSON.stringify(permissions)}`);
  } finally {
    prismaForTest.adminRolePermission.findMany = originalRoleFindMany;
    prismaForTest.adminUserPermission.findMany = originalOverrideFindMany;
    await prisma.$disconnect();
  }
}

function runSuite(): void {
  testExactPermissionCapabilityPolicy();
  testAttendanceRoleBundlesMatchApprovedMapping();
  testFullEditionPreservesExistingBehavior();
  testAttendanceAuthReadinessRemainsCapabilityFiltered();
  testAttendanceFutureCapabilityIntersection();
  testAttendanceHardDenyAndOptionalBoundaries();
  testDatabaseResolverWrapperUsesEditionPolicy();
  console.log("ok - effective permissions preserve FULL and fail closed by ATTENDANCE capability");
}

async function main(): Promise<void> {
  if (process.argv[2] === WRAPPER_PROBE) {
    await runWrapperProbeChild();
    return;
  }
  if (process.argv[2] !== undefined) {
    throw new Error(`Unknown probe: ${process.argv[2]}`);
  }
  runSuite();
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
