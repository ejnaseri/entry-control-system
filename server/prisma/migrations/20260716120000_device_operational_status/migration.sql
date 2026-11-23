ALTER TABLE "Device"
ADD COLUMN "lastSuccessfulPollAt" TIMESTAMP(3),
ADD COLUMN "lastEventReceivedAt" TIMESTAMP(3),
ADD COLUMN "lastEventProcessedAt" TIMESTAMP(3),
ADD COLUMN "lastErrorAt" TIMESTAMP(3),
ADD COLUMN "lastErrorMessage" TEXT;

UPDATE "Device"
SET "lastSuccessfulPollAt" = "lastSeenAt"
WHERE "lastSeenAt" IS NOT NULL;
