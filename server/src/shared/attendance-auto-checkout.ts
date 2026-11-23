import type { AppEdition } from "./app-identity";

export const ATTENDANCE_AUTO_CHECKOUT_SETTINGS = Object.freeze(["0", "1"] as const);

export type AttendanceAutoCheckoutSetting = (typeof ATTENDANCE_AUTO_CHECKOUT_SETTINGS)[number];

export type AttendanceAutoCheckoutDecision = Readonly<{
  operational: boolean;
  mode: "LEGACY_FULL" | "ATTENDANCE_V1_DISABLED";
}>;

const LEGACY_FULL_DECISION: AttendanceAutoCheckoutDecision = Object.freeze({
  operational: true,
  mode: "LEGACY_FULL",
});

const ATTENDANCE_V1_DISABLED_DECISION: AttendanceAutoCheckoutDecision = Object.freeze({
  operational: false,
  mode: "ATTENDANCE_V1_DISABLED",
});

/**
 * Phase 2.5 protects Attendance from synthetic punches independently of the
 * Inbox capability boundary. Setting `1` is reserved for a later explicit
 * scope change; it does not activate auto-checkout in Attendance v1. FULL
 * keeps its legacy behavior for both accepted configuration values.
 */
export function resolveAttendanceAutoCheckoutDecision(
  edition: AppEdition,
  setting: AttendanceAutoCheckoutSetting
): AttendanceAutoCheckoutDecision {
  switch (setting) {
    case "0":
    case "1":
      return edition === "FULL" ? LEGACY_FULL_DECISION : ATTENDANCE_V1_DISABLED_DECISION;
  }

  const unreachable: never = setting;
  throw new Error(`Unsupported attendance auto-checkout setting: ${String(unreachable)}`);
}
