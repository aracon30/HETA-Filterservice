-- Add OpportunitySource enum
CREATE TYPE "OpportunitySource" AS ENUM ('MANUAL', 'SERVICE_REPORT', 'CHECKLIST_NOK');

-- Add new fields to Opportunity
ALTER TABLE "Opportunity"
  ADD COLUMN "probability"     INTEGER,
  ADD COLUMN "expectedCloseAt" TIMESTAMP(3),
  ADD COLUMN "contactPerson"   TEXT,
  ADD COLUMN "source"          "OpportunitySource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "sourceJobId"     TEXT,
  ADD COLUMN "plantId"         TEXT;

-- Add foreign keys
ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_sourceJobId_fkey"
    FOREIGN KEY ("sourceJobId") REFERENCES "ServiceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Opportunity"
  ADD CONSTRAINT "Opportunity_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
