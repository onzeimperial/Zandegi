-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "templateKey" TEXT;

-- CreateTable
CREATE TABLE "CoinEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "source" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CoinEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoinEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "price" INTEGER,
    "unlockAchievementKey" TEXT,
    "palette" TEXT,
    "sortIndex" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "goalId" TEXT,
    "acquiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" DATETIME,
    CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserCosmetic_itemKey_fkey" FOREIGN KEY ("itemKey") REFERENCES "CosmeticItem" ("key") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GoalTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "typicalWeeks" INTEGER NOT NULL DEFAULT 12,
    "tags" TEXT NOT NULL DEFAULT '',
    "metricName" TEXT,
    "metricTarget" REAL,
    "skillsJson" TEXT NOT NULL,
    "milestonesJson" TEXT NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
INSERT INTO "new_Profile" ("allowChallenges", "avatarColor", "bio", "createdAt", "dailyMinutes", "displayName", "id", "level", "onboardedAt", "publicProfile", "showGoals", "showStreak", "showXp", "timezone", "totalXp", "updatedAt", "userId", "weeklyDays") SELECT "allowChallenges", "avatarColor", "bio", "createdAt", "dailyMinutes", "displayName", "id", "level", "onboardedAt", "publicProfile", "showGoals", "showStreak", "showXp", "timezone", "totalXp", "updatedAt", "userId", "weeklyDays" FROM "Profile";
DROP TABLE "Profile";
ALTER TABLE "new_Profile" RENAME TO "Profile";
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CoinEvent_userId_createdAt_idx" ON "CoinEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_key_key" ON "CosmeticItem"("key");

-- CreateIndex
CREATE INDEX "CosmeticItem_slot_rarity_idx" ON "CosmeticItem"("slot", "rarity");

-- CreateIndex
CREATE INDEX "UserCosmetic_userId_idx" ON "UserCosmetic"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_itemKey_key" ON "UserCosmetic"("userId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "GoalTemplate_key_key" ON "GoalTemplate"("key");

-- CreateIndex
CREATE INDEX "GoalTemplate_domain_idx" ON "GoalTemplate"("domain");

-- CreateIndex
CREATE INDEX "GoalTemplate_category_idx" ON "GoalTemplate"("category");
