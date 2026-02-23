-- CreateTable firmware with integer PK and device type enum
CREATE TYPE "DeviceType" AS ENUM ('transmitter', 'receiver');

CREATE TABLE IF NOT EXISTS "firmware" (
    "id" SERIAL PRIMARY KEY,
    "device_type" "DeviceType" NOT NULL,
    "version" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "release_notes" TEXT,
    "is_latest" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "firmware_device_type_idx" ON "firmware"("device_type");
CREATE INDEX IF NOT EXISTS "firmware_is_latest_idx" ON "firmware"("is_latest");
