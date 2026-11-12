import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Icon } from "@/components/icons";
import { QuickLog } from "@/components/quick-log";
import { ReminderToggle } from "@/components/reminder-toggle";
import { GuestStatusRail } from "@/components/status-rail";
import { TimezoneSync } from "@/components/timezone-sync";
import { estimateLabel, loadGuestMissions, stepHref, stepStates } from "@/lib/guest-missions";
import { dayLabel, placed, stepsById, totalMinutes, upcomingWithSteps } from "@/lib/today-view";

export const metadata: Metadata = { title: "Today" };
// Every render depends on the person's own session, so nothing here is cacheable.
export const dynamic = "force-dynamic";

const SUBTITLE = "What fits in today on each mission, and what comes after.";

/**
 * Where a signed-in person lands: the steps that fit in today on each mission,
 * the next few days, and a quick log. The day comes from the mission's own zone.
 * Counts and next actions only -- no percentage, no streak, no "missed" or
 * "overdue", no countdown and no promised XP (laws 2, 3 and 8).
 */
export default async function TodayPage() {
  const loaded = await loadGuestMissions({ withLogs: true, withToday: true });

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
        <TimezoneSync />
        <section className="card path-empty">
          <h1 className="d">Nothing on today yet</h1>
          <p>Tell Zandegi what you want to achieve, and your first steps show up here.</p>
          <Link href="/generate" className="d button-start">
            Start a mission
          </Link>
        </section>
      </AppShell>
    );
  }

  const reminder = loaded.reminder;
  return (
    <AppShell current="Today" aside={rail}>
      <TimezoneSync />
      <header className="today-head">
        <h1 className="hero-title">Today</h1>
        <p className="today-sub">{SUBTITLE}</p>
      </header>

      <ul className="today-list">
        {loaded.missions.map((mission) => {
          const plan = loaded.plans[mission.missionId];
          const states = stepStates(mission, loaded.progress);
          const lookup = stepsById(mission);
          const pathHref = `/path?mission=${encodeURIComponent(mission.missionId)}`;
          const todaySteps = plan === undefined ? [] : placed(plan.todayStepIds, lookup);
          const doneToday = new Set(plan?.doneTodayStepIds ?? []);
          const todayEstimate = estimateLabel(totalMinutes(todaySteps));
          const upcoming = plan === undefined ? [] : upcomingWithSteps(plan);
          const titleId = `today-${mission.missionId}`;
          return (
            <li key={mission.missionId} className="card today-card">
              <div className="eyebrow">
                <Link href={pathHref}>{mission.mission.title}</Link>
              </div>

              {plan?.returningAfterGap === true && (
                <p className="today-welcome">
                  Welcome back. Your steps are right where you left them.
                </p>
              )}

              {states.finished || plan === undefined ? (
                <div className="today-step">
                  <h2 className="d">{states.finished ? "Mission complete" : "Your next step"}</h2>
                  <p className="today-meta">
                    {states.finished
                      ? `All ${mission.mission.chapters.length} chapters done. That was real work.`
                      : "Open your path to see what comes next."}
                  </p>
                  <Link href={pathHref} className="d button-tweak today-action">
                    See your path
                  </Link>
                </div>
              ) : (
                <section className="today-day" aria-labelledby={titleId}>
                  <div className="today-day-head">
                    <h2 id={titleId} className="d">
                      {plan.doneForToday ? "Done for today" : "Today"}
                    </h2>
                    <p className="today-meta">
                      {todaySteps.length} {todaySteps.length === 1 ? "step" : "steps"}
                      {todayEstimate === null ? "" : ` · ${todayEstimate.toLowerCase()}`}
                    </p>
                  </div>
                  {plan.doneForToday && (
                    <p className="today-meta">
                      That&#39;s today&#39;s plan finished. Tomorrow&#39;s steps are below.
                    </p>
                  )}
                  <ol className="today-steps">
                    {todaySteps.map(({ step, chapter, chapterNumber }) => {
                      const done = doneToday.has(step.id);
                      const current = states.current?.step.id === step.id;
                      const estimate = estimateLabel(step.estimatedMinutes);
                      const rowClass = [
                        "today-step-row",
                        done ? "is-done" : "",
                        current ? "is-current" : "",
                      ]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <li key={step.id} className={rowClass}>
                          <span className="today-step-mark" aria-hidden="true">
                            {done ? <Icon name="check" /> : null}
                          </span>
                          <div className="today-step-body">
                            <p className="today-meta">
                              Chapter {chapterNumber} · {chapter.title}
                            </p>
                            <h3 className="d">{step.title}</h3>
                            <p className="today-meta">
                              {done ? "Done today" : (estimate ?? "Your own step")}
                            </p>
                            {current && (
                              <Link
                                href={stepHref(mission.missionId, step.id)}
                                className="d button-start today-action"
                              >
                                <Icon name="bolt" /> Start step
                              </Link>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {!states.finished && plan !== undefined && upcoming.length > 0 && (
                <section
                  className="today-next"
                  aria-label={`Coming up on ${mission.mission.title}`}
                >
                  <h3 className="today-next-title">Coming up</h3>
                  <ul className="today-next-list">
                    {upcoming.map((day) => (
                      <li key={day.date}>
                        <span className="today-next-day">{dayLabel(day.date, plan.today)}</span>
                        <span className="today-next-steps">
                          {placed(day.stepIds, lookup)
                            .map((entry) => entry.step.title)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {plan.laterStepCount > 0 && (
                    <p className="today-meta">
                      Then {plan.laterStepCount} more {plan.laterStepCount === 1 ? "step" : "steps"}{" "}
                      on your path.
                    </p>
                  )}
                </section>
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

      {reminder !== null && (reminder.available || reminder.enabled) && (
        <ReminderToggle initial={reminder} />
      )}
    </AppShell>
  );
}
