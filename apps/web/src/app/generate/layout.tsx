import { redirect } from "next/navigation";
import { readAccountAccess } from "@/lib/session";

// The page itself is a client component, so the server check lives here.
export const dynamic = "force-dynamic";

export default async function GenerateLayout({ children }: { children: React.ReactNode }) {
  const access = await readAccountAccess().catch(() => null);
  // Home explains every other state, including an identity outage.
  if (access?.kind !== "allowed" && access?.kind !== "guest-mode") redirect("/");
  return children;
}
