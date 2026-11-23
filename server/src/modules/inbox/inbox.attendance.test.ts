import assert from "node:assert/strict";
import path from "node:path";
import {
  AttendanceType,
  InboxCategory,
  InboxItemType,
  InboxScope,
  InboxSeverity,
} from "@prisma/client";

const missingDotenvPath = path.join(__dirname, `.inbox-attendance-test-missing-${process.pid}.env`);
process.env["NODE_ENV"] = "test";
process.env["APP_EDITION"] = "FULL";
process.env["ATTENDANCE_POLICY"] = "TIME_CLOCK";
process.env["ATTENDANCE_AUTO_CHECKOUT_ENABLED"] = "0";
process.env["DATABASE_URL"] = "postgresql://inbox_test:inbox_test@127.0.0.1:1/inbox_test";
process.env["PORT"] = "4000";
process.env["LOG_LEVEL"] = "error";
process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
process.env["DOTENV_CONFIG_QUIET"] = "true";

const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
const { recordAttendanceInboxEvent } = require("./inbox.attendance") as typeof import("./inbox.attendance");
const { inboxJobsTestHooks } = require("./inbox.jobs") as typeof import("./inbox.jobs");
const prismaAny = prisma as any;

const originals = {
  inboxFindUnique: prismaAny.inboxItem.findUnique,
  inboxCreate: prismaAny.inboxItem.create,
  inboxCount: prismaAny.inboxItem.count,
  inboxDeleteMany: prismaAny.inboxItem.deleteMany,
  membershipFindMany: prismaAny.membership.findMany,
  attendanceFindMany: prismaAny.attendanceLog.findMany,
  memberShiftFindMany: prismaAny.memberShift.findMany,
  deviceFindMany: prismaAny.device.findMany,
};

const created: any[] = [];
let failureCount = 1;

function installInboxMocks() {
  prismaAny.inboxItem.findUnique = async () => null;
  prismaAny.inboxItem.create = async ({ data }: any) => {
    created.push(data);
    return { id: `item-${created.length}`, readAt: null, ...data };
  };
  prismaAny.inboxItem.count = async () => failureCount;
}

function restore() {
  prismaAny.inboxItem.findUnique = originals.inboxFindUnique;
  prismaAny.inboxItem.create = originals.inboxCreate;
  prismaAny.inboxItem.count = originals.inboxCount;
  prismaAny.inboxItem.deleteMany = originals.inboxDeleteMany;
  prismaAny.membership.findMany = originals.membershipFindMany;
  prismaAny.attendanceLog.findMany = originals.attendanceFindMany;
  prismaAny.memberShift.findMany = originals.memberShiftFindMany;
  prismaAny.device.findMany = originals.deviceFindMany;
}

async function testSafeAttendanceProducer() {
  installInboxMocks();
  const occurredAt = new Date("2026-10-03T08:00:00.000Z");

  await recordAttendanceInboxEvent({
    kind: "ACCEPTED_STAFF_PUNCH",
    occurredAt,
    entryType: AttendanceType.IN,
    employee: { id: "staff-1", name: "Safe Employee", code: "101" },
    device: { id: "device-1", name: "Front desk" },
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].scope, InboxScope.ATTENDANCE);
  assert.equal(created[0].category, InboxCategory.DEVICE_FEED);
  assert.equal(created[0].type, InboxItemType.DEVICE_AUTHORIZED);
  assert.equal(created[0].severity, InboxSeverity.INFO);
  assert.equal(created[0].actionPath, "/employees/staff-1");
  assert.match(created[0].body, /Punch: IN/u);
  assert.doesNotMatch(JSON.stringify(created[0]), /raw|externalUser|biometric|door|customer|membership/iu);

  created.length = 0;
  failureCount = 1;
  await recordAttendanceInboxEvent({
    kind: "UNKNOWN_DEVICE_USER",
    occurredAt,
    device: { id: "device-1", name: "Front desk" },
  });
  assert.equal(created.length, 2, "one safe feed item and one deduped warning alert are expected");
  assert.deepEqual(created.map((item) => item.scope), [InboxScope.ATTENDANCE, InboxScope.ATTENDANCE]);
  assert.deepEqual(created.map((item) => item.category), [InboxCategory.DEVICE_FEED, InboxCategory.ALERT]);
  assert.deepEqual(created.map((item) => item.actionPath), ["/entry-logs", "/devices"]);
  assert.equal(created[1].type, InboxItemType.DEVICE_DENIED);
  assert.doesNotMatch(JSON.stringify(created), /externalUser|raw|biometric|customer|membership/iu);

  created.length = 0;
  failureCount = 3;
  await recordAttendanceInboxEvent({
    kind: "INACTIVE_EMPLOYEE_ATTEMPT",
    occurredAt,
    employee: { id: "staff-2", name: "Inactive Employee", code: "102" },
    device: { id: "device-1", name: "Front desk" },
  });
  assert.equal(created.length, 2);
  assert.equal(created[1].type, InboxItemType.MULTIPLE_FAILED_ATTEMPTS);
  assert.equal(created[1].actionPath, "/employees/staff-2");
  assert.equal(created[1].member.connect.id, "staff-2");
}

async function testAttendanceSchedulerIsolation() {
  const deletes: any[] = [];
  let shiftQueries = 0;
  let deviceQueries = 0;
  created.length = 0;
  const schedulerStartedAt = new Date();
  const shiftStart = new Date(schedulerStartedAt.getTime() - 5 * 60_000);
  const shiftEnd = new Date(schedulerStartedAt.getTime() + 5 * 60_000);
  prismaAny.membership.findMany = async () => {
    throw new Error("Attendance scheduler queried Membership");
  };
  prismaAny.attendanceLog.findMany = async () => {
    throw new Error("Attendance scheduler invoked synthetic auto-checkout");
  };
  prismaAny.memberShift.findMany = async (input: any) => {
    shiftQueries += 1;
    assert.deepEqual(input.where.member, {
      OR: [{ memberType: "STAFF" }, { isStaff: true }],
    });
    return [{
      id: "shift-1",
      memberId: "staff-1",
      shiftName: "Morning",
      shiftStart: formatTime(shiftStart),
      shiftEnd: formatTime(shiftEnd),
      member: { id: "staff-1", firstName: "Safe", lastName: "Employee", code: "101" },
    }];
  };
  prismaAny.device.findMany = async () => {
    deviceQueries += 1;
    return [];
  };
  prismaAny.inboxItem.deleteMany = async (input: any) => {
    deletes.push(input);
    return { count: 0 };
  };

  await inboxJobsTestHooks.runInboxJobs("ATTENDANCE");
  assert.equal(shiftQueries, 1);
  assert.equal(deviceQueries, 1);
  assert.equal(created.length, 1);
  assert.equal(created[0].scope, InboxScope.ATTENDANCE);
  assert.equal(created[0].type, InboxItemType.SHIFT_ENDING_SOON);
  assert.equal(created[0].actionPath, "/employees/staff-1");
  assert.equal(deletes.length, 2);
  assert.deepEqual(deletes.map((entry) => entry.where.scope), [InboxScope.ATTENDANCE, InboxScope.ATTENDANCE]);
  assert.deepEqual(deletes.map((entry) => entry.where.category), [InboxCategory.DEVICE_FEED, InboxCategory.ALERT]);
  const feedAgeDays = (Date.now() - deletes[0].where.createdAt.lt.getTime()) / 86_400_000;
  const alertAgeDays = (Date.now() - deletes[1].where.createdAt.lt.getTime()) / 86_400_000;
  assert.ok(Math.abs(feedAgeDays - 7) < 0.01, "Attendance Device feed retention must remain 7 days");
  assert.ok(Math.abs(alertAgeDays - 90) < 0.01, "Attendance Alert retention must remain 90 days");

  let membershipQueries = 0;
  let autoCheckoutQueries = 0;
  prismaAny.membership.findMany = async () => {
    membershipQueries += 1;
    return [];
  };
  prismaAny.attendanceLog.findMany = async () => {
    autoCheckoutQueries += 1;
    return [];
  };
  prismaAny.memberShift.findMany = async () => [];
  prismaAny.device.findMany = async () => [];
  deletes.length = 0;

  await inboxJobsTestHooks.runInboxJobs("FULL");
  assert.equal(membershipQueries, 2, "FULL must retain both legacy Membership jobs");
  assert.equal(autoCheckoutQueries, 1, "FULL must retain its legacy auto-checkout lookup");
  assert.deepEqual(deletes.map((entry) => entry.where.scope), [InboxScope.FULL, InboxScope.FULL]);
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

async function main() {
  try {
    await testSafeAttendanceProducer();
    await testAttendanceSchedulerIsolation();
  } finally {
    restore();
  }
  console.log("ok - Attendance Inbox producers are Staff-safe and scheduler-isolated from FULL jobs");
}

main().catch((error: unknown) => {
  restore();
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
