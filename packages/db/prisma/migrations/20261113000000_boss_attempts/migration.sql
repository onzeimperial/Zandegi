-- Boss fights: one row per boss attempt, holding the raw result and the
-- debrief. Personal content, deletable, never a ledger fact. Additive only:
-- one new table, no change to any existing table or row.

-- CreateTable
CREATE TABLE "BossAttempt" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "tips" TEXT,
    "wentWell" TEXT,
    "didntGoWell" TEXT,
    "improve" TEXT,
    "attemptedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BossAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BossAttempt_ownerId_missionId_attemptedAt_idx" ON "BossAttempt"("ownerId", "missionId", "attemptedAt" DESC);

-- AddForeignKey
ALTER TABLE "BossAttempt" ADD CONSTRAINT "BossAttempt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BossAttempt" ADD CONSTRAINT "BossAttempt_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
