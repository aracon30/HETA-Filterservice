ALTER TABLE "Plant" ADD COLUMN "defaultTechnicianId" TEXT;
ALTER TABLE "Plant" ADD CONSTRAINT "Plant_defaultTechnicianId_fkey" FOREIGN KEY ("defaultTechnicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PlantExternalUser" (
  "id" TEXT NOT NULL,
  "plantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "PlantExternalUser_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlantExternalUser" ADD CONSTRAINT "PlantExternalUser_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlantExternalUser" ADD CONSTRAINT "PlantExternalUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "PlantExternalUser_plantId_userId_key" ON "PlantExternalUser"("plantId", "userId");
