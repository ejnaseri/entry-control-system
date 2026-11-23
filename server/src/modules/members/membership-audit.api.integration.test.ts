import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  MemberRoleType,
  MemberStatus,
  MemberType,
  MembershipStatus,
  PermissionMode,
  PlanDurationUnit,
  SalaryType,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { memberRouter } from "./member.router";
import type { CustomerWizardInput } from "./member.schemas";
import {
  assignMemberShifts,
  cancelMemberMembership,
  createMember,
  createMemberMembership,
  createMemberPayment,
  removeMember,
  updateMember,
  type MemberActionContext,
  type MembershipActionContext,
} from "./member.service";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  planId: string;
  memberCode: string;
  rollbackMemberCode: string;
  memberId?: string;
  membershipId?: string;
};

type CustomerPayload = CustomerWizardInput;

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Membership audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["MEMBERSHIP_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Membership audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `membership-audit-allowed-${suffix}`;
  const deniedToken = `membership-audit-denied-${suffix}`;
  const memberCode = await findUnusedMemberCode();
  const rollbackMemberCode = await findUnusedMemberCode(new Set([memberCode]));

  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-membership-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-membership-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-membership-audit-denied-${suffix}`,
        passwordHash: "not-used-by-membership-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });

    await tx.adminUserPermission.createMany({
      data: [
        ...membershipPermissionRows(allowedAdmin.id, PermissionMode.ALLOW),
        { ...permissionRow(deniedAdmin.id, AdminPermission.MEMBERS_VIEW), mode: PermissionMode.ALLOW },
        ...[
          AdminPermission.MEMBERS_WRITE,
          AdminPermission.MEMBERSHIPS_WRITE,
          AdminPermission.MEMBERSHIPS_CANCEL,
          AdminPermission.PAYMENTS_RECORD,
          AdminPermission.MEMBERS_DELETE,
        ].map((permission) => ({ ...permissionRow(deniedAdmin.id, permission), mode: PermissionMode.DENY })),
      ],
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    const plan = await tx.membershipPlan.create({
      data: {
        name: `Membership Audit Plan ${suffix}`,
        slug: `membership-audit-plan-${suffix}`,
        durationDays: 30,
        durationValue: 1,
        durationUnit: PlanDurationUnit.MONTHS,
        price: 1000,
        basePrice: 1000,
        currency: "AFN",
        isActive: true,
      },
    });

    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession, plan };
  });

  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    planId: records.plan.id,
    memberCode,
    rollbackMemberCode,
  };
}

function membershipPermissionRows(adminUserId: string, mode: PermissionMode) {
  return [
    AdminPermission.MEMBERS_VIEW,
    AdminPermission.MEMBERS_WRITE,
    AdminPermission.MEMBERSHIPS_WRITE,
    AdminPermission.MEMBERSHIPS_CANCEL,
    AdminPermission.PAYMENTS_RECORD,
    AdminPermission.MEMBERS_DELETE,
  ].map((permission) => ({ ...permissionRow(adminUserId, permission), mode }));
}

function permissionRow(adminUserId: string, permission: AdminPermission) {
  return {
    adminUserId,
    permission,
    reason: "Membership audit API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function findUnusedMemberCode(excluded = new Set<string>()) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = String(100_000_000 + Math.floor(Math.random() * 900_000_000));
    if (excluded.has(code)) continue;
    const [member, deviceUser] = await Promise.all([
      prisma.member.findUnique({ where: { code }, select: { id: true } }),
      prisma.deviceUser.findUnique({ where: { externalId: Number(code) }, select: { id: true } }),
    ]);
    if (!member && !deviceUser) return code;
  }
  throw new Error("Could not allocate a unique member/device code for integration tests");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/members", requirePermission(AdminPermission.MEMBERS_VIEW), memberRouter);
  app.use(errorHandler);
  return app;
}

function customerPayload(fixture: Fixture, code = fixture.memberCode, price = 1000, discount = 0): CustomerPayload {
  return {
    memberType: MemberType.CUSTOMER,
    code,
    firstName: `Private Membership Member ${fixture.suffix}`,
    status: MemberStatus.ACTIVE,
    role: { roleType: MemberRoleType.OTHER, isStaff: false },
    access: { allowedDays: [0, 1, 2, 3, 4, 5, 6], allowedTimeRanges: [] },
    customerAccess: {
      allowedDays: [0, 1, 2, 3, 4, 5, 6],
      allowedTimeRanges: [],
      maxEntriesPerDay: 2,
    },
    overtime: { allowOvertime: false },
    shifts: [],
    extraShifts: [],
    membership: {
      planId: fixture.planId,
      startDate: "2026-07-18",
      endDate: "2026-08-18",
      price,
      discount,
      paidAmount: 600,
      status: MemberStatus.ACTIVE,
    },
  };
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/members`;
    await testAuthenticationAndPermissionGuards(baseUrl, fixture);
    await testMembershipCreateAndUpdateAudits(baseUrl, fixture);
    await testMemberShiftAudit(baseUrl, fixture);
    await testMembershipCancelAndRenewAudits(baseUrl, fixture);
    await testMembershipPaymentAudit(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function testAuthenticationAndPermissionGuards(baseUrl: string, fixture: Fixture) {
  const payload = customerPayload(fixture);
  const unauthenticated = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(unauthenticated.status, 401);

  const denied = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.MEMBERS_WRITE
  );

  const [members, deniedAudits] = await prisma.$transaction([
    prisma.member.count({ where: { code: fixture.memberCode } }),
    prisma.auditLog.count({ where: { actorId: fixture.deniedAdminId, action: { startsWith: "membership." } } }),
  ]);
  assert.equal(members, 0);
  assert.equal(deniedAudits, 0);
  console.log("ok membership API rejects unauthenticated/unauthorized mutations with no writes");
}

async function testMembershipCreateAndUpdateAudits(baseUrl: string, fixture: Fixture) {
  const createPayload = customerPayload(fixture);
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(createPayload),
  });
  assert.equal(response.status, 201);
  const createdMember = await response.json() as { id: string; code: string };
  fixture.memberId = createdMember.id;
  assert.equal(createdMember.code, fixture.memberCode);

  const membership = await prisma.membership.findFirst({
    where: { memberId: createdMember.id },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(membership);
  fixture.membershipId = membership.id;
  assert.equal(membership.createdByAdminId, fixture.allowedAdminId);
  assert.equal(Number(membership.totalDue), 1000);
  assert.equal(Number(membership.totalPaid), 600);

  const initialPayment = await prisma.payment.findFirst({ where: { membershipId: membership.id } });
  assert.ok(initialPayment);
  assert.equal(initialPayment.recordedByAdminId, fixture.allowedAdminId);

  const createdAudit = await findMembershipAudit("membership.created", membership.id);
  assertAuditAttribution(createdAudit, fixture);
  const createAfter = asJsonObject(createdAudit.afterData);
  const createMetadata = asJsonObject(createdAudit.metadata);
  assert.equal(createAfter["memberId"], createdMember.id);
  assert.equal(createAfter["planId"], fixture.planId);
  assert.equal(createAfter["status"], MembershipStatus.PENDING);
  assert.equal(createAfter["totalDue"], 1000);
  assert.equal(createAfter["totalPaid"], 600);
  assert.equal(createMetadata["appliedAmount"], 600);
  assert.equal(createMetadata["memberTotalDebt"], 400);
  assert.equal(JSON.stringify(createAfter).includes(createPayload.firstName), false);

  const memberCreatedAudit = await findMemberAudit("member.created", createdMember.id);
  assertAuditAttribution(memberCreatedAudit, fixture);
  const memberCreateAfter = asJsonObject(memberCreatedAudit.afterData);
  const memberCreateMetadata = asJsonObject(memberCreatedAudit.metadata);
  assert.equal(memberCreateAfter["id"], createdMember.id);
  assert.equal(memberCreateAfter["code"], fixture.memberCode);
  assert.equal(memberCreateAfter["memberType"], MemberType.CUSTOMER);
  assert.equal(memberCreateAfter["status"], MemberStatus.ACTIVE);
  assert.equal(memberCreateAfter["shiftCount"], 0);
  assert.equal(memberCreateMetadata["memberType"], MemberType.CUSTOMER);
  assert.equal(JSON.stringify(memberCreatedAudit).includes(createPayload.firstName), false);

  const updatePayload = customerPayload(fixture, fixture.memberCode, 1200, 100);
  updatePayload.firstName = `Private Updated Member ${fixture.suffix}`;
  updatePayload.membership.endDate = "2026-09-18";
  const deniedUpdate = await fetch(`${baseUrl}/${createdMember.id}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(updatePayload),
  });
  assert.equal(deniedUpdate.status, 403);
  assert.equal(
    (await deniedUpdate.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.MEMBERS_WRITE
  );
  assert.equal(
    Number((await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } })).totalDue),
    1000
  );

  const updateResponse = await fetch(`${baseUrl}/${createdMember.id}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(updatePayload),
  });
  assert.equal(updateResponse.status, 200);

  const updatedMembership = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } });
  assert.equal(Number(updatedMembership.totalDue), 1100);
  assert.equal(Number(updatedMembership.totalPaid), 600);

  const updatedAudit = await findMembershipAudit("membership.updated", membership.id);
  assertAuditAttribution(updatedAudit, fixture);
  const updateBefore = asJsonObject(updatedAudit.beforeData);
  const updateAfter = asJsonObject(updatedAudit.afterData);
  assert.equal(updateBefore["totalDue"], 1000);
  assert.equal(updateAfter["totalDue"], 1100);
  assert.equal(updateBefore["endDate"], new Date("2026-08-18").toISOString());
  assert.equal(updateAfter["endDate"], new Date("2026-09-18").toISOString());
  assert.equal(JSON.stringify(updatedAudit).includes(updatePayload.firstName), false);

  const memberUpdatedAudit = await findMemberAudit("member.updated", createdMember.id);
  assertAuditAttribution(memberUpdatedAudit, fixture);
  const memberUpdateMetadata = asJsonObject(memberUpdatedAudit.metadata);
  assert.ok(Array.isArray(memberUpdateMetadata["changedFields"]));
  assert.ok((memberUpdateMetadata["changedFields"] as Prisma.JsonArray).includes("firstName"));
  assert.equal(JSON.stringify(memberUpdatedAudit).includes(createPayload.firstName), false);
  assert.equal(JSON.stringify(memberUpdatedAudit).includes(updatePayload.firstName), false);
  console.log("ok member and membership creation/update audits are attributed, safe, and private");
}

async function testMemberShiftAudit(baseUrl: string, fixture: Fixture) {
  assert.ok(fixture.memberId);
  const endpoint = `${baseUrl}/${fixture.memberId}/shifts`;
  const shiftPayload = {
    staffGroupId: null,
    extraShifts: [],
    shifts: [
      {
        shiftName: "Audit integration shift",
        shiftStart: "09:00",
        shiftEnd: "17:00",
        weekdays: [0, 1, 2, 3, 4],
        graceMinutes: 5,
        earlyAccessMinutes: 10,
        salaryType: SalaryType.MONTHLY,
        salaryAmount: 10_000,
        isActive: true,
      },
    ],
  };

  const unauthenticated = await fetch(endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(shiftPayload),
  });
  assert.equal(unauthenticated.status, 401);

  const denied = await fetch(endpoint, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(shiftPayload),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.MEMBERS_WRITE
  );
  assert.equal(await prisma.memberShift.count({ where: { memberId: fixture.memberId } }), 0);

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(shiftPayload),
  });
  assert.equal(response.status, 200);
  assert.equal(await prisma.memberShift.count({ where: { memberId: fixture.memberId } }), 1);

  const audit = await findMemberAudit("member.shifts.updated", fixture.memberId);
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.ok(Array.isArray(beforeData["shifts"]));
  assert.equal((beforeData["shifts"] as Prisma.JsonArray).length, 0);
  assert.ok(Array.isArray(afterData["shifts"]));
  const shifts = afterData["shifts"] as Prisma.JsonArray;
  assert.equal(shifts.length, 1);
  const shift = asJsonObject(shifts[0] as Prisma.JsonValue);
  assert.equal(shift["shiftName"], "Audit integration shift");
  assert.equal(shift["salaryType"], SalaryType.MONTHLY);
  assert.equal(shift["salaryAmount"], 10_000);
  assert.equal(metadata["shiftCountBefore"], 0);
  assert.equal(metadata["shiftCountAfter"], 1);
  assert.equal(
    await prisma.auditLog.count({
      where: { actorId: fixture.deniedAdminId, action: "member.shifts.updated", targetId: fixture.memberId },
    }),
    0
  );
  console.log("ok member shift assignment is permission-guarded and writes a safe before-after audit");
}

async function testMembershipCancelAndRenewAudits(baseUrl: string, fixture: Fixture) {
  assert.ok(fixture.memberId);
  assert.ok(fixture.membershipId);
  const deniedCancel = await fetch(`${baseUrl}/${fixture.memberId}/memberships/${fixture.membershipId}/cancel`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify({ notes: "Permission denial must not mutate membership" }),
  });
  assert.equal(deniedCancel.status, 403);
  assert.equal(
    (await deniedCancel.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.MEMBERSHIPS_CANCEL
  );
  assert.equal(
    (await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } })).status,
    MembershipStatus.PENDING
  );

  const cancelResponse = await fetch(`${baseUrl}/${fixture.memberId}/memberships/${fixture.membershipId}/cancel`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({ notes: `Private cancellation reason ${fixture.suffix}` }),
  });
  assert.equal(cancelResponse.status, 200);
  const cancelled = await cancelResponse.json() as {
    membership: { id: string; status: MembershipStatus; totalDue: number; totalPaid: number };
    refundedAmount: number;
  };
  assert.equal(cancelled.refundedAmount, 600);
  assert.equal(cancelled.membership.status, MembershipStatus.CANCELLED);
  assert.equal(Number(cancelled.membership.totalDue), 0);
  assert.equal(Number(cancelled.membership.totalPaid), 0);

  const refund = await prisma.payment.findFirst({
    where: { membershipId: fixture.membershipId, amount: { lt: 0 } },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(refund);
  assert.equal(Number(refund.amount), -600);
  assert.equal(refund.recordedByAdminId, fixture.allowedAdminId);

  const cancelledAudit = await findMembershipAudit("membership.cancelled", fixture.membershipId);
  assertAuditAttribution(cancelledAudit, fixture);
  const cancelBefore = asJsonObject(cancelledAudit.beforeData);
  const cancelAfter = asJsonObject(cancelledAudit.afterData);
  const cancelMetadata = asJsonObject(cancelledAudit.metadata);
  assert.equal(cancelBefore["status"], MembershipStatus.PENDING);
  assert.equal(cancelBefore["totalPaid"], 600);
  assert.equal(cancelAfter["status"], MembershipStatus.CANCELLED);
  assert.equal(cancelAfter["totalDue"], 0);
  assert.equal(cancelAfter["totalPaid"], 0);
  assert.equal(cancelMetadata["refundedAmount"], 600);
  assert.equal(JSON.stringify(cancelledAudit).includes(`Private cancellation reason ${fixture.suffix}`), false);

  const membershipCountBeforeDeniedRenew = await prisma.membership.count({ where: { memberId: fixture.memberId } });
  const deniedRenew = await fetch(`${baseUrl}/${fixture.memberId}/memberships`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify({ planId: fixture.planId, periods: 1, paidAmount: 700 }),
  });
  assert.equal(deniedRenew.status, 403);
  assert.equal(
    (await deniedRenew.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.MEMBERSHIPS_WRITE
  );
  assert.equal(
    await prisma.membership.count({ where: { memberId: fixture.memberId } }),
    membershipCountBeforeDeniedRenew
  );

  const renewResponse = await fetch(`${baseUrl}/${fixture.memberId}/memberships`, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      planId: fixture.planId,
      periods: 1,
      paidAmount: 700,
      paidAt: "2026-07-18T10:00:00.000Z",
      notes: `Private renewal note ${fixture.suffix}`,
    }),
  });
  assert.equal(renewResponse.status, 201);
  const renewed = await renewResponse.json() as {
    id: string;
    status: MembershipStatus;
    totalDue: number;
    totalPaid: number;
    createdByAdminId: string | null;
  };
  fixture.membershipId = renewed.id;
  assert.equal(renewed.status, MembershipStatus.PENDING);
  assert.equal(Number(renewed.totalDue), 1000);
  assert.equal(Number(renewed.totalPaid), 700);
  assert.equal(renewed.createdByAdminId, fixture.allowedAdminId);

  const renewedPayment = await prisma.payment.findFirst({ where: { membershipId: renewed.id } });
  assert.ok(renewedPayment);
  assert.equal(renewedPayment.recordedByAdminId, fixture.allowedAdminId);

  const renewedAudit = await findMembershipAudit("membership.renewed", renewed.id);
  assertAuditAttribution(renewedAudit, fixture);
  const renewAfter = asJsonObject(renewedAudit.afterData);
  const renewMetadata = asJsonObject(renewedAudit.metadata);
  assert.equal(renewAfter["totalPaid"], 700);
  assert.equal(renewMetadata["previousMembershipId"], cancelBefore["id"]);
  assert.equal(renewMetadata["appliedAmount"], 700);
  assert.equal(renewMetadata["memberTotalDebt"], 300);
  assert.equal(JSON.stringify(renewedAudit).includes(`Private renewal note ${fixture.suffix}`), false);
  assert.equal(
    await prisma.auditLog.count({
      where: { actorId: fixture.deniedAdminId, action: { startsWith: "membership." } },
    }),
    0
  );
  console.log("ok membership cancellation/renewal audits preserve refund linkage, financial effects, and privacy");
}

async function testMembershipPaymentAudit(baseUrl: string, fixture: Fixture) {
  assert.ok(fixture.memberId);
  assert.ok(fixture.membershipId);
  const endpoint = `${baseUrl}/${fixture.memberId}/payments`;
  const paymentCountBeforeDenied = await prisma.payment.count({ where: { memberId: fixture.memberId } });
  const unauthenticated = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ membershipId: fixture.membershipId, amount: 500 }),
  });
  assert.equal(unauthenticated.status, 401);
  assert.equal(await prisma.payment.count({ where: { memberId: fixture.memberId } }), paymentCountBeforeDenied);

  const denied = await fetch(endpoint, {
    method: "POST",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify({
      membershipId: fixture.membershipId,
      amount: 500,
      paidAt: "2026-07-18T11:15:00.000Z",
      notes: `Private denied payment ${fixture.suffix}`,
    }),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.PAYMENTS_RECORD
  );
  assert.equal(await prisma.payment.count({ where: { memberId: fixture.memberId } }), paymentCountBeforeDenied);

  const privateNotes = `Private membership payment ${fixture.suffix}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify({
      membershipId: fixture.membershipId,
      amount: 500,
      paidAt: "2026-07-18T11:15:00.000Z",
      notes: privateNotes,
    }),
  });
  assert.equal(response.status, 201);
  const primaryPayment = await response.json() as {
    id: string;
    memberId: string;
    membershipId: string | null;
    amount: number | string;
    method: string;
    reference: string | null;
    recordedByAdminId: string | null;
  };
  assert.equal(primaryPayment.memberId, fixture.memberId);
  assert.equal(primaryPayment.membershipId, fixture.membershipId);
  assert.equal(Number(primaryPayment.amount), 300);
  assert.equal(primaryPayment.method, "CASH");
  assert.equal(primaryPayment.recordedByAdminId, fixture.allowedAdminId);

  const [updatedMembership, creditPayment, audit] = await prisma.$transaction([
    prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } }),
    prisma.payment.findFirst({
      where: {
        memberId: fixture.memberId,
        membershipId: null,
        recordedByAdminId: fixture.allowedAdminId,
        paidAt: new Date("2026-07-18T11:15:00.000Z"),
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findFirst({
      where: {
        action: "membership.payment.recorded",
        targetType: "Payment",
        targetId: primaryPayment.id,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  assert.equal(Number(updatedMembership.totalPaid), 1000);
  assert.ok(creditPayment);
  assert.equal(Number(creditPayment.amount), 200);
  assert.equal(creditPayment.recordedByAdminId, fixture.allowedAdminId);
  assert.ok(audit);
  assertAuditAttribution(audit, fixture);

  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["membershipTotalPaid"], 700);
  assert.equal(beforeData["memberTotalDebt"], 300);
  assert.equal(beforeData["memberCreditBalance"], 0);
  assert.equal(afterData["membershipTotalPaid"], 1000);
  assert.equal(afterData["memberTotalDebt"], 0);
  assert.equal(afterData["memberCreditBalance"], 200);
  assert.equal(metadata["requestedAmount"], 500);
  assert.equal(metadata["appliedAmount"], 300);
  assert.equal(metadata["creditAmount"], 200);
  assert.equal(metadata["primaryPaymentId"], primaryPayment.id);
  assert.equal(metadata["creditPaymentId"], creditPayment.id);
  assert.equal(metadata["method"], "CASH");
  assert.equal(metadata["reference"], primaryPayment.reference);
  assert.ok(Array.isArray(metadata["paymentIds"]));
  assert.equal((metadata["paymentIds"] as Prisma.JsonArray).length, 2);
  assert.ok(Array.isArray(metadata["ledgerEntries"]));
  assert.equal((metadata["ledgerEntries"] as Prisma.JsonArray).length, 2);
  assert.equal(JSON.stringify(audit).includes(privateNotes), false);
  assert.equal(
    await prisma.auditLog.count({
      where: { actorId: fixture.deniedAdminId, action: "membership.payment.recorded" },
    }),
    0
  );
  assert.equal(
    await prisma.auditLog.count({
      where: { actorId: fixture.allowedAdminId, action: "membership.payment.recorded" },
    }),
    1
  );
  console.log("ok direct membership payment audit preserves split, totals, attribution, permission, and privacy");
}

async function findMembershipAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "Membership", targetId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, `Expected ${action} audit for membership ${targetId}`);
  return audit;
}

async function findMemberAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "Member", targetId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, `Expected ${action} audit for member ${targetId}`);
  return audit;
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
  assert.equal(audit.userAgent, "membership-audit-api-integration-test");
}

async function testAtomicRollback(fixture: Fixture) {
  assert.ok(fixture.memberId);
  assert.ok(fixture.membershipId);
  const invalidSessionContext: MembershipActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: `missing-membership-session-${fixture.suffix}`,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "membership-audit-rollback-test" },
  };
  const validContext: MembershipActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: fixture.allowedSessionId,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "membership-audit-rollback-test" },
  };

  await assert.rejects(() => createMember(customerPayload(fixture, fixture.rollbackMemberCode), invalidSessionContext));
  assert.equal(await prisma.member.count({ where: { code: fixture.rollbackMemberCode } }), 0);

  const beforeUpdate = await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } });
  await assert.rejects(() =>
    updateMember(fixture.memberId!, customerPayload(fixture, fixture.memberCode, 1450, 50), invalidSessionContext)
  );
  const afterFailedUpdate = await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } });
  assert.equal(Number(afterFailedUpdate.totalDue), Number(beforeUpdate.totalDue));
  assert.equal(afterFailedUpdate.endDate.toISOString(), beforeUpdate.endDate.toISOString());

  const paymentCountBeforeFailedPayment = await prisma.payment.count({ where: { memberId: fixture.memberId } });
  const membershipBeforeFailedPayment = await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } });
  await assert.rejects(() =>
    createMemberPayment(
      fixture.memberId!,
      {
        membershipId: fixture.membershipId,
        amount: 50,
        paidAt: "2026-07-18T12:00:00.000Z",
        notes: `Must roll back payment ${fixture.suffix}`,
      },
      invalidSessionContext
    )
  );
  assert.equal(await prisma.payment.count({ where: { memberId: fixture.memberId } }), paymentCountBeforeFailedPayment);
  const membershipAfterFailedPayment = await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } });
  assert.equal(Number(membershipAfterFailedPayment.totalPaid), Number(membershipBeforeFailedPayment.totalPaid));

  const paymentCountBeforeCancel = await prisma.payment.count({ where: { membershipId: fixture.membershipId } });
  await assert.rejects(() =>
    cancelMemberMembership(
      fixture.memberId!,
      fixture.membershipId!,
      { notes: `Must roll back ${fixture.suffix}` },
      invalidSessionContext
    )
  );
  const afterFailedCancel = await prisma.membership.findUniqueOrThrow({ where: { id: fixture.membershipId } });
  assert.equal(afterFailedCancel.status, MembershipStatus.PENDING);
  assert.equal(
    await prisma.payment.count({ where: { membershipId: fixture.membershipId } }),
    paymentCountBeforeCancel
  );

  await cancelMemberMembership(
    fixture.memberId,
    fixture.membershipId,
    { notes: `Prepare renewal rollback ${fixture.suffix}` },
    validContext
  );
  const membershipCountBeforeRenew = await prisma.membership.count({ where: { memberId: fixture.memberId } });
  await assert.rejects(() =>
    createMemberMembership(
      fixture.memberId!,
      { planId: fixture.planId, periods: 1, paidAmount: 250 },
      invalidSessionContext
    )
  );
  assert.equal(await prisma.membership.count({ where: { memberId: fixture.memberId } }), membershipCountBeforeRenew);

  const shiftBeforeRollback = await prisma.memberShift.findFirstOrThrow({ where: { memberId: fixture.memberId } });
  await assert.rejects(() =>
    assignMemberShifts(
      fixture.memberId!,
      {
        shifts: [
          {
            shiftName: "Must roll back shift",
            shiftStart: "10:00",
            shiftEnd: "18:00",
            weekdays: [1, 2, 3],
            graceMinutes: 0,
            earlyAccessMinutes: 0,
            salaryType: SalaryType.MONTHLY,
            salaryAmount: 20_000,
            isActive: true,
          },
        ],
        extraShifts: [],
      },
      invalidSessionContext as MemberActionContext
    )
  );
  const shiftAfterRollback = await prisma.memberShift.findFirstOrThrow({ where: { memberId: fixture.memberId } });
  assert.equal(shiftAfterRollback.id, shiftBeforeRollback.id);
  assert.equal(shiftAfterRollback.shiftName, shiftBeforeRollback.shiftName);
  assert.equal(Number(shiftAfterRollback.salaryAmount), Number(shiftBeforeRollback.salaryAmount));

  await assert.rejects(() => removeMember(fixture.memberId!, invalidSessionContext as MemberActionContext));
  assert.equal(await prisma.member.count({ where: { id: fixture.memberId } }), 1);
  console.log(
    "ok failed member/membership audits atomically roll back create, update, shifts, delete, payment, cancellation, refund, and renewal writes"
  );
}

async function runMemberDeleteApiTest(fixture: Fixture) {
  assert.ok(fixture.memberId);
  await prisma.deviceUser.deleteMany({ where: { memberId: fixture.memberId } });
  const deleteCode = `delete-audit-${fixture.suffix}`;
  await prisma.member.update({ where: { id: fixture.memberId }, data: { code: deleteCode } });

  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/api/v1/members/${fixture.memberId}`;

    const unauthenticated = await fetch(endpoint, { method: "DELETE" });
    assert.equal(unauthenticated.status, 401);
    assert.equal(await prisma.member.count({ where: { id: fixture.memberId } }), 1);

    const denied = await fetch(endpoint, {
      method: "DELETE",
      headers: authenticatedHeaders(fixture.deniedToken),
    });
    assert.equal(denied.status, 403);
    assert.equal(
      (await denied.json() as { requiredPermission: string }).requiredPermission,
      AdminPermission.MEMBERS_DELETE
    );
    assert.equal(await prisma.member.count({ where: { id: fixture.memberId } }), 1);

    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: authenticatedHeaders(fixture.allowedToken),
    });
    assert.equal(response.status, 204);
    assert.equal(await prisma.member.count({ where: { id: fixture.memberId } }), 0);

    const audit = await findMemberAudit("member.deleted", fixture.memberId);
    assertAuditAttribution(audit, fixture);
    const beforeData = asJsonObject(audit.beforeData);
    const metadata = asJsonObject(audit.metadata);
    assert.equal(beforeData["id"], fixture.memberId);
    assert.equal(beforeData["code"], deleteCode);
    assert.equal(beforeData["memberType"], MemberType.CUSTOMER);
    assert.equal(metadata["memberType"], MemberType.CUSTOMER);
    assert.equal(
      await prisma.auditLog.count({
        where: { actorId: fixture.deniedAdminId, action: "member.deleted", targetId: fixture.memberId },
      }),
      0
    );
    console.log("ok member deletion is permission-guarded, atomic, and leaves a safe persistent audit");
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "membership-audit-api-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });

  const memberIds = (
    await prisma.member.findMany({
      where: { code: { in: [fixture.memberCode, fixture.rollbackMemberCode] } },
      select: { id: true },
    })
  ).map((member) => member.id);
  if (memberIds.length) {
    await prisma.deviceUser.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  }

  await prisma.membershipPlan.deleteMany({ where: { id: fixture.planId } });
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
    prisma.auditLog.count({ where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } } }),
    prisma.member.count({ where: { code: { in: [fixture.memberCode, fixture.rollbackMemberCode] } } }),
    prisma.membershipPlan.count({ where: { id: fixture.planId } }),
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
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0, 0]);
  console.log("ok membership audit integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runApiTests(fixture);
    await testAtomicRollback(fixture);
    await runMemberDeleteApiTest(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Member/membership audit API integration tests passed (auth, audit, privacy, atomicity, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
