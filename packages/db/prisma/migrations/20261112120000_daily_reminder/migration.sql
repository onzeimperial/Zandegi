-- Daily loop: an opt-in daily reminder per person. Additive only: one new table.
-- Turning reminders off clears "email"; "lastSentDay" stays so a day is never sent twice.

-- CreateTable
CREATE TABLE "ReminderPreference" (
    "ownerId" TEXT NOT NULL,
    "email" TEXT,
    "timezone" TEXT,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "lastSentDay" TEXT,

    CONSTRAINT "ReminderPreference_pkey" PRIMARY KEY ("ownerId")
);

-- AddForeignKey
ALTER TABLE "ReminderPreference" ADD CONSTRAINT "ReminderPreference_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
