"use client";

/**
 * The opt-in daily reminder: one email a day, only while today has steps
 * waiting, and a plain way to stop.
 *
 * "Turn on reminders" -> "Reminders turned on"; "Stop reminders" -> "Reminders stopped".
 */

import { useState } from "react";
import type { ReminderSettingsView } from "@zandegi/api/client";
import { sendJson } from "@/lib/send-json";
import { browserTimezone } from "./timezone-sync";

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

export function ReminderToggle({ initial }: { initial: ReminderSettingsView }) {
  const [setting, setSetting] = useState(initial);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const saving = status.kind === "saving";

  async function change(enabled: boolean) {
    setStatus({ kind: "saving" });
    const zone = browserTimezone();
    const outcome = await sendJson<{ reminder: ReminderSettingsView }>("/api/reminders", "POST", {
      enabled,
      ...(zone === undefined ? {} : { timezone: zone }),
    });
    if (outcome.kind === "go-home") {
      window.location.assign("/");
      return;
    }
    if (outcome.kind !== "ok") {
      setStatus({ kind: "error", message: outcome.message });
      return;
    }
    setSetting(outcome.data.reminder);
    setStatus({ kind: "saved", message: enabled ? "Reminders turned on" : "Reminders stopped" });
  }

  return (
    <section id="reminder" className="card today-reminder" aria-labelledby="reminder-title">
      <h2 id="reminder-title" className="d">
        Daily reminder
      </h2>
      <p className="today-meta">
        {setting.enabled
          ? "One email a day, only while today has steps waiting."
          : "Get one email a day, only while today has steps waiting."}
      </p>
      {setting.enabled ? (
        <button
          type="button"
          className="d button-tweak today-reminder-action"
          disabled={saving}
          onClick={() => void change(false)}
        >
          {saving ? "Saving…" : "Stop reminders"}
        </button>
      ) : setting.available ? (
        <button
          type="button"
          className="d button-tweak today-reminder-action"
          disabled={saving}
          onClick={() => void change(true)}
        >
          {saving ? "Saving…" : "Turn on reminders"}
        </button>
      ) : (
        <p className="today-meta">Reminders aren&#39;t available right now.</p>
      )}
      <p className="plan-status" role="status" aria-live="polite">
        {status.kind === "saved" ? status.message : ""}
      </p>
      {status.kind === "error" && (
        <p className="confirm-error" role="alert">
          {status.message}
        </p>
      )}
    </section>
  );
}
