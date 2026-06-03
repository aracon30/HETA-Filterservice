-- Remove JobPart (was per-job, now replaced by per-plant materials)
DROP TABLE IF EXISTS "JobPart";

-- Create PlantMaterial (per plant)
CREATE TABLE "PlantMaterial" (
    "id"           TEXT NOT NULL,
    "plantId"      TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "partNumber"   TEXT,
    "quantity"     INTEGER NOT NULL DEFAULT 1,
    "status"       TEXT NOT NULL DEFAULT 'TO_ORDER',
    "deliveryDate" TIMESTAMP(3),
    "notes"        TEXT,
    "order"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlantMaterial_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PlantMaterial" ADD CONSTRAINT "PlantMaterial_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
