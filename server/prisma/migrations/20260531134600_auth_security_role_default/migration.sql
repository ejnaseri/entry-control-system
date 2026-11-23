-- Use RECEPTION as the default role after the enum value is committed by the previous migration.
ALTER TABLE "AdminUser" ALTER COLUMN "role" SET DEFAULT 'RECEPTION';
