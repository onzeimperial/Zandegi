"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";
import {
  GENERATE_MISSION_LIMITS,
  GENERATION_STAGES,
  type GenerationStage,
} from "@zandegi/api/client";
import { FlowHeader } from "@/components/flow-header";
import { Icon } from "@/components/icons";
import { MissionReview } from "@/components/mission-review";
import {
  canSubmitGeneration,
  generatorReducer,
  initialGeneratorState,
  visibleStageState,
} from "./generator-state";
import {
  FIELD_ORDER,
  MAX_HOURS_PER_WEEK,
  browserTimezone,
  browserToday,
  emptyDetailsForm,
  toGenerationRequest,
  validateDetailsForm,
  type DetailsFormErrors,
  type DetailsFormField,
  type DetailsFormValues,
} from "./details-form";
import { runGeneration } from "./generation-flow";
import { GenerationStreamError } from "./sse";

const mascotSrc =
  "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

/* The authored board sketches five stages. The real pipeline reports seven,
   and `hydrate` is shown inside the resolve row, so six rows are drawn. The
   list is derived from the contract rather than retyped, so the screen cannot
   promise a stage the server does not run — and the exhaustive record below
   fails typecheck the day a stage is added. */
const STAGE_TITLES: Record<GenerationStage, string> = {
  interpret: "Reading your ambition",
  resolve: "Finding your starting point",
  hydrate: "Finding your starting point",
  plan: "Splitting it into chapters",
  detail: "Writing practical steps",
  ground: "Checking facts",
  safety: "Running the safety pass",
};

const stages: ReadonlyArray<{ key: GenerationStage; title: string }> = GENERATION_STAGES.filter(
  (stage) => stage !== "hydrate",
).map((key) => ({ key, title: STAGE_TITLES[key] }));

const suggestions = [
  "Bench 100 kg",
  "Get into medicine",
  "Learn Farsi",
  "Save a house deposit",
  "Stop doom-scrolling",
  "Start a business",
] as const;

/* Each question asks what a person can bring, never what they lack. */
const TEXT_FIELDS: ReadonlyArray<{
  field: "startingPoint" | "why" | "resources" | "planAround";
  label: string;
  placeholder: string;
}> = [
  {
    field: "startingPoint",
    label: "Where are you starting from?",
    placeholder: "e.g. I bench 60 kg for five reps",
  },
  {
    field: "why",
    label: "Why does this matter to you?",
    placeholder: "e.g. I want to feel strong again",
  },
  {
    field: "resources",
    label: "What can you put toward it?",
    placeholder: "e.g. a gym membership and a friend who lifts",
  },
  {
    field: "planAround",
    label: "What should the plan work around?",
    placeholder: "e.g. night shifts and school pick-ups",
  },
];

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  return message === undefined ? null : (
    <p className="field-error" id={id}>
      {message}
    </p>
  );
}

export default function GeneratePage() {
  const [rawText, setRawText] = useState("");
  const [details, setDetails] = useState<DetailsFormValues>(emptyDetailsForm);
  const [errors, setErrors] = useState<DetailsFormErrors>({});
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [state, dispatch] = useReducer(generatorReducer, initialGeneratorState);
  const controller = useRef<AbortController | null>(null);
  const reviewRegion = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (state.status === "done") reviewRegion.current?.focus();
  }, [state.status]);

  function setDetail(field: DetailsFormField, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function startGeneration(ambition: string) {
    if (!canSubmitGeneration(ambition, state.status)) return;
    const found = validateDetailsForm(details, browserToday());
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((field) => found[field] !== undefined);
    if (firstInvalid !== undefined) {
      // The section may be collapsed, and a closed field cannot take focus.
      setDetailsOpen(true);
      requestAnimationFrame(() => document.getElementById(`detail-${firstInvalid}`)?.focus());
      return;
    }
    setRawText(ambition);
    controller.current?.abort();
    controller.current = new AbortController();
    dispatch({ type: "start" });
    try {
      const result = await runGeneration(
        toGenerationRequest(ambition, details, browserTimezone()),
        controller.current.signal,
        (progress) => dispatch({ type: "progress", event: progress }),
      );
      dispatch({ type: "result", result });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        if (
          error instanceof GenerationStreamError &&
          (error.code === "SIGN_IN_REQUIRED" || error.code === "ACCOUNT_NOT_ALLOWED")
        ) {
          // The session lapsed or was never allowed. The home page says which.
          window.location.assign("/");
          return;
        }
        dispatch({
          type: "error",
          message: !navigator.onLine
            ? "You look offline. Check your connection and try again."
            : error instanceof Error
              ? error.message
              : "Mission generation failed. Try again.",
          ...(error instanceof GenerationStreamError
            ? {
                code: error.code,
                ...(error.requestId === undefined ? {} : { reference: error.requestId }),
              }
            : {}),
        });
      }
    }
  }

  function retry() {
    controller.current?.abort();
    dispatch({ type: "reset" });
  }

  if (state.status === "done" && state.result) {
    return (
      <div
        ref={reviewRegion}
        tabIndex={-1}
        role="region"
        aria-label="Your generated mission is ready"
      >
        <p className="sr-only" aria-live="polite">
          Your generated mission is ready. Review starts here.
        </p>
        <MissionReview result={state.result} />
      </div>
    );
  }

  if (state.status === "idle") {
    return (
      <main className="flow-page">
        <FlowHeader percent={33} label="1 of 3" />
        <div className="flow-body">
          <form
            className="ambition-wrap"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void startGeneration(rawText);
            }}
          >
            <div className="guide-line">
              <Image
                className="mascot"
                src={mascotSrc}
                width={180}
                height={180}
                alt="Zandegi mascot"
                priority
                unoptimized
              />
              <div className="speech">
                <div className="d">What do you want to make real?</div>
              </div>
            </div>

            <div className="ambition-field">
              <label className="d" htmlFor="ambition">
                Your ambition
              </label>
              <input
                id="ambition"
                type="text"
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="e.g. bench 100 kg by March"
              />
            </div>

            <div className="chip-block">
              <span>Or pick one people are chasing</span>
              <div className="chips">
                {suggestions.map((item) => (
                  <button
                    type="button"
                    className="chip"
                    key={item}
                    aria-pressed={rawText === item}
                    onClick={() => setRawText(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <details
              className="detail-block"
              open={detailsOpen}
              onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            >
              <summary className="d">Tell us more, if you like</summary>
              <p className="detail-note">
                All optional. The more we know, the more this plan fits your life.
              </p>
              <div className="detail-fields">
                {TEXT_FIELDS.map(({ field, label, placeholder }) => (
                  <div className="ambition-field" key={field}>
                    <label htmlFor={`detail-${field}`}>{label}</label>
                    <textarea
                      id={`detail-${field}`}
                      rows={2}
                      maxLength={GENERATE_MISSION_LIMITS.maxDetailLength}
                      value={details[field]}
                      onChange={(event) => setDetail(field, event.target.value)}
                      placeholder={placeholder}
                      aria-invalid={errors[field] !== undefined}
                      aria-describedby={errors[field] ? `detail-${field}-error` : undefined}
                    />
                    <FieldError id={`detail-${field}-error`} message={errors[field]} />
                  </div>
                ))}
                <div className="detail-row">
                  <div className="ambition-field">
                    <label htmlFor="detail-hoursPerWeek">Hours a week you can give this</label>
                    <input
                      id="detail-hoursPerWeek"
                      type="number"
                      inputMode="decimal"
                      min={0.5}
                      max={MAX_HOURS_PER_WEEK}
                      step={0.5}
                      value={details.hoursPerWeek}
                      onChange={(event) => setDetail("hoursPerWeek", event.target.value)}
                      placeholder="e.g. 3"
                      aria-invalid={errors.hoursPerWeek !== undefined}
                      aria-describedby={errors.hoursPerWeek ? "detail-hours-error" : undefined}
                    />
                    <FieldError id="detail-hours-error" message={errors.hoursPerWeek} />
                  </div>
                  <div className="ambition-field">
                    <label htmlFor="detail-targetDate">A date you&#39;re aiming for</label>
                    <input
                      id="detail-targetDate"
                      type="date"
                      value={details.targetDate}
                      onChange={(event) => setDetail("targetDate", event.target.value)}
                      aria-invalid={errors.targetDate !== undefined}
                      aria-describedby={errors.targetDate ? "detail-date-error" : undefined}
                    />
                    <FieldError id="detail-date-error" message={errors.targetDate} />
                  </div>
                </div>
                <div className="ambition-field">
                  <label htmlFor="detail-location">Where you&#39;re based</label>
                  <input
                    id="detail-location"
                    type="text"
                    autoComplete="address-level2"
                    maxLength={GENERATE_MISSION_LIMITS.maxLocationLength}
                    value={details.location}
                    onChange={(event) => setDetail("location", event.target.value)}
                    placeholder="e.g. Melbourne"
                    aria-invalid={errors.location !== undefined}
                    aria-describedby={errors.location ? "detail-location-error" : undefined}
                  />
                  <FieldError id="detail-location-error" message={errors.location} />
                </div>
              </div>
            </details>

            <div className="ambition-actions">
              <p>We&#39;ll break it into chapters and steps you can start today.</p>
              <button className="d flow-primary" type="submit" disabled={!rawText.trim()}>
                Build my mission
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  const done = stages.filter(
    (stage) => visibleStageState(stage.key, state.activeStage) === "done",
  ).length;
  const bubble =
    state.status === "generating"
      ? (state.detail ?? "Give me a sec. I’m planning your mission.")
      : state.status === "refusal"
        ? "Let’s find a safer next step."
        : state.errorCode === "DAILY_LIMIT_REACHED"
          ? "Good work today."
          : "The build hit a snag.";

  return (
    <main className="flow-page">
      <FlowHeader percent={66} label="2 of 3" />
      <div className="flow-body centred">
        <div className="build-grid">
          <div className="build-side">
            <Image
              className="mascot"
              src={mascotSrc}
              width={220}
              height={220}
              alt="Zandegi mascot thinking"
              priority
              unoptimized
            />
            <div className="build-bubble">
              <div className="d" aria-live="polite">
                {bubble}
              </div>
            </div>
            <div className="ambition-flag">
              <span className="badge">
                <Icon name="flag" />
              </span>
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
                      {visual === "done" && (
                        <span className="stage-dot">
                          <Icon name="check" strokeWidth={3.5} />
                        </span>
                      )}
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
              <div className="d build-status" aria-live="polite">
                Building · {done} of {stages.length}
              </div>
            )}

            {state.chapters.length > 0 && (
              <p className="muted" aria-live="polite">
                {state.chapters.length} {state.chapters.length === 1 ? "chapter" : "chapters"}{" "}
                ready.
              </p>
            )}

            {state.status === "error" && (
              <div className="alert" role="alert">
                {state.errorCode === "DAILY_LIMIT_REACHED" ? (
                  <>
                    <h2>That&rsquo;s today&rsquo;s missions built.</h2>
                    <p>{state.error}</p>
                    <Link className="button button-secondary" href="/path">
                      Go to your path
                    </Link>
                  </>
                ) : (
                  <>
                    <h2>We couldn&rsquo;t finish that mission.</h2>
                    <p>{state.error}</p>
                    {state.errorReference !== null && <p>Reference: {state.errorReference}</p>}
                    <button className="button button-secondary" type="button" onClick={retry}>
                      Try again
                    </button>
                  </>
                )}
              </div>
            )}

            {state.status === "refusal" && state.result?.outcome === "refusal" && (
              <div className="alert" role="alert" aria-live="assertive">
                <h2>
                  {state.result.refusal.route === "support"
                    ? "This needs a person, not a mission."
                    : "Let’s narrow this down."}
                </h2>
                <p>{state.result.refusal.reason}</p>
                <button className="button button-secondary" type="button" onClick={retry}>
                  Change ambition
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
