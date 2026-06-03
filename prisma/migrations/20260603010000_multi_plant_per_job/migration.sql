-- Create join table for multiple plants per job
CREATE TABLE "ServiceJobPlant" (
    "id"      TEXT NOT NULL,
    "jobId"   TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "order"   INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServiceJobPlant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceJobPlant_jobId_plantId_key" UNIQUE ("jobId", "plantId")
);

-- Migrate existing single-plant assignments
INSERT INTO "ServiceJobPlant" ("id", "jobId", "plantId", "order")
SELECT gen_random_uuid()::text, "id", "plantId", 0
FROM "ServiceJob"
WHERE "plantId" IS NOT NULL;

-- Add foreign keys for ServiceJobPlant
ALTER TABLE "ServiceJobPlant"
    ADD CONSTRAINT "ServiceJobPlant_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceJobPlant"
    ADD CONSTRAINT "ServiceJobPlant_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add plantId to ChecklistItem for per-plant grouping
ALTER TABLE "ChecklistItem" ADD COLUMN "plantId" TEXT;

ALTER TABLE "ChecklistItem"
    ADD CONSTRAINT "ChecklistItem_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate existing checklist items to their plant
UPDATE "ChecklistItem" ci
SET "plantId" = sj."plantId"
FROM "ServiceJob" sj
WHERE ci."jobId" = sj."id" AND sj."plantId" IS NOT NULL;

-- Remove plantId from ServiceJob
ALTER TABLE "ServiceJob" DROP COLUMN "plantId";
