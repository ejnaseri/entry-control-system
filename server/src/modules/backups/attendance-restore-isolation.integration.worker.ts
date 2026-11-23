import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
  AdminPermission,
  AdminRole,
  AttendanceSource,
  AttendanceType,
  AuditActor,
  DeviceConnectionType,
  DeviceStatus,
  DeviceType,
  ExpenseStatus,
  MemberStatus,
  MemberType,
  MembershipStatus,
  PaymentMethod,
  PaymentStatus,
  PermissionMode,
} from "@prisma/client";
import { createApp } from "../../app";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { getDeviceDataScope } from "../devices/device-edition-scope";
import { processDeviceEvents } from "../devices/zktecoK40.service";

const DATABASE_NAME_PATTERN = /^ecs_att_restore_(?:src|dst)_[a-z0-9_]+$/u;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const TEST_USER_AGENT = "ecs-attendance-restore-isolation/1.0";
const RESTORED_EXTERNAL_CONFIG_SENTINELS = Object.freeze({
  APP_EDITION: "FULL",
  APP_TIMEZONE: "UTC",
  ATTENDANCE_POLICY: "ACCESS_CONTROL",
  ATTENDANCE_AUTO_CHECKOUT_ENABLED: "1",
});

type Fixture = Readonly<{
  marker: string;
  token: string;
  staffId: string;
  customerId: string;
  deviceId: string;
  staffExternalId: number;
  customerExternalId: number;
  staffAuditId: string;
  customerAuditId: string;
  paymentAuditId: string;
  expenseAuditId: string;
  day: Date;
}>;

function assertSafeEnvironment() {
  assert.equal(env.NODE_ENV, "test", "Restore-isolation worker requires NODE_ENV=test");
  const databaseUrl = new URL(env.DATABASE_URL);
  assert.ok(
    databaseUrl.protocol === "postgres:" || databaseUrl.protocol === "postgresql:",
    "Restore-isolation worker requires PostgreSQL"
  );
  assert.ok(LOOPBACK_HOSTS.has(databaseUrl.hostname.toLowerCase()), "Restore-isolation worker requires loopback PostgreSQL");
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  assert.match(databaseName, DATABASE_NAME_PATTERN, "Restore-isolation worker requires a generated disposable database");
  assert.ok(process.env["ATTENDANCE_RESTORE_TEST_MARKER"], "Restore-isolation marker is missing");
}

function marker() {
  return process.env["ATTENDANCE_RESTORE_TEST_MARKER"] as string;
}

function sessionToken() {
  return `attendance-restore-${marker()}`;
}

function dateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function atTime(day: Date, hours: number, minutes: number) {
  const value = new Date(day);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

async function seedFullDatabase() {
  assert.equal(env.APP_EDITION, "FULL", "The source fixture must be created under FULL Edition");
  assert.equal(env.APP_TIMEZONE, "UTC", "The source fixture must use its external UTC config");
  assert.equal(process.env["TZ"], "UTC", "APP_TIMEZONE must override the source host TZ");
  assert.equal(env.ATTENDANCE_POLICY, "TIME_CLOCK");
  assert.equal(env.ATTENDANCE_AUTO_CHECKOUT_ENABLED, "1");
  const suffix = marker();
  const token = sessionToken();
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - 2);

  const admin = await prisma.adminUser.create({
    data: {
      username: `restore-owner-${suffix}`,
      fullName: `Restore Owner ${suffix}`,
      passwordHash: "not-used-by-restore-isolation-test",
      role: AdminRole.GYM_OWNER,
    },
  });
  await prisma.adminUserPermission.createMany({
    data: [
      AdminPermission.SIGN_IN,
      AdminPermission.MEMBERS_VIEW,
      AdminPermission.MEMBERS_WRITE,
      AdminPermission.MEMBERSHIPS_WRITE,
      AdminPermission.PAYMENTS_RECORD,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.ATTENDANCE_EXPORT,
      AdminPermission.DEVICES_VIEW,
      AdminPermission.DEVICES_DIAGNOSTICS,
      AdminPermission.FINANCIAL_REPORTS_VIEW,
      AdminPermission.FINANCIAL_EXPORT,
      AdminPermission.PAYROLL_MANAGE,
      AdminPermission.EXPENSES_MANAGE,
      AdminPermission.SOUND_SETTINGS_MANAGE,
      AdminPermission.AUDIT_LOG_VIEW,
      AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE,
    ].map((permission) => ({
      adminUserId: admin.id,
      permission,
      mode: PermissionMode.ALLOW,
      reason: "Attendance restore isolation/config fixture",
    })),
  });
  await prisma.adminSession.create({
    data: {
      adminUserId: admin.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await prisma.systemSetting.createMany({
    data: Object.entries(RESTORED_EXTERNAL_CONFIG_SENTINELS).map(([key, value]) => ({
      key,
      value,
      updatedById: admin.id,
    })),
  });

  const [staff, customer] = await Promise.all([
    prisma.member.create({
      data: {
        code: `STAFF-${suffix}`,
        firstName: `Restore Staff ${suffix}`,
        lastName: "Visible",
        memberType: MemberType.STAFF,
        status: MemberStatus.ACTIVE,
        isStaff: true,
        staffProfile: { create: { position: "Operator" } },
      },
    }),
    prisma.member.create({
      data: {
        code: `CUSTOMER-${suffix}`,
        firstName: `Restore Customer ${suffix}`,
        lastName: "Hidden",
        memberType: MemberType.CUSTOMER,
        status: MemberStatus.ACTIVE,
        isStaff: false,
        customerProfile: { create: { totalPaidAmount: 5500, totalDebtAmount: 900 } },
      },
    }),
  ]);

  const plan = await prisma.membershipPlan.create({
    data: {
      name: `Restore Plan ${suffix}`,
      slug: `restore-plan-${suffix}`,
      durationDays: 30,
      durationValue: 1,
      price: 5500,
      basePrice: 5500,
    },
  });
  const membership = await prisma.membership.create({
    data: {
      memberId: customer.id,
      planId: plan.id,
      startDate: day,
      endDate: new Date(day.getTime() + 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(day.getTime() + 30 * 24 * 60 * 60 * 1000),
      status: MembershipStatus.ACTIVE,
      basePrice: 5500,
      totalDue: 5500,
      totalPaid: 5500,
      activatedAt: day,
      createdByAdminId: admin.id,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      memberId: customer.id,
      membershipId: membership.id,
      amount: 5500,
      method: PaymentMethod.CASH,
      status: PaymentStatus.PAID,
      paidAt: day,
      reference: `PAYMENT-${suffix}`,
      recordedByAdminId: admin.id,
    },
  });
  const category = await prisma.expenseCategory.create({
    data: { name: `Restore Expense ${suffix}`, slug: `restore-expense-${suffix}` },
  });
  const expense = await prisma.expense.create({
    data: {
      categoryId: category.id,
      amount: 700,
      status: ExpenseStatus.POSTED,
      occurredAt: day,
      reference: `EXPENSE-${suffix}`,
    },
  });

  const device = await prisma.device.create({
    data: {
      name: `Restore Device ${suffix}`,
      type: DeviceType.FINGERPRINT,
      connectionType: DeviceConnectionType.ZKTECO_PULL_SDK,
      enabled: false,
      status: DeviceStatus.OFFLINE,
      config: { ip: "127.0.0.1", port: 4370, eventMode: "PULL" },
    },
  });
  const numericSuffix = Number.parseInt(suffix.slice(-6), 16) % 100_000_000;
  const staffExternalId = 1_600_000_000 + numericSuffix * 2;
  const customerExternalId = staffExternalId + 1;
  const syncedAt = new Date();
  const [staffDeviceUser, customerDeviceUser] = await Promise.all([
    prisma.deviceUser.create({
      data: { externalId: staffExternalId, deviceId: device.id, memberId: staff.id, lastSyncedAt: syncedAt },
    }),
    prisma.deviceUser.create({
      data: { externalId: customerExternalId, deviceId: device.id, memberId: customer.id, lastSyncedAt: syncedAt },
    }),
  ]);

  const todayCustomerPunch = new Date();
  todayCustomerPunch.setHours(10, 30, 0, 0);
  await prisma.attendanceLog.createMany({
    data: [
      {
        memberId: staff.id,
        deviceUserId: staffDeviceUser.id,
        entryType: AttendanceType.IN,
        recordedAt: atTime(day, 8, 55),
        source: AttendanceSource.DEVICE,
        dedupeKey: `restore-staff-${suffix}`,
      },
      {
        memberId: customer.id,
        deviceUserId: customerDeviceUser.id,
        entryType: AttendanceType.IN,
        recordedAt: atTime(day, 9, 5),
        source: AttendanceSource.DEVICE,
        dedupeKey: `restore-customer-${suffix}`,
      },
      {
        memberId: customer.id,
        deviceUserId: customerDeviceUser.id,
        entryType: AttendanceType.IN,
        recordedAt: todayCustomerPunch,
        source: AttendanceSource.DEVICE,
        dedupeKey: `restore-customer-dashboard-${suffix}`,
      },
    ],
  });

  await prisma.inboxItem.create({
    data: {
      category: "ALERT",
      type: "MEMBERSHIP_EXPIRING",
      severity: "WARNING",
      title: `Hidden customer inbox ${suffix}`,
      memberId: customer.id,
      entityType: "MEMBER",
      entityId: customer.id,
    },
  });

  const auditBase = { actorType: AuditActor.ADMIN, actorId: admin.id, actorRole: AdminRole.GYM_OWNER } as const;
  const [staffAudit, customerAudit, paymentAudit, expenseAudit] = await Promise.all([
    prisma.auditLog.create({
      data: {
        ...auditBase,
        action: "member.created",
        targetType: "Member",
        targetId: staff.id,
        afterData: { memberType: "STAFF", isStaff: true, code: staff.code },
      },
    }),
    prisma.auditLog.create({
      data: {
        ...auditBase,
        action: "member.created",
        targetType: "Member",
        targetId: customer.id,
        afterData: { memberType: "CUSTOMER", isStaff: false, code: customer.code },
      },
    }),
    prisma.auditLog.create({
      data: {
        ...auditBase,
        action: "membership.payment.recorded",
        targetType: "Payment",
        targetId: payment.id,
        metadata: { memberId: customer.id, amount: 5500 },
      },
    }),
    prisma.auditLog.create({
      data: {
        ...auditBase,
        action: "expense.created",
        targetType: "Expense",
        targetId: expense.id,
        metadata: { amount: 700 },
      },
    }),
  ]);

  console.log(JSON.stringify({
    phase: "seeded",
    marker: suffix,
    staffId: staff.id,
    customerId: customer.id,
    staffAuditId: staffAudit.id,
    customerAuditId: customerAudit.id,
    paymentAuditId: paymentAudit.id,
    expenseAuditId: expenseAudit.id,
  }));
}

async function readFixture(): Promise<Fixture> {
  const suffix = marker();
  const [staff, customer, device, staffAudit, customerAudit, paymentAudit, expenseAudit] = await Promise.all([
    prisma.member.findUniqueOrThrow({ where: { code: `STAFF-${suffix}` } }),
    prisma.member.findUniqueOrThrow({ where: { code: `CUSTOMER-${suffix}` } }),
    prisma.device.findFirstOrThrow({ where: { name: `Restore Device ${suffix}` } }),
    prisma.auditLog.findFirstOrThrow({ where: { action: "member.created", afterData: { path: ["code"], equals: `STAFF-${suffix}` } } }),
    prisma.auditLog.findFirstOrThrow({ where: { action: "member.created", afterData: { path: ["code"], equals: `CUSTOMER-${suffix}` } } }),
    prisma.auditLog.findFirstOrThrow({ where: { action: "membership.payment.recorded" } }),
    prisma.auditLog.findFirstOrThrow({ where: { action: "expense.created" } }),
  ]);
  const [staffDeviceUser, customerDeviceUser] = await Promise.all([
    prisma.deviceUser.findUniqueOrThrow({ where: { memberId: staff.id } }),
    prisma.deviceUser.findUniqueOrThrow({ where: { memberId: customer.id } }),
  ]);
  const dayRow = await prisma.attendanceLog.findFirstOrThrow({
    where: { memberId: staff.id, dedupeKey: `restore-staff-${suffix}` },
  });
  return {
    marker: suffix,
    token: sessionToken(),
    staffId: staff.id,
    customerId: customer.id,
    deviceId: device.id,
    staffExternalId: staffDeviceUser.externalId,
    customerExternalId: customerDeviceUser.externalId,
    staffAuditId: staffAudit.id,
    customerAuditId: customerAudit.id,
    paymentAuditId: paymentAudit.id,
    expenseAuditId: expenseAudit.id,
    day: dayRow.recordedAt,
  };
}

async function listen() {
  const server = createServer(createApp());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

async function closeServer(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function request(baseUrl: string, fixture: Fixture, pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(fixture.token)}`);
  headers.set("user-agent", TEST_USER_AGENT);
  if (init.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${pathname}`, { ...init, headers });
}

async function expectJson(baseUrl: string, fixture: Fixture, pathname: string, status = 200, init: RequestInit = {}) {
  const response = await request(baseUrl, fixture, pathname, init);
  const text = await response.text();
  assert.equal(response.status, status, `${pathname}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) as unknown : null;
}

function assertNoCustomerPayload(payload: unknown, fixture: Fixture, label: string) {
  const serialized = JSON.stringify(payload);
  for (const forbidden of [fixture.customerId, `CUSTOMER-${fixture.marker}`, `Restore Customer ${fixture.marker}`]) {
    assert.ok(!serialized.includes(forbidden), `${label} exposed restored Customer data: ${forbidden}`);
  }
}

async function verifyRoutesAndData(baseUrl: string, fixture: Fixture) {
  const identityResponse = await fetch(`${baseUrl}/api`);
  const identity = await identityResponse.json() as { edition?: string };
  assert.equal(identityResponse.status, 200);
  assert.equal(identity.edition, "ATTENDANCE", "Restore must not change the external Edition config");

  const hiddenRoutes = [
    "/api/v1/members",
    "/api/v1/membership-plans",
    "/api/v1/payroll/summary",
    "/api/v1/expenses",
    "/api/v1/membership-report",
    "/api/v1/dashboard/customers",
    "/api/v1/dashboard/financial",
    "/api/v1/reports/customer-activity",
    "/api/v1/reports/debt-aging",
    "/api/v1/reports/renewal-forecast",
    "/api/v1/reports/payroll-variance",
    "/api/v1/reports/cashflow",
    "/api/v1/inbox",
  ];
  for (const pathname of hiddenRoutes) {
    const response = await request(baseUrl, fixture, pathname);
    assert.equal(response.status, 404, `${pathname} must stay unavailable after FULL restore`);
  }

  const day = dateKey(fixture.day);
  const employeePayload = await expectJson(baseUrl, fixture, `/api/v1/employees?search=${encodeURIComponent(fixture.marker)}`);
  assert.match(JSON.stringify(employeePayload), new RegExp(`STAFF-${fixture.marker}`, "u"));
  assertNoCustomerPayload(employeePayload, fixture, "Employees");

  const attendancePayload = await expectJson(baseUrl, fixture, `/api/v1/attendance?search=${encodeURIComponent(fixture.marker)}&page=1&pageSize=100`);
  assert.ok(JSON.stringify(attendancePayload).includes(fixture.staffId), "Entry Logs must retain restored Staff attendance");
  assertNoCustomerPayload(attendancePayload, fixture, "Entry Logs");
  const dailyPayload = await expectJson(baseUrl, fixture, `/api/v1/attendance/daily?date=${day}&search=${encodeURIComponent(fixture.marker)}`);
  assert.ok(JSON.stringify(dailyPayload).includes(fixture.staffId), "Daily Attendance must retain restored Staff attendance");
  assertNoCustomerPayload(dailyPayload, fixture, "Daily Attendance");
  const dashboardPayload = await expectJson(baseUrl, fixture, "/api/v1/dashboard/summary") as {
    employees?: { active?: number };
    punches?: { total?: number };
  };
  assert.equal(dashboardPayload.employees?.active, 1, "Dashboard active employee count must ignore restored Customers");
  assert.equal(dashboardPayload.punches?.total, 0, "Dashboard punch count must ignore today's restored Customer punch");
  assertNoCustomerPayload(dashboardPayload, fixture, "Dashboard");
  const reportDailyPayload = await expectJson(baseUrl, fixture, `/api/v1/reports/attendance/daily?from=${day}&to=${day}&search=${encodeURIComponent(fixture.marker)}&page=1&pageSize=100`) as {
    items?: Array<{ presentCount?: number }>;
  };
  assert.equal(reportDailyPayload.items?.[0]?.presentCount, 1, "Attendance Report daily totals must count Staff but not Customer");
  assertNoCustomerPayload(reportDailyPayload, fixture, "Attendance Report daily");
  const reportMembersPayload = await expectJson(baseUrl, fixture, `/api/v1/reports/attendance/members?from=${day}&to=${day}&search=${encodeURIComponent(fixture.marker)}&page=1&pageSize=100`);
  assert.ok(JSON.stringify(reportMembersPayload).includes(fixture.staffId), "Attendance Report must retain restored Staff attendance");
  assertNoCustomerPayload(reportMembersPayload, fixture, "Attendance Report members");

  const auditPayload = await expectJson(baseUrl, fixture, "/api/v1/audit-logs?page=1&pageSize=100");
  const auditText = JSON.stringify(auditPayload);
  assert.ok(auditText.includes(fixture.staffAuditId), "Attendance-safe Staff audit row is missing");
  for (const forbiddenAuditId of [fixture.customerAuditId, fixture.paymentAuditId, fixture.expenseAuditId]) {
    assert.ok(!auditText.includes(forbiddenAuditId), `Audit list exposed restored FULL row ${forbiddenAuditId}`);
  }
  assertNoCustomerPayload(auditPayload, fixture, "Audit list");
  for (const hiddenAuditId of [fixture.customerAuditId, fixture.paymentAuditId, fixture.expenseAuditId]) {
    await expectJson(baseUrl, fixture, `/api/v1/audit-logs/${hiddenAuditId}`, 404);
  }
  await expectJson(baseUrl, fixture, `/api/v1/audit-logs/${fixture.staffAuditId}`);
}

async function verifyDeviceIsolation(fixture: Fixture) {
  const customerAttendanceBefore = await prisma.attendanceLog.count({ where: { memberId: fixture.customerId } });
  const customerEventTime = new Date(fixture.day.getTime() + 13 * 60 * 60 * 1000);
  const customerResult = await processDeviceEvents([{
    deviceId: fixture.deviceId,
    externalUserId: String(fixture.customerExternalId),
    timestamp: customerEventTime,
    eventType: "CHECK_IN",
    recordId: 540001,
    raw: { source: "PHASE_5_4_RESTORE", marker: fixture.marker, kind: "customer" },
  }], { scope: getDeviceDataScope(env.APP_EDITION), stopOnError: true });
  assert.equal(customerResult.processedCount, 0, "Restored Customer-linked device user must not create Attendance");
  assert.equal(await prisma.attendanceLog.count({ where: { memberId: fixture.customerId } }), customerAttendanceBefore);
  assert.equal(await prisma.accessViolation.count({ where: { memberId: fixture.customerId } }), 0);
  assert.equal(await prisma.doorEvent.count({ where: { memberId: fixture.customerId } }), 0);
  assert.equal(await prisma.inboxItem.count({ where: { memberId: fixture.customerId } }), 1);

  const staffAttendanceBefore = await prisma.attendanceLog.count({ where: { memberId: fixture.staffId } });
  const staffResult = await processDeviceEvents([{
    deviceId: fixture.deviceId,
    externalUserId: String(fixture.staffExternalId),
    timestamp: new Date(fixture.day.getTime() + 14 * 60 * 60 * 1000),
    eventType: "CHECK_OUT",
    recordId: 540002,
    raw: { source: "PHASE_5_4_RESTORE", marker: fixture.marker, kind: "staff" },
  }], { scope: getDeviceDataScope(env.APP_EDITION), stopOnError: true });
  assert.equal(staffResult.processedCount, 1, "Restored Staff-linked device user must keep working");
  assert.equal(await prisma.attendanceLog.count({ where: { memberId: fixture.staffId } }), staffAttendanceBefore + 1);
}

async function verifyBackupOperation(baseUrl: string, fixture: Fixture) {
  await expectJson(baseUrl, fixture, "/api/v1/backups/settings");
  await expectJson(baseUrl, fixture, "/api/v1/backups?page=1&limit=20");
  const started = await expectJson(baseUrl, fixture, "/api/v1/backups/manual", 202, {
    method: "POST",
    body: JSON.stringify({ notes: `Attendance restore test ${fixture.marker}` }),
  }) as { id?: string };
  assert.ok(started.id, "Manual backup did not return a job id");
  const deadline = Date.now() + 2 * 60 * 1000;
  while (Date.now() < deadline) {
    const job = await expectJson(baseUrl, fixture, `/api/v1/backups/jobs/${started.id}`) as { status?: string; errorMessage?: string };
    if (job.status === "COMPLETED") return;
    assert.notEqual(job.status, "FAILED", job.errorMessage ?? "Restored Attendance backup failed");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail("Timed out waiting for backup operation on restored Attendance database");
}

async function verifyRestoredAttendanceDatabase() {
  assert.equal(env.APP_EDITION, "ATTENDANCE", "The restored target must run under ATTENDANCE Edition");
  assert.equal(env.APP_TIMEZONE, "Asia/Kabul", "Restore must not replace the external application timezone");
  assert.equal(process.env["TZ"], "Asia/Kabul", "APP_TIMEZONE must override the restored process host TZ");
  assert.equal(env.ATTENDANCE_POLICY, "TIME_CLOCK", "Restore must not replace the external Attendance policy");
  assert.equal(env.ATTENDANCE_AUTO_CHECKOUT_ENABLED, "0", "Restore must not enable reserved auto-checkout");

  const restoredConfigSentinels = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(RESTORED_EXTERNAL_CONFIG_SENTINELS) } },
    orderBy: { key: "asc" },
    select: { key: true, value: true },
  });
  assert.deepEqual(
    Object.fromEntries(restoredConfigSentinels.map((row) => [row.key, row.value])),
    Object.fromEntries(Object.entries(RESTORED_EXTERNAL_CONFIG_SENTINELS).sort(([left], [right]) => left.localeCompare(right))),
    "The FULL dump must retain sentinel DB rows so the external-config override assertion is meaningful"
  );
  const kabulBoundary = new Date("2026-01-15T19:45:00.000Z");
  assert.deepEqual(
    [kabulBoundary.getFullYear(), kabulBoundary.getMonth() + 1, kabulBoundary.getDate(), kabulBoundary.getHours(), kabulBoundary.getMinutes()],
    [2026, 1, 16, 0, 15],
    "Server local Date boundaries must follow external Asia/Kabul time"
  );
  const fixture = await readFixture();
  const retainedCounts = await Promise.all([
    prisma.member.count({ where: { id: fixture.customerId } }),
    prisma.membership.count({ where: { memberId: fixture.customerId } }),
    prisma.payment.count({ where: { memberId: fixture.customerId } }),
    prisma.expense.count(),
  ]);
  assert.deepEqual(retainedCounts, [1, 1, 1, 1], "FULL-only rows must remain physically restorable for future upgrade");

  const { server, baseUrl } = await listen();
  try {
    await verifyRoutesAndData(baseUrl, fixture);
    await verifyDeviceIsolation(fixture);
    await verifyBackupOperation(baseUrl, fixture);
  } finally {
    await closeServer(server);
  }
  console.log("PASS - FULL backup restored under ATTENDANCE keeps external config, Customer/Finance isolation, Staff, and Backup operations intact.");
}

async function verifyRestoredFullDatabase() {
  assert.equal(env.APP_EDITION, "FULL", "The restored FULL target must keep the external FULL Edition");
  assert.equal(env.APP_TIMEZONE, "Asia/Kabul", "FULL restore must respect the target external timezone");
  assert.equal(process.env["TZ"], "Asia/Kabul", "Target APP_TIMEZONE must override the host timezone");
  assert.equal(env.ATTENDANCE_POLICY, "TIME_CLOCK", "FULL restore must respect the target external policy");
  assert.equal(env.ATTENDANCE_AUTO_CHECKOUT_ENABLED, "0", "FULL restore must respect target auto-checkout config");

  const fixture = await readFixture();
  const retainedCounts = await Promise.all([
    prisma.member.count({ where: { id: fixture.staffId } }),
    prisma.member.count({ where: { id: fixture.customerId } }),
    prisma.membership.count({ where: { memberId: fixture.customerId } }),
    prisma.payment.count({ where: { memberId: fixture.customerId } }),
    prisma.expense.count(),
    prisma.inboxItem.count({ where: { memberId: fixture.customerId } }),
  ]);
  assert.deepEqual(retainedCounts, [1, 1, 1, 1, 1, 1], "FULL operational rows were not preserved by restore");

  const { server, baseUrl } = await listen();
  try {
    const identityResponse = await fetch(`${baseUrl}/api`);
    const identity = await identityResponse.json() as { edition?: string };
    assert.equal(identityResponse.status, 200);
    assert.equal(identity.edition, "FULL");

    const memberPayload = await expectJson(
      baseUrl,
      fixture,
      `/api/v1/members?search=${encodeURIComponent(fixture.marker)}&skip=0&take=100`
    );
    const memberText = JSON.stringify(memberPayload);
    assert.ok(memberText.includes(fixture.staffId), "Restored FULL Members omitted the Staff fixture");
    assert.ok(memberText.includes(fixture.customerId), "Restored FULL Members omitted the Customer fixture");

    const membershipPayload = await expectJson(baseUrl, fixture, `/api/v1/members/${fixture.customerId}/memberships`);
    assert.ok(JSON.stringify(membershipPayload).includes(fixture.customerId), "Restored FULL Membership workflow lost Customer linkage");
    const paymentPayload = await expectJson(baseUrl, fixture, `/api/v1/members/${fixture.customerId}/payments`);
    assert.ok(JSON.stringify(paymentPayload).includes("5500"), "Restored FULL Payment workflow lost the payment fixture");

    const now = new Date();
    const fullRouteSmokes = [
      "/api/v1/membership-plans",
      "/api/v1/expenses?page=1&pageSize=100",
      `/api/v1/payroll/report?year=${now.getFullYear()}&month=${now.getMonth() + 1}&skip=0&take=20`,
      `/api/v1/membership-report?search=${encodeURIComponent(fixture.marker)}&skip=0&take=100`,
      "/api/v1/reports/cashflow",
      "/api/v1/inbox?page=1&pageSize=100",
      "/api/v1/sounds/settings",
    ];
    for (const pathname of fullRouteSmokes) {
      await expectJson(baseUrl, fixture, pathname);
    }

    const auditPayload = await expectJson(baseUrl, fixture, "/api/v1/audit-logs?page=1&pageSize=100");
    const auditText = JSON.stringify(auditPayload);
    for (const auditId of [fixture.staffAuditId, fixture.customerAuditId, fixture.paymentAuditId, fixture.expenseAuditId]) {
      assert.ok(auditText.includes(auditId), `Restored FULL Audit omitted ${auditId}`);
      await expectJson(baseUrl, fixture, `/api/v1/audit-logs/${auditId}`);
    }

    await verifyBackupOperation(baseUrl, fixture);
  } finally {
    await closeServer(server);
  }
  console.log("PASS - FULL backup restored under FULL preserves external config and Customer/Membership/Payment/Payroll/Expense/Report/Audit/Backup access.");
}

async function main() {
  assertSafeEnvironment();
  const mode = process.env["ATTENDANCE_RESTORE_TEST_MODE"];
  if (mode === "seed") await seedFullDatabase();
  else if (mode === "assert") await verifyRestoredAttendanceDatabase();
  else if (mode === "assert-full") await verifyRestoredFullDatabase();
  else throw new Error("ATTENDANCE_RESTORE_TEST_MODE must be seed, assert, or assert-full");
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
