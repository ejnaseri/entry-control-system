CREATE TABLE "AttendanceJustification" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceJustification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceJustification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AttendanceJustification_memberId_date_key" ON "AttendanceJustification"("memberId", "date");
CREATE INDEX "AttendanceJustification_date_idx" ON "AttendanceJustification"("date");
