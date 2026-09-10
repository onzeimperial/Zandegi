"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, EmptyState, SectionHeading, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AvatarRender, type AvatarConfig } from "@/components/avatar/avatar-render";
import { UserPlus, Check, X, BarChart3 } from "lucide-react";

interface FriendSummary {
  friendshipId: string;
  userId: string;
  name: string;
  avatarColor: string;
  avatar: AvatarConfig;
  level: number | null;
  totalXp: number | null;
  status: string;
}

export default function FriendsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [compareId, setCompareId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => api.get<{ accepted: FriendSummary[]; incoming: FriendSummary[]; outgoing: FriendSummary[] }>("/api/friends"),
  });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/api/friends", { email });
      setEmail("");
      toast.push({ kind: "success", title: "Request sent" });
      qc.invalidateQueries({ queryKey: ["friends"] });
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't send", body: err instanceof ApiClientError ? err.message : "" });
    }
  }

  async function respond(id: string, action: "accept" | "decline") {
    await api.patch(`/api/friends/${id}`, { action });
    qc.invalidateQueries({ queryKey: ["friends"] });
  }

  if (isLoading) return <Spinner className="py-24" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted">
          Compare progress fairly — adjusted for goal difficulty and time invested, not raw XP. Everything is private until you share it.
        </p>
      </div>

      <form onSubmit={add} className="card flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1">
          <Field label="Add a friend by email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
          </Field>
        </div>
        <Button type="submit"><UserPlus className="h-4 w-4" /> Send request</Button>
      </form>

      {(data?.incoming.length ?? 0) > 0 && (
        <section>
          <SectionHeading title="Requests" />
          <div className="space-y-2">
            {data!.incoming.map((f) => (
              <div key={f.friendshipId} className="card flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Avatar name={f.name} avatar={f.avatar} />
                  <span className="text-sm font-medium">{f.name}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => respond(f.friendshipId, "accept")}><Check className="h-4 w-4" /> Accept</Button>
                  <Button variant="ghost" onClick={() => respond(f.friendshipId, "decline")}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading title={`Friends (${data?.accepted.length ?? 0})`} />
        {(data?.accepted.length ?? 0) === 0 ? (
          <EmptyState title="No friends yet" description="Add someone by email to compare progress and run challenges." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data!.accepted.map((f) => (
              <div key={f.friendshipId} className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={f.name} avatar={f.avatar} />
                    <div>
                      <p className="text-sm font-medium">{f.name}</p>
                      <p className="text-[11px] text-muted">{f.level != null ? `Level ${f.level}` : "Level hidden"}</p>
                    </div>
                  </div>
                  <button onClick={() => setCompareId(compareId === f.userId ? null : f.userId)} className="btn-outline px-2 py-1 text-xs">
                    <BarChart3 className="h-3.5 w-3.5" /> Compare
                  </button>
                </div>
                {compareId === f.userId && <Comparison friendUserId={f.userId} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {(data?.outgoing.length ?? 0) > 0 && (
        <section>
          <SectionHeading title="Pending sent" />
          <div className="flex flex-wrap gap-2">
            {data!.outgoing.map((f) => (
              <Badge key={f.friendshipId}>{f.name} · pending</Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Avatar({ name, avatar }: { name: string; avatar?: AvatarConfig }) {
  return <AvatarRender config={avatar} size={36} title={name} />;
}

function Comparison({ friendUserId }: { friendUserId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["compare", friendUserId],
    queryFn: () => api.get<{ me: Row; them: Row }>(`/api/friends/${friendUserId}/compare`),
  });
  if (isLoading) return <p className="mt-3 text-xs text-muted">Comparing…</p>;
  if (!data) return null;

  // Only the numeric fields are comparable; "name" is not a metric.
  const rows: [string, NumericRowKey][] = [
    ["Fair score", "fairScore"],
    ["Efficiency (score/hr)", "efficiency"],
    ["Hours invested", "hoursInvested"],
    ["Tasks completed", "tasksCompleted"],
    ["Active goals", "activeGoals"],
    ["Streak", "streak"],
  ];

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <span className="text-muted">Metric</span>
        <span className="text-right font-medium">You</span>
        <span className="text-right font-medium">{data.them.name}</span>
        {rows.map(([label, key]) => (
          <FragmentRow key={label} label={label} me={data.me[key]} them={data.them[key]} />
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted">
        Fair score weights each goal's progress by its difficulty. Efficiency divides that by hours logged, so steady effort on hard goals isn't punished.
      </p>
    </div>
  );
}

function FragmentRow({ label, me, them }: { label: string; me: number | null; them: number | null }) {
  const better = me != null && them != null ? (me >= them ? "me" : "them") : null;
  return (
    <>
      <span className="text-muted">{label}</span>
      <span className={`text-right ${better === "me" ? "font-semibold text-success" : ""}`}>{me ?? "—"}</span>
      <span className={`text-right ${better === "them" ? "font-semibold text-success" : ""}`}>{them ?? "—"}</span>
    </>
  );
}

type NumericRowKey = Exclude<keyof Row, "name">;

interface Row {
  name: string;
  level: number | null;
  fairScore: number;
  efficiency: number;
  hoursInvested: number;
  tasksCompleted: number;
  activeGoals: number;
  streak: number | null;
}
