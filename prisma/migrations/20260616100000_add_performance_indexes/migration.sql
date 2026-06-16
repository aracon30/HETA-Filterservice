-- CreateIndex
CREATE INDEX "User_customerId_idx" ON "User"("customerId");

-- CreateIndex
CREATE INDEX "Hotel_customerId_idx" ON "Hotel"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_jobId_idx" ON "Invoice"("jobId");

-- CreateIndex
CREATE INDEX "PartTypeItem_plantTypeId_idx" ON "PartTypeItem"("plantTypeId");

-- CreateIndex
CREATE INDEX "PlantTypeChecklistItem_plantTypeId_idx" ON "PlantTypeChecklistItem"("plantTypeId");

-- CreateIndex
CREATE INDEX "PlantChecklistOverride_plantId_idx" ON "PlantChecklistOverride"("plantId");

-- CreateIndex
CREATE INDEX "Plant_customerId_idx" ON "Plant"("customerId");

-- CreateIndex
CREATE INDEX "Plant_defaultTechnicianId_idx" ON "Plant"("defaultTechnicianId");

-- CreateIndex
CREATE INDEX "PlantDocument_plantId_idx" ON "PlantDocument"("plantId");

-- CreateIndex
CREATE INDEX "PlantDocument_customerId_idx" ON "PlantDocument"("customerId");

-- CreateIndex
CREATE INDEX "PlantDocument_jobId_idx" ON "PlantDocument"("jobId");

-- CreateIndex
CREATE INDEX "ServiceJobTechnician_userId_idx" ON "ServiceJobTechnician"("userId");

-- CreateIndex
CREATE INDEX "ServiceJobPlant_plantId_idx" ON "ServiceJobPlant"("plantId");

-- CreateIndex
CREATE INDEX "ServiceJob_customerId_idx" ON "ServiceJob"("customerId");

-- CreateIndex
CREATE INDEX "ServiceJob_status_scheduledAt_idx" ON "ServiceJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "PlantMaterial_plantId_idx" ON "PlantMaterial"("plantId");

-- CreateIndex
CREATE INDEX "JobMaterial_jobId_idx" ON "JobMaterial"("jobId");

-- CreateIndex
CREATE INDEX "ChecklistItem_jobId_idx" ON "ChecklistItem"("jobId");

-- CreateIndex
CREATE INDEX "ChecklistItem_plantId_idx" ON "ChecklistItem"("plantId");

-- CreateIndex
CREATE INDEX "Opportunity_customerId_idx" ON "Opportunity"("customerId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");

-- CreateIndex
CREATE INDEX "PlantRequest_customerId_idx" ON "PlantRequest"("customerId");

-- CreateIndex
CREATE INDEX "PlantRequest_status_idx" ON "PlantRequest"("status");

-- CreateIndex
CREATE INDEX "PlantRequestMessage_requestId_idx" ON "PlantRequestMessage"("requestId");

-- CreateIndex
CREATE INDEX "PlantRequestOffer_requestId_idx" ON "PlantRequestOffer"("requestId");
