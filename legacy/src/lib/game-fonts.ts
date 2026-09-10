import { Archivo, Inter } from "next/font/google";

/**
 * Fonts for the game shell only. The rest of the app uses the system font
 * stack via --font-sans (see globals.css) and is left alone — these are
 * exposed as their own CSS variables, applied only inside (game)/layout.tsx.
 */

export const gameDisplay = Archivo({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-game-display",
  display: "swap",
});

export const gameBody = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-game-body",
  display: "swap",
});
