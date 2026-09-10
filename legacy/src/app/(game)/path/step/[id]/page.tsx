import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { StepClient } from "@/components/game/step-client";

export default async function StepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ readOnly?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { readOnly } = await searchParams;

  const task = await db.task.findUnique({
    where: { id },
    include: { goal: { select: { userId: true, title: true } }, milestone: { select: { title: true } } },
  });
  if (!task || task.goal.userId !== session.user.id) notFound();

  // Position within the chapter, for the thin top progress bar. Tasks with
  // no milestone (e.g. the weekly-review task) have no chapter to show a
  // position within — the bar is omitted rather than showing a fake 1/1.
  let position: { index: number; total: number } | null = null;
  if (task.milestoneId) {
    const siblings = await db.task.findMany({
      where: { milestoneId: task.milestoneId, status: { not: "skipped" } },
      orderBy: { orderIndex: "asc" },
      select: { id: true },
    });
    const index = siblings.findIndex((t) => t.id === task.id);
    if (index >= 0) position = { index: index + 1, total: siblings.length };
  }

  const isDone = task.status === "done";
  const showSequence = !readOnly && !isDone;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-game-void">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/path?goalId=${task.goalId}`}
            aria-label="Close"
            className="rounded p-1 text-game-text-dim outline-none hover:text-game-text focus-visible:ring-2 focus-visible:ring-game-cyan"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <p className="min-w-0 truncate font-game-body text-xs text-game-text-dim">
            {task.goal.title}
            {task.milestone ? ` · ${task.milestone.title}` : ""}
          </p>
        </div>
        {position ? (
          <div
            className="mt-3 h-1 w-full overflow-hidden rounded-full bg-game-surface-hi"
            role="progressbar"
            aria-valuenow={position.index}
            aria-valuemin={1}
            aria-valuemax={position.total}
            aria-label="Position in this chapter"
          >
            <div
              className="h-full rounded-full bg-game-cyan transition-[width] duration-300"
              style={{ width: `${(position.index / position.total) * 100}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 space-y-4 overflow-y-auto p-4">
        <h1 className="font-game-display text-2xl font-extrabold tracking-tight">{task.title}</h1>
        {task.description ? (
          <p className="font-game-body text-sm text-game-text-dim">{task.description}</p>
        ) : (
          <p className="font-game-body text-sm italic text-game-text-dim">No description for this step.</p>
        )}
      </div>

      {showSequence ? (
        <StepClient taskId={task.id} goalId={task.goalId} />
      ) : (
        <div className="border-t border-game-surface-hi p-4">
          <p className="text-center font-game-body text-sm text-game-text-dim">Already completed.</p>
        </div>
      )}
    </div>
  );
}
