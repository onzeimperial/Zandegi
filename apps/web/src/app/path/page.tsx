import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StatusRail } from "@/components/status-rail";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Mission path" };

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

/* The export hand-places each node along a meandering trail. The offsets are
   authored values, carried here as data so the trail stays reproducible. */
const trailBefore = [{ offset: -40, label: "Step 6, locked" }, { offset: 40, label: "Chapter chest, locked", chest: true }] as const;
const trailAfter = [{ offset: 30, label: "Chapter 3, step 1, locked" }, { offset: -50, label: "Chapter 3, step 2, locked" }] as const;

export default function PathPage() {
  return (
    <AppShell current="Path" aside={<StatusRail />}>
      <p className="sr-only">Fixture-backed mission path preview. Switching pursuits and step progress are not saved.</p>

      <button type="button" className="pursuit-switch" aria-label="Switch pursuit" disabled>
        <Icon name="barbell" />
        <span className="pursuit-name">Bench 100 kg</span>
        <Icon name="chevron" strokeWidth={3} />
      </button>

      <section className="hero-card">
        <div className="hero-head">
          <div>
            <div className="eyebrow">Mission · Bench 100 kg</div>
            <h1 className="hero-title">Chapter 2 · Build the base</h1>
          </div>
          <Link href="/step" className="hero-guide" aria-label="Chapter guide"><Icon name="book" /></Link>
        </div>
        <div className="metric">
          <div className="metric-head"><span>Best lift 72.5 kg</span><span>Goal 100 kg</span></div>
          <div className="metric-bar"><i style={{ width: "72.5%" }} /></div>
        </div>
      </section>

      <div className="path-map">
        <Link href="/step" className="path-node done" style={{ transform: "translateX(-30px)" }} aria-label="Step 4, Deload week, complete">
          <Icon name="check" strokeWidth={3.5} />
        </Link>

        <div className="path-current" style={{ transform: "translateX(-100px)" }}>
          <div className="next-label">
            <span className="when">START · TODAY 6:30 PM</span>
            <span className="what">Push day A · 5×5 at 75 kg</span>
          </div>
          <div className="halo">
            <Link href="/step" className="path-node" aria-label="Start step 5, Push day A"><Icon name="barbell" /></Link>
          </div>
        </div>

        {trailBefore.map((node) => (
          <div key={node.label} className={`path-node locked${"chest" in node && node.chest ? " chest" : ""}`} style={{ transform: `translateX(${node.offset}px)` }} aria-label={node.label}>
            <Icon name={"chest" in node && node.chest ? "gift" : "lock"} strokeWidth={"chest" in node && node.chest ? 2.3 : 2.5} />
          </div>
        ))}

        <div className="chapter-rule"><i /><span>Chapter 3 · Add volume</span><i /></div>

        {trailAfter.map((node) => (
          <div key={node.label} className="path-node locked" style={{ transform: `translateX(${node.offset}px)` }} aria-label={node.label}>
            <Icon name="lock" />
          </div>
        ))}

        <div className="path-guide">
          <p className="bubble">13 days straight. Let&#39;s lift.</p>
          <Image className="mascot" src={mascotSrc} width={160} height={160} alt="Zandegi mascot" priority unoptimized />
        </div>
      </div>
    </AppShell>
  );
}
