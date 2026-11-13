import Link from "next/link";
import type { MissionChapter } from "@zandegi/api/client";
import { Icon } from "@/components/icons";
import { bossHref, type BossState } from "@/lib/guest-missions";

/**
 * A chapter's test, as the path and Today show it. The text is the chapter's
 * exit condition, unchanged, and labelled as the person's own test. No XP and
 * no percentage are shown before an attempt (law 3), and "not yet" is framed
 * as a test still open, never as a loss (law 8).
 */
export function BossCard({
  missionId,
  chapter,
  chapterNumber,
  state,
  headingLevel = 2,
}: {
  missionId: string;
  chapter: Pick<MissionChapter, "id" | "title" | "exitCondition">;
  chapterNumber: number;
  state: BossState;
  headingLevel?: 2 | 3;
}) {
  // A chapter finished before tests existed has none to show.
  if (state === "legacy") return null;

  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = bossHref(missionId, chapter.id);
  const copy: Record<Exclude<BossState, "legacy">, { title: string; sub: string }> = {
    upcoming: { title: "Your test", sub: "Opens once you reach this chapter." },
    early: {
      title: "Your test",
      sub: "Steps are left in this chapter. Finish them first, or skip them and take the test now.",
    },
    ready: { title: "Your test is ready", sub: "Do it for real, then say how it went." },
    "not-yet": {
      title: "Your test · not yet",
      sub: "The chapter has moved on. Try again whenever you're ready.",
    },
    done: { title: "Test passed", sub: "You did the real thing." },
  };
  const { title, sub } = copy[state];

  return (
    <section
      className={`boss-card is-${state}`}
      aria-label={`Chapter ${chapterNumber} test: ${chapter.title}`}
    >
      <div className="boss-card-head">
        <span className="boss-card-icon" aria-hidden="true">
          <Icon name={state === "done" ? "check" : state === "upcoming" ? "lock" : "flag"} />
        </span>
        <div>
          <span className="eyebrow">Chapter {chapterNumber} test</span>
          <Heading className="d boss-card-title">{title}</Heading>
        </div>
      </div>
      <p className="boss-card-condition">{chapter.exitCondition}</p>
      <p className="boss-card-sub">{sub}</p>
      {state === "ready" && (
        <Link href={href} className="d button-start boss-card-action">
          Take the test
        </Link>
      )}
      {state === "early" && (
        <Link href={href} className="d button-tweak boss-card-action">
          Take the test now
        </Link>
      )}
      {state === "not-yet" && (
        <Link href={href} className="d button-tweak boss-card-action">
          Try again
        </Link>
      )}
    </section>
  );
}
