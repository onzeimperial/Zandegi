"use client";

import { useState } from "react";
import type { PipelineResult, ScoredChapter, StageEvent } from "@zandegi/ai";

type SseMessage =
  | { type: "progress"; event: StageEvent }
  | { type: "result"; result: PipelineResult }
  | { type: "error"; message: string };

const STAGE_LABELS: Record<StageEvent["stage"], string> = {
  interpret: "Reading your goal",
  resolve: "Classifying it",
  hydrate: "Checking knowledge",
  plan: "Planning chapters",
  detail: "Detailing steps",
  ground: "Checking facts",
  score: "Scoring XP",
  safety: "Safety pass",
  persist: "Finishing up",
};

export default function GeneratePage() {
  const [rawText, setRawText] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ScoredChapter[]>([]);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rawText.trim() || status === "generating") return;

    setStatus("generating");
    setChapters([]);
    setResult(null);
    setErrorMessage(null);
    setActiveStage(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const msg = JSON.parse(line.slice(5).trim()) as SseMessage;
          if (msg.type === "progress") {
            setActiveStage(msg.event.stage);
            if (msg.event.status === "error") {
              setErrorMessage(msg.event.detail ?? "Generation failed");
            }
            if (msg.event.chapter) {
              setChapters((prev) => [...prev, msg.event.chapter!]);
            }
          } else if (msg.type === "result") {
            setResult(msg.result);
          } else if (msg.type === "error") {
            setErrorMessage(msg.message);
          }
        }
      }
      setStatus("done");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  const mission = result?.event?.payload.mission;
  const refusal = result?.refusal;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Type a goal</h1>
        <p className="text-sm text-white/60">
          Live mission generation demo — no account, nothing saved. Requires
          <code className="mx-1 rounded bg-surface px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>
          in <code className="rounded bg-surface px-1 py-0.5 text-xs">.env</code>.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="run a half marathon in april, ive never run more than 5k"
          rows={3}
          className="rounded-lg border border-edge bg-surface p-3 text-paper placeholder:text-white/40 focus:border-violet focus:outline-none"
          disabled={status === "generating"}
        />
        <button
          type="submit"
          disabled={status === "generating" || !rawText.trim()}
          className="self-start rounded-lg bg-violet px-4 py-2 font-semibold text-paper disabled:opacity-50"
        >
          {status === "generating" ? "Generating…" : "Generate mission"}
        </button>
      </form>

      {status === "generating" && activeStage && (
        <p className="text-sm text-violet-hi">{STAGE_LABELS[activeStage as StageEvent["stage"]] ?? activeStage}…</p>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {refusal && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm">
          <p className="font-semibold text-gold">
            {refusal.route === "support" ? "This needs a person, not a mission." : "Let's narrow this down."}
          </p>
          <p className="mt-1 text-white/70">{refusal.reason}</p>
        </div>
      )}

      {chapters.length > 0 && (
        <div className="flex flex-col gap-4">
          {mission && (
            <h2 className="text-xl font-bold">
              {mission.title} <span className="text-sm font-normal text-white/50">— {mission.primaryDomain}</span>
            </h2>
          )}
          {chapters.map((chapter) => (
            <div key={chapter.index} className="rounded-lg border border-edge bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">
                  Chapter {chapter.index + 1}: {chapter.title}
                </h3>
                <span className="text-xs text-gold">+{chapter.completionXp} XP on completion</span>
              </div>
              <p className="mt-1 text-xs text-white/50">Exits when: {chapter.exitCondition}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {chapter.steps.map((step) => (
                  <li key={step.index} className="rounded border border-edge/60 p-2 text-sm">
                    <div className="flex items-baseline justify-between">
                      <span>{step.title}</span>
                      <span className="text-xs text-white/50">
                        {step.estimatedMinutes}min · {step.verification} · {step.baseXp} XP
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/60">{step.guide.approach}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {mission && (
            <p className="text-sm text-white/60">
              Full mission completion: <span className="text-gold">{mission.completionXp} XP</span>
              {result?.event?.payload.safety.professionalFrameApplied && (
                <span className="ml-2 text-white/40">(professional-guidance frame applied)</span>
              )}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
