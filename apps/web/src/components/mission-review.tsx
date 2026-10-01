"use client";

import Link from "next/link";
import React, { useState } from "react";
import type { PipelineResult, ScoredChapter } from "@zandegi/ai";
import { percentageAllowed } from "@zandegi/core";
import { FlowHeader } from "./flow-header";

function Chapter({ chapter, index, open, onToggle }: { chapter: ScoredChapter; index: number; open: boolean; onToggle: () => void }) {
  const minutes = chapter.steps.reduce((total, step) => total + step.estimatedMinutes, 0);
  return (
    <li className="chapter-card">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        <span className="d chapter-number">{index + 1}</span>
        <span className="chapter-head">
          <span className="name">{chapter.title}</span>
          <span className="goal">Mini-goal: {chapter.exitCondition}</span>
        </span>
        <span className="weeks">{Math.max(1, Math.round(minutes / 60))} h</span>
      </button>
      {open && (
        <div className="chapter-steps">
          {chapter.steps.map((step) => (
            <div className="step" key={step.index}>
              <div>
                <span className="what">{step.title}</span>
                <span className="when">{step.estimatedMinutes} min · {step.verification}</span>
              </div>
              <span className="d xp">+{step.baseXp} XP</span>
            </div>
          ))}
          <p className="advice">{chapter.steps[0]?.guide.approach}</p>
        </div>
      )}
    </li>
  );
}

export function MissionReview({ result }: { result: PipelineResult }) {
  const mission = result.event?.payload.mission;
  const [openChapter, setOpenChapter] = useState(0);
  if (!mission) return null;
  const metric = percentageAllowed(mission.goalType);

  return (
    <main className="flow-page">
      <FlowHeader percent={100} label="3 of 3" />

      <div className="flow-body scroller">
        <div className="review">
          <section className="review-summary">
            <div className="tag-row">
              <span className="goal-tag metric">{mission.goalType} GOAL</span>
              <span className="goal-tag metric">{mission.primaryDomain}</span>
            </div>
            <h1 className="d">Your mission: {mission.title}</h1>
            <span className="shape">{mission.chapters.length} chapters · built from your real ambition</span>
            <p className="sr-only">
              {metric
                ? "Measurable progress uses your real current and target values."
                : "Honest progress tracks chapters, evidence and the next action without a made-up percentage."}
            </p>

            {result.event?.payload.safety.professionalFrameApplied && (
              <div className="preview-note" role="note">
                <b>Professional guidance applies.</b><br />
                Use this mission to prepare for a qualified professional, not as medical, financial, or legal advice.
              </div>
            )}

            <div className="review-actions">
              <p>Planned by Zandegi AI. XP and difficulty come from fixed rules.</p>
              <p className="preview-note">This result is not saved and will not carry over. Tweak and Start open clearly labelled local examples.</p>
              <div className="row">
                <Link href="/builder" className="d button-tweak">Tweak</Link>
                <Link href="/path" className="d button-start">Start chapter 1</Link>
              </div>
            </div>
          </section>

          <section className="review-chapters" aria-label="Mission chapters">
            <ol>
              {mission.chapters.map((chapter, index) => (
                <Chapter
                  key={chapter.index}
                  chapter={chapter}
                  index={index}
                  open={openChapter === index}
                  onToggle={() => setOpenChapter(openChapter === index ? -1 : index)}
                />
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
