import { route, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listFriends } from "@/server/social/service";
import { getCrewMembers, getFriendActivityFeed } from "@/server/crew/service";

export const GET = route(async () => {
  const user = await requireUser();
  const [members, feed, { incoming }] = await Promise.all([
    getCrewMembers(user.id),
    getFriendActivityFeed(user.id),
    listFriends(user.id),
  ]);
  return ok({ members, feed, incoming });
});
