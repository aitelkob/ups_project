-- CreateTable
CREATE TABLE "Person" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "employeeCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "personId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "belt" TEXT NOT NULL,
    "shiftWindow" TEXT NOT NULL,
    "bagsTimed" INTEGER NOT NULL DEFAULT 10,
    "totalSeconds" INTEGER NOT NULL,
    "avgSecondsPerBag" REAL NOT NULL,
    "flowCondition" TEXT NOT NULL DEFAULT 'NORMAL',
    "qualityIssue" BOOLEAN NOT NULL DEFAULT false,
    "safetyIssue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Observation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_employeeCode_key" ON "Person"("employeeCode");

-- CreateIndex
CREATE INDEX "Observation_createdAt_idx" ON "Observation"("createdAt");

-- CreateIndex
CREATE INDEX "Observation_personId_idx" ON "Observation"("personId");

-- CreateIndex
CREATE INDEX "Observation_role_idx" ON "Observation"("role");
