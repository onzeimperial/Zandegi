import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ArrowRight, Sparkles, Brain, Swords, Coins, Dumbbell, Flame, Hammer, Users, Globe } from "lucide-react";
import { LifeStar } from "@/components/game/life-star";
import { DomainTile } from "@/components/game/domain-tile";
import { DOMAINS, DOMAIN_LABELS, DOMAIN_COLORS, type Domain } from "@/server/domains";
import { activeUserCountsByDomain } from "@/server/domains/service";
import { gameDisplay, gameBody } from "@/lib/game-fonts";
import "@/styles/game-tokens.css";

const DOMAIN_ICONS: Record<Domain, typeof Brain> = {
  mind: Brain,
  edge: Swords,
  coin: Coins,
  body: Dumbbell,
  grit: Flame,
  craft: Hammer,
  bond: Users,
  world: Globe,
};

export default async function LandingPage() {
  const session = await auth();
  // The new game shell is now the primary logged-in experience — see the
  // build-out at (game)/path, character, crew. The old (app) dashboard and
  // every page under it are untouched and still fully reachable directly.
  if (session?.user) redirect("/path");

  const counts = await activeUserCountsByDomain();
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <div className={`game-shell ${gameDisplay.variable} ${gameBody.variable} font-game-body`}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-game-display font-extrabold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-game-violet text-white">Z</span>
          Zandegi
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md px-3.5 py-2 font-game-body text-sm font-medium text-game-text-dim hover:text-game-text"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-game-violet px-3.5 py-2 font-game-body text-sm font-semibold text-white"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* ── Hero ──────────────────────────────────────────── */}
        <section className="grid items-center gap-8 py-12 sm:py-20 lg:grid-cols-[1fr_1fr]">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-game-surface-hi bg-game-surface px-3 py-1 font-game-body text-xs text-game-text-dim">
              <Sparkles className="h-3.5 w-3.5 text-game-cyan" /> AI-powered life progression
            </p>
            <h1 className="text-balance font-game-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Turn any goal into a game you actually win.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-pretty font-game-body text-base text-game-text-dim sm:text-lg lg:mx-0">
              Zandegi takes a real-life goal — a degree, a language, a career move, a habit — and builds
              it into a progression system: milestones, XP, levels, and a character that grows as you do.
              Finish something big, earn something rare.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                href="/register"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-game-violet px-6 py-3 font-game-body text-sm font-semibold text-white sm:w-auto"
              >
                Start your first goal <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="w-full rounded-md border border-game-surface-hi px-6 py-3 text-center font-game-body text-sm font-medium text-game-text sm:w-auto"
              >
                I have an account
              </Link>
            </div>
          </div>

          <div className="mx-auto">
            <LifeStar
              axes={DOMAINS.map((d) => ({
                domain: d,
                label: DOMAIN_LABELS[d],
                value: counts[d],
                color: DOMAIN_COLORS[d],
              }))}
              max={maxCount}
              size={340}
            />
            <p className="mt-2 text-center font-game-body text-[11px] text-game-text-dim">
              Real activity across Zandegi right now, by domain
            </p>
          </div>
        </section>

        {/* ── Domain grid ───────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-3 pb-20 sm:grid-cols-4">
          {DOMAINS.map((d) => (
            <DomainTile
              key={d}
              domain={d}
              color={DOMAIN_COLORS[d]}
              icon={DOMAIN_ICONS[d]}
              activeCount={counts[d]}
            />
          ))}
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-10 text-center font-game-body text-xs text-game-text-dim">
        Zandegi — built as a real product foundation.
      </footer>
    </div>
  );
}
