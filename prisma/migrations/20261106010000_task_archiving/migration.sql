ALTER TABLE "Task" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Task" ADD COLUMN "archivedById" TEXT REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD COLUMN "archiveReason" TEXT;
CREATE INDEX "Task_unitId_archivedAt_idx" ON "Task"("unitId", "archivedAt");
