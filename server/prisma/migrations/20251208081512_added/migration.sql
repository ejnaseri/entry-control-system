-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "staffGroupId" TEXT;

-- CreateTable
CREATE TABLE "StaffGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accessLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffGroupShift" (
    "id" TEXT NOT NULL,
    "staffGroupId" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "shiftStart" TEXT NOT NULL,
    "shiftEnd" TEXT NOT NULL,
    "salaryType" "SalaryType" NOT NULL,
    "salaryAmount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffGroupShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffGroupShift_staffGroupId_isActive_idx" ON "StaffGroupShift"("staffGroupId", "isActive");

-- CreateIndex
CREATE INDEX "Member_staffGroupId_idx" ON "Member"("staffGroupId");

-- AddForeignKey
ALTER TABLE "Member" ADD CONSTRAINT "Member_staffGroupId_fkey" FOREIGN KEY ("staffGroupId") REFERENCES "StaffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffGroupShift" ADD CONSTRAINT "StaffGroupShift_staffGroupId_fkey" FOREIGN KEY ("staffGroupId") REFERENCES "StaffGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
