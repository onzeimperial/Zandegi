import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { ProgressView, StoredMissionView } from "@zandegi/api/client";
import { AppShell } from "@/components/app-shell";
import { GuestStatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";
import { estimateLabel, loadGuestMissions, selectMission, stepStates } from "@/lib/guest-missions";

export const metadata: Metadata = { title: "Mission path" };
// Every render depends on the guest's own cookie, so nothing here is cacheable.
export const dynamic = "force-dynamic";

const mascotSrc =
  "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

/* The fixture hand-placed each node. A generated mission has any number of
   steps, so the trail is a deterministic zigzag instead: the same mission
   always draws the same path, with no randomness to make it jump on reload. */
const TRAIL_OFFSETS = [0, -60, -100, -60, 0, 60, 100, 60] as const;
const offsetAt = (position: number) => TRAIL_OFFSETS[position % TRAIL_OFFSETS.length]!;

function stepHref(missionId: string, chapterIndex: number, stepIndex: number): string {
  const params = new URLSearchParams({
    mission: missionId,
    chapter: String(chapterIndex),
    step: String(stepIndex),
  });
  return `/step?${params.toString()}`;
}

export default async function PathPage({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = typeof params.mission === "string" ? params.mission : undefined;
  const loaded = await loadGuestMissions();

  if (loaded.status === "unavailable") {
    return (
      <AppShell current="Path">
        <section className="card path-empty" role="alert">
          <h1 className="d">Your missions can&#39;t be loaded right now</h1>
          <p>Nothing has been lost. Try again in a moment.</p>
          <Link href="/path" className="d button-start">
            Try again
          </Link>
        </section>
      </AppShell>
    );
  }

  const rail = <GuestStatusRail progress={loaded.progress} />;
  const selected = selectMission(loaded.missions, requested);
  if (selected === undefined) {
    return (
      <AppShell current="Path" aside={rail}>
        <section className="card path-empty">
          <h1 className="d">No mission yet</h1>
          <p>Tell Zandegi what you want to achieve and it builds the path to get there.</p>
          <Link href="/generate" className="d button-start">
            Generate your first mission
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell current="Path" aside={rail}>
      <MissionPath missions={loaded.missions} selected={selected} progress={loaded.progress} />
    </AppShell>
  );
}

function MissionSwitcher({
  missions,
  selected,
}: {
  missions: readonly StoredMissionView[];
  selected: StoredMissionView;
}) {
  const label = (
    <>
      <Icon name="flag" />
      <span className="pursuit-name">{selected.mission.title}</span>
    </>
  );

  // With a single mission there is nothing to switch to, so it is a label, not
  // a control that does nothing when pressed.
  if (missions.length < 2) {
    return <div className="pursuit-switch is-static">{label}</div>;
  }

  return (
    <details className="pursuit-menu">
      <summary
        className="pursuit-switch"
        aria-label={`Switch mission, current: ${selected.mission.title}`}
      >
        {label}
        <Icon name="chevron" strokeWidth={3} />
      </summary>
      <ul className="card pursuit-menu-list">
        {missions.map((entry) => (
          <li key={entry.missionId}>
            <Link
              href={`/path?mission=${encodeURIComponent(entry.missionId)}`}
              aria-current={entry.missionId === selected.missionId ? "page" : undefined}
            >
              {entry.mission.title}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/generate" className="pursuit-menu-new">
            <Icon name="plus" /> New mission
          </Link>
        </li>
      </ul>
    </details>
  );
}

function MissionPath({
  missions,
  selected,
  progress,
}: {
  missions: readonly StoredMissionView[];
  selected: StoredMissionView;
  progress: ProgressView;
}) {
  const { chapters } = selected.mission;
  const states = stepStates(selected, progress);

  // The chapter holding the current step is the one the hero describes; once
  // everything is done there is no current step, so it describes completion.
  const currentChapterIndex = chapters.findIndex((chapter, chapterIndex) =>
    chapter.steps.some((_step, stepIndex) => states.state(chapterIndex, stepIndex) === "current"),
  );
  const heroChapter = currentChapterIndex >= 0 ? chapters[currentChapterIndex] : undefined;
  const doneCount = progress.completions.filter(
    (completion) => completion.missionId === selected.missionId,
  ).length;
  let position = 0;

  return (
    <>
      <MissionSwitcher missions={missions} selected={selected} />

      <section className="hero-card">
        <div className="hero-head">
          <div>
            <div className="eyebrow">Mission · {selected.mission.title}</div>
            <h1 className="hero-title">
              {states.finished || heroChapter === undefined
                ? "Mission complete"
                : `Chapter ${currentChapterIndex + 1} · ${heroChapter.title}`}
            </h1>
          </div>
        </div>
        {/* Counts, not a percentage bar. Law 2: there is no measured quantity
            behind a generated mission, so a bar would be an invented
            denominator. Steps done is a real count. */}
        <p className="hero-progress">
          {states.finished
            ? `All ${chapters.length} chapters done`
            : `Chapter ${currentChapterIndex + 1} of ${chapters.length} · ${doneCount} ${
                doneCount === 1 ? "step" : "steps"
              } done`}
          {heroChapter !== undefined && !states.finished && (
            <> · Mini-goal: {heroChapter.exitCondition}</>
          )}
        </p>
      </section>

      <div className="path-map">
        {chapters.map((chapter, chapterIndex) => (
          <Fragment key={`${selected.missionId}-${chapterIndex}`}>
            {chapterIndex > 0 && (
              <div className="chapter-rule">
                <i />
                <span>
                  Chapter {chapterIndex + 1} · {chapter.title}
                </span>
                <i />
              </div>
            )}

            {chapter.steps.map((step, stepIndex) => {
              const offset = offsetAt(position++);
              const href = stepHref(selected.missionId, chapterIndex, stepIndex);
              const state = states.state(chapterIndex, stepIndex);
              const key = `${chapterIndex}-${stepIndex}`;

              if (state === "current") {
                return (
                  <div
                    key={key}
                    className="path-current"
                    style={{ transform: `translateX(${offset}px)` }}
                  >
                    <div className="next-label">
                      <span className="when">NEXT · {estimateLabel(step.estimatedMinutes)}</span>
                      <span className="what">{step.title}</span>
                    </div>
                    <div className="halo">
                      <Link href={href} className="path-node" aria-label={`Start ${step.title}`}>
                        <Icon name="bolt" />
                      </Link>
                    </div>
                  </div>
                );
              }

              if (state === "done") {
                return (
                  <Link
                    key={key}
                    href={href}
                    className="path-node done"
                    style={{ transform: `translateX(${offset}px)` }}
                    aria-label={`${step.title}, completed`}
                  >
                    <Icon name="check" strokeWidth={3.5} />
                  </Link>
                );
              }

              return (
                <Link
                  key={key}
                  href={href}
                  className="path-node locked"
                  style={{ transform: `translateX(${offset}px)` }}
                  aria-label={`${step.title}. Upcoming, opens a preview of the guide.`}
                >
                  <Icon name="lock" strokeWidth={2.5} />
                </Link>
              );
            })}
          </Fragment>
        ))}

        <div className="path-guide">
          <p className="bubble">
            {states.finished
              ? "Mission complete. That was real work."
              : doneCount === 0
                ? "Your first step is ready."
                : "Nice. Your next step is ready."}
          </p>
          <Image
            className="mascot"
            src={mascotSrc}
            width={160}
            height={160}
            alt="Zandegi mascot"
            priority
            unoptimized
          />
        </div>
      </div>
    </>
  );
}
