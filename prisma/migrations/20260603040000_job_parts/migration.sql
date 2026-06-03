-- PartTypeItem template table
CREATE TABLE "PartTypeItem" (
    "id"          TEXT NOT NULL,
    "plantTypeId" TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "partNumber"  TEXT,
    "quantity"    INTEGER NOT NULL DEFAULT 1,
    "order"       INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PartTypeItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PartTypeItem" ADD CONSTRAINT "PartTypeItem_plantTypeId_fkey"
    FOREIGN KEY ("plantTypeId") REFERENCES "PlantType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- JobPart per-job parts
CREATE TABLE "JobPart" (
    "id"           TEXT NOT NULL,
    "jobId"        TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "partNumber"   TEXT,
    "quantity"     INTEGER NOT NULL DEFAULT 1,
    "status"       TEXT NOT NULL DEFAULT 'TO_ORDER',
    "deliveryDate" TIMESTAMP(3),
    "notes"        TEXT,
    "order"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JobPart_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "JobPart" ADD CONSTRAINT "JobPart_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
