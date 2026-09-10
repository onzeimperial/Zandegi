import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { levelProgress } from "@/server/xp/levels";
import { avatarFromProfile, DEFAULT_AVATAR } from "@/components/avatar/config";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await db.profile.findUnique({ where: { userId: session.user.id } });
  const streak = await db.streak.findUnique({ where: { userId: session.user.id } });
  const lp = levelProgress(profile?.totalXp ?? 0);

  return (
    <AppShell
      user={{
        name: profile?.displayName ?? session.user.name ?? "You",
        email: session.user.email ?? "",
        avatar: profile ? avatarFromProfile(profile) : DEFAULT_AVATAR,
        coins: profile?.coins ?? 0,
        level: lp.level,
        xpIntoLevel: lp.xpIntoLevel,
        xpForThisLevel: lp.xpForThisLevel,
        progressPct: lp.progressPct,
        streak: streak?.current ?? 0,
        onboarded: !!profile?.onboardedAt,
      }}
    >
      {children}
    </AppShell>
  );
}
