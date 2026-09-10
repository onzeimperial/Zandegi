"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { LifeStar } from "@/components/game/life-star";
import { DomainRows } from "@/components/game/domain-rows";
import { AchievementGrid } from "@/components/game/achievement-grid";
import { Panel } from "@/components/game/panel";
import { DOMAIN_LABELS, DOMAIN_COLORS, type Domain } from "@/server/domains";
import type { DomainValue } from "@/server/domains/service";
import type { CharacterAchievement } from "@/server/character/service";
import { xpForLevel } from "@/server/xp/levels";

interface CharacterResponse {
  level: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  xpToNextLevel: number;
  progressPct: number;
  isMaxLevel: boolean;
  lifeStar: DomainValue[];
  achievements: CharacterAchievement[];
}

// Fixed, principled scale for the life star: XP required to reach level 20
// on the real level curve (src/server/xp/levels.ts). A fixed scale means
// the star's shape reflects genuine progress rather than always looking
// "full" the way a self-relative scale would.
const STAR_MAX_XP = xpForLevel(20);

export default function CharacterPage() {
  const [selected, setSelected] = useState<Domain | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["character"],
    queryFn: () => api.get<CharacterResponse>("/api/character"),
  });

  if (isLoading || !data) {
    return <div className="pt-4 font-game-body text-sm text-game-text-dim">Loading your character…</div>;
  }

  const unlockedCount = data.achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6 pt-4">
      <h1 className="font-game-display text-2xl font-extrabold tracking-tight">Character</h1>

      <LifeStar
        axes={data.lifeStar.map((d) => ({
          domain: d.domain,
          label: DOMAIN_LABELS[d.domain],
          value: d.xp,
          color: DOMAIN_COLORS[d.domain],
        }))}
        max={STAR_MAX_XP}
        selected={selected}
        onSelectAxis={(d) => setSelected((prev) => (prev === d ? null : (d as Domain)))}
      />

      <Panel className="p-4">
        <div className="flex items-baseline justify-between">
          <span className="font-game-display text-lg font-extrabold">Level {data.level}</span>
          <span className="font-game-body text-xs tabular-nums text-game-text-dim">
            {data.isMaxLevel ? "Max level" : `${data.xpIntoLevel}/${data.xpForThisLevel} XP`}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-game-surface-hi">
          <div
            className="h-full rounded-full bg-game-cyan transition-[width] duration-500"
            style={{ width: `${data.progressPct}%` }}
          />
        </div>
      </Panel>

      <section>
        <h2 className="mb-2 font-game-display text-base font-extrabold tracking-tight">Domains</h2>
        <DomainRows values={data.lifeStar} selected={selected} />
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-game-display text-base font-extrabold tracking-tight">Achievements</h2>
          <span className="font-game-body text-xs tabular-nums text-game-text-dim">
            {unlockedCount}/{data.achievements.length}
          </span>
        </div>
        <AchievementGrid achievements={data.achievements} />
      </section>
    </div>
  );
}
