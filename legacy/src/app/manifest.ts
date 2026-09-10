import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zandegi — turn your goals into a game you win",
    short_name: "Zandegi",
    description:
      "An AI-powered life progression platform. Enter any goal and get a milestone-by-milestone plan with XP, levels, a character, and adaptive coaching.",
    start_url: "/",
    display: "standalone",
    background_color: "#080B1A",
    theme_color: "#080B1A",
    orientation: "portrait-primary",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
