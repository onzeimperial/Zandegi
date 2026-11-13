import Link from "next/link";
import type { Metadata } from "next";
import { isGeneratedStepId } from "@zandegi/api";
import { Icon } from "@/components/icons";
import { CompleteStepPanel } from "@/components/complete-step-panel";
import {
  VERIFICATION_LABEL,
  bossHref,
  estimateLabel,
  loadGuestMissions,
  stepHref,
  stepIdParam,
  stepStates,
} from "@/lib/guest-missions";

export const metadata: Metadata = { title: "Step" };
// Every render depends on the guest's own cookie, so nothing here is cacheable.
export const dynamic = "force-dynamic";

type StepParams = {
  mission?: string | string[];
  chapter?: string | string[];
  step?: string | string[];
};

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

function StepUnavailable({ heading, body }: { heading: string; body: string }) {
  return (
    <main className="step-page">
      <section className="card path-empty step-missing" role="alert">
        <h1 className="d">{heading}</h1>
        <p>{body}</p>
        <Link href="/path" className="d button-start">
          Back to your path
        </Link>
      </section>
    </main>
  );
}

export default async function StepPage({ searchParams }: { searchParams: Promise<StepParams> }) {
  const params = await searchParams;
  const missionId = single(params.mission);
  const stepId = stepIdParam(params);

  const loaded = await loadGuestMissions();
  if (loaded.status === "unavailable") {
    return (
      <StepUnavailable
        heading="This step can't be loaded right now"
        body="Nothing has been lost. Try again in a moment."
      />
    );
  }

  // A missing, malformed, or somebody else's mission all land here alike, so
  // the page reveals nothing about which ids exist.
  const mission = loaded.missions.find((entry) => entry.missionId === missionId);
  const chapters = mission?.mission.chapters ?? [];
  const chapterIndex = chapters.findIndex((entry) =>
    entry.steps.some((candidate) => candidate.id === stepId),
  );
  const chapter = chapters[chapterIndex];
  const stepIndex = chapter?.steps.findIndex((entry) => entry.id === stepId) ?? -1;
  const step = chapter?.steps[stepIndex];
  if (mission === undefined || chapter === undefined || step === undefined) {
    return (
      <StepUnavailable
        heading="This step isn't available"
        body="It may have been removed from the plan, or the link may be incomplete."
      />
    );
  }

  const backHref = `/path?mission=${encodeURIComponent(mission.missionId)}`;
  const { guide } = step;
  const estimate = estimateLabel(step.estimatedMinutes);
  const states = stepStates(mission, loaded.progress);
  const state = states.state(step.id);
  const completion = loaded.progress.completions.find(
    (entry) => entry.missionId === mission.missionId && entry.stepId === step.id,
  );

  // What opens once this step is confirmed: the next step in its chapter, or,
  // for the chapter's last step, the chapter's test. A chapter that has
  // already closed leads on to the next chapter instead.
  const sameChapterNext = chapter.steps[stepIndex + 1];
  const bossState = states.bossState(chapter.id);
  const chapterOpen = bossState === "early" || bossState === "ready";
  const nextChapterStep = chapters[chapterIndex + 1]?.steps[0];
  const next =
    sameChapterNext !== undefined
      ? { href: stepHref(mission.missionId, sameChapterNext.id), label: "Next step" }
      : chapterOpen
        ? { href: bossHref(mission.missionId, chapter.id), label: "Take the test" }
        : nextChapterStep !== undefined
          ? { href: stepHref(mission.missionId, nextChapterStep.id), label: "Next step" }
          : null;

  return (
    <main className="step-page">
      <header className="step-header">
        <div className="side">
          <Link href={backHref} className="step-close" aria-label="Back to your path">
            <Icon name="close" strokeWidth={2.8} />
          </Link>
        </div>
        <div className="step-progress">
          {/* Position, not progress: nothing is completed yet, so there is no
              filled bar implying otherwise. */}
          <b>
            Step {stepIndex + 1} of {chapter.steps.length}
          </b>
        </div>
        <div className="side end" />
      </header>

      <div className="step-body">
        <div className="step-grid">
          <div className="step-main">
            <div className="step-heading">
              <span className="eyebrow">
                Chapter {chapterIndex + 1} · {chapter.title}
              </span>
              <h1>{step.title}</h1>
            </div>

            {estimate !== null && (
              <div className="media-row">
                <span className="media-icon">
                  <Icon name="clock" />
                </span>
                <span className="media-text">
                  <b>{estimate}</b>
                  <span className="sub">A planning estimate, not a target</span>
                </span>
              </div>
            )}

            {step.writtenBy === "person" && (
              <p className="own-step-note">
                <Icon name="pencil" /> Your own words. Zandegi hasn&#39;t checked this step.
              </p>
            )}

            {guide.approach.length > 0 && (
              <section className="guide-section">
                <h2 className="d">How to do it</h2>
                <p className="guide-approach">{guide.approach}</p>
              </section>
            )}

            {guide.materials.length > 0 && (
              <section className="guide-section">
                <h2 className="d">What you&#39;ll need</h2>
                <ul>
                  {guide.materials.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}

            {guide.commonMistakes.length > 0 && (
              <section className="guide-section">
                <h2 className="d">Common mistakes</h2>
                <ul>
                  {guide.commonMistakes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="step-aside">
            <div className="media-row plain">
              <span className="media-icon tinted">
                <Icon name="shield" />
              </span>
              <span className="media-text">
                <span className="lead">How it&#39;s verified</span>
                <span className="sub">{VERIFICATION_LABEL[step.verification]}</span>
              </span>
              {/* No XP pill: XP is earned on a verified completion, never
                  promised beside a step that has not been done (FR34). */}
            </div>

            {guide.whatGoodLooksLike.length > 0 && (
              <div className="advice">
                <div className="advice-head">
                  <span className="advice-tag">GOAL</span>
                  <b>What good looks like</b>
                </div>
                <p>{guide.whatGoodLooksLike}</p>
              </div>
            )}

            {step.sources.length > 0 && (
              <section className="guide-section guide-sources">
                <h2 className="d">Sources</h2>
                <ul>
                  {step.sources.map((source) => (
                    <li key={`${source.title}-${source.date}`}>
                      {source.url !== undefined ? (
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.title}
                        </a>
                      ) : (
                        source.title
                      )}{" "}
                      <span className="source-date">· {source.date}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <CompleteStepPanel
              missionId={mission.missionId}
              stepId={step.id}
              paysXp={isGeneratedStepId(step.id)}
              state={state}
              completedWith={
                completion === undefined
                  ? undefined
                  : { evidence: completion.evidence, xp: completion.xp }
              }
              nextHref={next?.href ?? null}
              nextLabel={next?.label}
              pathHref={backHref}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
