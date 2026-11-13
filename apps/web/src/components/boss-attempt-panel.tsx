"use client";

/**
 * Attempting a chapter's test, and the debrief.
 *
 * The verb is "record" throughout, so the button and the announcement say the
 * same thing ("Record attempt" -> "Attempt recorded"). Nothing promises XP
 * before the attempt; XP appears only once the server has recorded it. "Not
 * yet" is a closed chapter with the test still open, never a failure (law 8).
 *
 * The attempt key is made once per form, and kept across a failed send, so a
 * double tap or a retry after a dropped connection is recognised as one
 * attempt by the server.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { responseToErrorCode } from "@/app/generate/generation-flow";
import { awardLine } from "@/components/complete-step-panel";
import { preparePhoto } from "@/lib/prepare-photo";
import {
  BOSS_DEBRIEF_LIMITS,
  MAX_EVIDENCE_PHOTO_BYTES,
  type BossAttemptResult,
  type BossDebrief,
  type BossResult,
} from "@zandegi/api/client";

type Phase =
  | { kind: "editing"; error?: string }
  | { kind: "saving" }
  | { kind: "recorded"; result: BossAttemptResult; askedToImprove: boolean };

const PROMPTS: { field: keyof BossDebrief; label: string; hint: string }[] = [
  { field: "wentWell", label: "What went well", hint: "Anything you'd do the same way again." },
  { field: "didntGoWell", label: "What didn't go well", hint: "No judgement. Just what happened." },
  { field: "tips", label: "Tips for next time", hint: "What you'd tell someone about to try it." },
  {
    field: "improve",
    label: "What I'll improve",
    hint: "One line. It becomes the first step of your next chapter.",
  },
];

function newAttemptKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

const EMPTY: Required<BossDebrief> = { tips: "", wentWell: "", didntGoWell: "", improve: "" };

export function BossAttemptPanel({
  missionId,
  chapterId,
  undoneSteps,
  retry,
  hasNextChapter,
  pathHref,
}: {
  missionId: string;
  chapterId: string;
  /** Steps still undone in this chapter. More than 0 means the person must choose to skip them. */
  undoneSteps: number;
  /** The chapter is already closed at "not yet": this is a try again. */
  retry: boolean;
  hasNextChapter: boolean;
  pathHref: string;
}) {
  const [attemptKey, setAttemptKey] = useState(newAttemptKey);
  const [result, setResult] = useState<BossResult | null>(null);
  const [skip, setSkip] = useState(false);
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [debrief, setDebrief] = useState<Required<BossDebrief>>(EMPTY);
  const [phase, setPhase] = useState<Phase>({ kind: "editing" });
  const heading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const preview = photo?.preview ?? null;
  useEffect(() => {
    return () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Move focus to the outcome, so keyboard and screen reader users land on it.
  useEffect(() => {
    if (phase.kind === "recorded") heading.current?.focus();
  }, [phase.kind]);

  function reset() {
    setAttemptKey(newAttemptKey());
    setResult(null);
    setSkip(false);
    setPhoto(null);
    setDebrief(EMPTY);
    setPhase({ kind: "editing" });
  }

  function choosePhoto(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MAX_EVIDENCE_PHOTO_BYTES * 4) {
      setPhase({ kind: "editing", error: "That photo is too large. Try a smaller one." });
      return;
    }
    setPhoto({ file, preview: URL.createObjectURL(file) });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (result === null) {
      setPhase({ kind: "editing", error: "Choose how it went: done, or not yet." });
      return;
    }
    if (undoneSteps > 0 && !retry && !skip) {
      setPhase({
        kind: "editing",
        error: "Tick the box to skip the steps left, or finish them first.",
      });
      return;
    }
    const answers = Object.entries(debrief).filter(([, text]) => text.trim().length > 0);
    if (answers.length === 0) {
      setPhase({ kind: "editing", error: "Answer at least one of the debrief questions." });
      return;
    }

    setPhase({ kind: "saving" });
    const form = new FormData();
    form.set("chapterId", chapterId);
    form.set("result", result);
    form.set("attemptKey", attemptKey);
    if (undoneSteps > 0 && skip) form.set("skipRest", "true");
    for (const [field, text] of answers) form.set(field, text.trim());
    const withPhoto = result === "done" && photo !== null;
    form.set("evidence", withPhoto ? "ARTIFACT" : "SELF");
    if (withPhoto) form.set("photo", await preparePhoto(photo.file), "evidence.jpg");

    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}/boss`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as {
        result?: BossAttemptResult;
        error?: { code?: string; message?: string };
      } | null;
      if (responseToErrorCode(body?.error?.code) === "go-home") {
        window.location.assign("/");
        return;
      }
      if (!response.ok || body?.result === undefined) {
        setPhase({
          kind: "editing",
          error: body?.error?.message ?? "That didn't save. Try again.",
        });
        return;
      }
      setPhase({
        kind: "recorded",
        result: body.result,
        askedToImprove: debrief.improve.trim().length > 0,
      });
    } catch {
      setPhase({ kind: "editing", error: "You seem to be offline. Try again when connected." });
    }
  }

  if (phase.kind === "recorded") {
    const { result: recorded, askedToImprove } = phase;
    const done = recorded.result === "done";
    return (
      <section className="confirm-panel is-done boss-result" aria-live="polite">
        <h2 ref={heading} tabIndex={-1} className="confirm-title">
          Attempt recorded
        </h2>
        {done ? (
          recorded.awards.length > 0 ? (
            <ul className="confirm-awards">
              {recorded.awards.map((award) => (
                <li key={award.kind}>{awardLine(award)}</li>
              ))}
            </ul>
          ) : (
            <p className="confirm-sub">Test passed. This test had already been counted.</p>
          )
        ) : (
          <p className="confirm-sub">
            Not yet is part of the path. The chapter has moved on, your notes are saved, and this
            test stays open. Try again whenever you&#39;re ready.
          </p>
        )}
        {recorded.improveStep !== null && (
          <p className="confirm-sub">Your improvement is now the first step of the next chapter.</p>
        )}
        {recorded.improveStep === null && askedToImprove && hasNextChapter && (
          <p className="confirm-sub">
            Your improvement is saved in your notes. You can add it as a step from Edit plan.
          </p>
        )}
        <div className="confirm-actions">
          <Link href={pathHref} className="d button-start">
            Back to your path
          </Link>
          {!done && (
            <button type="button" className="d button-tweak" onClick={reset}>
              Try again
            </button>
          )}
        </div>
      </section>
    );
  }

  const saving = phase.kind === "saving";
  const error = phase.kind === "editing" ? phase.error : undefined;

  return (
    <form className="confirm-panel boss-form" onSubmit={(event) => void submit(event)} noValidate>
      <fieldset className="boss-choice" disabled={saving}>
        <legend className="confirm-title">How did it go?</legend>
        {(["done", "not-yet"] as const).map((option) => (
          <label key={option} className={result === option ? "is-on" : undefined}>
            <input
              type="radio"
              name="result"
              value={option}
              checked={result === option}
              onChange={() => setResult(option)}
            />
            {option === "done" ? "Done" : "Not yet"}
          </label>
        ))}
      </fieldset>

      {result === "done" && (
        <div className="boss-photo">
          <p className="confirm-sub">
            A photo is optional. We check that it is a real photo and keep its fingerprint, never
            the photo itself.
          </p>
          {photo !== null && (
            // A local object URL, not a remote image next/image could optimise.
            <img className="confirm-preview" src={photo.preview} alt="The photo you chose" />
          )}
          <div className="confirm-actions">
            <button
              type="button"
              className="d button-tweak"
              disabled={saving}
              onClick={() => fileInput.current?.click()}
            >
              {photo === null ? "Add a photo" : "Choose another"}
            </button>
            {photo !== null && (
              <button
                type="button"
                className="d button-tweak"
                disabled={saving}
                onClick={() => setPhoto(null)}
              >
                Remove photo
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => choosePhoto(event.target.files?.[0])}
          />
        </div>
      )}

      {undoneSteps > 0 && !retry && (
        <label className="boss-skip">
          <input
            type="checkbox"
            checked={skip}
            disabled={saving}
            onChange={(event) => setSkip(event.target.checked)}
          />
          <span>
            Skip the {undoneSteps === 1 ? "step" : `${undoneSteps} steps`} left in this chapter.
            Skipped steps earn nothing and can&#39;t be done later.
          </span>
        </label>
      )}

      <fieldset className="boss-debrief" disabled={saving}>
        <legend className="confirm-title">Debrief</legend>
        <p className="confirm-sub">Answer at least one. Only you can see these.</p>
        {PROMPTS.map(({ field, label, hint }) => {
          const id = `boss-${field}`;
          const improve = field === "improve";
          const max = improve
            ? BOSS_DEBRIEF_LIMITS.maxImproveLength
            : BOSS_DEBRIEF_LIMITS.maxAnswerLength;
          const props = {
            id,
            value: debrief[field],
            maxLength: max,
            "aria-describedby": `${id}-hint`,
            onChange: (event: { target: { value: string } }) =>
              setDebrief((current) => ({ ...current, [field]: event.target.value })),
          };
          return (
            <div key={field} className="boss-prompt">
              <label htmlFor={id}>{label}</label>
              <span id={`${id}-hint`} className="boss-hint">
                {hint}
              </span>
              {improve ? <input type="text" {...props} /> : <textarea rows={2} {...props} />}
            </div>
          );
        })}
      </fieldset>

      <button type="submit" className="d button-start" disabled={saving}>
        {saving ? "Saving…" : "Record attempt"}
      </button>

      {error !== undefined && (
        <p className="confirm-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
