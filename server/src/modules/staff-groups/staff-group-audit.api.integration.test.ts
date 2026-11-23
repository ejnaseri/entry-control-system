import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  MemberType,
  PayrollPolicyScope,
  PermissionMode,
  SalaryType,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import { staffGroupRouter } from "./staff-group.router";
import {
  createStaffGroup,
  removeStaffGroup,
  updateStaffGroup,
  type StaffGroupActionContext,
} from "./staff-group.service";
import type { StaffGroupInput } from "./staff-group.schemas";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  groupIds: string[];
  memberIds: string[];
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Staff-group audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["STAFF_GROUP_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Staff-group audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `staff-group-audit-allowed-${suffix}`;
  const deniedToken = `staff-group-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-staff-group-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-staff-group-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-staff-group-audit-denied-${suffix}`,
        passwordHash: "not-used-by-staff-group-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.MEMBERS_VIEW, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.SYSTEM_SETTINGS_MANAGE, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.MEMBERS_VIEW, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.SYSTEM_SETTINGS_MANAGE, PermissionMode.DENY),
      ],
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const allowedSession = await tx.adminSession.create({
      data: { adminUserId: allowedAdmin.id, tokenHash: hashSessionToken(allowedToken), expiresAt },
    });
    const deniedSession = await tx.adminSession.create({
      data: { adminUserId: deniedAdmin.id, tokenHash: hashSessionToken(deniedToken), expiresAt },
    });
    return { allowedAdmin, deniedAdmin, allowedSession, deniedSession };
  });

  return {
    suffix,
    allowedAdminId: records.allowedAdmin.id,
    allowedSessionId: records.allowedSession.id,
    allowedToken,
    deniedAdminId: records.deniedAdmin.id,
    deniedSessionId: records.deniedSession.id,
    deniedToken,
    groupIds: [],
    memberIds: [],
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return {
    adminUserId,
    permission,
    mode,
    reason: "Staff-group audit API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/staff-groups", requirePermission(AdminPermission.MEMBERS_VIEW), staffGroupRouter);
  app.use(errorHandler);
  return app;
}

function groupPayload(fixture: Fixture, label = "Primary", overrides: Partial<StaffGroupInput> = {}) {
  return {
    name: `${label} Audit Staff Group ${fixture.suffix}`,
    description: `Private staff-group description ${label} ${fixture.suffix}`,
    accessLevel: `${label.toLowerCase()}-access`,
    shifts: [
      {
        shiftName: `${label} morning`,
        shiftStart: "08:00",
        shiftEnd: "16:00",
        weekdays: [0, 1, 2, 3, 4],
        graceMinutes: 5,
        earlyAccessMinutes: 15,
        salaryType: SalaryType.MONTHLY,
        salaryAmount: 12_000,
        isActive: true,
      },
    ],
    ...overrides,
  } satisfies StaffGroupInput;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/staff-groups`;
    await testGuardsAndCreate(baseUrl, fixture);
    await testUpdateAndMemberShiftSync(baseUrl, fixture);
    await testHardDeleteAndSideEffects(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

async function testGuardsAndCreate(baseUrl: string, fixture: Fixture) {
  const payload = groupPayload(fixture);
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
    AdminPermission.SYSTEM_SETTINGS_MANAGE
  );
  assert.equal(await prisma.staffGroup.count({ where: { name: payload.name } }), 0);
  assert.equal(await deniedAuditCount(fixture), 0);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const created = await response.json() as {
    id: string;
    name: string;
    accessLevel: string | null;
    shifts: Array<{ id: string; shiftName: string; salaryAmount: string }>;
  };
  fixture.groupIds.push(created.id);
  assert.equal(created.name, payload.name);
  assert.equal(created.accessLevel, payload.accessLevel);
  assert.equal(created.shifts.length, 1);

  const audit = await findStaffGroupAudit("staff_group.created", created.id);
  assertAuditAttribution(audit, fixture);
  const afterData = asJsonObject(audit.afterData);
  assert.equal(afterData["id"], created.id);
  assert.equal(afterData["name"], payload.name);
  assert.equal(afterData["accessLevel"], payload.accessLevel);
  const shifts = asJsonArray(afterData["shifts"]);
  assert.equal(asJsonObject(shifts[0])["shiftName"], payload.shifts[0]!.shiftName);
  assert.equal(asJsonObject(shifts[0])["salaryAmount"], 12_000);
  assert.equal(Object.prototype.hasOwnProperty.call(afterData, "description"), false);
  assert.equal(JSON.stringify(audit).includes(payload.description!), false);
  console.log("ok staff-group creation is permission-guarded and writes a private attributed audit");
}

async function testUpdateAndMemberShiftSync(baseUrl: string, fixture: Fixture) {
  const groupId = fixture.groupIds[0];
  assert.ok(groupId);
  const group = await prisma.staffGroup.findUniqueOrThrow({ where: { id: groupId }, include: { shifts: true } });
  const originalShift = group.shifts[0];
  assert.ok(originalShift);
  const member = await prisma.member.create({
    data: {
      code: `staff-group-audit-${fixture.suffix}`,
      firstName: `Private member ${fixture.suffix}`,
      memberType: MemberType.STAFF,
      isStaff: true,
      staffGroupId: groupId,
    },
  });
  fixture.memberIds.push(member.id);
  await prisma.memberShift.create({
    data: {
      memberId: member.id,
      shiftId: originalShift.id,
      shiftName: originalShift.shiftName,
      shiftStart: originalShift.shiftStart,
      shiftEnd: originalShift.shiftEnd,
      weekdays: originalShift.weekdays,
      graceMinutes: originalShift.graceMinutes,
      earlyAccessMinutes: originalShift.earlyAccessMinutes,
      salaryType: originalShift.salaryType,
      salaryAmount: originalShift.salaryAmount,
      isFromGroup: true,
      isActive: true,
    },
  });

  const payload = groupPayload(fixture, "Updated", {
    shifts: [
      {
        shiftName: "Updated day shift",
        shiftStart: "07:30",
        shiftEnd: "15:30",
        weekdays: [1, 2, 3, 4, 5],
        graceMinutes: 10,
        earlyAccessMinutes: 20,
        salaryType: SalaryType.HOURLY,
        salaryAmount: 125,
        isActive: true,
      },
      {
        shiftName: "Updated night shift",
        shiftStart: "20:00",
        shiftEnd: "04:00",
        weekdays: [0, 6],
        graceMinutes: 3,
        earlyAccessMinutes: 10,
        salaryType: SalaryType.PER_SHIFT,
        salaryAmount: 800,
        isActive: false,
      },
    ],
  });

  const denied = await fetch(`${baseUrl}/${groupId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  assert.equal((await prisma.staffGroup.findUniqueOrThrow({ where: { id: groupId } })).name, group.name);

  const response = await fetch(`${baseUrl}/${groupId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const updated = await response.json() as { name: string; shifts: unknown[] };
  assert.equal(updated.name, payload.name);
  assert.equal(updated.shifts.length, 2);

  const memberShifts = await prisma.memberShift.findMany({ where: { memberId: member.id }, orderBy: { shiftName: "asc" } });
  assert.equal(memberShifts.length, 2);
  assert.ok(memberShifts.every((shift) => shift.isFromGroup && shift.shiftId));
  assert.deepEqual(memberShifts.map((shift) => shift.shiftName), ["Updated day shift", "Updated night shift"]);

  const audit = await findStaffGroupAudit("staff_group.updated", groupId);
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["name"], group.name);
  assert.equal(asJsonArray(beforeData["shifts"]).length, 1);
  assert.equal(afterData["name"], payload.name);
  assert.equal(asJsonArray(afterData["shifts"]).length, 2);
  const changedFields = asJsonArray(metadata["changedFields"]);
  assert.ok(changedFields.includes("name"));
  assert.ok(changedFields.includes("description"));
  assert.ok(changedFields.includes("accessLevel"));
  assert.ok(changedFields.includes("shifts"));
  assert.equal(Object.prototype.hasOwnProperty.call(beforeData, "description"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(afterData, "description"), false);
  assert.equal(JSON.stringify(audit).includes(payload.description!), false);
  assert.equal(JSON.stringify(audit).includes(member.firstName), false);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok staff-group update audits safe policy changes and synchronizes member shifts atomically");
}

async function testHardDeleteAndSideEffects(baseUrl: string, fixture: Fixture) {
  const groupId = fixture.groupIds[0];
  const memberId = fixture.memberIds[0];
  assert.ok(groupId && memberId);
  await prisma.payrollPolicy.create({
    data: { scope: PayrollPolicyScope.STAFF_GROUP, staffGroupId: groupId },
  });

  const denied = await fetch(`${baseUrl}/${groupId}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.deniedToken),
  });
  assert.equal(denied.status, 403);
  assert.equal(await prisma.staffGroup.count({ where: { id: groupId } }), 1);

  const response = await fetch(`${baseUrl}/${groupId}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(response.status, 204);
  assert.equal(await prisma.staffGroup.count({ where: { id: groupId } }), 0);
  assert.equal((await prisma.member.findUniqueOrThrow({ where: { id: memberId } })).staffGroupId, null);
  assert.equal(await prisma.payrollPolicy.count({ where: { staffGroupId: groupId } }), 0);
  const detachedMemberShifts = await prisma.memberShift.findMany({ where: { memberId } });
  assert.equal(detachedMemberShifts.length, 2);
  assert.ok(detachedMemberShifts.every((shift) => shift.shiftId === null));

  const audit = await findStaffGroupAudit("staff_group.deleted", groupId);
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["id"], groupId);
  assert.equal(asJsonArray(beforeData["shifts"]).length, 2);
  assert.deepEqual(afterData, { id: groupId, deleted: true });
  assert.equal(metadata["mode"], "HARD_DELETE");
  assert.equal(metadata["linkedMemberCount"], 1);
  assert.equal(metadata["shiftTemplateCount"], 2);
  assert.equal(metadata["linkedMemberShiftCount"], 2);
  assert.equal(metadata["deletedPayrollPolicyCount"], 1);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok hard-delete preserves audit evidence and records member/shift/payroll-policy effects");
}

async function testAtomicRollback(fixture: Fixture) {
  const invalidContext: StaffGroupActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: `missing-staff-group-session-${fixture.suffix}`,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "staff-group-audit-rollback-test" },
  };
  const validContext: StaffGroupActionContext = {
    actor: { id: fixture.allowedAdminId, role: AdminRole.STAFF, sessionId: fixture.allowedSessionId },
    meta: { ipAddress: "127.0.0.1", userAgent: "staff-group-audit-rollback-test" },
  };

  const failedCreate = groupPayload(fixture, "Failed Create");
  await assert.rejects(() => createStaffGroup(failedCreate, invalidContext));
  assert.equal(await prisma.staffGroup.count({ where: { name: failedCreate.name } }), 0);

  const rollbackGroup = await createStaffGroup(groupPayload(fixture, "Rollback"), validContext);
  fixture.groupIds.push(rollbackGroup.id);
  const beforeUpdate = await prisma.staffGroup.findUniqueOrThrow({
    where: { id: rollbackGroup.id },
    include: { shifts: { orderBy: { createdAt: "asc" } } },
  });
  await assert.rejects(() =>
    updateStaffGroup(rollbackGroup.id, groupPayload(fixture, "Failed Update"), invalidContext)
  );
  const afterFailedUpdate = await prisma.staffGroup.findUniqueOrThrow({
    where: { id: rollbackGroup.id },
    include: { shifts: { orderBy: { createdAt: "asc" } } },
  });
  assert.equal(afterFailedUpdate.name, beforeUpdate.name);
  assert.equal(afterFailedUpdate.description, beforeUpdate.description);
  assert.deepEqual(
    afterFailedUpdate.shifts.map((shift) => [shift.id, shift.shiftName]),
    beforeUpdate.shifts.map((shift) => [shift.id, shift.shiftName])
  );

  await assert.rejects(() => removeStaffGroup(rollbackGroup.id, invalidContext));
  assert.equal(await prisma.staffGroup.count({ where: { id: rollbackGroup.id } }), 1);
  assert.equal(await prisma.staffGroupShift.count({ where: { staffGroupId: rollbackGroup.id } }), 1);
  console.log("ok failed staff-group audits roll back create, update, shift replacement, and hard-delete");
}

async function findStaffGroupAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "StaffGroup", targetId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, `Expected ${action} audit for staff group ${targetId}`);
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
  assert.equal(audit.userAgent, "staff-group-audit-api-integration-test");
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "staff-group-audit-api-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | undefined | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

function asJsonArray(value: Prisma.JsonValue | undefined) {
  assert.ok(Array.isArray(value), "Expected audit JSON array");
  return value as Prisma.JsonArray;
}

async function deniedAuditCount(fixture: Fixture) {
  return prisma.auditLog.count({
    where: { actorId: fixture.deniedAdminId, action: { startsWith: "staff_group." } },
  });
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.memberShift.deleteMany({ where: { memberId: { in: fixture.memberIds } } });
  await prisma.member.deleteMany({ where: { id: { in: fixture.memberIds } } });
  await prisma.staffGroup.deleteMany({ where: { id: { in: fixture.groupIds } } });
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
    prisma.member.count({ where: { id: { in: fixture.memberIds } } }),
    prisma.staffGroup.count({ where: { id: { in: fixture.groupIds } } }),
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
  console.log("ok staff-group audit integration fixture cleanup verified (0 records left)");
}

async function main() {
  assertSafeDatabaseTarget();
  const fixture = await createFixture();
  try {
    await runApiTests(fixture);
    await testAtomicRollback(fixture);
  } finally {
    await cleanupFixture(fixture);
  }
  console.log("Staff-group audit API integration tests passed (auth, policy state, privacy, side effects, atomicity, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
