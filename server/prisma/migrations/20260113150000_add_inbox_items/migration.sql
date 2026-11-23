CREATE TYPE "InboxCategory" AS ENUM ('ALERT', 'DEVICE_FEED');
CREATE TYPE "InboxSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "InboxItemType" AS ENUM ('MEMBERSHIP_EXPIRING', 'MEMBERSHIP_EXPIRED', 'SHIFT_ENDING_SOON', 'DEVICE_DISCONNECTED', 'DEVICE_DENIED', 'DEVICE_AUTHORIZED', 'SHIFT_VIOLATION', 'MULTIPLE_FAILED_ATTEMPTS');
CREATE TYPE "InboxEntityType" AS ENUM ('MEMBER', 'DEVICE', 'MEMBERSHIP', 'SHIFT');

CREATE TABLE "InboxItem" (
  "id" TEXT NOT NULL,
  "category" "InboxCategory" NOT NULL,
  "type" "InboxItemType" NOT NULL,
  "severity" "InboxSeverity" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "entityType" "InboxEntityType",
  "entityId" TEXT,
  "actionPath" TEXT,
  "dedupeKey" TEXT,
  "deviceId" TEXT,
  "memberId" TEXT,
  CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InboxItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InboxItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "InboxItem_dedupeKey_key" ON "InboxItem"("dedupeKey");
CREATE INDEX "InboxItem_category_createdAt_idx" ON "InboxItem"("category", "createdAt");
CREATE INDEX "InboxItem_readAt_idx" ON "InboxItem"("readAt");
CREATE INDEX "InboxItem_deviceId_createdAt_idx" ON "InboxItem"("deviceId", "createdAt");
CREATE INDEX "InboxItem_memberId_createdAt_idx" ON "InboxItem"("memberId", "createdAt");
