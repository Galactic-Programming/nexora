-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TourCategory" ADD VALUE 'HONEYMOON';
ALTER TYPE "TourCategory" ADD VALUE 'MUSICAL';

-- DropIndex
DROP INDEX "tours_is_featured_idx";

-- CreateIndex
CREATE INDEX "tours_is_featured_is_published_idx" ON "tours"("is_featured", "is_published");
