import { db } from "@/lib/db";
import { DIVISIONS, type Division } from "@/lib/constants";
import { avatarFromProfile, DEFAULT_AVATAR, type AvatarConfig } from "@/components/avatar/config";
import { seasonIndexFor, seasonWindow, settleDivision, type Standing } from "./leagues";

/** Get or create the season row for a given index. */
async function ensureSeason(index: number) {
  const existing = await db.leagueSeason.findUnique({ where: { index } });
  if (existing) return existing;
  const { startsAt, endsAt } = seasonWindow(index);
  return db.leagueSeason.create({ data: { index, startsAt, endsAt } });
}

/**
 * Place a user in the current season, carrying their division forward from
 * last week (settling that week first if nobody has yet).
 */
async function ensureMembership(userId: string, now: Date) {
  const index = seasonIndexFor(now);
  const season = await ensureSeason(index);

  const existing = await db.leagueMember.findUnique({
    where: { seasonId_userId: { seasonId: season.id, userId } },
  });
  if (existing) return { season, member: existing };

  // Settle last season before deciding where this user starts.
  await settleSeasonIfNeeded(index - 1);

  const previous = await db.leagueSeason.findUnique({ where: { index: index - 1 } });
  let division: Division = "bronze";
  if (previous) {
    const prevMember = await db.leagueMember.findUnique({
      where: { seasonId_userId: { seasonId: previous.id, userId } },
    });
    if (prevMember) {
      const settled = prevMember.outcome;
      const prevDiv = prevMember.division as Division;
      const rank = DIVISIONS.indexOf(prevDiv);
      division =
        settled === "promoted"
          ? DIVISIONS[Math.min(DIVISIONS.length - 1, rank + 1)]!
          : settled === "relegated"
            ? DIVISIONS[Math.max(0, rank - 1)]!
            : prevDiv;
    }
  }

  const member = await db.leagueMember.create({
    data: { seasonId: season.id, userId, division },
  });
  return { season, member };
}

/** Settle every division of a finished season exactly once. */
export async function settleSeasonIfNeeded(index: number) {
  const season = await db.leagueSeason.findUnique({ where: { index } });
  if (!season) return;

  const unsettled = await db.leagueMember.count({
    where: { seasonId: season.id, outcome: null },
  });
  if (unsettled === 0) return;

  for (const division of DIVISIONS) {
    const members = await db.leagueMember.findMany({
      where: { seasonId: season.id, division },
      select: { userId: true, xp: true },
    });
    if (!members.length) continue;

    const settled = settleDivision(division, members as Standing[]);
    for (const s of settled) {
      await db.leagueMember.update({
        where: { seasonId_userId: { seasonId: season.id, userId: s.userId } },
        data: { finalRank: s.rank, outcome: s.outcome },
      });
    }
  }
}

/** Add season XP whenever XP is awarded. Safe to call on every award. */
export async function recordLeagueXp(userId: string, amount: number, now: Date = new Date()) {
  if (amount <= 0) return;
  const { season } = await ensureMembership(userId, now);
  await db.leagueMember.update({
    where: { seasonId_userId: { seasonId: season.id, userId } },
    data: { xp: { increment: amount } },
  });
}

export interface LeagueRow {
  userId: string;
  name: string;
  avatar: AvatarConfig;
  xp: number;
  rank: number;
  isYou: boolean;
}

export interface LeagueView {
  division: Division;
  seasonIndex: number;
  endsAt: Date;
  yourRank: number;
  yourXp: number;
  promoteCount: number;
  relegateCount: number;
  relegationApplies: boolean;
  rows: LeagueRow[];
  lastOutcome: string | null;
}

/** The current standings for the viewer's own division. */
export async function getLeague(userId: string, now: Date = new Date()): Promise<LeagueView> {
  const { season, member } = await ensureMembership(userId, now);
  const division = member.division as Division;

  const members = await db.leagueMember.findMany({
    where: { seasonId: season.id, division },
    orderBy: [{ xp: "desc" }, { userId: "asc" }],
    include: {
      user: {
        select: { name: true, profile: true },
      },
    },
  });

  const rows: LeagueRow[] = members.map((m, i) => ({
    userId: m.userId,
    name: m.user.profile?.displayName ?? m.user.name ?? "Someone",
    avatar: m.user.profile ? avatarFromProfile(m.user.profile) : DEFAULT_AVATAR,
    xp: m.xp,
    rank: i + 1,
    isYou: m.userId === userId,
  }));

  const you = rows.find((r) => r.isYou);

  // What happened to this user last week, for a one-off banner.
  const previous = await db.leagueSeason.findUnique({ where: { index: season.index - 1 } });
  let lastOutcome: string | null = null;
  if (previous) {
    const prev = await db.leagueMember.findUnique({
      where: { seasonId_userId: { seasonId: previous.id, userId } },
      select: { outcome: true },
    });
    lastOutcome = prev?.outcome ?? null;
  }

  return {
    division,
    seasonIndex: season.index,
    endsAt: season.endsAt,
    yourRank: you?.rank ?? rows.length + 1,
    yourXp: member.xp,
    promoteCount: 5,
    relegateCount: 5,
    relegationApplies: members.length >= 12 && DIVISIONS.indexOf(division) > 0,
    rows,
    lastOutcome,
  };
}
