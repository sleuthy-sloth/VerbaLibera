-- CreateTable
CREATE TABLE "PlacementResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "courseSlug" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "startCefr" TEXT NOT NULL,
    "startConceptId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlacementResult_userId_idx" ON "PlacementResult"("userId");

-- CreateIndex
CREATE INDEX "PlacementResult_courseSlug_idx" ON "PlacementResult"("courseSlug");

-- AddForeignKey
ALTER TABLE "PlacementResult" ADD CONSTRAINT "PlacementResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
