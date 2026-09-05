CREATE TABLE "AuthChallenge" (
  "id" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "accountIdentifier" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuthChallenge_expiresAt_idx" ON "AuthChallenge"("expiresAt");
