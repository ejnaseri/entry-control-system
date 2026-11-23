-- CreateEnum
CREATE TYPE "PayrollPolicyScope" AS ENUM ('GLOBAL', 'STAFF_GROUP', 'MEMBER');

-- CreateEnum
CREATE TYPE "PayrollCalcMode" AS ENUM ('PROPORTIONAL', 'FIXED');

-- CreateTable
CREATE TABLE "PayrollPolicy" (
    "id" TEXT NOT NULL,
    "scope" "PayrollPolicyScope" NOT NULL DEFAULT 'GLOBAL',
    "memberId" TEXT,
    "staffGroupId" TEXT,
    "allowAttendanceDeductions" BOOLEAN NOT NULL DEFAULT true,
    "absenceMode" "PayrollCalcMode" NOT NULL DEFAULT 'PROPORTIONAL',
    "absenceDeductionAmount" DECIMAL(12,2),
    "lateMode" "PayrollCalcMode" NOT NULL DEFAULT 'PROPORTIONAL',
    "lateDeductionAmount" DECIMAL(12,2),
    "lateIgnoreMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMode" "PayrollCalcMode" NOT NULL DEFAULT 'PROPORTIONAL',
    "earlyLeaveDeductionAmount" DECIMAL(12,2),
    "earlyLeaveIgnoreMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollPolicy_scope_idx" ON "PayrollPolicy"("scope");

-- CreateIndex
CREATE INDEX "PayrollPolicy_memberId_idx" ON "PayrollPolicy"("memberId");

-- CreateIndex
CREATE INDEX "PayrollPolicy_staffGroupId_idx" ON "PayrollPolicy"("staffGroupId");

-- AddForeignKey
ALTER TABLE "PayrollPolicy" ADD CONSTRAINT "PayrollPolicy_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPolicy" ADD CONSTRAINT "PayrollPolicy_staffGroupId_fkey" FOREIGN KEY ("staffGroupId") REFERENCES "StaffGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
