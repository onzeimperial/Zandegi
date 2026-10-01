"use client";
import Link from "next/link";
import React, { useReducer, useState } from "react";
import { Icon } from "@/components/icons";
import { PROOF_LABELS, builderReducer, initialBuilderState, stepXp } from "./builder-state";

export default function BuilderPage() {
  const [state, dispatch] = useReducer(builderReducer, initialBuilderState);
  const [open, setOpen] = useState<number | null>(initialBuilderState.chapters[1]?.id ?? null);
  const stepCount = state.chapters.reduce((total, chapter) => total + chapter.steps.length, 0);

  return (
    <main className="flow-page">
      <p className="sr-only">Local-only mission draft. Nothing you type here is saved or sent anywhere.</p>

      <header className="step-header">
        <div className="side">
          <Link href="/generate" className="step-close" aria-label="Close"><Icon name="close" strokeWidth={2.8} /></Link>
          <span className="d title">Build it yourself</span>
        </div>
        <div className="step-progress"><span className="draft-pill">Draft is local only</span></div>
        <div className="side end">
          {/* Inert until missions persist; the preview note above says so. */}
          <button type="button" className="d save-look save-mission" disabled>Save mission</button>
        </div>
      </header>

      <div className="builder-body">
        <div className="builder">
          <section className="builder-side">
            <div className="builder-field">
              <label htmlFor="mname">Mission name</label>
              <input id="mname" type="text" value={state.missionName} onChange={(event) => dispatch({ type: "set-mission", value: event.target.value })} />
            </div>

            <div className="goal-block">
              <span>How will you know you&#39;ve made it?</span>
              <div className="goal-switch" role="group" aria-label="Goal type">
                <button type="button" aria-pressed={state.goalType === "OUTCOME"} onClick={() => dispatch({ type: "set-goal-type", value: "OUTCOME" })}>A milestone</button>
                <button type="button" aria-pressed={state.goalType === "METRIC"} onClick={() => dispatch({ type: "set-goal-type", value: "METRIC" })}>A number</button>
              </div>
              {state.goalType === "OUTCOME" ? (
                <p className="goal-note">Milestone missions track chapters, evidence and your next step. No percentage bar.</p>
              ) : (
                <div className="metric-fields">
                  <label>Now<input type="text" placeholder="72.5" value={state.metricNow} onChange={(event) => dispatch({ type: "set-metric", field: "metricNow", value: event.target.value })} /></label>
                  <label>Target<input type="text" placeholder="100" value={state.metricTarget} onChange={(event) => dispatch({ type: "set-metric", field: "metricTarget", value: event.target.value })} /></label>
                  <label>Unit<input type="text" placeholder="kg" /></label>
                </div>
              )}
            </div>

            <div className="builder-field">
              <label htmlFor="why">Why this matters to you</label>
              <textarea id="why" rows={2} placeholder="Shown to you on hard days" value={state.why} onChange={(event) => dispatch({ type: "set-why", value: event.target.value })} />
            </div>

            <p className="builder-note">You write the plan. XP comes from fixed rules based on how each step is proven.</p>
          </section>

          <div className="builder-main">
            <div className="head">
              <h2 className="d">Chapters</h2>
              <span>{state.chapters.length} chapters · {stepCount} steps</span>
            </div>

            <ol className="chapter-list">
              {state.chapters.map((chapter, index) => {
                const expanded = open === chapter.id;
                return (
                  <li className={`builder-chapter${expanded ? " open" : ""}`} key={chapter.id}>
                    <div className="row">
                      <span className="grip" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="6" r="1.8" /><circle cx="15" cy="6" r="1.8" />
                          <circle cx="9" cy="12" r="1.8" /><circle cx="15" cy="12" r="1.8" />
                          <circle cx="9" cy="18" r="1.8" /><circle cx="15" cy="18" r="1.8" />
                        </svg>
                      </span>
                      <span className="d number">{index + 1}</span>
                      <input
                        className="title-input"
                        type="text"
                        aria-label={`Chapter ${index + 1} name`}
                        value={chapter.title}
                        placeholder="Chapter name"
                        onChange={(event) => dispatch({ type: "set-chapter", chapterId: chapter.id, field: "title", value: event.target.value })}
                      />
                      <button
                        type="button"
                        className="chapter-toggle"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Collapse" : "Expand"} chapter ${index + 1}`}
                        onClick={() => setOpen(expanded ? null : chapter.id)}
                      >
                        <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={expanded ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                        </svg>
                      </button>
                    </div>

                    <div className="goal-row">
                      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#E0A000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 22V4" /><path d="M4 4h13l-2 4 2 4H4" />
                      </svg>
                      <input
                        type="text"
                        aria-label={`Chapter ${index + 1} mini-goal`}
                        value={chapter.goal}
                        placeholder="Mini-goal: how you'll prove this chapter"
                        onChange={(event) => dispatch({ type: "set-chapter", chapterId: chapter.id, field: "goal", value: event.target.value })}
                      />
                    </div>

                    {expanded && (
                      <div className="builder-steps">
                        {chapter.steps.map((step) => (
                          <div className="builder-step" key={step.id}>
                            <div className="top">
                              <input
                                type="text"
                                aria-label="Step"
                                value={step.title}
                                placeholder="What will you do?"
                                onChange={(event) => dispatch({ type: "set-step", chapterId: chapter.id, stepId: step.id, field: "title", value: event.target.value })}
                              />
                              <button type="button" className="remove-step" aria-label="Remove step" onClick={() => dispatch({ type: "remove-step", chapterId: chapter.id, stepId: step.id })}>
                                <Icon name="close" strokeWidth={2.8} />
                              </button>
                            </div>
                            <div className="meta">
                              <button type="button" className="meta-chip" disabled><Icon name="clock" strokeWidth={2.8} /><span>{step.when}</span></button>
                              <button
                                type="button"
                                className="meta-chip proof"
                                aria-label={`Proof: ${PROOF_LABELS[step.proof]}. Change`}
                                onClick={() => dispatch({ type: "cycle-proof", chapterId: chapter.id, stepId: step.id })}
                              >
                                <Icon name="shield" strokeWidth={2.8} /><span>{PROOF_LABELS[step.proof]}</span>
                              </button>
                              <span className="d xp">+{stepXp(step.proof)} XP</span>
                            </div>
                          </div>
                        ))}

                        <div className="step-actions">
                          <button type="button" className="add-step" onClick={() => dispatch({ type: "add-step", chapterId: chapter.id })}>+ Add step</button>
                          <button type="button" className="suggest" disabled>
                            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                              <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
                            </svg>
                            <span>Suggest</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            <button type="button" className="add-chapter" onClick={() => dispatch({ type: "add-chapter" })}>+ Add chapter</button>
          </div>
        </div>
      </div>
    </main>
  );
}
