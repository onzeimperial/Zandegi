"use client";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import type { StageEvent } from "@zandegi/ai";
import { Brand, Mascot } from "@/components/brand";
import { MissionReview } from "@/components/mission-review";
import { canSubmitGeneration, generatorReducer, initialGeneratorState, visibleStageState } from "./generator-state";
import { runGeneration } from "./generation-flow";

const suggestions = ["Bench 100 kg","Get into medicine","Learn Farsi","Save a house deposit","Stop doom-scrolling","Start a business"];
const stages: ReadonlyArray<{ key: StageEvent["stage"]; title:string }> = [
  {key:"interpret",title:"Reading your ambition"},{key:"resolve",title:"Finding your starting point"},{key:"plan",title:"Splitting it into chapters"},{key:"detail",title:"Writing practical steps"},{key:"ground",title:"Checking facts"},{key:"score",title:"Scoring with fixed rules"},{key:"safety",title:"Running the safety pass"},{key:"persist",title:"Finishing your mission"},
];

export default function GeneratePage() {
  const [rawText,setRawText] = useState("");
  const [state,dispatch] = useReducer(generatorReducer,initialGeneratorState);
  const controller = useRef<AbortController | null>(null);
  const reviewRegion = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if(state.status==="done") reviewRegion.current?.focus(); }, [state.status]);
  async function generate(event: React.FormEvent) {
    event.preventDefault(); if (!canSubmitGeneration(rawText,state.status)) return;
    controller.current?.abort(); controller.current = new AbortController(); dispatch({type:"start"});
    try {
      const result = await runGeneration(rawText,controller.current.signal,(progress) => dispatch({type:"progress",event:progress}));
      dispatch({type:"result",result});
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) dispatch({type:"error",message:error instanceof Error ? error.message : "Mission generation failed. Try again."}); }
  }
  function retry() { controller.current?.abort(); dispatch({type:"reset"}); }
  if (state.status === "done" && state.result) return <div ref={reviewRegion} tabIndex={-1} role="region" aria-label="Your generated mission is ready"><p className="sr-only" aria-live="polite">Your generated mission is ready. Review starts here.</p><MissionReview result={state.result}/></div>;
  return <main className="onboarding">
    <header className="onboarding-header"><Brand/><div className="progress-head"><div className="progress-track"><i style={{width:state.status === "idle" ? "33%" : "66%"}}/></div><b>{state.status === "idle" ? "1" : "2"} of 3</b></div><span/></header>
    {state.status === "idle" ? <form className="ambition-wrap stack" onSubmit={generate}>
      <div className="guide-line"><Mascot/><div className="speech display">What do you want to make real?</div></div>
      <div className="field"><label htmlFor="ambition">Your ambition</label><input className="ambition-input" id="ambition" value={rawText} onChange={(e) => setRawText(e.target.value)} placeholder="e.g. bench 100 kg by March" autoFocus/></div>
      <div className="stack"><span className="field-label muted">Or pick one people are chasing</span><div className="chips">{suggestions.map((item) => <button className={`chip ${rawText === item ? "active" : ""}`} aria-pressed={rawText === item} type="button" key={item} onClick={() => setRawText(item)}>{item}</button>)}</div></div>
      <p className="muted" style={{textAlign:"center"}}>We’ll break it into chapters, steps and time blocks in your week.</p>
      <button className="button button-primary" type="submit" disabled={!rawText.trim()}>Build my mission</button><Link className="button button-ghost" href="/builder">I’d rather plan it myself</Link>
    </form> : <div className="generator-layout">
      <section className="generator-side"><Mascot mood="thinking"/><div className="speech display" aria-live="polite">{state.status === "generating" ? (state.detail ?? "Give me a sec. I’m planning your mission.") : state.status === "refusal" ? "Let’s find a safer next step." : "The build hit a snag."}</div><div className="ambition-flag"><span className="eyebrow" style={{color:"#e2d8ff"}}>Your ambition</span><br/><strong>{rawText}</strong></div></section>
      <section className="stack">
        {state.status === "generating" && <ol className="stage-list" aria-label="Mission build progress">{stages.map((stage,index) => { const visualState=visibleStageState(stage.key,state.activeStage); const active=visualState==="active"; return <li className={visualState==="pending"?"":visualState} key={stage.key}><span className="stage-dot">{visualState==="done"?"✓":index+1}</span><span className="stage-copy"><b>{stage.title}</b>{active&&state.detail&&<span>{state.detail}</span>}</span></li>; })}</ol>}
        {state.chapters.length > 0 && <p className="muted" aria-live="polite">{state.chapters.length} {state.chapters.length === 1 ? "chapter" : "chapters"} ready.</p>}
        {state.status === "error" && <div className="alert" role="alert"><h2>We couldn’t finish that mission.</h2><p>{state.error}</p><button className="button button-secondary" type="button" onClick={retry}>Try again</button></div>}
        {state.status === "refusal" && state.result?.refusal && <div className="alert" role="alert" aria-live="assertive"><h2>{state.result.refusal.route === "support" ? "This needs a person, not a mission." : "Let’s narrow this down."}</h2><p>{state.result.refusal.reason}</p><button className="button button-secondary" type="button" onClick={retry}>Change ambition</button></div>}
      </section>
    </div>}
  </main>;
}
