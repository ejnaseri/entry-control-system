CREATE TYPE "BackupJobType" AS ENUM ('MANUAL', 'SCHEDULED', 'PRE_MIGRATION');

CREATE TYPE "BackupVerificationStatus" AS ENUM ('NOT_VERIFIED', 'VERIFIED', 'FAILED');

ALTER TABLE "BackupJob"
ADD COLUMN "type" "BackupJobType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "verificationStatus" "BackupVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED',
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "backupRoot" TEXT,
ADD COLUMN "manifestPath" TEXT,
ADD COLUMN "logPath" TEXT,
ADD COLUMN "sha256" TEXT,
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "BackupJob_type_startedAt_idx" ON "BackupJob"("type", "startedAt");

CREATE INDEX "BackupJob_verificationStatus_idx" ON "BackupJob"("verificationStatus");
