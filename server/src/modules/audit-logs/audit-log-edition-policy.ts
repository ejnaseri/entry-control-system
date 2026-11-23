import { Prisma } from "@prisma/client";
import type { AppEdition } from "../../config/env";

export const ATTENDANCE_AUDIT_SCOPE_MARKER = "ATTENDANCE_STRICT_STAFF";

type EvidenceRequirement =
  | "NONE"
  | "STRICT_MEMBER_AFTER"
  | "STRICT_MEMBER_BEFORE"
  | "STRICT_MEMBER_BEFORE_AND_AFTER"
  | "STRICT_ATTENDANCE_MARKER"
  | "STRICT_REPORT_FILTER";

type AuditVisibilityRule = Readonly<{
  actions?: readonly string[];
  actionPrefix?: string;
  targetTypes: readonly string[];
  evidence: EvidenceRequirement;
}>;

const ATTENDANCE_DEVICE_ACTIONS = Object.freeze([
  "device.created",
  "device.updated",
  "device.enabled",
  "device.disabled",
  "device.tested",
  "device.connection_tested",
  "device.enrollment.started",
  "device.users.synced",
  "device.user.upserted",
  "device.user.deleted",
  "device.time.updated",
] as const);

const ATTENDANCE_AUDIT_RULES: readonly AuditVisibilityRule[] = Object.freeze([
  Object.freeze({ actionPrefix: "auth.", targetTypes: Object.freeze(["AdminUser"]), evidence: "NONE" }),
  Object.freeze({ actionPrefix: "admin_user.", targetTypes: Object.freeze(["AdminUser"]), evidence: "NONE" }),
  Object.freeze({ actionPrefix: "vendor_maintenance.", targetTypes: Object.freeze(["AdminUser"]), evidence: "NONE" }),
  Object.freeze({
    actionPrefix: "backup.",
    targetTypes: Object.freeze([
      "Backup",
      "BackupConfig",
      "BackupFolder",
      "BackupJob",
      "BackupStorage",
      "RestoreJob",
      "SystemSetting",
    ]),
    evidence: "NONE",
  }),
  Object.freeze({
    actions: Object.freeze(["staff_group.created", "staff_group.updated", "staff_group.deleted"]),
    targetTypes: Object.freeze(["StaffGroup"]),
    evidence: "NONE",
  }),
  Object.freeze({
    actions: Object.freeze(["member.created"]),
    targetTypes: Object.freeze(["Member"]),
    evidence: "STRICT_MEMBER_AFTER",
  }),
  Object.freeze({
    actions: Object.freeze(["member.updated", "member.shifts.updated"]),
    targetTypes: Object.freeze(["Member"]),
    evidence: "STRICT_MEMBER_BEFORE_AND_AFTER",
  }),
  Object.freeze({
    actions: Object.freeze(["member.deleted"]),
    targetTypes: Object.freeze(["Member"]),
    evidence: "STRICT_MEMBER_BEFORE",
  }),
  Object.freeze({
    actions: Object.freeze([
      "attendance.manual.created",
      "attendance.justification.created",
      "attendance.justification.updated",
      "attendance.justification.deleted",
    ]),
    targetTypes: Object.freeze(["AttendanceLog", "AttendanceJustification"]),
    evidence: "STRICT_ATTENDANCE_MARKER",
  }),
  Object.freeze({
    actions: ATTENDANCE_DEVICE_ACTIONS,
    targetTypes: Object.freeze(["Device"]),
    evidence: "NONE",
  }),
  ...[
    ["report.attendance.exported", "AttendanceReport"],
    ["report.daily_attendance.exported", "DailyAttendanceReport"],
    ["report.entry_logs.exported", "EntryLogsReport"],
    ["report.monthly_timecard.exported", "MonthlyTimecard"],
  ].map(([action, targetType]) => Object.freeze({
    actions: Object.freeze([action!]),
    targetTypes: Object.freeze([targetType!]),
    evidence: "STRICT_REPORT_FILTER" as const,
  })),
]);

export type AuditVisibilityProbe = Readonly<{
  action: string;
  targetType: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
}>;

export function getAuditLogVisibilityWhere(edition: AppEdition): Prisma.AuditLogWhereInput {
  if (edition === "FULL") return {};
  return { OR: ATTENDANCE_AUDIT_RULES.map(compileRule) };
}

export function isAuditLogVisibleForEdition(edition: AppEdition, row: AuditVisibilityProbe): boolean {
  if (edition === "FULL") return true;
  return ATTENDANCE_AUDIT_RULES.some((rule) => {
    const actionMatches = rule.actions?.includes(row.action)
      ?? (rule.actionPrefix ? row.action.startsWith(rule.actionPrefix) : false);
    return actionMatches
      && row.targetType !== null
      && rule.targetTypes.includes(row.targetType)
      && evidenceMatches(rule.evidence, row);
  });
}

function compileRule(rule: AuditVisibilityRule): Prisma.AuditLogWhereInput {
  const base: Prisma.AuditLogWhereInput = {
    action: rule.actions ? { in: [...rule.actions] } : { startsWith: rule.actionPrefix! },
    targetType: { in: [...rule.targetTypes] },
  };
  const evidence = compileEvidence(rule.evidence);
  return evidence ? { AND: [base, evidence] } : base;
}

function compileEvidence(requirement: EvidenceRequirement): Prisma.AuditLogWhereInput | null {
  switch (requirement) {
    case "NONE":
      return null;
    case "STRICT_MEMBER_AFTER":
      return strictMemberJsonWhere("afterData");
    case "STRICT_MEMBER_BEFORE":
      return strictMemberJsonWhere("beforeData");
    case "STRICT_MEMBER_BEFORE_AND_AFTER":
      return { AND: [strictMemberJsonWhere("beforeData"), strictMemberJsonWhere("afterData")] };
    case "STRICT_ATTENDANCE_MARKER":
      return jsonEquals("metadata", ["editionScope"], ATTENDANCE_AUDIT_SCOPE_MARKER);
    case "STRICT_REPORT_FILTER":
      return jsonEquals("metadata", ["filters", "memberType"], "staff");
  }
}

function strictMemberJsonWhere(field: "beforeData" | "afterData"): Prisma.AuditLogWhereInput {
  return {
    AND: [
      jsonEquals(field, ["memberType"], "STAFF"),
      jsonEquals(field, ["isStaff"], true),
    ],
  };
}

function jsonEquals(
  field: "beforeData" | "afterData" | "metadata",
  path: readonly string[],
  equals: string | boolean
): Prisma.AuditLogWhereInput {
  return {
    [field]: { path: [...path], equals },
  } as Prisma.AuditLogWhereInput;
}

function evidenceMatches(requirement: EvidenceRequirement, row: AuditVisibilityProbe): boolean {
  switch (requirement) {
    case "NONE":
      return true;
    case "STRICT_MEMBER_AFTER":
      return isStrictStaffSnapshot(row.afterData);
    case "STRICT_MEMBER_BEFORE":
      return isStrictStaffSnapshot(row.beforeData);
    case "STRICT_MEMBER_BEFORE_AND_AFTER":
      return isStrictStaffSnapshot(row.beforeData) && isStrictStaffSnapshot(row.afterData);
    case "STRICT_ATTENDANCE_MARKER":
      return readJsonPath(row.metadata, ["editionScope"]) === ATTENDANCE_AUDIT_SCOPE_MARKER;
    case "STRICT_REPORT_FILTER":
      return readJsonPath(row.metadata, ["filters", "memberType"]) === "staff";
  }
}

function isStrictStaffSnapshot(value: unknown): boolean {
  return readJsonPath(value, ["memberType"]) === "STAFF" && readJsonPath(value, ["isStaff"]) === true;
}

function readJsonPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
