import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Step" };

/* Sets 1-3 are complete, per the authored board. The captured reference PNG
   renders these boxes unchecked because the export runtime dropped the
   `checked` attribute when it baked the bundle; the authored source and the
   completed row styling both say otherwise, so the source wins. */
const sets = [
  { index: 1, done: true }, { index: 2, done: true }, { index: 3, done: true },
  { index: 4, done: false }, { index: 5, done: false },
];

export default function StepPage() {
  return (
    <main className="step-page">
      <p className="sr-only">Fixture-backed step preview. Set completion, rescheduling and verification are not saved.</p>

      <header className="step-header">
        <div className="side">
          <Link href="/path" className="step-close" aria-label="Close step"><Icon name="close" strokeWidth={2.8} /></Link>
        </div>
        <div className="step-progress">
          <div>
            <div className="track" aria-hidden="true"><i style={{ width: "57%" }} /></div>
            <b>5 of 7</b>
          </div>
        </div>
        <div className="side end" />
      </header>

      <div className="step-body">
        <div className="step-grid">
          <div className="step-main">
            <div className="step-heading">
              <span className="eyebrow">Chapter 2 · Build the base</span>
              <h1>Push day A: 5×5 bench at 75 kg</h1>
            </div>

            <div className="media-row">
              <span className="media-icon"><Icon name="clock" /></span>
              <span className="media-text">
                <b>Today · 6:30 – 7:30 pm</b>
                <span className="sub">Blocked in your calendar · Gym</span>
              </span>
              {/* Inert until scheduling exists; the preview note above says so. */}
              <button type="button" className="action" disabled>Move</button>
            </div>

            <fieldset className="set-list">
              <legend className="d">Working sets</legend>
              {sets.map((set) => (
                <label className="set-row" key={set.index}>
                  <input type="checkbox" defaultChecked={set.done} />
                  <span>Set {set.index}</span>
                  <span className="load">5 × 75 kg</span>
                </label>
              ))}
            </fieldset>
          </div>

          <div className="step-aside">
            <div className="media-row plain">
              <span className="media-icon tinted"><Icon name="shield" /></span>
              <span className="media-text">
                <span className="lead">Tier 2 verification</span>
                <span className="sub">Logged sets + a photo of the loaded bar</span>
              </span>
              <span className="d xp-pill">+40 XP</span>
            </div>

            <div className="advice">
              <div className="advice-head"><span className="advice-tag">ADVICE</span><b>Next session</b></div>
              <p>If all 25 reps are clean, try adding 2.5 kg. If not, repeat 75 kg.</p>
            </div>

            <Link href="/complete" className="d cta"><Icon name="camera" /><span>Log &amp; verify</span></Link>
          </div>
        </div>
      </div>
    </main>
  );
}
