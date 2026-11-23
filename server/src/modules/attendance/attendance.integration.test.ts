import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  AdminRole,
  AttendanceSource,
  AttendanceType,
  MemberStatus,
  MemberType,
  SalaryType,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { ATTENDANCE_DATA_SCOPES } from "./attendance-edition-scope";
import {
  listDailyAttendance,
  removeAttendanceJustification,
  upsertAttendanceJustification,
  type AttendanceActionContext,
} from "./attendance.service";

type FixtureRole =
  | "present"
  | "late"
  | "absent"
  | "justified"
  | "overnight"
  | "open"
  | "multiple"
  | "unscheduled";

type FixtureMember = {
  id: string;
  code: string;
  role: FixtureRole;
  shiftId: string | null;
};

type Fixture = {
  suffix: string;
  date: Date;
  dateKey: string;
  weekday: number;
  adminUserId: string;
  adminSessionId: string;
  members: Record<FixtureRole, FixtureMember>;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Attendance database integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["ATTENDANCE_DB_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Attendance database integration tests refuse non-local database host: ${hostname}`);
  }
}

function allocateFixture(): Fixture {
  const suffix = randomUUID();
  const now = new Date();
  const date = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 10));
  const roles: FixtureRole[] = [
    "present",
    "late",
    "absent",
    "justified",
    "overnight",
    "open",
    "multiple",
    "unscheduled",
  ];
  const members = Object.fromEntries(
    roles.map((role) => [
      role,
      {
        id: `it-attendance-member-${role}-${suffix}`,
        code: `IT-ATT-${role.toUpperCase()}-${suffix}`,
        role,
        shiftId: role === "unscheduled" ? null : `it-attendance-shift-${role}-${suffix}`,
      } satisfies FixtureMember,
    ])
  ) as Record<FixtureRole, FixtureMember>;

  return {
    suffix,
    date,
    dateKey: formatDateKey(date),
    weekday: toStoredWeekday(date.getDay()),
    adminUserId: `it-attendance-admin-${suffix}`,
    adminSessionId: `it-attendance-session-${suffix}`,
    members,
  };
}

async function createFixtureRecords(fixture: Fixture) {
  const members = Object.values(fixture.members);
  const logs = [
    buildLog(fixture.members.present.id, fixture.date, 9, 0, AttendanceType.IN),
    buildLog(fixture.members.present.id, fixture.date, 17, 0, AttendanceType.OUT),
    buildLog(fixture.members.present.id, fixture.date, 8, 45, AttendanceType.IN, false),

    buildLog(fixture.members.late.id, fixture.date, 9, 30, AttendanceType.IN),
    buildLog(fixture.members.late.id, fixture.date, 16, 0, AttendanceType.OUT),

    buildLog(fixture.members.overnight.id, fixture.date, 22, 0, AttendanceType.IN),
    buildLog(fixture.members.overnight.id, addDays(fixture.date, 1), 7, 30, AttendanceType.OUT),

    buildLog(fixture.members.open.id, fixture.date, 9, 0, AttendanceType.IN),

    buildLog(fixture.members.multiple.id, fixture.date, 9, 0, AttendanceType.IN),
    buildLog(fixture.members.multiple.id, fixture.date, 12, 0, AttendanceType.OUT),
    buildLog(fixture.members.multiple.id, fixture.date, 13, 0, AttendanceType.IN),
    buildLog(fixture.members.multiple.id, fixture.date, 17, 0, AttendanceType.OUT),

    buildLog(fixture.members.unscheduled.id, fixture.date, 11, 0, AttendanceType.IN),
    buildLog(fixture.members.unscheduled.id, fixture.date, 12, 0, AttendanceType.OUT),
  ];

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.create({
      data: {
        id: fixture.adminUserId,
        username: `it-attendance-${fixture.suffix}`,
        passwordHash: "not-used-by-attendance-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminSession.create({
      data: {
        id: fixture.adminSessionId,
        adminUserId: fixture.adminUserId,
        tokenHash: `it-attendance-token-${fixture.suffix}`,
        expiresAt: addDays(new Date(), 1),
      },
    });
    await tx.member.createMany({
      data: members.map((member) => ({
        id: member.id,
        code: member.code,
        firstName: `Attendance ${member.role}`,
        lastName: "Integration Fixture",
        memberType: MemberType.STAFF,
        status: MemberStatus.ACTIVE,
        isStaff: true,
        createdAt: addDays(fixture.date, -60),
      })),
    });
    await tx.memberShift.createMany({
      data: members
        .filter((member) => member.shiftId)
        .map((member) => ({
          id: member.shiftId!,
          memberId: member.id,
          shiftName: `Attendance ${member.role} integration shift`,
          shiftStart: member.role === "overnight" ? "22:00" : "09:00",
          shiftEnd: member.role === "overnight" ? "06:00" : "17:00",
          weekdays: [fixture.weekday],
          graceMinutes: 0,
          earlyAccessMinutes: 15,
          salaryType: SalaryType.MONTHLY,
          salaryAmount: 100,
          isActive: true,
        })),
    });
    await tx.attendanceLog.createMany({ data: logs });
  });
}

async function testDailyStatusesSummariesAndWarnings(fixture: Fixture) {
  const result = await loadFixtureDay(fixture);
  assert.equal(result.date, fixture.dateKey);
  assert.equal(result.rows.length, 8);
  assert.deepEqual(result.summary, {
    present: 3,
    absent: 2,
    late: 1,
    inside: 1,
    justified: 0,
    unscheduledPresentCount: 1,
    deniedCount: 1,
  });
  assert.deepEqual(result.warnings, { noCheckout: 1, noShift: 1, multipleEvents: 1 });

  const present = findRow(result.rows, fixture.members.present.id);
  assert.equal(present.status, "PRESENT");
  assert.equal(present.confirmedDurationMinutes, 480);
  assert.equal(present.lateMinutes, 0);
  assert.equal(present.earlyLeaveMinutes, 0);
  assert.equal(present.overtimeMinutes, 0);

  const late = findRow(result.rows, fixture.members.late.id);
  assert.equal(late.status, "LATE");
  assert.equal(late.lateMinutes, 30);
  assert.equal(late.earlyLeaveMinutes, 60);
  assert.equal(late.confirmedDurationMinutes, 390);

  const absent = findRow(result.rows, fixture.members.absent.id);
  assert.equal(absent.status, "ABSENT");
  assert.equal(absent.isJustified, false);

  const overnight = findRow(result.rows, fixture.members.overnight.id);
  assert.equal(overnight.status, "PRESENT");
  assert.equal(overnight.confirmedDurationMinutes, 570);
  assert.equal(overnight.overtimeMinutes, 90);
  assert.equal(overnight.checkOutAt?.getDate(), addDays(fixture.date, 1).getDate());

  const open = findRow(result.rows, fixture.members.open.id);
  assert.equal(open.status, "INSIDE");
  assert.equal(open.hasOpenSession, true);
  assert.equal(open.warnings.includes("NO_CHECKOUT"), true);

  const multiple = findRow(result.rows, fixture.members.multiple.id);
  assert.equal(multiple.status, "PRESENT");
  assert.equal(multiple.confirmedDurationMinutes, 420);
  assert.equal(multiple.warnings.includes("MULTIPLE_EVENTS"), true);

  const unscheduled = findRow(result.rows, fixture.members.unscheduled.id);
  assert.equal(unscheduled.hasShift, false);
  assert.equal(unscheduled.status, "PRESENT");
  assert.equal(unscheduled.confirmedDurationMinutes, 60);
  assert.equal(unscheduled.warnings.includes("NO_SHIFT"), true);

  result.rows.forEach((row) => {
    assert.equal(new Set(row.warnings).size, row.warnings.length, `Duplicate warnings returned for ${row.memberCode}`);
  });
  console.log("✓ daily status, summary, overnight, unscheduled, denied, and warning reconciliation");
}

async function testJustificationLifecycle(fixture: Fixture) {
  const memberId = fixture.members.justified.id;
  const context = actionContext(fixture);
  const created = await upsertAttendanceJustification({
    memberId,
    date: fixture.dateKey,
    reason: "Approved leave",
  }, context, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
  assert.equal(created.reason, "Approved leave");

  const justifiedResult = await loadFixtureDay(fixture);
  const justified = findRow(justifiedResult.rows, memberId);
  assert.equal(justified.status, "ABSENT");
  assert.equal(justified.isJustified, true);
  assert.equal(justified.justificationReason, "Approved leave");
  assert.equal(justifiedResult.summary.absent, 1);
  assert.equal(justifiedResult.summary.justified, 1);

  const updated = await upsertAttendanceJustification({
    memberId,
    date: fixture.dateKey,
    reason: "Approved medical leave",
  }, context, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
  assert.equal(updated.id, created.id);
  assert.equal(updated.reason, "Approved medical leave");

  await removeAttendanceJustification({ memberId, date: fixture.dateKey }, context, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
  await removeAttendanceJustification({ memberId, date: fixture.dateKey }, context, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
  const removedResult = await loadFixtureDay(fixture);
  const removed = findRow(removedResult.rows, memberId);
  assert.equal(removed.isJustified, false);
  assert.equal(removedResult.summary.absent, 2);
  assert.equal(removedResult.summary.justified, 0);
  const auditActions = await prisma.auditLog.findMany({
    where: { actorId: fixture.adminUserId },
    select: { action: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    auditActions.map((record) => record.action),
    [
      "attendance.justification.created",
      "attendance.justification.updated",
      "attendance.justification.deleted",
    ]
  );
  console.log("✓ justification create, update, remove, and idempotent delete lifecycle");
}

async function testStrictInvalidDateRejection(fixture: Fixture) {
  await assert.rejects(
    () =>
      listDailyAttendance({
        date: "2026-02-31",
        search: fixture.suffix,
        mode: "primary",
      }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
    (error: unknown) => error instanceof HttpError && error.status === 400
  );
  await assert.rejects(
    () =>
      upsertAttendanceJustification({
        memberId: fixture.members.absent.id,
        date: "2026-02-31",
        reason: "Invalid rollover must not be stored",
      }, actionContext(fixture), ATTENDANCE_DATA_SCOPES.FULL_LEGACY),
    (error: unknown) => error instanceof HttpError && error.status === 400
  );
  console.log("✓ invalid Gregorian rollover dates are rejected before reads or writes");
}

async function loadFixtureDay(fixture: Fixture) {
  return listDailyAttendance({
    date: fixture.dateKey,
    search: fixture.suffix,
    mode: "primary",
  }, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
}

function findRow<T extends { memberId: string }>(rows: T[], memberId: string) {
  const row = rows.find((item) => item.memberId === memberId);
  assert.ok(row, `Daily attendance row not found for ${memberId}`);
  return row;
}

async function cleanupFixture(fixture: Fixture) {
  const memberIds = Object.values(fixture.members).map((member) => member.id);
  const shiftIds = Object.values(fixture.members)
    .map((member) => member.shiftId)
    .filter((id): id is string => Boolean(id));

  await prisma.auditLog.deleteMany({ where: { actorId: fixture.adminUserId } });
  await prisma.attendanceJustification.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.attendanceLog.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.memberShift.deleteMany({ where: { id: { in: shiftIds } } });
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.adminSession.deleteMany({ where: { id: fixture.adminSessionId } });
  await prisma.adminUser.deleteMany({ where: { id: fixture.adminUserId } });

  const leftovers = await prisma.$transaction([
    prisma.member.count({ where: { id: { in: memberIds } } }),
    prisma.memberShift.count({ where: { id: { in: shiftIds } } }),
    prisma.attendanceLog.count({ where: { memberId: { in: memberIds } } }),
    prisma.attendanceJustification.count({ where: { memberId: { in: memberIds } } }),
    prisma.auditLog.count({ where: { actorId: fixture.adminUserId } }),
    prisma.adminSession.count({ where: { id: fixture.adminSessionId } }),
    prisma.adminUser.count({ where: { id: fixture.adminUserId } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0]);
  console.log("✓ attendance integration fixture cleanup verified (0 records left)");
}

function actionContext(fixture: Fixture): AttendanceActionContext {
  return {
    actor: {
      id: fixture.adminUserId,
      role: AdminRole.STAFF,
      sessionId: fixture.adminSessionId,
    },
    meta: {
      ipAddress: "127.0.0.1",
      userAgent: "attendance-integration-test",
    },
  };
}

function buildLog(
  memberId: string,
  date: Date,
  hours: number,
  minutes: number,
  entryType: AttendanceType,
  isAuthorized = true
) {
  return {
    memberId,
    recordedAt: atTime(date, hours, minutes),
    entryType,
    source: AttendanceSource.MANUAL,
    isAuthorized,
    reason: isAuthorized ? null : "INTEGRATION_DENIED_ATTEMPT",
  };
}

function atTime(date: Date, hours: number, minutes: number) {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function startOfDay(date: Date) {
  return atTime(date, 0, 0);
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toStoredWeekday(jsDay: number) {
  return (jsDay + 1) % 7;
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = allocateFixture();
  try {
    await createFixtureRecords(fixture);
    await testDailyStatusesSummariesAndWarnings(fixture);
    await testJustificationLifecycle(fixture);
    await testStrictInvalidDateRejection(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Daily Attendance database integration tests passed (statuses, overnight, warnings, justification, dates, cleanup). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
