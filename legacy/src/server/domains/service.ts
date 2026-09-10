import { db } from "@/lib/db";
import { levelFromXp, levelProgress } from "@/server/xp/levels";
import { DOMAINS, DOMAIN_LABELS, CATEGORY_DOMAINS, domainForCategory, type Domain } from "./index";
import type { GoalCategory } from "@/lib/constants";

/** Synthetic XP-per-unit for Bond — see module doc in ./index.ts. */
const BOND_XP_PER_FRIEND = 200;
const BOND_XP_PER_CHALLENGE_JOINED = 150;
const BOND_XP_PER_CHALLENGE_CREATED = 300;

export interface DomainValue {
  domain: Domain;
  label: string;
  xp: number;
  level: number;
  progressPct: number;
  /** False for every domain except "bond" — see module doc in ./index.ts. */
  isRealXp: boolean;
}

/**
 * Real per-domain XP for 7 of 8 domains, from actual XpEvent rows joined to
 * the goal that earned them. Only XP tied to a goal counts — achievement and
 * streak XP have no category and are correctly excluded here (they still
 * count toward the account's overall level elsewhere).
 */
async function goalLinkedDomainXp(userId: string): Promise<Record<Domain, number>> {
  const totals = Object.fromEntries(CATEGORY_DOMAINS.map((d) => [d, 0])) as Record<Domain, number>;

  const events = await db.xpEvent.findMany({
    where: { userId, goalId: { not: null } },
    select: { amount: true, goal: { select: { category: true } } },
  });

  for (const e of events) {
    const category = e.goal?.category as GoalCategory | undefined;
    if (!category) continue;
    const domain = domainForCategory(category);
    if (!domain) continue; // categories with no domain never occur, but stay defensive
    totals[domain] += Math.max(0, e.amount);
  }

  return totals;
}

/** Synthetic Bond XP from social engagement — see module doc in ./index.ts. */
async function bondXp(userId: string): Promise<number> {
  const [friends, joined, created] = await Promise.all([
    db.friendship.count({
      where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    }),
    db.challengeParticipant.count({ where: { userId } }),
    db.challenge.count({ where: { creatorId: userId } }),
  ]);

  return (
    friends * BOND_XP_PER_FRIEND +
    joined * BOND_XP_PER_CHALLENGE_JOINED +
    created * BOND_XP_PER_CHALLENGE_CREATED
  );
}

/** The full 8-axis life star for one user. */
export async function getLifeStar(userId: string): Promise<DomainValue[]> {
  const [goalXp, bond] = await Promise.all([goalLinkedDomainXp(userId), bondXp(userId)]);
  const totals: Record<Domain, number> = { ...goalXp, bond };

  return DOMAINS.map((domain) => {
    const xp = totals[domain];
    const lp = levelProgress(xp);
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      xp,
      level: levelFromXp(xp),
      progressPct: lp.progressPct,
      isRealXp: domain !== "bond",
    };
  });
}

/**
 * Count of distinct users with at least one active goal in a domain, for the
 * landing page's per-domain population figure. Real data — no placeholder.
 */
export async function activeUserCountsByDomain(): Promise<Record<Domain, number>> {
  const rows = await db.goal.findMany({
    where: { status: "active" },
    select: { userId: true, category: true },
    distinct: ["userId", "category"],
  });

  const sets: Record<Domain, Set<string>> = Object.fromEntries(
    DOMAINS.map((d) => [d, new Set<string>()]),
  ) as Record<Domain, Set<string>>;

  for (const r of rows) {
    const domain = domainForCategory(r.category as GoalCategory);
    if (domain) sets[domain].add(r.userId);
  }

  return Object.fromEntries(DOMAINS.map((d) => [d, sets[d].size])) as Record<Domain, number>;
}
