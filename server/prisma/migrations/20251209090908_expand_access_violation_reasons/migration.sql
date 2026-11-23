-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccessViolationReason" ADD VALUE 'MEMBER_NOT_FOUND';
ALTER TYPE "AccessViolationReason" ADD VALUE 'INACTIVE_MEMBER';
ALTER TYPE "AccessViolationReason" ADD VALUE 'MEMBERSHIP_INACTIVE';
ALTER TYPE "AccessViolationReason" ADD VALUE 'MEMBERSHIP_DEBT';
ALTER TYPE "AccessViolationReason" ADD VALUE 'DAY_NOT_ALLOWED';
ALTER TYPE "AccessViolationReason" ADD VALUE 'TIME_NOT_ALLOWED';
ALTER TYPE "AccessViolationReason" ADD VALUE 'DEVICE_USER_NOT_FOUND';
