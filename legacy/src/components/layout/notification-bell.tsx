"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ notifications: Notification[]; unread: number }>("/api/notifications"),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    await api.patch("/api/notifications", { all: true });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg animate-fade-in">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="inline-flex items-center gap-1 text-[11px] text-brand hover:underline">
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={cn("border-b border-border px-3 py-2.5 last:border-0", !n.read && "bg-brand-soft/40")}>
                    <p className="text-xs font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[11px] text-muted">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-muted">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                );
                return n.href ? (
                  <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block hover:bg-surface-2">
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
