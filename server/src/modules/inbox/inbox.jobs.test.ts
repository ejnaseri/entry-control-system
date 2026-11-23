import assert from "node:assert/strict";
import path from "node:path";
import { AttendanceSource, AttendanceType, MemberType } from "@prisma/client";
import {
  ATTENDANCE_AUTO_CHECKOUT_SETTINGS,
  resolveAttendanceAutoCheckoutDecision,
  type AttendanceAutoCheckoutSetting,
} from "../../shared/attendance-auto-checkout";

const TEST_DATABASE_URL = "postgresql://auto_checkout_test:auto_checkout_test@127.0.0.1:1/auto_checkout_test";
const missingDotenvPath = path.join(__dirname, `.inbox-jobs-test-missing-${process.pid}.env`);

process.env["NODE_ENV"] = "test";
process.env["APP_EDITION"] = "FULL";
process.env["ATTENDANCE_POLICY"] = "TIME_CLOCK";
process.env["ATTENDANCE_AUTO_CHECKOUT_ENABLED"] = "0";
process.env["ATTENDANCE_AUTO_CHECKOUT_AFTER_MINUTES"] = "240";
process.env["ATTENDANCE_AUTO_CHECKOUT_LOOKBACK_HOURS"] = "36";
process.env["DATABASE_URL"] = TEST_DATABASE_URL;
process.env["PORT"] = "4000";
process.env["LOG_LEVEL"] = "error";
process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
process.env["DOTENV_CONFIG_QUIET"] = "true";

const { prisma } = require("../../lib/prisma") as typeof import("../../lib/prisma");
const { inboxJobsTestHooks } = require("./inbox.jobs") as typeof import("./inbox.jobs");

const prismaForTest = prisma as any;
const originalAttendanceFindMany = prismaForTest.attendanceLog.findMany;
const originalAttendanceCreate = prismaForTest.attendanceLog.create;

const fixedNow = new Date(2026, 7, 17, 18, 0, 0, 0);
const eligiblePunchAt = new Date(2026, 7, 17, 8, 30, 0, 0);
const expectedCheckoutAt = new Date(2026, 7, 17, 9, 0, 0, 0);
const allWeekdays = [0, 1, 2, 3, 4, 5, 6];

const eligibleOpenSession = {
  id: "attendance-in",
  memberId: "staff-1",
  deviceUserId: "device-user-1",
  recordedAt: eligiblePunchAt,
  entryType: AttendanceType.IN,
  isAuthorized: true,
  member: {
    id: "staff-1",
    shifts: [
      {
        shiftStart: "08:00",
        shiftEnd: "09:00",
        weekdays: allWeekdays,
        isActive: true,
      },
    ],
  },
};

const findManyInputs: any[] = [];
const createInputs: any[] = [];

function resetCalls(): void {
  findManyInputs.length = 0;
  createInputs.length = 0;
}

function assertDecisionMatrix(): void {
  assert.deepEqual(ATTENDANCE_AUTO_CHECKOUT_SETTINGS, ["0", "1"]);
  assert.equal(Object.isFrozen(ATTENDANCE_AUTO_CHECKOUT_SETTINGS), true);

  for (const setting of ATTENDANCE_AUTO_CHECKOUT_SETTINGS) {
    const attendanceDecision = resolveAttendanceAutoCheckoutDecision("ATTENDANCE", setting);
    assert.deepEqual(attendanceDecision, {
      operational: false,
      mode: "ATTENDANCE_V1_DISABLED",
    });
    assert.equal(Object.isFrozen(attendanceDecision), true);

    const fullDecision = resolveAttendanceAutoCheckoutDecision("FULL", setting);
    assert.deepEqual(fullDecision, {
      operational: true,
      mode: "LEGACY_FULL",
    });
    assert.equal(Object.isFrozen(fullDecision), true);
  }
}

async function assertAttendanceCreatesNoSyntheticOut(setting: AttendanceAutoCheckoutSetting): Promise<void> {
  resetCalls();

  await inboxJobsTestHooks.autoCheckoutOverdueShifts({
    edition: "ATTENDANCE",
    setting,
    now: fixedNow,
  });

  assert.equal(findManyInputs.length, 0, `ATTENDANCE/${setting} must stop before reading AttendanceLog`);
  assert.equal(createInputs.length, 0, `ATTENDANCE/${setting} must not create a synthetic OUT`);
}

async function assertFullPreservesLegacyAutoCheckout(setting: AttendanceAutoCheckoutSetting): Promise<void> {
  resetCalls();

  await inboxJobsTestHooks.autoCheckoutOverdueShifts({
    edition: "FULL",
    setting,
    now: fixedNow,
  });

  assert.equal(findManyInputs.length, 1, `FULL/${setting} must preserve the legacy lookup`);
  assert.equal(createInputs.length, 1, `FULL/${setting} must preserve the legacy synthetic OUT`);

  const query = findManyInputs[0];
  assert.equal(query.where.isAuthorized, true);
  assert.deepEqual(query.where.member, {
    OR: [{ memberType: MemberType.STAFF }, { isStaff: true }],
  });
  assert.deepEqual(query.orderBy, { recordedAt: "desc" });
  assert.deepEqual(query.include, {
    member: {
      select: {
        id: true,
        shifts: {
          select: {
            shiftStart: true,
            shiftEnd: true,
            weekdays: true,
            isActive: true,
          },
        },
      },
    },
  });
  assert.equal(query.where.recordedAt.lte.getTime(), fixedNow.getTime());

  const expectedLookbackStart = new Date(fixedNow.getTime());
  expectedLookbackStart.setMinutes(expectedLookbackStart.getMinutes() - 36 * 60);
  assert.equal(query.where.recordedAt.gte.getTime(), expectedLookbackStart.getTime());

  assert.deepEqual(createInputs[0].data, {
    memberId: "staff-1",
    deviceUserId: "device-user-1",
    recordedAt: expectedCheckoutAt,
    entryType: AttendanceType.OUT,
    source: AttendanceSource.API,
    isAuthorized: true,
    reason: "auto checkout after shift end",
  });
}

async function main(): Promise<void> {
  assert.equal(Object.isFrozen(inboxJobsTestHooks), true);
  assertDecisionMatrix();

  prismaForTest.attendanceLog.findMany = async (input: any) => {
    findManyInputs.push(input);
    return [eligibleOpenSession];
  };
  prismaForTest.attendanceLog.create = async (input: any) => {
    createInputs.push(input);
    return { id: `synthetic-out-${createInputs.length}`, ...input.data };
  };

  try {
    await assertAttendanceCreatesNoSyntheticOut("0");
    await assertAttendanceCreatesNoSyntheticOut("1");
    await assertFullPreservesLegacyAutoCheckout("0");
    await assertFullPreservesLegacyAutoCheckout("1");
  } finally {
    prismaForTest.attendanceLog.findMany = originalAttendanceFindMany;
    prismaForTest.attendanceLog.create = originalAttendanceCreate;
  }

  console.log("ok - Attendance auto-checkout defaults off while FULL legacy behavior is preserved");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
