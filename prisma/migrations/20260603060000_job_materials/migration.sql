CREATE TABLE "JobMaterial" (
    "id"           TEXT NOT NULL,
    "jobId"        TEXT NOT NULL,
    "plantId"      TEXT NOT NULL,
    "plantName"    TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "partNumber"   TEXT,
    "quantity"     INTEGER NOT NULL DEFAULT 1,
    "status"       TEXT NOT NULL DEFAULT 'TO_ORDER',
    "deliveryDate" TIMESTAMP(3),
    "notes"        TEXT,
    "order"        INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JobMaterial_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "JobMaterial" ADD CONSTRAINT "JobMaterial_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
