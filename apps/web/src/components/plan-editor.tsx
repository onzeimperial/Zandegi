"use client";

/**
 * Editing a mission's plan: rename a chapter, rewrite, reorder, add or delete a
 * step. Every change is one request carrying the version it was made against,
 * so an edit made on a stale screen saves nothing and says so.
 *
 * Verbs match their announcements: "Rename" -> "Chapter renamed", "Save step"
 * -> "Step saved", "Move up"/"Move down" -> "Step moved", "Delete step" ->
 * "Step deleted", "Add step" -> "Step added". There is no control to add or
 * remove a chapter, or to change a chapter's exit condition.
 */

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PLAN_EDIT_LIMITS,
  type MissionDraft,
  type PlanEdit,
  type StoredMissionView,
} from "@zandegi/api/client";
import { sendJson } from "@/lib/send-json";
import { Icon } from "./icons";

type Plan = { version: number; mission: MissionDraft };
type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export function PlanEditor({
  missionId,
  initial,
  doneStepIds,
}: {
  missionId: string;
  initial: Plan;
  doneStepIds: readonly string[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const done = new Set(doneStepIds);
  const saving = status.kind === "saving";
  const locked = saving || status.kind === "conflict";

  // Controls are disabled while a save is in flight, which drops keyboard
  // focus. Each control carries `data-focus="<row>|<control>"`; after the save
  // the same control on the same row (by id) gets focus back, or that row's
  // Edit control if the original is gone or disabled, or the heading.
  const focusAfterSave = useRef<string | null>(null);
  useEffect(() => {
    const key = focusAfterSave.current;
    if (status.kind === "saving" || key === null) return;
    focusAfterSave.current = null;
    const find = (target: string) =>
      document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(target)}"]`);
    const usable = (element: HTMLElement | null) =>
      element !== null && !(element as HTMLButtonElement).disabled ? element : null;
    const row = key.slice(0, key.lastIndexOf("|"));
    (
      usable(find(key)) ??
      usable(find(`${row}|edit`)) ??
      document.getElementById("plan-editor-title")
    )?.focus();
  }, [status]);

  async function apply(edit: PlanEdit, announcement: string): Promise<boolean> {
    focusAfterSave.current = (document.activeElement as HTMLElement | null)?.dataset.focus ?? null;
    setStatus({ kind: "saving" });
    const outcome = await sendJson<{ mission: StoredMissionView }>(
      `/api/missions/${encodeURIComponent(missionId)}/plan`,
      "PATCH",
      { version: plan.version, edit },
    );
    if (outcome.kind === "go-home") {
      window.location.assign("/");
      return false;
    }
    if (outcome.kind !== "ok") {
      setStatus(outcome);
      return false;
    }
    setPlan({ version: outcome.data.mission.version, mission: outcome.data.mission.mission });
    setStatus({ kind: "saved", message: announcement });
    router.refresh();
    return true;
  }

  const pathHref = `/path?mission=${encodeURIComponent(missionId)}`;

  return (
    <section className="plan-editor" aria-labelledby="plan-editor-title">
      <header className="plan-editor-head">
        <div>
          <div className="eyebrow">Edit plan · {plan.mission.title}</div>
          <h1 id="plan-editor-title" className="hero-title" tabIndex={-1}>
            Fit the plan to your life
          </h1>
          <p className="plan-editor-sub">
            Rewrite, reorder, add or delete steps. Steps you add or rewrite are your own words, and
            steps you add earn no XP for now. XP you have already earned never changes.
          </p>
        </div>
        <Link href={pathHref} className="d button-start plan-done">
          Done editing
        </Link>
      </header>

      <p className="plan-status" role="status" aria-live="polite">
        {status.kind === "saving" ? "Saving…" : status.kind === "saved" ? status.message : ""}
      </p>
      {(status.kind === "error" || status.kind === "conflict") && (
        <div className="confirm-error plan-error" role="alert">
          <p>{status.message}</p>
          {status.kind === "conflict" && (
            <button
              type="button"
              className="d button-tweak"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          )}
        </div>
      )}

      {plan.mission.chapters.map((chapter, chapterIndex) => (
        <section key={chapter.id} className="card plan-chapter">
          <ChapterTitle
            focusKey={`chapter-${chapter.id}`}
            number={chapterIndex + 1}
            title={chapter.title}
            disabled={locked}
            onRename={(title) =>
              apply({ op: "renameChapter", chapterId: chapter.id, title }, "Chapter renamed")
            }
          />
          <p className="plan-exit">Mini-goal: {chapter.exitCondition}</p>

          <ol className="plan-steps">
            {chapter.steps.map((step, stepIndex) => {
              const ids = chapter.steps.map((entry) => entry.id);
              const move = (offset: number) => {
                const next = [...ids];
                [next[stepIndex], next[stepIndex + offset]] = [
                  next[stepIndex + offset]!,
                  next[stepIndex]!,
                ];
                return apply(
                  { op: "reorderSteps", chapterId: chapter.id, stepIds: next },
                  "Step moved",
                );
              };
              return (
                <StepRow
                  key={step.id}
                  focusKey={`step-${step.id}`}
                  title={step.title}
                  approach={step.guide.approach}
                  own={step.writtenBy === "person"}
                  done={done.has(step.id)}
                  disabled={locked}
                  canMoveUp={stepIndex > 0}
                  canMoveDown={stepIndex < chapter.steps.length - 1}
                  canDelete={chapter.steps.length > 1}
                  onMove={move}
                  onSave={(changes) =>
                    apply({ op: "editStep", stepId: step.id, ...changes }, "Step saved")
                  }
                  onDelete={() => apply({ op: "deleteStep", stepId: step.id }, "Step deleted")}
                />
              );
            })}
          </ol>

          <AddStep
            disabled={locked || chapter.steps.length >= PLAN_EDIT_LIMITS.maxStepsPerChapter}
            onAdd={(title) => apply({ op: "addStep", chapterId: chapter.id, title }, "Step added")}
          />
        </section>
      ))}
    </section>
  );
}

function ChapterTitle({
  focusKey,
  number,
  title,
  disabled,
  onRename,
}: {
  number: number;
  title: string;
  focusKey: string;
  disabled: boolean;
  onRename: (title: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputId = useId();

  if (!editing) {
    return (
      <div className="plan-chapter-head">
        <h2 className="d">
          Chapter {number} · {title}
        </h2>
        <button
          type="button"
          className="plan-text-button"
          data-focus={`${focusKey}|edit`}
          disabled={disabled}
          onClick={() => {
            setDraft(title);
            setEditing(true);
          }}
        >
          <Icon name="pencil" /> Rename<span className="sr-only"> chapter {number}</span>
        </button>
      </div>
    );
  }

  return (
    <form
      className="plan-inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onRename(draft)) setEditing(false);
      }}
    >
      <label htmlFor={inputId}>Chapter {number} title</label>
      <input
        id={inputId}
        value={draft}
        maxLength={PLAN_EDIT_LIMITS.maxTitleLength}
        required
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="plan-form-actions">
        <button
          type="submit"
          className="d button-start"
          data-focus={`${focusKey}|save`}
          disabled={disabled || draft.trim() === ""}
        >
          Rename
        </button>
        <button type="button" className="d button-tweak" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function StepRow({
  focusKey,
  title,
  approach,
  own,
  done,
  disabled,
  canMoveUp,
  canMoveDown,
  canDelete,
  onMove,
  onSave,
  onDelete,
}: {
  title: string;
  approach: string;
  own: boolean;
  done: boolean;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onMove: (offset: number) => Promise<boolean>;
  focusKey: string;
  /** Only the fields the person changed, compared after trimming. */
  onSave: (changes: { title?: string; approach?: string }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftApproach, setDraftApproach] = useState(approach);
  const titleId = useId();
  const approachId = useId();

  if (mode === "edit") {
    return (
      <li className="plan-step is-editing">
        <form
          className="plan-inline-form"
          onSubmit={async (event) => {
            event.preventDefault();
            // Send only what changed: an untouched field is never re-sent, so
            // an over-long generated approach cannot fail a title-only edit.
            const changes = {
              ...(draftTitle.trim() === title.trim() ? {} : { title: draftTitle }),
              ...(draftApproach.trim() === approach.trim() ? {} : { approach: draftApproach }),
            };
            // Nothing changed: saving would only strip sources for no reason.
            if (Object.keys(changes).length === 0) {
              setMode("view");
              return;
            }
            if (await onSave(changes)) setMode("view");
          }}
        >
          <label htmlFor={titleId}>Step title</label>
          <input
            id={titleId}
            value={draftTitle}
            maxLength={PLAN_EDIT_LIMITS.maxTitleLength}
            required
            autoFocus
            onChange={(event) => setDraftTitle(event.target.value)}
          />
          <label htmlFor={approachId}>How to do it</label>
          <textarea
            id={approachId}
            value={draftApproach}
            rows={4}
            maxLength={PLAN_EDIT_LIMITS.maxApproachLength}
            onChange={(event) => setDraftApproach(event.target.value)}
          />
          {!own && (
            <p className="plan-hint">
              Saving makes this step your own words. Its sources are removed, because they no longer
              vouch for it.
            </p>
          )}
          <div className="plan-form-actions">
            <button
              type="submit"
              className="d button-start"
              data-focus={`${focusKey}|save`}
              disabled={disabled || draftTitle.trim() === ""}
            >
              Save step
            </button>
            <button type="button" className="d button-tweak" onClick={() => setMode("view")}>
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`plan-step${done ? " is-done" : ""}`}>
      <div className="plan-step-text">
        <span className="plan-step-title">
          {done && (
            <span className="plan-done-mark">
              <Icon name="check" strokeWidth={3} />
              <span className="sr-only">Done: </span>
            </span>
          )}
          {title}
        </span>
        {own && <span className="plan-own">Your step</span>}
      </div>

      {mode === "confirm-delete" ? (
        <div className="plan-step-actions" role="group" aria-label={`Delete ${title}?`}>
          <span className="plan-hint">
            {done ? "Delete it? The XP you earned stays." : "Delete this step?"}
          </span>
          <button
            type="button"
            className="plan-text-button danger"
            data-focus={`${focusKey}|delete`}
            disabled={disabled}
            onClick={async () => {
              if (!(await onDelete())) setMode("view");
            }}
          >
            Delete step
          </button>
          <button type="button" className="plan-text-button" onClick={() => setMode("view")}>
            Keep
          </button>
        </div>
      ) : (
        <div className="plan-step-actions" role="group" aria-label={`Change ${title}`}>
          <button
            type="button"
            className="plan-icon-button"
            data-focus={`${focusKey}|up`}
            disabled={disabled || !canMoveUp}
            onClick={() => void onMove(-1)}
            aria-label={`Move up: ${title}`}
          >
            <span aria-hidden="true">↑</span>
          </button>
          <button
            type="button"
            className="plan-icon-button"
            data-focus={`${focusKey}|down`}
            disabled={disabled || !canMoveDown}
            onClick={() => void onMove(1)}
            aria-label={`Move down: ${title}`}
          >
            <span aria-hidden="true">↓</span>
          </button>
          <button
            type="button"
            className="plan-text-button"
            data-focus={`${focusKey}|edit`}
            disabled={disabled}
            onClick={() => {
              setDraftTitle(title);
              setDraftApproach(approach);
              setMode("edit");
            }}
          >
            Edit<span className="sr-only"> {title}</span>
          </button>
          {canDelete && (
            <button
              type="button"
              className="plan-text-button"
              disabled={disabled}
              onClick={() => setMode("confirm-delete")}
            >
              Delete<span className="sr-only"> {title}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function AddStep({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (title: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const inputId = useId();
  return (
    <form
      className="plan-add"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await onAdd(title)) setTitle("");
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        New step title
      </label>
      <input
        id={inputId}
        value={title}
        placeholder="Add a step of your own"
        maxLength={PLAN_EDIT_LIMITS.maxTitleLength}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button type="submit" className="d button-tweak" disabled={disabled || title.trim() === ""}>
        Add step
      </button>
    </form>
  );
}
