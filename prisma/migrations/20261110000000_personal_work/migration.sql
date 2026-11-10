CREATE TABLE "UserEmployeeLink" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL,
  CONSTRAINT "UserEmployeeLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserEmployeeLink_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserEmployeeLink_employeeId_key" ON "UserEmployeeLink"("employeeId");
CREATE TABLE "SavedTaskFilter" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  CONSTRAINT "SavedTaskFilter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SavedTaskFilter_userId_unitId_nameKey_key" ON "SavedTaskFilter"("userId", "unitId", "nameKey");
CREATE INDEX "SavedTaskFilter_userId_unitId_idx" ON "SavedTaskFilter"("userId", "unitId");
CREATE TABLE "TaskChecklistItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskChecklistItem_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TaskChecklistItem_taskId_createdAt_id_idx" ON "TaskChecklistItem"("taskId", "createdAt", "id");
ALTER TABLE "UserAudit" ADD COLUMN "employeeBefore" INTEGER;
ALTER TABLE "UserAudit" ADD COLUMN "employeeAfter" INTEGER;
