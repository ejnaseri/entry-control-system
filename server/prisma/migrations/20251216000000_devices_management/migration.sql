-- Create new enums for devices
CREATE TYPE "DeviceType" AS ENUM ('FINGERPRINT', 'RELAY', 'GATE', 'CAMERA', 'OTHER');
CREATE TYPE "DeviceConnectionType" AS ENUM ('NETWORK', 'USB', 'SERIAL');

-- Extend existing status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'DeviceStatus' AND n.nspname = 'public') THEN
    CREATE TYPE "DeviceStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE', 'ERROR');
  ELSIF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DeviceStatus' AND enumlabel = 'UNKNOWN') THEN
    ALTER TYPE "DeviceStatus" ADD VALUE 'UNKNOWN';
  END IF;
END$$;

-- Adjust Device table structure
ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "type" "DeviceType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS "connectionType" "DeviceConnectionType" NOT NULL DEFAULT 'NETWORK',
  ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "config" JSONB NOT NULL DEFAULT '{}';

-- Drop legacy network-specific columns (superseded by config JSON)
ALTER TABLE "Device"
  DROP COLUMN IF EXISTS "ip",
  DROP COLUMN IF EXISTS "port",
  DROP COLUMN IF EXISTS "timezone",
  DROP COLUMN IF EXISTS "lastSyncAt";

-- Indexes for quick filtering
CREATE INDEX IF NOT EXISTS "Device_connectionType_idx" ON "Device"("connectionType");
