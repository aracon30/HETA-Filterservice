-- AlterEnum
ALTER TYPE "RequestType" ADD VALUE 'ERSATZTEIL';

-- AlterTable
ALTER TABLE "PlantMaterial" ADD COLUMN     "orderable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "positionLabel" TEXT,
ADD COLUMN     "specification" TEXT;

-- CreateTable
CREATE TABLE "PlantRequestPart" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "materialId" TEXT,
    "label" TEXT NOT NULL,
    "partNumber" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PlantRequestPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantRequestPart_requestId_idx" ON "PlantRequestPart"("requestId");

-- CreateIndex
CREATE INDEX "PlantRequestPart_materialId_idx" ON "PlantRequestPart"("materialId");

-- AddForeignKey
ALTER TABLE "PlantRequestPart" ADD CONSTRAINT "PlantRequestPart_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PlantRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantRequestPart" ADD CONSTRAINT "PlantRequestPart_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PlantMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

