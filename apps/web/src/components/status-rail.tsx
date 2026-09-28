import Link from "next/link";
import { demoLeague } from "@/lib/demo-data";

export function StatusRail() {
  return (
    <div className="status-rail">
      <div className="stat-strip" aria-label="Your status"><b>🔥 13</b><b>◆ 340</b><b>ϟ Lv 14</b></div>
      <section className="card compact-card">
        <div className="row-between"><h2>Dawn Lifters</h2><Link href="/crew">View crew</Link></div>
        <div className="row-between small"><b>Everyone trains 3×</b><b className="violet">4 of 5 done</b></div>
        <div className="segments" aria-label="Four of five crew members complete"><i/><i/><i/><i/><i/></div>
        <p className="muted small">Crew streak 21 days</p>
      </section>
      <section className="card compact-card">
        <div className="row-between"><h2>Amethyst League</h2><span className="muted small">ends in 2d 14h</span></div>
        <ol className="league-list">
          {demoLeague.map((person) => <li key={person.rank} className={person.name === "You" ? "you" : ""}><b>{person.rank}</b><span className="avatar">{person.initials}</span><strong>{person.name}</strong><span>{person.xp} XP</span></li>)}
        </ol>
      </section>
      <section className="card compact-card">
        <div className="row-between"><h2>Daily drop</h2><span className="muted small">Preview</span></div>
        <div className="drop"><span className="item-orb aurora">Z</span><div><b>Aurora frame</b><p>120 Shards</p></div><Link href="/shop">Shop</Link></div>
      </section>
    </div>
  );
}
