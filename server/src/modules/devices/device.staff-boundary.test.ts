import assert from "node:assert/strict";
import {
  DeviceConnectionType,
  DeviceRawLogStatus,
  DeviceType,
  MemberStatus,
  MemberType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { DeviceEvent } from "../../shared/devices.types";
import { resolveAttendancePunchDecision } from "../../shared/attendance-policy";
import {
  DEVICE_DATA_SCOPES,
  buildStrictStaffDeviceMemberWhere,
  getDeviceDataScope,
  isAttendanceK40PullDevice,
  isAttendanceK40PullDeviceInput,
  normalizeDeviceExternalId,
  resolveDeviceRuntimePolicy,
} from "./device-edition-scope";
import {
  deleteDeviceUser,
  deviceManagerTestHooks,
  enrollDevice,
  listDeviceUsers,
  startAllActiveDevices,
  syncDeviceUsers,
  upsertDeviceUser,
} from "./deviceManager";
import { deviceServiceTestHooks } from "./device.service";
import { ZktecoK40Client } from "./zktecoK40.client";
import { processDeviceEvents } from "./zktecoK40.service";

type Calls = {
  attendanceFinds: any[];
  attendanceCreates: any[];
  attendanceUpdates: any[];
  attendanceCounts: any[];
  rawCreates: any[];
  rawUpdates: any[];
  rawConditionalUpdates: any[];
  violationCreates: any[];
  violationCounts: any[];
  membershipUpdates: any[];
  inboxCreates: any[];
  deviceUpdates: any[];
  doorCalls: number[];
};

type StaffFixture = {
  id: string;
  code: string;
  firstName: string;
  lastName: string | null;
  memberType: MemberType;
  isStaff: boolean;
  status: MemberStatus;
  archivedAt: Date | null;
};

const prismaAny = prisma as any;

const originals = {
  transaction: prismaAny.$transaction,
  attendanceFindUnique: prismaAny.attendanceLog.findUnique,
  attendanceFindFirst: prismaAny.attendanceLog.findFirst,
  attendanceCreate: prismaAny.attendanceLog.create,
  attendanceUpdate: prismaAny.attendanceLog.update,
  attendanceCount: prismaAny.attendanceLog.count,
  rawCreateMany: prismaAny.deviceRawLog.createMany,
  rawFindUnique: prismaAny.deviceRawLog.findUnique,
  rawUpdate: prismaAny.deviceRawLog.update,
  rawUpdateMany: prismaAny.deviceRawLog.updateMany,
  deviceFindUnique: prismaAny.device.findUnique,
  deviceFindMany: prismaAny.device.findMany,
  deviceFindFirst: prismaAny.device.findFirst,
  deviceUpdate: prismaAny.device.update,
  deviceUserFindUnique: prismaAny.deviceUser.findUnique,
  deviceUserFindFirst: prismaAny.deviceUser.findFirst,
  deviceUserFindMany: prismaAny.deviceUser.findMany,
  deviceUserUpdateMany: prismaAny.deviceUser.updateMany,
  memberFindFirst: prismaAny.member.findFirst,
  violationCreate: prismaAny.accessViolation.create,
  violationCount: prismaAny.accessViolation.count,
  membershipUpdate: prismaAny.membership.update,
  inboxFindUnique: prismaAny.inboxItem.findUnique,
  inboxCreate: prismaAny.inboxItem.create,
};

function restoreAll() {
  prismaAny.$transaction = originals.transaction;
  prismaAny.attendanceLog.findUnique = originals.attendanceFindUnique;
  prismaAny.attendanceLog.findFirst = originals.attendanceFindFirst;
  prismaAny.attendanceLog.create = originals.attendanceCreate;
  prismaAny.attendanceLog.update = originals.attendanceUpdate;
  prismaAny.attendanceLog.count = originals.attendanceCount;
  prismaAny.deviceRawLog.createMany = originals.rawCreateMany;
  prismaAny.deviceRawLog.findUnique = originals.rawFindUnique;
  prismaAny.deviceRawLog.update = originals.rawUpdate;
  prismaAny.deviceRawLog.updateMany = originals.rawUpdateMany;
  prismaAny.device.findUnique = originals.deviceFindUnique;
  prismaAny.device.findMany = originals.deviceFindMany;
  prismaAny.device.findFirst = originals.deviceFindFirst;
  prismaAny.device.update = originals.deviceUpdate;
  prismaAny.deviceUser.findUnique = originals.deviceUserFindUnique;
  prismaAny.deviceUser.findFirst = originals.deviceUserFindFirst;
  prismaAny.deviceUser.findMany = originals.deviceUserFindMany;
  prismaAny.deviceUser.updateMany = originals.deviceUserUpdateMany;
  prismaAny.member.findFirst = originals.memberFindFirst;
  prismaAny.accessViolation.create = originals.violationCreate;
  prismaAny.accessViolation.count = originals.violationCount;
  prismaAny.membership.update = originals.membershipUpdate;
  prismaAny.inboxItem.findUnique = originals.inboxFindUnique;
  prismaAny.inboxItem.create = originals.inboxCreate;
}

function buildDevice(overrides: Record<string, unknown> = {}) {
  return {
    id: "device-k40",
    name: "Attendance K40",
    type: DeviceType.FINGERPRINT,
    connectionType: DeviceConnectionType.NETWORK,
    enabled: true,
    config: { ip: "127.0.0.1", port: 4370 },
    ...overrides,
  } as any;
}

function buildStaffFixture(overrides: Partial<StaffFixture> = {}): StaffFixture {
  return {
    id: "employee-101",
    code: "101",
    firstName: "Active",
    lastName: "Employee",
    memberType: MemberType.STAFF,
    isStaff: true,
    status: MemberStatus.ACTIVE,
    archivedAt: null,
    ...overrides,
  };
}

function buildIngestionMember(overrides: Record<string, unknown> = {}) {
  return {
    ...buildStaffFixture(),
    isBlacklisted: false,
    accessPolicy: null,
    memberships: [],
    shifts: [],
    ...overrides,
  };
}

function buildEvent(overrides: Partial<DeviceEvent> = {}): DeviceEvent {
  return {
    deviceId: "device-k40",
    externalUserId: "101",
    timestamp: new Date("2026-08-11T08:00:00.000Z"),
    eventType: "CHECK_IN",
    recordId: 101,
    ...overrides,
  };
}

function mockIngestion(options: {
  member?: any | null;
  existingAttendance?: any | null;
  previousAttendance?: any | null;
}): Calls {
  const calls: Calls = {
    attendanceFinds: [],
    attendanceCreates: [],
    attendanceUpdates: [],
    attendanceCounts: [],
    rawCreates: [],
    rawUpdates: [],
    rawConditionalUpdates: [],
    violationCreates: [],
    violationCounts: [],
    membershipUpdates: [],
    inboxCreates: [],
    deviceUpdates: [],
    doorCalls: [],
  };

  prismaAny.$transaction = async (operation: (tx: any) => Promise<unknown>) => operation(prismaAny);

  prismaAny.deviceRawLog.createMany = async ({ data }: { data: any }) => {
    calls.rawCreates.push(data);
    return { count: 1 };
  };
  prismaAny.deviceRawLog.findUnique = async () => {
    const data = calls.rawCreates.at(-1);
    return data ? { id: `raw-${calls.rawCreates.length}`, status: data.status, processedAt: null } : null;
  };
  prismaAny.deviceRawLog.update = async ({ where, data }: { where: any; data: any }) => {
    calls.rawUpdates.push({ where, data });
    return { id: where.id, ...data };
  };
  prismaAny.deviceRawLog.updateMany = async ({ where, data }: { where: any; data: any }) => {
    calls.rawConditionalUpdates.push({ where, data });
    return { count: 1 };
  };
  prismaAny.attendanceLog.findUnique = async (args: any) => {
    calls.attendanceFinds.push(args);
    return options.existingAttendance ?? null;
  };
  prismaAny.attendanceLog.findFirst = async (args: any) => {
    calls.attendanceFinds.push(args);
    return options.previousAttendance ?? null;
  };
  prismaAny.attendanceLog.create = async ({ data }: { data: any }) => {
    calls.attendanceCreates.push(data);
    return { id: `attendance-${calls.attendanceCreates.length}`, createdAt: new Date(), ...data };
  };
  prismaAny.attendanceLog.update = async (args: any) => {
    calls.attendanceUpdates.push(args);
    return args.data;
  };
  prismaAny.attendanceLog.count = async (args: any) => {
    calls.attendanceCounts.push(args);
    return 0;
  };
  prismaAny.device.findUnique = async () => ({ id: "device-k40", name: "Attendance K40" });
  prismaAny.device.update = async (args: any) => {
    calls.deviceUpdates.push(args);
    return args.data;
  };
  prismaAny.deviceUser.findUnique = async () => {
    if (options.member === null || options.member === undefined) return null;
    return {
      id: "device-user-101",
      externalId: 101,
      memberId: options.member.id,
      deviceId: "device-k40",
      lastSyncedAt: new Date("2026-08-11T07:00:00.000Z"),
      member: options.member,
    };
  };
  prismaAny.member.findFirst = async () => options.member ?? null;
  prismaAny.accessViolation.create = async ({ data }: { data: any }) => {
    calls.violationCreates.push(data);
    return { id: "violation", ...data };
  };
  prismaAny.accessViolation.count = async (args: any) => {
    calls.violationCounts.push(args);
    return 0;
  };
  prismaAny.membership.update = async (args: any) => {
    calls.membershipUpdates.push(args);
    return args.data;
  };
  prismaAny.inboxItem.findUnique = async () => null;
  prismaAny.inboxItem.create = async ({ data }: { data: any }) => {
    calls.inboxCreates.push(data);
    return { id: "inbox", ...data };
  };
  return calls;
}

function assertOnlyRawEvidence(calls: Calls, reason: string | RegExp) {
  assert.equal(calls.rawCreates.length, 1, "the source event must be retained before classification");
  assert.equal(calls.rawCreates[0].status, DeviceRawLogStatus.PENDING);
  const statusUpdates = [...calls.rawUpdates, ...calls.rawConditionalUpdates];
  assert.ok(statusUpdates.length > 0, "the retained event must receive a final status");
  const finalUpdate = statusUpdates[statusUpdates.length - 1];
  assert.equal(finalUpdate.data.status, DeviceRawLogStatus.SKIPPED_INVALID);
  if (typeof reason === "string") assert.equal(finalUpdate.data.processError, reason);
  else assert.match(String(finalUpdate.data.processError), reason);
  assert.ok(finalUpdate.data.processedAt instanceof Date);
  assert.equal(calls.attendanceFinds.length, 0, "classification must finish before any Attendance read");
  assert.equal(calls.attendanceCreates.length, 0);
  assert.equal(calls.attendanceUpdates.length, 0);
  assert.equal(calls.attendanceCounts.length, 0);
  assert.equal(calls.violationCreates.length, 0);
  assert.equal(calls.violationCounts.length, 0);
  assert.equal(calls.membershipUpdates.length, 0);
  assert.equal(calls.inboxCreates.length, 0);
  assert.equal(calls.doorCalls.length, 0);
}

async function testEditionScopeAndStartupPolicy() {
  assert.equal(getDeviceDataScope("FULL"), DEVICE_DATA_SCOPES.FULL_LEGACY);
  assert.equal(getDeviceDataScope("ATTENDANCE"), DEVICE_DATA_SCOPES.STRICT_STAFF);
  assert.deepEqual(resolveAttendancePunchDecision("TIME_CLOCK"), {
    attendanceRecorded: true,
    doorAllowed: false,
    doorOpened: false,
  });
  assert.deepEqual(buildStrictStaffDeviceMemberWhere(), {
    memberType: MemberType.STAFF,
    isStaff: true,
    archivedAt: null,
  });
  assert.equal(normalizeDeviceExternalId("101"), 101);
  assert.equal(normalizeDeviceExternalId(0), null);
  assert.equal(normalizeDeviceExternalId("not-a-number"), null);
  assert.equal(normalizeDeviceExternalId("1e3"), null);
  assert.equal(normalizeDeviceExternalId("2147483648"), null);

  const allowedConnectionTypes = [
    DeviceConnectionType.NETWORK,
    DeviceConnectionType.ZKTECO_PULL_SDK,
  ];
  for (const connectionType of allowedConnectionTypes) {
    const device = buildDevice({ connectionType });
    assert.equal(isAttendanceK40PullDevice(device), true);
    assert.deepEqual(resolveDeviceRuntimePolicy(DEVICE_DATA_SCOPES.STRICT_STAFF, device), {
      shouldStart: true,
      forcePull: true,
      allowPush: false,
      allowAutomaticDoor: false,
    });
  }

  assert.equal(
    isAttendanceK40PullDeviceInput(buildDevice({ config: { eventMode: "PULL", pushEnabled: false } })),
    true
  );
  assert.equal(
    isAttendanceK40PullDeviceInput(buildDevice({ config: { eventMode: "PUSH", pushEnabled: true } })),
    false
  );
  assert.equal(
    isAttendanceK40PullDeviceInput(buildDevice({ config: { eventMode: "AUTO", pushEnabled: true } })),
    false
  );

  for (const device of [
    buildDevice({ type: DeviceType.CAMERA }),
    buildDevice({ connectionType: DeviceConnectionType.USB }),
    buildDevice({ enabled: false }),
  ]) {
    assert.equal(resolveDeviceRuntimePolicy(DEVICE_DATA_SCOPES.STRICT_STAFF, device).shouldStart, false);
  }

  assert.deepEqual(
    resolveDeviceRuntimePolicy(
      DEVICE_DATA_SCOPES.FULL_LEGACY,
      buildDevice({ type: DeviceType.CAMERA, connectionType: DeviceConnectionType.USB })
    ),
    { shouldStart: true, forcePull: false, allowPush: true, allowAutomaticDoor: true }
  );
}

async function testTransactionalPilotInvariantAndCanonicalIds() {
  const operationOrder: string[] = [];
  const tx = {
    $executeRaw: async () => {
      operationOrder.push("lock");
      return 1;
    },
    device: {
      findFirst: async (args: any) => {
        operationOrder.push("count-after-lock");
        assert.equal(args.where.enabled, true);
        assert.deepEqual(args.where.id, { not: "candidate-k40" });
        return null;
      },
    },
  } as any;
  await deviceServiceTestHooks.assertStrictPilotSlotAvailableInTransaction(tx, "candidate-k40");
  assert.deepEqual(operationOrder, ["lock", "count-after-lock"]);

  tx.device.findFirst = async () => ({ id: "already-enabled-k40" });
  await assert.rejects(
    () => deviceServiceTestHooks.assertStrictPilotSlotAvailableInTransaction(tx, "candidate-k40"),
    (error: unknown) => error instanceof HttpError && error.status === 409
  );

  const strictTarget = {
    ...buildStaffFixture(),
    externalId: 1,
  };
  assert.equal(
    deviceManagerTestHooks.resolvePhysicalDeviceUserId("001", strictTarget),
    "1",
    "strict enrollment must send the canonical external ID to the physical K40"
  );
  assert.equal(deviceManagerTestHooks.resolvePhysicalDeviceUserId("001", null), "001");
  assert.equal(
    deviceManagerTestHooks.normalizeLegacyDeviceExternalId("1e3"),
    1000,
    "FULL must retain its legacy numeric coercion"
  );
  assert.equal(deviceManagerTestHooks.normalizeCanonicalPhysicalDeviceExternalId("101"), 101);
  assert.equal(
    deviceManagerTestHooks.normalizeCanonicalPhysicalDeviceExternalId("001"),
    null,
    "strict sync/list must not alias a non-canonical physical slot to Employee 1"
  );
}

async function testPullCursorOnlyAdvancesAfterCommittedPrefix() {
  const client = new ZktecoK40Client({ id: "cursor-k40", host: "127.0.0.1", port: 4370 });
  (client as any).zk = {
    async getAttendances() {
      return {
        data: [
          {
            id: 501,
            userId: "101",
            recordTime: "2026-08-11T08:00:00.000Z",
            type: "in",
          },
        ],
      };
    },
  };
  assert.equal((await client.fetchNewEvents()).length, 1);
  assert.equal(
    (await client.fetchNewEvents()).length,
    1,
    "fetching must not advance the in-memory cursor before ingestion commits"
  );
  client.setCursor({ lastRecordId: 501, lastTimestamp: new Date("2026-08-11T08:00:00.000Z") });
  assert.equal((await client.fetchNewEvents()).length, 0);

  const timestampClient = new ZktecoK40Client({ id: "timestamp-k40", host: "127.0.0.1", port: 4370 });
  const timestampRows: any[] = [
    {
      deviceUserId: "101",
      recordTime: "2026-08-11T08:01:00.000Z",
      type: "in",
    },
  ];
  (timestampClient as any).zk = {
    async getAttendances() {
      return { data: timestampRows };
    },
  };
  const firstTimestampBatch = await timestampClient.fetchNewEvents();
  assert.equal(firstTimestampBatch.length, 1);
  timestampClient.setCursor({ lastTimestamp: firstTimestampBatch[0]!.timestamp });
  assert.equal((await timestampClient.fetchNewEvents()).length, 0);
  timestampRows.push({
    deviceUserId: "102",
    recordTime: "2026-08-11T08:01:00.000Z",
    type: "in",
  });
  const lateSameSecond = await timestampClient.fetchNewEvents();
  assert.deepEqual(
    lateSameSecond.map((event) => event.externalUserId),
    ["102"],
    "a late K40 row at the persisted second must not be lost"
  );
  timestampClient.setCursor({ lastTimestamp: lateSameSecond[0]!.timestamp });
  assert.equal((await timestampClient.fetchNewEvents()).length, 0, "committed boundary rows must not poll forever");

  const calls = mockIngestion({ member: buildIngestionMember() });
  let rawAttempts = 0;
  prismaAny.deviceRawLog.createMany = async ({ data }: { data: any }) => {
    rawAttempts += 1;
    if (rawAttempts === 1) throw new Error("transient raw-log failure");
    calls.rawCreates.push(data);
    return { count: 1 };
  };
  const stopped = await processDeviceEvents(
    [buildEvent({ recordId: 601 }), buildEvent({ recordId: 602 })],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.equal(rawAttempts, 1, "processing must stop at the first non-terminal event");
  assert.equal(stopped.maxRecordId, undefined);
  assert.equal(stopped.maxTimestamp, undefined);

  const retried = await processDeviceEvents(
    [buildEvent({ recordId: 601 }), buildEvent({ recordId: 602 })],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.equal(retried.maxRecordId, 602);

  const unorderedCalls = mockIngestion({ member: buildIngestionMember() });
  let unorderedAttempts = 0;
  prismaAny.deviceRawLog.createMany = async ({ data }: { data: any }) => {
    unorderedAttempts += 1;
    if (unorderedAttempts === 2) throw new Error("transient second raw-log failure");
    unorderedCalls.rawCreates.push(data);
    return { count: 1 };
  };
  const sharedTimestamp = new Date("2026-08-11T08:05:00.000Z");
  const unordered = await processDeviceEvents(
    [
      buildEvent({ recordId: 602, timestamp: sharedTimestamp }),
      buildEvent({ recordId: 601, timestamp: sharedTimestamp }),
    ],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.equal(unordered.processedCount, 1);
  assert.equal(unordered.maxRecordId, undefined, "an unordered partial batch must not advance a record cursor");
  assert.equal(unordered.maxTimestamp, undefined, "a same-timestamp failure must not advance a timestamp cursor");

  prismaAny.deviceRawLog.createMany = async () => {
    throw new Error("polling failure");
  };
  await assert.rejects(
    () =>
      processDeviceEvents([buildEvent({ recordId: 701 })], {
        scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
        stopOnError: true,
      }),
    /polling failure/u,
    "the polling manager must receive processing failures for error/backoff state"
  );
}

async function testStartupQueryIsEditionScoped() {
  const queries: any[] = [];
  prismaAny.device.findMany = async (args: any) => {
    queries.push(args);
    return [];
  };

  await startAllActiveDevices(DEVICE_DATA_SCOPES.STRICT_STAFF);
  await startAllActiveDevices(DEVICE_DATA_SCOPES.FULL_LEGACY);

  assert.deepEqual(queries[0].where, {
    enabled: true,
    type: DeviceType.FINGERPRINT,
    connectionType: {
      in: [DeviceConnectionType.NETWORK, DeviceConnectionType.ZKTECO_PULL_SDK],
    },
  });
  assert.deepEqual(queries[1].where, { enabled: true });

  prismaAny.device.findMany = async () => [
    buildDevice({ id: "attendance-k40-a" }),
    buildDevice({ id: "attendance-k40-b" }),
  ];
  await assert.rejects(
    () => startAllActiveDevices(DEVICE_DATA_SCOPES.STRICT_STAFF),
    (error: unknown) => error instanceof HttpError && error.status === 409
  );
}

async function testStrictUserCommandTargetMatrix() {
  let fixture: StaffFixture | null = null;
  const queries: any[] = [];
  let deviceReads = 0;
  prismaAny.member.findFirst = async (args: any) => {
    queries.push(args);
    if (
      !fixture ||
      fixture.memberType !== MemberType.STAFF ||
      fixture.isStaff !== true ||
      fixture.status !== MemberStatus.ACTIVE ||
      fixture.archivedAt !== null
    ) {
      return null;
    }
    return {
      id: fixture.id,
      code: fixture.code,
      firstName: fixture.firstName,
      lastName: fixture.lastName,
    };
  };
  prismaAny.device.findUnique = async () => {
    deviceReads += 1;
    return buildDevice();
  };

  fixture = buildStaffFixture();
  const resolved = await deviceManagerTestHooks.resolveStrictStaffDeviceTarget("101");
  assert.deepEqual(resolved, {
    id: fixture.id,
    code: fixture.code,
    firstName: fixture.firstName,
    lastName: fixture.lastName,
    externalId: 101,
  });
  assert.deepEqual(queries[0].where, {
    memberType: MemberType.STAFF,
    isStaff: true,
    archivedAt: null,
    status: MemberStatus.ACTIVE,
    OR: [{ code: "101" }, { deviceUser: { externalId: 101 } }],
  });

  const rejected = [
    buildStaffFixture({ memberType: MemberType.CUSTOMER, isStaff: false }),
    buildStaffFixture({ memberType: MemberType.STAFF, isStaff: false }),
    buildStaffFixture({ memberType: MemberType.CUSTOMER, isStaff: true }),
    buildStaffFixture({ status: MemberStatus.BLOCKED }),
    null,
  ];
  for (const item of rejected) {
    fixture = item;
    const readsBefore = deviceReads;
    await assert.rejects(
      () =>
        upsertDeviceUser(
          "device-k40",
          { userId: "101", name: "client supplied identity" },
          DEVICE_DATA_SCOPES.STRICT_STAFF
        ),
      (error: unknown) => error instanceof HttpError && error.status === 404 && error.message === "Employee not found"
    );
    assert.equal(deviceReads, readsBefore, "rejected user targets must fail before a device or physical client is touched");
  }

  await assert.rejects(
    () => deviceManagerTestHooks.resolveStrictStaffDeviceTarget("invalid"),
    (error: unknown) => error instanceof HttpError && error.status === 404
  );
}

async function testStrictMappingReservationAndDevicePreflight() {
  const activeEmployee = buildStaffFixture();
  prismaAny.member.findFirst = async () => ({
    id: activeEmployee.id,
    code: activeEmployee.code,
    firstName: activeEmployee.firstName,
    lastName: activeEmployee.lastName,
  });

  let mappingTransactions = 0;
  prismaAny.$transaction = async (operation: (tx: any) => Promise<unknown>) => {
    mappingTransactions += 1;
    return operation(prismaAny);
  };
  prismaAny.device.findUnique = async () => null;
  await assert.rejects(
    () =>
      upsertDeviceUser(
        "missing-device",
        { userId: "101", name: "ignored" },
        DEVICE_DATA_SCOPES.STRICT_STAFF
      ),
    (error: unknown) => error instanceof HttpError && error.status === 404
  );
  assert.equal(mappingTransactions, 0, "a missing Device must fail before DeviceUser reservation");

  prismaAny.device.findUnique = async () => buildDevice({ type: DeviceType.CAMERA });
  await assert.rejects(
    () =>
      upsertDeviceUser(
        "unsupported-device",
        { userId: "101", name: "ignored" },
        DEVICE_DATA_SCOPES.STRICT_STAFF
      ),
    (error: unknown) => error instanceof HttpError && error.status === 404
  );
  assert.equal(mappingTransactions, 0, "a hidden FULL-only Device must fail before DeviceUser reservation");

  const unlinked = {
    id: "device-user-unlinked",
    externalId: 101,
    memberId: null,
    deviceId: null,
    lastSyncedAt: new Date("2026-08-10T08:00:00.000Z"),
  };
  const claims: any[] = [];
  prismaAny.$transaction = async (operation: (tx: any) => Promise<unknown>) => operation(prismaAny);
  prismaAny.deviceUser.findUnique = async ({ where }: any) =>
    where.externalId === 101 ? unlinked : null;
  prismaAny.deviceUser.updateMany = async (input: any) => {
    claims.push(input);
    return { count: 1 };
  };
  await deviceManagerTestHooks.ensureStrictStaffDeviceUserLink("device-k40", {
    id: activeEmployee.id,
    code: activeEmployee.code,
    firstName: activeEmployee.firstName,
    lastName: activeEmployee.lastName,
    externalId: 101,
  });
  assert.deepEqual(claims, [
    {
      where: {
        id: unlinked.id,
        externalId: 101,
        memberId: null,
        deviceId: null,
      },
      data: { memberId: activeEmployee.id, deviceId: "device-k40", lastSyncedAt: null },
    },
  ]);

  let clearedBinding: any = null;
  prismaAny.deviceUser.updateMany = async (input: any) => {
    clearedBinding = input;
    return { count: 1 };
  };
  await deviceManagerTestHooks.clearStrictStaffDeviceUserBinding("device-k40", {
    id: activeEmployee.id,
    code: activeEmployee.code,
    firstName: activeEmployee.firstName,
    lastName: activeEmployee.lastName,
    externalId: 101,
  });
  assert.deepEqual(clearedBinding.data, { deviceId: null, lastSyncedAt: null });
  assert.deepEqual(clearedBinding.where.lastSyncedAt, { not: null });
  assert.equal(clearedBinding.where.member.is.memberType, MemberType.STAFF);
  assert.equal(clearedBinding.where.member.is.isStaff, true);

  prismaAny.deviceUser.updateMany = async () => ({ count: 0 });
  await assert.rejects(
    () =>
      deviceManagerTestHooks.ensureStrictStaffDeviceUserLink("device-k40", {
        id: activeEmployee.id,
        code: activeEmployee.code,
        firstName: activeEmployee.firstName,
        lastName: activeEmployee.lastName,
        externalId: 101,
      }),
    (error: unknown) => error instanceof HttpError && error.status === 409
  );
}

async function testProductionUserCommandsRemainStrictStaffOnly() {
  const device = buildDevice();
  const employee = buildStaffFixture();
  const confirmedMapping = {
    id: "device-user-101",
    externalId: 101,
    memberId: employee.id,
    deviceId: device.id,
    lastSyncedAt: new Date("2026-08-11T07:00:00.000Z"),
  };
  const targetLookups: number[] = [];
  const mappingWrites: any[] = [];

  prismaAny.$transaction = async (operation: (tx: any) => Promise<unknown>) => operation(prismaAny);
  prismaAny.device.findUnique = async () => device;
  prismaAny.device.findFirst = async () => null;
  prismaAny.member.findFirst = async ({ where }: any) => {
    if (where.id === employee.id) return { id: employee.id };
    const externalId = where.OR?.[1]?.deviceUser?.externalId ?? Number(where.OR?.[0]?.code);
    targetLookups.push(externalId);
    return externalId === 101
      ? {
          id: employee.id,
          code: employee.code,
          firstName: employee.firstName,
          lastName: employee.lastName,
        }
      : null;
  };
  prismaAny.deviceUser.findUnique = async ({ where }: any) => {
    if (where.externalId === 101 || where.memberId === employee.id) return confirmedMapping;
    return null;
  };
  prismaAny.deviceUser.findFirst = async ({ where }: any) =>
    where.externalId === 101 && where.memberId === employee.id && where.deviceId === device.id
      ? { id: confirmedMapping.id }
      : null;
  prismaAny.deviceUser.findMany = async ({ where }: any) => {
    assert.deepEqual(where.externalId.in, [101, 202, 303]);
    assert.equal(where.deviceId, device.id);
    assert.deepEqual(where.lastSyncedAt, { not: null });
    assert.equal(where.member.is.memberType, MemberType.STAFF);
    assert.equal(where.member.is.isStaff, true);
    return [
      {
        externalId: 101,
        member: { firstName: employee.firstName, lastName: employee.lastName },
      },
    ];
  };
  prismaAny.deviceUser.updateMany = async (input: any) => {
    mappingWrites.push(input);
    return { count: 1 };
  };

  const physicalCalls = {
    upsert: [] as any[],
    enroll: [] as any[],
    delete: [] as any[],
  };
  const client = new ZktecoK40Client({ id: device.id, host: "127.0.0.1", port: 4370 });
  (client as any).upsertUser = async (input: any) => physicalCalls.upsert.push(input);
  (client as any).enrollFingerprint = async (input: any) => physicalCalls.enroll.push(input);
  (client as any).deleteUser = async (input: any) => physicalCalls.delete.push(input);
  (client as any).listUsers = async () => [
    { uid: 1, userId: "101", name: "untrusted staff name", raw: {} },
    { uid: 2, userId: "001", name: "alias", raw: {} },
    { uid: 3, userId: "202", name: "customer", raw: {} },
    { uid: 4, userId: "303", name: "unknown", raw: {} },
  ];
  const removeManagedClient = deviceManagerTestHooks.installManagedK40Client(
    device.id,
    client,
    DEVICE_DATA_SCOPES.STRICT_STAFF
  );

  try {
    const enrolled = await enrollDevice(
      device.id,
      { userId: "101", fingerId: 2, name: "client supplied name" },
      DEVICE_DATA_SCOPES.STRICT_STAFF
    );
    assert.equal(enrolled.employeeId, employee.id);
    assert.deepEqual(physicalCalls.upsert, [{ userId: "101", name: "Active Employee" }]);
    assert.deepEqual(physicalCalls.enroll, [{ userId: "101", fingerId: 2 }]);

    const listed = await listDeviceUsers(device.id, DEVICE_DATA_SCOPES.STRICT_STAFF);
    assert.deepEqual(listed.items, [
      { uid: 1, userId: "101", name: "Active Employee" },
    ]);

    const synced = await syncDeviceUsers(device.id, DEVICE_DATA_SCOPES.STRICT_STAFF);
    assert.deepEqual(
      { total: synced.total, synced: synced.synced, skipped: synced.skipped },
      { total: 4, synced: 1, skipped: 3 }
    );
    assert.equal(targetLookups.includes(1), false, "physical alias 001 must not resolve Employee 1");
    assert.equal(targetLookups.includes(202), true);
    assert.equal(targetLookups.includes(303), true);

    const writesBeforeRejectedDelete = mappingWrites.length;
    await assert.rejects(
      () =>
        deleteDeviceUser(
          device.id,
          { userId: "202" },
          DEVICE_DATA_SCOPES.STRICT_STAFF
        ),
      (error: unknown) => error instanceof HttpError && error.status === 404 && error.message === "Employee not found"
    );
    assert.equal(mappingWrites.length, writesBeforeRejectedDelete);
    assert.equal(physicalCalls.delete.length, 0);

    const deleted = await deleteDeviceUser(
      device.id,
      { userId: "101" },
      DEVICE_DATA_SCOPES.STRICT_STAFF
    );
    assert.equal(deleted.employeeId, employee.id);
    assert.deepEqual(physicalCalls.delete, [{ userId: "101" }]);
    assert.ok(
      mappingWrites.some(
        (write) => write.data.deviceId === null && write.data.lastSyncedAt === null
      ),
      "strict delete must invalidate the confirmed mapping before physical I/O"
    );
  } finally {
    removeManagedClient();
  }
}

async function testStrictIngestionMatrix() {
  const attendanceInboxEvents: import("./attendance-inbox-events").AttendanceInboxEvent[] = [];
  const { subscribeAttendanceInboxEvents } = require("./attendance-inbox-events") as typeof import("./attendance-inbox-events");
  const stopAttendanceInboxEvents = subscribeAttendanceInboxEvents((event) => {
    attendanceInboxEvents.push(event);
  });
  const physicalSideEffectModules = [
    "./device.events",
    "../inbox/inbox.device",
    "../door/door.service",
  ];
  for (const request of physicalSideEffectModules) {
    assert.equal(require.cache[require.resolve(request)], undefined, `${request} loaded before strict ingestion`);
  }

  const nonStaffCases = [
    buildIngestionMember({ memberType: MemberType.CUSTOMER, isStaff: false }),
    buildIngestionMember({ memberType: MemberType.STAFF, isStaff: false }),
    buildIngestionMember({ memberType: MemberType.CUSTOMER, isStaff: true }),
  ];
  for (const member of nonStaffCases) {
    const calls = mockIngestion({ member, existingAttendance: { id: "legacy-customer-log" } });
    const result = await processDeviceEvents([buildEvent()], {
      scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
      unlockClient: { unlockDoor: async (seconds: number) => calls.doorCalls.push(seconds) } as any,
    } as any);
    assert.equal(result.processedCount, 0);
    assertOnlyRawEvidence(calls, "NON_STAFF_MEMBER");
  }
  assert.equal(attendanceInboxEvents.length, 0, "Customer/non-Staff outcomes must never reach Attendance Inbox");

  const unknownCalls = mockIngestion({ member: null });
  const unknown = await processDeviceEvents([buildEvent({ externalUserId: "404" })], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
    unlockClient: { unlockDoor: async (seconds: number) => unknownCalls.doorCalls.push(seconds) } as any,
  } as any);
  assert.equal(unknown.processedCount, 0);
  assertOnlyRawEvidence(unknownCalls, "DEVICE_USER_NOT_FOUND");
  assert.deepEqual(attendanceInboxEvents[0], {
    kind: "UNKNOWN_DEVICE_USER",
    occurredAt: buildEvent().timestamp,
    device: { id: "device-k40" },
  });

  const inactiveCalls = mockIngestion({
    member: buildIngestionMember({ status: MemberStatus.BLOCKED }),
  });
  const inactive = await processDeviceEvents([buildEvent()], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
    unlockClient: { unlockDoor: async (seconds: number) => inactiveCalls.doorCalls.push(seconds) } as any,
  } as any);
  assert.equal(inactive.processedCount, 0);
  assertOnlyRawEvidence(inactiveCalls, /INACTIVE/u);
  assert.deepEqual(attendanceInboxEvents[1], {
    kind: "INACTIVE_EMPLOYEE_ATTEMPT",
    occurredAt: buildEvent().timestamp,
    employee: { id: "employee-101", code: "101", name: "Active Employee" },
    device: { id: "device-k40" },
  });

  for (const request of physicalSideEffectModules) {
    assert.equal(require.cache[require.resolve(request)], undefined, `${request} loaded for a rejected event`);
  }

  const activeCalls = mockIngestion({ member: buildIngestionMember() });
  const active = await processDeviceEvents([buildEvent({ raw: { secret: "must-not-reach-sse" } })], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
    unlockClient: { unlockDoor: async (seconds: number) => activeCalls.doorCalls.push(seconds) } as any,
  } as any);
  assert.equal(active.processedCount, 1, "an active strict-both employee punch must be retained as Attendance");
  assert.equal(activeCalls.attendanceCreates.length, 1);
  assert.equal(activeCalls.attendanceCreates[0]?.isAuthorized, true);
  assert.equal(activeCalls.attendanceCreates[0]?.reason, null);
  assert.equal(activeCalls.violationCreates.length, 0);
  assert.equal(activeCalls.rawUpdates.at(-1)?.data.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(activeCalls.inboxCreates.length, 0);
  assert.equal(activeCalls.doorCalls.length, 0);
  assert.equal(require.cache[require.resolve("../inbox/inbox.device")], undefined);
  assert.equal(require.cache[require.resolve("../door/door.service")], undefined);
  assert.deepEqual(attendanceInboxEvents[2], {
    kind: "ACCEPTED_STAFF_PUNCH",
    occurredAt: buildEvent().timestamp,
    entryType: "IN",
    employee: { id: "employee-101", code: "101", name: "Active Employee" },
    device: { id: "device-k40" },
  });
  assert.doesNotMatch(
    JSON.stringify(attendanceInboxEvents.slice(0, 3)),
    /externalUser|raw|biometric|customer|membership|door/iu,
    "Attendance Inbox projection must not expose raw/Customer/biometric/Door data"
  );

  const eventModule = require("./device.events") as typeof import("./device.events");
  assert.deepEqual(eventModule.getRecentEvents(), [], "strict processing must not populate the legacy event feed");
  const strictEvents = eventModule.getRecentStrictStaffEvents();
  assert.equal(strictEvents.length, 1);
  assert.equal(strictEvents[0]?.memberCode, "101");
  assert.equal(strictEvents[0]?.memberName, "Active Employee");
  assert.equal(strictEvents[0]?.authorized, true, "legacy alias must mean accepted TIME_CLOCK attendance");
  assert.equal(strictEvents[0]?.attendanceRecorded, true);
  assert.equal(strictEvents[0]?.doorAllowed, false);
  assert.equal(strictEvents[0]?.doorOpened, false);
  assert.equal(Object.hasOwn(strictEvents[0] ?? {}, "raw"), false, "strict event snapshots must omit raw payloads");

  const scheduledShift = {
    shiftStart: "08:00",
    shiftEnd: "16:00",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    earlyAccessMinutes: 15,
    isActive: true,
  };
  const timeClockCases = [
    {
      label: "early arrival inside the configured early window",
      member: buildIngestionMember({ shifts: [scheduledShift] }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 7, 50), recordId: 159 }),
    },
    {
      label: "late arrival",
      member: buildIngestionMember({ shifts: [scheduledShift] }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 9, 30), recordId: 160 }),
    },
    {
      label: "before the early-access window",
      member: buildIngestionMember({ shifts: [scheduledShift] }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 7, 44), recordId: 161 }),
    },
    {
      label: "far outside the scheduled shift",
      member: buildIngestionMember({ shifts: [scheduledShift] }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 22, 0), recordId: 162 }),
    },
    {
      label: "without any shift",
      member: buildIngestionMember({ shifts: [] }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 11, 0), recordId: 163 }),
    },
    {
      label: "despite a restrictive access policy",
      member: buildIngestionMember({
        shifts: [scheduledShift],
        accessPolicy: {
          allowedDays: [0],
          maxEntriesPerDay: null,
          rules: [{ weekday: 0, fromTime: "08:00", toTime: "08:01" }],
        },
      }),
      event: buildEvent({ timestamp: new Date(2026, 7, 16, 12, 0), recordId: 164 }),
    },
  ];

  for (const scenario of timeClockCases) {
    const calls = mockIngestion({ member: scenario.member });
    const summary = await processDeviceEvents([scenario.event], {
      scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
      unlockClient: { unlockDoor: async (seconds: number) => calls.doorCalls.push(seconds) } as any,
    } as any);
    assert.equal(summary.processedCount, 1, `${scenario.label}: punch must be processed`);
    assert.equal(calls.attendanceCreates.length, 1, `${scenario.label}: attendance must be recorded once`);
    assert.equal(calls.attendanceCreates[0]?.isAuthorized, true, `${scenario.label}: timecard row must be accepted`);
    assert.equal(calls.attendanceCreates[0]?.reason, null);
    assert.equal(calls.violationCreates.length, 0, `${scenario.label}: shift must not create an access violation`);
    assert.equal(calls.doorCalls.length, 0, `${scenario.label}: TIME_CLOCK must not actuate a door`);
    assert.equal(calls.inboxCreates.length, 0);
    const emitted = eventModule.getRecentStrictStaffEvents(1)[0];
    assert.equal(emitted?.attendanceRecorded, true);
    assert.equal(emitted?.authorized, true);
    assert.equal(emitted?.doorAllowed, false);
    assert.equal(emitted?.doorOpened, false);
    assert.equal(emitted?.reason, null);
  }

  const overnightCalls = mockIngestion({
    member: buildIngestionMember({
      shifts: [
        {
          shiftStart: "22:00",
          shiftEnd: "06:00",
          weekdays: [0],
          earlyAccessMinutes: 0,
          isActive: true,
        },
      ],
    }),
    previousAttendance: {
      entryType: "IN",
      recordedAt: new Date(2026, 7, 15, 22, 0),
    },
  });
  await processDeviceEvents(
    [
      buildEvent({
        timestamp: new Date(2026, 7, 16, 2, 0),
        eventType: "UNKNOWN",
        recordId: 165,
      }),
    ],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.equal(overnightCalls.attendanceCreates[0]?.entryType, "OUT");
  assert.equal(overnightCalls.attendanceCreates[0]?.isAuthorized, true);
  assert.equal(overnightCalls.violationCreates.length, 0);

  const inferenceCalls = mockIngestion({ member: buildIngestionMember() });
  let previousInferredLog: { entryType: string; recordedAt: Date } | null = null;
  prismaAny.attendanceLog.findFirst = async ({ where }: any) => {
    if (!previousInferredLog) return null;
    return previousInferredLog.recordedAt < where.recordedAt.lt ? previousInferredLog : null;
  };
  prismaAny.attendanceLog.create = async ({ data }: { data: any }) => {
    inferenceCalls.attendanceCreates.push(data);
    previousInferredLog = { entryType: data.entryType, recordedAt: data.recordedAt };
    return { id: `attendance-${inferenceCalls.attendanceCreates.length}`, createdAt: new Date(), ...data };
  };
  await processDeviceEvents(
    [
      buildEvent({ timestamp: new Date(2026, 7, 16, 10, 0), eventType: "UNKNOWN", recordId: 302 }),
      buildEvent({ timestamp: new Date(2026, 7, 16, 9, 0), eventType: "UNKNOWN", recordId: 301 }),
    ],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.deepEqual(
    inferenceCalls.attendanceCreates.map((entry) => ({ entryType: entry.entryType, recordedAt: entry.recordedAt })),
    [
      { entryType: "IN", recordedAt: new Date(2026, 7, 16, 9, 0) },
      { entryType: "OUT", recordedAt: new Date(2026, 7, 16, 10, 0) },
    ],
    "unordered Pull rows must be processed chronologically before TIME_CLOCK IN/OUT inference"
  );

  let closeSafeSubscription: (() => void) | undefined;
  const sseWrites: string[] = [];
  eventModule.subscribeStrictStaffSse({
    write(chunk: string) {
      sseWrites.push(chunk);
    },
    on(event: string, listener: () => void) {
      if (event === "close") closeSafeSubscription = listener;
      return this;
    },
  } as any);
  eventModule.pushStrictStaffProcessedEvent({
    ...buildEvent({ recordId: 150, raw: { secret: "raw-sse-secret" } }),
    authorized: true,
    attendanceRecorded: true,
    doorAllowed: false,
    doorOpened: false,
    reason: null,
    memberName: "Active Employee",
    memberCode: "101",
    accidentalSecret: "must-not-reach-sse",
  } as any);
  assert.equal(sseWrites.length, 1);
  assert.equal(sseWrites[0]?.includes("raw-sse-secret"), false);
  assert.equal(sseWrites[0]?.includes('"raw"'), false);
  assert.equal(sseWrites[0]?.includes("must-not-reach-sse"), false);
  assert.equal(sseWrites[0]?.includes('"attendanceRecorded":true'), true);
  assert.equal(sseWrites[0]?.includes('"doorAllowed":false'), true);
  closeSafeSubscription?.();

  let closeThrowingSubscription: (() => void) | undefined;
  eventModule.subscribeStrictStaffSse({
    write() {
      throw new Error("simulated disconnected SSE writer");
    },
    on(event: string, listener: () => void) {
      if (event === "close") closeThrowingSubscription = listener;
      return this;
    },
  } as any);
  const publishFailureCalls = mockIngestion({ member: buildIngestionMember() });
  const publishFailureResult = await processDeviceEvents([buildEvent({ recordId: 151 })], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
  });
  assert.equal(publishFailureResult.processedCount, 1, "SSE failure must not roll back committed Attendance");
  assert.equal(publishFailureCalls.rawUpdates.at(-1)?.data.status, DeviceRawLogStatus.PROCESSED);
  assert.equal(
    publishFailureCalls.rawConditionalUpdates.some((entry) => entry.data.status === DeviceRawLogStatus.FAILED),
    false,
    "post-commit publisher failures must not downgrade RawLog evidence"
  );
  closeThrowingSubscription?.();
  stopAttendanceInboxEvents();
}

async function testStrictReplayAndInputHardening() {
  for (const status of [
    DeviceRawLogStatus.PROCESSED,
    DeviceRawLogStatus.SKIPPED_INVALID,
    DeviceRawLogStatus.SKIPPED_DUPLICATE,
  ]) {
    const replayCalls = mockIngestion({ member: buildIngestionMember() });
    prismaAny.deviceRawLog.createMany = async () => ({ count: 0 });
    prismaAny.deviceRawLog.findUnique = async () => ({
      id: `raw-terminal-${status}`,
      status,
      processedAt: new Date("2026-08-11T08:00:01.000Z"),
    });
    prismaAny.deviceUser.findUnique = async () => {
      throw new Error("terminal strict RawLog must not be reclassified");
    };
    const replay = await processDeviceEvents([buildEvent({ recordId: 201 })], {
      scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
    });
    assert.equal(replay.processedCount, 0);
    assert.equal(replay.maxRecordId, 201);
    assert.equal(replayCalls.rawUpdates.length, 0, `a replay must not downgrade immutable ${status} evidence`);
    assert.equal(replayCalls.rawConditionalUpdates.length, 0);
    assert.equal(replayCalls.attendanceFinds.length, 0);
    assert.equal(replayCalls.attendanceCreates.length, 0);
  }

  const unconfirmedCalls = mockIngestion({ member: buildIngestionMember() });
  prismaAny.deviceUser.findUnique = async () => ({
    id: "device-user-unconfirmed",
    externalId: 101,
    memberId: "employee-101",
    deviceId: "device-k40",
    lastSyncedAt: null,
    member: buildIngestionMember(),
  });
  const unconfirmed = await processDeviceEvents([buildEvent({ recordId: 202 })], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
  });
  assert.equal(unconfirmed.processedCount, 0);
  assertOnlyRawEvidence(unconfirmedCalls, "DEVICE_USER_NOT_SYNCED");

  const poisonCalls = mockIngestion({ member: buildIngestionMember() });
  prismaAny.deviceUser.findUnique = async () => {
    throw new Error("invalid external IDs must terminate before a DeviceUser query");
  };
  const poison = await processDeviceEvents(
    [
      buildEvent({ externalUserId: "001", recordId: 300 }),
      buildEvent({ externalUserId: "1e3", recordId: 301 }),
      buildEvent({ externalUserId: "2147483648", recordId: 302 }),
    ],
    { scope: DEVICE_DATA_SCOPES.STRICT_STAFF }
  );
  assert.equal(poison.processedCount, 0);
  assert.equal(poison.maxRecordId, 302, "poison records must advance the Pull cursor");
  assert.equal(poisonCalls.rawCreates.length, 3);
  assert.deepEqual(
    poisonCalls.rawConditionalUpdates.map((entry) => entry.data.processError),
    ["NON_NUMERIC_EXTERNAL_USER_ID", "NON_NUMERIC_EXTERNAL_USER_ID", "NON_NUMERIC_EXTERNAL_USER_ID"]
  );

  const duplicateCalls = mockIngestion({ member: buildIngestionMember() });
  prismaAny.attendanceLog.create = async () => {
    throw { code: "P2002" };
  };
  const duplicate = await processDeviceEvents([buildEvent({ recordId: 401 })], {
    scope: DEVICE_DATA_SCOPES.STRICT_STAFF,
  });
  assert.equal(duplicate.processedCount, 0);
  assert.equal(duplicate.maxRecordId, 401);
  assert.equal(duplicateCalls.rawConditionalUpdates.length, 1);
  assert.equal(duplicateCalls.rawConditionalUpdates[0].data.status, DeviceRawLogStatus.SKIPPED_DUPLICATE);
  assert.equal(duplicateCalls.rawConditionalUpdates[0].data.processError, "ATTENDANCE_DEDUPE_CONFLICT");
}

async function run() {
  try {
    await testEditionScopeAndStartupPolicy();
    await testTransactionalPilotInvariantAndCanonicalIds();
    await testStartupQueryIsEditionScoped();
    await testStrictUserCommandTargetMatrix();
    await testStrictMappingReservationAndDevicePreflight();
    await testProductionUserCommandsRemainStrictStaffOnly();
    await testStrictIngestionMatrix();
    await testPullCursorOnlyAdvancesAfterCommittedPrefix();
    await testStrictReplayAndInputHardening();
    console.log("ok - Device service enforces strict Staff TIME_CLOCK ingestion, commands, and Pull-only startup");
  } finally {
    restoreAll();
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
