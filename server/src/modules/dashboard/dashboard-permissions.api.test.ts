import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { AdminPermission, AdminRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { dashboardRouter } from "./dashboard.router";

type TestProfile = "attendance-only" | "device-operator" | "financial";

const REAL_ACTIVE_MEMBER_COUNT = 17;
const REAL_DEBTOR_COUNT = 7;
const REAL_REVENUE_AMOUNT = 98_765;
const REAL_PAYMENT_REFERENCE = "private-financial-reference";

const prismaAny = prisma as any;
const originalFns = {
  memberCount: prismaAny.member.count,
  paymentAggregate: prismaAny.payment.aggregate,
  paymentCount: prismaAny.payment.count,
  paymentFindMany: prismaAny.payment.findMany,
  attendanceLogCount: prismaAny.attendanceLog.count,
  attendanceLogFindMany: prismaAny.attendanceLog.findMany,
  attendanceLogGroupBy: prismaAny.attendanceLog.groupBy,
  queryRaw: prismaAny.$queryRaw,
};

function installPrismaMocks() {
  prismaAny.member.count = async ({ where }: { where?: Record<string, unknown> } = {}) =>
    where?.["customerProfile"] ? REAL_DEBTOR_COUNT : REAL_ACTIVE_MEMBER_COUNT;
  prismaAny.payment.aggregate = async () => ({ _sum: { amount: REAL_REVENUE_AMOUNT } });
  prismaAny.payment.count = async () => 1;
  prismaAny.payment.findMany = async () => [
    {
      id: "payment-private-1",
      paidAt: new Date("2026-07-28T09:00:00.000Z"),
      createdAt: new Date("2026-07-28T09:00:00.000Z"),
      memberId: "member-private-1",
      amount: REAL_REVENUE_AMOUNT,
      currency: "AFN",
      method: "CASH",
      reference: REAL_PAYMENT_REFERENCE,
      member: {
        id: "member-private-1",
        code: "PRIVATE-1",
        firstName: "Private",
        lastName: "Member",
      },
    },
  ];
  prismaAny.attendanceLog.count = async () => 4;
  prismaAny.attendanceLog.findMany = async () => [];
  prismaAny.attendanceLog.groupBy = async () => [];
  prismaAny.$queryRaw = async () => [{ count: 3 }];
}

function restorePrisma() {
  prismaAny.member.count = originalFns.memberCount;
  prismaAny.payment.aggregate = originalFns.paymentAggregate;
  prismaAny.payment.count = originalFns.paymentCount;
  prismaAny.payment.findMany = originalFns.paymentFindMany;
  prismaAny.attendanceLog.count = originalFns.attendanceLogCount;
  prismaAny.attendanceLog.findMany = originalFns.attendanceLogFindMany;
  prismaAny.attendanceLog.groupBy = originalFns.attendanceLogGroupBy;
  prismaAny.$queryRaw = originalFns.queryRaw;
}

function permissionsFor(profile: TestProfile): AdminPermission[] {
  if (profile === "attendance-only") {
    return [AdminPermission.SIGN_IN, AdminPermission.ATTENDANCE_VIEW];
  }
  if (profile === "device-operator") {
    return [
      AdminPermission.SIGN_IN,
      AdminPermission.MEMBERS_VIEW,
      AdminPermission.ATTENDANCE_VIEW,
      AdminPermission.DEVICES_VIEW,
      AdminPermission.DEVICES_DIAGNOSTICS,
      AdminPermission.DEVICES_USER_SYNC,
      AdminPermission.DEVICES_ENROLL,
      AdminPermission.DOOR_UNLOCK,
    ];
  }
  return [
    AdminPermission.SIGN_IN,
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.ATTENDANCE_VIEW,
    AdminPermission.FINANCIAL_REPORTS_VIEW,
  ];
}

function roleFor(profile: TestProfile): AdminRole {
  if (profile === "device-operator") return AdminRole.DEVICE_OPERATOR;
  if (profile === "financial") return AdminRole.ACCOUNTANT;
  return AdminRole.STAFF;
}

function buildTestApp() {
  const app = express();
  app.use((req, _res, next) => {
    const profile = req.get("x-test-profile") as TestProfile | undefined;
    if (profile && ["attendance-only", "device-operator", "financial"].includes(profile)) {
      req.auth = {
        user: {
          id: `dashboard-permission-${profile}`,
          username: `dashboard-permission-${profile}`,
          role: roleFor(profile),
        },
        permissions: permissionsFor(profile),
        session: {
          id: `dashboard-permission-session-${profile}`,
        },
      } as any;
    }
    next();
  });
  app.use(
    "/api/v1/dashboard",
    requirePermission(AdminPermission.ATTENDANCE_VIEW),
    dashboardRouter
  );
  app.use(errorHandler);
  return app;
}

async function request(baseUrl: string, path: string, profile: TestProfile) {
  return fetch(`${baseUrl}${path}`, {
    headers: { "x-test-profile": profile },
  });
}

async function testAuthorizedFinancialAccess(baseUrl: string) {
  const summaryResponse = await request(baseUrl, "/summary?range=7d", "financial");
  assert.equal(summaryResponse.status, 200);
  const summary = await summaryResponse.json() as {
    activeMembers: { value: number };
    debtors: { value: number };
    revenueToday: { value: number; currency: string };
  };
  assert.equal(summary.activeMembers.value, REAL_ACTIVE_MEMBER_COUNT);
  assert.equal(summary.debtors.value, REAL_DEBTOR_COUNT);
  assert.equal(summary.revenueToday.value, REAL_REVENUE_AMOUNT);
  assert.equal(summary.revenueToday.currency, "AFN");

  const reportsSummaryResponse = await request(baseUrl, "/reports-summary", "financial");
  assert.equal(reportsSummaryResponse.status, 200);
  const reportsSummary = await reportsSummaryResponse.json() as { totalPaidThisMonth: number };
  assert.equal(reportsSummary.totalPaidThisMonth, REAL_REVENUE_AMOUNT);

  const detailsResponse = await request(baseUrl, "/details?type=revenueToday&limit=20", "financial");
  assert.equal(detailsResponse.status, 200);
  const details = await detailsResponse.json() as {
    type: string;
    total: number;
    items: Array<{ amount: number; reference: string | null }>;
  };
  assert.equal(details.type, "revenueToday");
  assert.equal(details.total, 1);
  assert.equal(details.items[0]?.amount, REAL_REVENUE_AMOUNT);
  assert.equal(details.items[0]?.reference, REAL_PAYMENT_REFERENCE);

  console.log("ok - FINANCIAL_REPORTS_VIEW retains dashboard financial summary and detail access");
}

async function testRestrictedProfile(baseUrl: string, profile: "attendance-only" | "device-operator") {
  const summaryResponse = await request(baseUrl, "/summary?range=7d", profile);
  assert.equal(summaryResponse.status, 200);
  const summary = await summaryResponse.json() as {
    activeMembers: { value: number; deltaPct: number | null };
    expiringSoon: { value: number; deltaPct: number | null };
    debtors: { value: number; deltaPct: number | null };
    revenueToday: { value: number; deltaPct: number | null; currency: string };
  };
  assert.deepEqual(summary.debtors, { value: 0, deltaPct: null });
  assert.deepEqual(summary.revenueToday, { value: 0, deltaPct: null, currency: "AFN" });
  assert.notEqual(summary.debtors.value, REAL_DEBTOR_COUNT);
  assert.notEqual(summary.revenueToday.value, REAL_REVENUE_AMOUNT);

  if (profile === "attendance-only") {
    assert.deepEqual(summary.activeMembers, { value: 0, deltaPct: null });
    assert.deepEqual(summary.expiringSoon, { value: 0, deltaPct: null });
  } else {
    assert.equal(summary.activeMembers.value, REAL_ACTIVE_MEMBER_COUNT);
  }

  for (const detailType of ["debtors", "revenueToday"] as const) {
    const detailResponse = await request(baseUrl, `/details?type=${detailType}&limit=20`, profile);
    assert.equal(detailResponse.status, 403);
    assert.equal((await detailResponse.json() as { message: string }).message, "Permission denied");
  }

  const reportsSummaryResponse = await request(baseUrl, "/reports-summary", profile);
  assert.equal(reportsSummaryResponse.status, 403);
  const reportsSummaryError = await reportsSummaryResponse.json() as {
    message: string;
    requiredPermission: string;
  };
  assert.equal(reportsSummaryError.message, "Permission denied");
  assert.equal(reportsSummaryError.requiredPermission, AdminPermission.FINANCIAL_REPORTS_VIEW);

  console.log(`ok - ${profile} cannot receive dashboard debt/revenue values or financial details`);
}

async function run() {
  installPrismaMocks();
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/dashboard`;
    await testAuthorizedFinancialAccess(baseUrl);
    await testRestrictedProfile(baseUrl, "attendance-only");
    await testRestrictedProfile(baseUrl, "device-operator");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
    restorePrisma();
  }
}

void run().catch((error) => {
  restorePrisma();
  console.error(error);
  process.exitCode = 1;
});
