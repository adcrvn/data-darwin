-- CreateTable rooms
CREATE TABLE IF NOT EXISTS "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "building_id" UUID NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "rooms_building_id_idx" ON "rooms"("building_id");
