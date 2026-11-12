"use client";

import Link from "next/link";
import React, { useState } from "react";
import type { GenerationResult, MissionChapter } from "@zandegi/api/client";
import { percentageAllowed } from "@zandegi/core/contracts";
import { FlowHeader } from "./flow-header";

function Chapter({
  chapter,
  index,
  open,
  onToggle,
}: {
  chapter: MissionChapter;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const minutes = chapter.steps.reduce((total, step) => total + step.estimatedMinutes, 0);
  return (
    <li className="chapter-card">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        <span className="d chapter-number">{index + 1}</span>
        <span className="chapter-head">
          <span className="name">{chapter.title}</span>
          <span className="goal">Mini-goal: {chapter.exitCondition}</span>
        </span>
        <span className="weeks">~{Math.max(1, Math.round(minutes / 60))} h</span>
      </button>
      {open && (
        <div className="chapter-steps">
          {chapter.steps.map((step) => (
            <div className="step" key={step.id}>
              <div>
                <span className="what">{step.title}</span>
                {/* A planning estimate, never a promise and never an XP figure:
                    XP exists only once verified work is completed. */}
                <span className="when">
                  Est. {step.estimatedMinutes} min · {step.verification}
                </span>
              </div>
            </div>
          ))}
          <p className="advice">{chapter.steps[0]?.guide.approach}</p>
        </div>
      )}
    </li>
  );
}

export function MissionReview({ result }: { result: GenerationResult }) {
  const [openChapter, setOpenChapter] = useState(0);
  if (result.outcome !== "mission") return null;
  const mission = result.mission;
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
            <span className="shape">
              {mission.chapters.length} chapters · built from your real ambition
            </span>
            <p className="sr-only">
              {metric
                ? "Measurable progress uses your real current and target values."
                : "Honest progress tracks chapters, evidence and the next action without a made-up percentage."}
            </p>

            {result.safety.professionalFrameApplied && (
              <div className="preview-note" role="note">
                <b>Professional guidance applies.</b>
                <br />
                Use this mission to prepare for a qualified professional, not as medical, financial,
                or legal advice.
              </div>
            )}

            <div className="review-actions">
              <p>
                Planned by Zandegi AI. Times are planning estimates, not targets. You earn XP by
                completing verified work, never by generating a plan.
              </p>
              <p className="preview-note">Saved to your path.</p>
              <div className="row">
                <Link
                  href={`/path?mission=${encodeURIComponent(result.missionId)}`}
                  className="d button-start"
                >
                  Start chapter 1
                </Link>
              </div>
            </div>
          </section>

          <section className="review-chapters" aria-label="Mission chapters">
            <ol>
              {mission.chapters.map((chapter, index) => (
                <Chapter
                  key={chapter.id}
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
