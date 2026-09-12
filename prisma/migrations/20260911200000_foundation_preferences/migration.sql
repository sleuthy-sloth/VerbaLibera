CREATE TABLE "FoundationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "minutesPerDay" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "listening" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FoundationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FoundationPreference_userId_packId_key" ON "FoundationPreference"("userId", "packId");
CREATE INDEX "FoundationPreference_userId_idx" ON "FoundationPreference"("userId");
ALTER TABLE "FoundationPreference" ADD CONSTRAINT "FoundationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
