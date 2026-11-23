BEGIN;

ALTER TABLE "Member" ALTER COLUMN "memberType" DROP DEFAULT;

CREATE TYPE "MemberType_new" AS ENUM ('STAFF', 'CUSTOMER');

ALTER TABLE "Member"
  ALTER COLUMN "memberType" TYPE "MemberType_new"
  USING ("memberType"::text::"MemberType_new");

ALTER TYPE "MemberType" RENAME TO "MemberType_old";
ALTER TYPE "MemberType_new" RENAME TO "MemberType";

DROP TYPE "MemberType_old";

ALTER TABLE "Member" ALTER COLUMN "memberType" SET DEFAULT 'CUSTOMER';

COMMIT;
