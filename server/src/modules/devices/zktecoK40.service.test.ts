import assert from "node:assert/strict";
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
import { prisma } from "../../lib/prisma";
import type { DeviceEvent } from "../../shared/devices.types";
import { processDeviceEvents } from "./zktecoK40.service";
import { FULL_DEVICE_DATA_SCOPE } from "./device-edition-scope";
import { handleDevicePush } from "./devicePush.service";
import { testDeviceConnection } from "./deviceManager";
import { formatDeviceError } from "./deviceError";

type MockCalls = {
  attendanceCreates: any[];
  attendanceUpdates: any[];
  attendanceFindFirstArgs: any[];
  accessViolationCreates: any[];
  rawLogCreates: any[];
  rawLogUpdates: any[];
  rawLogConditionalUpdates: any[];
  membershipUpdates: any[];
  inboxCreates: any[];
  deviceUpdates: any[];
  unlockSeconds: number[];
};

type MockOptions = {
  deviceUser?: any | null;
  existingLog?: any | null;
  previousLog?: any | null;
  previousLogByMemberIdOnly?: boolean;
  entriesToday?: number;
  device?: any;
};

const prismaAny = prisma as any;
const originalFns = {
  attendanceLogFindUnique: prismaAny.attendanceLog.findUnique,
  attendanceLogFindFirst: prismaAny.attendanceLog.findFirst,
  attendanceLogCreate: prismaAny.attendanceLog.create,
  attendanceLogUpdate: prismaAny.attendanceLog.update,
  attendanceLogCount: prismaAny.attendanceLog.count,
  deviceRawLogCreateMany: prismaAny.deviceRawLog.createMany,
  deviceRawLogFindUnique: prismaAny.deviceRawLog.findUnique,
  deviceRawLogUpdate: prismaAny.deviceRawLog.update,
  deviceRawLogUpdateMany: prismaAny.deviceRawLog.updateMany,
  deviceFindUnique: prismaAny.device.findUnique,
  deviceUpdate: prismaAny.device.update,
  deviceUserFindUnique: prismaAny.deviceUser.findUnique,
  accessViolationCreate: prismaAny.accessViolation.create,
  accessViolationCount: prismaAny.accessViolation.count,
  membershipUpdate: prismaAny.membership.update,
  inboxItemFindUnique: prismaAny.inboxItem.findUnique,
  inboxItemCreate: prismaAny.inboxItem.create,
};

function restorePrisma() {
  prismaAny.attendanceLog.findUnique = originalFns.attendanceLogFindUnique;
  prismaAny.attendanceLog.findFirst = originalFns.attendanceLogFindFirst;
  prismaAny.attendanceLog.create = originalFns.attendanceLogCreate;
  prismaAny.attendanceLog.update = originalFns.attendanceLogUpdate;
  prismaAny.attendanceLog.count = originalFns.attendanceLogCount;
  prismaAny.deviceRawLog.createMany = originalFns.deviceRawLogCreateMany;
  prismaAny.deviceRawLog.findUnique = originalFns.deviceRawLogFindUnique;
  prismaAny.deviceRawLog.update = originalFns.deviceRawLogUpdate;
  prismaAny.deviceRawLog.updateMany = originalFns.deviceRawLogUpdateMany;
  prismaAny.device.findUnique = originalFns.deviceFindUnique;
  prismaAny.device.update = originalFns.deviceUpdate;
  prismaAny.deviceUser.findUnique = originalFns.deviceUserFindUnique;
  prismaAny.accessViolation.create = originalFns.accessViolationCreate;
  prismaAny.accessViolation.count = originalFns.accessViolationCount;
  prismaAny.membership.update = originalFns.membershipUpdate;
  prismaAny.inboxItem.findUnique = originalFns.inboxItemFindUnique;
  prismaAny.inboxItem.create = originalFns.inboxItemCreate;
}

function mockPrisma(options: MockOptions): MockCalls {
  const calls: MockCalls = {
    attendanceCreates: [],
    attendanceUpdates: [],
    attendanceFindFirstArgs: [],
    accessViolationCreates: [],
    rawLogCreates: [],
    rawLogUpdates: [],
    rawLogConditionalUpdates: [],
    membershipUpdates: [],
    inboxCreates: [],
    deviceUpdates: [],
    unlockSeconds: [],
  };

  prismaAny.attendanceLog.findUnique = async () => options.existingLog ?? null;
  prismaAny.attendanceLog.findFirst = async (args: any) => {
    calls.attendanceFindFirstArgs.push(args);
    if (!options.previousLog) return null;
    if (!options.previousLogByMemberIdOnly) return options.previousLog;
    const memberId = options.deviceUser?.memberId;
    if (args?.where?.memberId === memberId) return options.previousLog;
    const ownerFilters = args?.where?.OR ?? [];
    return ownerFilters.some((filter: any) => filter?.memberId === memberId) ? options.previousLog : null;
  };
  prismaAny.attendanceLog.count = async () => options.entriesToday ?? 0;
  prismaAny.attendanceLog.create = async ({ data }: { data: any }) => {
    calls.attendanceCreates.push(data);
    return { id: `log-${calls.attendanceCreates.length}`, createdAt: new Date(), ...data };
  };
  prismaAny.attendanceLog.update = async ({ where, data }: { where: any; data: any }) => {
    calls.attendanceUpdates.push({ where, data });
    return { id: where.id, ...data };
  };
  prismaAny.deviceRawLog.createMany = async ({ data }: { data: any }) => {
    calls.rawLogCreates.push(data);
    return { count: 1 };
  };
  prismaAny.deviceRawLog.findUnique = async () => {
    const data = calls.rawLogCreates.at(-1);
    return data
      ? { id: `raw-log-${calls.rawLogCreates.length}`, status: data.status ?? DeviceRawLogStatus.PENDING, processedAt: null }
      : null;
  };
  prismaAny.deviceRawLog.update = async ({ where, data }: { where: any; data: any }) => {
    calls.rawLogUpdates.push({ where, data });
    return { id: where.id, ...data };
  };
  prismaAny.deviceRawLog.updateMany = async ({ where, data }: { where: any; data: any }) => {
    calls.rawLogConditionalUpdates.push({ where, data });
    return { count: 1 };
  };
  prismaAny.device.findUnique = async () =>
    options.device ?? { id: "device-1", name: "K40 test device" };
  prismaAny.device.update = async ({ where, data }: { where: any; data: any }) => {
    calls.deviceUpdates.push({ where, data });
    return { id: where.id, ...data };
  };
  prismaAny.deviceUser.findUnique = async () => options.deviceUser ?? null;
  prismaAny.accessViolation.create = async ({ data }: { data: any }) => {
    calls.accessViolationCreates.push(data);
    return { id: `violation-${calls.accessViolationCreates.length}`, occurredAt: new Date(), ...data };
  };
  prismaAny.accessViolation.count = async () => calls.accessViolationCreates.length;
  prismaAny.membership.update = async ({ where, data }: { where: any; data: any }) => {
    calls.membershipUpdates.push({ where, data });
    return { id: where.id, ...data };
  };
  prismaAny.inboxItem.findUnique = async () => null;
  prismaAny.inboxItem.create = async ({ data }: { data: any }) => {
    calls.inboxCreates.push(data);
    return { id: `inbox-${calls.inboxCreates.length}`, readAt: null, ...data };
  };

  return calls;
}

function buildUnlockClient(calls: MockCalls) {
  return {
    unlockDoor: async (seconds: number) => {
      calls.unlockSeconds.push(seconds);
    },
  };
}

function buildEvent(overrides: Partial<DeviceEvent> = {}): DeviceEvent {
  return {
    deviceId: "device-1",
    externalUserId: "101",
    timestamp: new Date(2026, 4, 25, 10, 0, 0),
    eventType: "CHECK_IN",
    recordId: 1,
    ...overrides,
  };
}

function lastCall<T>(items: T[]): T {
  const item = items[items.length - 1];
  assert.ok(item);
  return item;
}

function buildMembership(overrides: any = {}) {
  return {
    id: "membership-1",
    memberId: "member-1",
    status: MembershipStatus.ACTIVE,
    startDate: new Date(2026, 4, 1),
    endDate: new Date(2026, 5, 30),
    expiresAt: new Date(2026, 5, 30),
    totalDue: 100,
    totalPaid: 100,
    basePrice: 100,
    activatedAt: new Date(2026, 4, 1),
    createdAt: new Date(2026, 3, 20),
    plan: {
      basePrice: 100,
      durationValue: 1,
      durationUnit: PlanDurationUnit.MONTHS,
    },
    ...overrides,
  };
}

function buildMember(overrides: any = {}) {
  return {
    id: "member-1",
    code: "M-001",
    firstName: "Test",
    lastName: "Member",
    memberType: MemberType.CUSTOMER,
    isStaff: false,
    isBlacklisted: false,
    status: MemberStatus.ACTIVE,
    accessPolicy: {
      id: "policy-1",
      memberId: "member-1",
      allowedDays: [],
      maxEntriesPerDay: null,
      rules: [],
    },
    memberships: [buildMembership()],
    shifts: [],
    ...overrides,
  };
}

function buildDeviceUser(member: any = buildMember()) {
  return {
    id: "device-user-1",
    externalId: 101,
    memberId: member.id,
    member,
  };
}

async function testAuthorizedCustomerEntry() {
  const calls = mockPrisma({ deviceUser: buildDeviceUser() });
  const event = buildEvent({ recordId: 10 });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(summary.maxRecordId, 10);
  assert.equal(summary.maxTimestamp, event.timestamp);
  assert.equal(calls.attendanceCreates.length, 1);
  assert.equal(calls.attendanceCreates[0].entryType, AttendanceType.IN);
  assert.equal(calls.attendanceCreates[0].source, AttendanceSource.DEVICE);
  assert.equal(calls.attendanceCreates[0].isAuthorized, true);
  assert.equal(calls.attendanceCreates[0].reason, null);
  assert.equal(typeof calls.attendanceCreates[0].dedupeKey, "string");
  assert.equal(calls.rawLogCreates.length, 1);
  assert.equal(calls.rawLogCreates[0].status, DeviceRawLogStatus.PENDING);
  assert.equal(calls.rawLogCreates[0].dataHash, calls.attendanceCreates[0].dedupeKey);
  assert.equal(calls.attendanceCreates[0].rawLogId, "raw-log-1");
  assert.equal(lastCall(calls.rawLogUpdates).data.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(calls.accessViolationCreates.length, 0);
  assert.equal(calls.unlockSeconds.length, 1);
}

async function testDuplicateDeviceEventIsSkipped() {
  const calls = mockPrisma({
    existingLog: { id: "existing-log", dedupeKey: "already-seen" },
    deviceUser: buildDeviceUser(),
  });
  const summary = await processDeviceEvents([buildEvent({ recordId: 20 })], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 0);
  assert.equal(summary.maxRecordId, 20, "a terminal legacy duplicate must advance the Pull cursor");
  assert.equal(calls.rawLogCreates.length, 1);
  assert.equal(lastCall(calls.rawLogConditionalUpdates).data.status, DeviceRawLogStatus.SKIPPED_DUPLICATE);
  assert.deepEqual(lastCall(calls.rawLogConditionalUpdates).where.status, {
    not: DeviceRawLogStatus.PROCESSED,
  });
  assert.equal(calls.attendanceCreates.length, 0);
  assert.equal(calls.accessViolationCreates.length, 0);
  assert.equal(calls.unlockSeconds.length, 0);

  const restartReplayCalls = mockPrisma({ deviceUser: buildDeviceUser() });
  prismaAny.deviceRawLog.createMany = async () => ({ count: 0 });
  prismaAny.deviceRawLog.findUnique = async () => ({
    id: "raw-terminal-legacy",
    status: DeviceRawLogStatus.SKIPPED_INVALID,
    processedAt: new Date("2026-08-11T08:00:00.000Z"),
  });
  prismaAny.deviceUser.findUnique = async () => {
    throw new Error("a terminal FULL RawLog replay must not re-run identity or feed side effects");
  };
  const restartReplay = await processDeviceEvents(
    [buildEvent({ externalUserId: "404", recordId: 21 })],
    { scope: FULL_DEVICE_DATA_SCOPE, unlockClient: buildUnlockClient(restartReplayCalls) as any }
  );
  assert.equal(restartReplay.processedCount, 0);
  assert.equal(restartReplay.maxRecordId, 21);
  assert.equal(restartReplayCalls.rawLogUpdates.length, 0);
  assert.equal(restartReplayCalls.rawLogConditionalUpdates.length, 0);
  assert.equal(restartReplayCalls.inboxCreates.length, 0);
}

async function testTimeNotAllowedIsDenied() {
  const member = buildMember({
    accessPolicy: {
      id: "policy-time",
      memberId: "member-1",
      allowedDays: [2],
      maxEntriesPerDay: null,
      rules: [{ id: "rule-1", weekday: 2, fromTime: "09:00", toTime: "17:00" }],
    },
  });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const event = buildEvent({ timestamp: new Date(2026, 4, 25, 20, 0, 0), recordId: 30 });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates.length, 1);
  assert.equal(calls.attendanceCreates[0].isAuthorized, false);
  assert.equal(calls.attendanceCreates[0].reason, AccessViolationReason.TIME_NOT_ALLOWED);
  assert.equal(calls.attendanceCreates[0].rawLogId, "raw-log-1");
  assert.equal(lastCall(calls.rawLogUpdates).data.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(calls.accessViolationCreates.length, 1);
  assert.equal(calls.accessViolationCreates[0].reason, AccessViolationReason.TIME_NOT_ALLOWED);
  assert.equal(calls.unlockSeconds.length, 0);
}

async function testUnknownDeviceUserKeepsRawLogForAudit() {
  const calls = mockPrisma({ deviceUser: null });
  const summary = await processDeviceEvents([buildEvent({ externalUserId: "404", recordId: 35 })], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 0);
  assert.equal(summary.maxRecordId, 35, "a terminal legacy unknown user must advance the Pull cursor");
  assert.equal(calls.rawLogCreates.length, 1);
  assert.equal(lastCall(calls.rawLogConditionalUpdates).data.status, DeviceRawLogStatus.SKIPPED_INVALID);
  assert.equal(lastCall(calls.rawLogConditionalUpdates).data.processError, "DEVICE_USER_NOT_FOUND");
  assert.equal(calls.attendanceCreates.length, 0);
  assert.equal(calls.accessViolationCreates.length, 0);
  assert.equal(calls.unlockSeconds.length, 0);
}

async function testMembershipDebtIsDenied() {
  const member = buildMember({
    memberships: [buildMembership({ totalDue: 100, totalPaid: 40 })],
  });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const summary = await processDeviceEvents([buildEvent({ recordId: 40 })], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates[0].isAuthorized, false);
  assert.equal(calls.attendanceCreates[0].reason, AccessViolationReason.MEMBERSHIP_DEBT);
  assert.equal(calls.accessViolationCreates[0].reason, AccessViolationReason.MEMBERSHIP_DEBT);
  assert.equal(calls.unlockSeconds.length, 0);
}

async function testExpiredMembershipIsDenied() {
  const member = buildMember({
    memberships: [buildMembership({ endDate: new Date(2026, 3, 30) })],
  });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const summary = await processDeviceEvents([buildEvent({ recordId: 50 })], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates[0].isAuthorized, false);
  assert.equal(calls.attendanceCreates[0].reason, AccessViolationReason.MEMBERSHIP_INACTIVE);
  assert.equal(calls.accessViolationCreates[0].reason, AccessViolationReason.MEMBERSHIP_INACTIVE);
  assert.equal(calls.unlockSeconds.length, 0);
}

async function testInactiveAndBlacklistedMembersAreDenied() {
  const cases = [
    {
      member: buildMember({ status: MemberStatus.BLOCKED }),
      expected: AccessViolationReason.INACTIVE_MEMBER,
    },
    {
      member: buildMember({ status: MemberStatus.DEBTOR }),
      expected: AccessViolationReason.DEBTOR,
    },
    {
      member: buildMember({ status: MemberStatus.EXPIRED }),
      expected: AccessViolationReason.EXPIRED,
    },
    {
      member: buildMember({ isBlacklisted: true }),
      expected: AccessViolationReason.BLACKLISTED,
    },
  ];

  for (const item of cases) {
    const calls = mockPrisma({ deviceUser: buildDeviceUser(item.member) });
    const summary = await processDeviceEvents([buildEvent()], {
      scope: FULL_DEVICE_DATA_SCOPE,
      unlockClient: buildUnlockClient(calls) as any,
    });

    assert.equal(summary.processedCount, 1);
    assert.equal(calls.attendanceCreates[0].isAuthorized, false);
    assert.equal(calls.attendanceCreates[0].reason, item.expected);
    assert.equal(calls.accessViolationCreates[0].reason, item.expected);
    assert.equal(calls.unlockSeconds.length, 0);
  }
}

async function testPendingMembershipActivatesOnFirstAuthorizedEntry() {
  const pendingMembership = buildMembership({
    id: "membership-pending",
    status: MembershipStatus.PENDING,
    activatedAt: null,
    startDate: new Date(2026, 4, 1),
    endDate: new Date(2026, 4, 1),
    expiresAt: new Date(2026, 4, 1),
    createdAt: new Date(2026, 4, 20),
  });
  const member = buildMember({ memberships: [pendingMembership] });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const event = buildEvent({ timestamp: new Date(2026, 4, 25, 11, 0, 0), recordId: 60 });
  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates[0].isAuthorized, true);
  assert.equal(calls.membershipUpdates.length, 1);
  assert.deepEqual(calls.membershipUpdates[0].where, { id: "membership-pending", activatedAt: null });
  assert.equal(calls.membershipUpdates[0].data.status, MembershipStatus.ACTIVE);
  assert.equal(calls.membershipUpdates[0].data.activatedAt, event.timestamp);
  assert.equal(calls.membershipUpdates[0].data.startDate, event.timestamp);
  assert.ok(calls.membershipUpdates[0].data.endDate > event.timestamp);
  assert.equal(calls.unlockSeconds.length, 1);
}

async function testLateStaffCheckoutUsesMemberHistoryAfterDeviceUserRelink() {
  const member = buildMember({
    memberType: MemberType.STAFF,
    isStaff: true,
    memberships: [],
    shifts: [
      {
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [0, 1, 2, 3, 4, 5],
        earlyAccessMinutes: 15,
        isActive: true,
      },
    ],
    accessPolicy: {
      id: "policy-staff",
      memberId: "member-1",
      allowedDays: [0, 1, 2, 3, 4, 5],
      maxEntriesPerDay: null,
      rules: [],
    },
  });
  const previousLog = {
    entryType: AttendanceType.IN,
    recordedAt: new Date(2026, 5, 3, 12, 51, 0),
  };
  const calls = mockPrisma({
    deviceUser: buildDeviceUser(member),
    previousLog,
    previousLogByMemberIdOnly: true,
  });
  const event = buildEvent({
    timestamp: new Date(2026, 5, 3, 16, 4, 0),
    eventType: "CHECK_IN",
    recordId: 70,
  });

  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceFindFirstArgs.length, 1);
  assert.equal(calls.attendanceFindFirstArgs[0].where.memberId, member.id);
  assert.equal(calls.attendanceCreates.length, 1);
  assert.equal(calls.attendanceCreates[0].entryType, AttendanceType.OUT);
  assert.equal(calls.attendanceCreates[0].isAuthorized, true);
  assert.equal(calls.attendanceCreates[0].reason, null);
  assert.equal(calls.accessViolationCreates.length, 0);
  assert.equal(calls.unlockSeconds.length, 1);
}

async function testStaffEntryWithinEarlyAccessWindowIsAllowed() {
  const member = buildMember({
    memberType: MemberType.STAFF,
    isStaff: true,
    memberships: [],
    shifts: [
      {
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        earlyAccessMinutes: 15,
        isActive: true,
      },
    ],
    accessPolicy: {
      id: "policy-staff-early",
      memberId: "member-1",
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      maxEntriesPerDay: null,
      rules: [],
    },
  });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const event = buildEvent({
    timestamp: new Date(2026, 5, 3, 7, 50, 0),
    eventType: "CHECK_IN",
    recordId: 80,
  });

  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates.length, 1);
  assert.equal(calls.attendanceCreates[0].entryType, AttendanceType.IN);
  assert.equal(calls.attendanceCreates[0].isAuthorized, true);
  assert.equal(calls.attendanceCreates[0].reason, null);
  assert.equal(calls.accessViolationCreates.length, 0);
  assert.equal(calls.unlockSeconds.length, 1);
}

async function testStaffEntryBeforeEarlyAccessWindowIsDenied() {
  const member = buildMember({
    memberType: MemberType.STAFF,
    isStaff: true,
    memberships: [],
    shifts: [
      {
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        earlyAccessMinutes: 15,
        isActive: true,
      },
    ],
    accessPolicy: {
      id: "policy-staff-before-early",
      memberId: "member-1",
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      maxEntriesPerDay: null,
      rules: [],
    },
  });
  const calls = mockPrisma({ deviceUser: buildDeviceUser(member) });
  const event = buildEvent({
    timestamp: new Date(2026, 5, 3, 7, 44, 0),
    eventType: "CHECK_IN",
    recordId: 90,
  });

  const summary = await processDeviceEvents([event], {
    scope: FULL_DEVICE_DATA_SCOPE,
    unlockClient: buildUnlockClient(calls) as any,
  });

  assert.equal(summary.processedCount, 1);
  assert.equal(calls.attendanceCreates.length, 1);
  assert.equal(calls.attendanceCreates[0].entryType, AttendanceType.IN);
  assert.equal(calls.attendanceCreates[0].isAuthorized, false);
  assert.equal(calls.attendanceCreates[0].reason, AccessViolationReason.TIME_NOT_ALLOWED);
  assert.equal(calls.accessViolationCreates.length, 1);
  assert.equal(calls.accessViolationCreates[0].reason, AccessViolationReason.TIME_NOT_ALLOWED);
  assert.equal(calls.unlockSeconds.length, 0);
}

async function testPushPersistsOperationalTimestamps() {
  const member = buildMember({ isBlacklisted: true });
  const calls = mockPrisma({
    deviceUser: buildDeviceUser(member),
    device: {
      id: "device-1",
      name: "K40 push device",
      type: DeviceType.FINGERPRINT,
      connectionType: DeviceConnectionType.NETWORK,
      config: { eventMode: "PUSH", pushEnabled: true },
    },
  });

  const result = await handleDevicePush({
    deviceId: "device-1",
    events: [
      {
        userId: "101",
        timestamp: new Date(2026, 6, 16, 9, 30, 0).toISOString(),
        type: "in",
        recordId: 901,
      },
    ],
  });

  assert.equal(result.received, 1);
  assert.equal(result.processed, 1);
  assert.ok(calls.deviceUpdates.some((call) => call.data.lastPushAt instanceof Date));
  assert.ok(calls.deviceUpdates.some((call) => call.data.lastEventReceivedAt instanceof Date));
  assert.ok(calls.deviceUpdates.some((call) => call.data.lastEventProcessedAt instanceof Date));
}

async function testConnectionErrorPersistsOperationalDetails() {
  const calls = mockPrisma({
    device: {
      id: "device-1",
      name: "Invalid K40",
      type: DeviceType.FINGERPRINT,
      connectionType: DeviceConnectionType.NETWORK,
      config: {},
    },
  });

  const result = await testDeviceConnection("device-1", FULL_DEVICE_DATA_SCOPE);

  assert.equal(result.ok, false);
  const errorUpdate = calls.deviceUpdates.find((call) => call.data.status === DeviceStatus.ERROR);
  assert.ok(errorUpdate);
  assert.ok(errorUpdate.data.lastErrorAt instanceof Date);
  assert.match(errorUpdate.data.lastErrorMessage, /IP\/port missing/);
}

async function testNonStandardDeviceErrorIsNormalized() {
  const message = formatDeviceError({
    err: {
      errno: -4039,
      code: "ETIMEDOUT",
      syscall: "connect",
      address: "192.168.1.200",
      port: 4370,
    },
    command: "TCP CONNECT",
  });

  assert.equal(message, "ETIMEDOUT · connect · 192.168.1.200:4370");
}

async function run() {
  const tests: Array<{ name: string; execute: () => Promise<void> }> = [
    { name: "authorized customer entry", execute: testAuthorizedCustomerEntry },
    { name: "duplicate device event is skipped", execute: testDuplicateDeviceEventIsSkipped },
    { name: "time not allowed is denied", execute: testTimeNotAllowedIsDenied },
    { name: "unknown device user keeps raw log for audit", execute: testUnknownDeviceUserKeepsRawLogForAudit },
    { name: "membership debt is denied", execute: testMembershipDebtIsDenied },
    { name: "expired membership is denied", execute: testExpiredMembershipIsDenied },
    { name: "inactive, debtor, expired, and blacklisted members are denied", execute: testInactiveAndBlacklistedMembersAreDenied },
    { name: "pending membership activates on first authorized entry", execute: testPendingMembershipActivatesOnFirstAuthorizedEntry },
    { name: "late staff checkout uses member history after device user relink", execute: testLateStaffCheckoutUsesMemberHistoryAfterDeviceUserRelink },
    { name: "staff entry within early access window is allowed", execute: testStaffEntryWithinEarlyAccessWindowIsAllowed },
    { name: "staff entry before early access window is denied", execute: testStaffEntryBeforeEarlyAccessWindowIsDenied },
    { name: "push persists operational timestamps", execute: testPushPersistsOperationalTimestamps },
    { name: "connection errors persist operational details", execute: testConnectionErrorPersistsOperationalDetails },
    { name: "non-standard device errors are normalized", execute: testNonStandardDeviceErrorIsNormalized },
  ];

  try {
    for (const test of tests) {
      await test.execute();
      console.log(`ok - K40 ${test.name}`);
    }
  } finally {
    restorePrisma();
  }
}

run().catch((error) => {
  restorePrisma();
  console.error(error);
  process.exitCode = 1;
});
