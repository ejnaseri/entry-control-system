/*
  Warnings:

  - A unique constraint covering the columns `[dedupeKey]` on the table `AttendanceLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AttendanceLog" ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "lastAttendanceAt" TIMESTAMP(3),
ADD COLUMN     "lastAttendanceRecordId" INTEGER,
ADD COLUMN     "lastPushAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AccessViolation_memberId_occurredAt_idx" ON "AccessViolation"("memberId", "occurredAt");

-- CreateIndex
CREATE INDEX "AccessViolation_reason_occurredAt_idx" ON "AccessViolation"("reason", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceLog_dedupeKey_key" ON "AttendanceLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "AttendanceLog_recordedAt_idx" ON "AttendanceLog"("recordedAt");

-- CreateIndex
CREATE INDEX "AttendanceLog_entryType_recordedAt_idx" ON "AttendanceLog"("entryType", "recordedAt");
