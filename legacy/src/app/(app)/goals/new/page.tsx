"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiClientError } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { Sparkles, Wand2, ArrowRight, Lightbulb } from "lucide-react";

const IDEAS = [
  "I want to score 2400+ on the UCAT by next September",
  "Get a 99 ATAR",
  "Become a professional-level pianist",
  "Learn enough Python to build and ship a web app",
  "Train for a half marathon",
  "Get my finances and habits in order this year",
];

type Phase = "input" | "clarify" | "working";

export default function NewGoalPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("input");
  const [rawInput, setRawInput] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [preferHeuristic, setPreferHeuristic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goalId, setGoalId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);

  async function submitInitial(e: React.FormEvent) {
    e.preventDefault();
    if (rawInput.trim().length < 3) return;
    setError(null);
    setPhase("working");
    try {
      const res = await api.post<
        | { goalId: string; needsClarification: true; questions: string[]; interpretation: string; provider: string }
        | { goalId: string; needsClarification: false; provider: string; fallbackReason: string | null }
      >("/api/goals", {
        rawInput: rawInput.trim(),
        targetDate: targetDate || undefined,
        preferHeuristic,
      });

      setGoalId(res.goalId);
      if (res.needsClarification) {
        setQuestions(res.questions);
        setInterpretation(res.interpretation);
        setAnswers(new Array(res.questions.length).fill(""));
        setPhase("clarify");
        return;
      }
      finish(res.goalId, res.provider, "fallbackReason" in res ? res.fallbackReason : null);
    } catch (err) {
      setPhase("input");
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    }
  }

  async function submitAnswers(e: React.FormEvent, skip = false) {
    e.preventDefault();
    if (!goalId) return;
    void skip;
    setPhase("working");
    setError(null);
    try {
      const combined = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || "(no answer)"}`).join("\n\n");
      const res = await api.post<
        | { needsClarification: true; questions: string[]; interpretation: string }
        | { needsClarification: false; provider: string; model: string | null; fallbackReason: string | null }
      >(`/api/goals/${goalId}/decompose`, { clarificationAnswers: combined, preferHeuristic });

      if (res.needsClarification) {
        setQuestions(res.questions);
        setInterpretation(res.interpretation);
        setAnswers(new Array(res.questions.length).fill(""));
        setPhase("clarify");
        return;
      }
      finish(goalId, res.provider, res.fallbackReason);
    } catch (err) {
      setPhase("clarify");
      setError(err instanceof ApiClientError ? err.message : "Couldn't build the plan. Try again.");
    }
  }

  function finish(id: string, provider: string, fallbackReason: string | null) {
    qc.invalidateQueries({ queryKey: ["goals"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    toast.push({
      kind: "success",
      title: "Plan ready",
      body: provider === "ai" ? "AI-tailored plan created." : `Rules-based plan created${fallbackReason ? ` (${fallbackReason})` : ""}.`,
    });
    router.push(`/goals/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New goal</h1>
        <p className="mt-1 text-sm text-muted">
          Describe what you want to achieve in your own words. Zandegi builds the milestones, skill tree and tasks.
        </p>
      </div>

      {phase === "clarify" ? (
        <form onSubmit={submitAnswers} className="card space-y-4 p-5">
          <div className="flex items-start gap-2 rounded-md bg-brand-soft p-3 text-xs text-brand">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">A few questions to get this right</p>
              {interpretation && <p className="mt-1 text-brand/80">So far: {interpretation}</p>}
            </div>
          </div>
          {questions.map((q, i) => (
            <Field key={i} label={q}>
              <Textarea
                value={answers[i] ?? ""}
                onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="Your answer (optional but helps)"
              />
            </Field>
          ))}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">Build my plan <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitInitial} className="card space-y-4 p-5">
          <Field label="Your goal">
            <Textarea
              autoFocus
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="e.g. I want to get a 99 ATAR — I'm in Year 11 doing Methods, Chem, English, Economics and Physics."
              className="min-h-[120px]"
              disabled={phase === "working"}
            />
          </Field>

          <Field label="Target date (optional)" hint="If you have a hard deadline, the plan and pace adapt to it.">
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} disabled={phase === "working"} />
          </Field>

          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={preferHeuristic} onChange={(e) => setPreferHeuristic(e.target.checked)} />
            Use the rules-based planner (skip AI)
          </label>

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" loading={phase === "working"} className="w-full">
            {phase === "working" ? (
              <>Building your progression system…</>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Generate plan
              </>
            )}
          </Button>
        </form>
      )}

      {phase === "input" && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5" /> Need inspiration
          </p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((idea) => (
              <button
                key={idea}
                onClick={() => setRawInput(idea)}
                className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition hover:border-brand/40 hover:text-fg"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
