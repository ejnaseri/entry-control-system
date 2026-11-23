import assert from "node:assert/strict";
import {
  AdminRole,
  AttendanceSource,
  AttendanceType,
  MemberRoleType,
  MemberStatus,
  MemberType,
  SalaryType,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import {
  employeeByIdWhere,
  employeeDetailSelect,
  employeeRepositoryTestHooks,
  employeeStaffScope,
  employeeSummarySelect,
} from "./employee.repository";
import {
  employeeCreateSchema,
  employeeShiftAssignmentSchema,
  employeeUpdateSchema,
  type EmployeeCreateInput,
} from "./employee.schemas";
import {
  assignEmployeeShifts,
  createEmployee,
  employeeServiceTestHooks,
  listEmployees,
  listEmployeeAttendance,
  setEmployeeArchived,
  updateEmployee,
} from "./employee.service";
import {
  employeeDeviceUserRepositoryTestHooks,
  syncEmployeeDeviceUserLink,
} from "./employee.device-user.repository";

const EMPLOYEE_ID = "cmemployee00000000000000001";
const CUSTOMER_ID = "cmcustomer00000000000000001";
const MISSING_ID = "cmmissing000000000000000001";
const NOW = new Date("2026-08-09T08:30:00.000Z");

const actionContext = {
  actor: {
    id: "admin-employee-test",
    role: AdminRole.GYM_OWNER,
    sessionId: "session-employee-test",
  },
  meta: {
    ipAddress: "127.0.0.1",
    userAgent: "employee-service-test",
  },
};

function validCreatePayload(): EmployeeCreateInput {
  return employeeCreateSchema.parse({
    code: "12001",
    firstName: "Safe",
    lastName: "Employee",
    phone: "+93700000001",
    email: "safe.employee@example.test",
    status: MemberStatus.ACTIVE,
    role: { roleType: MemberRoleType.EMPLOYEE, customTitle: "Front desk" },
    profile: { position: "Receptionist", department: "Operations", systemRole: "STAFF" },
    access: {
      allowedDays: [1, 2, 3, 4, 5],
      allowedTimeRanges: [{ weekday: 1, ranges: [{ from: "08:00", to: "16:00" }] }],
    },
    overtime: { allowOvertime: true, maxOvertimePerDay: 2 },
    shifts: [
      {
        shiftName: "Day",
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [1, 2, 3, 4, 5],
        graceMinutes: 5,
        earlyAccessMinutes: 15,
        isActive: true,
      },
    ],
    extraShifts: [],
  });
}

function sentinelDetailRow() {
  return {
    id: EMPLOYEE_ID,
    code: "12001",
    memberType: MemberType.CUSTOMER,
    isStaff: false,
    firstName: "Safe",
    lastName: "Employee",
    fatherName: "Parent",
    phone: "+93700000001",
    email: "safe.employee@example.test",
    gender: null,
    birthDate: new Date("1995-02-03T00:00:00.000Z"),
    nationalId: "N-100",
    photoUrl: null,
    status: MemberStatus.ACTIVE,
    notes: "Operational note",
    roleType: MemberRoleType.EMPLOYEE,
    customTitle: "Front desk",
    staffGroupId: null,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    staffProfile: {
      position: "Receptionist",
      department: "Operations",
      systemRole: "STAFF",
      salaryAmount: 99_999,
    },
    staffGroup: {
      id: "cmgroup0000000000000000001",
      name: "Operations",
      description: "Safe group",
      accessLevel: "STANDARD",
      shifts: [
        {
          id: "cmgroupshift000000000000001",
          shiftName: "Day",
          shiftStart: "08:00",
          shiftEnd: "16:00",
          weekdays: [1, 2, 3, 4, 5],
          graceMinutes: 5,
          earlyAccessMinutes: 15,
          isActive: true,
          salaryType: SalaryType.HOURLY,
          salaryAmount: 1_000,
        },
      ],
    },
    accessPolicy: {
      allowedDays: [1, 2, 3, 4, 5],
      maxEntriesPerDay: 4,
      rules: [
        { weekday: 1, fromTime: "08:00", toTime: "16:00", fingerprintHash: "never-return" },
      ],
    },
    overtimePolicy: {
      allowOvertime: true,
      maxOvertimePerDay: 2,
      overtimeRateType: "PER_HOUR",
      overtimeAmount: 500,
    },
    shifts: [
      {
        id: "cmmembershift00000000000001",
        shiftId: null,
        shiftName: "Day",
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [1, 2, 3, 4, 5],
        graceMinutes: 5,
        earlyAccessMinutes: 15,
        isFromGroup: false,
        isActive: true,
        salaryType: SalaryType.HOURLY,
        salaryAmount: 2_000,
        rateOverride: 3_000,
      },
    ],
    customerProfile: { totalDebtAmount: 7_500, totalPaidAmount: 8_500 },
    memberships: [{ id: "private-membership", totalDue: 12_000 }],
    payments: [{ id: "private-payment", amount: 4_000 }],
    deviceUser: { id: "private-device-user", fingerprintHash: "private-template" },
    payrollPeriods: [{ id: "private-payroll", netAmount: 100_000 }],
  } as any;
}

const forbiddenKeys = new Set([
  "customerProfile",
  "memberships",
  "payments",
  "totalDebtAmount",
  "totalPaidAmount",
  "salaryType",
  "salaryAmount",
  "rateOverride",
  "overtimeRateType",
  "overtimeAmount",
  "fingerprintHash",
  "deviceUser",
  "deviceUserId",
  "payrollPeriods",
  "netAmount",
]);

function assertNoForbiddenKeys(value: unknown, path = "response") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object" || value instanceof Date) return;
  for (const [key, entry] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key), false, `${path}.${key} must not be present`);
    assertNoForbiddenKeys(entry, `${path}.${key}`);
  }
}

function assertExactKeys(value: object, expected: readonly string[], label: string) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} must use the exact safe projection`);
}

function collectSelectedKeys(value: unknown, result = new Set<string>()) {
  if (!value || typeof value !== "object") return result;
  for (const [key, nested] of Object.entries(value)) {
    result.add(key);
    collectSelectedKeys(nested, result);
  }
  return result;
}

async function expectEmployeeNotFound(operation: Promise<unknown>) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 404);
    assert.equal(error.message, "Employee not found");
    return true;
  });
}

function testStrictSchemas() {
  const valid = validCreatePayload();
  for (const [key, value] of [
    ["memberType", MemberType.CUSTOMER],
    ["isStaff", false],
    ["fingerId", 17],
    ["customerProfile", { totalDebtAmount: 1 }],
    ["memberships", []],
    ["payments", []],
    ["salaryAmount", 5_000],
    ["deviceUser", { externalId: 17 }],
  ] as const) {
    assert.equal(employeeCreateSchema.safeParse({ ...valid, [key]: value }).success, false, `create must reject ${key}`);
  }
  assert.equal(
    employeeCreateSchema.safeParse({
      ...valid,
      shifts: [{ ...valid.shifts[0], salaryType: SalaryType.HOURLY, salaryAmount: 1_000 }],
    }).success,
    false,
    "create must reject shift salary fields"
  );
  assert.equal(
    employeeUpdateSchema.safeParse({ ...valid, overtime: { ...valid.overtime, overtimeAmount: 100 } }).success,
    false,
    "update must reject monetary overtime fields"
  );
  assert.equal(
    employeeShiftAssignmentSchema.safeParse({ shifts: [], extraShifts: [], memberType: MemberType.CUSTOMER }).success,
    false,
    "shift assignment must reject member type overrides"
  );
  console.log("ok - Employee write schemas reject Customer, financial, salary, device, and unknown fields");
}

function testRepositoryScopeAndSelects() {
  assert.deepEqual(employeeStaffScope(), { memberType: MemberType.STAFF, isStaff: true });
  assert.deepEqual(employeeByIdWhere(EMPLOYEE_ID), {
    AND: [{ id: EMPLOYEE_ID }, { memberType: MemberType.STAFF, isStaff: true }],
  });
  const where = employeeRepositoryTestHooks.buildEmployeeListWhere({
    status: MemberStatus.ACTIVE,
    staffGroupId: "cmgroup0000000000000000001",
    search: "Safe",
    includeArchived: false,
    skip: 10,
    take: 20,
  });
  assert.deepEqual((where.AND as unknown[])[0], { memberType: MemberType.STAFF, isStaff: true });
  assert.ok((where.AND as unknown[]).some((entry) => JSON.stringify(entry) === JSON.stringify({ archivedAt: null })));
  assert.ok(JSON.stringify(where).includes('"status":"ACTIVE"'));
  assert.ok(JSON.stringify(where).includes('"staffGroupId":"cmgroup0000000000000000001"'));
  assert.ok(JSON.stringify(where).includes('"contains":"Safe"'));

  const selectedKeys = collectSelectedKeys({ employeeSummarySelect, employeeDetailSelect });
  for (const forbidden of forbiddenKeys) {
    assert.equal(selectedKeys.has(forbidden), false, `Prisma Employee selects must exclude ${forbidden}`);
  }
  const optionKeys = collectSelectedKeys(employeeRepositoryTestHooks.employeeStaffGroupOptionSelect);
  for (const forbidden of forbiddenKeys) {
    assert.equal(optionKeys.has(forbidden), false, `Employee staff-group options must exclude ${forbidden}`);
  }
  console.log("ok - Employee repository forces STAFF+isStaff scope and uses finance/device-safe selects");
}

function testSafeProjections() {
  const row = sentinelDetailRow();
  const summary = employeeServiceTestHooks.toEmployeeSummary(row);
  const detail = employeeServiceTestHooks.toEmployeeDetail(row);
  const audit = employeeServiceTestHooks.toAuditSnapshot(row);
  const attendance = employeeServiceTestHooks.toEmployeeAttendance({
    id: "cmlog000000000000000000001",
    entryType: AttendanceType.IN,
    recordedAt: NOW,
    source: AttendanceSource.DEVICE,
    isAuthorized: true,
    reason: null,
    deviceUserId: "private-device-user",
    fingerprintHash: "private-template",
  } as any);

  assert.equal(summary.memberType, MemberType.STAFF);
  assert.equal(summary.isStaff, true);
  assert.equal(detail.memberType, MemberType.STAFF);
  assert.equal(detail.isStaff, true);
  assertExactKeys(
    summary,
    [
      "id", "code", "memberType", "isStaff", "firstName", "lastName", "phone", "photoUrl", "status",
      "roleType", "customTitle", "staffGroupId", "staffGroup", "archivedAt", "createdAt", "updatedAt",
    ],
    "employee summary"
  );
  assertExactKeys(
    detail,
    [
      "id", "code", "memberType", "isStaff", "firstName", "lastName", "fatherName", "phone", "email",
      "gender", "birthDate", "nationalId", "photoUrl", "status", "notes", "roleType", "customTitle", "profile",
      "staffGroupId", "staffGroup", "archivedAt", "active", "access", "overtime", "shifts", "createdAt", "updatedAt",
    ],
    "employee detail"
  );
  assertExactKeys(detail.profile!, ["position", "department", "systemRole"], "employee profile");
  assertExactKeys(detail.staffGroup!, ["id", "name", "description", "accessLevel", "shifts"], "staff group");
  assertExactKeys(
    detail.staffGroup!.shifts[0]!,
    ["id", "shiftName", "shiftStart", "shiftEnd", "weekdays", "graceMinutes", "earlyAccessMinutes", "isActive"],
    "staff group shift"
  );
  assertExactKeys(detail.access!, ["allowedDays", "allowedTimeRanges", "maxEntriesPerDay"], "access policy");
  assertExactKeys(detail.overtime!, ["allowOvertime", "maxOvertimePerDay"], "overtime policy");
  assertExactKeys(
    detail.shifts[0]!,
    ["id", "shiftId", "shiftName", "shiftStart", "shiftEnd", "weekdays", "graceMinutes", "earlyAccessMinutes", "isFromGroup", "isActive"],
    "employee shift"
  );
  assertExactKeys(attendance, ["id", "entryType", "recordedAt", "source", "isAuthorized", "reason"], "attendance item");
  assertNoForbiddenKeys(summary);
  assertNoForbiddenKeys(detail);
  assertNoForbiddenKeys(audit);
  assertNoForbiddenKeys(attendance);
  for (const piiKey of ["firstName", "lastName", "fatherName", "phone", "email", "birthDate", "nationalId", "photoUrl", "notes"]) {
    assert.equal(piiKey in audit, false, `Employee audit snapshot must not duplicate ${piiKey}`);
  }
  console.log("ok - Employee list/detail/attendance/audit projections cannot leak Customer, finance, salary, or device data");
}

async function testCanonicalCreateAndNeutralWrites() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const input = validCreatePayload();
  const calls = {
    memberCreate: [] as any[],
    deviceUserCreate: [] as any[],
    accessUpsert: [] as any[],
    overtimeUpsert: [] as any[],
    shiftDelete: [] as any[],
    shiftCreate: [] as any[],
    auditCreate: [] as any[],
  };
  const tx = {
    member: {
      findFirst: async ({ select }: any) => {
        if (select === employeeDetailSelect) return sentinelDetailRow();
        if (select === employeeDeviceUserRepositoryTestHooks.employeeDeviceUserIdentitySelect) {
          return { id: EMPLOYEE_ID, code: input.code };
        }
        return null;
      },
      create: async ({ data }: any) => {
        calls.memberCreate.push(data);
        return { id: EMPLOYEE_ID };
      },
    },
    deviceUser: {
      findUnique: async () => null,
      create: async (inputValue: any) => {
        calls.deviceUserCreate.push(inputValue);
        return { id: "cmdeviceuser000000000000001", ...inputValue.data };
      },
      updateMany: async () => ({ count: 0 }),
    },
    staffProfile: { upsert: async () => ({}) },
    memberAccessPolicy: {
      upsert: async (inputValue: any) => {
        calls.accessUpsert.push(inputValue);
        return {};
      },
    },
    memberOvertimePolicy: {
      upsert: async (inputValue: any) => {
        calls.overtimeUpsert.push(inputValue);
        return {};
      },
    },
    memberShift: {
      deleteMany: async (inputValue: any) => {
        calls.shiftDelete.push(inputValue);
        return { count: 0 };
      },
      createMany: async (inputValue: any) => {
        calls.shiftCreate.push(inputValue);
        return { count: inputValue.data.length };
      },
    },
    staffGroup: { findUnique: async () => null },
    staffGroupShift: { findMany: async () => [] },
    auditLog: {
      create: async (inputValue: any) => {
        calls.auditCreate.push(inputValue);
        return {};
      },
    },
  };

  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  try {
    await createEmployee(input, actionContext);
  } finally {
    prismaAny.$transaction = originalTransaction;
  }

  assert.equal(calls.memberCreate.length, 1);
  assert.equal(calls.memberCreate[0].memberType, MemberType.STAFF);
  assert.equal(calls.memberCreate[0].isStaff, true);
  assert.equal(calls.memberCreate[0].archivedAt, null);
  assert.deepEqual(calls.deviceUserCreate, [{ data: { externalId: 12001, memberId: EMPLOYEE_ID } }]);
  for (const forbidden of ["customerProfile", "memberships", "payments", "deviceUser", "fingerId"]) {
    assert.equal(forbidden in calls.memberCreate[0], false, `create must not write ${forbidden}`);
  }
  assert.equal(calls.overtimeUpsert[0].create.overtimeRateType, null);
  assert.equal(calls.overtimeUpsert[0].create.overtimeAmount, null);
  assert.equal(calls.shiftCreate[0].data[0].salaryType, SalaryType.MONTHLY);
  assert.equal(calls.shiftCreate[0].data[0].salaryAmount, 0);
  assert.equal(calls.shiftCreate[0].data[0].rateOverride, null);
  assert.equal(calls.auditCreate.length, 1);
  assertNoForbiddenKeys(calls.auditCreate[0].data.afterData);
  console.log("ok - Employee create atomically links a persistence-only DeviceUser and keeps neutral writes and Audit safe");
}

async function testPublicListAndAttendanceQueries() {
  const prismaAny = prisma as any;
  const original = {
    transaction: prismaAny.$transaction,
    memberFindMany: prismaAny.member.findMany,
    memberCount: prismaAny.member.count,
    memberFindFirst: prismaAny.member.findFirst,
    attendanceFindMany: prismaAny.attendanceLog.findMany,
  };
  const captured = { list: null as any, count: null as any, identity: null as any, attendance: null as any };
  prismaAny.member.findMany = async (input: any) => {
    captured.list = input;
    return [sentinelDetailRow()];
  };
  prismaAny.member.count = async (input: any) => {
    captured.count = input;
    return 1;
  };
  prismaAny.$transaction = async (operations: Array<Promise<unknown>>) => Promise.all(operations);
  prismaAny.member.findFirst = async (input: any) => {
    captured.identity = input;
    return { id: EMPLOYEE_ID };
  };
  prismaAny.attendanceLog.findMany = async (input: any) => {
    captured.attendance = input;
    return [
      {
        id: "cmlog000000000000000000001",
        entryType: AttendanceType.IN,
        recordedAt: NOW,
        source: AttendanceSource.DEVICE,
        isAuthorized: true,
        reason: null,
        deviceUserId: "private-device-user",
      },
    ];
  };

  try {
    const result = await listEmployees({
      status: MemberStatus.ACTIVE,
      staffGroupId: "cmgroup0000000000000000001",
      search: "Safe",
      includeArchived: false,
      skip: 5,
      take: 10,
    });
    assertExactKeys(result, ["items", "total", "skip", "take"], "employee list envelope");
    assert.equal(result.total, 1);
    assert.equal(result.skip, 5);
    assert.equal(result.take, 10);
    assert.deepEqual(captured.list.where, captured.count.where, "list and count must share the exact Staff scope");
    assert.deepEqual(captured.list.where.AND[0], { memberType: MemberType.STAFF, isStaff: true });
    assert.equal(captured.list.skip, 5);
    assert.equal(captured.list.take, 10);
    assert.equal(captured.list.select, employeeSummarySelect);

    const attendance = await listEmployeeAttendance(EMPLOYEE_ID);
    assert.deepEqual(captured.identity.where, employeeByIdWhere(EMPLOYEE_ID));
    assert.deepEqual(captured.attendance.where, {
      memberId: EMPLOYEE_ID,
      member: { is: { memberType: MemberType.STAFF, isStaff: true } },
    });
    assertNoForbiddenKeys(attendance);
  } finally {
    prismaAny.$transaction = original.transaction;
    prismaAny.member.findMany = original.memberFindMany;
    prismaAny.member.count = original.memberCount;
    prismaAny.member.findFirst = original.memberFindFirst;
    prismaAny.attendanceLog.findMany = original.attendanceFindMany;
  }
  console.log("ok - Public Employee list/count and attendance queries retain Staff scope and exact safe envelopes");
}

async function testScopedUpdateAndArchiveAudit() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const calls = { update: [] as any[], audit: [] as any[], deletes: 0 };
  const tx = {
    member: {
      findFirst: async ({ select }: any) => (select === employeeDetailSelect ? sentinelDetailRow() : null),
      updateMany: async (input: any) => {
        calls.update.push(input);
        return { count: 1 };
      },
      delete: async () => {
        calls.deletes += 1;
        throw new Error("Employee facade must not physically delete");
      },
    },
    staffProfile: { upsert: async () => ({}) },
    memberAccessPolicy: { upsert: async () => ({}) },
    memberOvertimePolicy: { upsert: async () => ({}) },
    memberShift: { deleteMany: async () => ({ count: 1 }), createMany: async () => ({ count: 1 }) },
    staffGroup: { findUnique: async () => null },
    staffGroupShift: { findMany: async () => [] },
    auditLog: {
      create: async (input: any) => {
        calls.audit.push(input);
        return {};
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  try {
    await updateEmployee(EMPLOYEE_ID, employeeUpdateSchema.parse(validCreatePayload()), actionContext);
    await setEmployeeArchived(EMPLOYEE_ID, { archived: true }, actionContext);
  } finally {
    prismaAny.$transaction = originalTransaction;
  }

  assert.equal(calls.update.length, 2);
  for (const update of calls.update) {
    assert.deepEqual(update.where, { ...employeeByIdWhere(EMPLOYEE_ID), updatedAt: NOW });
    assert.equal(update.data.memberType, MemberType.STAFF);
    assert.equal(update.data.isStaff, true);
  }
  assert.equal(calls.update[0].data.code, "12001");
  assert.ok(calls.update[1].data.archivedAt instanceof Date);
  assert.equal(calls.update[1].data.status, MemberStatus.BLOCKED);
  assert.equal(calls.deletes, 0);
  assert.equal(calls.audit.length, 2);
  assert.equal(calls.audit[0].data.actorId, actionContext.actor.id);
  assert.equal(calls.audit[0].data.actorRole, actionContext.actor.role);
  assert.equal(calls.audit[0].data.sessionId, actionContext.actor.sessionId);
  assert.equal(calls.audit[0].data.ipAddress, actionContext.meta.ipAddress);
  assert.equal(calls.audit[0].data.userAgent, actionContext.meta.userAgent);
  assertNoForbiddenKeys(calls.audit[0].data.beforeData);
  assertNoForbiddenKeys(calls.audit[0].data.afterData);
  assert.equal(calls.audit[1].data.metadata.operation, "ARCHIVE");
  console.log("ok - Employee update/archive are Staff-scoped, auditable, restorable, and never physically delete");
}

async function testDeviceUserBoundaryClaimsExistingUnlinkedSlot() {
  const calls = { creates: 0, updates: [] as any[] };
  const targetSlot = { id: "cmdeviceuser000000000000002", externalId: 12001, memberId: null };
  const tx = {
    member: {
      findFirst: async ({ where, select }: any) => {
        assert.deepEqual(where, {
          id: EMPLOYEE_ID,
          code: "12001",
          memberType: MemberType.STAFF,
          isStaff: true,
        });
        assert.equal(select, employeeDeviceUserRepositoryTestHooks.employeeDeviceUserIdentitySelect);
        return { id: EMPLOYEE_ID, code: "12001" };
      },
    },
    deviceUser: {
      findUnique: async ({ where }: any) => (where.externalId === 12001 ? targetSlot : null),
      create: async () => {
        calls.creates += 1;
        return {};
      },
      updateMany: async (input: any) => {
        calls.updates.push(input);
        return { count: 1 };
      },
    },
  };

  await syncEmployeeDeviceUserLink(tx as any, EMPLOYEE_ID, "12001");
  assert.equal(calls.creates, 0);
  assert.deepEqual(calls.updates, [
    {
      where: { id: targetSlot.id, externalId: 12001, memberId: null },
      data: { memberId: EMPLOYEE_ID, lastSyncedAt: null },
    },
  ]);
  console.log("ok - Employee DeviceUser boundary conditionally claims an existing unlinked physical slot");
}

async function testDeviceUserBoundaryMovesLinkToExistingSlot() {
  const currentSlot = { id: "cmdeviceuser000000000000001", externalId: 12001, memberId: EMPLOYEE_ID };
  const targetSlot = { id: "cmdeviceuser000000000000002", externalId: 12002, memberId: null };
  const updates: any[] = [];
  const tx = {
    member: { findFirst: async () => ({ id: EMPLOYEE_ID, code: "12002" }) },
    deviceUser: {
      findUnique: async ({ where }: any) => (where.memberId === EMPLOYEE_ID ? currentSlot : targetSlot),
      updateMany: async (input: any) => {
        updates.push(input);
        return { count: 1 };
      },
      create: async () => {
        throw new Error("Existing physical slot must be claimed instead of duplicated");
      },
    },
  };

  await syncEmployeeDeviceUserLink(tx as any, EMPLOYEE_ID, "12002");
  assert.deepEqual(updates, [
    {
      where: { id: currentSlot.id, memberId: EMPLOYEE_ID, externalId: 12001 },
      data: { memberId: null, lastSyncedAt: null },
    },
    {
      where: { id: targetSlot.id, externalId: 12002, memberId: null },
      data: { memberId: EMPLOYEE_ID, lastSyncedAt: null },
    },
  ]);
  console.log("ok - Employee DeviceUser remap preserves and conditionally claims an existing physical slot");
}

async function testDeviceUserBoundaryCanonicalizesUniqueRaces() {
  const tx = {
    member: { findFirst: async () => ({ id: EMPLOYEE_ID, code: "12002" }) },
    deviceUser: {
      findUnique: async () => null,
      create: async () => {
        throw { code: "P2002", meta: { target: ["externalId"] } };
      },
    },
  };

  await assert.rejects(syncEmployeeDeviceUserLink(tx as any, EMPLOYEE_ID, "12002"), (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    assert.equal(error.message, "Employee code is already assigned to another device user");
    assert.equal(error.details, undefined);
    return true;
  });
  console.log("ok - Concurrent DeviceUser uniqueness races become the same non-enumerating 409 contract");
}

async function testEmployeeCodeChangeAtomicallyRemapsDeviceUser() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const calls = { memberUpdates: [] as any[], deviceUpdates: [] as any[], audits: [] as any[] };
  let detailReads = 0;
  const oldDeviceUser = { id: "cmdeviceuser000000000000001", externalId: 12001, memberId: EMPLOYEE_ID };
  const tx = {
    member: {
      findFirst: async ({ select }: any) => {
        if (select === employeeDetailSelect) {
          detailReads += 1;
          return { ...sentinelDetailRow(), code: detailReads === 1 ? "12001" : "12002" };
        }
        if (select === employeeDeviceUserRepositoryTestHooks.employeeDeviceUserIdentitySelect) {
          return { id: EMPLOYEE_ID, code: "12002" };
        }
        return null;
      },
      updateMany: async (input: any) => {
        calls.memberUpdates.push(input);
        return { count: 1 };
      },
    },
    deviceUser: {
      findUnique: async ({ where }: any) => (where.memberId === EMPLOYEE_ID ? oldDeviceUser : null),
      updateMany: async (input: any) => {
        calls.deviceUpdates.push(input);
        return { count: 1 };
      },
      create: async () => {
        throw new Error("Existing Employee DeviceUser must be remapped instead of duplicated");
      },
    },
    staffProfile: { upsert: async () => ({}) },
    memberAccessPolicy: { upsert: async () => ({}) },
    memberOvertimePolicy: { upsert: async () => ({}) },
    memberShift: { deleteMany: async () => ({ count: 1 }), createMany: async () => ({ count: 1 }) },
    staffGroup: { findUnique: async () => null },
    staffGroupShift: { findMany: async () => [] },
    auditLog: {
      create: async (input: any) => {
        calls.audits.push(input);
        return {};
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  try {
    await updateEmployee(
      EMPLOYEE_ID,
      employeeUpdateSchema.parse({ ...validCreatePayload(), code: "12002" }),
      actionContext
    );
  } finally {
    prismaAny.$transaction = originalTransaction;
  }
  assert.equal(calls.memberUpdates.length, 1);
  assert.equal(calls.memberUpdates[0].data.code, "12002");
  assert.deepEqual(calls.deviceUpdates, [
    {
      where: { id: oldDeviceUser.id, memberId: EMPLOYEE_ID, externalId: 12001 },
      data: { externalId: 12002, deviceId: null, lastSyncedAt: null },
    },
  ]);
  assert.equal(calls.audits.length, 1);
  assert.deepEqual(calls.audits[0].data.metadata.changedFields, ["code"]);
  assertNoForbiddenKeys(calls.audits[0].data.beforeData);
  assertNoForbiddenKeys(calls.audits[0].data.afterData);
  console.log("ok - Employee code change atomically remaps DeviceUser and retains the safe Employee Audit contract");
}

async function testDeviceUserCollisionsRollBackEmployeeCode() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;

  try {
    for (const [newCode, conflictingMemberId] of [
      ["12002", CUSTOMER_ID],
      ["12003", "cmothermember00000000000001"],
    ] as const) {
      const state = { code: "12001" };
      const calls = { memberUpdates: 0, deviceUpdates: 0, relationWrites: 0, audits: 0 };
      const currentSlot = { id: "cmdeviceuser000000000000001", externalId: 12001, memberId: EMPLOYEE_ID };
      const conflictingSlot = {
        id: `cmdeviceuser${newCode.padStart(18, "0")}`,
        externalId: Number(newCode),
        memberId: conflictingMemberId,
      };
      const tx = {
        member: {
          findFirst: async ({ select }: any) => {
            if (select === employeeDetailSelect) return { ...sentinelDetailRow(), code: state.code };
            if (select === employeeDeviceUserRepositoryTestHooks.employeeDeviceUserIdentitySelect) {
              return { id: EMPLOYEE_ID, code: state.code };
            }
            return null;
          },
          updateMany: async ({ data }: any) => {
            calls.memberUpdates += 1;
            state.code = data.code;
            return { count: 1 };
          },
        },
        deviceUser: {
          findUnique: async ({ where }: any) => (where.memberId === EMPLOYEE_ID ? currentSlot : conflictingSlot),
          updateMany: async () => {
            calls.deviceUpdates += 1;
            return { count: 1 };
          },
          create: async () => {
            calls.deviceUpdates += 1;
            return {};
          },
        },
        staffProfile: { upsert: async () => { calls.relationWrites += 1; return {}; } },
        auditLog: { create: async () => { calls.audits += 1; return {}; } },
        staffGroup: { findUnique: async () => null },
        staffGroupShift: { findMany: async () => [] },
      };
      prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => {
        const before = { ...state };
        try {
          return await callback(tx);
        } catch (error) {
          Object.assign(state, before);
          throw error;
        }
      };

      await assert.rejects(
        updateEmployee(
          EMPLOYEE_ID,
          employeeUpdateSchema.parse({ ...validCreatePayload(), code: newCode }),
          actionContext
        ),
        (error: unknown) => {
          assert.ok(error instanceof HttpError);
          assert.equal(error.status, 409);
          assert.equal(error.message, "Employee code is already assigned to another device user");
          assert.equal(error.details, undefined);
          assert.equal(JSON.stringify(error).includes(conflictingMemberId), false);
          return true;
        }
      );
      assert.equal(state.code, "12001", "DeviceUser collision must roll the Member code back");
      assert.deepEqual(calls, { memberUpdates: 1, deviceUpdates: 0, relationWrites: 0, audits: 0 });
    }
  } finally {
    prismaAny.$transaction = originalTransaction;
  }
  console.log("ok - Customer and other-member DeviceUser collisions return canonical 409 and roll Employee changes back");
}

async function testScheduleValidationPrecedesWrites() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const calls = { memberCreates: 0, audits: 0 };
  const tx = {
    member: {
      findFirst: async () => null,
      create: async () => {
        calls.memberCreates += 1;
        return { id: EMPLOYEE_ID };
      },
    },
    staffGroup: { findUnique: async () => null },
    staffGroupShift: { findMany: async () => [] },
    auditLog: {
      create: async () => {
        calls.audits += 1;
        return {};
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  const input = employeeCreateSchema.parse({
    ...validCreatePayload(),
    staffGroupId: "cmgroup0000000000000000001",
    shifts: [],
  });
  try {
    await assert.rejects(createEmployee(input, actionContext), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 404);
      assert.equal(error.message, "Staff group not found");
      return true;
    });
  } finally {
    prismaAny.$transaction = originalTransaction;
  }
  assert.deepEqual(calls, { memberCreates: 0, audits: 0 });
  console.log("ok - Unknown Staff groups fail before Member, shift, or Audit writes begin");
}

async function testOptimisticConflictAndAuditRollback() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const input = employeeUpdateSchema.parse({ ...validCreatePayload(), firstName: "Changed" });
  const conflictCalls = { relations: 0, audits: 0 };
  const conflictTx = {
    member: {
      findFirst: async ({ select }: any) => (select === employeeDetailSelect ? sentinelDetailRow() : null),
      updateMany: async () => ({ count: 0 }),
    },
    staffProfile: { upsert: async () => { conflictCalls.relations += 1; return {}; } },
    auditLog: { create: async () => { conflictCalls.audits += 1; return {}; } },
  };
  prismaAny.$transaction = async (callback: (client: typeof conflictTx) => Promise<unknown>) => callback(conflictTx);
  try {
    await assert.rejects(updateEmployee(EMPLOYEE_ID, input, actionContext), (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 409);
      assert.match(error.message, /changed by another request/u);
      return true;
    });
  } finally {
    prismaAny.$transaction = originalTransaction;
  }
  assert.deepEqual(conflictCalls, { relations: 0, audits: 0 });

  const state = { firstName: "Safe" };
  let auditAttempts = 0;
  const rollbackTx = {
    member: {
      findFirst: async ({ select }: any) =>
        select === employeeDetailSelect ? { ...sentinelDetailRow(), firstName: state.firstName } : null,
      updateMany: async ({ data }: any) => {
        state.firstName = data.firstName;
        return { count: 1 };
      },
    },
    staffProfile: { upsert: async () => ({}) },
    memberAccessPolicy: { upsert: async () => ({}) },
    memberOvertimePolicy: { upsert: async () => ({}) },
    memberShift: { deleteMany: async () => ({ count: 1 }), createMany: async () => ({ count: 1 }) },
    staffGroup: { findUnique: async () => null },
    staffGroupShift: { findMany: async () => [] },
    auditLog: {
      create: async () => {
        auditAttempts += 1;
        throw new Error("audit unavailable");
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof rollbackTx) => Promise<unknown>) => {
    const before = { ...state };
    try {
      return await callback(rollbackTx);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  };
  try {
    await assert.rejects(updateEmployee(EMPLOYEE_ID, input, actionContext), /audit unavailable/u);
  } finally {
    prismaAny.$transaction = originalTransaction;
  }
  assert.equal(auditAttempts, 1);
  assert.equal(state.firstName, "Safe", "Audit failure must roll the Employee write back");
  console.log("ok - Optimistic version conflicts fail before relations and Audit failure rolls the transaction back");
}

function assertEmployeeModuleGraphExcludesDevices() {
  const deviceManagerPath = require.resolve("../devices/deviceManager");
  assert.equal(require.cache[deviceManagerPath], undefined, "Employee persistence boundary must not load the Device manager");
  console.log("ok - Employee DeviceUser persistence boundary has no physical Device manager dependency");
}

async function testCustomerAndUnknownMutationGuards() {
  const prismaAny = prisma as any;
  const originalTransaction = prismaAny.$transaction;
  const originalMemberFindFirst = prismaAny.member.findFirst;
  const originalAttendanceFindMany = prismaAny.attendanceLog.findMany;
  const calls = { memberUpdate: 0, memberDelete: 0, shiftDelete: 0, shiftCreate: 0, auditCreate: 0, attendance: 0 };
  const tx = {
    member: {
      findFirst: async () => null,
      updateMany: async () => {
        calls.memberUpdate += 1;
        return { count: 0 };
      },
      delete: async () => {
        calls.memberDelete += 1;
        throw new Error("Employee facade must not physically delete");
      },
    },
    memberShift: {
      deleteMany: async () => {
        calls.shiftDelete += 1;
        return { count: 0 };
      },
      createMany: async () => {
        calls.shiftCreate += 1;
        return { count: 0 };
      },
    },
    auditLog: {
      create: async () => {
        calls.auditCreate += 1;
        return {};
      },
    },
  };
  prismaAny.$transaction = async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx);
  prismaAny.member.findFirst = async () => null;
  prismaAny.attendanceLog.findMany = async () => {
    calls.attendance += 1;
    return [];
  };

  const updateInput = employeeUpdateSchema.parse(validCreatePayload());
  const shiftInput = employeeShiftAssignmentSchema.parse({
    shifts: validCreatePayload().shifts,
    extraShifts: [],
  });
  try {
    for (const id of [CUSTOMER_ID, MISSING_ID]) {
      await expectEmployeeNotFound(updateEmployee(id, updateInput, actionContext));
      await expectEmployeeNotFound(assignEmployeeShifts(id, shiftInput, actionContext));
      await expectEmployeeNotFound(setEmployeeArchived(id, { archived: true }, actionContext));
      await expectEmployeeNotFound(listEmployeeAttendance(id));
    }
  } finally {
    prismaAny.$transaction = originalTransaction;
    prismaAny.member.findFirst = originalMemberFindFirst;
    prismaAny.attendanceLog.findMany = originalAttendanceFindMany;
  }

  assert.deepEqual(calls, {
    memberUpdate: 0,
    memberDelete: 0,
    shiftDelete: 0,
    shiftCreate: 0,
    auditCreate: 0,
    attendance: 0,
  });
  console.log("ok - Customer and unknown IDs share the same 404 path with zero write, attendance, delete, device, or audit effects");
}

async function run() {
  testStrictSchemas();
  testRepositoryScopeAndSelects();
  testSafeProjections();
  await testPublicListAndAttendanceQueries();
  await testCanonicalCreateAndNeutralWrites();
  await testScopedUpdateAndArchiveAudit();
  await testDeviceUserBoundaryClaimsExistingUnlinkedSlot();
  await testDeviceUserBoundaryMovesLinkToExistingSlot();
  await testDeviceUserBoundaryCanonicalizesUniqueRaces();
  await testEmployeeCodeChangeAtomicallyRemapsDeviceUser();
  await testDeviceUserCollisionsRollBackEmployeeCode();
  await testScheduleValidationPrecedesWrites();
  await testOptimisticConflictAndAuditRollback();
  await testCustomerAndUnknownMutationGuards();
  assertEmployeeModuleGraphExcludesDevices();
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
