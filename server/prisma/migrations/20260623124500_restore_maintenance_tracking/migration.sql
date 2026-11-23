-- Track controlled restore handoff, maintenance mode, and post-restore report metadata.
ALTER TABLE "RestoreJob"
  ADD COLUMN "handoffPath" TEXT,
  ADD COLUMN "restoreScriptPath" TEXT,
  ADD COLUMN "restoreCommand" JSONB,
  ADD COLUMN "maintenanceStartedAt" TIMESTAMP(3),
  ADD COLUMN "maintenanceEndedAt" TIMESTAMP(3),
  ADD COLUMN "productionRestoreReportPath" TEXT,
  ADD COLUMN "productionRestoreStatus" TEXT,
  ADD COLUMN "productionRestoreCompletedAt" TIMESTAMP(3),
  ADD COLUMN "postRestoreCheckedAt" TIMESTAMP(3),
  ADD COLUMN "postRestoreSummary" JSONB;

CREATE INDEX "RestoreJob_maintenanceStartedAt_idx"
  ON "RestoreJob"("maintenanceStartedAt");

CREATE INDEX "RestoreJob_productionRestoreCompletedAt_idx"
  ON "RestoreJob"("productionRestoreCompletedAt");
