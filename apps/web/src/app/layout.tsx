import { ClerkProvider } from "@clerk/nextjs";
import { authModeFromEnv } from "@zandegi/api";
import type { Metadata } from "next";
import { AccountsEnabledProvider } from "@/components/account";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Zandegi", template: "%s · Zandegi" },
  description: "A life RPG. State any ambition; Zandegi turns it into a mission.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  // Guest mode has no keys, and Clerk's provider refuses to render without them.
  if (authModeFromEnv(process.env) !== "clerk") return body;
  return (
    <ClerkProvider>
      <AccountsEnabledProvider>{body}</AccountsEnabledProvider>
    </ClerkProvider>
  );
}
