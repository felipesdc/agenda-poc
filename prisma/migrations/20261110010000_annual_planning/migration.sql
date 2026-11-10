CREATE TABLE "AnnualPlanBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "sourceYear" INTEGER NOT NULL,
  "targetYear" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AnnualPlanBatch_userId_requestId_key" ON "AnnualPlanBatch"("userId", "requestId");
CREATE TABLE "AnnualPlanItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "sourceTaskId" TEXT NOT NULL,
  "targetTaskId" TEXT NOT NULL,
  "targetYear" INTEGER NOT NULL,
  CONSTRAINT "AnnualPlanItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AnnualPlanBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AnnualPlanItem_batchId_sourceTaskId_key" ON "AnnualPlanItem"("batchId", "sourceTaskId");
CREATE INDEX "AnnualPlanItem_sourceTaskId_targetYear_idx" ON "AnnualPlanItem"("sourceTaskId", "targetYear");
