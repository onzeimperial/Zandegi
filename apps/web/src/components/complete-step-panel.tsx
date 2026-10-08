"use client";

/**
 * Confirming a step: with a check, or with a photo.
 *
 * The verb is "confirm" throughout, so the button and the resulting
 * announcement say the same thing ("Confirm with a check" -> "Step
 * confirmed"). XP is shown only after the server has recorded it -- never
 * promised on the button beforehand (FR34).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  MAX_EVIDENCE_PHOTO_BYTES,
  type AwardView,
  type CompleteStepResult,
  type CompletionEvidence,
} from "@zandegi/api/client";

/** Larger photos are downscaled in the browser before upload. */
const DOWNSCALE_ABOVE_BYTES = 1024 * 1024;
const MAX_EDGE_PIXELS = 1600;

type Phase =
  | { kind: "idle" }
  | { kind: "photo"; file: File; preview: string }
  | { kind: "saving" }
  | { kind: "confirmed"; awards: AwardView[] }
  | { kind: "error"; message: string };

/**
 * Shrink a large photo before it is sent, so phone photos fit the upload
 * limit and arrive quickly. A format the browser cannot decode -- HEIC outside
 * Safari, say -- is sent as it is, and the server's own limit still applies.
 */
async function preparePhoto(file: File): Promise<Blob> {
  if (file.size <= DOWNSCALE_ABOVE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

function awardLine(award: AwardView): string {
  if (award.kind === "chapter") return `Chapter complete · +${award.xp} XP`;
  if (award.kind === "mission") return `Mission complete · +${award.xp} XP`;
  return `+${award.xp} XP`;
}

export function CompleteStepPanel({
  missionId,
  chapterIndex,
  stepIndex,
  state,
  completedWith,
  nextHref,
  pathHref,
}: {
  missionId: string;
  chapterIndex: number;
  stepIndex: number;
  state: "current" | "done" | "upcoming";
  completedWith?: { evidence: CompletionEvidence; xp: number };
  /** The step after this one, or `null` if this is the last. */
  nextHref: string | null;
  pathHref: string;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const fileInput = useRef<HTMLInputElement>(null);

  // Release the preview's object URL when it is replaced or the panel unmounts.
  const preview = phase.kind === "photo" ? phase.preview : null;
  useEffect(() => {
    return () => {
      if (preview !== null) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function confirm(evidence: CompletionEvidence, photo?: File) {
    setPhase({ kind: "saving" });
    const form = new FormData();
    form.set("chapter", String(chapterIndex));
    form.set("step", String(stepIndex));
    form.set("evidence", evidence);
    if (photo !== undefined) form.set("photo", await preparePhoto(photo), "evidence.jpg");

    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}/complete`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as {
        result?: CompleteStepResult;
        error?: { message?: string };
      } | null;
      if (!response.ok || body?.result === undefined) {
        setPhase({
          kind: "error",
          message: body?.error?.message ?? "That didn't save. Try again.",
        });
        return;
      }
      setPhase({ kind: "confirmed", awards: body.result.awards });
    } catch {
      setPhase({ kind: "error", message: "You seem to be offline. Try again when connected." });
    }
  }

  function choosePhoto(file: File | undefined) {
    if (file === undefined) return;
    if (file.size > MAX_EVIDENCE_PHOTO_BYTES * 4) {
      // Even a downscale of something this large would be slow; say so early.
      setPhase({ kind: "error", message: "That photo is too large. Try a smaller one." });
      return;
    }
    setPhase({ kind: "photo", file, preview: URL.createObjectURL(file) });
  }

  if (state === "done" && phase.kind !== "confirmed") {
    return (
      <section className="confirm-panel is-done" aria-label="Step status">
        <p className="confirm-title">Step confirmed</p>
        <p className="confirm-sub">
          {completedWith?.evidence === "ARTIFACT" ? "With a photo" : "With a check"}
          {completedWith !== undefined && <> · +{completedWith.xp} XP</>}
        </p>
        <Link href={nextHref ?? pathHref} className="d button-start">
          {nextHref === null ? "Back to your path" : "Next step"}
        </Link>
      </section>
    );
  }

  if (state === "upcoming") {
    return (
      <section className="confirm-panel" aria-label="Step status">
        <p className="confirm-title">Coming up</p>
        <p className="confirm-sub">Confirm the earlier steps first, then this one opens.</p>
        <Link href={pathHref} className="d button-tweak">
          Back to your path
        </Link>
      </section>
    );
  }

  if (phase.kind === "confirmed") {
    return (
      <section className="confirm-panel is-done" aria-live="polite">
        <p className="confirm-title">Step confirmed</p>
        {phase.awards.length === 0 ? (
          <p className="confirm-sub">This step was already confirmed.</p>
        ) : (
          <ul className="confirm-awards">
            {phase.awards.map((award) => (
              <li key={award.kind}>{awardLine(award)}</li>
            ))}
          </ul>
        )}
        <div className="confirm-actions">
          {nextHref !== null && (
            <Link href={nextHref} className="d button-start">
              Next step
            </Link>
          )}
          <Link
            href={pathHref}
            className={`d ${nextHref === null ? "button-start" : "button-tweak"}`}
          >
            Back to your path
          </Link>
        </div>
      </section>
    );
  }

  const saving = phase.kind === "saving";

  return (
    <section className="confirm-panel" aria-label="Confirm this step">
      <p className="confirm-title">Done this step?</p>
      <p className="confirm-sub">
        A photo is stronger evidence than a check. We check that it is a real photo and keep its
        fingerprint, never the photo itself.
      </p>

      {phase.kind === "photo" ? (
        <>
          {/* A plain <img>: the source is a local object URL, not a remote image
              that next/image could optimise. */}
          <img className="confirm-preview" src={phase.preview} alt="The photo you chose" />
          <div className="confirm-actions">
            <button
              type="button"
              className="d button-start"
              onClick={() => void confirm("ARTIFACT", phase.file)}
            >
              Confirm with this photo
            </button>
            <button
              type="button"
              className="d button-tweak"
              onClick={() => fileInput.current?.click()}
            >
              Choose another
            </button>
          </div>
        </>
      ) : (
        <div className="confirm-actions">
          <button
            type="button"
            className="d button-start"
            disabled={saving}
            onClick={() => void confirm("SELF")}
          >
            {saving ? "Saving…" : "Confirm with a check"}
          </button>
          <button
            type="button"
            className="d button-tweak"
            disabled={saving}
            onClick={() => fileInput.current?.click()}
          >
            Confirm with a photo
          </button>
        </div>
      )}

      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        // No `capture`: it forces the camera on many phones and blocks choosing
        // a photo already taken. Without it, phones offer both.
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => choosePhoto(event.target.files?.[0])}
      />

      {phase.kind === "error" && (
        <p className="confirm-error" role="alert">
          {phase.message}
        </p>
      )}
    </section>
  );
}
