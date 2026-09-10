"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/client";
import { Panel } from "@/components/game/panel";
import { CrewMemberRow } from "@/components/game/crew-member-row";
import { ActivityFeedRow } from "@/components/game/activity-feed-row";
import { CrewInvite } from "@/components/game/crew-invite";
import type { CrewMember, ActivityFeedItem } from "@/server/crew/service";
import type { FriendSummary } from "@/server/social/service";

interface CrewResponse {
  members: CrewMember[];
  feed: ActivityFeedItem[];
  incoming: FriendSummary[];
}

export default function CrewPage() {
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["crew"],
    queryFn: () => api.get<CrewResponse>("/api/crew"),
  });

  if (isLoading || !data) {
    return <div className="pt-4 font-game-body text-sm text-game-text-dim">Loading your crew…</div>;
  }

  const hasCrew = data.members.length > 0;

  if (!hasCrew && !inviteOpen) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 pt-4 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-game-violet/15 text-game-violet">
          <Users className="h-8 w-8" />
        </span>
        <div>
          <h1 className="font-game-display text-xl font-extrabold tracking-tight">Build your crew</h1>
          <p className="mt-1 max-w-xs font-game-body text-sm text-game-text-dim">
            See what your friends are working on — no ranking, no leaderboard, just visibility.
          </p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="rounded-md bg-game-violet px-6 py-3 font-game-body text-sm font-semibold text-white"
        >
          Invite a friend
        </button>
        {data.incoming.length > 0 ? (
          <p className="font-game-body text-xs text-game-text-dim">
            You have {data.incoming.length} pending request{data.incoming.length === 1 ? "" : "s"} —
            <button onClick={() => setInviteOpen(true)} className="ml-1 text-game-cyan underline underline-offset-2">
              view
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h1 className="font-game-display text-2xl font-extrabold tracking-tight">Crew</h1>
        {!inviteOpen ? (
          <button
            onClick={() => setInviteOpen(true)}
            className="font-game-body text-xs font-semibold text-game-cyan"
          >
            + Invite
          </button>
        ) : null}
      </div>

      {inviteOpen ? <CrewInvite incoming={data.incoming} /> : null}

      {hasCrew ? (
        <>
          <Panel className="p-1">
            {data.members.map((m) => (
              <div key={m.userId} className="px-3">
                <CrewMemberRow member={m} />
              </div>
            ))}
          </Panel>

          <section>
            <h2 className="mb-2 font-game-display text-base font-extrabold tracking-tight">Activity</h2>
            {data.feed.length === 0 ? (
              <p className="font-game-body text-sm text-game-text-dim">
                Nothing yet — activity shows up here as your crew completes milestones, levels up, and
                unlocks things.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.feed.map((item) => (
                  <ActivityFeedRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
