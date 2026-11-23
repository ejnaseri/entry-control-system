import type { AppEdition } from "../shared/app-identity";
import {
  CAPABILITY_NAMES,
  type Capability,
} from "../shared/capability-contract";

export { CAPABILITY_NAMES };
export type { Capability };

export const OPTIONAL_FEATURE_FLAG_NAMES = Object.freeze([
  "APP_FEATURE_ATTENDANCE_COMPLIANCE",
  "APP_FEATURE_INBOX",
  "APP_FEATURE_SOUNDS",
  "APP_FEATURE_DEVICE_DIAGNOSTICS",
  "APP_FEATURE_DOOR_CONTROL",
] as const);

export type OptionalFeatureFlagName = (typeof OPTIONAL_FEATURE_FLAG_NAMES)[number];

export type CapabilityActivationGate =
  | "PHASE_1_4_AUTH_CONTRACT"
  | "PHASE_2_STAFF_ISOLATION"
  | "PHASE_3_6_ADMIN_USERS"
  | "PHASE_4_ATTENDANCE_ANALYTICS"
  | "PHASE_5_OPERATIONS_ISOLATION"
  | "OPTIONAL_O_1_COMPLIANCE"
  | "OPTIONAL_O_2_INBOX"
  | "OPTIONAL_O_3_SOUNDS"
  | "OPTIONAL_O_4_DEVICE_DIAGNOSTICS"
  | "OPTIONAL_O_5_DOOR_CONTROL"
  | "EXCLUDED_ATTENDANCE_V1"
  | "SCOPE_CHANGE_ICLOCK_SECURITY"
  | "SCOPE_CHANGE_PUSH_HARDENING";

type CapabilityDefinitionBase = Readonly<{
  fullTarget: true;
  activationGate: CapabilityActivationGate;
}>;

export type CapabilityDefinition =
  | (CapabilityDefinitionBase &
      Readonly<{
        attendanceTarget: true;
        attendanceOptional: false;
        optionalFlag: null;
      }>)
  | (CapabilityDefinitionBase &
      Readonly<{
        attendanceTarget: true;
        attendanceOptional: true;
        optionalFlag: OptionalFeatureFlagName;
      }>)
  | (CapabilityDefinitionBase &
      Readonly<{
        attendanceTarget: false;
        attendanceOptional: false;
        optionalFlag: null;
      }>);

function defineCapability(definition: CapabilityDefinition): CapabilityDefinition {
  return Object.freeze({ ...definition });
}

const registry = {
  AUTH: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_1_4_AUTH_CONTRACT",
  }),
  EMPLOYEES: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  }),
  STAFF_GROUPS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  }),
  ATTENDANCE_DAILY: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  }),
  ENTRY_LOGS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  }),
  DEVICES: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_2_STAFF_ISOLATION",
  }),
  ADMIN_USERS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_3_6_ADMIN_USERS",
  }),
  ATTENDANCE_DASHBOARD: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  }),
  ATTENDANCE_REPORTS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  }),
  ATTENDANCE_EXPORT: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_4_ATTENDANCE_ANALYTICS",
  }),
  AUDIT_LOGS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_5_OPERATIONS_ISOLATION",
  }),
  BACKUPS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "PHASE_5_OPERATIONS_ISOLATION",
  }),
  ATTENDANCE_COMPLIANCE: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_ATTENDANCE_COMPLIANCE",
    activationGate: "OPTIONAL_O_1_COMPLIANCE",
  }),
  INBOX: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_INBOX",
    activationGate: "OPTIONAL_O_2_INBOX",
  }),
  SOUNDS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_SOUNDS",
    activationGate: "OPTIONAL_O_3_SOUNDS",
  }),
  DEVICE_DIAGNOSTICS: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_DEVICE_DIAGNOSTICS",
    activationGate: "OPTIONAL_O_4_DEVICE_DIAGNOSTICS",
  }),
  DOOR_CONTROL: defineCapability({
    fullTarget: true,
    attendanceTarget: true,
    attendanceOptional: true,
    optionalFlag: "APP_FEATURE_DOOR_CONTROL",
    activationGate: "OPTIONAL_O_5_DOOR_CONTROL",
  }),
  CUSTOMERS: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  MEMBERSHIPS: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  CUSTOMER_PAYMENTS: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  PAYROLL: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  EXPENSES: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  FINANCIAL_REPORTS: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "EXCLUDED_ATTENDANCE_V1",
  }),
  ICLOCK_ADMS: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "SCOPE_CHANGE_ICLOCK_SECURITY",
  }),
  GENERIC_DEVICE_PUSH: defineCapability({
    fullTarget: true,
    attendanceTarget: false,
    attendanceOptional: false,
    optionalFlag: null,
    activationGate: "SCOPE_CHANGE_PUSH_HARDENING",
  }),
} as const satisfies Record<Capability, CapabilityDefinition>;

export const CAPABILITY_REGISTRY: Readonly<Record<Capability, CapabilityDefinition>> = Object.freeze(registry);

function compareIdentifiers(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function freezeSortedCapabilities(capabilities: Capability[]): readonly Capability[] {
  return Object.freeze(capabilities.sort(compareIdentifiers));
}

const FULL_CODE_READY_FEATURE_VALUES = [
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

export const CODE_READY_FEATURES_BY_EDITION: Readonly<Record<AppEdition, readonly Capability[]>> = Object.freeze({
  FULL: freezeSortedCapabilities([...FULL_CODE_READY_FEATURE_VALUES]),
  ATTENDANCE: freezeSortedCapabilities(["ADMIN_USERS", "ATTENDANCE_DAILY", "ATTENDANCE_DASHBOARD", "ATTENDANCE_EXPORT", "ATTENDANCE_REPORTS", "AUDIT_LOGS", "AUTH", "BACKUPS", "DEVICES", "EMPLOYEES", "ENTRY_LOGS"]),
});

export const DEFAULT_OPTIONAL_FEATURE_FLAGS: Readonly<Record<OptionalFeatureFlagName, boolean>> = Object.freeze({
  APP_FEATURE_ATTENDANCE_COMPLIANCE: false,
  APP_FEATURE_INBOX: false,
  APP_FEATURE_SOUNDS: false,
  APP_FEATURE_DEVICE_DIAGNOSTICS: false,
  APP_FEATURE_DOOR_CONTROL: false,
});

export type OptionalFeatureFlags = Readonly<Record<OptionalFeatureFlagName, boolean>>;

function isTargetFeature(edition: AppEdition, definition: CapabilityDefinition): boolean {
  return edition === "FULL" ? definition.fullTarget : definition.attendanceTarget;
}

export function getTargetFeatures(edition: AppEdition): readonly Capability[] {
  return freezeSortedCapabilities(
    CAPABILITY_NAMES.filter((capability) => isTargetFeature(edition, CAPABILITY_REGISTRY[capability]))
  );
}

export function getEffectiveFeatures(
  edition: AppEdition,
  optionalFlags: OptionalFeatureFlags = DEFAULT_OPTIONAL_FEATURE_FLAGS
): readonly Capability[] {
  const codeReadyFeatures = new Set(CODE_READY_FEATURES_BY_EDITION[edition]);

  return freezeSortedCapabilities(
    CAPABILITY_NAMES.filter((capability) => {
      const definition = CAPABILITY_REGISTRY[capability];
      if (!isTargetFeature(edition, definition) || !codeReadyFeatures.has(capability)) {
        return false;
      }
      if (edition === "ATTENDANCE" && definition.attendanceOptional) {
        return definition.optionalFlag !== null && optionalFlags[definition.optionalFlag];
      }
      return true;
    })
  );
}

export function isFeatureEnabled(
  edition: AppEdition,
  capability: Capability,
  optionalFlags: OptionalFeatureFlags = DEFAULT_OPTIONAL_FEATURE_FLAGS
): boolean {
  return getEffectiveFeatures(edition, optionalFlags).includes(capability);
}
