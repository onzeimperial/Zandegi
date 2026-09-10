"use client";

import { Progress, Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface SkillNode {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  parentId: string | null;
  level: number;
  mastery: number;
  confidence: number;
  lastPracticedAt: string | null;
  prerequisites: { prerequisite: { id: string; name: string } }[];
}

/** Renders skills as an indented tree (parent → children), with mastery bars. */
export function SkillTree({ skills }: { skills: SkillNode[] }) {
  const byParent = new Map<string | null, SkillNode[]>();
  for (const s of skills) {
    const key = s.parentId && skills.some((x) => x.id === s.parentId) ? s.parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(s);
  }

  const render = (parentId: string | null, depth: number): React.ReactNode => {
    const nodes = byParent.get(parentId) ?? [];
    if (!nodes.length) return null;
    return (
      <ul className={cn(depth > 0 && "ml-4 border-l border-border pl-4")}>
        {nodes.map((s) => (
          <li key={s.id} className="py-1.5">
            <div className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.description && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{s.description}</p>}
                </div>
                <Badge tone={s.mastery >= 80 ? "success" : s.mastery >= 40 ? "brand" : "neutral"}>Lv {s.level}</Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Mastery</p>
                  <Progress value={s.mastery} tone={s.mastery >= 80 ? "success" : "brand"} />
                </div>
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-wide text-muted">Confidence</p>
                  <Progress value={s.confidence} tone="warning" />
                </div>
              </div>
              {s.prerequisites.length > 0 && (
                <p className="mt-2 text-[11px] text-muted">
                  Needs: {s.prerequisites.map((p) => p.prerequisite.name).join(", ")}
                </p>
              )}
            </div>
            {render(s.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  };

  return <div>{render(null, 0)}</div>;
}
