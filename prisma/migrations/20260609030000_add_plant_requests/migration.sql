-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('STOERUNG', 'WARTUNG', 'ANGEBOT', 'INFORMATION', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'OFFER_SENT', 'OFFER_ACCEPTED', 'OFFER_REJECTED', 'JOB_PLANNED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "PlantRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "RequestType" NOT NULL DEFAULT 'SONSTIGES',
    "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "offerNumber" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "serviceJobId" TEXT,
    "serviceJobNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlantRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantRequestPlant" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "plantName" TEXT NOT NULL,

    CONSTRAINT "PlantRequestPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantRequestMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "statusChange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantRequestMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantRequestOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offerNumber" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantRequestOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlantRequest_requestNumber_key" ON "PlantRequest"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlantRequestPlant_requestId_plantId_key" ON "PlantRequestPlant"("requestId", "plantId");

-- AddForeignKey
ALTER TABLE "PlantRequest" ADD CONSTRAINT "PlantRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantRequestPlant" ADD CONSTRAINT "PlantRequestPlant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PlantRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantRequestPlant" ADD CONSTRAINT "PlantRequestPlant_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantRequestMessage" ADD CONSTRAINT "PlantRequestMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PlantRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantRequestOffer" ADD CONSTRAINT "PlantRequestOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PlantRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
