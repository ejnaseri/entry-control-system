-- AlterTable
ALTER TABLE "MemberShift" ADD COLUMN     "isFromGroup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rateOverride" DECIMAL(12,2),
ADD COLUMN     "shiftId" TEXT;

-- CreateIndex
CREATE INDEX "MemberShift_shiftId_idx" ON "MemberShift"("shiftId");

-- CreateIndex
CREATE INDEX "MemberShift_memberId_isFromGroup_idx" ON "MemberShift"("memberId", "isFromGroup");

-- AddForeignKey
ALTER TABLE "MemberShift" ADD CONSTRAINT "MemberShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "StaffGroupShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
