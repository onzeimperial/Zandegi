import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zandegi",
  description: "A life RPG. State any ambition; Zandegi turns it into a mission.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
