import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Hud } from "@/components/game/hud";
import { GameNav } from "@/components/game/nav";
import { gameDisplay, gameBody } from "@/lib/game-fonts";
import "@/styles/game-tokens.css";

/**
 * The game shell — a second, independent visual system living alongside the
 * existing (app) group. Nothing here touches the light/dark theme or any
 * page outside this route group; game-tokens.css is scoped under
 * .game-shell specifically so the two cannot bleed into each other.
 */
export default async function GameLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className={`game-shell ${gameDisplay.variable} ${gameBody.variable} font-game-body`}>
      <Hud />
      <GameNav />
      <main className="pb-20 pt-4 lg:ml-56 lg:pb-4">
        <div className="mx-auto max-w-3xl px-4">{children}</div>
      </main>
    </div>
  );
}
