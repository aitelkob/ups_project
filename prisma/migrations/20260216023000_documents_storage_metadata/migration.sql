-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "storageBucket" TEXT NOT NULL DEFAULT 'debag-docs',
ADD COLUMN "storagePath" TEXT,
ADD COLUMN "originalFilename" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "sizeBytes" INTEGER;

-- Backfill required storagePath for pre-existing rows
UPDATE "Document"
SET "storagePath" = 'legacy/' || "id"
WHERE "storagePath" IS NULL;

-- Make storagePath required and unique
ALTER TABLE "Document"
ALTER COLUMN "storagePath" SET NOT NULL;

CREATE UNIQUE INDEX "Document_storagePath_key" ON "Document"("storagePath");

-- Drop old metadata columns
ALTER TABLE "Document"
DROP COLUMN "externalUrl",
DROP COLUMN "localPathNote",
DROP COLUMN "sizeMb";
