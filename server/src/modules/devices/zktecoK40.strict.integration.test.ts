import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import {
  AttendanceSource,
  AttendanceType,
  DeviceConnectionType,
  DeviceRawLogStatus,
  DeviceStatus,
  DeviceType,
  MemberStatus,
  MemberType,
  SalaryType,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { DeviceEvent } from "../../shared/devices.types";
import { ATTENDANCE_DATA_SCOPES } from "../attendance/attendance-edition-scope";
import { listAttendance, listDailyAttendance } from "../attendance/attendance.service";
import {
  getAttendanceReportDaily,
  getAttendanceReportMembers,
  getAttendanceReportSummary,
} from "../reports-attendance/reports-attendance.service";
import { STRICT_STAFF_DEVICE_DATA_SCOPE } from "./device-edition-scope";
import { processDeviceEvents } from "./zktecoK40.service";

type Fixture = {
  suffix: string;
  deviceId: string;
  staffMemberId: string;
  customerMemberId: string;
  staffDeviceUserId: string;
  customerDeviceUserId: string;
  shiftId: string;
  staffExternalId: number;
  customerExternalId: number;
  unknownExternalId: number;
  day: Date;
  dateKey: string;
};

const STRICT_DEVICE = STRICT_STAFF_DEVICE_DATA_SCOPE;
const STRICT_ATTENDANCE = ATTENDANCE_DATA_SCOPES.STRICT_STAFF;

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Strict K40 database integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_DB_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Strict K40 database integration tests refuse non-local database host: ${hostname}`);
  }
}

async function allocateExternalIds(count: number) {
  const allocated: number[] = [];
  for (let attempt = 0; attempt < 100 && allocated.length < count; attempt += 1) {
    const candidate = randomInt(1_500_000_000, 2_000_000_000);
    if (allocated.includes(candidate)) continue;
    const exists = await prisma.deviceUser.findUnique({ where: { externalId: candidate }, select: { id: true } });
    if (!exists) allocated.push(candidate);
  }
  if (allocated.length !== count) throw new Error("Unable to allocate isolated strict K40 external IDs");
  return allocated;
}

async function allocateFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const [staffExternalId, customerExternalId, unknownExternalId] = await allocateExternalIds(3);
  assert.ok(staffExternalId && customerExternalId && unknownExternalId);
  const day = startOfDay(addDays(new Date(), -2));
  return {
    suffix,
    deviceId: `it-strict-k40-device-${suffix}`,
    staffMemberId: `it-strict-k40-staff-${suffix}`,
    customerMemberId: `it-strict-k40-customer-${suffix}`,
    staffDeviceUserId: `it-strict-k40-staff-user-${suffix}`,
    customerDeviceUserId: `it-strict-k40-customer-user-${suffix}`,
    shiftId: `it-strict-k40-shift-${suffix}`,
    staffExternalId,
    customerExternalId,
    unknownExternalId,
    day,
    dateKey: formatDateKey(day),
  };
}

async function createFixtureRecords(fixture: Fixture) {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.device.create({
      data: {
        id: fixture.deviceId,
        name: `__STRICT_K40_DB_INTEGRATION__${fixture.suffix}`,
        type: DeviceType.FINGERPRINT,
        connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
        enabled: false,
        status: DeviceStatus.OFFLINE,
        config: { ip: "127.0.0.1", port: 4370, eventMode: "PULL" },
        model: "K40 strict integration fixture",
      },
    });
    await tx.member.createMany({
      data: [
        {
          id: fixture.staffMemberId,
          code: `IT-STRICT-STAFF-${fixture.suffix}`,
          firstName: "Strict K40",
          lastName: "Staff Fixture",
          memberType: MemberType.STAFF,
          status: MemberStatus.ACTIVE,
          isStaff: true,
        },
        {
          id: fixture.customerMemberId,
          code: `IT-STRICT-CUSTOMER-${fixture.suffix}`,
          firstName: "Strict K40",
          lastName: "Customer Fixture",
          memberType: MemberType.CUSTOMER,
          status: MemberStatus.ACTIVE,
          isStaff: false,
        },
      ],
    });
    await tx.memberShift.create({
      data: {
        id: fixture.shiftId,
        memberId: fixture.staffMemberId,
        shiftName: "Strict day shift",
        shiftStart: "09:00",
        shiftEnd: "17:00",
        weekdays: [toStoredWeekday(fixture.day.getDay())],
        graceMinutes: 0,
        earlyAccessMinutes: 15,
        salaryType: SalaryType.MONTHLY,
        salaryAmount: 0,
        isActive: true,
      },
    });
    await tx.deviceUser.createMany({
      data: [
        {
          id: fixture.staffDeviceUserId,
          externalId: fixture.staffExternalId,
          deviceId: fixture.deviceId,
          memberId: fixture.staffMemberId,
          lastSyncedAt: now,
        },
        {
          id: fixture.customerDeviceUserId,
          externalId: fixture.customerExternalId,
          deviceId: fixture.deviceId,
          memberId: fixture.customerMemberId,
          lastSyncedAt: now,
        },
      ],
    });
  });
}

async function testStrictTimeClockAndReconciliation(fixture: Fixture) {
  const inEvent = buildEvent(fixture, {
    externalUserId: fixture.staffExternalId,
    timestamp: atTime(fixture.day, 9, 15),
    eventType: "CHECK_IN",
  });
  const outEvent = buildEvent(fixture, {
    externalUserId: fixture.staffExternalId,
    timestamp: atTime(fixture.day, 17, 30),
    eventType: "CHECK_OUT",
  });

  const summary = await processDeviceEvents([outEvent, inEvent], { scope: STRICT_DEVICE, stopOnError: true });
  assert.equal(summary.processedCount, 2);
  assert.equal(summary.maxTimestamp?.getTime(), outEvent.timestamp.getTime());

  const rawLogs = await prisma.deviceRawLog.findMany({
    where: { dataHash: { in: [dedupeKey(inEvent), dedupeKey(outEvent)] } },
    include: { attendance: true },
    orderBy: { recordedAt: "asc" },
  });
  assert.equal(rawLogs.length, 2);
  assert.equal(rawLogs.every((row) => row.status === DeviceRawLogStatus.PROCESSED), true);
  assert.deepEqual(rawLogs.map((row) => row.attendance?.entryType), [AttendanceType.IN, AttendanceType.OUT]);
  assert.equal(rawLogs.every((row) => row.attendance?.isAuthorized === true), true);
  assert.equal(rawLogs.every((row) => row.attendance?.source === AttendanceSource.DEVICE), true);

  const daily = await listDailyAttendance({
    date: fixture.dateKey,
    search: fixture.suffix,
    mode: "primary",
  }, STRICT_ATTENDANCE);
  assert.equal(daily.rows.length, 1);
  const dailyRow = daily.rows[0];
  assert.ok(dailyRow);
  assert.equal(dailyRow.memberId, fixture.staffMemberId);
  assert.equal(dailyRow.status, "LATE");
  assert.equal(dailyRow.lateMinutes, 15);
  assert.equal(dailyRow.overtimeMinutes, 30);
  assert.equal(dailyRow.confirmedDurationMinutes, 495);
  assert.equal(dailyRow.hasOpenSession, false);
  assert.deepEqual(daily.warnings, { noCheckout: 0, noShift: 0, multipleEvents: 0 });

  const entries = await listAttendance({
    memberType: "CUSTOMER",
    from: fixture.day.toISOString(),
    to: addDays(fixture.day, 1).toISOString(),
    eventType: "ALL",
    source: "DEVICE",
    result: "ALL",
    search: fixture.suffix,
    page: 1,
    pageSize: 20,
  }, STRICT_ATTENDANCE);
  assert.equal(entries.items.length, 2);
  assert.equal(entries.items.every((item) => item.memberId === fixture.staffMemberId), true);
  assert.deepEqual(entries.items.map((item) => item.eventType).sort(), ["IN", "OUT"]);

  const reportBase = {
    from: fixture.dateKey,
    to: fixture.dateKey,
    memberType: "customer" as const,
    shiftMode: "primary" as const,
    eventType: "all" as const,
    search: fixture.suffix,
    onlyAnomalies: false,
  };
  const [reportSummary, reportDaily, reportMembers] = await Promise.all([
    getAttendanceReportSummary(reportBase, STRICT_ATTENDANCE),
    getAttendanceReportDaily({ ...reportBase, page: 1, pageSize: 20 }, STRICT_ATTENDANCE),
    getAttendanceReportMembers({
      ...reportBase,
      page: 1,
      pageSize: 20,
      sortBy: "memberName",
      sortDir: "asc",
    }, STRICT_ATTENDANCE),
  ]);
  assert.deepEqual(reportSummary.kpis, {
    presentDays: 1,
    absentDays: 0,
    lateCount: 1,
    lateMinutes: 15,
    earlyLeaveCount: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 30,
    justifiedCount: 0,
    unscheduledPresentCount: 0,
    deniedCount: 0,
    noCheckoutCount: 0,
  });
  assert.equal(reportDaily.items.length, 1);
  assert.equal(reportDaily.items[0]?.lateMinutes, dailyRow.lateMinutes);
  assert.equal(reportDaily.items[0]?.overtimeMinutes, dailyRow.overtimeMinutes);
  assert.equal(reportMembers.items.length, 1);
  assert.equal(reportMembers.items[0]?.memberId, fixture.staffMemberId);
  assert.equal(reportMembers.items[0]?.lateMinutes, dailyRow.lateMinutes);
  assert.equal(reportMembers.items[0]?.overtimeMinutes, dailyRow.overtimeMinutes);

  assert.equal(await prisma.accessViolation.count({ where: { memberId: fixture.staffMemberId } }), 0);
  assert.equal(await prisma.inboxItem.count({ where: { memberId: fixture.staffMemberId } }), 0);
  assert.equal(await prisma.doorEvent.count({ where: { memberId: fixture.staffMemberId } }), 0);
  console.log("✓ strict Staff RawLog→AttendanceLog→Daily→Entry Logs→Report reconciliation with zero Door/Inbox/Violation");

  const replay = await processDeviceEvents([inEvent, outEvent], { scope: STRICT_DEVICE, stopOnError: true });
  assert.equal(replay.processedCount, 0);
  assert.equal(await prisma.deviceRawLog.count({ where: { dataHash: { in: [dedupeKey(inEvent), dedupeKey(outEvent)] } } }), 2);
  assert.equal(await prisma.attendanceLog.count({ where: { memberId: fixture.staffMemberId } }), 2);
  console.log("✓ strict Staff replay remains idempotent without duplicate attendance rows");
}

async function testStrictInvalidIdentityMatrix(fixture: Fixture) {
  const cases = [
    {
      label: "Customer",
      externalUserId: fixture.customerExternalId,
      expectedReason: "NON_STAFF_MEMBER",
      timestamp: atTime(fixture.day, 12, 0),
    },
    {
      label: "Unknown",
      externalUserId: fixture.unknownExternalId,
      expectedReason: "DEVICE_USER_NOT_FOUND",
      timestamp: atTime(fixture.day, 12, 5),
    },
  ];

  await prisma.member.update({ where: { id: fixture.staffMemberId }, data: { status: MemberStatus.BLOCKED } });
  cases.push({
    label: "Inactive",
    externalUserId: fixture.staffExternalId,
    expectedReason: "INACTIVE_EMPLOYEE",
    timestamp: atTime(fixture.day, 12, 10),
  });

  try {
    for (const item of cases) {
      const event = buildEvent(fixture, {
        externalUserId: item.externalUserId,
        timestamp: item.timestamp,
        eventType: "CHECK_IN",
      });
      const result = await processDeviceEvents([event], { scope: STRICT_DEVICE, stopOnError: true });
      assert.equal(result.processedCount, 0, `${item.label} must not create Attendance`);
      const rawLog = await prisma.deviceRawLog.findUnique({ where: { dataHash: dedupeKey(event) } });
      assert.equal(rawLog?.status, DeviceRawLogStatus.SKIPPED_INVALID, `${item.label} RawLog status`);
      assert.equal(rawLog?.processError, item.expectedReason, `${item.label} RawLog reason`);
    }
  } finally {
    await prisma.member.update({ where: { id: fixture.staffMemberId }, data: { status: MemberStatus.ACTIVE } });
  }

  assert.equal(await prisma.attendanceLog.count({ where: { memberId: fixture.customerMemberId } }), 0);
  assert.equal(await prisma.attendanceLog.count({ where: { memberId: fixture.staffMemberId } }), 2);
  assert.equal(await prisma.accessViolation.count({ where: { memberId: { in: [fixture.staffMemberId, fixture.customerMemberId] } } }), 0);
  assert.equal(await prisma.inboxItem.count({ where: { memberId: { in: [fixture.staffMemberId, fixture.customerMemberId] } } }), 0);
  assert.equal(await prisma.doorEvent.count({ where: { memberId: { in: [fixture.staffMemberId, fixture.customerMemberId] } } }), 0);
  console.log("✓ strict Customer/Unknown/Inactive identities remain Raw-only with stable reasons and zero side effects");
}

async function cleanupFixture(fixture: Fixture) {
  const memberIds = [fixture.staffMemberId, fixture.customerMemberId];
  const deviceUserIds = [fixture.staffDeviceUserId, fixture.customerDeviceUserId];
  await prisma.inboxItem.deleteMany({ where: { OR: [{ deviceId: fixture.deviceId }, { memberId: { in: memberIds } }] } });
  await prisma.doorEvent.deleteMany({ where: { memberId: { in: memberIds } } });
  await prisma.accessViolation.deleteMany({ where: { OR: [{ memberId: { in: memberIds } }, { deviceUserId: { in: deviceUserIds } }] } });
  await prisma.attendanceLog.deleteMany({ where: { OR: [{ memberId: { in: memberIds } }, { deviceUserId: { in: deviceUserIds } }] } });
  await prisma.deviceRawLog.deleteMany({ where: { deviceId: fixture.deviceId } });
  await prisma.memberShift.deleteMany({ where: { id: fixture.shiftId } });
  await prisma.deviceUser.deleteMany({ where: { id: { in: deviceUserIds } } });
  await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  await prisma.device.deleteMany({ where: { id: fixture.deviceId } });

  const leftovers = await prisma.$transaction([
    prisma.device.count({ where: { id: fixture.deviceId } }),
    prisma.member.count({ where: { id: { in: memberIds } } }),
    prisma.memberShift.count({ where: { id: fixture.shiftId } }),
    prisma.deviceUser.count({ where: { id: { in: deviceUserIds } } }),
    prisma.deviceRawLog.count({ where: { deviceId: fixture.deviceId } }),
    prisma.attendanceLog.count({ where: { OR: [{ memberId: { in: memberIds } }, { deviceUserId: { in: deviceUserIds } }] } }),
    prisma.accessViolation.count({ where: { memberId: { in: memberIds } } }),
    prisma.inboxItem.count({ where: { OR: [{ deviceId: fixture.deviceId }, { memberId: { in: memberIds } }] } }),
    prisma.doorEvent.count({ where: { memberId: { in: memberIds } } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  console.log("✓ strict K40 integration fixture cleanup verified (0 records left)");
}

function buildEvent(
  fixture: Fixture,
  input: { externalUserId: number; timestamp: Date; eventType: "CHECK_IN" | "CHECK_OUT" }
): DeviceEvent {
  const recordId = randomInt(100_000_000, 1_000_000_000);
  return {
    deviceId: fixture.deviceId,
    externalUserId: String(input.externalUserId),
    timestamp: input.timestamp,
    eventType: input.eventType,
    recordId,
    raw: {
      uid: input.externalUserId,
      id: recordId,
      timestamp: input.timestamp.toISOString(),
      source: "STRICT_K40_INTEGRATION_FIXTURE",
    },
  };
}

function dedupeKey(event: DeviceEvent) {
  const payload = `${event.deviceId}|${event.externalUserId}|${event.timestamp.toISOString()}|${event.eventType}|${event.recordId ?? ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

function startOfDay(value: Date) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function atTime(day: Date, hours: number, minutes: number) {
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toStoredWeekday(jsDay: number) {
  return (jsDay + 1) % 7;
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await allocateFixture();
  try {
    await createFixtureRecords(fixture);
    await testStrictTimeClockAndReconciliation(fixture);
    await testStrictInvalidIdentityMatrix(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Strict K40 database integration tests passed (TIME_CLOCK, isolation, reconciliation, cleanup). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
