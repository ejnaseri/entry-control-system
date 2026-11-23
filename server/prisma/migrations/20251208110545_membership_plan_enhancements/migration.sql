-- CreateEnum
CREATE TYPE "PlanDurationUnit" AS ENUM ('DAYS', 'MONTHS');

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "basePrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "durationUnit" "PlanDurationUnit" NOT NULL DEFAULT 'MONTHS',
ADD COLUMN     "durationValue" INTEGER NOT NULL DEFAULT 1;
