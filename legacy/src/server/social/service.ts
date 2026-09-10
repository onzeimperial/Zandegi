import { db } from "@/lib/db";
import { notFound, badRequest, forbidden } from "@/lib/errors";
import { avatarFromProfile, DEFAULT_AVATAR, type AvatarConfig } from "@/components/avatar/config";

/**
 * Friendships + privacy-aware, effort-adjusted comparison.
 *
 * Raw XP comparison is misleading (a hard multi-year goal accrues XP slower than
 * an easy habit). The "fair score" normalises by goal difficulty and time
 * invested so comparison reflects effort + traction, not goal choice.
 */

export async function listFriends(userId: string) {
  const rows = await db.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: { id: true, name: true, profile: true } },
      addressee: { select: { id: true, name: true, profile: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const accepted: FriendSummary[] = [];
  const incoming: FriendSummary[] = [];
  const outgoing: FriendSummary[] = [];

  for (const r of rows) {
    const other = r.requesterId === userId ? r.addressee : r.requester;
    const summary: FriendSummary = {
      friendshipId: r.id,
      userId: other.id,
      name: other.name ?? "User",
      avatarColor: other.profile?.avatarColor ?? "#6366f1",
      avatar: other.profile ? avatarFromProfile(other.profile) : DEFAULT_AVATAR,
      level: other.profile?.showXp ? (other.profile?.level ?? 1) : null,
      totalXp: other.profile?.showXp ? (other.profile?.totalXp ?? 0) : null,
      status: r.status,
    };
    if (r.status === "accepted") accepted.push(summary);
    else if (r.status === "pending" && r.addresseeId === userId) incoming.push(summary);
    else if (r.status === "pending") outgoing.push(summary);
  }

  return { accepted, incoming, outgoing };
}

export interface FriendSummary {
  friendshipId: string;
  userId: string;
  name: string;
  avatarColor: string;
  avatar: AvatarConfig;
  level: number | null;
  totalXp: number | null;
  status: string;
}

export async function sendFriendRequest(userId: string, email: string) {
  const target = await db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  if (!target) throw notFound("No user with that email");
  if (target.id === userId) throw badRequest("You can't add yourself");

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });
  if (existing) throw badRequest(`Already ${existing.status === "accepted" ? "friends" : existing.status}`);

  const fr = await db.friendship.create({ data: { requesterId: userId, addresseeId: target.id, status: "pending" } });
  await db.notification.create({
    data: { userId: target.id, type: "friend", title: "New friend request", href: "/friends" },
  });
  return fr;
}

export async function respondToRequest(userId: string, friendshipId: string, action: "accept" | "decline" | "block") {
  const fr = await db.friendship.findUnique({ where: { id: friendshipId } });
  if (!fr) throw notFound("Request");
  if (fr.addresseeId !== userId && fr.requesterId !== userId) throw forbidden();

  if (action === "decline") {
    await db.friendship.delete({ where: { id: friendshipId } });
    return { removed: true };
  }
  if (fr.addresseeId !== userId && action === "accept") throw forbidden("Only the recipient can accept");

  const updated = await db.friendship.update({
    where: { id: friendshipId },
    data: { status: action === "accept" ? "accepted" : "blocked", respondedAt: new Date() },
  });
  if (action === "accept") {
    await db.notification.create({
      data: { userId: fr.requesterId, type: "friend", title: "Friend request accepted", href: "/friends" },
    });
  }
  return { status: updated.status };
}

/** Effort-adjusted comparison between the user and a friend. Respects privacy flags. */
export async function compareWithFriend(userId: string, friendUserId: string) {
  const friendship = await db.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: userId, addresseeId: friendUserId },
        { requesterId: friendUserId, addresseeId: userId },
      ],
    },
  });
  if (!friendship) throw forbidden("Not friends with this user");

  const [me, them] = await Promise.all([fairScore(userId), fairScore(friendUserId, true)]);
  return { me, them };
}

async function fairScore(userId: string, respectPrivacy = false) {
  const [profile, goals, completions, streak] = await Promise.all([
    db.profile.findUnique({ where: { userId } }),
    db.goal.findMany({ where: { userId }, select: { difficulty: true, progressPct: true, status: true, startedAt: true, visibility: true } }),
    db.taskCompletion.aggregate({ where: { userId }, _sum: { minutesSpent: true }, _count: true }),
    db.streak.findUnique({ where: { userId } }),
  ]);

  const visibleGoals = respectPrivacy
    ? goals.filter((g) => g.visibility === "public" || (profile?.showGoals ?? false))
    : goals;

  // fair score = Σ (progress% × difficulty) + consistency bonus, normalised to hours invested
  const traction = visibleGoals.reduce((a, g) => a + (g.progressPct / 100) * g.difficulty * 100, 0);
  const hours = (completions._sum.minutesSpent ?? 0) / 60;
  const efficiency = hours > 0 ? traction / hours : 0;

  return {
    name: profile?.displayName ?? "User",
    level: respectPrivacy && !(profile?.showXp ?? true) ? null : (profile?.level ?? 1),
    fairScore: Math.round(traction),
    efficiency: +efficiency.toFixed(1),
    hoursInvested: Math.round(hours),
    tasksCompleted: completions._count,
    activeGoals: visibleGoals.filter((g) => g.status === "active").length,
    streak: respectPrivacy && !(profile?.showStreak ?? true) ? null : (streak?.current ?? 0),
  };
}
