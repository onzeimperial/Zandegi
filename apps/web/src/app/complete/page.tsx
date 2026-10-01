import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Step verified" };

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

export default function CompletePage() {
  return (
    <main className="completion-page">
      <p className="sr-only">Fixture-backed celebration preview. No XP, Shards or streak is awarded and nothing is saved.</p>

      <div className="completion-card">
        <div className="celebrate-ring">
          <Image src={mascotSrc} width={220} height={220} alt="Zandegi mascot celebrating" priority unoptimized />
        </div>

        <div className="completion-title">
          <h1 className="d">Step verified!</h1>
          <p>Push day A logged with sets and a photo.</p>
        </div>

        <div className="reward-grid">
          <div className="reward"><Icon name="bolt" tone="bolt" /><b className="d">+40</b><span>Body XP</span></div>
          <div className="reward"><Icon name="flame" tone="flame" /><b className="d">14</b><span>Day streak</span></div>
          <div className="reward"><Icon name="shard" tone="shard" /><b className="d">+10</b><span>Shards</span></div>
        </div>

        <div className="level-bar">
          <div className="head"><span className="level-domain">Body · Level 8</span><span className="level-progress">320 / 500 XP</span></div>
          <div className="track"><i style={{ width: "64%" }} /></div>
        </div>

        <div className="completion-actions">
          <Link href="/path" className="d button-celebrate">Continue</Link>
          <Link href="/crew" className="d button-share">Share with Dawn Lifters</Link>
        </div>
      </div>
    </main>
  );
}
