import Link from "next/link";
import React from "react";
import { percentageAllowed } from "@zandegi/core";
import type { PipelineResult } from "@zandegi/ai";

export function MissionReview({ result }: { result: PipelineResult }) {
  const mission = result.event?.payload.mission;
  if (!mission) return null;
  const metric = percentageAllowed(mission.goalType);
  return <main className="review">
    <section className="review-summary">
      <div className="stack"><div><span className="pill">{mission.goalType} goal</span> <span className="pill">{mission.primaryDomain}</span></div>
      <h1>Your mission: {mission.title}</h1>
      <p className="muted">{mission.chapters.length} chapters · built from your real ambition</p>
      {metric ? <div className="card compact-card"><b>Measurable progress</b><p className="muted small">Your real current and target values will drive this after setup.</p></div> : <div className="card compact-card"><b>Honest progress</b><p className="muted small">Track chapters, evidence and the next action — never a made-up percentage.</p></div>}
      {result.event?.payload.safety.professionalFrameApplied && <div className="preview-note" role="note"><b>Professional guidance applies.</b><br/>Use this mission to prepare for a qualified professional, not as medical, financial, or legal advice.</div>}
      <p className="muted small">Planned by Zandegi AI. XP and difficulty come from fixed rules.</p>
      <p className="preview-note">This generated result is not saved. The example Path screen uses separate demo data, so this mission will not carry over.</p>
      <div className="row-between"><Link href="/builder" className="button button-secondary">Open local example editor</Link><Link href="/path" className="button button-primary">View example path</Link></div></div>
    </section>
    <section className="review-chapters" aria-label="Mission chapters">
      {mission.chapters.map((chapter, index) => <details className="card" key={chapter.index} open={index === 0}><summary><span className="chapter-number">{index + 1}</span><span><b>{chapter.title}</b><br/><span className="muted small">Mini-goal: {chapter.exitCondition}</span></span></summary><ul>{chapter.steps.map((step) => <li key={step.index}><div className="row-between"><b>{step.title}</b><span className="pill">+{step.baseXp} XP</span></div><span className="muted small">{step.estimatedMinutes} min · {step.verification}</span><p className="small">{step.guide.approach}</p></li>)}</ul></details>)}
    </section>
  </main>;
}
