"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/client";
import { Spinner, EmptyState, SectionHeading, Progress, Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";
import { Swords, Plus, Crown } from "lucide-react";

interface ChallengeView {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  endsAt: string;
  ended: boolean;
  isCreator: boolean;
  joined: boolean;
  leaderboard: { userId: string; name: string; avatarColor: string; progress: number; pct: number; isMe: boolean }[];
}

export default function ChallengesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: () => api.get<{ challenges: ChallengeView[] }>("/api/challenges"),
    refetchInterval: 120_000,
  });

  async function join(id: string) {
    try {
      await api.post(`/api/challenges/${id}/join`);
      qc.invalidateQueries({ queryKey: ["challenges"] });
      toast.push({ kind: "success", title: "Joined challenge" });
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't join", body: err instanceof ApiClientError ? err.message : "" });
    }
  }

  if (isLoading) return <Spinner className="py-24" />;

  const active = (data?.challenges ?? []).filter((c) => !c.ended);
  const ended = (data?.challenges ?? []).filter((c) => c.ended);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Challenges</h1>
          <p className="mt-1 text-sm text-muted">Friendly competition on XP, tasks, focus time or streak.</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" /> New challenge
        </Button>
      </div>

      {showForm && <ChallengeForm onDone={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ["challenges"] }); }} />}

      {active.length === 0 && !showForm ? (
        <EmptyState icon={<Swords className="h-6 w-6" />} title="No active challenges" description="Create one and your friends will be invited." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.map((c) => (
            <ChallengeCard key={c.id} c={c} onJoin={() => join(c.id)} />
          ))}
        </div>
      )}

      {ended.length > 0 && (
        <div>
          <SectionHeading title="Finished" />
          <div className="grid gap-3 sm:grid-cols-2">
            {ended.map((c) => (
              <ChallengeCard key={c.id} c={c} onJoin={() => join(c.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ c, onJoin }: { c: ChallengeView; onJoin: () => void }) {
  const winner = c.ended ? c.leaderboard[0] : null;
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <Badge tone="brand">{c.metric}</Badge>
        <span className="text-[11px] text-muted">
          {c.ended ? "ended" : `ends ${new Date(c.endsAt).toLocaleDateString()}`}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium">{c.title}</p>
      {c.description && <p className="mt-0.5 text-[11px] text-muted">{c.description}</p>}
      <p className="mt-1 text-[11px] text-muted">Target: {c.target} {c.metric}</p>

      <div className="mt-3 space-y-2">
        {c.leaderboard.slice(0, 5).map((p, i) => (
          <div key={p.userId} className="flex items-center gap-2">
            <span className="w-4 text-[11px] text-muted">{i + 1}</span>
            <span className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: p.avatarColor }}>
              {initials(p.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={p.isMe ? "font-semibold" : ""}>{p.isMe ? "You" : p.name}{winner?.userId === p.userId && <Crown className="ml-1 inline h-3 w-3 text-warning" />}</span>
                <span className="text-muted">{p.progress}</span>
              </div>
              <Progress value={p.pct} className="mt-0.5 h-1.5" tone={p.pct >= 100 ? "success" : "brand"} />
            </div>
          </div>
        ))}
      </div>

      {!c.joined && !c.ended && (
        <Button variant="outline" onClick={onJoin} className="mt-3 w-full">Join</Button>
      )}
    </div>
  );
}

function ChallengeForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: "", description: "", metric: "xp", target: 1000, days: 7, visibility: "friends" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const endsAt = new Date(Date.now() + form.days * 864e5).toISOString();
      await api.post("/api/challenges", { title: form.title, description: form.description || undefined, metric: form.metric, target: form.target, endsAt, visibility: form.visibility });
      toast.push({ kind: "success", title: "Challenge created" });
      onDone();
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't create", body: err instanceof ApiClientError ? err.message : "" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid gap-3 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Title"><Input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. 2,000 XP sprint" /></Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description (optional)"><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
      </div>
      <Field label="Metric">
        <Select value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}>
          <option value="xp">XP earned</option>
          <option value="tasks">Tasks completed</option>
          <option value="minutes">Minutes focused</option>
          <option value="streak">Streak length</option>
        </Select>
      </Field>
      <Field label="Target"><Input type="number" min={1} value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: Number(e.target.value) }))} /></Field>
      <Field label="Duration (days)"><Input type="number" min={1} max={90} value={form.days} onChange={(e) => setForm((f) => ({ ...f, days: Number(e.target.value) }))} /></Field>
      <Field label="Visibility">
        <Select value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}>
          <option value="friends">Friends</option>
          <option value="private">Private (invite only)</option>
          <option value="public">Public</option>
        </Select>
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" loading={busy}>Create challenge</Button>
      </div>
    </form>
  );
}
