-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'none',
    "trialStartedAt" DATETIME,
    "trialEndsAt" DATETIME,
    "currentPeriodEnd" DATETIME,
    "cancelledAt" DATETIME,
    "externalCustomerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyQuest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "key" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "rewardCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LeagueSeason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "index" INTEGER NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "division" TEXT NOT NULL DEFAULT 'bronze',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "finalRank" INTEGER,
    "outcome" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeagueMember_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "LeagueSeason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarColor" TEXT NOT NULL DEFAULT '#6366f1',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dailyMinutes" INTEGER NOT NULL DEFAULT 45,
    "weeklyDays" INTEGER NOT NULL DEFAULT 5,
    "onboardedAt" DATETIME,
    "publicProfile" BOOLEAN NOT NULL DEFAULT false,
    "showXp" BOOLEAN NOT NULL DEFAULT true,
    "showGoals" BOOLEAN NOT NULL DEFAULT false,
    "showStreak" BOOLEAN NOT NULL DEFAULT true,
    "allowChallenges" BOOLEAN NOT NULL DEFAULT true,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "dailyXpGoal" INTEGER NOT NULL DEFAULT 50,
    "remindersOn" BOOLEAN NOT NULL DEFAULT true,
    "reminderHour" INTEGER NOT NULL DEFAULT 19,
    "avatarBase" TEXT NOT NULL DEFAULT 'base_default',
    "avatarFace" TEXT NOT NULL DEFAULT 'face_default',
    "avatarHair" TEXT NOT NULL DEFAULT 'hair_default',
    "avatarOutfit" TEXT NOT NULL DEFAULT 'outfit_default',
    "avatarAccessory" TEXT NOT NULL DEFAULT 'none',
    "avatarAura" TEXT NOT NULL DEFAULT 'none',
    "avatarFrame" TEXT NOT NULL DEFAULT 'frame_default',
    "avatarSkinTone" TEXT NOT NULL DEFAULT '#e8b89b',
    "avatarHairColor" TEXT NOT NULL DEFAULT '#2d2418',
    "coins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Profile" ("allowChallenges", "avatarAccessory", "avatarAura", "avatarBase", "avatarColor", "avatarFace", "avatarFrame", "avatarHair", "avatarHairColor", "avatarOutfit", "avatarSkinTone", "bio", "coins", "createdAt", "dailyMinutes", "displayName", "id", "level", "onboardedAt", "publicProfile", "showGoals", "showStreak", "showXp", "timezone", "totalXp", "updatedAt", "userId", "weeklyDays") SELECT "allowChallenges", "avatarAccessory", "avatarAura", "avatarBase", "avatarColor", "avatarFace", "avatarFrame", "avatarHair", "avatarHairColor", "avatarOutfit", "avatarSkinTone", "bio", "coins", "createdAt", "dailyMinutes", "displayName", "id", "level", "onboardedAt", "publicProfile", "showGoals", "showStreak", "showXp", "timezone", "totalXp", "updatedAt", "userId", "weeklyDays" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "DailyQuest_userId_date_idx" ON "DailyQuest"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuest_userId_date_key_key" ON "DailyQuest"("userId", "date", "key");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSeason_index_key" ON "LeagueSeason"("index");

-- CreateIndex
CREATE INDEX "LeagueMember_seasonId_division_xp_idx" ON "LeagueMember"("seasonId", "division", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_seasonId_userId_key" ON "LeagueMember"("seasonId", "userId");
