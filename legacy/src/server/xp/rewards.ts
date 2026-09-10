import { clamp } from "@/lib/utils";

/** Pure: how much XP a completed task is worth. No IO — unit tested. */
export function computeTaskXp(params: {
  baseReward: number;
  difficulty: number; // 1..5
  performance?: number | null; // 0..100
  onTime?: boolean;
}): number {
  const diffMult = 0.7 + params.difficulty * 0.15; // 1 -> 0.85, 5 -> 1.45
  const perf =
    params.performance == null ? 1 : 0.6 + (clamp(params.performance, 0, 100) / 100) * 0.6; // 0.6..1.2
  const punctual = params.onTime === false ? 0.9 : 1;
  return Math.max(1, Math.round(params.baseReward * diffMult * perf * punctual));
}
