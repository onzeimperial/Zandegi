import Image from "next/image";
import Link from "next/link";
import { demoLeague } from "@/lib/demo-data";
import type { ProgressView } from "@zandegi/api/client";
import { Icon } from "./icons";

const mascotSrc =
  "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";
const avatarTone = ["", "avatar-2", "avatar-3"];

export type RailCard = "crew" | "league" | "drop";

/* Each board shows a different subset of the rail, so the caller names them. */
export function StatusRail({
  cards = ["crew", "league", "drop"],
}: {
  cards?: readonly RailCard[];
}) {
  return (
    <div className="status-rail">
      <div className="stat-strip">
        <b className="d stat-flame">
          <Icon name="flame" tone="flame" />
          <span>13</span>
        </b>
        <b className="d stat-shard">
          <Icon name="shard" tone="shard" />
          <span>340</span>
        </b>
        <b className="d stat-level">
          <Icon name="bolt" tone="bolt" />
          <span>Lv 14</span>
        </b>
      </div>

      {cards.includes("crew") && (
        <section className="card compact-card">
          <div className="row-between">
            <h2 className="d">Dawn Lifters</h2>
            <Link href="/crew">View crew</Link>
          </div>
          <div className="quest-row">
            <span>Everyone trains 3×</span>
            <span className="violet">4 of 5 done</span>
          </div>
          <div className="segments" aria-label="Four of five crew members complete">
            <i />
            <i />
            <i />
            <i />
            <i className="empty" />
          </div>
          <p className="crew-streak">Crew streak 21 days</p>
        </section>
      )}

      {cards.includes("league") && (
        <section className="card compact-card">
          <div className="row-between">
            <h2 className="d">Amethyst League</h2>
            <span className="card-note">ends in 2d 14h</span>
          </div>
          <ol className="league-list">
            {demoLeague.map((person, index) => (
              <li key={person.rank} className={person.name === "You" ? "you" : undefined}>
                <span className="d league-rank">{person.rank}</span>
                <span
                  className={`avatar ${person.name === "You" ? "avatar-you" : (avatarTone[index] ?? "")}`}
                >
                  {person.initials}
                </span>
                <strong>{person.name}</strong>
                <span className="d league-xp">{person.xp} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cards.includes("drop") && (
        <section className="card compact-card">
          <div className="row-between">
            <h2 className="d">Daily drop</h2>
            <span className="card-note">New in 09:12:44</span>
          </div>
          <div className="drop">
            <div className="drop-art">
              <Image
                src={mascotSrc}
                width={56}
                height={56}
                alt="Aurora frame preview"
                unoptimized
              />
            </div>
            <div className="drop-text">
              <b>Aurora frame</b>
              <p className="d">120 Shards</p>
            </div>
            <Link href="/shop">Shop</Link>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The rail for a page showing the guest's own data.
 *
 * `StatusRail` above is a design fixture: a 13-day streak, 340 Shards, level 14,
 * a crew and a league. Beside a fixture board that reads as illustration;
 * beside the person's real mission it reads as a claim about them, and every
 * number in it would be one they never earned (CLAUDE.md laws 1 and 3).
 *
 * So this shows only what is true: the level, rank and XP folded from the
 * guest's own ledger. The level bar is honest where a mission percentage would
 * not be, because XP is a measured quantity the person actually earned.
 * Streaks, Shards, crews and leagues appear once they exist, not before; there
 * is deliberately no streak counter at zero, since law 8 rules out
 * loss-framing a streak and there is no streak yet to frame.
 */
export function GuestStatusRail({ progress }: { progress: ProgressView }) {
  const percent =
    progress.xpForThisLevel > 0
      ? Math.min(100, Math.round((progress.xpIntoLevel / progress.xpForThisLevel) * 100))
      : 0;

  return (
    <div className="status-rail">
      <div className="stat-strip">
        <b className="d stat-level">
          <Icon name="bolt" tone="bolt" />
          <span>Lv {progress.level}</span>
        </b>
      </div>

      <section className="card compact-card">
        <div className="row-between">
          <h2 className="d">Your character</h2>
          <span className="card-note">{progress.rank}</span>
        </div>
        <p className="rail-xp">
          <b>{progress.totalXp} XP</b>
        </p>
        <div
          className="level-bar"
          role="progressbar"
          aria-label={`Progress to level ${progress.level + 1}`}
          aria-valuemin={0}
          aria-valuemax={progress.xpForThisLevel}
          aria-valuenow={progress.xpIntoLevel}
        >
          <i style={{ width: `${percent}%` }} />
        </div>
        <p className="rail-note">
          {progress.totalXp === 0
            ? "XP arrives when you complete a step, never for generating a plan."
            : `${progress.xpForThisLevel - progress.xpIntoLevel} XP to level ${progress.level + 1}.`}
        </p>
      </section>
    </div>
  );
}
