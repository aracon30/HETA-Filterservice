-- CreateTable
CREATE TABLE "AcquisitionCheck" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "plants" JSONB NOT NULL DEFAULT '[]',
    "mood" TEXT,
    "nextStep" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AcquisitionCheck_customerId_idx" ON "AcquisitionCheck"("customerId");

-- AddForeignKey
ALTER TABLE "AcquisitionCheck" ADD CONSTRAINT "AcquisitionCheck_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
