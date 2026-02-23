-- CreateTable rooms with integer PK/FK
CREATE TABLE IF NOT EXISTS "rooms" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "building_id" INTEGER NOT NULL,
    CONSTRAINT "rooms_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "rooms_building_id_idx" ON "rooms"("building_id");
