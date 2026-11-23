import assert from "node:assert/strict";
import { createHash, randomInt, randomUUID } from "node:crypto";
import {
  AccessViolationReason,
  AttendanceSource,
  AttendanceType,
  DeviceConnectionType,
  DeviceRawLogStatus,
  DeviceStatus,
  DeviceType,
  MemberStatus,
  MemberType,
  MembershipStatus,
  PlanDurationUnit,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import type { DeviceEvent } from "../../shared/devices.types";
import { processDeviceEvents } from "./zktecoK40.service";
import { FULL_DEVICE_DATA_SCOPE } from "./device-edition-scope";

type Fixture = {
  suffix: string;
  deviceId: string;
  memberId: string;
  planId: string;
  membershipId: string;
  deviceUserId: string;
  externalId: number;
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("K40 database integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["DEVICE_DB_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`K40 database integration tests refuse non-local database host: ${hostname}`);
  }
}

async function chooseExternalId() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomInt(1_500_000_000, 2_000_000_000);
    const exists = await prisma.deviceUser.findUnique({ where: { externalId: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error("Unable to allocate an isolated device external id");
}

async function allocateFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  return {
    suffix,
    deviceId: `it-k40-device-${suffix}`,
    memberId: `it-k40-member-${suffix}`,
    planId: `it-k40-plan-${suffix}`,
    membershipId: `it-k40-membership-${suffix}`,
    deviceUserId: `it-k40-user-${suffix}`,
    externalId: await chooseExternalId(),
  };
}

async function createFixtureRecords(fixture: Fixture) {
  const now = new Date();
  const membershipStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const membershipEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await prisma.device.create({
    data: {
      id: fixture.deviceId,
      name: `__K40_DB_INTEGRATION__${fixture.suffix}`,
      type: DeviceType.FINGERPRINT,
      connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
      enabled: false,
      status: DeviceStatus.OFFLINE,
      config: { ip: "127.0.0.1", port: 4370, eventMode: "PULL" },
      model: "K40 integration fixture",
    },
  });
  await prisma.membershipPlan.create({
    data: {
      id: fixture.planId,
      name: `__K40_DB_INTEGRATION_PLAN__${fixture.suffix}`,
      slug: `it-k40-${fixture.suffix}`,
      durationDays: 30,
      price: 100,
      durationValue: 1,
      durationUnit: PlanDurationUnit.MONTHS,
      basePrice: 100,
      isActive: true,
    },
  });
  await prisma.member.create({
    data: {
      id: fixture.memberId,
      code: `IT-K40-${fixture.suffix}`,
      firstName: "Database",
      lastName: "Integration Fixture",
      memberType: MemberType.CUSTOMER,
      status: MemberStatus.ACTIVE,
      isStaff: false,
      isBlacklisted: false,
    },
  });
  await prisma.membership.create({
    data: {
      id: fixture.membershipId,
      memberId: fixture.memberId,
      planId: fixture.planId,
      startDate: membershipStart,
      endDate: membershipEnd,
      expiresAt: membershipEnd,
      status: MembershipStatus.ACTIVE,
      basePrice: 100,
      totalDue: 100,
      totalPaid: 100,
      activatedAt: membershipStart,
    },
  });
  await prisma.deviceUser.create({
    data: {
      id: fixture.deviceUserId,
      externalId: fixture.externalId,
      deviceId: fixture.deviceId,
      memberId: fixture.memberId,
      lastSyncedAt: now,
    },
  });
}

function buildEvent(fixture: Fixture, input: { offsetMinutes: number; recordId: number; externalUserId?: string }): DeviceEvent {
  const timestamp = new Date(Date.now() - 10 * 60 * 1000 + input.offsetMinutes * 60 * 1000);
  timestamp.setMilliseconds(0);
  return {
    deviceId: fixture.deviceId,
    externalUserId: input.externalUserId ?? String(fixture.externalId),
    timestamp,
    eventType: "CHECK_IN",
    recordId: input.recordId,
    raw: {
      uid: fixture.externalId,
      id: input.recordId,
      timestamp: timestamp.toISOString(),
      state: 0,
      type: 0,
      source: "K40_INTEGRATION_FIXTURE",
    },
  };
}

function dedupeKey(event: DeviceEvent) {
  const payload = `${event.deviceId}|${event.externalUserId}|${event.timestamp.toISOString()}|${event.eventType}|${event.recordId ?? ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

async function testAuthorizedPersistenceAndIdempotency(fixture: Fixture, unlockCalls: number[]) {
  const event = buildEvent(fixture, { offsetMinutes: 0, recordId: randomInt(10_000_000, 20_000_000) });
  const context = {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: {
      unlockDoor: async (seconds: number) => {
        unlockCalls.push(seconds);
      },
    } as never,
  };
  const firstSummary = await processDeviceEvents([event], context);
  assert.equal(firstSummary.processedCount, 1);
  assert.equal(firstSummary.maxRecordId, event.recordId);
  assert.equal(unlockCalls.length, 1);

  const rawLog = await prisma.deviceRawLog.findUnique({
    where: { dataHash: dedupeKey(event) },
    include: { attendance: true },
  });
  assert.ok(rawLog, "Authorized event did not persist a raw log");
  assert.equal(rawLog.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(rawLog.processError, null);
  assert.ok(rawLog.processedAt);
  assert.equal(rawLog.attendance?.rawLogId, rawLog.id);
  assert.equal(rawLog.attendance?.memberId, fixture.memberId);
  assert.equal(rawLog.attendance?.deviceUserId, fixture.deviceUserId);
  assert.equal(rawLog.attendance?.source, AttendanceSource.DEVICE);
  assert.equal(rawLog.attendance?.entryType, AttendanceType.IN);
  assert.equal(rawLog.attendance?.isAuthorized, true);
  assert.equal(rawLog.attendance?.dedupeKey, rawLog.dataHash);

  const secondSummary = await processDeviceEvents([event], context);
  assert.equal(secondSummary.processedCount, 0);
  assert.equal(unlockCalls.length, 1, "Duplicate event attempted to unlock the door");
  assert.equal(await prisma.deviceRawLog.count({ where: { dataHash: dedupeKey(event) } }), 1);
  assert.equal(await prisma.attendanceLog.count({ where: { dedupeKey: dedupeKey(event) } }), 1);
  const persistedAfterDuplicate = await prisma.deviceRawLog.findUnique({ where: { dataHash: dedupeKey(event) } });
  assert.equal(persistedAfterDuplicate?.status, DeviceRawLogStatus.PROCESSED);
  console.log("✓ authorized raw-log/attendance persistence and repeated-event idempotency");
}

async function testPreexistingAttendanceDedupe(fixture: Fixture, unlockCalls: number[]) {
  const event = buildEvent(fixture, { offsetMinutes: 2, recordId: randomInt(20_000_000, 30_000_000) });
  const hash = dedupeKey(event);
  await prisma.attendanceLog.create({
    data: {
      memberId: fixture.memberId,
      deviceUserId: fixture.deviceUserId,
      recordedAt: event.timestamp,
      entryType: AttendanceType.IN,
      source: AttendanceSource.DEVICE,
      isAuthorized: true,
      dedupeKey: hash,
    },
  });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: { unlockDoor: async (seconds: number) => unlockCalls.push(seconds) } as never,
  });
  assert.equal(summary.processedCount, 0);
  assert.equal(await prisma.attendanceLog.count({ where: { dedupeKey: hash } }), 1);
  const rawLog = await prisma.deviceRawLog.findUnique({ where: { dataHash: hash } });
  assert.equal(rawLog?.status, DeviceRawLogStatus.SKIPPED_DUPLICATE);
  assert.equal(rawLog?.processError, "ATTENDANCE_DEDUPE_MATCH");
  assert.equal(unlockCalls.length, 1);
  console.log("✓ database dedupe constraint produces one attendance row and a skipped raw log");
}

async function testInvalidUserPersistence(fixture: Fixture, unlockCalls: number[]) {
  const event = buildEvent(fixture, {
    offsetMinutes: 4,
    recordId: randomInt(30_000_000, 40_000_000),
    externalUserId: `invalid-${fixture.suffix}`,
  });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: { unlockDoor: async (seconds: number) => unlockCalls.push(seconds) } as never,
  });
  assert.equal(summary.processedCount, 0);
  const rawLog = await prisma.deviceRawLog.findUnique({ where: { dataHash: dedupeKey(event) } });
  assert.equal(rawLog?.status, DeviceRawLogStatus.SKIPPED_INVALID);
  assert.equal(rawLog?.processError, "NON_NUMERIC_EXTERNAL_USER_ID");
  assert.equal(await prisma.attendanceLog.count({ where: { dedupeKey: dedupeKey(event) } }), 0);
  assert.equal(unlockCalls.length, 1);
  console.log("✓ invalid device user is retained for audit without attendance creation");
}

async function testDeniedPersistence(fixture: Fixture, unlockCalls: number[]) {
  await prisma.member.update({ where: { id: fixture.memberId }, data: { status: MemberStatus.DEBTOR } });
  const event = buildEvent(fixture, { offsetMinutes: 6, recordId: randomInt(40_000_000, 50_000_000) });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: { unlockDoor: async (seconds: number) => unlockCalls.push(seconds) } as never,
  });
  assert.equal(summary.processedCount, 1);
  const rawLog = await prisma.deviceRawLog.findUnique({
    where: { dataHash: dedupeKey(event) },
    include: { attendance: true },
  });
  assert.equal(rawLog?.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(rawLog?.attendance?.isAuthorized, false);
  assert.equal(rawLog?.attendance?.reason, AccessViolationReason.DEBTOR);
  const violation = await prisma.accessViolation.findFirst({
    where: { memberId: fixture.memberId, deviceUserId: fixture.deviceUserId },
    orderBy: { occurredAt: "desc" },
  });
  assert.equal(violation?.reason, AccessViolationReason.DEBTOR);
  assert.equal(unlockCalls.length, 1, "Denied event attempted to unlock the door");
  console.log("✓ denied event persists attendance/access violation without door unlock");
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.inboxItem.deleteMany({
    where: { OR: [{ deviceId: fixture.deviceId }, { memberId: fixture.memberId }] },
  });
  await prisma.attendanceLog.deleteMany({
    where: { OR: [{ memberId: fixture.memberId }, { deviceUserId: fixture.deviceUserId }] },
  });
  await prisma.accessViolation.deleteMany({
    where: { OR: [{ memberId: fixture.memberId }, { deviceUserId: fixture.deviceUserId }] },
  });
  await prisma.deviceRawLog.deleteMany({ where: { deviceId: fixture.deviceId } });
  await prisma.membership.deleteMany({ where: { id: fixture.membershipId } });
  await prisma.deviceUser.deleteMany({ where: { id: fixture.deviceUserId } });
  await prisma.member.deleteMany({ where: { id: fixture.memberId } });
  await prisma.membershipPlan.deleteMany({ where: { id: fixture.planId } });
  await prisma.device.deleteMany({ where: { id: fixture.deviceId } });

  const leftovers = await prisma.$transaction([
    prisma.device.count({ where: { id: fixture.deviceId } }),
    prisma.member.count({ where: { id: fixture.memberId } }),
    prisma.membershipPlan.count({ where: { id: fixture.planId } }),
    prisma.membership.count({ where: { id: fixture.membershipId } }),
    prisma.deviceUser.count({ where: { id: fixture.deviceUserId } }),
    prisma.deviceRawLog.count({ where: { deviceId: fixture.deviceId } }),
    prisma.attendanceLog.count({ where: { OR: [{ memberId: fixture.memberId }, { deviceUserId: fixture.deviceUserId }] } }),
    prisma.accessViolation.count({ where: { OR: [{ memberId: fixture.memberId }, { deviceUserId: fixture.deviceUserId }] } }),
    prisma.inboxItem.count({ where: { OR: [{ deviceId: fixture.deviceId }, { memberId: fixture.memberId }] } }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  console.log("✓ integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await allocateFixture();
  const unlockCalls: number[] = [];
  try {
    await createFixtureRecords(fixture);
    await testAuthorizedPersistenceAndIdempotency(fixture, unlockCalls);
    await testPreexistingAttendanceDedupe(fixture, unlockCalls);
    await testInvalidUserPersistence(fixture, unlockCalls);
    await testDeniedPersistence(fixture, unlockCalls);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("K40 database integration tests passed (4/4 scenarios, cleanup verified). ");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
