import { redirect } from "next/navigation";
import { readAccountAccess, type AccountAccess } from "@/lib/session";
import { HomeView, type HomeState } from "./home-view";

// Depends on who is asking and on the runtime environment, so never prerendered.
export const dynamic = "force-dynamic";

const STATES: Record<Exclude<AccountAccess["kind"], "allowed">, HomeState> = {
  "guest-mode": "guest",
  disabled: "closed",
  "signed-out": "sign-in",
  "not-invited": "invite-only",
};

export default async function Home() {
  const access = await readAccountAccess().catch(() => null);
  if (access === null) return <HomeView state="unavailable" />;
  // Outside any try: `redirect` works by throwing.
  if (access.kind === "allowed") redirect("/path");
  return <HomeView state={STATES[access.kind]} />;
}
