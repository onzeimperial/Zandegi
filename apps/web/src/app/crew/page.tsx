import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Crew" };

const tints: readonly string[] = ["#6f42e8", "#8a66f2", "#a585f7", "#5227c9", "#7b55ee", "#9474f4", "#6a43e2"];
const promoted = [
  { rank: 1, name: "Maya R.", xp: "1,940" },
  { rank: 2, name: "Tom K.", xp: "1,715" },
  { rank: 3, name: "Priya S.", xp: "1,602" },
  { rank: 4, name: "You", xp: "1,480" },
  { rank: 5, name: "Leo M.", xp: "1,366" },
];
const below = [
  { rank: 6, name: "Sana A.", xp: "1,210" },
  { rank: 7, name: "Jordan P.", xp: "1,054" },
];

function Row({ rank, name, xp, tint, below: isBelow }: { rank: number; name: string; xp: string; tint: string; below?: boolean }) {
  const you = name === "You";
  return (
    <li className={[you ? "you" : "", isBelow ? "below" : ""].filter(Boolean).join(" ") || undefined}>
      <span className="rank">{rank}</span>
      <span className="face" style={{ background: tint }}>{name.slice(0, 1)}</span>
      <span className="who">{name}</span>
      <span className="xp">{xp} XP</span>
    </li>
  );
}

export default function CrewPage() {
  return (
    <AppShell current="Crew" aside={<StatusRail cards={["drop"]} />}>
      <p className="sr-only">Fixture-backed crew preview. Membership, quests and standings are not connected.</p>

      <section className="crew-card">
        <div className="crew-head">
          <span className="crew-badge"><Icon name="crew" /></span>
          <div className="crew-title">
            <h1 className="d">Dawn Lifters</h1>
            <span className="sub">5 members · crew streak 21 days</span>
          </div>
        </div>
        <div className="quest">
          <div className="quest-row"><span>This week: everyone trains 3×</span><span className="violet">4 of 5 done</span></div>
          <div className="segments" aria-label="Four of five crew members complete"><i /><i /><i /><i /><i className="empty" /></div>
        </div>
      </section>

      <section className="panel">
        <div className="league-head">
          <span className="league-badge"><Icon name="gemFacet" tone="shardSoft" /></span>
          <div className="crew-title">
            <h2 className="d">Amethyst League</h2>
            <span className="sub">Top 5 move up · ends in 2d 14h</span>
          </div>
        </div>

        <ol className="ladder">
          {promoted.map((person, index) => <Row key={person.rank} {...person} tint={tints[index] ?? "#6f42e8"} />)}
        </ol>

        <div className="promotion"><i /><span>Promotion zone</span><i /></div>

        <ol className="ladder">
          {below.map((person, index) => <Row key={person.rank} {...person} tint={tints[index + 5] ?? "#6f42e8"} below />)}
        </ol>
      </section>
    </AppShell>
  );
}
