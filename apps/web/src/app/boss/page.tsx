import Link from "next/link";
import type { Metadata } from "next";
import { BossAttemptPanel } from "@/components/boss-attempt-panel";
import { Icon } from "@/components/icons";
import { loadGuestMissions, stepStates } from "@/lib/guest-missions";

export const metadata: Metadata = { title: "Chapter test" };
// Every render depends on the person's own session, so nothing here is cacheable.
export const dynamic = "force-dynamic";

type BossParams = { mission?: string | string[]; chapter?: string | string[] };

const single = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

function BossMessage({
  heading,
  body,
  href,
  alert = false,
}: {
  heading: string;
  body: string;
  href: string;
  alert?: boolean;
}) {
  return (
    <main className="step-page">
      <section className="card path-empty step-missing" role={alert ? "alert" : undefined}>
        <h1 className="d">{heading}</h1>
        <p>{body}</p>
        <Link href={href} className="d button-start">
          Back to your path
        </Link>
      </section>
    </main>
  );
}

/**
 * A chapter's test: its exit condition, shown unchanged as the person's own
 * test, and the attempt and debrief form. No model is called, and no XP or
 * percentage is shown before the attempt.
 */
export default async function BossPage({ searchParams }: { searchParams: Promise<BossParams> }) {
  const params = await searchParams;
  const missionId = single(params.mission);
  const chapterId = single(params.chapter);

  const loaded = await loadGuestMissions();
  if (loaded.status === "unavailable") {
    return (
      <BossMessage
        heading="This test can't be loaded right now"
        body="Nothing has been lost. Try again in a moment."
        href="/path"
        alert
      />
    );
  }

  // A missing, malformed or somebody else's mission all land here alike.
  const mission = loaded.missions.find((entry) => entry.missionId === missionId);
  const chapters = mission?.mission.chapters ?? [];
  const chapterIndex = chapters.findIndex((entry) => entry.id === chapterId);
  const chapter = chapters[chapterIndex];
  if (mission === undefined || chapter === undefined) {
    return (
      <BossMessage
        heading="This test isn't available"
        body="The link may be incomplete, or the mission may not be yours."
        href="/path"
        alert
      />
    );
  }

  const pathHref = `/path?mission=${encodeURIComponent(mission.missionId)}`;
  const states = stepStates(mission, loaded.progress);
  const state = states.bossState(chapter.id);

  if (state === "upcoming") {
    return (
      <BossMessage
        heading="This test isn't open yet"
        body="It opens once you reach this chapter on your path."
        href={pathHref}
      />
    );
  }
  if (state === "legacy") {
    return (
      <BossMessage
        heading="This chapter is already complete"
        body="It was finished before chapter tests existed, so there is nothing to do here."
        href={pathHref}
      />
    );
  }

  const undoneSteps = chapter.steps.filter((step) => states.state(step.id) !== "done").length;

  return (
    <main className="step-page">
      <header className="step-header">
        <div className="side">
          <Link href={pathHref} className="step-close" aria-label="Back to your path">
            <Icon name="close" strokeWidth={2.8} />
          </Link>
        </div>
        <div className="step-progress">
          <b>Chapter {chapterIndex + 1} test</b>
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
              <h1>Your test</h1>
            </div>
            <p className="boss-condition">{chapter.exitCondition}</p>
            <p className="own-step-note">
              <Icon name="flag" /> This is your test. Do it for real, then say how it went: Zandegi
              takes your word for it.
            </p>
            {state === "not-yet" && (
              <p className="confirm-sub">
                You&#39;ve tried this before. The chapter has moved on, and you can try again
                whenever you&#39;re ready.
              </p>
            )}
          </div>

          <div className="step-aside">
            {state === "done" ? (
              <section className="confirm-panel is-done" aria-label="Test status">
                <p className="confirm-title">Test passed</p>
                <p className="confirm-sub">You did the real thing. This chapter is complete.</p>
                <Link href={pathHref} className="d button-start">
                  Back to your path
                </Link>
              </section>
            ) : (
              <BossAttemptPanel
                missionId={mission.missionId}
                chapterId={chapter.id}
                undoneSteps={state === "early" ? undoneSteps : 0}
                retry={state === "not-yet"}
                hasNextChapter={chapterIndex + 1 < chapters.length}
                pathHref={pathHref}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
