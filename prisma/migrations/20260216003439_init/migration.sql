-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DUMPER', 'UNZIPPER');

-- CreateEnum
CREATE TYPE "Belt" AS ENUM ('DEBAG1', 'DEBAG2');

-- CreateEnum
CREATE TYPE "ShiftWindow" AS ENUM ('EARLY', 'MID', 'LATE');

-- CreateEnum
CREATE TYPE "FlowCondition" AS ENUM ('NORMAL', 'PEAK', 'JAM');

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "employeeCode" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "belt" "Belt" NOT NULL,
    "shiftWindow" "ShiftWindow" NOT NULL,
    "bagsTimed" INTEGER NOT NULL DEFAULT 10,
    "totalSeconds" INTEGER NOT NULL,
    "avgSecondsPerBag" DOUBLE PRECISION NOT NULL,
    "flowCondition" "FlowCondition" NOT NULL DEFAULT 'NORMAL',
    "qualityIssue" BOOLEAN NOT NULL DEFAULT false,
    "safetyIssue" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_employeeCode_key" ON "Person"("employeeCode");

-- CreateIndex
CREATE INDEX "Observation_createdAt_idx" ON "Observation"("createdAt");

-- CreateIndex
CREATE INDEX "Observation_personId_idx" ON "Observation"("personId");

-- CreateIndex
CREATE INDEX "Observation_role_idx" ON "Observation"("role");

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
