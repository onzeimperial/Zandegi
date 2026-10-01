import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";
import { DOMAIN_ICONS, DOMAIN_ORDER } from "@/lib/domain-art";

export const metadata: Metadata = { title: "Profile" };

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";
const domainLevels: Record<string, number> = { Mind: 6, Edge: 7, Coin: 4, Body: 8, Grit: 5, Craft: 5, Bond: 3, World: 1 };

export default function ProfilePage() {
  return (
    <AppShell current="Me" aside={<StatusRail cards={["crew", "league"]} />}>
      <p className="sr-only">Fixture-backed profile preview. Nothing here is saved and no account is connected.</p>

      <section className="profile-head">
        <div className="avatar-ring"><Image src={mascotSrc} width={120} height={120} alt="Your avatar" priority unoptimized /></div>
        <div className="profile-id">
          <h1 className="d">Kai</h1>
          <span className="rank">Level 14 · Iron Initiate</span>
          <span className="crew">Crew: Dawn Lifters</span>
        </div>
        <Link href="/customise" className="icon-button" aria-label="Edit look"><Icon name="pencil" /></Link>
      </section>

      <div className="tile-grid">
        <div className="tile"><b className="streak">14</b><span>Day streak</span></div>
        <div className="tile"><b className="total">8,460</b><span>Total XP</span></div>
        <div className="tile"><b className="league">Amethyst</b><span>League</span></div>
      </div>

      <section className="panel">
        <h2 className="d">Life domains</h2>
        <div className="domain-grid">
          {DOMAIN_ORDER.map((domain) => (
            <div className="domain" key={domain}>
              <span className="orb"><Icon name={DOMAIN_ICONS[domain]} /></span>
              <span className="name">{domain}</span>
              <span className="level">Lv {domainLevels[domain]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2 className="d">Active missions</h2>

        <Link href="/path" className="mission-card">
          <div className="head"><span className="title">Bench 100 kg</span><span className="goal-tag metric">METRIC</span></div>
          <div className="bar"><i style={{ width: "72.5%" }} /></div>
          <span className="sub">72.5 of 100 kg · Chapter 2 of 5</span>
        </Link>

        <Link href="/path" className="mission-card">
          <div className="head"><span className="title">Learn Farsi</span><span className="goal-tag outcome">OUTCOME</span></div>
          <div className="chapters">{[0, 1, 2, 3, 4, 5].map((chapter) => <i key={chapter} className={chapter === 0 ? "done" : undefined} />)}</div>
          <span className="sub">1 of 6 chapters · 3 pieces of evidence · Next: 20-min tutor trial</span>
        </Link>
      </section>
    </AppShell>
  );
}
