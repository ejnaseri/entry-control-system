import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AttendanceSource,
  AttendanceType,
  AuditActor,
  MemberStatus,
  MemberType,
  OvertimeRateType,
  PermissionMode,
  PayrollCalcMode,
  PayrollPolicyScope,
  PayrollStatus,
  SalaryType,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { getCashflowReport } from "../reports-cashflow/reports-cashflow.service";
import { payrollRouter } from "./payroll.router";
import {
  createPayrollPayment,
  getPayrollOutstanding,
  getPayrollReport,
  getPayrollSummary,
} from "./payroll.service";

type Fixture = {
  suffix: string;
  memberId: string;
  shiftId: string;
  overtimePolicyId: string;
  payrollPolicyId: string;
  code: string;
  year: number;
  month: number;
  scheduledDates: Date[];
  paymentDate: Date;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
};

const BASE_AMOUNT = 30_000;
const SHIFT_MINUTES = 8 * 60;
const OVERTIME_RATE_PER_HOUR = 200;
const MAX_OVERTIME_HOURS_PER_DAY = 1;

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Payroll database integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["PAYROLL_DB_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Payroll database integration tests refuse non-local database host: ${hostname}`);
  }
}

function allocateFixture(): Fixture {
  const suffix = randomUUID();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = periodStart.getFullYear();
  const month = periodStart.getMonth() + 1;
  const weekday = toStoredWeekday(periodStart.getDay());
  const scheduledDates: Date[] = [];
  const cursor = new Date(periodStart);
  while (cursor.getMonth() === periodStart.getMonth()) {
    if (toStoredWeekday(cursor.getDay()) === weekday) {
      scheduledDates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  assert.ok(scheduledDates.length >= 4, "Fixture month did not contain four scheduled workdays");

  return {
    suffix,
    memberId: `c${suffix.replaceAll("-", "")}`,
    shiftId: `it-payroll-shift-${suffix}`,
    overtimePolicyId: `it-payroll-overtime-${suffix}`,
    payrollPolicyId: `it-payroll-policy-${suffix}`,
    code: `IT-PAYROLL-${suffix}`,
    year,
    month,
    scheduledDates,
    paymentDate: atTime(new Date(year, month - 1, 15), 12, 0),
    allowedAdminId: `it-payroll-admin-allowed-${suffix}`,
    allowedSessionId: `it-payroll-session-allowed-${suffix}`,
    allowedToken: `it-payroll-token-allowed-${suffix}`,
    deniedAdminId: `it-payroll-admin-denied-${suffix}`,
    deniedSessionId: `it-payroll-session-denied-${suffix}`,
    deniedToken: `it-payroll-token-denied-${suffix}`,
  };
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/payroll", requirePermission(AdminPermission.PAYROLL_MANAGE), payrollRouter);
  app.use(errorHandler);
  return app;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createFixtureRecords(fixture: Fixture) {
  const memberCreatedAt = new Date(fixture.year, fixture.month - 3, 1);
  const weekday = toStoredWeekday(fixture.scheduledDates[0]!.getDay());
  const attendanceRows: Array<{
    memberId: string;
    recordedAt: Date;
    entryType: AttendanceType;
    source: AttendanceSource;
    isAuthorized: boolean;
  }> = [];

  // Day 1: two actual overtime hours. Payroll must pay only the configured one-hour daily maximum.
  attendanceRows.push(
    buildAttendance(fixture.memberId, fixture.scheduledDates[0]!, 9, 0, AttendanceType.IN),
    buildAttendance(fixture.memberId, fixture.scheduledDates[0]!, 19, 0, AttendanceType.OUT)
  );
  // Day 2: 30 minutes late and 60 minutes early leave.
  attendanceRows.push(
    buildAttendance(fixture.memberId, fixture.scheduledDates[1]!, 9, 30, AttendanceType.IN),
    buildAttendance(fixture.memberId, fixture.scheduledDates[1]!, 16, 0, AttendanceType.OUT)
  );
  // Day 3 is an unexcused absence; day 4 is justified. Any remaining scheduled days are normal.
  fixture.scheduledDates.slice(4).forEach((date) => {
    attendanceRows.push(
      buildAttendance(fixture.memberId, date, 9, 0, AttendanceType.IN),
      buildAttendance(fixture.memberId, date, 17, 0, AttendanceType.OUT)
    );
  });

  await prisma.$transaction(async (tx) => {
    await tx.adminUser.createMany({
      data: [
        {
          id: fixture.allowedAdminId,
          username: `it-payroll-allowed-${fixture.suffix}`,
          passwordHash: "not-used-by-payroll-integration-test",
          role: AdminRole.STAFF,
        },
        {
          id: fixture.deniedAdminId,
          username: `it-payroll-denied-${fixture.suffix}`,
          passwordHash: "not-used-by-payroll-integration-test",
          role: AdminRole.STAFF,
        },
      ],
    });
    await tx.adminUserPermission.createMany({
      data: [
        {
          adminUserId: fixture.allowedAdminId,
          permission: AdminPermission.PAYROLL_MANAGE,
          mode: PermissionMode.ALLOW,
          reason: "Payroll audit integration fixture",
        },
        {
          adminUserId: fixture.deniedAdminId,
          permission: AdminPermission.PAYROLL_MANAGE,
          mode: PermissionMode.DENY,
          reason: "Payroll audit integration fixture",
        },
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await tx.adminSession.createMany({
      data: [
        {
          id: fixture.allowedSessionId,
          adminUserId: fixture.allowedAdminId,
          tokenHash: hashSessionToken(fixture.allowedToken),
          expiresAt,
        },
        {
          id: fixture.deniedSessionId,
          adminUserId: fixture.deniedAdminId,
          tokenHash: hashSessionToken(fixture.deniedToken),
          expiresAt,
        },
      ],
    });
    await tx.member.create({
      data: {
        id: fixture.memberId,
        code: fixture.code,
        firstName: "Payroll",
        lastName: "Integration Fixture",
        memberType: MemberType.STAFF,
        status: MemberStatus.ACTIVE,
        isStaff: true,
        createdAt: memberCreatedAt,
      },
    });
    await tx.memberShift.create({
      data: {
        id: fixture.shiftId,
        memberId: fixture.memberId,
        shiftName: "Payroll integration shift",
        shiftStart: "09:00",
        shiftEnd: "17:00",
        weekdays: [weekday],
        graceMinutes: 0,
        earlyAccessMinutes: 15,
        salaryType: SalaryType.MONTHLY,
        salaryAmount: BASE_AMOUNT,
        isActive: true,
      },
    });
    await tx.memberOvertimePolicy.create({
      data: {
        id: fixture.overtimePolicyId,
        memberId: fixture.memberId,
        allowOvertime: true,
        overtimeRateType: OvertimeRateType.PER_HOUR,
        overtimeAmount: OVERTIME_RATE_PER_HOUR,
        maxOvertimePerDay: MAX_OVERTIME_HOURS_PER_DAY,
      },
    });
    await tx.payrollPolicy.create({
      data: {
        id: fixture.payrollPolicyId,
        scope: PayrollPolicyScope.MEMBER,
        memberId: fixture.memberId,
        allowAttendanceDeductions: true,
        absenceMode: PayrollCalcMode.PROPORTIONAL,
        lateMode: PayrollCalcMode.PROPORTIONAL,
        lateIgnoreMinutes: 5,
        earlyLeaveMode: PayrollCalcMode.PROPORTIONAL,
        earlyLeaveIgnoreMinutes: 5,
      },
    });
    await tx.attendanceLog.createMany({ data: attendanceRows });
    await tx.attendanceJustification.create({
      data: {
        memberId: fixture.memberId,
        date: startOfDay(fixture.scheduledDates[3]!),
        reason: "Payroll integration justified absence",
      },
    });
  });
}

async function testPayrollCalculationPersistenceAndCashflow(fixture: Fixture, baseUrl: string) {
  const cashflowQuery = {
    from: formatDateKey(fixture.paymentDate),
    to: formatDateKey(fixture.paymentDate),
    groupBy: "day" as const,
    includePayroll: true,
  };
  const cashflowBefore = await getCashflowReport(cashflowQuery);
  const summary = await getPayrollSummary({
    memberId: fixture.memberId,
    year: fixture.year,
    month: fixture.month,
  });

  const expectedMinutes = fixture.scheduledDates.length * SHIFT_MINUTES;
  const expectedDeductions = roundCurrency((BASE_AMOUNT / expectedMinutes) * (SHIFT_MINUTES + 30 + 60));
  const expectedAdditions = OVERTIME_RATE_PER_HOUR * MAX_OVERTIME_HOURS_PER_DAY;
  const expectedTotalDue = roundCurrency(BASE_AMOUNT - expectedDeductions + expectedAdditions);

  assert.equal(summary.baseAmount, BASE_AMOUNT);
  assert.equal(summary.status, PayrollStatus.UNPAID);
  assert.equal(summary.paidAmount, 0);
  assert.equal(summary.suggestion?.expectedShifts, fixture.scheduledDates.length);
  assert.equal(summary.suggestion?.expectedMinutes, expectedMinutes);
  assert.equal(summary.suggestion?.absentShifts, 1);
  assert.equal(summary.suggestion?.absentDays, 1);
  assert.equal(summary.suggestion?.justifiedDays, 1);
  assert.equal(summary.suggestion?.lateMinutes, 30);
  assert.equal(summary.suggestion?.earlyLeaveMinutes, 60);
  assert.equal(summary.suggestion?.overtimeMinutes, 60, "Daily overtime maximum was not applied");
  assert.equal(summary.suggestion?.deductions, expectedDeductions);
  assert.equal(summary.suggestion?.additions, expectedAdditions);
  assert.equal(summary.totalDue, expectedTotalDue);
  assert.equal(summary.balance, expectedTotalDue);
  console.log("✓ realistic attendance produces capped overtime and proportional deductions");

  const outstandingBeforePayment = await getPayrollOutstanding({
    year: fixture.year,
    month: fixture.month,
    take: 50,
    search: fixture.code,
  });
  assert.equal(outstandingBeforePayment.total, 1);
  assert.equal(outstandingBeforePayment.items[0]?.source, "ESTIMATE");
  assert.equal(outstandingBeforePayment.items[0]?.totalDue, expectedTotalDue);

  const firstAmount = roundCurrency(expectedTotalDue * 0.4);
  const remainingAmount = roundCurrency(expectedTotalDue - firstAmount);
  const paymentUrl = `${baseUrl}/api/v1/payroll/payments`;
  const paymentCountBeforeDenied = await prisma.payrollPayment.count({
    where: { payrollPeriod: { memberId: fixture.memberId } },
  });
  const unauthenticated = await fetch(paymentUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      memberId: fixture.memberId,
      year: fixture.year,
      month: fixture.month,
      amount: firstAmount,
    }),
  });
  assert.equal(unauthenticated.status, 401);

  const denied = await fetch(paymentUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify({
      memberId: fixture.memberId,
      year: fixture.year,
      month: fixture.month,
      amount: firstAmount,
    }),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.PAYROLL_MANAGE
  );
  assert.equal(
    await prisma.payrollPayment.count({ where: { payrollPeriod: { memberId: fixture.memberId } } }),
    paymentCountBeforeDenied
  );
  assert.equal(
    await prisma.auditLog.count({ where: { actorId: fixture.deniedAdminId, action: "payroll.payment.recorded" } }),
    0
  );

  const partialNotes = `Payroll integration partial ${fixture.suffix}`;
  const partialResponse = await fetch(paymentUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      memberId: fixture.memberId,
      year: fixture.year,
      month: fixture.month,
      amount: firstAmount,
      paidAt: fixture.paymentDate.toISOString(),
      notes: partialNotes,
    }),
  });
  assert.equal(partialResponse.status, 201);
  const partial = await partialResponse.json() as Awaited<ReturnType<typeof getPayrollSummary>>;
  assert.equal(partial.status, PayrollStatus.PARTIAL);
  assert.equal(partial.paidAmount, firstAmount);
  assert.equal(partial.balance, remainingAmount);
  assert.equal(partial.payments.length, 1);

  const finalNotes = `Payroll integration final ${fixture.suffix}`;
  const paidResponse = await fetch(paymentUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      memberId: fixture.memberId,
      year: fixture.year,
      month: fixture.month,
      amount: remainingAmount,
      paidAt: fixture.paymentDate.toISOString(),
      notes: finalNotes,
    }),
  });
  assert.equal(paidResponse.status, 201);
  const paid = await paidResponse.json() as Awaited<ReturnType<typeof getPayrollSummary>>;
  assert.equal(paid.status, PayrollStatus.PAID);
  assert.equal(paid.paidAmount, expectedTotalDue);
  assert.equal(paid.balance, 0);
  assert.equal(paid.payments.length, 2);

  const persistedPeriod = await prisma.payrollPeriod.findUnique({
    where: { memberId_year_month: { memberId: fixture.memberId, year: fixture.year, month: fixture.month } },
    include: { payments: true },
  });
  assert.ok(persistedPeriod);
  assert.equal(Number(persistedPeriod.baseAmount), BASE_AMOUNT);
  assert.equal(Number(persistedPeriod.adjustments), roundCurrency(expectedAdditions - expectedDeductions));
  assert.equal(Number(persistedPeriod.totalDue), expectedTotalDue);
  assert.equal(persistedPeriod.status, PayrollStatus.PAID);
  assert.equal(persistedPeriod.payments.length, 2);
  persistedPeriod.payments.forEach((payment) => {
    const breakdown = payment.breakdown as { overtimeMinutes?: number; additions?: number } | null;
    assert.equal(breakdown?.overtimeMinutes, 60);
    assert.equal(breakdown?.additions, expectedAdditions);
    assert.equal(payment.recordedByAdminId, fixture.allowedAdminId);
  });

  const audits = await prisma.auditLog.findMany({
    where: {
      actorId: fixture.allowedAdminId,
      action: "payroll.payment.recorded",
      targetType: "PayrollPayment",
    },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(audits.length, 2);
  const partialAudit = audits[0]!;
  const finalAudit = audits[1]!;
  assert.equal(partialAudit.targetId, partial.payments[0]?.id);
  assert.equal(finalAudit.targetId, paid.payments[0]?.id);
  assertAuditAttribution(partialAudit, fixture);
  assertAuditAttribution(finalAudit, fixture);

  const partialBefore = asJsonObject(partialAudit.beforeData);
  const partialAfter = asJsonObject(partialAudit.afterData);
  const partialMetadata = asJsonObject(partialAudit.metadata);
  assert.equal(partialBefore["periodExisted"], false);
  assert.equal(partialBefore["paidAmount"], 0);
  assert.equal(partialBefore["balance"], expectedTotalDue);
  assert.equal(partialBefore["status"], PayrollStatus.UNPAID);
  assert.equal(partialAfter["paidAmount"], firstAmount);
  assert.equal(partialAfter["balance"], remainingAmount);
  assert.equal(partialAfter["status"], PayrollStatus.PARTIAL);
  assert.equal(partialMetadata["amount"], firstAmount);
  assert.equal(partialMetadata["method"], "CASH");

  const finalBefore = asJsonObject(finalAudit.beforeData);
  const finalAfter = asJsonObject(finalAudit.afterData);
  const finalMetadata = asJsonObject(finalAudit.metadata);
  assert.equal(finalBefore["periodExisted"], true);
  assert.equal(finalBefore["paidAmount"], firstAmount);
  assert.equal(finalBefore["balance"], remainingAmount);
  assert.equal(finalBefore["status"], PayrollStatus.PARTIAL);
  assert.equal(finalAfter["paidAmount"], expectedTotalDue);
  assert.equal(finalAfter["balance"], 0);
  assert.equal(finalAfter["status"], PayrollStatus.PAID);
  assert.equal(finalMetadata["amount"], remainingAmount);
  assert.equal(JSON.stringify(audits).includes(partialNotes), false);
  assert.equal(JSON.stringify(audits).includes(finalNotes), false);

  const paymentsBeforeFailedAudit = await prisma.payrollPayment.count({
    where: { payrollPeriodId: persistedPeriod.id },
  });
  const summaryBeforeFailedAudit = await getPayrollSummary({
    memberId: fixture.memberId,
    year: fixture.year,
    month: fixture.month,
  });
  await assert.rejects(() =>
    createPayrollPayment(
      {
        memberId: fixture.memberId,
        year: fixture.year,
        month: fixture.month,
        amount: 100,
        paidAt: fixture.paymentDate.toISOString(),
        notes: `Must roll back payroll ${fixture.suffix}`,
      },
      {
        actor: {
          id: fixture.allowedAdminId,
          role: AdminRole.STAFF,
          sessionId: `missing-payroll-session-${fixture.suffix}`,
        },
        meta: { ipAddress: "127.0.0.1", userAgent: "payroll-audit-rollback-test" },
      }
    )
  );
  assert.equal(
    await prisma.payrollPayment.count({ where: { payrollPeriodId: persistedPeriod.id } }),
    paymentsBeforeFailedAudit
  );
  const summaryAfterFailedAudit = await getPayrollSummary({
    memberId: fixture.memberId,
    year: fixture.year,
    month: fixture.month,
  });
  assert.equal(summaryAfterFailedAudit.paidAmount, summaryBeforeFailedAudit.paidAmount);
  assert.equal(summaryAfterFailedAudit.balance, summaryBeforeFailedAudit.balance);
  assert.equal(
    await prisma.auditLog.count({ where: { actorId: fixture.allowedAdminId, action: "payroll.payment.recorded" } }),
    2
  );

  const report = await getPayrollReport({
    year: fixture.year,
    month: fixture.month,
    memberId: fixture.memberId,
    skip: 0,
    take: 50,
  });
  assert.equal(report.total, 2);
  assert.equal(report.summary.totalPaid, expectedTotalDue);
  assert.equal(report.items.every((item) => item.period.status === PayrollStatus.PAID), true);

  const outstandingAfterPayment = await getPayrollOutstanding({
    year: fixture.year,
    month: fixture.month,
    take: 50,
    search: fixture.code,
  });
  assert.equal(outstandingAfterPayment.total, 0);

  const cashflowAfter = await getCashflowReport(cashflowQuery);
  assert.equal(
    roundCurrency(cashflowAfter.summary.payrollOutflow - cashflowBefore.summary.payrollOutflow),
    expectedTotalDue
  );
  assert.equal(
    cashflowAfter.summary.transactionCounts.payrollPayments - cashflowBefore.summary.transactionCounts.payrollPayments,
    2
  );
  const cashflowWithoutPayroll = await getCashflowReport({ ...cashflowQuery, includePayroll: false });
  assert.equal(cashflowWithoutPayroll.summary.payrollOutflow, 0);
  assert.equal(cashflowWithoutPayroll.summary.transactionCounts.payrollPayments, 0);
  console.log("✓ partial/full payments persist and reconcile with outstanding, report, and cashflow");
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.payrollPayment.deleteMany({ where: { payrollPeriod: { memberId: fixture.memberId } } });
  await prisma.payrollPeriod.deleteMany({ where: { memberId: fixture.memberId } });
  await prisma.attendanceLog.deleteMany({ where: { memberId: fixture.memberId } });
  await prisma.attendanceJustification.deleteMany({ where: { memberId: fixture.memberId } });
  await prisma.payrollPolicy.deleteMany({ where: { id: fixture.payrollPolicyId } });
  await prisma.memberOvertimePolicy.deleteMany({ where: { id: fixture.overtimePolicyId } });
  await prisma.memberShift.deleteMany({ where: { id: fixture.shiftId } });
  await prisma.member.deleteMany({ where: { id: fixture.memberId } });
  await prisma.adminUserPermission.deleteMany({
    where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.adminSession.deleteMany({
    where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
  });
  await prisma.adminUser.deleteMany({
    where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });

  const leftovers = await prisma.$transaction([
    prisma.auditLog.count({
      where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.member.count({ where: { id: fixture.memberId } }),
    prisma.memberShift.count({ where: { id: fixture.shiftId } }),
    prisma.memberOvertimePolicy.count({ where: { id: fixture.overtimePolicyId } }),
    prisma.payrollPolicy.count({ where: { id: fixture.payrollPolicyId } }),
    prisma.attendanceLog.count({ where: { memberId: fixture.memberId } }),
    prisma.attendanceJustification.count({ where: { memberId: fixture.memberId } }),
    prisma.payrollPeriod.count({ where: { memberId: fixture.memberId } }),
    prisma.payrollPayment.count({ where: { payrollPeriod: { memberId: fixture.memberId } } }),
    prisma.adminUserPermission.count({
      where: { adminUserId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
    prisma.adminSession.count({
      where: { id: { in: [fixture.allowedSessionId, fixture.deniedSessionId] } },
    }),
    prisma.adminUser.count({
      where: { id: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
    }),
  ]);
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  console.log("✓ payroll integration fixture cleanup verified (0 records left)");
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "payroll-audit-integration-test",
  };
}

function assertAuditAttribution(
  audit: {
    actorType: AuditActor;
    actorId: string | null;
    actorRole: AdminRole | null;
    sessionId: string | null;
    success: boolean;
    ipAddress: string | null;
    userAgent: string | null;
  },
  fixture: Fixture
) {
  assert.equal(audit.actorType, AuditActor.ADMIN);
  assert.equal(audit.actorId, fixture.allowedAdminId);
  assert.equal(audit.actorRole, AdminRole.STAFF);
  assert.equal(audit.sessionId, fixture.allowedSessionId);
  assert.equal(audit.success, true);
  assert.ok(audit.ipAddress);
  assert.equal(audit.userAgent, "payroll-audit-integration-test");
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

function buildAttendance(memberId: string, date: Date, hours: number, minutes: number, entryType: AttendanceType) {
  return {
    memberId,
    recordedAt: atTime(date, hours, minutes),
    entryType,
    source: AttendanceSource.MANUAL,
    isAuthorized: true,
  };
}

function atTime(date: Date, hours: number, minutes: number) {
  const value = new Date(date);
  value.setHours(hours, minutes, 0, 0);
  return value;
}

function startOfDay(date: Date) {
  return atTime(date, 0, 0);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toStoredWeekday(jsDay: number) {
  return (jsDay + 1) % 7;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = allocateFixture();
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  try {
    await createFixtureRecords(fixture);
    await testPayrollCalculationPersistenceAndCashflow(fixture, `http://127.0.0.1:${address.port}`);
  } finally {
    try {
      await cleanupFixture(fixture);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
  console.log(
    "Payroll database integration tests passed (calculation, authorization, atomic audit, payment lifecycle, cashflow, cleanup)."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
