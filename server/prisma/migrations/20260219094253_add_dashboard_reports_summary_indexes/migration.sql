-- CreateIndex
CREATE INDEX "AttendanceLog_entryType_isAuthorized_recordedAt_memberId_idx" ON "AttendanceLog"("entryType", "isAuthorized", "recordedAt", "memberId");

-- CreateIndex
CREATE INDEX "Member_memberType_isStaff_archivedAt_idx" ON "Member"("memberType", "isStaff", "archivedAt");

-- CreateIndex
CREATE INDEX "Membership_status_endDate_memberId_idx" ON "Membership"("status", "endDate", "memberId");

-- CreateIndex
CREATE INDEX "Payment_status_paidAt_idx" ON "Payment"("status", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
