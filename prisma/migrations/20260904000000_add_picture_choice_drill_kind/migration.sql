-- AlterEnum
ALTER TYPE "DrillKind" ADD VALUE 'PICTURE_CHOICE';

-- AlterTable
ALTER TABLE "DrillItem" ADD COLUMN "choices" JSONB;
