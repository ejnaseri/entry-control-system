-- Ensure DeviceStatus includes UNKNOWN before setting default
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DeviceStatus' AND enumlabel = 'UNKNOWN') THEN
    ALTER TYPE "DeviceStatus" ADD VALUE 'UNKNOWN';
  END IF;
END$$;

-- Set default to UNKNOWN
ALTER TABLE "Device" ALTER COLUMN "status" SET DEFAULT 'UNKNOWN';
