import { cn } from "@/lib/utils";
import { DOMAIN_LABELS, DOMAIN_COLORS, type Domain } from "@/server/domains";
import type { DomainValue } from "@/server/domains/service";

/**
 * Genuinely responds to the life star's axis selection — dims every row but
 * the selected domain. It does NOT filter the achievements grid below it:
 * achievements have no real domain classification in this app (they're
 * categorised consistency/mastery/milestone/social/meta, which doesn't map
 * onto Mind/Edge/Coin/... without inventing a link that isn't real), so
 * that part of "filters everything below" is intentionally left undone
 * rather than faked.
 */
export function DomainRows({
  values,
  selected,
}: {
  values: DomainValue[];
  selected: Domain | null;
}) {
  return (
    <div className="space-y-2">
      {values.map((d) => {
        const dim = selected != null && selected !== d.domain;
        return (
          <div
            key={d.domain}
            className={cn(
              "flex items-center gap-3 rounded-md border border-game-surface-hi p-2.5 transition-opacity",
              dim && "opacity-35",
            )}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full font-game-display text-xs font-extrabold"
              style={{ background: `${colorFor(d)}22`, color: colorFor(d) }}
            >
              {d.level}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-game-body text-sm font-semibold">{DOMAIN_LABELS[d.domain]}</span>
                {!d.isRealXp ? (
                  <span
                    className="font-game-body text-[10px] text-game-text-dim"
                    title="Bond has no goal category of its own — its level comes from friendships and challenges, not goal XP like the other seven."
                  >
                    from crew activity
                  </span>
                ) : null}
              </div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-game-surface-hi">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${d.progressPct}%`, background: colorFor(d) }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function colorFor(d: DomainValue): string {
  return DOMAIN_COLORS[d.domain];
}
