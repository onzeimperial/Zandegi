import Image from "next/image";
import Link from "next/link";
import { demoLeague } from "@/lib/demo-data";
import { Icon } from "./icons";

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";
const avatarTone = ["", "avatar-2", "avatar-3"];

export type RailCard = "crew" | "league" | "drop";

/* Each board shows a different subset of the rail, so the caller names them. */
export function StatusRail({ cards = ["crew", "league", "drop"] }: { cards?: readonly RailCard[] }) {
  return (
    <div className="status-rail">
      <div className="stat-strip">
        <b className="d stat-flame"><Icon name="flame" tone="flame" /><span>13</span></b>
        <b className="d stat-shard"><Icon name="shard" tone="shard" /><span>340</span></b>
        <b className="d stat-level"><Icon name="bolt" tone="bolt" /><span>Lv 14</span></b>
      </div>

      {cards.includes("crew") && (
        <section className="card compact-card">
          <div className="row-between"><h2 className="d">Dawn Lifters</h2><Link href="/crew">View crew</Link></div>
          <div className="quest-row"><span>Everyone trains 3×</span><span className="violet">4 of 5 done</span></div>
          <div className="segments" aria-label="Four of five crew members complete"><i /><i /><i /><i /><i className="empty" /></div>
          <p className="crew-streak">Crew streak 21 days</p>
        </section>
      )}

      {cards.includes("league") && (
        <section className="card compact-card">
          <div className="row-between"><h2 className="d">Amethyst League</h2><span className="card-note">ends in 2d 14h</span></div>
          <ol className="league-list">
            {demoLeague.map((person, index) => (
              <li key={person.rank} className={person.name === "You" ? "you" : undefined}>
                <span className="d league-rank">{person.rank}</span>
                <span className={`avatar ${person.name === "You" ? "avatar-you" : avatarTone[index] ?? ""}`}>{person.initials}</span>
                <strong>{person.name}</strong>
                <span className="d league-xp">{person.xp} XP</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {cards.includes("drop") && (
        <section className="card compact-card">
          <div className="row-between"><h2 className="d">Daily drop</h2><span className="card-note">New in 09:12:44</span></div>
          <div className="drop">
            <div className="drop-art"><Image src={mascotSrc} width={56} height={56} alt="Aurora frame preview" unoptimized /></div>
            <div className="drop-text"><b>Aurora frame</b><p className="d">120 Shards</p></div>
            <Link href="/shop">Shop</Link>
          </div>
        </section>
      )}
    </div>
  );
}
