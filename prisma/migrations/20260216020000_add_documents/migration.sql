-- CreateEnum
CREATE TYPE "DocumentFileType" AS ENUM ('PDF', 'DOCX', 'XLSX', 'OTHER');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileType" "DocumentFileType" NOT NULL DEFAULT 'OTHER',
    "externalUrl" TEXT,
    "localPathNote" TEXT,
    "tags" TEXT,
    "notes" TEXT,
    "sizeMb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE INDEX "Document_fileType_idx" ON "Document"("fileType");
