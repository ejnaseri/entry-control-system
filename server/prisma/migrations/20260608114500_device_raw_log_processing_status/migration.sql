CREATE TYPE "DeviceRawLogStatus" AS ENUM ('PENDING', 'PROCESSED', 'SKIPPED_DUPLICATE', 'SKIPPED_INVALID', 'FAILED');

ALTER TABLE "DeviceRawLog"
  ADD COLUMN "status" "DeviceRawLogStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "processError" TEXT;

CREATE INDEX "DeviceRawLog_deviceId_recordedAt_idx" ON "DeviceRawLog"("deviceId", "recordedAt");
CREATE INDEX "DeviceRawLog_status_createdAt_idx" ON "DeviceRawLog"("status", "createdAt");
