ALTER TABLE "BackupJob"
ADD COLUMN "scheduleFrequency" TEXT;

CREATE INDEX "BackupJob_type_scheduleFrequency_startedAt_idx"
ON "BackupJob"("type", "scheduleFrequency", "startedAt");
