import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { StoredMissionView } from "@zandegi/api/client";
import { AppShell } from "@/components/app-shell";
import { GuestStatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";
import { estimateLabel, loadGuestMissions, selectMission } from "@/lib/guest-missions";

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
      <AppShell current="Path" aside={<GuestStatusRail />}>
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

  const selected = selectMission(loaded.missions, requested);
  if (selected === undefined) {
    return (
      <AppShell current="Path" aside={<GuestStatusRail />}>
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
    <AppShell current="Path" aside={<GuestStatusRail />}>
      <MissionPath missions={loaded.missions} selected={selected} />
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
}: {
  missions: readonly StoredMissionView[];
  selected: StoredMissionView;
}) {
  const { chapters } = selected.mission;
  const firstChapter = chapters[0];
  const nextStep = firstChapter?.steps[0];
  // Nothing is completed yet -- completion arrives with the XP loop -- so the
  // honest position is the start. Every later step is upcoming.
  let position = 0;

  return (
    <>
      <MissionSwitcher missions={missions} selected={selected} />

      <section className="hero-card">
        <div className="hero-head">
          <div>
            <div className="eyebrow">Mission · {selected.mission.title}</div>
            <h1 className="hero-title">Chapter 1 · {firstChapter?.title}</h1>
          </div>
          {nextStep !== undefined && (
            <Link
              href={stepHref(selected.missionId, 0, 0)}
              className="hero-guide"
              aria-label="Open the guide for your next step"
            >
              <Icon name="book" />
            </Link>
          )}
        </div>
        {/* No percentage bar. Law 2: there is no measured quantity behind this
            mission yet, so a bar would be an invented denominator. */}
        <p className="hero-progress">
          Chapter 1 of {chapters.length}
          {firstChapter !== undefined && <> · Mini-goal: {firstChapter.exitCondition}</>}
        </p>
      </section>

      <div className="path-map">
        {chapters.map((chapter, chapterIndex) => (
          <Fragment key={chapter.index}>
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

              if (chapterIndex === 0 && stepIndex === 0) {
                return (
                  <div
                    key={step.index}
                    className="path-current"
                    style={{ transform: `translateX(${offset}px)` }}
                  >
                    <div className="next-label">
                      <span className="when">START · {estimateLabel(step.estimatedMinutes)}</span>
                      <span className="what">{step.title}</span>
                    </div>
                    <div className="halo">
                      <Link
                        href={href}
                        className="path-node"
                        aria-label={`Start step 1, ${step.title}`}
                      >
                        <Icon name="bolt" />
                      </Link>
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={step.index}
                  href={href}
                  className="path-node locked"
                  style={{ transform: `translateX(${offset}px)` }}
                  aria-label={`Chapter ${chapterIndex + 1}, step ${stepIndex + 1}, ${step.title}. Upcoming, opens a preview of the guide.`}
                >
                  <Icon name="lock" strokeWidth={2.5} />
                </Link>
              );
            })}
          </Fragment>
        ))}

        <div className="path-guide">
          <p className="bubble">Your first step is ready.</p>
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
