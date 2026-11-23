-- Extend existing admin roles without removing legacy values.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'VENDOR_OWNER';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'GYM_OWNER';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'RECEPTION';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'DEVICE_OPERATOR';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'READ_ONLY_AUDITOR';
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM (
  'SIGN_IN',
  'ADMIN_USERS_MANAGE',
  'ROLES_MANAGE',
  'MEMBERS_VIEW',
  'MEMBERS_WRITE',
  'MEMBERS_DELETE',
  'MEMBERSHIPS_WRITE',
  'MEMBERSHIPS_CANCEL',
  'PAYMENTS_RECORD',
  'PAYMENTS_REVERSE',
  'FINANCIAL_REPORTS_VIEW',
  'FINANCIAL_EXPORT',
  'EXPENSES_MANAGE',
  'PAYROLL_MANAGE',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_MANUAL',
  'ATTENDANCE_JUSTIFY',
  'DEVICES_VIEW',
  'DEVICES_DIAGNOSTICS',
  'DEVICES_USER_SYNC',
  'DEVICES_ENROLL',
  'DEVICES_CLEAR_LOGS',
  'DOOR_UNLOCK',
  'SOUND_SETTINGS_MANAGE',
  'BACKUP_CREATE',
  'BACKUP_SETTINGS_MANAGE',
  'RESTORE_DATABASE',
  'LICENSE_VIEW',
  'LICENSE_ACTIVATE',
  'AUDIT_LOG_VIEW',
  'SYSTEM_SETTINGS_MANAGE'
);

-- CreateEnum
CREATE TYPE "PermissionMode" AS ENUM ('ALLOW', 'DENY');

-- AlterTable
ALTER TABLE "AdminUser"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "isProtected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FailedLoginAttempt"
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "reason" TEXT;

-- AlterTable
ALTER TABLE "AuditLog"
  ADD COLUMN "actorRole" "AdminRole",
  ADD COLUMN "success" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "requestId" TEXT,
  ADD COLUMN "beforeData" JSONB,
  ADD COLUMN "afterData" JSONB;

-- CreateTable
CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),

  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
  "id" TEXT NOT NULL,
  "role" "AdminRole" NOT NULL,
  "permission" "AdminPermission" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserPermission" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "permission" "AdminPermission" NOT NULL,
  "mode" "PermissionMode" NOT NULL DEFAULT 'ALLOW',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminUserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

-- CreateIndex
CREATE INDEX "AdminUser_isProtected_idx" ON "AdminUser"("isProtected");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_expiresAt_idx" ON "AdminSession"("adminUserId", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminSession_revokedAt_idx" ON "AdminSession"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_role_permission_key" ON "AdminRolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "AdminRolePermission_role_idx" ON "AdminRolePermission"("role");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permission_idx" ON "AdminRolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserPermission_adminUserId_permission_key" ON "AdminUserPermission"("adminUserId", "permission");

-- CreateIndex
CREATE INDEX "AdminUserPermission_permission_idx" ON "AdminUserPermission"("permission");

-- CreateIndex
CREATE INDEX "AdminUserPermission_mode_idx" ON "AdminUserPermission"("mode");

-- CreateIndex
CREATE INDEX "FailedLoginAttempt_ipAddress_occurredAt_idx" ON "FailedLoginAttempt"("ipAddress", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_createdAt_idx" ON "AuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "AuditLog_success_createdAt_idx" ON "AuditLog"("success", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserPermission" ADD CONSTRAINT "AdminUserPermission_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
