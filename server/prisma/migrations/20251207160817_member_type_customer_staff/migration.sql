-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('STAFF', 'CUSTOMER');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "memberType" "MemberType" NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "MemberAccessPolicy" ADD COLUMN     "maxEntriesPerDay" INTEGER;

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "position" TEXT,
    "department" TEXT,
    "systemRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "totalPaidAmount" INTEGER NOT NULL DEFAULT 0,
    "totalDebtAmount" INTEGER NOT NULL DEFAULT 0,
    "defaultAccessPolicyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_memberId_key" ON "StaffProfile"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_memberId_key" ON "CustomerProfile"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_defaultAccessPolicyId_key" ON "CustomerProfile"("defaultAccessPolicyId");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_defaultAccessPolicyId_fkey" FOREIGN KEY ("defaultAccessPolicyId") REFERENCES "MemberAccessPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
