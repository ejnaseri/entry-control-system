import assert from "node:assert/strict";
import {
  AttendanceSource,
  AttendanceType,
  MemberStatus,
  MemberType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  getAttendanceReportDaily,
  getAttendanceReportMembers,
  getAttendanceReportSummary,
} from "../reports-attendance/reports-attendance.service";
import { ATTENDANCE_DATA_SCOPES, buildStrictStaffMemberWhere } from "./attendance-edition-scope";
import { listDailyAttendance } from "./attendance.service";

type Scenario =
  | "on-time"
  | "late"
  | "early-arrival"
  | "early-leave"
  | "overtime"
  | "missing-checkout"
  | "multiple-events"
  | "overnight"
  | "absent"
  | "justified"
  | "unscheduled";

type FixtureMember = {
  id: string;
  code: string;
  firstName: string;
  lastName: string;
  memberType: MemberType;
  isStaff: boolean;
  status: MemberStatus;
  archivedAt: Date | null;
  staffGroupId: string | null;
  staffGroup: { id: string; name: string } | null;
};

type FixtureShift = {
  id: string;
  memberId: string;
  shiftId: string;
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  weekdays: number[];
  graceMinutes: number;
  isActive: boolean;
};

type FixtureLog = {
  id: string;
  memberId: string;
  entryType: AttendanceType;
  recordedAt: Date;
  source: AttendanceSource;
  isAuthorized: boolean;
  reason: string | null;
};

const STRICT = ATTENDANCE_DATA_SCOPES.STRICT_STAFF;
const DATE = "2026-09-07";
const DAY = new Date(2026, 8, 7, 0, 0, 0, 0);
const STAFF_GROUP = { id: "phase-26-group", name: "Phase 2.6" };
const scenarios: Scenario[] = [
  "on-time",
  "late",
  "early-arrival",
  "early-leave",
  "overtime",
  "missing-checkout",
  "multiple-events",
  "overnight",
  "absent",
  "justified",
  "unscheduled",
];

const members = scenarios.map((scenario): FixtureMember => ({
  id: `phase-26-${scenario}`,
  code: `P26-${scenario.toUpperCase()}`,
  firstName: "Phase26",
  lastName: scenario,
  memberType: MemberType.STAFF,
  isStaff: true,
  status: MemberStatus.ACTIVE,
  archivedAt: null,
  staffGroupId: STAFF_GROUP.id,
  staffGroup: STAFF_GROUP,
}));

const unsafeMembers: FixtureMember[] = [
  {
    ...members[0]!,
    id: "phase-26-customer",
    code: "LEAK-CUSTOMER",
    lastName: "Customer leak",
    memberType: MemberType.CUSTOMER,
    isStaff: false,
  },
  {
    ...members[0]!,
    id: "phase-26-type-mismatch",
    code: "LEAK-TYPE-MISMATCH",
    lastName: "Type mismatch leak",
    memberType: MemberType.CUSTOMER,
    isStaff: true,
  },
  {
    ...members[0]!,
    id: "phase-26-flag-mismatch",
    code: "LEAK-FLAG-MISMATCH",
    lastName: "Flag mismatch leak",
    memberType: MemberType.STAFF,
    isStaff: false,
  },
];

const allMembers = [...members, ...unsafeMembers];
const memberById = new Map(allMembers.map((member) => [member.id, member]));
const scheduledScenarios = scenarios.filter((scenario) => scenario !== "unscheduled");
const shifts: FixtureShift[] = scheduledScenarios.map((scenario, index) => ({
  id: `phase-26-shift-${index + 1}`,
  memberId: memberId(scenario),
  shiftId: `phase-26-template-${index + 1}`,
  shiftName: scenario === "overnight" ? "Overnight" : "Day",
  shiftStart: scenario === "overnight" ? "22:00" : "09:00",
  shiftEnd: scenario === "overnight" ? "06:00" : "17:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  graceMinutes: 0,
  isActive: true,
}));

const logs: FixtureLog[] = [
  log("on-time", "in", 9, 0, AttendanceType.IN),
  log("on-time", "out", 17, 0, AttendanceType.OUT),
  log("late", "in", 9, 30, AttendanceType.IN),
  log("late", "out", 17, 0, AttendanceType.OUT),
  log("early-arrival", "in", 8, 30, AttendanceType.IN),
  log("early-arrival", "out", 17, 0, AttendanceType.OUT),
  log("early-leave", "in", 9, 0, AttendanceType.IN),
  log("early-leave", "out", 15, 30, AttendanceType.OUT),
  log("overtime", "in", 9, 0, AttendanceType.IN),
  log("overtime", "out", 19, 30, AttendanceType.OUT),
  log("missing-checkout", "in", 9, 0, AttendanceType.IN),
  log("multiple-events", "in-1", 9, 0, AttendanceType.IN),
  log("multiple-events", "out-1", 12, 0, AttendanceType.OUT),
  log("multiple-events", "in-2", 13, 0, AttendanceType.IN),
  log("multiple-events", "out-2", 17, 0, AttendanceType.OUT),
  log("overnight", "in", 22, 0, AttendanceType.IN),
  log("overnight", "out", 7, 30, AttendanceType.OUT, 1),
  log("unscheduled", "in", 11, 0, AttendanceType.IN),
  log("unscheduled", "out", 12, 0, AttendanceType.OUT),
  log("on-time", "denied", 8, 50, AttendanceType.IN, 0, false),
  unsafeLog("phase-26-customer"),
  unsafeLog("phase-26-type-mismatch"),
  unsafeLog("phase-26-flag-mismatch"),
];

const justifications = [
  {
    id: "phase-26-justification",
    memberId: memberId("justified"),
    date: new Date(DAY),
    reason: "Approved leave",
  },
];

const prismaAny = prisma as any;
const originalPrisma = {
  memberFindMany: prismaAny.member.findMany,
  shiftFindMany: prismaAny.memberShift.findMany,
  attendanceFindMany: prismaAny.attendanceLog.findMany,
  attendanceCount: prismaAny.attendanceLog.count,
  justificationFindMany: prismaAny.attendanceJustification.findMany,
  deviceFindMany: prismaAny.device.findMany,
};

function installPrismaMocks() {
  prismaAny.member.findMany = async ({ where }: { where?: any } = {}) => {
    assertStrictMemberWhere(where, "report member query");
    return members.map((member) => ({ ...member }));
  };

  prismaAny.memberShift.findMany = async ({ where, select }: { where?: any; select?: any } = {}) => {
    const dailyQuery = Boolean(select?.member);
    if (dailyQuery) {
      assert.deepEqual(where?.member?.AND?.[0], buildStrictStaffMemberWhere(), "Daily shift query must be strict Staff");
    } else {
      assert.deepEqual(where?.member, buildStrictStaffMemberWhere(), "Report shift query must be strict Staff");
    }
    return shifts.map((shift) => ({
      ...shift,
      ...(dailyQuery ? { member: toDailyMember(memberById.get(shift.memberId)!) } : {}),
    }));
  };

  prismaAny.attendanceLog.findMany = async ({ where, include }: { where?: any; include?: any } = {}) => {
    assertStrictAttendanceRelation(where?.member, "attendance log query");
    return filterLogs(where).map((row) => ({
      ...row,
      deviceUser: null,
      ...(include?.member
        ? { member: toEvidenceMember(memberById.get(row.memberId)!) }
        : { member: toDailyMember(memberById.get(row.memberId)!) }),
    }));
  };

  prismaAny.attendanceLog.count = async ({ where }: { where?: any } = {}) => {
    assertStrictAttendanceRelation(where?.member, "attendance count query");
    return filterLogs(where).length;
  };

  prismaAny.attendanceJustification.findMany = async ({ where }: { where?: any } = {}) => {
    assert.deepEqual(where?.member, buildStrictStaffMemberWhere(), "justification query must be strict Staff");
    return justifications.filter((row) => matchesMemberIds(row.memberId, where?.memberId) && matchesDate(row.date, where?.date));
  };

  prismaAny.device.findMany = async () => [];
}

function restorePrismaMocks() {
  prismaAny.member.findMany = originalPrisma.memberFindMany;
  prismaAny.memberShift.findMany = originalPrisma.shiftFindMany;
  prismaAny.attendanceLog.findMany = originalPrisma.attendanceFindMany;
  prismaAny.attendanceLog.count = originalPrisma.attendanceCount;
  prismaAny.attendanceJustification.findMany = originalPrisma.justificationFindMany;
  prismaAny.device.findMany = originalPrisma.deviceFindMany;
}

async function testDailySemantics() {
  const daily = await listDailyAttendance({ date: DATE, mode: "primary" }, STRICT);
  assert.equal(daily.rows.length, scenarios.length);
  assert.deepEqual(daily.summary, {
    present: 6,
    absent: 1,
    late: 1,
    inside: 1,
    justified: 1,
    unscheduledPresentCount: 1,
    deniedCount: 1,
  });
  assert.deepEqual(daily.warnings, { noCheckout: 1, noShift: 1, multipleEvents: 1 });

  assertRow(daily.rows, "on-time", { status: "PRESENT", confirmedDurationMinutes: 480 });
  assertRow(daily.rows, "late", { status: "LATE", lateMinutes: 30 });
  assertRow(daily.rows, "early-arrival", { status: "PRESENT", earlyMinutes: 30 });
  assertRow(daily.rows, "early-leave", { status: "PRESENT", earlyLeaveMinutes: 90 });
  assertRow(daily.rows, "overtime", { status: "PRESENT", overtimeMinutes: 150, confirmedDurationMinutes: 630 });
  assertRow(daily.rows, "missing-checkout", { status: "INSIDE", hasOpenSession: true }, ["NO_CHECKOUT"]);
  assertRow(daily.rows, "multiple-events", { status: "PRESENT", confirmedDurationMinutes: 420 }, ["MULTIPLE_EVENTS"]);
  assertRow(daily.rows, "overnight", { status: "PRESENT", overtimeMinutes: 90, confirmedDurationMinutes: 570 });
  assertRow(daily.rows, "absent", { status: "ABSENT", isJustified: false });
  assertRow(daily.rows, "justified", { status: "ABSENT", isJustified: true, justificationReason: "Approved leave" });
  assertRow(daily.rows, "unscheduled", { status: "PRESENT", hasShift: false, confirmedDurationMinutes: 60 }, ["NO_SHIFT"]);
  assertNoUnsafeData(daily, "Daily Attendance");
  console.log("ok - Phase 2.6 Daily semantics cover on-time, late/early, overtime, warnings, unscheduled, and overnight");
  return daily;
}

async function testDailyReportReconciliation(daily: Awaited<ReturnType<typeof listDailyAttendance>>) {
  const baseQuery = {
    from: DATE,
    to: DATE,
    memberType: "customer" as const,
    shiftMode: "primary" as const,
    eventType: "all" as const,
    onlyAnomalies: false,
  };
  const summary = await getAttendanceReportSummary(baseQuery, STRICT);
  const reportDaily = await getAttendanceReportDaily({ ...baseQuery, page: 1, pageSize: 25 }, STRICT);
  const reportMembers = await getAttendanceReportMembers({
    ...baseQuery,
    page: 1,
    pageSize: 25,
    sortBy: "memberName",
    sortDir: "asc",
  }, STRICT);

  const expectedKpis = {
    presentDays:
      daily.summary.present + daily.summary.late + daily.summary.inside + daily.summary.unscheduledPresentCount,
    absentDays: daily.summary.absent,
    lateCount: daily.rows.filter((row) => (row.lateMinutes ?? 0) > 0).length,
    lateMinutes: sumRows(daily.rows, "lateMinutes"),
    earlyLeaveCount: daily.rows.filter((row) => (row.earlyLeaveMinutes ?? 0) > 0).length,
    earlyLeaveMinutes: sumRows(daily.rows, "earlyLeaveMinutes"),
    overtimeMinutes: sumRows(daily.rows, "overtimeMinutes"),
    justifiedCount: daily.summary.justified,
    unscheduledPresentCount: daily.summary.unscheduledPresentCount,
    deniedCount: daily.summary.deniedCount,
    noCheckoutCount: daily.warnings.noCheckout,
  };
  assert.deepEqual(summary.kpis, expectedKpis);
  assert.deepEqual(reportDaily.items, [{
    date: DATE,
    presentCount: expectedKpis.presentDays,
    absentCount: expectedKpis.absentDays,
    lateCount: expectedKpis.lateCount,
    lateMinutes: expectedKpis.lateMinutes,
    earlyLeaveCount: expectedKpis.earlyLeaveCount,
    earlyLeaveMinutes: expectedKpis.earlyLeaveMinutes,
    overtimeMinutes: expectedKpis.overtimeMinutes,
    justifiedCount: expectedKpis.justifiedCount,
    unscheduledPresentCount: expectedKpis.unscheduledPresentCount,
    deniedCount: expectedKpis.deniedCount,
    noCheckoutCount: expectedKpis.noCheckoutCount,
  }]);
  assert.equal(reportMembers.items.length, scenarios.length);
  assert.deepEqual(reportMembers.items.map((item) => item.memberId).sort(), members.map((member) => member.id).sort());
  assert.equal(findReportMember(reportMembers.items, "late").lateMinutes, 30);
  assert.equal(findReportMember(reportMembers.items, "early-leave").earlyLeaveMinutes, 90);
  assert.equal(findReportMember(reportMembers.items, "overtime").overtimeMinutes, 150);
  assert.equal(findReportMember(reportMembers.items, "overnight").overtimeMinutes, 90);
  assert.equal(findReportMember(reportMembers.items, "missing-checkout").noCheckoutCount, 1);
  assert.equal(findReportMember(reportMembers.items, "unscheduled").unscheduledPresentCount, 1);

  const anomalies = await getAttendanceReportMembers({
    ...baseQuery,
    onlyAnomalies: true,
    page: 1,
    pageSize: 25,
    sortBy: "memberName",
    sortDir: "asc",
  }, STRICT);
  assert.ok(
    anomalies.items.some((item) => item.memberId === memberId("multiple-events")),
    "multiple-event Staff must remain reviewable through anomaly filtering"
  );
  assertNoUnsafeData({ summary, reportDaily, reportMembers, anomalies }, "Attendance Report");
  console.log("ok - Phase 2.6 Daily and Report totals reconcile from one strict Staff fixture");
}

function assertRow(
  rows: Awaited<ReturnType<typeof listDailyAttendance>>["rows"],
  scenario: Scenario,
  expected: Record<string, unknown>,
  warnings: string[] = []
) {
  const row = rows.find((item) => item.memberId === memberId(scenario));
  assert.ok(row, `Missing Daily row for ${scenario}`);
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual((row as any)[key], value, `${scenario}.${key}`);
  }
  warnings.forEach((warning) => assert.equal(row.warnings.includes(warning as any), true, `${scenario} missing ${warning}`));
}

function findReportMember(
  rows: Awaited<ReturnType<typeof getAttendanceReportMembers>>["items"],
  scenario: Scenario
) {
  const row = rows.find((item) => item.memberId === memberId(scenario));
  assert.ok(row, `Missing report member row for ${scenario}`);
  return row;
}

function sumRows(
  rows: Awaited<ReturnType<typeof listDailyAttendance>>["rows"],
  key: "lateMinutes" | "earlyLeaveMinutes" | "overtimeMinutes"
) {
  return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
}

function filterLogs(where: any): FixtureLog[] {
  return logs.filter((row) => {
    const member = memberById.get(row.memberId);
    if (!member || member.memberType !== MemberType.STAFF || member.isStaff !== true) return false;
    if (!matchesMemberIds(row.memberId, where?.memberId)) return false;
    if (!matchesDate(row.recordedAt, where?.recordedAt)) return false;
    if (typeof where?.isAuthorized === "boolean" && row.isAuthorized !== where.isAuthorized) return false;
    if (where?.entryType && row.entryType !== where.entryType) return false;
    if (where?.id?.in && !where.id.in.includes(row.id)) return false;
    return true;
  });
}

function matchesMemberIds(memberIdValue: string, condition: any) {
  if (!condition) return true;
  if (Array.isArray(condition.in)) return condition.in.includes(memberIdValue);
  return true;
}

function matchesDate(value: Date, condition: any) {
  if (!condition) return true;
  if (condition.gte && value < condition.gte) return false;
  if (condition.gt && value <= condition.gt) return false;
  if (condition.lte && value > condition.lte) return false;
  if (condition.lt && value >= condition.lt) return false;
  return true;
}

function assertStrictMemberWhere(where: any, label: string) {
  assert.equal(where?.memberType, MemberType.STAFF, `${label} memberType`);
  assert.equal(where?.isStaff, true, `${label} isStaff`);
}

function assertStrictAttendanceRelation(where: any, label: string) {
  const strict = buildStrictStaffMemberWhere();
  const actual = where?.AND ? where.AND[0] : where;
  assert.deepEqual(actual, strict, `${label} must use strict-both Staff markers`);
}

function assertNoUnsafeData(value: unknown, label: string) {
  const serialized = JSON.stringify(value);
  for (const token of ["LEAK-CUSTOMER", "LEAK-TYPE-MISMATCH", "LEAK-FLAG-MISMATCH"]) {
    assert.equal(serialized.includes(token), false, `${label} leaked ${token}`);
  }
}

function toDailyMember(member: FixtureMember) {
  return {
    id: member.id,
    code: member.code,
    firstName: member.firstName,
    lastName: member.lastName,
    phone: null,
    memberType: member.memberType,
    isStaff: member.isStaff,
    staffGroup: member.staffGroup,
  };
}

function toEvidenceMember(member: FixtureMember) {
  return {
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    memberType: member.memberType,
    isStaff: member.isStaff,
  };
}

function memberId(scenario: Scenario) {
  return `phase-26-${scenario}`;
}

function log(
  scenario: Scenario,
  suffix: string,
  hours: number,
  minutes: number,
  entryType: AttendanceType,
  dayOffset = 0,
  isAuthorized = true
): FixtureLog {
  const recordedAt = new Date(DAY);
  recordedAt.setDate(recordedAt.getDate() + dayOffset);
  recordedAt.setHours(hours, minutes, 0, 0);
  return {
    id: `phase-26-log-${scenario}-${suffix}`,
    memberId: memberId(scenario),
    entryType,
    recordedAt,
    source: AttendanceSource.DEVICE,
    isAuthorized,
    reason: isAuthorized ? null : "PHASE_26_DENIED",
  };
}

function unsafeLog(unsafeMemberId: string): FixtureLog {
  const recordedAt = new Date(DAY);
  recordedAt.setHours(10, 0, 0, 0);
  return {
    id: `phase-26-log-${unsafeMemberId}`,
    memberId: unsafeMemberId,
    entryType: AttendanceType.IN,
    recordedAt,
    source: AttendanceSource.DEVICE,
    isAuthorized: true,
    reason: null,
  };
}

async function run() {
  installPrismaMocks();
  try {
    const daily = await testDailySemantics();
    await testDailyReportReconciliation(daily);
  } finally {
    restorePrismaMocks();
  }
  console.log("Attendance Phase 2.6 semantics and reconciliation tests passed.");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
