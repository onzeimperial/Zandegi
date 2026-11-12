"use client";

/**
 * Log progress the plan did not foresee, in one line: a note, or a number with
 * an optional unit. A log earns no XP and is never sent to a model.
 *
 * "Log it" -> "Logged"; changing "Filed under" -> "Log moved".
 */

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { MISSION_LOG_LIMITS, type MissionLogView } from "@zandegi/api/client";
import { sendJson, type SendOutcome } from "@/lib/send-json";

/** How many recent logs a mission card shows. */
export const RECENT_LOGS = 5;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

export function logLabel(log: Pick<MissionLogView, "kind" | "text" | "value" | "unit">): string {
  if (log.kind === "note") return log.text ?? "";
  const value = log.value === undefined ? "" : String(log.value);
  return log.unit === undefined ? value : `${value} ${log.unit}`;
}

export function QuickLog({
  missionId,
  missionTitle,
  chapters,
  initialLogs,
}: {
  missionId: string;
  missionTitle: string;
  chapters: readonly { id: string; title: string }[];
  initialLogs: readonly MissionLogView[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"note" | "number">("note");
  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [logs, setLogs] = useState<MissionLogView[]>([...initialLogs]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const ids = { text: useId(), value: useId(), unit: useId(), kind: useId() };
  const saving = status.kind === "saving";
  const base = `/api/missions/${encodeURIComponent(missionId)}/logs`;

  const number = Number(value);
  const ready =
    kind === "note" ? text.trim().length > 0 : value.trim() !== "" && Number.isFinite(number);

  /** The saved data, or `null` after the failure has been shown (or the person sent home). */
  async function settle<T>(request: Promise<SendOutcome<T>>): Promise<T | null> {
    const outcome = await request;
    if (outcome.kind === "go-home") {
      window.location.assign("/");
      return null;
    }
    if (outcome.kind !== "ok") {
      setStatus({ kind: "error", message: outcome.message });
      return null;
    }
    return outcome.data;
  }

  async function submit() {
    setStatus({ kind: "saving" });
    const body =
      kind === "note"
        ? { kind, text }
        : { kind, value: number, ...(unit.trim() === "" ? {} : { unit }) };
    const saved = await settle(sendJson<{ log: MissionLogView }>(base, "POST", body));
    if (saved === null) return;
    const { log } = saved;
    setLogs((current) => [log, ...current]);
    setText("");
    setValue("");
    setStatus({ kind: "saved", message: "Logged" });
    router.refresh();
  }

  async function move(logId: string, chapterId: string) {
    setStatus({ kind: "saving" });
    const saved = await settle(
      sendJson<{ log: MissionLogView }>(`${base}/${encodeURIComponent(logId)}`, "PATCH", {
        chapterId,
      }),
    );
    if (saved === null) return;
    const { log } = saved;
    setLogs((current) => current.map((entry) => (entry.logId === log.logId ? log : entry)));
    setStatus({ kind: "saved", message: "Log moved" });
  }

  return (
    <div className="quick-log">
      <form
        className="quick-log-form"
        aria-label={`Log progress on ${missionTitle}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !saving) void submit();
        }}
      >
        <fieldset className="quick-log-kind">
          <legend className="sr-only">What are you logging?</legend>
          {(["note", "number"] as const).map((option) => (
            <label key={option} className={kind === option ? "is-on" : undefined}>
              <input
                type="radio"
                name={ids.kind}
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
              />
              {option === "note" ? "Note" : "Number"}
            </label>
          ))}
        </fieldset>

        {kind === "note" ? (
          <div className="quick-log-fields">
            <label htmlFor={ids.text} className="sr-only">
              Note
            </label>
            <input
              id={ids.text}
              value={text}
              maxLength={MISSION_LOG_LIMITS.maxTextLength}
              placeholder="What did you do?"
              onChange={(event) => setText(event.target.value)}
            />
          </div>
        ) : (
          <div className="quick-log-fields">
            <label htmlFor={ids.value} className="sr-only">
              Number
            </label>
            <input
              id={ids.value}
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              placeholder="5"
              onChange={(event) => setValue(event.target.value)}
            />
            <label htmlFor={ids.unit} className="sr-only">
              Unit, optional
            </label>
            <input
              id={ids.unit}
              value={unit}
              maxLength={MISSION_LOG_LIMITS.maxUnitLength}
              placeholder="km, kg, pages"
              onChange={(event) => setUnit(event.target.value)}
            />
          </div>
        )}

        <button
          type="submit"
          className="d button-tweak quick-log-submit"
          disabled={!ready || saving}
        >
          {saving ? "Saving…" : "Log it"}
        </button>
      </form>

      <p className="plan-status" role="status" aria-live="polite">
        {status.kind === "saved" ? status.message : ""}
      </p>
      {status.kind === "error" && (
        <p className="confirm-error" role="alert">
          {status.message}
        </p>
      )}

      {logs.length > 0 && (
        <ul className="quick-log-list" aria-label={`Recent logs on ${missionTitle}`}>
          {logs.slice(0, RECENT_LOGS).map((log) => (
            <li key={log.logId}>
              <span className="quick-log-text">{logLabel(log)}</span>
              <label className="quick-log-move">
                <span>Filed under</span>
                <select
                  value={log.chapterId}
                  disabled={saving}
                  onChange={(event) => void move(log.logId, event.target.value)}
                >
                  {chapters.map((chapter, index) => (
                    <option key={chapter.id} value={chapter.id}>
                      Chapter {index + 1} · {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
