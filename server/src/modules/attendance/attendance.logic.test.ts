import assert from "node:assert/strict";
import { AttendanceSource, AttendanceType, MemberType } from "@prisma/client";
import { __testing } from "./attendance.service";

function buildLog(entryType: AttendanceType, recordedAt: Date) {
  return {
    id: `${entryType}-${recordedAt.getTime()}`,
    createdAt: recordedAt,
    updatedAt: recordedAt,
    memberId: "member-1",
    deviceUserId: null,
    membershipId: null,
    entryType,
    source: AttendanceSource.MANUAL,
    recordedAt,
    isAuthorized: true,
    reason: null,
    rawPayload: null,
    deviceUser: null,
    member: {
      id: "member-1",
      code: "1",
      firstName: "Eraj",
      lastName: "naseri",
      phone: null,
      memberType: MemberType.STAFF,
      isStaff: true,
      staffGroup: null,
      overtimePolicy: null,
    },
  };
}

function run() {
  const dayStart = new Date(2026, 4, 31, 0, 0, 0, 0);
  const logs = [
    buildLog(AttendanceType.IN, new Date(2026, 4, 31, 12, 12, 20)),
    buildLog(AttendanceType.OUT, new Date(2026, 4, 31, 12, 25, 37)),
    buildLog(AttendanceType.IN, new Date(2026, 4, 31, 13, 6, 56)),
    buildLog(AttendanceType.OUT, new Date(2026, 4, 31, 18, 56, 0)),
  ] as any[];

  const shiftLogs = __testing.filterLogsForShift(logs, { shiftStart: "08:00", shiftEnd: "16:00" }, dayStart);
  assert.equal(shiftLogs.length, 4);
  assert.equal(shiftLogs.at(-1)?.entryType, AttendanceType.OUT);

  const metrics = __testing.computeAttendanceMetrics({
    logs: shiftLogs,
    dayStart,
    hasShift: true,
    shiftStart: "08:00",
    shiftEnd: "16:00",
    graceMinutes: 0,
    now: new Date(2026, 4, 31, 19, 0, 0),
  });

  assert.equal(metrics.hasOpenSession, false);
  assert.equal(metrics.status, "LATE");
  assert.equal(metrics.checkOutAt?.getHours(), 18);
  assert.equal(metrics.checkOutAt?.getMinutes(), 56);
  console.log("ok - manual checkout after shift buffer closes daily attendance session");
}

run();
