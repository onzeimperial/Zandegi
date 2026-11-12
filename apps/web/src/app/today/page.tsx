import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { QuickLog } from "@/components/quick-log";
import { GuestStatusRail } from "@/components/status-rail";
import { estimateLabel, loadGuestMissions, stepHref, stepStates } from "@/lib/guest-missions";

export const metadata: Metadata = { title: "Today" };
// Every render depends on the person's own session, so nothing here is cacheable.
export const dynamic = "force-dynamic";

/**
 * Where a signed-in person lands: each mission's current step, with a way to
 * start it and a quick log. Counts and next actions only -- no percentage, no
 * streak, no promised XP (laws 2 and 3).
 */
export default async function TodayPage() {
  const loaded = await loadGuestMissions({ withLogs: true });

  if (loaded.status === "unavailable") {
    return (
      <AppShell current="Today">
        <section className="card path-empty" role="alert">
          <h1 className="d">Today can&#39;t be loaded right now</h1>
          <p>Nothing has been lost. Try again in a moment.</p>
          <Link href="/today" className="d button-start">
            Try again
          </Link>
        </section>
      </AppShell>
    );
  }

  const rail = <GuestStatusRail progress={loaded.progress} />;
  if (loaded.missions.length === 0) {
    return (
      <AppShell current="Today" aside={rail}>
        <section className="card path-empty">
          <h1 className="d">Nothing on today yet</h1>
          <p>Tell Zandegi what you want to achieve, and your first step shows up here.</p>
          <Link href="/generate" className="d button-start">
            Start a mission
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell current="Today" aside={rail}>
      <header className="today-head">
        <h1 className="hero-title">Today</h1>
        <p className="today-sub">Your next step on every mission.</p>
      </header>

      <ul className="today-list">
        {loaded.missions.map((mission) => {
          const states = stepStates(mission, loaded.progress);
          const current = states.current;
          const estimate = current === null ? null : estimateLabel(current.step.estimatedMinutes);
          const pathHref = `/path?mission=${encodeURIComponent(mission.missionId)}`;
          return (
            <li key={mission.missionId} className="card today-card">
              <div className="eyebrow">
                <Link href={pathHref}>{mission.mission.title}</Link>
              </div>

              {current === null ? (
                <div className="today-step">
                  <h2 className="d">Mission complete</h2>
                  <p className="today-meta">
                    All {mission.mission.chapters.length} chapters done. That was real work.
                  </p>
                  <Link href={pathHref} className="d button-tweak today-action">
                    See your path
                  </Link>
                </div>
              ) : (
                <div className="today-step">
                  <p className="today-meta">
                    Chapter {current.chapterNumber} · {current.chapter.title}
                  </p>
                  <h2 className="d">{current.step.title}</h2>
                  <p className="today-meta">
                    {states.doneOnPath} {states.doneOnPath === 1 ? "step" : "steps"} done
                    {estimate === null ? "" : ` · ${estimate}`}
                  </p>
                  <Link
                    href={stepHref(mission.missionId, current.step.id)}
                    className="d button-start today-action"
                  >
                    <Icon name="bolt" /> Start step
                  </Link>
                </div>
              )}

              <QuickLog
                missionId={mission.missionId}
                missionTitle={mission.mission.title}
                chapters={mission.mission.chapters.map((chapter) => ({
                  id: chapter.id,
                  title: chapter.title,
                }))}
                initialLogs={loaded.logs[mission.missionId] ?? []}
              />
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
