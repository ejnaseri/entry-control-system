import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission, AdminRole, MemberRoleType, MemberStatus, MemberType } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler, HttpError } from "../../middlewares/error-handler";
import { createEmployeeRouter, type EmployeeApi } from "./employee.router";

type TestProfile = "sign-in" | "viewer" | "writer";

const EMPLOYEE_ID = "cmemployee00000000000000001";
const CUSTOMER_ID = "cmcustomer00000000000000001";
const MISSING_ID = "cmmissing000000000000000001";
const STAFF_GROUP_ID = "cmstaffgroup0000000000000001";
const NOW = "2026-08-09T08:30:00.000Z";

function validEmployeePayload() {
  return {
    code: "12001",
    firstName: "Safe",
    lastName: "Employee",
    status: MemberStatus.ACTIVE,
    role: { roleType: MemberRoleType.EMPLOYEE, customTitle: "Front desk" },
    profile: { position: "Receptionist", department: "Operations", systemRole: "STAFF" },
    access: {
      allowedDays: [1, 2, 3, 4, 5],
      allowedTimeRanges: [{ weekday: 1, ranges: [{ from: "08:00", to: "16:00" }] }],
    },
    overtime: { allowOvertime: false },
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
  };
}

function employeeDetail(id = EMPLOYEE_ID) {
  return {
    id,
    code: "12001",
    memberType: MemberType.STAFF,
    isStaff: true,
    firstName: "Safe",
    lastName: "Employee",
    fatherName: null,
    phone: null,
    email: null,
    gender: null,
    birthDate: null,
    nationalId: null,
    photoUrl: null,
    status: MemberStatus.ACTIVE,
    notes: null,
    roleType: MemberRoleType.EMPLOYEE,
    customTitle: "Front desk",
    profile: { position: "Receptionist", department: "Operations", systemRole: "STAFF" },
    staffGroupId: null,
    staffGroup: null,
    archivedAt: null,
    active: true,
    access: { allowedDays: [1, 2, 3, 4, 5], allowedTimeRanges: [], maxEntriesPerDay: null },
    overtime: { allowOvertime: false, maxOvertimePerDay: null },
    shifts: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function createFakeEmployeeApi() {
  const calls = {
    list: 0,
    create: 0,
    get: 0,
    update: 0,
    shifts: 0,
    archive: 0,
    attendance: 0,
    staffGroupOptions: 0,
    mutations: 0,
    contexts: [] as any[],
  };

  function rejectNonStaff(id: string) {
    if (id === CUSTOMER_ID || id === MISSING_ID) throw new HttpError(404, "Employee not found");
  }

  const api = {
    listEmployees: async () => {
      calls.list += 1;
      return { items: [employeeDetail()], total: 1, skip: 0, take: 25 };
    },
    createEmployee: async (_input: unknown, context: unknown) => {
      calls.create += 1;
      calls.mutations += 1;
      calls.contexts.push(context);
      return employeeDetail();
    },
    getEmployee: async (id: string) => {
      calls.get += 1;
      rejectNonStaff(id);
      return employeeDetail(id);
    },
    updateEmployee: async (id: string, _input: unknown, context: unknown) => {
      calls.update += 1;
      rejectNonStaff(id);
      calls.mutations += 1;
      calls.contexts.push(context);
      return employeeDetail(id);
    },
    assignEmployeeShifts: async (id: string, _input: unknown, context: unknown) => {
      calls.shifts += 1;
      rejectNonStaff(id);
      calls.mutations += 1;
      calls.contexts.push(context);
      return employeeDetail(id);
    },
    setEmployeeArchived: async (id: string, _input: unknown, context: unknown) => {
      calls.archive += 1;
      rejectNonStaff(id);
      calls.mutations += 1;
      calls.contexts.push(context);
      return { ...employeeDetail(id), archivedAt: NOW, active: false, status: MemberStatus.BLOCKED };
    },
    listEmployeeAttendance: async (id: string) => {
      calls.attendance += 1;
      rejectNonStaff(id);
      return [{ id: "cmlog000000000000000000001", entryType: "IN", recordedAt: NOW, source: "DEVICE", isAuthorized: true, reason: null }];
    },
    listEmployeeStaffGroupOptions: async () => {
      calls.staffGroupOptions += 1;
      return [{ id: STAFF_GROUP_ID, name: "Operations", description: null, accessLevel: null, shifts: [] }];
    },
  } as unknown as EmployeeApi;

  return { api, calls };
}

function permissionsFor(profile: TestProfile): AdminPermission[] {
  if (profile === "writer") {
    return [AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW, AdminPermission.MEMBERS_WRITE];
  }
  if (profile === "viewer") return [AdminPermission.SIGN_IN, AdminPermission.MEMBERS_VIEW];
  return [AdminPermission.SIGN_IN];
}

function buildTestApp(api: EmployeeApi) {
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile") as TestProfile | undefined;
    if (profile && ["sign-in", "viewer", "writer"].includes(profile)) {
      req.auth = {
        user: {
          id: `employee-api-${profile}`,
          username: `employee-api-${profile}`,
          role: AdminRole.GYM_OWNER,
        },
        permissions: permissionsFor(profile),
        session: { id: `employee-api-session-${profile}` },
      } as any;
    }
    next();
  });
  app.use(
    "/api/v1/employees",
    requirePermission(AdminPermission.MEMBERS_VIEW),
    createEmployeeRouter(api)
  );
  app.use((_req, res) => res.status(404).json({ message: "Route not found" }));
  app.use(errorHandler);
  return app;
}

async function request(
  baseUrl: string,
  path: string,
  options: { method?: string; profile?: TestProfile; body?: unknown } = {}
) {
  const headers: Record<string, string> = {};
  if (options.profile) headers["x-test-profile"] = options.profile;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) as any : null };
}

async function testPermissionMatrix(baseUrl: string, calls: ReturnType<typeof createFakeEmployeeApi>["calls"]) {
  const unauthenticated = await request(baseUrl, "/");
  assert.equal(unauthenticated.status, 401);
  assert.equal(unauthenticated.body.message, "Authentication required");

  const signInOnly = await request(baseUrl, "/", { profile: "sign-in" });
  assert.equal(signInOnly.status, 403);
  assert.equal(signInOnly.body.requiredPermission, AdminPermission.MEMBERS_VIEW);

  assert.equal((await request(baseUrl, "/", { profile: "viewer" })).status, 200);
  const options = await request(baseUrl, "/options/staff-groups", { profile: "viewer" });
  assert.equal(options.status, 200);
  assert.deepEqual(Object.keys(options.body[0]).sort(), ["accessLevel", "description", "id", "name", "shifts"]);
  assert.equal(JSON.stringify(options.body).includes("salary"), false);
  assert.equal((await request(baseUrl, `/${EMPLOYEE_ID}`, { profile: "viewer" })).status, 200);
  assert.equal((await request(baseUrl, `/${EMPLOYEE_ID}/attendance`, { profile: "viewer" })).status, 200);
  assert.equal(calls.list, 1);
  assert.equal(calls.get, 1);
  assert.equal(calls.attendance, 1);
  assert.equal(calls.staffGroupOptions, 1);

  const blockedWrites = [
    request(baseUrl, "/", { method: "POST", profile: "viewer", body: validEmployeePayload() }),
    request(baseUrl, `/${EMPLOYEE_ID}`, { method: "PUT", profile: "viewer", body: validEmployeePayload() }),
    request(baseUrl, `/${EMPLOYEE_ID}/shifts`, {
      method: "PUT",
      profile: "viewer",
      body: { shifts: validEmployeePayload().shifts, extraShifts: [] },
    }),
    request(baseUrl, `/${EMPLOYEE_ID}/archive`, { method: "PATCH", profile: "viewer", body: { archived: true } }),
  ];
  for (const response of await Promise.all(blockedWrites)) {
    assert.equal(response.status, 403);
    assert.equal(response.body.requiredPermission, AdminPermission.MEMBERS_WRITE);
  }
  assert.equal(calls.mutations, 0);
  console.log("ok - Employee API requires MEMBERS_VIEW for reads and MEMBERS_WRITE for every mutation");
}

async function testWriteAndValidationMatrix(baseUrl: string, calls: ReturnType<typeof createFakeEmployeeApi>["calls"]) {
  const payload = validEmployeePayload();
  assert.equal((await request(baseUrl, "/", { method: "POST", profile: "writer", body: payload })).status, 201);
  assert.equal((await request(baseUrl, `/${EMPLOYEE_ID}`, { method: "PUT", profile: "writer", body: payload })).status, 200);
  assert.equal(
    (await request(baseUrl, `/${EMPLOYEE_ID}/shifts`, {
      method: "PUT",
      profile: "writer",
      body: { shifts: payload.shifts, extraShifts: [] },
    })).status,
    200
  );
  assert.equal(
    (await request(baseUrl, `/${EMPLOYEE_ID}/archive`, {
      method: "PATCH",
      profile: "writer",
      body: { archived: true },
    })).status,
    200
  );
  assert.equal(calls.mutations, 4);
  assert.equal(calls.contexts.length, 4);
  assert.ok(calls.contexts.every((context) => context.actor.id === "employee-api-writer"));
  assert.ok(calls.contexts.every((context) => context.actor.sessionId === "employee-api-session-writer"));

  const beforeInvalid = { create: calls.create, update: calls.update, mutations: calls.mutations };
  const invalidCreate = await request(baseUrl, "/", {
    method: "POST",
    profile: "writer",
    body: { ...payload, memberType: MemberType.CUSTOMER, payments: [{ amount: 1 }] },
  });
  assert.equal(invalidCreate.status, 400);
  const invalidUpdate = await request(baseUrl, `/${EMPLOYEE_ID}`, {
    method: "PUT",
    profile: "writer",
    body: { ...payload, shifts: [{ ...payload.shifts[0], salaryAmount: 7_000 }] },
  });
  assert.equal(invalidUpdate.status, 400);
  const widenedList = await request(baseUrl, "/?memberType=CUSTOMER", { profile: "writer" });
  assert.equal(widenedList.status, 400);
  assert.deepEqual(
    { create: calls.create, update: calls.update, mutations: calls.mutations },
    beforeInvalid,
    "invalid Customer/finance/salary payloads must not reach Employee services"
  );
  console.log("ok - Employee API accepts safe writes directly and rejects widening, Customer, salary, and finance input");
}

async function testNonEnumeratingIdsAndForbiddenRoutes(
  baseUrl: string,
  calls: ReturnType<typeof createFakeEmployeeApi>["calls"]
) {
  const customer = await request(baseUrl, `/${CUSTOMER_ID}`, { profile: "writer" });
  const missing = await request(baseUrl, `/${MISSING_ID}`, { profile: "writer" });
  assert.equal(customer.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(customer.text, missing.text, "Customer and unknown IDs must be indistinguishable");

  const customerMutationCount = calls.mutations;
  const customerUpdate = await request(baseUrl, `/${CUSTOMER_ID}`, {
    method: "PUT",
    profile: "writer",
    body: validEmployeePayload(),
  });
  const missingUpdate = await request(baseUrl, `/${MISSING_ID}`, {
    method: "PUT",
    profile: "writer",
    body: validEmployeePayload(),
  });
  assert.equal(customerUpdate.status, 404);
  assert.equal(missingUpdate.status, 404);
  assert.equal(customerUpdate.text, missingUpdate.text);
  assert.equal(calls.mutations, customerMutationCount);

  const beforeForbidden = { ...calls };
  const forbidden = [
    request(baseUrl, `/${EMPLOYEE_ID}`, { method: "DELETE", profile: "writer" }),
    request(baseUrl, `/${EMPLOYEE_ID}/full`, { profile: "writer" }),
    request(baseUrl, `/${EMPLOYEE_ID}/memberships`, { profile: "writer" }),
    request(baseUrl, `/${EMPLOYEE_ID}/memberships`, { method: "POST", profile: "writer", body: {} }),
    request(baseUrl, `/${EMPLOYEE_ID}/payments`, { profile: "writer" }),
    request(baseUrl, `/${EMPLOYEE_ID}/payments`, { method: "POST", profile: "writer", body: {} }),
  ];
  for (const response of await Promise.all(forbidden)) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Route not found" });
  }
  assert.equal(calls.mutations, beforeForbidden.mutations);
  assert.equal(calls.create, beforeForbidden.create);
  assert.equal(calls.update, beforeForbidden.update);
  assert.equal(calls.shifts, beforeForbidden.shifts);
  assert.equal(calls.archive, beforeForbidden.archive);
  console.log("ok - Employee IDs do not enumerate Customers and DELETE/full/membership/payment routes do not exist");
}

async function run() {
  const { api, calls } = createFakeEmployeeApi();
  const server = createServer(buildTestApp(api));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/employees`;
    await testPermissionMatrix(baseUrl, calls);
    await testWriteAndValidationMatrix(baseUrl, calls);
    await testNonEnumeratingIdsAndForbiddenRoutes(baseUrl, calls);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
