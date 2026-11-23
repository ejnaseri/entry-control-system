-- Add activation tracking to memberships
ALTER TABLE "Membership" ADD COLUMN "activatedAt" TIMESTAMP(3);

-- Add access violation reason for unpaid memberships
ALTER TYPE "AccessViolationReason" ADD VALUE IF NOT EXISTS 'NO_PAYMENT_YET';
