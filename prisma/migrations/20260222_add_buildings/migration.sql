-- CreateTable buildings
CREATE TABLE IF NOT EXISTS "buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);
