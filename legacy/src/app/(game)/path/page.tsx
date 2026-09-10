"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/client";
import { Track } from "@/components/game/track";
import { MissionSwitcher } from "@/components/game/mission-switcher";
import { WhatChangedPanel } from "@/components/game/what-changed-panel";
import { ChapterSummary } from "@/components/game/chapter-summary";
import { Panel } from "@/components/game/panel";
import type { MissionSummary, MissionPath, ChangeEvent } from "@/server/path/types";

interface PathResponse {
  missions: MissionSummary[];
  path: MissionPath | null;
  whatChanged: ChangeEvent | null;
}

export default function PathPage() {
  const [goalId, setGoalId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["path", goalId],
    queryFn: () => api.get<PathResponse>(`/api/path${goalId ? `?goalId=${goalId}` : ""}`),
    // The GET marks "what changed" as seen as a side effect — never refetch
    // automatically, or the panel would vanish behind the user's back.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  function selectMission(id: string) {
    setGoalId(id);
    setDismissed(false);
  }

  if (isLoading || !data) {
    return <div className="pt-4 font-game-body text-sm text-game-text-dim">Loading your path…</div>;
  }

  if (!data.path) {
    return (
      <div className="space-y-4 pt-4">
        <h1 className="font-game-display text-2xl font-extrabold tracking-tight">The Path</h1>
        <Panel className="p-4">
          <p className="font-game-body text-sm text-game-text-dim">
            No active mission yet.{" "}
            <Link href="/catalog" className="text-game-cyan underline underline-offset-2">
              Browse the catalogue
            </Link>{" "}
            to start one.
          </p>
        </Panel>
      </div>
    );
  }

  const { path } = data;
  const activeChapter = path.chapters.find((c) => c.nodes.some((n) => n.state === "active")) ?? null;
  const notYetPlanned = path.chapters.length === 0;

  return (
    <div className="space-y-4 pt-4">
      <MissionSwitcher missions={data.missions} onSelect={selectMission} />

      <h1 className="font-game-display text-2xl font-extrabold tracking-tight">{path.title}</h1>

      {data.whatChanged && !dismissed ? (
        <WhatChangedPanel event={data.whatChanged} onDismiss={() => setDismissed(true)} />
      ) : null}

      {notYetPlanned ? (
        <Panel className="p-4">
          <p className="font-game-body text-sm text-game-text-dim">
            Zandegi is still planning this mission — check back in a moment, or open it from{" "}
            <Link href="/goals" className="text-game-cyan underline underline-offset-2">
              Goals
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-6">
          {/* Right rail collapses to the top on mobile. */}
          <aside className="order-first mb-6 space-y-3 lg:order-last lg:mb-0">
            <ChapterSummary chapter={activeChapter} color={path.color} />
            <Panel className="p-3">
              <p className="flex items-center gap-2 font-game-body text-xs text-game-text-dim">
                <Users className="h-3.5 w-3.5" />
                Crew activity lands with the Crew page.
              </p>
            </Panel>
          </aside>

          <div>
            <Track chapters={path.chapters} color={path.color} />
          </div>
        </div>
      )}
    </div>
  );
}
