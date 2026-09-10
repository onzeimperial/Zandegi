"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route, UserRound, Users, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/path", label: "Path", icon: Route },
  { href: "/character", label: "Character", icon: UserRound },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/today", label: "Today", icon: Sparkles },
];

/**
 * Bottom bar on mobile, left rail on desktop. Exactly the 4 destinations
 * from the spec — everything else in the app (shop, catalog, analytics,
 * coach, settings...) is reachable from inside these, not from here.
 */
export function GameNav() {
  const pathname = usePathname();

  const items = NAV.map((item) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex flex-col items-center justify-center gap-1 rounded-md px-3 py-2 outline-none",
          "focus-visible:ring-2 focus-visible:ring-game-cyan",
          "lg:w-full lg:flex-row lg:justify-start lg:gap-3 lg:px-3.5 lg:py-2.5",
        )}
      >
        <item.icon
          className={cn(
            "h-5 w-5 transition-colors",
            active ? "text-game-cyan" : "text-game-text-dim group-hover:text-game-text",
          )}
        />
        <span
          className={cn(
            "font-game-body text-[11px] font-semibold transition-colors lg:text-sm",
            active ? "text-game-cyan" : "text-game-text-dim group-hover:text-game-text",
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  });

  return (
    <>
      {/* Desktop: left rail */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 top-14 z-30 hidden w-56 flex-col gap-1 border-r border-game-surface-hi bg-game-void p-3 lg:flex"
      >
        {items}
      </nav>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-game-surface-hi bg-game-void/95 backdrop-blur lg:hidden"
      >
        {items}
      </nav>
    </>
  );
}
