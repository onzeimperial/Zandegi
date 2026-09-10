"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Target,
  Sparkles,
  BarChart3,
  Users,
  Settings,
  Menu,
  X,
  Flame,
  LogOut,
  Plus,
  Trophy,
  Swords,
  BookOpen,
  Coins,
  Shirt,
  Library,
  Medal,
  Sparkles as SparklesIcon,
  Search as SearchIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/primitives";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CommandPalette } from "@/components/layout/command-palette";
import { AvatarRender, type AvatarConfig } from "@/components/avatar/avatar-render";
import { RankBadge } from "@/components/progression/level-up";

interface ShellUser {
  name: string;
  email: string;
  avatar: AvatarConfig;
  coins: number;
  level: number;
  xpIntoLevel: number;
  xpForThisLevel: number;
  progressPct: number;
  streak: number;
  onboarded: boolean;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/catalog", label: "Catalogue", icon: Library },
  { href: "/coach", label: "AI Coach", icon: Sparkles },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/league", label: "League", icon: Medal },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/avatar", label: "Character", icon: Shirt },
  { href: "/shop", label: "Shop", icon: Coins },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/pro", label: "Zandegi Pro", icon: SparklesIcon },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const SidebarContent = (
    <div className="flex h-full flex-col gap-1 p-3">
      <Link href="/dashboard" className="mb-3 flex items-center gap-2 px-2 py-1 font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">Z</span>
        Zandegi
      </Link>

      <Link href="/goals/new" className="btn-primary mb-2 w-full" onClick={() => setOpen(false)}>
        <Plus className="h-4 w-4" /> New goal
      </Link>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-2">
        <div className="rounded-md border border-border bg-surface-2 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="font-medium">Level {user.level}</span>
              <RankBadge level={user.level} />
            </span>
            <span className="inline-flex items-center gap-2 text-muted">
              <span className="inline-flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-brand" /> {user.coins.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5 text-warning" /> {user.streak}
              </span>
            </span>
          </div>
          <Progress value={user.progressPct} className="mt-2" />
          <p className="mt-1 text-[11px] text-muted">
            {user.xpIntoLevel}/{user.xpForThisLevel} XP to next level
          </p>
        </div>

        <div className="flex items-center gap-3 px-1">
          <Link href="/avatar" onClick={() => setOpen(false)} aria-label="Edit your character">
            <AvatarRender config={user.avatar} size={36} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] text-muted">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-muted hover:text-danger"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-between px-1">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-border bg-surface lg:block">
        {SidebarContent}
      </aside>

      {/* mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-surface">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-bg/80 px-4 py-2.5 backdrop-blur">
          <button onClick={() => setOpen((v) => !v)} aria-label="Menu" className="btn-ghost px-2 lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-semibold lg:hidden">Zandegi</span>

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted transition hover:text-fg sm:flex"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            Search goals, tasks, skills…
            <kbd className="ml-2 rounded border border-border px-1 text-[10px]">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setPaletteOpen(true)} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-fg sm:hidden" aria-label="Search">
              <SearchIcon className="h-4 w-4" />
            </button>
            <NotificationBell />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
