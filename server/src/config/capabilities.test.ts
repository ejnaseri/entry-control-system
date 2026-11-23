import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  CAPABILITY_NAMES,
  CAPABILITY_REGISTRY,
  CODE_READY_FEATURES_BY_EDITION,
  DEFAULT_OPTIONAL_FEATURE_FLAGS,
  OPTIONAL_FEATURE_FLAG_NAMES,
  getEffectiveFeatures,
  getTargetFeatures,
  isFeatureEnabled,
  type Capability,
  type CapabilityDefinition,
  type OptionalFeatureFlags,
} from "./capabilities";

const EXPECTED_MATRIX = {
  AUTH: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_1_4_AUTH_CONTRACT",
  },
  EMPLOYEES: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  },
  STAFF_GROUPS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  },
  ATTENDANCE_DAILY: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  },
  ENTRY_LOGS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  },
  DEVICES: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  },
  ADMIN_USERS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_3_6_ADMIN_USERS",
  },
  ATTENDANCE_DASHBOARD: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  },
  ATTENDANCE_REPORTS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  },
  ATTENDANCE_EXPORT: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  },
  AUDIT_LOGS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_5_OPERATIONS_ISOLATION",
  },
  BACKUPS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_5_OPERATIONS_ISOLATION",
  },
  ATTENDANCE_COMPLIANCE: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_ATTENDANCE_COMPLIANCE",
    activationGate: "OPTIONAL_O_1_COMPLIANCE",
  },
  INBOX: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_INBOX",
    activationGate: "OPTIONAL_O_2_INBOX",
  },
  SOUNDS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_SOUNDS",
    activationGate: "OPTIONAL_O_3_SOUNDS",
  },
  DEVICE_DIAGNOSTICS: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_DEVICE_DIAGNOSTICS",
    activationGate: "OPTIONAL_O_4_DEVICE_DIAGNOSTICS",
  },
  DOOR_CONTROL: {
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_DOOR_CONTROL",
    activationGate: "OPTIONAL_O_5_DOOR_CONTROL",
  },
  CUSTOMERS: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  MEMBERSHIPS: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  CUSTOMER_PAYMENTS: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  PAYROLL: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  EXPENSES: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  FINANCIAL_REPORTS: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  },
  ICLOCK_ADMS: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "SCOPE_CHANGE_ICLOCK_SECURITY",
  },
  GENERIC_DEVICE_PUSH: {
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "SCOPE_CHANGE_PUSH_HARDENING",
  },
} satisfies Record<Capability, CapabilityDefinition>;

const REQUIRED_ATTENDANCE_FEATURES = [
  "AUTH",
  "ATTENDANCE_DASHBOARD",
  "EMPLOYEES",
  "ATTENDANCE_DAILY",
  "ENTRY_LOGS",
  "DEVICES",
  "ATTENDANCE_REPORTS",
  "ATTENDANCE_EXPORT",
  "STAFF_GROUPS",
  "ADMIN_USERS",
  "AUDIT_LOGS",
  "BACKUPS",
] as const satisfies readonly Capability[];

const OPTIONAL_ATTENDANCE_FEATURES = [
  "ATTENDANCE_COMPLIANCE",
  "INBOX",
  "SOUNDS",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
] as const satisfies readonly Capability[];

const EXCLUDED_ATTENDANCE_FEATURES = [
  "CUSTOMERS",
  "MEMBERSHIPS",
  "CUSTOMER_PAYMENTS",
  "PAYROLL",
  "EXPENSES",
  "FINANCIAL_REPORTS",
  "ICLOCK_ADMS",
  "GENERIC_DEVICE_PUSH",
] as const satisfies readonly Capability[];

const EXPECTED_FULL_CODE_READY_FEATURES = [
  "ADMIN_USERS",
  "ATTENDANCE_COMPLIANCE",
  "ATTENDANCE_DAILY",
  "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_REPORTS",
  "AUDIT_LOGS",
  "AUTH",
  "BACKUPS",
  "CUSTOMERS",
  "CUSTOMER_PAYMENTS",
  "DEVICES",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
  "EMPLOYEES",
  "ENTRY_LOGS",
  "EXPENSES",
  "FINANCIAL_REPORTS",
  "GENERIC_DEVICE_PUSH",
  "ICLOCK_ADMS",
  "INBOX",
  "MEMBERSHIPS",
  "PAYROLL",
  "SOUNDS",
  "STAFF_GROUPS",
] as const satisfies readonly Capability[];

const EXPECTED_ATTENDANCE_CODE_READY_FEATURES = ["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"] as const satisfies readonly Capability[];

const ALL_OPTIONAL_FLAGS_ENABLED: OptionalFeatureFlags = Object.freeze({
  APP_FEATURE_ATTENDANCE_COMPLIANCE: true,
  APP_FEATURE_INBOX: true,
  APP_FEATURE_SOUNDS: true,
  APP_FEATURE_DEVICE_DIAGNOSTICS: true,
  APP_FEATURE_DOOR_CONTROL: true,
});

function compareIdentifiers(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sorted(values: readonly Capability[]): Capability[] {
  return [...values].sort(compareIdentifiers);
}

function assertSortedAndUnique(values: readonly Capability[], label: string): void {
  assert.deepEqual(values, sorted(values), `${label} should use stable identifier ordering`);
  assert.equal(new Set(values).size, values.length, `${label} should not contain duplicates`);
}

function assertFrozenArray(values: readonly Capability[], label: string): void {
  const before = [...values];
  assert.ok(Object.isFrozen(values), `${label} should be frozen`);
  assert.throws(() => (values as Capability[]).push("AUTH"), TypeError);
  assert.deepEqual(values, before, `${label} changed after a mutation attempt`);
}

function testExactRegistryMatrix(): void {
  const expectedNames = sorted(Object.keys(EXPECTED_MATRIX) as Capability[]);
  assert.equal(expectedNames.length, 25);
  assert.deepEqual(CAPABILITY_NAMES, expectedNames);
  assert.deepEqual(CAPABILITY_REGISTRY, EXPECTED_MATRIX);
  assertSortedAndUnique(CAPABILITY_NAMES, "Capability names");

  assert.deepEqual(
    OPTIONAL_FEATURE_FLAG_NAMES,
    [
      "APP_FEATURE_ATTENDANCE_COMPLIANCE",
      "APP_FEATURE_INBOX",
      "APP_FEATURE_SOUNDS",
      "APP_FEATURE_DEVICE_DIAGNOSTICS",
      "APP_FEATURE_DOOR_CONTROL",
    ]
  );
  assert.deepEqual(DEFAULT_OPTIONAL_FEATURE_FLAGS, {
    APP_FEATURE_ATTENDANCE_COMPLIANCE: false,
    APP_FEATURE_INBOX: false,
    APP_FEATURE_SOUNDS: false,
    APP_FEATURE_DEVICE_DIAGNOSTICS: false,
    APP_FEATURE_DOOR_CONTROL: false,
  });

  for (const capability of OPTIONAL_ATTENDANCE_FEATURES) {
    const definition: CapabilityDefinition = CAPABILITY_REGISTRY[capability];
    assert.equal(definition.attendanceTarget, true);
    assert.equal(definition.attendanceOptional, true);
    assert.notEqual(definition.optionalFlag, null);
  }
  for (const capability of [...REQUIRED_ATTENDANCE_FEATURES, ...EXCLUDED_ATTENDANCE_FEATURES]) {
    const definition: CapabilityDefinition = CAPABILITY_REGISTRY[capability];
    assert.equal(definition.attendanceOptional, false);
    assert.equal(definition.optionalFlag, null);
  }
}

function testTargetAndEffectiveFeatures(): void {
  const expectedFullTargets = sorted(CAPABILITY_NAMES);
  const expectedAttendanceTargets = sorted([
    ...REQUIRED_ATTENDANCE_FEATURES,
    ...OPTIONAL_ATTENDANCE_FEATURES,
  ]);
  const expectedFullEffective = sorted(EXPECTED_FULL_CODE_READY_FEATURES);

  assert.deepEqual(getTargetFeatures("FULL"), expectedFullTargets);
  assert.deepEqual(getTargetFeatures("ATTENDANCE"), expectedAttendanceTargets);
  assert.equal(getTargetFeatures("FULL").length, 25);
  assert.equal(getTargetFeatures("ATTENDANCE").length, 17);
  assert.equal(expectedFullEffective.length, 25);

  assert.deepEqual(CODE_READY_FEATURES_BY_EDITION.FULL, expectedFullEffective);
  assert.deepEqual(CODE_READY_FEATURES_BY_EDITION.ATTENDANCE, EXPECTED_ATTENDANCE_CODE_READY_FEATURES);
  assert.deepEqual(getEffectiveFeatures("FULL"), expectedFullEffective);
  assert.deepEqual(getEffectiveFeatures("FULL", ALL_OPTIONAL_FLAGS_ENABLED), expectedFullEffective);
  assert.deepEqual(getEffectiveFeatures("ATTENDANCE"), EXPECTED_ATTENDANCE_CODE_READY_FEATURES);
  assert.deepEqual(
    getEffectiveFeatures("ATTENDANCE", ALL_OPTIONAL_FLAGS_ENABLED),
    EXPECTED_ATTENDANCE_CODE_READY_FEATURES
  );

  assert.equal(isFeatureEnabled("FULL", "FINANCIAL_REPORTS"), true);
  assert.equal(isFeatureEnabled("FULL", "INBOX"), true);
  assert.equal(isFeatureEnabled("FULL", "ATTENDANCE_EXPORT"), true);
  assert.equal(isFeatureEnabled("ATTENDANCE", "AUTH", ALL_OPTIONAL_FLAGS_ENABLED), true);
  for (const capability of CAPABILITY_NAMES) {
    if (!["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"].includes(capability)) {
      assert.equal(isFeatureEnabled("ATTENDANCE", capability, ALL_OPTIONAL_FLAGS_ENABLED), false);
    }
  }
  for (const capability of EXCLUDED_ATTENDANCE_FEATURES) {
    assert.equal(getTargetFeatures("ATTENDANCE").includes(capability), false);
  }

  for (const [label, features] of [
    ["FULL targets", getTargetFeatures("FULL")],
    ["ATTENDANCE targets", getTargetFeatures("ATTENDANCE")],
    ["FULL effective", getEffectiveFeatures("FULL")],
    ["ATTENDANCE effective", getEffectiveFeatures("ATTENDANCE")],
  ] as const) {
    assertSortedAndUnique(features, label);
  }

  assert.deepEqual(getEffectiveFeatures("FULL"), getEffectiveFeatures("FULL"));
  assert.deepEqual(getEffectiveFeatures("ATTENDANCE"), getEffectiveFeatures("ATTENDANCE"));
}

function testRuntimeImmutability(): void {
  assert.ok(Object.isFrozen(CAPABILITY_REGISTRY));
  assert.ok(Object.isFrozen(CAPABILITY_NAMES));
  assert.ok(Object.isFrozen(CODE_READY_FEATURES_BY_EDITION));
  assert.ok(Object.isFrozen(DEFAULT_OPTIONAL_FEATURE_FLAGS));
  assert.ok(Object.isFrozen(OPTIONAL_FEATURE_FLAG_NAMES));

  for (const definition of Object.values(CAPABILITY_REGISTRY)) {
    assert.ok(Object.isFrozen(definition));
  }
  assertFrozenArray(CAPABILITY_NAMES, "Capability names");
  assertFrozenArray(CODE_READY_FEATURES_BY_EDITION.FULL, "FULL code-ready features");
  assertFrozenArray(CODE_READY_FEATURES_BY_EDITION.ATTENDANCE, "ATTENDANCE code-ready features");
  assertFrozenArray(getTargetFeatures("FULL"), "FULL target output");
  assertFrozenArray(getTargetFeatures("ATTENDANCE"), "ATTENDANCE target output");
  assertFrozenArray(getEffectiveFeatures("FULL"), "FULL effective output");
  assertFrozenArray(getEffectiveFeatures("ATTENDANCE"), "ATTENDANCE effective output");

  const originalTarget = CAPABILITY_REGISTRY.AUTH.attendanceTarget;
  assert.throws(() => {
    (CAPABILITY_REGISTRY.AUTH as unknown as { attendanceTarget: boolean }).attendanceTarget = false;
  }, TypeError);
  assert.equal(CAPABILITY_REGISTRY.AUTH.attendanceTarget, originalTarget);

  assert.throws(() => {
    (
      DEFAULT_OPTIONAL_FEATURE_FLAGS as unknown as {
        APP_FEATURE_INBOX: boolean;
      }
    ).APP_FEATURE_INBOX = true;
  }, TypeError);
  assert.equal(DEFAULT_OPTIONAL_FEATURE_FLAGS.APP_FEATURE_INBOX, false);
}

function testImportHasNoEnvironmentSideEffects(): void {
  const modulePath = path.resolve(__dirname, "capabilities.js");
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (key.toUpperCase() === "DATABASE_URL" || key.toUpperCase() === "APP_EDITION") {
      delete childEnv[key];
    }
  }
  childEnv["APP_EDITION"] = "invalid-on-purpose";
  childEnv["DOTENV_CONFIG_PATH"] = path.join(__dirname, `.capabilities-test-missing-${process.pid}.env`);
  childEnv["DOTENV_CONFIG_QUIET"] = "true";

  const script = `const registry = require(${JSON.stringify(modulePath)}); process.stdout.write('CAPABILITIES_OK:' + registry.CAPABILITY_NAMES.length);`;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: __dirname,
    encoding: "utf8",
    env: childEnv,
    shell: false,
    timeout: 5_000,
    windowsHide: true,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "CAPABILITIES_OK:25");
}

function run(): void {
  testExactRegistryMatrix();
  testTargetAndEffectiveFeatures();
  testRuntimeImmutability();
  testImportHasNoEnvironmentSideEffects();
  console.log("ok - capability registry matrix, readiness, flags, ordering, purity, and immutability");
}

run();
