import { randomBytes, createHash } from "crypto";
import argon2 from "argon2";
import { AdminRole, AuditActor, Prisma, type AdminPermission } from "@prisma/client";
import { getEffectiveFeatures } from "../../config/capabilities";
import { env, runtimeOptionalFeatureFlags } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import { expireVendorMaintenanceIfNeeded } from "../admin-users/vendor-maintenance";
import { ensureDefaultRolePermissions, listEffectivePermissions } from "./auth.permissions";
import type { LoginInput, SetupOwnerInput } from "./auth.schemas";

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

const publicAdminUserSelect = {
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

type PublicAdminUser = Prisma.AdminUserGetPayload<{ select: typeof publicAdminUserSelect }>;

type PublicAuthSession = {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
};

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function getSessionExpiry() {
  return new Date(Date.now() + env.AUTH_SESSION_HOURS * 60 * 60 * 1000);
}

export async function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

function toPublicUser(user: PublicAdminUser) {
  return user;
}

function buildAuthPayload(
  user: PublicAdminUser,
  permissions: readonly AdminPermission[],
  session: PublicAuthSession
) {
  const publicSession = {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  };

  return {
    edition: env.APP_EDITION,
    features: getEffectiveFeatures(env.APP_EDITION, runtimeOptionalFeatureFlags),
    permissions,
    user: toPublicUser(user),
    session: publicSession,
    // Compatibility alias for existing setup/login API consumers.
    expiresAt: publicSession.expiresAt,
  };
}

function getSetupActiveAdminWhere(now = new Date()): Prisma.AdminUserWhereInput {
  return {
    isActive: true,
    deactivatedAt: null,
    OR: [{ role: { not: AdminRole.VENDOR_OWNER } }, { vendorMaintenanceExpiresAt: { gt: now } }],
  };
}

async function writeAuditLog(input: {
  actorType: AuditActor;
  action: string;
  success: boolean;
  meta: RequestMeta;
  actorId?: string;
  actorRole?: AdminRole;
  sessionId?: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonObject;
}) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: input.actorType,
    action: input.action,
    success: input.success,
  };

  if (input.actorId) data.actorId = input.actorId;
  if (input.actorRole) data.actorRole = input.actorRole;
  if (input.sessionId) data.sessionId = input.sessionId;
  if (input.targetType) data.targetType = input.targetType;
  if (input.targetId) data.targetId = input.targetId;
  if (input.meta.ipAddress) data.ipAddress = input.meta.ipAddress;
  if (input.meta.userAgent) data.userAgent = input.meta.userAgent;
  if (input.metadata) data.metadata = input.metadata;

  await prisma.auditLog.create({ data });
}

async function recordFailedLogin(input: {
  username: string;
  meta: RequestMeta;
  reason: string;
  adminUserId?: string;
}) {
  const data: Prisma.FailedLoginAttemptUncheckedCreateInput = {
    username: input.username,
    reason: input.reason,
  };

  if (input.adminUserId) data.adminUserId = input.adminUserId;
  if (input.meta.ipAddress) data.ipAddress = input.meta.ipAddress;
  if (input.meta.userAgent) data.userAgent = input.meta.userAgent;

  await prisma.failedLoginAttempt.create({ data });
  const auditInput: Parameters<typeof writeAuditLog>[0] = {
    actorType: AuditActor.SYSTEM,
    action: "auth.login_failed",
    success: false,
    meta: input.meta,
    targetType: "AdminUser",
    metadata: {
      username: input.username,
      reason: input.reason,
    },
  };
  if (input.adminUserId) {
    auditInput.targetId = input.adminUserId;
  }
  await writeAuditLog(auditInput);
}

async function createSession(adminUserId: string, meta: RequestMeta) {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiry();
  const data: Prisma.AdminSessionUncheckedCreateInput = {
    adminUserId,
    tokenHash,
    expiresAt,
  };

  if (meta.ipAddress) data.ipAddress = meta.ipAddress;
  if (meta.userAgent) data.userAgent = meta.userAgent;

  const session = await prisma.adminSession.create({ data });
  return { token, expiresAt, session };
}

export async function getSetupStatus() {
  const now = new Date();
  const activeAdminWhere = getSetupActiveAdminWhere(now);
  const [activeAdminCount, gymOwnerCount, vendorOwnerCount] = await Promise.all([
    prisma.adminUser.count({ where: activeAdminWhere }),
    prisma.adminUser.count({ where: { role: AdminRole.GYM_OWNER, isActive: true, deactivatedAt: null } }),
    prisma.adminUser.count({
      where: {
        role: AdminRole.VENDOR_OWNER,
        isActive: true,
        deactivatedAt: null,
        vendorMaintenanceExpiresAt: { gt: now },
      },
    }),
  ]);

  return {
    setupRequired: activeAdminCount === 0,
    activeAdminCount,
    hasGymOwner: gymOwnerCount > 0,
    hasVendorOwner: vendorOwnerCount > 0,
  };
}

export async function setupGymOwner(input: SetupOwnerInput, meta: RequestMeta) {
  const passwordHash = await hashPassword(input.password);
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = getSessionExpiry();

  const result = await prisma.$transaction(async (tx) => {
    const activeAdminCount = await tx.adminUser.count({ where: getSetupActiveAdminWhere() });
    if (activeAdminCount > 0) {
      throw new HttpError(409, "Initial setup has already been completed");
    }

    await ensureDefaultRolePermissions(tx);

    const adminData: Prisma.AdminUserUncheckedCreateInput = {
      username: input.username,
      passwordHash,
      role: AdminRole.GYM_OWNER,
      passwordChangedAt: new Date(),
    };
    if (input.email) adminData.email = input.email;
    if (input.fullName) adminData.fullName = input.fullName;

    const user = await tx.adminUser.create({
      data: adminData,
      select: publicAdminUserSelect,
    });

    const sessionData: Prisma.AdminSessionUncheckedCreateInput = {
      adminUserId: user.id,
      tokenHash,
      expiresAt,
    };
    if (meta.ipAddress) sessionData.ipAddress = meta.ipAddress;
    if (meta.userAgent) sessionData.userAgent = meta.userAgent;

    const session = await tx.adminSession.create({ data: sessionData });

    const auditData: Prisma.AuditLogUncheckedCreateInput = {
      actorType: AuditActor.ADMIN,
      actorId: user.id,
      actorRole: user.role,
      action: "auth.setup_gym_owner",
      targetType: "AdminUser",
      targetId: user.id,
      sessionId: session.id,
      success: true,
      metadata: { username: user.username },
    };
    if (meta.ipAddress) auditData.ipAddress = meta.ipAddress;
    if (meta.userAgent) auditData.userAgent = meta.userAgent;
    await tx.auditLog.create({ data: auditData });

    return { user, session };
  });

  const permissions = await listEffectivePermissions(result.user.id, result.user.role);
  return {
    auth: buildAuthPayload(result.user, permissions, result.session),
    sessionToken: token,
  };
}

export async function login(input: LoginInput, meta: RequestMeta) {
  const userWithPassword = await prisma.adminUser.findFirst({
    where: {
      OR: [{ username: input.username }, { email: input.username }],
    },
    select: {
      ...publicAdminUserSelect,
      passwordHash: true,
    },
  });

  if (!userWithPassword) {
    await recordFailedLogin({ username: input.username, meta, reason: "unknown_user" });
    throw new HttpError(401, "Invalid username or password");
  }

  if (await expireVendorMaintenanceIfNeeded(userWithPassword, meta)) {
    await recordFailedLogin({
      username: input.username,
      meta,
      reason: "vendor_maintenance_expired",
      adminUserId: userWithPassword.id,
    });
    throw new HttpError(401, "Invalid username or password");
  }

  if (!userWithPassword.isActive || userWithPassword.deactivatedAt) {
    await recordFailedLogin({
      username: input.username,
      meta,
      reason: "inactive_user",
      adminUserId: userWithPassword.id,
    });
    throw new HttpError(401, "Invalid username or password");
  }

  const passwordMatches = await verifyPassword(userWithPassword.passwordHash, input.password);
  if (!passwordMatches) {
    await recordFailedLogin({
      username: input.username,
      meta,
      reason: "invalid_password",
      adminUserId: userWithPassword.id,
    });
    throw new HttpError(401, "Invalid username or password");
  }

  const { token, expiresAt, session } = await createSession(userWithPassword.id, meta);
  const user = await prisma.adminUser.update({
    where: { id: userWithPassword.id },
    data: { lastLoginAt: new Date() },
    select: publicAdminUserSelect,
  });

  await writeAuditLog({
    actorType: AuditActor.ADMIN,
    actorId: user.id,
    actorRole: user.role,
    sessionId: session.id,
    action: "auth.login_success",
    success: true,
    meta,
    targetType: "AdminUser",
    targetId: user.id,
  });

  const permissions = await listEffectivePermissions(user.id, user.role);
  return {
    auth: buildAuthPayload(user, permissions, session),
    sessionToken: token,
  };
}

export async function getCurrentAuth(sessionToken: string | undefined, meta: RequestMeta) {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: {
      adminUser: {
        select: publicAdminUserSelect,
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    return null;
  }

  if (await expireVendorMaintenanceIfNeeded(session.adminUser, meta)) {
    return null;
  }

  if (!session.adminUser.isActive || session.adminUser.deactivatedAt) {
    return null;
  }

  const lastSeenAt = new Date();
  const sessionUpdate: Prisma.AdminSessionUncheckedUpdateInput = { lastSeenAt };
  if (meta.ipAddress) sessionUpdate.ipAddress = meta.ipAddress;
  if (meta.userAgent) sessionUpdate.userAgent = meta.userAgent;

  await prisma.adminSession.update({
    where: { id: session.id },
    data: sessionUpdate,
  });

  const permissions = await listEffectivePermissions(session.adminUser.id, session.adminUser.role);
  return buildAuthPayload(session.adminUser, permissions, {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt,
    expiresAt: session.expiresAt,
  });
}

export async function logout(sessionToken: string | undefined, meta: RequestMeta) {
  if (!sessionToken) {
    return;
  }

  const tokenHash = hashSessionToken(sessionToken);
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash },
    include: {
      adminUser: {
        select: {
          id: true,
          role: true,
        },
      },
    },
  });

  if (!session || session.revokedAt) {
    return;
  }

  await prisma.adminSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  await writeAuditLog({
    actorType: AuditActor.ADMIN,
    actorId: session.adminUser.id,
    actorRole: session.adminUser.role,
    sessionId: session.id,
    action: "auth.logout",
    success: true,
    meta,
    targetType: "AdminSession",
    targetId: session.id,
  });
}
