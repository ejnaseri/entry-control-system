-- Track durable progress and outcomes for long-running backup/recovery assistant operations.
CREATE TYPE "OperationRunType" AS ENUM (
  'SAFE_BACKUP',
  'IMPORT_BACKUP',
  'SUPPORT_PACKAGE',
  'PREPARE_RECOVERY',
  'POST_RESTORE_CHECK'
);

CREATE TYPE "OperationRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "OperationRun" (
  "id" TEXT NOT NULL,
  "type" "OperationRunType" NOT NULL,
  "status" "OperationRunStatus" NOT NULL DEFAULT 'PENDING',
  "step" TEXT,
  "percent" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT,
  "errorMessage" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "result" JSONB,
  "metadata" JSONB,
  "startedById" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationRun_type_status_idx"
  ON "OperationRun"("type", "status");

CREATE INDEX "OperationRun_startedById_createdAt_idx"
  ON "OperationRun"("startedById", "createdAt");

CREATE INDEX "OperationRun_targetType_targetId_idx"
  ON "OperationRun"("targetType", "targetId");

CREATE INDEX "OperationRun_createdAt_idx"
  ON "OperationRun"("createdAt");

ALTER TABLE "OperationRun"
  ADD CONSTRAINT "OperationRun_startedById_fkey"
  FOREIGN KEY ("startedById") REFERENCES "AdminUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
