ALTER TABLE "Task" ADD COLUMN "sourceTaskId" TEXT REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Task_sourceTaskId_key" ON "Task"("sourceTaskId");
CREATE INDEX "Task_unitId_dueDate_idx" ON "Task"("unitId", "dueDate");
CREATE INDEX "TaskHistory_taskId_timestamp_idx" ON "TaskHistory"("taskId", "timestamp");
