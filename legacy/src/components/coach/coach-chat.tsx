"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/primitives";
import { Send, Sparkles, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
  focusToday?: string[];
  recommendations?: { kind: string; title: string; body: string }[];
  proposedActions?: ProposedAction[];
  provider?: string;
}

type ProposedAction =
  | { type: "create_task"; goalIdRef: string; title: string; description?: string; skillName?: string | null; difficulty?: number; estimatedMinutes?: number; priority?: string; dueInDays?: number | null }
  | { type: "adjust_timeline"; goalIdRef: string; newTimelineWeeks: number; reason: string }
  | { type: "reprioritise_skill"; goalIdRef: string; skillName: string; newConfidence: number; reason: string };

const STARTERS = [
  "What should I do today?",
  "What's my weakest skill?",
  "Am I on pace to hit my goal?",
  "What should I focus on this week?",
  "Why do I feel stuck?",
];

export function CoachChat({ goalId, compact = false }: { goalId?: string | null; compact?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await api.post<{
        conversationId: string;
        reply: string;
        focusToday: string[];
        recommendations: { kind: string; title: string; body: string }[];
        proposedActions: ProposedAction[];
        provider: string;
        confidence: number;
        fallbackReason: string | null;
      }>("/api/coach", { message: q, goalId: goalId ?? null, conversationId });

      setConversationId(res.conversationId);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.reply,
          focusToday: res.focusToday,
          recommendations: res.recommendations,
          proposedActions: res.proposedActions,
          provider: res.provider,
        },
      ]);
      if (res.fallbackReason) toast.push({ kind: "info", title: "Answered with the rules-based coach", body: res.fallbackReason });
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `_${err instanceof ApiClientError ? err.message : "Something went wrong."}_` }]);
    } finally {
      setBusy(false);
    }
  }

  async function applyAction(a: ProposedAction) {
    try {
      const payload =
        a.type === "create_task"
          ? { action: { type: "create_task", goalId: a.goalIdRef, title: a.title, description: a.description, skillName: a.skillName, difficulty: a.difficulty, estimatedMinutes: a.estimatedMinutes, priority: a.priority, dueInDays: a.dueInDays } }
          : a.type === "adjust_timeline"
            ? { action: { type: "adjust_timeline", goalId: a.goalIdRef, newTimelineWeeks: a.newTimelineWeeks } }
            : { action: { type: "reprioritise_skill", goalId: a.goalIdRef, skillName: a.skillName, newConfidence: a.newConfidence } };

      await api.post("/api/coach/actions", payload);
      toast.push({ kind: "success", title: "Applied", body: describeAction(a) });
      qc.invalidateQueries({ queryKey: ["goal", a.goalIdRef] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.push({ kind: "error", title: "Couldn't apply", body: err instanceof ApiClientError ? err.message : "Try again" });
    }
  }

  return (
    <div className={cn("flex flex-col", compact ? "h-[520px]" : "h-[calc(100dvh-12rem)]")}>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-border bg-surface p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-brand" />
            <p className="mt-2 text-sm font-medium">Ask your coach anything</p>
            <p className="mt-1 text-xs text-muted">It reads your real goals, tasks, skills and streak.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-border px-3 py-1 text-xs text-muted hover:text-fg">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm",
                m.role === "user" ? "bg-brand text-white" : "border border-border bg-surface-2",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

              {m.focusToday && m.focusToday.length > 0 && (
                <div className="mt-2 rounded-md bg-surface p-2">
                  <p className="text-[11px] font-medium text-muted">Focus today</p>
                  <ol className="mt-1 list-inside list-decimal text-xs">
                    {m.focusToday.map((f, j) => <li key={j}>{f}</li>)}
                  </ol>
                </div>
              )}

              {m.recommendations && m.recommendations.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.recommendations.map((r, j) => (
                    <div key={j} className="rounded-md bg-surface p-2">
                      <Badge tone="brand">{r.kind.replace("_", " ")}</Badge>
                      <p className="mt-1 text-xs font-medium">{r.title}</p>
                      <p className="text-[11px] text-muted">{r.body}</p>
                    </div>
                  ))}
                </div>
              )}

              {m.proposedActions && m.proposedActions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {m.proposedActions.map((a, j) => (
                    <div key={j} className="flex items-center justify-between gap-2 rounded-md bg-surface p-2">
                      <span className="text-[11px]">{describeAction(a)}</span>
                      <button onClick={() => applyAction(a)} className="btn-primary px-2 py-1 text-[11px]">
                        <Check className="h-3 w-3" /> Apply
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {m.role === "assistant" && m.provider === "heuristic" && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted"><Zap className="h-3 w-3" /> rules-based response</p>
              )}
            </div>
          </div>
        ))}

        {busy && <div className="text-xs text-muted">Coach is thinking…</div>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your plan, pace, weak spots…"
          className="input"
          disabled={busy}
        />
        <Button type="submit" loading={busy} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function describeAction(a: ProposedAction): string {
  if (a.type === "create_task") return `Add task: "${a.title}"`;
  if (a.type === "adjust_timeline") return `Change timeline to ${a.newTimelineWeeks} weeks — ${a.reason}`;
  return `Set ${a.skillName} confidence to ${a.newConfidence}% — ${a.reason}`;
}
