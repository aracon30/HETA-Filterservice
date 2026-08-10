-- CreateTable
CREATE TABLE "PlantMaterialPosition" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantMaterialPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantMaterialPosition_documentId_idx" ON "PlantMaterialPosition"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantMaterialPosition_materialId_documentId_key" ON "PlantMaterialPosition"("materialId", "documentId");

-- AddForeignKey
ALTER TABLE "PlantMaterialPosition" ADD CONSTRAINT "PlantMaterialPosition_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "PlantMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantMaterialPosition" ADD CONSTRAINT "PlantMaterialPosition_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlantDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

