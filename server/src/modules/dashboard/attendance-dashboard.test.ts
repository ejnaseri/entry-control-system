import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission, DeviceStatus } from "@prisma/client";
import { errorHandler } from "../../middlewares/error-handler";
import { createAttendanceDashboardRouter } from "./attendance-dashboard.router";
import {
  createAttendanceDashboardDataSource,
  getAttendanceDashboardDetails,
  getAttendanceDashboardSummary,
  type AttendanceDashboardDataSource,
  type AttendanceDashboardSummary,
} from "./attendance-dashboard.service";

const NOW = new Date("2026-08-24T08:30:00.000Z");

function daily(date: string, rows: Array<Record<string, unknown>>, deniedCount = 0) {
  return {
    date,
    summary: {
      present: 0, absent: 0, late: 0, inside: 0, justified: 0,
      unscheduledPresentCount: 0, deniedCount,
    },
    warnings: { noCheckout: 2, noShift: 1, multipleEvents: 3 },
    rows,
  } as any;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    memberId: "staff-daily-1",
    memberCode: "102",
    memberFullName: "Daily Staff",
    memberPhone: "0700000002",
    staffGroupName: "Day",
    shiftName: "Day shift",
    shiftStart: "08:00",
    shiftEnd: "16:00",
    hasShift: true,
    checkInAt: new Date("2026-08-24T04:30:00.000Z"),
    lateMinutes: 0,
    isJustified: false,
    hasOpenSession: false,
    ...overrides,
  };
}

async function testSummaryComposition() {
  const today = daily("2026-08-24", [
    row(),
    row({ lateMinutes: 12, hasOpenSession: true }),
    row({ checkInAt: null }),
    row({ checkInAt: null, isJustified: true }),
    row({ hasShift: false }),
  ], 4);
  const dataSource: AttendanceDashboardDataSource = {
    countActiveEmployees: async () => 12,
    listActiveEmployees: async () => [{
      id: "staff-1", code: "101", firstName: "Eraj", lastName: "Naseri", phone: "0700000000",
      roleType: "EMPLOYEE", customTitle: null, staffGroup: { name: "Day" },
      shifts: [{ shiftName: "Day shift", shiftStart: "08:00", shiftEnd: "16:00" }],
    }],
    getDaily: async (date) => date === "2026-08-24" ? today : daily(date, [row()]),
    countPunches: async () => 19,
    countUnknownIds: async () => 2,
    listDevices: async () => [
      { id: "device-1", name: "Front", enabled: true, status: DeviceStatus.ONLINE, lastSuccessfulPollAt: new Date("2026-08-24T08:29:00.000Z"), lastEventReceivedAt: new Date("2026-08-24T08:28:00.000Z") },
      { id: "device-2", name: "Back", enabled: true, status: DeviceStatus.ERROR, lastSuccessfulPollAt: null, lastEventReceivedAt: null },
      { id: "device-3", name: "Disabled", enabled: false, status: DeviceStatus.OFFLINE, lastSuccessfulPollAt: null, lastEventReceivedAt: null },
    ],
  };

  const summary = await getAttendanceDashboardSummary(NOW, dataSource);
  assert.equal(summary.date, "2026-08-24");
  assert.deepEqual(summary.employees, { active: 12, scheduledToday: 4 });
  assert.deepEqual(summary.attendance, {
    present: 3, onTime: 1, late: 1, absent: 1, justified: 1, insideNow: 1, openSessions: 1,
  });
  assert.deepEqual(summary.warnings, { missingCheckout: 2, multipleEvents: 3, noShift: 1 });
  assert.deepEqual(summary.punches, { total: 19, denied: 4, unknownIds: 2 });
  assert.deepEqual(summary.devices, {
    total: 3, enabled: 2, online: 1, offline: 1,
    lastSyncAt: "2026-08-24T08:29:00.000Z", lastEventAt: "2026-08-24T08:28:00.000Z",
  });
  assert.equal(summary.trend.length, 7);
  assert.equal(summary.trend[6]?.exceptions, 10);
  assert.equal(Object.isFrozen(summary), true);

  const present = await getAttendanceDashboardDetails("present", 100, NOW, dataSource);
  assert.equal(present.total, 3);
  assert.equal(present.items[0]?.memberName, "Daily Staff");
  assert.equal((await getAttendanceDashboardDetails("inside-now", 100, NOW, dataSource)).total, 1);
  assert.equal((await getAttendanceDashboardDetails("late", 100, NOW, dataSource)).total, 1);
  assert.equal((await getAttendanceDashboardDetails("absent", 100, NOW, dataSource)).total, 1);
  const active = await getAttendanceDashboardDetails("active-employees", 100, NOW, dataSource);
  assert.equal(active.total, 12);
  assert.deepEqual(active.items[0], {
    memberId: "staff-1", memberCode: "101", memberName: "Eraj Naseri", memberPhone: "0700000000",
    staffGroupName: "Day", shiftName: "Day shift", shiftTime: "08:00–16:00", role: "EMPLOYEE",
    checkInAt: null, checkOutAt: null, status: "ACTIVE", lateMinutes: null,
  });
}

async function testStaffOnlyQueries() {
  const calls: Array<{ operation: string; args: unknown }> = [];
  const database = {
    member: {
      count: async (args: unknown) => { calls.push({ operation: "member.count", args }); return 1; },
      findMany: async (args: unknown) => { calls.push({ operation: "member.findMany", args }); return []; },
    },
    attendanceLog: { count: async (args: unknown) => { calls.push({ operation: "attendanceLog.count", args }); return 2; } },
    deviceRawLog: { count: async (args: unknown) => { calls.push({ operation: "deviceRawLog.count", args }); return 3; } },
    device: { findMany: async (args: unknown) => { calls.push({ operation: "device.findMany", args }); return []; } },
  };
  const dailyScopes: Array<{ input: unknown; scope: unknown }> = [];
  const loader = async (input: unknown, scope: unknown) => {
    dailyScopes.push({ input, scope });
    return daily("2026-08-24", []);
  };
  const source = createAttendanceDashboardDataSource(database as any, loader as any);
  await Promise.all([
    source.countActiveEmployees(),
    source.listActiveEmployees(100),
    source.getDaily("2026-08-24"),
    source.countPunches(NOW, new Date(NOW.getTime() + 1_000)),
    source.countUnknownIds(NOW, new Date(NOW.getTime() + 1_000)),
    source.listDevices(),
  ]);

  assert.match(JSON.stringify(calls), /"memberType":"STAFF"/u);
  assert.match(JSON.stringify(calls), /"isStaff":true/u);
  assert.deepEqual(dailyScopes, [{ input: { date: "2026-08-24", mode: "primary" }, scope: "STRICT_STAFF" }]);
  assert.deepEqual((calls.find(({ operation }) => operation === "device.findMany")?.args as any).select, {
    id: true, name: true, enabled: true, status: true, lastSuccessfulPollAt: true, lastEventReceivedAt: true,
  });
  assert.doesNotMatch(JSON.stringify({ calls, dailyScopes }), /customer|membership|payment|revenue|debt|payroll|expense/iu);
}

function summaryFixture(): AttendanceDashboardSummary {
  return {
    date: "2026-08-24", generatedAt: NOW.toISOString(),
    employees: { active: 1, scheduledToday: 1 },
    attendance: { present: 1, onTime: 1, late: 0, absent: 0, justified: 0, insideNow: 1, openSessions: 1 },
    warnings: { missingCheckout: 0, multipleEvents: 0, noShift: 0 },
    punches: { total: 1, denied: 0, unknownIds: 0 },
    devices: { total: 1, enabled: 1, online: 1, offline: 0, lastSyncAt: NOW.toISOString(), lastEventAt: NOW.toISOString() },
    trend: [],
  };
}

async function testRouterBoundary() {
  let summaryCalls = 0;
  let detailCalls = 0;
  const expected = summaryFixture();
  const app = express();
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile");
    if (profile) {
      req.auth = {
        user: { id: "staff-1", username: "staff", role: "STAFF" },
        permissions: profile === "viewer" ? [AdminPermission.ATTENDANCE_VIEW] : [AdminPermission.SIGN_IN],
        session: { id: "session-1" },
      } as any;
    }
    next();
  });
  app.use("/api/v1/dashboard", createAttendanceDashboardRouter({
    getSummary: async () => { summaryCalls += 1; return expected; },
    getDetails: async (type) => {
      detailCalls += 1;
      return { type, date: "2026-08-24", total: 0, items: [] };
    },
  }));
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/api/v1/dashboard`;
    assert.equal((await fetch(`${base}/summary`)).status, 401);
    const denied = await fetch(`${base}/summary`, { headers: { "x-test-profile": "limited" } });
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { message: "Permission denied", requiredPermission: "ATTENDANCE_VIEW" });
    assert.equal((await fetch(`${base}/details?type=present`)).status, 401);
    assert.equal((await fetch(`${base}/details?type=present`, { headers: { "x-test-profile": "limited" } })).status, 403);
    const allowed = await fetch(`${base}/summary`, { headers: { "x-test-profile": "viewer" } });
    assert.equal(allowed.status, 200);
    assert.deepEqual(await allowed.json(), expected);
    assert.equal((await fetch(`${base}/details?type=activeMembers`, { headers: { "x-test-profile": "viewer" } })).status, 400);
    assert.equal((await fetch(`${base}/details?type=present`, { headers: { "x-test-profile": "viewer" } })).status, 200);
    assert.equal((await fetch(`${base}/reports-summary`, { headers: { "x-test-profile": "viewer" } })).status, 404);
    assert.equal(summaryCalls, 1);
    assert.equal(detailCalls, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function run() {
  await testSummaryComposition();
  await testStaffOnlyQueries();
  await testRouterBoundary();
  console.log("ok - Attendance dashboard summary, Staff-only data source, permission, and route boundary");
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
