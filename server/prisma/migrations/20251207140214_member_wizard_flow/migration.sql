-- CreateEnum
CREATE TYPE "MemberRoleType" AS ENUM ('EMPLOYEE', 'MANAGER', 'OWNER', 'ADMIN', 'COACH', 'RECEPTION', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'HOURLY', 'PER_SHIFT');

-- CreateEnum
CREATE TYPE "OvertimeRateType" AS ENUM ('PER_HOUR', 'PERCENTAGE');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "customTitle" TEXT,
ADD COLUMN     "isStaff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "roleType" "MemberRoleType";

-- CreateTable
CREATE TABLE "MemberAccessPolicy" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "allowedDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAccessPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAccessRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "fromTime" TEXT NOT NULL,
    "toTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberOvertimePolicy" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "allowOvertime" BOOLEAN NOT NULL DEFAULT false,
    "overtimeRateType" "OvertimeRateType",
    "overtimeAmount" DECIMAL(10,2),
    "maxOvertimePerDay" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberOvertimePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberShift" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "salaryType" "SalaryType" NOT NULL,
    "salaryAmount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberAccessPolicy_memberId_key" ON "MemberAccessPolicy"("memberId");

-- CreateIndex
CREATE INDEX "MemberAccessRule_policyId_weekday_idx" ON "MemberAccessRule"("policyId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "MemberOvertimePolicy_memberId_key" ON "MemberOvertimePolicy"("memberId");

-- CreateIndex
CREATE INDEX "MemberShift_memberId_isActive_idx" ON "MemberShift"("memberId", "isActive");

-- AddForeignKey
ALTER TABLE "MemberAccessPolicy" ADD CONSTRAINT "MemberAccessPolicy_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAccessRule" ADD CONSTRAINT "MemberAccessRule_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "MemberAccessPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberOvertimePolicy" ADD CONSTRAINT "MemberOvertimePolicy_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberShift" ADD CONSTRAINT "MemberShift_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
