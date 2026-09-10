"use client";

import Link from "next/link";
import { Check, Lock, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PathChapter, PathNode } from "@/server/path/types";

export function Track({ chapters, color }: { chapters: PathChapter[]; color: string }) {
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-4 left-[11px] top-4 w-px bg-game-surface-hi" aria-hidden />
      <div className="space-y-8">
        {chapters.map((chapter) => (
          <section key={chapter.id}>
            <header className="mb-3 -ml-6 flex items-baseline justify-between pl-6">
              <h2 className="font-game-display text-lg font-extrabold tracking-tight">{chapter.title}</h2>
              <span className="font-game-body text-xs tabular-nums text-game-text-dim">
                {chapter.tasksDone}/{chapter.tasksTotal}
              </span>
            </header>
            <ol className="space-y-3">
              {chapter.nodes.map((node) => (
                <li key={node.id}>
                  <TrackNode node={node} color={color} />
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}

function TrackNode({ node, color }: { node: PathNode; color: string }) {
  const interactive = node.state === "active" || node.state === "done";

  const circle = (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full border-2 transition-colors",
        node.state === "active" ? "h-11 w-11" : "h-9 w-9",
        node.state === "done" && "border-transparent",
        node.state === "active" && "animate-g-pulse-ring border-game-cyan",
        node.state === "available" && "border-game-text-dim",
        node.state === "locked" && "border-game-surface-hi",
      )}
      style={
        node.state === "done"
          ? { background: color }
          : node.state === "active"
            ? { background: "rgb(var(--g-surface-hi))" }
            : undefined
      }
    >
      {node.state === "done" ? (
        <Check className="h-4 w-4 text-game-void" strokeWidth={3} />
      ) : node.state === "active" ? (
        <Play className="h-4 w-4 text-game-cyan" fill="currentColor" />
      ) : node.state === "locked" ? (
        <Lock className="h-3.5 w-3.5 text-game-text-dim opacity-40" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-game-text-dim" />
      )}
    </span>
  );

  const label = (
    <span
      className={cn(
        "font-game-body text-sm",
        node.state === "locked" && "text-game-text-dim opacity-50",
        node.state === "available" && "text-game-text",
        node.state === "done" && "text-game-text-dim line-through decoration-game-text-dim/40",
        node.state === "active" && "font-semibold text-game-text",
      )}
    >
      {node.title}
    </span>
  );

  const content = (
    <div className="flex items-center gap-3 py-0.5">
      {circle}
      {label}
      {node.state === "active" ? (
        <span className="ml-auto font-game-body text-xs font-semibold text-game-cyan">
          +{node.xpReward} XP
        </span>
      ) : null}
    </div>
  );

  if (!interactive) {
    return (
      <div aria-disabled className="cursor-default opacity-90">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={`/path/step/${node.id}${node.state === "done" ? "?readOnly=1" : ""}`}
      className="-mx-2 block rounded-md px-2 outline-none transition-colors hover:bg-game-surface-hi/60 focus-visible:ring-2 focus-visible:ring-game-cyan"
    >
      {content}
    </Link>
  );
}
