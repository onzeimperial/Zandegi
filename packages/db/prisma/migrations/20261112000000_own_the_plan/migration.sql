-- Own the plan: a mission version for compare-and-set plan edits, and progress
-- logs. Additive only: one new column with a default, one new table.

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "MissionLog" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "value" DOUBLE PRECISION,
    "unit" TEXT,
    "loggedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MissionLog_ownerId_missionId_loggedAt_idx" ON "MissionLog"("ownerId", "missionId", "loggedAt" DESC);

-- AddForeignKey
ALTER TABLE "MissionLog" ADD CONSTRAINT "MissionLog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionLog" ADD CONSTRAINT "MissionLog_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
