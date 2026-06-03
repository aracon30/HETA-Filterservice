-- Create technician join table
CREATE TABLE "ServiceJobTechnician" (
    "id"       TEXT NOT NULL,
    "jobId"    TEXT NOT NULL,
    "userId"   TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "order"    INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServiceJobTechnician_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ServiceJobTechnician_jobId_userId_key" UNIQUE ("jobId", "userId")
);

-- Add vehicles array
ALTER TABLE "ServiceJob" ADD COLUMN "vehicles" TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing technician data
INSERT INTO "ServiceJobTechnician" ("id", "jobId", "userId", "userName", "order")
SELECT gen_random_uuid()::text, "id", "technicianId", COALESCE("technicianName", ''), 0
FROM "ServiceJob"
WHERE "technicianId" IS NOT NULL;

-- Migrate existing vehicle data
UPDATE "ServiceJob" SET "vehicles" = ARRAY["vehicle"] WHERE "vehicle" IS NOT NULL;

-- Add FK constraints
ALTER TABLE "ServiceJobTechnician"
    ADD CONSTRAINT "ServiceJobTechnician_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceJobTechnician"
    ADD CONSTRAINT "ServiceJobTechnician_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Remove old columns
ALTER TABLE "ServiceJob" DROP COLUMN "technicianId";
ALTER TABLE "ServiceJob" DROP COLUMN "technicianName";
ALTER TABLE "ServiceJob" DROP COLUMN "vehicle";
