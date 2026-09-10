"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus, Check, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Panel } from "./panel";
import { AvatarRender } from "@/components/avatar/avatar-render";
import type { FriendSummary } from "@/server/social/service";

/**
 * The primary invite action, plus any incoming requests — reuses the
 * existing /api/friends endpoints rather than duplicating friendship logic.
 */
export function CrewInvite({ incoming }: { incoming: FriendSummary[] }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/friends", { email });
      setEmail("");
      qc.invalidateQueries({ queryKey: ["crew"] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't send that request");
    } finally {
      setBusy(false);
    }
  }

  async function respond(friendshipId: string, action: "accept" | "decline") {
    await api.patch(`/api/friends/${friendshipId}`, { action });
    qc.invalidateQueries({ queryKey: ["crew"] });
  }

  return (
    <div className="space-y-3">
      <Panel accent="rgb(var(--g-violet))" className="p-4">
        <form onSubmit={invite} className="flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@example.com"
            className="min-w-0 flex-1 rounded-md border border-game-surface-hi bg-game-void px-3 py-2 font-game-body text-sm text-game-text outline-none focus:border-game-violet"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-game-violet px-3.5 py-2 font-game-body text-sm font-semibold text-white disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" /> Invite
          </button>
        </form>
        {error ? <p className="mt-2 font-game-body text-xs text-game-magenta">{error}</p> : null}
      </Panel>

      {incoming.length > 0 ? (
        <div className="space-y-2">
          {incoming.map((r) => (
            <Panel key={r.friendshipId} className="flex items-center gap-3 p-3">
              <AvatarRender config={r.avatar} size={32} />
              <span className="min-w-0 flex-1 truncate font-game-body text-sm">{r.name}</span>
              <button
                onClick={() => respond(r.friendshipId, "accept")}
                aria-label={`Accept ${r.name}`}
                className="rounded-full bg-game-cyan/15 p-1.5 text-game-cyan"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => respond(r.friendshipId, "decline")}
                aria-label={`Decline ${r.name}`}
                className="rounded-full bg-game-surface-hi p-1.5 text-game-text-dim"
              >
                <X className="h-4 w-4" />
              </button>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
