import { db } from "@/lib/db";
import { avatarFromProfile, DEFAULT_AVATAR, type AvatarConfig } from "@/components/avatar/config";
import type { Rarity, ActivityKind } from "@/lib/constants";

export interface CrewMember {
  userId: string;
  name: string;
  avatar: AvatarConfig;
  level: number | null;
  currentMission: string | null;
  lastActiveAt: string | null;
}

/**
 * Accepted friends only, ordered by real recent activity — never by score.
 * Per-field privacy exactly mirrors what the existing friends page already
 * respects: level needs showXp, current mission needs showGoals. Name and
 * avatar are unconditional, matching listFriends() in social/service.ts.
 */
export async function getCrewMembers(userId: string): Promise<CrewMember[]> {
  const friendships = await db.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true, profile: true } },
      addressee: { select: { id: true, name: true, profile: true } },
    },
  });

  const others = friendships.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
  if (!others.length) return [];

  const otherIds = others.map((o) => o.id);
  const [lastCompletions, activeGoals] = await Promise.all([
    db.taskCompletion.groupBy({
      by: ["userId"],
      where: { userId: { in: otherIds } },
      _max: { completedAt: true },
    }),
    db.goal.findMany({
      where: { userId: { in: otherIds }, status: "active" },
      orderBy: { lastActivityAt: "desc" },
      select: { userId: true, title: true },
    }),
  ]);

  const lastActiveByUser = new Map(lastCompletions.map((c) => [c.userId, c._max.completedAt]));
  // First match per user wins — goals are already ordered by lastActivityAt desc.
  const missionByUser = new Map<string, string>();
  for (const g of activeGoals) {
    if (!missionByUser.has(g.userId)) missionByUser.set(g.userId, g.title);
  }

  const members: CrewMember[] = others.map((o) => ({
    userId: o.id,
    name: o.name ?? "Someone",
    avatar: o.profile ? avatarFromProfile(o.profile) : DEFAULT_AVATAR,
    level: o.profile?.showXp ? (o.profile?.level ?? 1) : null,
    currentMission: o.profile?.showGoals ? (missionByUser.get(o.id) ?? null) : null,
    lastActiveAt: lastActiveByUser.get(o.id)?.toISOString() ?? null,
  }));

  // Most recently active first; never active sinks to the bottom.
  return members.sort((a, b) => {
    if (!a.lastActiveAt && !b.lastActiveAt) return 0;
    if (!a.lastActiveAt) return 1;
    if (!b.lastActiveAt) return -1;
    return b.lastActiveAt.localeCompare(a.lastActiveAt);
  });
}

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorAvatar: AvatarConfig;
  kind: ActivityKind;
  title: string;
  rarity: Rarity | null;
  createdAt: string;
}

const GOAL_LINKED_KINDS: ActivityKind[] = ["milestone_complete", "goal_complete"];

/**
 * Reverse-chronological feed from accepted friends only. Filtered per event
 * by the SAME privacy flags used everywhere else: a milestone/goal event
 * reveals a goal title, so it's gated by showGoals; a level-up reveals
 * standing, gated by showXp. Achievement unlocks and cosmetic drops don't
 * expose goal or XP specifics, so — like a friend's name and avatar — they
 * are shown unconditionally.
 */
export async function getFriendActivityFeed(userId: string, limit = 30): Promise<ActivityFeedItem[]> {
  const friendships = await db.friendship.findMany({
    where: { status: "accepted", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true, profile: true } },
      addressee: { select: { id: true, name: true, profile: true } },
    },
  });
  const others = friendships.map((f) => (f.requesterId === userId ? f.addressee : f.requester));
  if (!others.length) return [];

  const profileById = new Map(others.map((o) => [o.id, o]));
  const otherIds = others.map((o) => o.id);

  const events = await db.activityEvent.findMany({
    where: { userId: { in: otherIds } },
    orderBy: { createdAt: "desc" },
    // Over-fetch before privacy filtering removes some, so a friend with
    // showGoals off doesn't leave the feed looking sparser than it is.
    take: limit * 2,
  });

  const visible = events.filter((e) => {
    const owner = profileById.get(e.userId);
    if (!owner) return false;
    if (GOAL_LINKED_KINDS.includes(e.kind as ActivityKind)) return owner.profile?.showGoals ?? false;
    if (e.kind === "level_up") return owner.profile?.showXp ?? true;
    return true; // achievement_unlock, cosmetic_drop
  });

  return visible.slice(0, limit).map((e) => {
    const owner = profileById.get(e.userId)!;
    return {
      id: e.id,
      actorName: owner.name ?? "Someone",
      actorAvatar: owner.profile ? avatarFromProfile(owner.profile) : DEFAULT_AVATAR,
      kind: e.kind as ActivityKind,
      title: e.title,
      rarity: (e.rarity as Rarity | null) ?? null,
      createdAt: e.createdAt.toISOString(),
    };
  });
}
