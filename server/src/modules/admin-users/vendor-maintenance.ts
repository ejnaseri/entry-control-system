import { AdminRole, AuditActor, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export const VENDOR_MAINTENANCE_USERNAME = "vendor-maintenance";
export const VENDOR_MAINTENANCE_FULL_NAME = "Vendor Maintenance";

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

type VendorMaintenanceWindow = {
  id: string;
  role: AdminRole;
  isActive: boolean;
  deactivatedAt: Date | null;
  vendorMaintenanceExpiresAt: Date | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export function hasActiveVendorMaintenanceWindow(user: VendorMaintenanceWindow, now = new Date()) {
  return (
    user.role === AdminRole.VENDOR_OWNER &&
    user.isActive &&
    !user.deactivatedAt &&
    Boolean(user.vendorMaintenanceExpiresAt) &&
    user.vendorMaintenanceExpiresAt! > now
  );
}

export function isExpiredVendorMaintenanceWindow(user: VendorMaintenanceWindow, now = new Date()) {
  return (
    user.role === AdminRole.VENDOR_OWNER &&
    user.isActive &&
    !user.deactivatedAt &&
    (!user.vendorMaintenanceExpiresAt || user.vendorMaintenanceExpiresAt <= now)
  );
}

export async function expireVendorMaintenanceUser(input: { userId: string; meta?: RequestMeta; reason?: string; now?: Date }, tx: DbClient = prisma) {
  const now = input.now ?? new Date();
  const user = await tx.adminUser.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      role: true,
      isActive: true,
      deactivatedAt: true,
      vendorMaintenanceExpiresAt: true,
    },
  });

  if (!user || !isExpiredVendorMaintenanceWindow(user, now)) {
    return false;
  }

  await tx.adminSession.updateMany({
    where: { adminUserId: user.id, revokedAt: null },
    data: { revokedAt: now },
  });

  await tx.adminUser.update({
    where: { id: user.id },
    data: {
      isActive: false,
      deactivatedAt: now,
      vendorMaintenanceExpiresAt: user.vendorMaintenanceExpiresAt ?? now,
    },
  });

  const auditData: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.SYSTEM,
    action: "vendor_maintenance.expired",
    targetType: "AdminUser",
    targetId: user.id,
    success: true,
    metadata: {
      reason: input.reason ?? "maintenance_window_expired",
      expiredAt: now.toISOString(),
    },
  };
  if (input.meta?.ipAddress) auditData.ipAddress = input.meta.ipAddress;
  if (input.meta?.userAgent) auditData.userAgent = input.meta.userAgent;

  await tx.auditLog.create({ data: auditData });
  return true;
}

export async function expireVendorMaintenanceIfNeeded(user: VendorMaintenanceWindow, meta?: RequestMeta) {
  if (!isExpiredVendorMaintenanceWindow(user)) {
    return false;
  }
  const input: Parameters<typeof expireVendorMaintenanceUser>[0] = { userId: user.id };
  if (meta) input.meta = meta;
  return expireVendorMaintenanceUser(input);
}
