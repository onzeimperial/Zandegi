-- The durable store for the two-person test. Creates only new objects.

-- CreateTable
CREATE TABLE "Principal" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT,
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Principal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "generatedAt" TIMESTAMPTZ(3) NOT NULL,
    "goalText" TEXT NOT NULL,
    "pursuitSlug" TEXT NOT NULL,
    "mission" JSONB NOT NULL,
    "safetyClass" TEXT NOT NULL,
    "goalContext" JSONB,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionClaim" (
    "ownerId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "claimedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionClaim_pkey" PRIMARY KEY ("ownerId","completionId")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "position" BIGSERIAL NOT NULL,
    "ownerId" TEXT NOT NULL,
    "entry" JSONB NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("position")
);

-- CreateTable
CREATE TABLE "GenerationUsage" (
    "principalId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "GenerationUsage_pkey" PRIMARY KEY ("principalId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Principal_tokenHash_key" ON "Principal"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Principal_clerkUserId_key" ON "Principal"("clerkUserId");

-- CreateIndex
CREATE INDEX "Mission_ownerId_generatedAt_idx" ON "Mission"("ownerId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "LedgerEntry_ownerId_position_idx" ON "LedgerEntry"("ownerId", "position");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionClaim" ADD CONSTRAINT "CompletionClaim_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationUsage" ADD CONSTRAINT "GenerationUsage_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "Principal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Law 4: the ledger is append-only, and the database enforces it. Corrections
-- are compensating entries, never edits. Prisma cannot express a trigger, so it
-- lives only here.
CREATE FUNCTION "reject_ledger_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LedgerEntry_append_only"
BEFORE UPDATE OR DELETE ON "LedgerEntry"
FOR EACH ROW EXECUTE FUNCTION "reject_ledger_change"();

CREATE TRIGGER "LedgerEntry_no_truncate"
BEFORE TRUNCATE ON "LedgerEntry"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_ledger_change"();
