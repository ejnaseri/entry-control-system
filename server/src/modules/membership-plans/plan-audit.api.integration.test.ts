import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import {
  AdminPermission,
  AdminRole,
  AuditActor,
  PermissionMode,
  PlanDurationUnit,
  type Prisma,
} from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requirePermission } from "../../middlewares/auth";
import { errorHandler } from "../../middlewares/error-handler";
import type { MembershipPlanInput } from "../../shared/membership.types";
import { planRouter } from "./plan.router";
import {
  createMembershipPlan,
  softDeletePlan,
  updateMembershipPlan,
  type PlanActionContext,
} from "./plan.service";

type Fixture = {
  suffix: string;
  allowedAdminId: string;
  allowedSessionId: string;
  allowedToken: string;
  deniedAdminId: string;
  deniedSessionId: string;
  deniedToken: string;
  planIds: string[];
};

function assertSafeDatabaseTarget() {
  if (env.NODE_ENV === "production") {
    throw new Error("Plan audit API integration tests refuse to run with NODE_ENV=production");
  }
  const hostname = new URL(env.DATABASE_URL).hostname.toLowerCase();
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!localHosts.has(hostname) && process.env["PLAN_AUDIT_API_INTEGRATION_ALLOW_REMOTE"] !== "1") {
    throw new Error(`Plan audit API integration tests refuse non-local database host: ${hostname}`);
  }
}

async function createFixture(): Promise<Fixture> {
  const suffix = randomUUID();
  const allowedToken = `plan-audit-allowed-${suffix}`;
  const deniedToken = `plan-audit-denied-${suffix}`;
  const records = await prisma.$transaction(async (tx) => {
    const allowedAdmin = await tx.adminUser.create({
      data: {
        username: `it-plan-audit-allowed-${suffix}`,
        passwordHash: "not-used-by-plan-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    const deniedAdmin = await tx.adminUser.create({
      data: {
        username: `it-plan-audit-denied-${suffix}`,
        passwordHash: "not-used-by-plan-audit-integration-test",
        role: AdminRole.STAFF,
      },
    });
    await tx.adminUserPermission.createMany({
      data: [
        permissionRow(allowedAdmin.id, AdminPermission.MEMBERSHIPS_WRITE, PermissionMode.ALLOW),
        permissionRow(allowedAdmin.id, AdminPermission.SYSTEM_SETTINGS_MANAGE, PermissionMode.ALLOW),
        permissionRow(deniedAdmin.id, AdminPermission.MEMBERSHIPS_WRITE, PermissionMode.ALLOW),
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
    planIds: [],
  };
}

function permissionRow(adminUserId: string, permission: AdminPermission, mode: PermissionMode) {
  return {
    adminUserId,
    permission,
    mode,
    reason: "Membership plan audit API integration fixture",
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(
    "/api/v1/membership-plans",
    requirePermission(AdminPermission.MEMBERSHIPS_WRITE),
    planRouter
  );
  app.use(errorHandler);
  return app;
}

function planPayload(fixture: Fixture, label = "Primary", overrides: Partial<MembershipPlanInput> = {}) {
  return {
    name: `${label} Audit Plan ${fixture.suffix}`,
    description: `Private plan description ${label} ${fixture.suffix}`,
    durationValue: 1,
    durationUnit: PlanDurationUnit.MONTHS,
    basePrice: 1_000,
    isActive: true,
    ...overrides,
  } satisfies MembershipPlanInput;
}

async function runApiTests(fixture: Fixture) {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1/membership-plans`;
    await testGuardsAndCreate(baseUrl, fixture);
    await testUpdate(baseUrl, fixture);
    await testSoftDeleteAndIdempotency(baseUrl, fixture);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      })
    );
  }
}

async function testGuardsAndCreate(baseUrl: string, fixture: Fixture) {
  const payload = planPayload(fixture);
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
  assert.equal(await prisma.membershipPlan.count({ where: { name: payload.name } }), 0);
  assert.equal(await deniedAuditCount(fixture), 0);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 201);
  const created = await response.json() as { id: string; name: string; basePrice: number; isActive: boolean };
  fixture.planIds.push(created.id);
  assert.equal(created.name, payload.name);
  assert.equal(created.basePrice, 1_000);
  assert.equal(created.isActive, true);

  const audit = await findPlanAudit("membership_plan.created", created.id);
  assertAuditAttribution(audit, fixture);
  const afterData = asJsonObject(audit.afterData);
  assert.equal(afterData["id"], created.id);
  assert.equal(afterData["name"], payload.name);
  assert.equal(afterData["durationValue"], 1);
  assert.equal(afterData["durationUnit"], PlanDurationUnit.MONTHS);
  assert.equal(afterData["durationDays"], 30);
  assert.equal(afterData["basePrice"], 1_000);
  assert.equal(afterData["isActive"], true);
  assert.equal(Object.prototype.hasOwnProperty.call(afterData, "description"), false);
  assert.equal(JSON.stringify(audit).includes(payload.description!), false);
  console.log("ok plan creation is permission-guarded and writes an attributed private audit");
}

async function testUpdate(baseUrl: string, fixture: Fixture) {
  const planId = fixture.planIds[0];
  assert.ok(planId);
  const payload = planPayload(fixture, "Updated", {
    durationValue: 2,
    basePrice: 2_500,
  });
  const denied = await fetch(`${baseUrl}/${planId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.deniedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.SYSTEM_SETTINGS_MANAGE
  );
  assert.equal((await prisma.membershipPlan.findUniqueOrThrow({ where: { id: planId } })).basePrice, 1_000);

  const response = await fetch(`${baseUrl}/${planId}`, {
    method: "PUT",
    headers: authenticatedHeaders(fixture.allowedToken),
    body: JSON.stringify(payload),
  });
  assert.equal(response.status, 200);
  const updated = await response.json() as { id: string; basePrice: number; durationDays: number };
  assert.equal(updated.basePrice, 2_500);
  assert.equal(updated.durationDays, 60);

  const audit = await findPlanAudit("membership_plan.updated", planId);
  assertAuditAttribution(audit, fixture);
  const beforeData = asJsonObject(audit.beforeData);
  const afterData = asJsonObject(audit.afterData);
  const metadata = asJsonObject(audit.metadata);
  assert.equal(beforeData["basePrice"], 1_000);
  assert.equal(beforeData["durationDays"], 30);
  assert.equal(afterData["basePrice"], 2_500);
  assert.equal(afterData["durationDays"], 60);
  assert.ok(Array.isArray(metadata["changedFields"]));
  const changedFields = metadata["changedFields"] as Prisma.JsonArray;
  assert.ok(changedFields.includes("name"));
  assert.ok(changedFields.includes("description"));
  assert.ok(changedFields.includes("durationValue"));
  assert.ok(changedFields.includes("basePrice"));
  assert.equal(JSON.stringify(audit).includes(payload.description!), false);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok plan update stores safe price/duration before-after data without description values");
}

async function testSoftDeleteAndIdempotency(baseUrl: string, fixture: Fixture) {
  const planId = fixture.planIds[0];
  assert.ok(planId);
  const denied = await fetch(`${baseUrl}/${planId}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.deniedToken),
  });
  assert.equal(denied.status, 403);
  assert.equal(
    (await denied.json() as { requiredPermission: string }).requiredPermission,
    AdminPermission.SYSTEM_SETTINGS_MANAGE
  );
  assert.equal((await prisma.membershipPlan.findUniqueOrThrow({ where: { id: planId } })).isActive, true);

  const response = await fetch(`${baseUrl}/${planId}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { isActive: boolean }).isActive, false);

  const firstAudit = await findPlanAudit("membership_plan.deleted", planId);
  assertAuditAttribution(firstAudit, fixture);
  const beforeData = asJsonObject(firstAudit.beforeData);
  const afterData = asJsonObject(firstAudit.afterData);
  const metadata = asJsonObject(firstAudit.metadata);
  assert.equal(beforeData["isActive"], true);
  assert.equal(afterData["isActive"], false);
  assert.equal(metadata["mode"], "SOFT_DELETE");
  assert.equal(metadata["alreadyInactive"], false);
  assert.equal(metadata["linkedMembershipCount"], 0);

  const repeated = await fetch(`${baseUrl}/${planId}`, {
    method: "DELETE",
    headers: authenticatedHeaders(fixture.allowedToken),
  });
  assert.equal(repeated.status, 200);
  assert.equal(((await repeated.json()) as { isActive: boolean }).isActive, false);
  const deleteAudits = await prisma.auditLog.findMany({
    where: { action: "membership_plan.deleted", targetType: "MembershipPlan", targetId: planId },
    orderBy: { createdAt: "asc" },
  });
  assert.equal(deleteAudits.length, 2);
  assert.equal(asJsonObject(deleteAudits[1]!.metadata)["alreadyInactive"], true);
  assert.equal(await deniedAuditCount(fixture), 0);
  console.log("ok plan soft-delete preserves history and explicitly audits repeated inactive requests");
}

async function testAtomicRollback(fixture: Fixture) {
  const invalidContext: PlanActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: `missing-plan-session-${fixture.suffix}`,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "plan-audit-rollback-test" },
  };
  const validContext: PlanActionContext = {
    actor: {
      id: fixture.allowedAdminId,
      role: AdminRole.STAFF,
      sessionId: fixture.allowedSessionId,
    },
    meta: { ipAddress: "127.0.0.1", userAgent: "plan-audit-rollback-test" },
  };

  const failedCreatePayload = planPayload(fixture, "Failed Create");
  await assert.rejects(() => createMembershipPlan(failedCreatePayload, invalidContext));
  assert.equal(await prisma.membershipPlan.count({ where: { name: failedCreatePayload.name } }), 0);

  const planId = fixture.planIds[0];
  assert.ok(planId);
  const beforeUpdate = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: planId } });
  await assert.rejects(() =>
    updateMembershipPlan(
      planId,
      planPayload(fixture, "Failed Update", { basePrice: 9_999, isActive: true }),
      invalidContext
    )
  );
  const afterFailedUpdate = await prisma.membershipPlan.findUniqueOrThrow({ where: { id: planId } });
  assert.equal(afterFailedUpdate.name, beforeUpdate.name);
  assert.equal(afterFailedUpdate.basePrice, beforeUpdate.basePrice);
  assert.equal(afterFailedUpdate.isActive, beforeUpdate.isActive);

  const deleteRollbackPlan = await createMembershipPlan(planPayload(fixture, "Delete Rollback"), validContext);
  fixture.planIds.push(deleteRollbackPlan.id);
  await assert.rejects(() => softDeletePlan(deleteRollbackPlan.id, invalidContext));
  assert.equal(
    (await prisma.membershipPlan.findUniqueOrThrow({ where: { id: deleteRollbackPlan.id } })).isActive,
    true
  );
  console.log("ok failed plan audits atomically roll back create, update, and soft-delete mutations");
}

async function findPlanAudit(action: string, targetId: string) {
  const audit = await prisma.auditLog.findFirst({
    where: { action, targetType: "MembershipPlan", targetId },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(audit, `Expected ${action} audit for plan ${targetId}`);
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
  assert.equal(audit.userAgent, "plan-audit-api-integration-test");
}

function authenticatedHeaders(token: string) {
  return {
    "content-type": "application/json",
    cookie: `${env.AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "user-agent": "plan-audit-api-integration-test",
  };
}

function asJsonObject(value: Prisma.JsonValue | null) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), "Expected audit JSON object");
  return value as Prisma.JsonObject;
}

async function deniedAuditCount(fixture: Fixture) {
  return prisma.auditLog.count({
    where: { actorId: fixture.deniedAdminId, action: { startsWith: "membership_plan." } },
  });
}

async function cleanupFixture(fixture: Fixture) {
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: [fixture.allowedAdminId, fixture.deniedAdminId] } },
  });
  await prisma.membershipPlan.deleteMany({ where: { id: { in: fixture.planIds } } });
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
    prisma.membershipPlan.count({ where: { id: { in: fixture.planIds } } }),
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
  assert.deepEqual(leftovers, [0, 0, 0, 0, 0]);
  console.log("ok plan audit integration fixture cleanup verified (0 records left)");
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
  console.log("Membership plan audit API integration tests passed (auth, privacy, atomicity, idempotency, cleanup).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
