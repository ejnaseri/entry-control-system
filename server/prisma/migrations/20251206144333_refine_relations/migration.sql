-- DropForeignKey
ALTER TABLE "DeviceRawLog" DROP CONSTRAINT "DeviceRawLog_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_memberId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_memberId_fkey";

-- CreateIndex
CREATE INDEX "AccessViolation_occurredAt_idx" ON "AccessViolation"("occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_deviceUserId_recordedAt_idx" ON "AttendanceLog"("deviceUserId", "recordedAt");

-- CreateIndex
CREATE INDEX "BackupJob_status_idx" ON "BackupJob"("status");

-- CreateIndex
CREATE INDEX "Device_status_idx" ON "Device"("status");

-- CreateIndex
CREATE INDEX "DoorEvent_requestedAt_idx" ON "DoorEvent"("requestedAt");

-- CreateIndex
CREATE INDEX "Member_phone_idx" ON "Member"("phone");

-- CreateIndex
CREATE INDEX "Member_email_idx" ON "Member"("email");

-- CreateIndex
CREATE INDEX "Payment_status_dueDate_idx" ON "Payment"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ReportJob_status_idx" ON "ReportJob"("status");

-- CreateIndex
CREATE INDEX "ThemePreference_scope_idx" ON "ThemePreference"("scope");

-- CreateIndex
CREATE INDEX "ThemePreference_adminUserId_idx" ON "ThemePreference"("adminUserId");

-- CreateIndex
CREATE INDEX "ThemePreference_memberId_idx" ON "ThemePreference"("memberId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceRawLog" ADD CONSTRAINT "DeviceRawLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
