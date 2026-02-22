-- CreateTable inference_data
CREATE TABLE IF NOT EXISTS "inference_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "timestamp_start" TIMESTAMPTZ(6) NOT NULL,
    "timestamp_end" TIMESTAMPTZ(6) NOT NULL,
    "room_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "occupied" BOOLEAN NOT NULL,
    "occupied_probability" DOUBLE PRECISION NOT NULL,
    "rx_mac" TEXT NOT NULL,
    CONSTRAINT "inference_data_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inference_data_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inference_data_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "inference_data_room_id_idx" ON "inference_data"("room_id");
CREATE INDEX IF NOT EXISTS "inference_data_building_id_idx" ON "inference_data"("building_id");
CREATE INDEX IF NOT EXISTS "inference_data_rx_mac_idx" ON "inference_data"("rx_mac");
CREATE INDEX IF NOT EXISTS "inference_data_timestamp_start_idx" ON "inference_data"("timestamp_start");
