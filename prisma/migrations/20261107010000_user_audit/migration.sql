CREATE TABLE "UserAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unitId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "nameBefore" TEXT,
    "roleBefore" TEXT,
    "nameAfter" TEXT NOT NULL,
    "roleAfter" TEXT NOT NULL
);
CREATE INDEX "UserAudit_unitId_timestamp_idx" ON "UserAudit"("unitId", "timestamp");
