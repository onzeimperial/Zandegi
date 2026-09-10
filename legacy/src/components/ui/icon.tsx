import {
  Flag,
  CheckCircle,
  ListChecks,
  Flame,
  Zap,
  TrendingUp,
  Milestone,
  Sparkles,
  Trophy,
  Layers,
  Users,
  Swords,
  Sunrise,
  Moon,
  Timer,
  Award,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  flag: Flag,
  "check-circle": CheckCircle,
  "list-checks": ListChecks,
  flame: Flame,
  zap: Zap,
  "trending-up": TrendingUp,
  milestone: Milestone,
  sparkles: Sparkles,
  trophy: Trophy,
  layers: Layers,
  users: Users,
  swords: Swords,
  sunrise: Sunrise,
  moon: Moon,
  timer: Timer,
};

export function AchievementIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = MAP[name] ?? Award;
  return <Cmp className={className} />;
}
