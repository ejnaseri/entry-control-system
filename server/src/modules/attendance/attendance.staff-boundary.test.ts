import assert from "node:assert/strict";
import {
  AdminRole,
  AttendanceSource,
  AttendanceType,
  MemberStatus,
  MemberType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  ATTENDANCE_DATA_SCOPES,
  buildStrictStaffMemberWhere,
  getAttendanceDataScope,
} from "./attendance-edition-scope";
import {
  createManualAttendance,
  listAttendance,
  listDailyAttendance,
  removeAttendanceJustification,
  upsertAttendanceJustification,
  type AttendanceActionContext,
} from "./attendance.service";

const STAFF_ID = "cmstaff0000000000000000001";
const CUSTOMER_ID = "cmcustomer00000000000000001";
const TYPE_MISMATCH_ID = "cmtypemismatch0000000000001";
const FLAG_MISMATCH_ID = "cmflagmismatch0000000000001";
const MISSING_ID = "cmmissing000000000000000001";
const LOG_ID = "cmlog000000000000000000001";
const CUSTOMER_LOG_ID = "cmlogcustomer000000000000001";
const MEMBERSHIP_ID = "cmmembership000000000000001";
const JUSTIFICATION_DATE = "2026-08-10";
const RECORDED_AT = new Date("2026-08-10T08:00:00.000Z");
const CREATED_AT = new Date("2026-08-10T08:00:01.000Z");

const actionContext: AttendanceActionContext = {
  actor: {
    id: "attendance-boundary-admin",
    role: AdminRole.GYM_OWNER,
    sessionId: "attendance-boundary-session",
  },
  meta: {
    ipAddress: "127.0.0.1",
    userAgent: "attendance-staff-boundary-test",
  },
};

const memberMarkers = new Map<string, { memberType: MemberType; isStaff: boolean }>([
  [STAFF_ID, { memberType: MemberType.STAFF, isStaff: true }],
  [CUSTOMER_ID, { memberType: MemberType.CUSTOMER, isStaff: false }],
  [TYPE_MISMATCH_ID, { memberType: MemberType.CUSTOMER, isStaff: true }],
  [FLAG_MISMATCH_ID, { memberType: MemberType.STAFF, isStaff: false }],
]);

const forbiddenKeys = new Set([
  "customerProfile",
  "memberships",
  "membershipId",
  "membershipStatus",
  "payments",
  "totalDebtAmount",
  "salaryType",
  "salaryAmount",
  "rateOverride",
  "rawLogId",
  "dedupeKey",
]);

function buildMemberRow(id: string, includeMembership = false) {
  const markers = memberMarkers.get(id);
  assert.ok(markers, `Missing marker fixture for ${id}`);
  return {
    id,
    code: id === STAFF_ID ? "S-100" : "C-100",
    firstName: id === STAFF_ID ? "Strict" : "Legacy",
    lastName: id === STAFF_ID ? "Employee" : "Customer",
    phone: null,
    memberType: markers.memberType,
    isStaff: markers.isStaff,
    status: MemberStatus.ACTIVE,
    roleType: null,
    customTitle: null,
    staffProfile: id === STAFF_ID ? { position: "Operator", department: "Operations" } : null,
    ...(includeMembership
      ? { memberships: [{ id: MEMBERSHIP_ID, status: "ACTIVE" }] }
      : {}),
  };
}

function buildAttendanceRow(memberId: string, includeMembership = false) {
  return {
    id: memberId === CUSTOMER_ID ? CUSTOMER_LOG_ID : LOG_ID,
    createdAt: CREATED_AT,
    recordedAt: RECORDED_AT,
    memberId,
    entryType: AttendanceType.IN,
    source: AttendanceSource.MANUAL,
    isAuthorized: true,
    reason: "Boundary fixture",
    deviceUser: null,
    member: buildMemberRow(memberId, includeMembership),
  };
}

function assertNoForbiddenKeys(value: unknown, label = "value") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenKeys(item, `${label}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key), false, `${label} contains forbidden key ${key}`);
    assertNoForbiddenKeys(nested, `${label}.${key}`);
  }
}

function assertStrictMemberRelation(where: any, label: string) {
  assert.ok(where?.member, `${label} is missing its member relation boundary`);
  assert.deepEqual(where.member.AND?.[0], buildStrictStaffMemberWhere(), `${label} is not strict-both Staff`);
}

function assertStrictTargetWhere(where: any, memberId: string) {
  assert.deepEqual(where, {
    id: memberId,
    memberType: MemberType.STAFF,
    isStaff: true,
  });
}

function expectEmployeeNotFound(promise: Promise<unknown>) {
  return assert.rejects(
    promise,
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 404);
      assert.equal(error.message, "Employee not found");
      assert.equal(error.details, undefined);
      return true;
    }
  );
}

function testEditionScopeContract() {
  assert.equal(getAttendanceDataScope("ATTENDANCE"), ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
  assert.equal(getAttendanceDataScope("FULL"), ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
  assert.deepEqual(buildStrictStaffMemberWhere(), {
    memberType: MemberType.STAFF,
    isStaff: true,
  });
  console.log("ok - Attendance edition resolves to an exact strict-both Staff data scope");
}

async function testEntryListScopeSelectsAndProjection() {
  const prismaAny = prisma as any;
  const original = {
    transaction: prismaAny.$transaction,
    attendanceFindMany: prismaAny.attendanceLog.findMany,
    attendanceCount: prismaAny.attendanceLog.count,
    deviceFindMany: prismaAny.device.findMany,
  };
  const calls = {
    findMany: [] as any[],
    count: [] as any[],
    device: [] as any[],
  };
  let activeRow = buildAttendanceRow(STAFF_ID, true);

  prismaAny.attendanceLog.findMany = async (input: any) => {
    calls.findMany.push(input);
    return input.distinct ? [{ memberId: activeRow.memberId }] : [activeRow];
  };
  prismaAny.attendanceLog.count = async (input: any) => {
    calls.count.push(input);
    return 1;
  };
  prismaAny.device.findMany = async (input: any) => {
    calls.device.push(input);
    return [];
  };
  prismaAny.$transaction = async (operations: Array<Promise<unknown>>) => Promise.all(operations);

  const query = {
    memberType: "CUSTOMER" as const,
    eventType: "ALL" as const,
    source: "ALL" as const,
    result: "ALL" as const,
    page: 1,
    pageSize: 20,
  };

  try {
    const strictResult = await listAttendance(query, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal(strictResult.items.length, 1);
    const strictItem = strictResult.items[0];
    assert.ok(strictItem);
    assert.equal(strictItem.memberType, "STAFF");
    assert.equal(Object.hasOwn(strictItem, "membershipId"), false);
    assert.equal(Object.hasOwn(strictItem, "membershipStatus"), false);
    assertNoForbiddenKeys(strictItem, "strict entry DTO");

    assert.equal(calls.findMany.length, 2, "entry rows and unique-member summary should both be queried");
    assert.equal(calls.count.length, 4, "total, IN, OUT, and denied counts should all be queried");
    [...calls.findMany, ...calls.count].forEach((input, index) =>
      assertStrictMemberRelation(input.where, `strict entry query ${index}`)
    );
    const strictRowQuery = calls.findMany.find((input) => !input.distinct);
    assert.ok(strictRowQuery?.select);
    assert.equal(strictRowQuery.include, undefined);
    assertNoForbiddenKeys(strictRowQuery.select, "strict entry select");
    assert.equal(calls.device.length, 0);

    calls.findMany.length = 0;
    calls.count.length = 0;
    await listAttendance(
      { ...query, eventType: "IN", result: "DENIED" },
      ATTENDANCE_DATA_SCOPES.STRICT_STAFF
    );
    const deniedRowQuery = calls.findMany.find((input) => !input.distinct);
    assert.equal(deniedRowQuery.where.entryType, AttendanceType.IN);
    assert.equal(deniedRowQuery.where.isAuthorized, false, "DENIED must not be overwritten by the event filter");

    calls.findMany.length = 0;
    calls.count.length = 0;
    activeRow = buildAttendanceRow(CUSTOMER_ID, true);

    const fullResult = await listAttendance(query, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    const fullItem = fullResult.items[0];
    assert.ok(fullItem);
    assert.equal(fullItem.memberType, "CUSTOMER");
    assert.equal(fullItem.membershipId, MEMBERSHIP_ID);
    assert.equal(fullItem.membershipStatus, "ACTIVE");
    const fullRowQuery = calls.findMany.find((input) => !input.distinct);
    assert.ok(fullRowQuery?.select?.member?.select?.memberships, "FULL must preserve its legacy membership projection");
    assert.deepEqual(fullRowQuery.where.member.AND[0], {
      memberType: MemberType.CUSTOMER,
      isStaff: false,
    });
  } finally {
    prismaAny.$transaction = original.transaction;
    prismaAny.attendanceLog.findMany = original.attendanceFindMany;
    prismaAny.attendanceLog.count = original.attendanceCount;
    prismaAny.device.findMany = original.deviceFindMany;
  }

  console.log("ok - Entry list and every summary query are strict Staff with a safe DTO while FULL keeps memberships");
}

async function testDailyScopeAndSafeSelects() {
  const prismaAny = prisma as any;
  const original = {
    shiftFindMany: prismaAny.memberShift.findMany,
    attendanceFindMany: prismaAny.attendanceLog.findMany,
    attendanceCount: prismaAny.attendanceLog.count,
    justificationFindMany: prismaAny.attendanceJustification.findMany,
    deviceFindMany: prismaAny.device.findMany,
  };
  const calls = {
    shifts: [] as any[],
    logs: [] as any[],
    denied: [] as any[],
    justifications: [] as any[],
  };

  prismaAny.memberShift.findMany = async (input: any) => {
    calls.shifts.push(input);
    return [
      {
        memberId: STAFF_ID,
        shiftId: "cmshift0000000000000000001",
        shiftName: "Day",
        shiftStart: "08:00",
        shiftEnd: "16:00",
        graceMinutes: 5,
        member: {
          id: STAFF_ID,
          code: "S-100",
          firstName: "Strict",
          lastName: "Employee",
          phone: null,
          memberType: MemberType.STAFF,
          isStaff: true,
          staffGroup: null,
        },
      },
    ];
  };
  prismaAny.attendanceLog.findMany = async (input: any) => {
    calls.logs.push(input);
    return [];
  };
  prismaAny.attendanceLog.count = async (input: any) => {
    calls.denied.push(input);
    return 0;
  };
  prismaAny.attendanceJustification.findMany = async (input: any) => {
    calls.justifications.push(input);
    return [];
  };
  prismaAny.device.findMany = async () => [];

  const query = { date: JUSTIFICATION_DATE, mode: "primary" as const };
  try {
    const result = await listDailyAttendance(query, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal(result.rows.length, 1);
    assertStrictMemberRelation(calls.shifts[0].where, "daily shift query");
    assertStrictMemberRelation(calls.logs[0].where, "daily authorized-log query");
    assertStrictMemberRelation(calls.denied[0].where, "daily denied-log query");
    assert.deepEqual(calls.justifications[0].where.member, buildStrictStaffMemberWhere());
    assert.ok(calls.shifts[0].select);
    assert.equal(calls.shifts[0].include, undefined);
    assertNoForbiddenKeys(calls.shifts[0].select, "daily shift select");
    assert.ok(calls.logs[0].select);
    assert.equal(calls.logs[0].include, undefined);
    assertNoForbiddenKeys(calls.logs[0].select, "daily log select");

    calls.shifts.length = 0;
    calls.logs.length = 0;
    calls.denied.length = 0;
    calls.justifications.length = 0;
    await listDailyAttendance(query, ATTENDANCE_DATA_SCOPES.FULL_LEGACY);
    const legacyMarkerScope = { OR: [{ memberType: MemberType.STAFF }, { isStaff: true }] };
    assert.deepEqual(calls.shifts[0].where.member.AND[0], legacyMarkerScope);
    assert.deepEqual(calls.logs[0].where.member.AND[0], legacyMarkerScope);
    assert.deepEqual(calls.denied[0].where.member.AND[0], legacyMarkerScope);
    assert.equal(calls.justifications[0].where.member, undefined);
  } finally {
    prismaAny.memberShift.findMany = original.shiftFindMany;
    prismaAny.attendanceLog.findMany = original.attendanceFindMany;
    prismaAny.attendanceLog.count = original.attendanceCount;
    prismaAny.attendanceJustification.findMany = original.justificationFindMany;
    prismaAny.device.findMany = original.deviceFindMany;
  }

  console.log("ok - Daily shifts, logs, denied counts, and justifications share strict Staff scope without salary/raw selects");
}

async function testManualTargetMatrixAndFullPreservation() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const calls = {
    findFirst: [] as any[],
    findUnique: [] as any[],
    creates: [] as any[],
    audits: [] as any[],
  };

  const tx = {
    member: {
      findFirst: async (input: any) => {
        calls.findFirst.push(input);
        const marker = memberMarkers.get(input.where.id);
        return marker && marker.memberType === input.where.memberType && marker.isStaff === input.where.isStaff
          ? { id: input.where.id }
          : null;
      },
      findUnique: async (input: any) => {
        calls.findUnique.push(input);
        return memberMarkers.has(input.where.id) ? { id: input.where.id } : null;
      },
    },
    attendanceLog: {
      create: async (input: any) => {
        calls.creates.push(input);
        const includeMembership = input.data.memberId === CUSTOMER_ID;
        return buildAttendanceRow(input.data.memberId, includeMembership);
      },
    },
    auditLog: {
      create: async (input: any) => {
        calls.audits.push(input);
        return { id: `audit-${calls.audits.length}` };
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);

  const inputFor = (memberId: string) => ({
    memberId,
    eventType: "IN" as const,
    occurredAt: RECORDED_AT.toISOString(),
    notes: "Manual boundary fixture",
  });

  try {
    const staffResult = await createManualAttendance(
      inputFor(STAFF_ID),
      actionContext,
      ATTENDANCE_DATA_SCOPES.STRICT_STAFF
    );
    assertStrictTargetWhere(calls.findFirst[0].where, STAFF_ID);
    assert.equal(calls.creates.length, 1);
    assert.equal(calls.audits.length, 1);
    assertNoForbiddenKeys(calls.creates[0].select, "strict manual select");
    assertNoForbiddenKeys(calls.audits[0].data, "strict manual audit");
    assert.equal(staffResult.memberType, "STAFF");
    assert.equal(Object.hasOwn(staffResult, "membershipId"), false);

    const rejectedSignatures: string[] = [];
    for (const memberId of [CUSTOMER_ID, TYPE_MISMATCH_ID, FLAG_MISMATCH_ID, MISSING_ID]) {
      const before: { creates: number; audits: number } = {
        creates: calls.creates.length,
        audits: calls.audits.length,
      };
      await assert.rejects(
        createManualAttendance(inputFor(memberId), actionContext, ATTENDANCE_DATA_SCOPES.STRICT_STAFF),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          rejectedSignatures.push(JSON.stringify({ status: error.status, message: error.message, details: error.details ?? null }));
          assert.equal(error.status, 404);
          assert.equal(error.message, "Employee not found");
          assert.equal(error.details, undefined);
          return true;
        }
      );
      assert.deepEqual({ creates: calls.creates.length, audits: calls.audits.length }, before);
      assertStrictTargetWhere(calls.findFirst.at(-1).where, memberId);
    }
    assert.equal(new Set(rejectedSignatures).size, 1, "Customer, mismatches, and missing IDs must be indistinguishable");

    const fullCustomer = await createManualAttendance(
      inputFor(CUSTOMER_ID),
      actionContext,
      ATTENDANCE_DATA_SCOPES.FULL_LEGACY
    );
    assert.equal(calls.findUnique.at(-1).where.id, CUSTOMER_ID);
    assert.equal(fullCustomer.memberType, "CUSTOMER");
    assert.equal(fullCustomer.membershipId, MEMBERSHIP_ID);
    assert.ok(calls.creates.at(-1).select.member.select.memberships);
  } finally {
    prismaAny.$transaction = originalTransaction;
  }

  console.log("ok - Manual attendance accepts canonical Staff, rejects every unsafe target without writes, and preserves FULL Customer behavior");
}

async function testJustificationTargetMatrixAndFullPreservation() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const calls = {
    findFirst: [] as any[],
    justificationReads: [] as any[],
    upserts: [] as any[],
    deletes: [] as any[],
    audits: [] as any[],
  };
  const records = new Map<string, any>();

  const tx = {
    member: {
      findFirst: async (input: any) => {
        calls.findFirst.push(input);
        const marker = memberMarkers.get(input.where.id);
        return marker && marker.memberType === input.where.memberType && marker.isStaff === input.where.isStaff
          ? { id: input.where.id }
          : null;
      },
    },
    attendanceJustification: {
      findUnique: async (input: any) => {
        calls.justificationReads.push(input);
        return records.get(input.where.memberId_date.memberId) ?? null;
      },
      upsert: async (input: any) => {
        calls.upserts.push(input);
        const memberId = input.create.memberId;
        const existing = records.get(memberId);
        const record = {
          id: existing?.id ?? `justification-${memberId}`,
          memberId,
          date: input.create.date,
          reason: existing ? input.update.reason : input.create.reason,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
        };
        records.set(memberId, record);
        return record;
      },
      delete: async (input: any) => {
        calls.deletes.push(input);
        const entry = Array.from(records.entries()).find(([, record]) => record.id === input.where.id);
        if (entry) records.delete(entry[0]);
        return entry?.[1] ?? null;
      },
    },
    auditLog: {
      create: async (input: any) => {
        calls.audits.push(input);
        return { id: `justification-audit-${calls.audits.length}` };
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);

  const inputFor = (memberId: string) => ({ memberId, date: JUSTIFICATION_DATE, reason: "Approved leave" });
  try {
    const created = await upsertAttendanceJustification(
      inputFor(STAFF_ID),
      actionContext,
      ATTENDANCE_DATA_SCOPES.STRICT_STAFF
    );
    assert.equal(created.memberId, STAFF_ID);
    assertStrictTargetWhere(calls.findFirst[0].where, STAFF_ID);
    assert.equal(calls.upserts.length, 1);
    assert.equal(calls.audits.length, 1);
    assertNoForbiddenKeys(calls.audits[0].data, "strict justification audit");
    assert.equal(
      await removeAttendanceJustification(
        { memberId: STAFF_ID, date: JUSTIFICATION_DATE },
        actionContext,
        ATTENDANCE_DATA_SCOPES.STRICT_STAFF
      ),
      true
    );
    assert.equal(calls.deletes.length, 1);
    assert.equal(calls.audits.length, 2);

    const rejectedSignatures: string[] = [];
    for (const memberId of [CUSTOMER_ID, TYPE_MISMATCH_ID, FLAG_MISMATCH_ID, MISSING_ID]) {
      for (const operation of [
        () => upsertAttendanceJustification(inputFor(memberId), actionContext, ATTENDANCE_DATA_SCOPES.STRICT_STAFF),
        () => removeAttendanceJustification(
          { memberId, date: JUSTIFICATION_DATE },
          actionContext,
          ATTENDANCE_DATA_SCOPES.STRICT_STAFF
        ),
      ]) {
        const before: { reads: number; upserts: number; deletes: number; audits: number } = {
          reads: calls.justificationReads.length,
          upserts: calls.upserts.length,
          deletes: calls.deletes.length,
          audits: calls.audits.length,
        };
        await assert.rejects(operation(), (error: unknown) => {
          assert.ok(error instanceof HttpError);
          rejectedSignatures.push(JSON.stringify({ status: error.status, message: error.message, details: error.details ?? null }));
          assert.equal(error.status, 404);
          assert.equal(error.message, "Employee not found");
          assert.equal(error.details, undefined);
          return true;
        });
        assert.deepEqual(
          {
            reads: calls.justificationReads.length,
            upserts: calls.upserts.length,
            deletes: calls.deletes.length,
            audits: calls.audits.length,
          },
          before,
          `unsafe justification target ${memberId} reached a read, mutation, or audit`
        );
        assertStrictTargetWhere(calls.findFirst.at(-1).where, memberId);
      }
    }
    assert.equal(new Set(rejectedSignatures).size, 1);

    const customerCreated = await upsertAttendanceJustification(
      inputFor(CUSTOMER_ID),
      actionContext,
      ATTENDANCE_DATA_SCOPES.FULL_LEGACY
    );
    assert.equal(customerCreated.memberId, CUSTOMER_ID);
    assert.equal(
      await removeAttendanceJustification(
        { memberId: CUSTOMER_ID, date: JUSTIFICATION_DATE },
        actionContext,
        ATTENDANCE_DATA_SCOPES.FULL_LEGACY
      ),
      true
    );
  } finally {
    prismaAny.$transaction = originalTransaction;
  }

  console.log("ok - Justification lifecycle is Staff-only with indistinguishable zero-effect rejects while FULL keeps Customer support");
}

async function testSerializableRetryAndPostWriteMarkerCheck() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  let transactionAttempts = 0;
  let returnMismatchedMember = false;
  const calls = { creates: 0, audits: 0 };
  const tx = {
    member: {
      findFirst: async () => ({ id: STAFF_ID }),
    },
    attendanceLog: {
      create: async () => {
        calls.creates += 1;
        const row = buildAttendanceRow(STAFF_ID);
        return returnMismatchedMember
          ? {
              ...row,
              member: { ...row.member, memberType: MemberType.CUSTOMER, isStaff: false },
            }
          : row;
      },
    },
    auditLog: {
      create: async () => {
        calls.audits += 1;
        return { id: `retry-audit-${calls.audits}` };
      },
    },
  };
  prismaAny.$transaction = async (operation: (client: typeof tx) => Promise<unknown>, options?: any) => {
    transactionAttempts += 1;
    assert.equal(options?.isolationLevel, "Serializable");
    if (transactionAttempts < 3) throw { code: "P2034" };
    return operation(tx);
  };

  const input = {
    memberId: STAFF_ID,
    eventType: "IN" as const,
    occurredAt: RECORDED_AT.toISOString(),
  };
  try {
    await createManualAttendance(input, actionContext, ATTENDANCE_DATA_SCOPES.STRICT_STAFF);
    assert.equal(transactionAttempts, 3, "strict mutations must retry bounded Serializable conflicts");
    assert.deepEqual(calls, { creates: 1, audits: 1 });

    returnMismatchedMember = true;
    const auditsBefore = calls.audits;
    await expectEmployeeNotFound(
      createManualAttendance(input, actionContext, ATTENDANCE_DATA_SCOPES.STRICT_STAFF)
    );
    assert.equal(calls.audits, auditsBefore, "post-write marker mismatch must abort before Audit");
  } finally {
    prismaAny.$transaction = originalTransaction;
  }

  console.log("ok - strict writes retry Serializable conflicts and abort on post-write marker reclassification");
}

async function run() {
  testEditionScopeContract();
  await testEntryListScopeSelectsAndProjection();
  await testDailyScopeAndSafeSelects();
  await testManualTargetMatrixAndFullPreservation();
  await testJustificationTargetMatrixAndFullPreservation();
  await testSerializableRetryAndPostWriteMarkerCheck();
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
