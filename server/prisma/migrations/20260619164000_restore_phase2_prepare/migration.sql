-- CreateEnum
CREATE TYPE "RestoreJobStatus" AS ENUM ('REQUESTED', 'BLOCKED', 'TESTING', 'TEST_PASSED', 'EMERGENCY_BACKUP_RUNNING', 'READY_FOR_CONFIRMATION', 'RESTORE_RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "RestoreJob" (
    "id" TEXT NOT NULL,
    "status" "RestoreJobStatus" NOT NULL DEFAULT 'REQUESTED',
    "selectedBackupId" TEXT NOT NULL,
    "selectedBackupPath" TEXT NOT NULL,
    "selectedBackupFolderName" TEXT,
    "selectedBackupSha256" TEXT,
    "selectedBackupSizeBytes" BIGINT,
    "restoreTestDatabase" TEXT,
    "restoreTestPassedAt" TIMESTAMP(3),
    "restoreTestReportPath" TEXT,
    "emergencyBackupJobId" TEXT,
    "emergencyBackupPath" TEXT,
    "requestedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestoreJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RestoreJob_status_requestedAt_idx" ON "RestoreJob"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "RestoreJob_requestedById_requestedAt_idx" ON "RestoreJob"("requestedById", "requestedAt");

-- CreateIndex
CREATE INDEX "RestoreJob_emergencyBackupJobId_idx" ON "RestoreJob"("emergencyBackupJobId");

-- AddForeignKey
ALTER TABLE "RestoreJob" ADD CONSTRAINT "RestoreJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestoreJob" ADD CONSTRAINT "RestoreJob_emergencyBackupJobId_fkey" FOREIGN KEY ("emergencyBackupJobId") REFERENCES "BackupJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
