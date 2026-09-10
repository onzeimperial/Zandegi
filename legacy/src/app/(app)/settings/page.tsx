"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Spinner, SectionHeading } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

interface Profile {
  displayName: string;
  bio: string | null;
  avatarColor: string;
  timezone: string;
  dailyMinutes: number;
  weeklyDays: number;
  publicProfile: boolean;
  showXp: boolean;
  showGoals: boolean;
  showStreak: boolean;
  allowChallenges: boolean;
}

export default function SettingsPage() {
  const toast = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<{ profile: Profile }>("/api/profile"),
  });
  const [form, setForm] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile) setForm(data.profile);
  }, [data]);

  if (isLoading || !form) return <Spinner className="py-24" />;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await api.patch("/api/profile", form);
      toast.push({ kind: "success", title: "Settings saved" });
    } catch {
      toast.push({ kind: "error", title: "Couldn't save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section className="card space-y-4 p-5">
        <SectionHeading title="Profile" />
        <Field label="Display name">
          <Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
        </Field>
        <Field label="Bio">
          <Input value={form.bio ?? ""} onChange={(e) => set("bio", e.target.value)} placeholder="Optional" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Avatar colour">
            <Input type="color" value={form.avatarColor} onChange={(e) => set("avatarColor", e.target.value)} className="h-10 p-1" />
          </Field>
          <Field label="Timezone">
            <Input value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <SectionHeading title="Capacity" subtitle="Used to size plans and judge your pace" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minutes per day">
            <Input type="number" min={5} max={600} value={form.dailyMinutes} onChange={(e) => set("dailyMinutes", Number(e.target.value))} />
          </Field>
          <Field label="Days per week">
            <Select value={form.weeklyDays} onChange={(e) => set("weeklyDays", Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <SectionHeading title="Privacy" subtitle="Nothing is shared until you turn it on" />
        {([
          ["publicProfile", "Discoverable profile"],
          ["showXp", "Show my level & XP to friends"],
          ["showGoals", "Show my goals to friends"],
          ["showStreak", "Show my streak to friends"],
          ["allowChallenges", "Allow friends to challenge me"],
        ] as [keyof Profile, string][]).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => set(key, e.target.checked as Profile[typeof key])}
              className="h-4 w-4"
            />
          </label>
        ))}
      </section>

      <Button onClick={save} loading={saving}>Save changes</Button>
    </div>
  );
}
