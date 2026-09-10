"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Check, X, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/primitives";

export interface RecoData {
  id: string;
  kind: string;
  title: string;
  body: string;
  priority: number;
  goal?: { id: string; title: string } | null;
}

const kindTone: Record<string, "brand" | "warning" | "danger" | "neutral" | "success"> = {
  focus: "brand",
  revise: "warning",
  plan_change: "neutral",
  resource: "success",
  pace: "danger",
  wellbeing: "neutral",
};

export function RecommendationCard({ rec }: { rec: RecoData }) {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);

  async function set(status: "accepted" | "dismissed") {
    setHidden(true);
    try {
      await api.patch(`/api/recommendations/${rec.id}`, { status });
    } finally {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
  }

  if (hidden) return null;

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-brand" />
        <Badge tone={kindTone[rec.kind] ?? "neutral"}>{rec.kind.replace("_", " ")}</Badge>
        {rec.goal && <span className="truncate text-[11px] text-muted">{rec.goal.title}</span>}
      </div>
      <p className="mt-1.5 text-xs font-medium">{rec.title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{rec.body}</p>
      <div className="mt-2 flex gap-1.5">
        <button onClick={() => set("accepted")} className="btn-outline flex-1 px-2 py-1 text-[11px]">
          <Check className="h-3 w-3" /> Got it
        </button>
        <button onClick={() => set("dismissed")} className="btn-ghost px-2 py-1 text-[11px]">
          <X className="h-3 w-3" /> Dismiss
        </button>
      </div>
    </div>
  );
}
