"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Target, CheckSquare, Sparkles, BookOpen, Users, FileText, Plus, LayoutDashboard, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Result {
  type: "goal" | "task" | "skill" | "resource" | "knowledge" | "friend";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const typeIcon = {
  goal: Target,
  task: CheckSquare,
  skill: Sparkles,
  resource: FileText,
  knowledge: BookOpen,
  friend: Users,
} as const;

const QUICK: { label: string; href: string; icon: typeof Plus }[] = [
  { label: "New goal", href: "/goals/new", icon: Plus },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "AI Coach", href: "/coach", icon: Sparkles },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get<{ results: Result[] }>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(res.results);
        setActive(0);
      } catch {
        setResults([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  if (!open) return null;

  const items = q.trim().length >= 2 ? results : [];
  const showQuick = q.trim().length < 2;

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && items[active]) go(items[active].href);
            if (e.key === "Escape") onClose();
          }}
          placeholder="Search goals, tasks, skills, knowledge…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted"
        />

        <div className="max-h-80 overflow-y-auto p-2">
          {showQuick && (
            <div>
              <p className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted">Quick actions</p>
              {QUICK.map((a) => (
                <button key={a.href} onClick={() => go(a.href)} className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-2">
                  <a.icon className="h-4 w-4 text-muted" />
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {!showQuick && items.length === 0 && (
            <p className="px-2 py-8 text-center text-xs text-muted">No matches.</p>
          )}

          {items.map((r, i) => {
            const Icon = typeIcon[r.type];
            return (
              <button
                key={`${r.type}-${r.id}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                  i === active ? "bg-brand-soft text-brand" : "hover:bg-surface-2",
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.title}</span>
                  {r.subtitle && <span className="block truncate text-[11px] text-muted">{r.subtitle}</span>}
                </span>
                <span className="text-[10px] uppercase text-muted">{r.type}</span>
                <ArrowRight className="h-3 w-3 opacity-40" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
