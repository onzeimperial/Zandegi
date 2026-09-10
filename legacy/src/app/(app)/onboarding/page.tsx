"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Target, Sparkles, TrendingUp, Trophy } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();

  async function begin() {
    await api.patch("/api/profile", { markOnboarded: true }).catch(() => {});
    router.push("/goals/new");
  }

  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand text-white">Z</span>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Welcome to Zandegi</h1>
      <p className="mt-2 text-sm text-muted">
        Here's how it works. You bring a goal — anything — and Zandegi turns it into a system you can actually follow.
      </p>

      <div className="mt-8 space-y-3 text-left">
        {[
          { icon: Target, t: "Describe your goal", d: "Plain language. \"Get a 99 ATAR\", \"learn piano\", \"get fit\" — all fine." },
          { icon: Sparkles, t: "Get a plan", d: "Milestones, a skill tree, and a task backlog sized to your available time." },
          { icon: TrendingUp, t: "Make progress", d: "Complete tasks, earn XP, level up skills. The plan adapts to your pace." },
          { icon: Trophy, t: "Ask your coach", d: "\"What should I do today?\" — answered from your real data." },
        ].map((s) => (
          <div key={s.t} className="flex gap-3 rounded-md border border-border bg-surface p-3">
            <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <div>
              <p className="text-sm font-medium">{s.t}</p>
              <p className="text-xs text-muted">{s.d}</p>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={begin} className="mt-8 w-full">Create my first goal</Button>
    </div>
  );
}
