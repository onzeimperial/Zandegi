import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/icons";
import { VERIFICATION_LABEL, estimateLabel, loadGuestMissions } from "@/lib/guest-missions";

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

/** A non-negative integer index, or `undefined` for anything else. */
function indexParam(value: string | string[] | undefined): number | undefined {
  const raw = single(value);
  if (raw === undefined || !/^\d{1,3}$/.test(raw)) return undefined;
  return Number(raw);
}

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
  const chapterIndex = indexParam(params.chapter);
  const stepIndex = indexParam(params.step);

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
  const chapter = chapterIndex === undefined ? undefined : mission?.mission.chapters[chapterIndex];
  const step = stepIndex === undefined ? undefined : chapter?.steps[stepIndex];
  if (mission === undefined || chapter === undefined || step === undefined) {
    return (
      <StepUnavailable
        heading="This step isn't available"
        body="It may belong to a mission you no longer have, or the link may be incomplete."
      />
    );
  }

  const backHref = `/path?mission=${encodeURIComponent(mission.missionId)}`;
  const { guide } = step;

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
            Step {stepIndex! + 1} of {chapter.steps.length}
          </b>
        </div>
        <div className="side end" />
      </header>

      <div className="step-body">
        <div className="step-grid">
          <div className="step-main">
            <div className="step-heading">
              <span className="eyebrow">
                Chapter {chapterIndex! + 1} · {chapter.title}
              </span>
              <h1>{step.title}</h1>
            </div>

            <div className="media-row">
              <span className="media-icon">
                <Icon name="clock" />
              </span>
              <span className="media-text">
                <b>{estimateLabel(step.estimatedMinutes)}</b>
                <span className="sub">A planning estimate, not a target</span>
              </span>
            </div>

            <section className="guide-section">
              <h2 className="d">How to do it</h2>
              <p>{guide.approach}</p>
            </section>

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

            <div className="advice">
              <div className="advice-head">
                <span className="advice-tag">GOAL</span>
                <b>What good looks like</b>
              </div>
              <p>{guide.whatGoodLooksLike}</p>
            </div>

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

            <Link href={backHref} className="d cta">
              <Icon name="back" />
              <span>Back to your path</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
