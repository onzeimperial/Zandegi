import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { stringifyJson } from "@/lib/json";
import { HttpError } from "@/lib/errors";
import type { CoinSource } from "@/lib/constants";

type Tx = Prisma.TransactionClient;

export interface CoinChange {
  amount: number; // signed
  balance: number;
}

/**
 * Credit coins. Safe to call inside an existing transaction by passing `tx`
 * — callers in awardXp() do exactly that so the coin ledger and the XP
 * ledger commit together.
 */
export async function earnCoins(
  input: {
    userId: string;
    amount: number;
    source: CoinSource;
    goalId?: string | null;
    meta?: Record<string, unknown>;
  },
  tx?: Tx,
): Promise<CoinChange> {
  const amount = Math.max(0, Math.round(input.amount));
  if (amount === 0) {
    const profile = await (tx ?? db).profile.findUnique({ where: { userId: input.userId } });
    return { amount: 0, balance: profile?.coins ?? 0 };
  }
  return applyCoinDelta({ ...input, amount }, tx);
}

/**
 * Debit coins, rejecting when the balance is short. Runs in its own
 * transaction unless one is supplied, so the balance check and the
 * decrement cannot race.
 */
export async function spendCoins(
  input: {
    userId: string;
    amount: number;
    source: CoinSource;
    meta?: Record<string, unknown>;
  },
  tx?: Tx,
): Promise<CoinChange> {
  const amount = Math.max(0, Math.round(input.amount));
  const run = async (t: Tx) => {
    const profile = await t.profile.findUnique({ where: { userId: input.userId } });
    if (!profile) throw new HttpError(404, "not_found", "Profile not found");
    if (profile.coins < amount) {
      throw new HttpError(
        402,
        "insufficient_coins",
        `Not enough coins — need ${amount}, have ${profile.coins}`,
      );
    }
    return applyCoinDelta({ ...input, amount: -amount }, t);
  };

  return tx ? run(tx) : db.$transaction(run);
}

async function applyCoinDelta(
  input: {
    userId: string;
    amount: number; // signed
    source: CoinSource;
    goalId?: string | null;
    meta?: Record<string, unknown>;
  },
  tx?: Tx,
): Promise<CoinChange> {
  const run = async (t: Tx) => {
    const profile = await t.profile.findUnique({ where: { userId: input.userId } });
    const balance = Math.max(0, (profile?.coins ?? 0) + input.amount);

    if (profile) {
      await t.profile.update({ where: { userId: input.userId }, data: { coins: balance } });
    }

    await t.coinEvent.create({
      data: {
        userId: input.userId,
        goalId: input.goalId ?? null,
        source: input.source,
        amount: input.amount,
        balance,
        meta: input.meta ? stringifyJson(input.meta) : null,
      },
    });

    return { amount: input.amount, balance };
  };

  return tx ? run(tx) : db.$transaction(run);
}

export async function getBalance(userId: string): Promise<number> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { coins: true },
  });
  return profile?.coins ?? 0;
}

export async function listCoinHistory(userId: string, limit = 50) {
  return db.coinEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
