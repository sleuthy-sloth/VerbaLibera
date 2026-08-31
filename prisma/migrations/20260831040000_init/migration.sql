-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CEFRLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');

-- CreateEnum
CREATE TYPE "DrillKind" AS ENUM ('SUBSTITUTION', 'TRANSFORMATION');

-- CreateEnum
CREATE TYPE "AudioSegmentType" AS ENUM ('PROMPT', 'ANSWER');

-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('PASS', 'FAIL', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "ContentProvenance" AS ENUM ('ORIGINAL', 'IMPORTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "accountIdentifier" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Language" (
    "code" VARCHAR(16) NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceLanguageCode" VARCHAR(16) NOT NULL,
    "targetLanguageCode" VARCHAR(16) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptBlock" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cefrLevel" "CEFRLevel" NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "assessmentCriteria" TEXT NOT NULL,
    "contentProvenance" "ContentProvenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrillItem" (
    "id" TEXT NOT NULL,
    "conceptBlockId" TEXT NOT NULL,
    "cefrLevel" "CEFRLevel" NOT NULL,
    "kind" "DrillKind" NOT NULL,
    "prompt" TEXT NOT NULL,
    "acceptedResponses" JSONB NOT NULL,
    "recallTarget" TEXT NOT NULL,
    "contentProvenance" "ContentProvenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "drillItemId" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lapseCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "lastQuality" INTEGER,
    "lastLatencyMs" INTEGER,

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudioSegment" (
    "id" TEXT NOT NULL,
    "conceptBlockId" TEXT,
    "drillItemId" TEXT,
    "type" "AudioSegmentType" NOT NULL,
    "position" INTEGER NOT NULL,
    "pauseAfter" BOOLEAN NOT NULL DEFAULT false,
    "audioUrl" TEXT NOT NULL,
    "transcript" TEXT,
    "durationMs" INTEGER,
    "contentProvenance" "ContentProvenance" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptAssessment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptBlockId" TEXT NOT NULL,
    "evaluationMethod" TEXT NOT NULL,
    "result" "AssessmentResult" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptMastery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptBlockId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConceptMastery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_accountIdentifier_key" ON "User"("accountIdentifier");
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");
CREATE INDEX "Course_sourceLanguageCode_targetLanguageCode_idx" ON "Course"("sourceLanguageCode", "targetLanguageCode");
CREATE INDEX "ConceptBlock_courseId_cefrLevel_idx" ON "ConceptBlock"("courseId", "cefrLevel");
CREATE UNIQUE INDEX "ConceptBlock_courseId_position_key" ON "ConceptBlock"("courseId", "position");
CREATE INDEX "DrillItem_conceptBlockId_cefrLevel_idx" ON "DrillItem"("conceptBlockId", "cefrLevel");
CREATE INDEX "UserProgress_userId_dueAt_idx" ON "UserProgress"("userId", "dueAt");
CREATE UNIQUE INDEX "UserProgress_userId_drillItemId_key" ON "UserProgress"("userId", "drillItemId");
CREATE UNIQUE INDEX "AudioSegment_conceptBlockId_position_key" ON "AudioSegment"("conceptBlockId", "position");
CREATE UNIQUE INDEX "AudioSegment_drillItemId_position_key" ON "AudioSegment"("drillItemId", "position");
CREATE INDEX "ConceptAssessment_userId_conceptBlockId_result_idx" ON "ConceptAssessment"("userId", "conceptBlockId", "result");
CREATE UNIQUE INDEX "ConceptAssessment_id_userId_conceptBlockId_key" ON "ConceptAssessment"("id", "userId", "conceptBlockId");
CREATE UNIQUE INDEX "ConceptMastery_userId_conceptBlockId_key" ON "ConceptMastery"("userId", "conceptBlockId");
CREATE UNIQUE INDEX "ConceptMastery_assessmentId_userId_conceptBlockId_key" ON "ConceptMastery"("assessmentId", "userId", "conceptBlockId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_sourceLanguageCode_fkey" FOREIGN KEY ("sourceLanguageCode") REFERENCES "Language"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Course" ADD CONSTRAINT "Course_targetLanguageCode_fkey" FOREIGN KEY ("targetLanguageCode") REFERENCES "Language"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConceptBlock" ADD CONSTRAINT "ConceptBlock_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DrillItem" ADD CONSTRAINT "DrillItem_conceptBlockId_fkey" FOREIGN KEY ("conceptBlockId") REFERENCES "ConceptBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_drillItemId_fkey" FOREIGN KEY ("drillItemId") REFERENCES "DrillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AudioSegment" ADD CONSTRAINT "AudioSegment_conceptBlockId_fkey" FOREIGN KEY ("conceptBlockId") REFERENCES "ConceptBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AudioSegment" ADD CONSTRAINT "AudioSegment_drillItemId_fkey" FOREIGN KEY ("drillItemId") REFERENCES "DrillItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConceptAssessment" ADD CONSTRAINT "ConceptAssessment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptAssessment" ADD CONSTRAINT "ConceptAssessment_conceptBlockId_fkey" FOREIGN KEY ("conceptBlockId") REFERENCES "ConceptBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_conceptBlockId_fkey" FOREIGN KEY ("conceptBlockId") REFERENCES "ConceptBlock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConceptMastery" ADD CONSTRAINT "ConceptMastery_assessmentId_userId_conceptBlockId_fkey" FOREIGN KEY ("assessmentId", "userId", "conceptBlockId") REFERENCES "ConceptAssessment"("id", "userId", "conceptBlockId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL-only integrity requirements not expressible in Prisma schema.
ALTER TABLE "Course"
  ADD CONSTRAINT "Course_source_target_languages_differ"
  CHECK ("sourceLanguageCode" <> "targetLanguageCode");

ALTER TABLE "ConceptBlock"
  ADD CONSTRAINT "ConceptBlock_position_nonnegative"
  CHECK ("position" >= 0);

ALTER TABLE "UserProgress"
  ADD CONSTRAINT "UserProgress_nonnegative_schedule"
  CHECK (
    "intervalDays" >= 0
    AND "repetitions" >= 0
    AND "lapseCount" >= 0
    AND ("lastLatencyMs" IS NULL OR "lastLatencyMs" >= 0)
  ),
  ADD CONSTRAINT "UserProgress_ease_factor_floor"
  CHECK ("easeFactor" >= 1.3),
  ADD CONSTRAINT "UserProgress_quality_range"
  CHECK ("lastQuality" IS NULL OR "lastQuality" BETWEEN 0 AND 5);

ALTER TABLE "AudioSegment"
  ADD CONSTRAINT "AudioSegment_exactly_one_parent"
  CHECK (num_nonnulls("conceptBlockId", "drillItemId") = 1),
  ADD CONSTRAINT "AudioSegment_position_nonnegative"
  CHECK ("position" >= 0),
  ADD CONSTRAINT "AudioSegment_duration_nonnegative"
  CHECK ("durationMs" IS NULL OR "durationMs" >= 0);

CREATE FUNCTION prevent_mastery_assessment_demotion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."result" <> 'PASS'
    AND EXISTS (
      SELECT 1
      FROM "ConceptMastery" AS mastery
      WHERE mastery."assessmentId" = OLD."id"
        AND mastery."userId" = OLD."userId"
        AND mastery."conceptBlockId" = OLD."conceptBlockId"
    ) THEN
    RAISE EXCEPTION
      'ConceptAssessment with a referenced ConceptMastery must remain PASS';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConceptAssessment_referenced_by_mastery_must_remain_passing"
BEFORE UPDATE OF "result" ON "ConceptAssessment"
FOR EACH ROW
EXECUTE FUNCTION prevent_mastery_assessment_demotion();

CREATE FUNCTION enforce_concept_mastery_assessment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ConceptAssessment" AS assessment
    WHERE assessment."id" = NEW."assessmentId"
      AND assessment."userId" = NEW."userId"
      AND assessment."conceptBlockId" = NEW."conceptBlockId"
      AND assessment."result" = 'PASS'
  ) THEN
    RAISE EXCEPTION
      'ConceptMastery assessment must be a passing assessment for the same user and concept';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ConceptMastery_requires_passing_matching_assessment"
BEFORE INSERT OR UPDATE ON "ConceptMastery"
FOR EACH ROW
EXECUTE FUNCTION enforce_concept_mastery_assessment();
