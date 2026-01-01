-- Drop existing table and indexes if they exist
DROP TABLE IF EXISTS "radar_readings" CASCADE;

-- CreateTable
CREATE TABLE "radar_readings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER NOT NULL,
    "packet_length" INTEGER NOT NULL,
    "rx_mac" TEXT NOT NULL,
    "room_id" INTEGER NOT NULL,
    "building_id" INTEGER NOT NULL,
    "seq_number" BIGINT NOT NULL,
    "csi_counter" BIGINT NOT NULL,
    "timestamp_ms" BIGINT NOT NULL,
    "rssi" INTEGER NOT NULL,
    "channel" INTEGER NOT NULL,
    "csi_len" INTEGER NOT NULL,
    "radar_targets" JSONB NOT NULL,
    "csi_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "radar_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "radar_readings_rx_mac_idx" ON "radar_readings"("rx_mac");

-- CreateIndex
CREATE INDEX "radar_readings_timestamp_ms_idx" ON "radar_readings"("timestamp_ms");

-- CreateIndex
CREATE INDEX "radar_readings_room_id_idx" ON "radar_readings"("room_id");

-- CreateIndex
CREATE INDEX "radar_readings_building_id_idx" ON "radar_readings"("building_id");

-- CreateIndex
CREATE INDEX "radar_readings_seq_number_idx" ON "radar_readings"("seq_number");
