-- Existing Inbox rows predate Attendance Inbox and belong to the legacy FULL workflow.
CREATE TYPE "InboxScope" AS ENUM ('FULL', 'ATTENDANCE');

ALTER TABLE "InboxItem"
ADD COLUMN "scope" "InboxScope" NOT NULL DEFAULT 'FULL';

-- Dedupe is isolated per Edition so one workflow cannot suppress the other.
DROP INDEX "InboxItem_dedupeKey_key";
CREATE UNIQUE INDEX "InboxItem_scope_dedupeKey_key"
ON "InboxItem"("scope", "dedupeKey");

CREATE INDEX "InboxItem_scope_category_createdAt_idx"
ON "InboxItem"("scope", "category", "createdAt");

CREATE INDEX "InboxItem_scope_readAt_idx"
ON "InboxItem"("scope", "readAt");
