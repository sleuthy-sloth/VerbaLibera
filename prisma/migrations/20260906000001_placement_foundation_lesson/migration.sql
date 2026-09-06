-- Add optional foundation-pack entry lesson to stored placement results.
ALTER TABLE "PlacementResult" ADD COLUMN "foundationLessonId" TEXT;
