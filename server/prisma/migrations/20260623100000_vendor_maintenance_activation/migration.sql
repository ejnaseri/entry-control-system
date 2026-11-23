-- Add time-boxed Vendor Maintenance activation fields to AdminUser.
ALTER TABLE "AdminUser"
  ADD COLUMN "vendorMaintenanceActivatedAt" TIMESTAMP(3),
  ADD COLUMN "vendorMaintenanceExpiresAt" TIMESTAMP(3),
  ADD COLUMN "vendorMaintenanceReason" TEXT,
  ADD COLUMN "vendorMaintenanceActivatedById" TEXT;

CREATE INDEX "AdminUser_role_vendorMaintenanceExpiresAt_idx"
  ON "AdminUser"("role", "vendorMaintenanceExpiresAt");

CREATE INDEX "AdminUser_vendorMaintenanceActivatedById_idx"
  ON "AdminUser"("vendorMaintenanceActivatedById");
