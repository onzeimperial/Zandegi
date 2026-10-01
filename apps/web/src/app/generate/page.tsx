"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import type { StageEvent } from "@zandegi/ai";
import { FlowHeader } from "@/components/flow-header";
import { Icon } from "@/components/icons";
import { MissionReview } from "@/components/mission-review";
import { canSubmitGeneration, generatorReducer, initialGeneratorState, visibleStageState } from "./generator-state";
import { runGeneration } from "./generation-flow";

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

/* The authored board sketches five stages; the real pipeline reports eight,
   so the live screen shows what actually ran. */
const stages: ReadonlyArray<{ key: StageEvent["stage"]; title: string }> = [
  { key: "interpret", title: "Reading your ambition" },
  { key: "resolve", title: "Finding your starting point" },
  { key: "plan", title: "Splitting it into chapters" },
  { key: "detail", title: "Writing practical steps" },
  { key: "ground", title: "Checking facts" },
  { key: "score", title: "Scoring with fixed rules" },
  { key: "safety", title: "Running the safety pass" },
  { key: "persist", title: "Finishing your mission" },
];

const suggestions = ["Bench 100 kg", "Get into medicine", "Learn Farsi", "Save a house deposit", "Stop doom-scrolling", "Start a business"] as const;

export default function GeneratePage() {
  const [rawText, setRawText] = useState("");
  const [state, dispatch] = useReducer(generatorReducer, initialGeneratorState);
  const controller = useRef<AbortController | null>(null);
  const reviewRegion = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (state.status === "done") reviewRegion.current?.focus(); }, [state.status]);

  async function startGeneration(ambition: string) {
    if (!canSubmitGeneration(ambition, state.status)) return;
    setRawText(ambition);
    controller.current?.abort();
    controller.current = new AbortController();
    dispatch({ type: "start" });
    try {
      const result = await runGeneration(ambition, controller.current.signal, (progress) => dispatch({ type: "progress", event: progress }));
      dispatch({ type: "result", result });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        dispatch({ type: "error", message: error instanceof Error ? error.message : "Mission generation failed. Try again." });
      }
    }
  }

  function retry() { controller.current?.abort(); dispatch({ type: "reset" }); }

  if (state.status === "done" && state.result) {
    return (
      <div ref={reviewRegion} tabIndex={-1} role="region" aria-label="Your generated mission is ready">
        <p className="sr-only" aria-live="polite">Your generated mission is ready. Review starts here.</p>
        <MissionReview result={state.result} />
      </div>
    );
  }

  if (state.status === "idle") {
    return (
      <main className="flow-page">
        <FlowHeader percent={33} label="1 of 3" />
        <div className="flow-body">
          <form className="ambition-wrap" onSubmit={(event) => { event.preventDefault(); void startGeneration(rawText); }}>
            <div className="guide-line">
              <Image className="mascot" src={mascotSrc} width={180} height={180} alt="Zandegi mascot" priority unoptimized />
              <div className="speech"><div className="d">What do you want to make real?</div></div>
            </div>

            <div className="ambition-field">
              <label className="d" htmlFor="ambition">Your ambition</label>
              <input id="ambition" type="text" value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="e.g. bench 100 kg by March" />
            </div>

            <div className="chip-block">
              <span>Or pick one people are chasing</span>
              <div className="chips">
                {suggestions.map((item) => (
                  <button type="button" className="chip" key={item} aria-pressed={rawText === item} onClick={() => setRawText(item)}>{item}</button>
                ))}
              </div>
            </div>

            <div className="ambition-actions">
              <p>We&#39;ll break it into chapters, steps and time blocks in your week.</p>
              <button className="d flow-primary" type="submit" disabled={!rawText.trim()}>Build my mission</button>
              <Link className="flow-secondary" href="/builder">I&#39;d rather plan it myself</Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const done = stages.filter((stage) => visibleStageState(stage.key, state.activeStage) === "done").length;
  const bubble = state.status === "generating"
    ? (state.detail ?? "Give me a sec. I’m planning your mission.")
    : state.status === "refusal" ? "Let’s find a safer next step." : "The build hit a snag.";

  return (
    <main className="flow-page">
      <FlowHeader percent={66} label="2 of 3" />
      <div className="flow-body centred">
        <div className="build-grid">
          <div className="build-side">
            <Image className="mascot" src={mascotSrc} width={220} height={220} alt="Zandegi mascot thinking" priority unoptimized />
            <div className="build-bubble"><div className="d" aria-live="polite">{bubble}</div></div>
            <div className="ambition-flag">
              <span className="badge"><Icon name="flag" /></span>
              <div>
                <span className="eyebrow">Your ambition</span>
                <span className="goal">{rawText}</span>
              </div>
            </div>
          </div>

          <div className="build-main">
            {state.status === "generating" && (
              <ol className="stage-list" aria-label="Mission build progress">
                {stages.map((stage, index) => {
                  const visual = visibleStageState(stage.key, state.activeStage);
                  return (
                    <li className={visual} key={stage.key}>
                      {visual === "done" && <span className="stage-dot"><Icon name="check" strokeWidth={3.5} /></span>}
                      {visual === "active" && <span className="stage-spinner" />}
                      {visual === "pending" && <span className="stage-dot">{index + 1}</span>}
                      <span className="stage-copy">
                        <b>{stage.title}</b>
                        {visual === "active" && state.detail && <span>{state.detail}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            {state.status === "generating" && (
              <div className="d build-status" aria-live="polite">Building · {done} of {stages.length}</div>
            )}

            {state.chapters.length > 0 && (
              <p className="muted" aria-live="polite">{state.chapters.length} {state.chapters.length === 1 ? "chapter" : "chapters"} ready.</p>
            )}

            {state.status === "error" && (
              <div className="alert" role="alert">
                <h2>We couldn&rsquo;t finish that mission.</h2>
                <p>{state.error}</p>
                <button className="button button-secondary" type="button" onClick={retry}>Try again</button>
              </div>
            )}

            {state.status === "refusal" && state.result?.refusal && (
              <div className="alert" role="alert" aria-live="assertive">
                <h2>{state.result.refusal.route === "support" ? "This needs a person, not a mission." : "Let’s narrow this down."}</h2>
                <p>{state.result.refusal.reason}</p>
                <button className="button button-secondary" type="button" onClick={retry}>Change ambition</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
