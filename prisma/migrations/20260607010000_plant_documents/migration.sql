-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'SERVICE_REPORT', 'MANUAL', 'DRAWING', 'IMAGE', 'OTHER');

-- CreateTable
CREATE TABLE "PlantDocument" (
    "id"             TEXT NOT NULL,
    "plantId"        TEXT NOT NULL,
    "customerId"     TEXT NOT NULL,
    "type"           "DocumentType" NOT NULL,
    "title"          TEXT NOT NULL,
    "description"    TEXT,
    "fileUrl"        TEXT NOT NULL,
    "fileName"       TEXT NOT NULL,
    "fileSize"       INTEGER,
    "mimeType"       TEXT,
    "jobId"          TEXT,
    "uploadedById"   TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlantDocument" ADD CONSTRAINT "PlantDocument_plantId_fkey"
    FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantDocument" ADD CONSTRAINT "PlantDocument_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ServiceJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "PlantDocument_plantId_idx" ON "PlantDocument"("plantId");
CREATE INDEX "PlantDocument_customerId_idx" ON "PlantDocument"("customerId");
CREATE INDEX "PlantDocument_type_idx" ON "PlantDocument"("type");
