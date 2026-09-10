import { db } from "@/lib/db";
import { notFound, forbidden, badRequest } from "@/lib/errors";

/**
 * Challenges: a creator sets a metric + target over a time window; friends join;
 * progress is computed live from each participant's real activity in the window.
 */

type Metric = "xp" | "tasks" | "minutes" | "streak";

async function friendIds(userId: string): Promise<string[]> {
  const rows = await db.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
}

export async function createChallenge(userId: string, input: {
  title: string;
  description?: string;
  metric: Metric;
  target: number;
  endsAt: Date;
  visibility?: "friends" | "private" | "public";
}) {
  if (input.endsAt.getTime() <= Date.now()) throw badRequest("End date must be in the future");
  const challenge = await db.challenge.create({
    data: {
      creatorId: userId,
      title: input.title,
      description: input.description ?? null,
      metric: input.metric,
      target: input.target,
      endsAt: input.endsAt,
      visibility: input.visibility ?? "friends",
      participants: { create: { userId } },
    },
  });

  // notify friends
  const fids = await friendIds(userId);
  await db.notification.createMany({
    data: fids.map((fid) => ({
      userId: fid,
      type: "challenge",
      title: `New challenge: ${input.title}`,
      body: `Reach ${input.target} ${input.metric} by ${input.endsAt.toLocaleDateString()}`,
      href: "/challenges",
    })),
  });

  return challenge;
}

export async function joinChallenge(userId: string, challengeId: string) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw notFound("Challenge");
  if (challenge.visibility === "private" && challenge.creatorId !== userId) throw forbidden();
  if (challenge.visibility === "friends" && challenge.creatorId !== userId) {
    const fids = await friendIds(userId);
    if (!fids.includes(challenge.creatorId)) throw forbidden("This challenge is limited to the creator's friends");
  }
  await db.challengeParticipant.upsert({
    where: { challengeId_userId: { challengeId, userId } },
    create: { challengeId, userId },
    update: {},
  });
  return { joined: true };
}

async function participantProgress(metric: string, userId: string, from: Date, to: Date): Promise<number> {
  if (metric === "xp") {
    const agg = await db.xpEvent.aggregate({ where: { userId, createdAt: { gte: from, lte: to } }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }
  if (metric === "tasks") {
    return db.taskCompletion.count({ where: { userId, completedAt: { gte: from, lte: to } } });
  }
  if (metric === "minutes") {
    const agg = await db.taskCompletion.aggregate({ where: { userId, completedAt: { gte: from, lte: to } }, _sum: { minutesSpent: true } });
    return agg._sum.minutesSpent ?? 0;
  }
  // streak
  const s = await db.streak.findUnique({ where: { userId } });
  return s?.current ?? 0;
}

export interface ChallengeView {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  startsAt: string;
  endsAt: string;
  ended: boolean;
  isCreator: boolean;
  joined: boolean;
  leaderboard: { userId: string; name: string; avatarColor: string; progress: number; pct: number; isMe: boolean }[];
}

export async function getChallenge(userId: string, challengeId: string): Promise<ChallengeView> {
  const c = await db.challenge.findUnique({
    where: { id: challengeId },
    include: { participants: { include: { user: { select: { id: true, name: true, profile: { select: { avatarColor: true } } } } } } },
  });
  if (!c) throw notFound("Challenge");

  const to = new Date(Math.min(Date.now(), c.endsAt.getTime()));
  const leaderboard = await Promise.all(
    c.participants.map(async (p) => {
      const progress = await participantProgress(c.metric, p.userId, c.startsAt, to);
      return {
        userId: p.userId,
        name: p.user.name ?? "User",
        avatarColor: p.user.profile?.avatarColor ?? "#6366f1",
        progress,
        pct: Math.min(100, Math.round((progress / c.target) * 100)),
        isMe: p.userId === userId,
      };
    }),
  );
  leaderboard.sort((a, b) => b.progress - a.progress);

  return {
    id: c.id,
    title: c.title,
    description: c.description,
    metric: c.metric,
    target: c.target,
    startsAt: c.startsAt.toISOString(),
    endsAt: c.endsAt.toISOString(),
    ended: c.endsAt.getTime() < Date.now(),
    isCreator: c.creatorId === userId,
    joined: c.participants.some((p) => p.userId === userId),
    leaderboard,
  };
}

export async function listChallenges(userId: string) {
  const fids = await friendIds(userId);
  const challenges = await db.challenge.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { participants: { some: { userId } } },
        { visibility: "public" },
        { visibility: "friends", creatorId: { in: fids } },
      ],
    },
    orderBy: { endsAt: "asc" },
    take: 40,
  });
  return Promise.all(challenges.map((c) => getChallenge(userId, c.id)));
}
