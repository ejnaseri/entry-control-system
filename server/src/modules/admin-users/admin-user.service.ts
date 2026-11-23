import { AdminRole, AuditActor, Prisma } from "@prisma/client";
import type { AppEdition } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { hashPassword } from "../auth/auth.service";
import { ensureDefaultRolePermissions } from "../auth/auth.permissions";
import {
  manageableAdminRoles,
  getManageableAdminRoles,
  type AdminUserCreateInput,
  type AdminUserUpdateInput,
  type VendorMaintenanceActivateInput,
  type VendorMaintenanceDeactivateInput,
} from "./admin-user.schemas";
import {
  expireVendorMaintenanceIfNeeded,
  hasActiveVendorMaintenanceWindow,
  VENDOR_MAINTENANCE_FULL_NAME,
  VENDOR_MAINTENANCE_USERNAME,
} from "./vendor-maintenance";

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type AdminActor = {
  id: string;
  role: AdminRole;
  sessionId?: string;
};

type AdminActionContext = {
  actor: AdminActor;
  meta: RequestMeta;
};

const adminUserSelect = {
  id: true,
  username: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  isProtected: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  deactivatedAt: true,
  vendorMaintenanceActivatedAt: true,
  vendorMaintenanceExpiresAt: true,
  vendorMaintenanceReason: true,
  vendorMaintenanceActivatedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminUserSelect;

type AdminUserRow = Prisma.AdminUserGetPayload<{ select: typeof adminUserSelect }>;

const weakPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "admin12345",
  "atlasgym123",
  "qwerty123",
]);

function toAuditJson(value: AdminUserRow): Prisma.InputJsonObject {
  return {
    id: value.id,
    username: value.username,
    email: value.email,
    fullName: value.fullName,
    role: value.role,
    isActive: value.isActive,
    isProtected: value.isProtected,
    deactivatedAt: value.deactivatedAt?.toISOString() ?? null,
    vendorMaintenanceActivatedAt: value.vendorMaintenanceActivatedAt?.toISOString() ?? null,
    vendorMaintenanceExpiresAt: value.vendorMaintenanceExpiresAt?.toISOString() ?? null,
    vendorMaintenanceReason: value.vendorMaintenanceReason,
    vendorMaintenanceActivatedById: value.vendorMaintenanceActivatedById,
  };
}

async function writeAdminAudit(input: {
  context: AdminActionContext;
  action: string;
  targetId: string;
  before?: AdminUserRow;
  after?: AdminUserRow;
  metadata?: Prisma.InputJsonObject;
}) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: input.context.actor.id,
    actorRole: input.context.actor.role,
    action: input.action,
    targetType: "AdminUser",
    targetId: input.targetId,
    success: true,
  };

  if (input.context.actor.sessionId) data.sessionId = input.context.actor.sessionId;
  if (input.context.meta.ipAddress) data.ipAddress = input.context.meta.ipAddress;
  if (input.context.meta.userAgent) data.userAgent = input.context.meta.userAgent;
  if (input.before) data.beforeData = toAuditJson(input.before);
  if (input.after) data.afterData = toAuditJson(input.after);
  if (input.metadata) data.metadata = input.metadata;

  await prisma.auditLog.create({ data });
}

function assertAssignableRole(actor: AdminActor, role: AdminRole, edition: AppEdition) {
  if (!getManageableAdminRoles(edition).includes(role)) {
    throw new HttpError(403, "This role cannot be managed from admin user management");
  }
  if (role === AdminRole.GYM_OWNER && actor.role !== AdminRole.GYM_OWNER && actor.role !== AdminRole.VENDOR_OWNER) {
    throw new HttpError(403, "Only a gym owner can create or assign the gym owner role");
  }
}

function assertTargetManageable(target: AdminUserRow) {
  if (target.isProtected || target.role === AdminRole.VENDOR_OWNER) {
    throw new HttpError(403, "Protected vendor maintenance users cannot be managed here");
  }
}

function assertPasswordAllowed(password: string, username: string) {
  if (weakPasswords.has(password.toLowerCase())) {
    throw new HttpError(400, "Password is too common");
  }
  if (password.toLowerCase().includes(username.toLowerCase())) {
    throw new HttpError(400, "Password must not contain the username");
  }
}

function getRemainingSeconds(expiresAt: Date | null, now = new Date()) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

function toVendorMaintenanceStatus(user: AdminUserRow | null, now = new Date()) {
  const active = user ? hasActiveVendorMaintenanceWindow(user, now) : false;
  return {
    active,
    username: user?.username ?? VENDOR_MAINTENANCE_USERNAME,
    user,
    activatedAt: user?.vendorMaintenanceActivatedAt ?? null,
    expiresAt: user?.vendorMaintenanceExpiresAt ?? null,
    reason: user?.vendorMaintenanceReason ?? null,
    activatedById: user?.vendorMaintenanceActivatedById ?? null,
    remainingSeconds: user ? getRemainingSeconds(user.vendorMaintenanceExpiresAt, now) : null,
  };
}

async function getVendorMaintenanceUser() {
  return prisma.adminUser.findFirst({
    where: { role: AdminRole.VENDOR_OWNER },
    select: adminUserSelect,
    orderBy: { createdAt: "asc" },
  });
}

async function expireVendorMaintenanceRows() {
  const users = await prisma.adminUser.findMany({
    where: {
      role: AdminRole.VENDOR_OWNER,
      isActive: true,
      deactivatedAt: null,
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      deactivatedAt: true,
      vendorMaintenanceExpiresAt: true,
    },
  });

  for (const user of users) {
    await expireVendorMaintenanceIfNeeded(user);
  }
}

async function assertUniqueLogin(input: { username?: string | undefined; email?: string | null | undefined; excludeId?: string }) {
  const filters: Prisma.AdminUserWhereInput[] = [];
  if (input.username) filters.push({ username: input.username });
  if (input.email) filters.push({ email: input.email });
  if (filters.length === 0) return;

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: filters,
      ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}),
    },
    select: { id: true, username: true, email: true },
  });

  if (!existing) return;
  if (input.username && existing.username === input.username) {
    throw new HttpError(409, "Username is already in use");
  }
  throw new HttpError(409, "Email is already in use");
}

async function assertCanRemoveGymOwnerCapacity(target: AdminUserRow) {
  if (target.role !== AdminRole.GYM_OWNER || !target.isActive || target.deactivatedAt) return;

  const otherActiveGymOwners = await prisma.adminUser.count({
    where: {
      id: { not: target.id },
      role: AdminRole.GYM_OWNER,
      isActive: true,
      deactivatedAt: null,
    },
  });

  if (otherActiveGymOwners === 0) {
    throw new HttpError(400, "At least one active gym owner is required");
  }
}

async function getAdminUserOrThrow(id: string) {
  const user = await prisma.adminUser.findUnique({
    where: { id },
    select: adminUserSelect,
  });
  if (!user) {
    throw new HttpError(404, "Admin user not found");
  }
  return user;
}

export function listAdminRoles(edition: AppEdition = "FULL") {
  return getManageableAdminRoles(edition);
}

export async function listAdminUsers(edition: AppEdition = "FULL") {
  await ensureDefaultRolePermissions();
  await expireVendorMaintenanceRows();
  const users = await prisma.adminUser.findMany({
    select: adminUserSelect,
    orderBy: [{ isProtected: "asc" }, { role: "asc" }, { createdAt: "asc" }],
  });
  return { items: users, roles: listAdminRoles(edition) };
}

export async function createAdminUser(input: AdminUserCreateInput, context: AdminActionContext, edition: AppEdition = "FULL") {
  assertAssignableRole(context.actor, input.role, edition);
  assertPasswordAllowed(input.password, input.username);
  await assertUniqueLogin({ username: input.username, email: input.email ?? null });
  await ensureDefaultRolePermissions();

  const passwordHash = await hashPassword(input.password);
  const data: Prisma.AdminUserUncheckedCreateInput = {
    username: input.username,
    passwordHash,
    role: input.role,
    passwordChangedAt: new Date(),
  };
  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;

  const user = await prisma.adminUser.create({
    data,
    select: adminUserSelect,
  });

  await writeAdminAudit({
    context,
    action: "admin_user.create",
    targetId: user.id,
    after: user,
    metadata: { role: user.role },
  });

  return user;
}

export async function updateAdminUser(id: string, input: AdminUserUpdateInput, context: AdminActionContext, edition: AppEdition = "FULL") {
  const before = await getAdminUserOrThrow(id);
  assertTargetManageable(before);

  if (input.role) {
    assertAssignableRole(context.actor, input.role, edition);
    if (before.id === context.actor.id && input.role !== before.role) {
      throw new HttpError(400, "You cannot change your own role");
    }
    if (before.role === AdminRole.GYM_OWNER && input.role !== AdminRole.GYM_OWNER) {
      await assertCanRemoveGymOwnerCapacity(before);
    }
  }

  await assertUniqueLogin({
    username: input.username,
    email: input.email ?? undefined,
    excludeId: id,
  });

  const data: Prisma.AdminUserUncheckedUpdateInput = {};
  if (input.username !== undefined) data.username = input.username;
  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.role !== undefined) data.role = input.role;

  const after = await prisma.adminUser.update({
    where: { id },
    data,
    select: adminUserSelect,
  });

  await writeAdminAudit({
    context,
    action: "admin_user.update",
    targetId: id,
    before,
    after,
  });

  return after;
}

export async function resetAdminUserPassword(id: string, password: string, context: AdminActionContext) {
  const before = await getAdminUserOrThrow(id);
  assertTargetManageable(before);
  assertPasswordAllowed(password, before.username);

  const after = await prisma.adminUser.update({
    where: { id },
    data: {
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      sessions: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      },
    },
    select: adminUserSelect,
  });

  await writeAdminAudit({
    context,
    action: "admin_user.reset_password",
    targetId: id,
    before,
    after,
  });

  return after;
}

export async function deactivateAdminUser(id: string, context: AdminActionContext) {
  const before = await getAdminUserOrThrow(id);
  assertTargetManageable(before);
  if (before.id === context.actor.id) {
    throw new HttpError(400, "You cannot deactivate your own account");
  }
  await assertCanRemoveGymOwnerCapacity(before);

  const after = await prisma.adminUser.update({
    where: { id },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      sessions: {
        updateMany: {
          where: { revokedAt: null },
          data: { revokedAt: new Date() },
        },
      },
    },
    select: adminUserSelect,
  });

  await writeAdminAudit({
    context,
    action: "admin_user.deactivate",
    targetId: id,
    before,
    after,
  });

  return after;
}

export async function reactivateAdminUser(id: string, context: AdminActionContext) {
  const before = await getAdminUserOrThrow(id);
  assertTargetManageable(before);

  const after = await prisma.adminUser.update({
    where: { id },
    data: {
      isActive: true,
      deactivatedAt: null,
    },
    select: adminUserSelect,
  });

  await writeAdminAudit({
    context,
    action: "admin_user.reactivate",
    targetId: id,
    before,
    after,
  });

  return after;
}

export async function getVendorMaintenanceStatus() {
  await expireVendorMaintenanceRows();
  const user = await getVendorMaintenanceUser();
  return toVendorMaintenanceStatus(user);
}

export async function activateVendorMaintenance(input: VendorMaintenanceActivateInput, context: AdminActionContext) {
  if (context.actor.role !== AdminRole.GYM_OWNER) {
    throw new HttpError(403, "Only a gym owner can activate vendor maintenance access");
  }

  assertPasswordAllowed(input.password, VENDOR_MAINTENANCE_USERNAME);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.durationMinutes * 60 * 1000);
  const passwordHash = await hashPassword(input.password);

  const result = await prisma.$transaction(async (tx) => {
    await ensureDefaultRolePermissions(tx);

    const usernameOwner = await tx.adminUser.findUnique({
      where: { username: VENDOR_MAINTENANCE_USERNAME },
      select: adminUserSelect,
    });
    if (usernameOwner && usernameOwner.role !== AdminRole.VENDOR_OWNER) {
      throw new HttpError(409, "The vendor maintenance username is already used by another admin user");
    }

    const existing =
      usernameOwner ??
      (await tx.adminUser.findFirst({
        where: { role: AdminRole.VENDOR_OWNER },
        select: adminUserSelect,
        orderBy: { createdAt: "asc" },
      }));

    if (existing) {
      await tx.adminSession.updateMany({
        where: { adminUserId: existing.id, revokedAt: null },
        data: { revokedAt: now },
      });

      const after = await tx.adminUser.update({
        where: { id: existing.id },
        data: {
          username: VENDOR_MAINTENANCE_USERNAME,
          email: null,
          fullName: VENDOR_MAINTENANCE_FULL_NAME,
          role: AdminRole.VENDOR_OWNER,
          isActive: true,
          isProtected: true,
          passwordHash,
          passwordChangedAt: now,
          deactivatedAt: null,
          vendorMaintenanceActivatedAt: now,
          vendorMaintenanceExpiresAt: expiresAt,
          vendorMaintenanceReason: input.reason,
          vendorMaintenanceActivatedById: context.actor.id,
        },
        select: adminUserSelect,
      });

      return { before: existing, after };
    }

    const after = await tx.adminUser.create({
      data: {
        username: VENDOR_MAINTENANCE_USERNAME,
        email: null,
        fullName: VENDOR_MAINTENANCE_FULL_NAME,
        passwordHash,
        role: AdminRole.VENDOR_OWNER,
        isActive: true,
        isProtected: true,
        passwordChangedAt: now,
        vendorMaintenanceActivatedAt: now,
        vendorMaintenanceExpiresAt: expiresAt,
        vendorMaintenanceReason: input.reason,
        vendorMaintenanceActivatedById: context.actor.id,
      },
      select: adminUserSelect,
    });

    return { before: undefined, after };
  });

  const auditInput: Parameters<typeof writeAdminAudit>[0] = {
    context,
    action: "vendor_maintenance.activate",
    targetId: result.after.id,
    after: result.after,
    metadata: {
      durationMinutes: input.durationMinutes,
      expiresAt: expiresAt.toISOString(),
      reason: input.reason,
    },
  };
  if (result.before) auditInput.before = result.before;
  await writeAdminAudit(auditInput);

  return toVendorMaintenanceStatus(result.after);
}

export async function deactivateVendorMaintenance(input: VendorMaintenanceDeactivateInput, context: AdminActionContext) {
  if (context.actor.role !== AdminRole.GYM_OWNER && context.actor.role !== AdminRole.VENDOR_OWNER) {
    throw new HttpError(403, "Only a gym owner or active vendor maintenance user can deactivate vendor maintenance access");
  }

  await expireVendorMaintenanceRows();
  const before = await getVendorMaintenanceUser();
  if (!before) {
    return toVendorMaintenanceStatus(null);
  }
  if (!before.isActive || before.deactivatedAt) {
    return toVendorMaintenanceStatus(before);
  }

  const now = new Date();
  const after = await prisma.$transaction(async (tx) => {
    await tx.adminSession.updateMany({
      where: { adminUserId: before.id, revokedAt: null },
      data: { revokedAt: now },
    });

    return tx.adminUser.update({
      where: { id: before.id },
      data: {
        isActive: false,
        deactivatedAt: now,
        vendorMaintenanceExpiresAt: now,
        ...(input.reason ? { vendorMaintenanceReason: input.reason } : {}),
      },
      select: adminUserSelect,
    });
  });

  await writeAdminAudit({
    context,
    action: "vendor_maintenance.deactivate",
    targetId: after.id,
    before,
    after,
    metadata: {
      reason: input.reason ?? null,
      deactivatedAt: now.toISOString(),
    },
  });

  return toVendorMaintenanceStatus(after);
}
