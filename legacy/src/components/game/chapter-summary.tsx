import { Panel } from "./panel";
import type { PathChapter } from "@/server/path/types";

export function ChapterSummary({ chapter, color }: { chapter: PathChapter | null; color: string }) {
  if (!chapter) {
    return (
      <Panel className="p-4">
        <p className="font-game-body text-sm text-game-text-dim">No active chapter — mission complete.</p>
      </Panel>
    );
  }

  const pct = chapter.tasksTotal > 0 ? Math.round((chapter.tasksDone / chapter.tasksTotal) * 100) : 0;

  return (
    <Panel accent={color} className="p-4">
      <p className="font-game-body text-[11px] uppercase tracking-wide text-game-text-dim">Current chapter</p>
      <h3 className="mt-1 font-game-display text-base font-extrabold tracking-tight">{chapter.title}</h3>
      {chapter.description ? (
        <p className="mt-1.5 font-game-body text-xs text-game-text-dim">{chapter.description}</p>
      ) : null}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-game-surface-hi">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="mt-1.5 font-game-body text-xs tabular-nums text-game-text-dim">
        {chapter.tasksDone}/{chapter.tasksTotal} steps · +{chapter.xpReward} XP on completion
      </p>
    </Panel>
  );
}
