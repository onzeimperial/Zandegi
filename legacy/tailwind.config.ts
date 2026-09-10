import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1200px" },
    },
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          soft: "rgb(var(--brand-soft) / <alpha-value>)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",

        // Game shell — namespaced under `game-*` so these never collide with
        // Tailwind's own violet/cyan scales or the existing theme tokens
        // above. Only meaningful inside an element with the .game-shell
        // class (see src/styles/game-tokens.css).
        "game-void": "rgb(var(--g-void) / <alpha-value>)",
        "game-surface": "rgb(var(--g-surface) / <alpha-value>)",
        "game-surface-hi": "rgb(var(--g-surface-hi) / <alpha-value>)",
        "game-violet": "rgb(var(--g-violet) / <alpha-value>)",
        "game-cyan": "rgb(var(--g-cyan) / <alpha-value>)",
        "game-magenta": "rgb(var(--g-magenta) / <alpha-value>)",
        "game-text": "rgb(var(--g-text) / <alpha-value>)",
        "game-text-dim": "rgb(var(--g-text-dim) / <alpha-value>)",

        // Percentile rarity ladder (5 tiers) — distinct from the existing
        // 6-tier authored cosmetic rarity in src/lib/constants.ts.
        "game-common": "rgb(var(--g-common) / <alpha-value>)",
        "game-uncommon": "rgb(var(--g-uncommon) / <alpha-value>)",
        "game-rare": "rgb(var(--g-rare) / <alpha-value>)",
        "game-epic": "rgb(var(--g-epic) / <alpha-value>)",
        "game-legendary": "rgb(var(--g-legendary) / <alpha-value>)",
      },
      borderRadius: {
        lg: "14px",
        md: "10px",
        sm: "7px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        "game-display": ["var(--font-game-display)", "ui-sans-serif", "sans-serif"],
        "game-body": ["var(--font-game-body)", "ui-sans-serif", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "xp-pop": { "0%": { transform: "scale(0.9)", opacity: "0" }, "60%": { transform: "scale(1.05)" }, "100%": { transform: "scale(1)", opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "g-pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgb(var(--g-cyan) / 0.55)" },
          "50%": { boxShadow: "0 0 0 6px rgb(var(--g-cyan) / 0)" },
        },
        "g-press": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.96)" },
          "100%": { transform: "scale(1)" },
        },
        "g-slide-up": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.24s ease-out",
        "xp-pop": "xp-pop 0.4s ease-out",
        shimmer: "shimmer 1.6s infinite",
        "g-pulse-ring": "g-pulse-ring 2.2s ease-in-out infinite",
        "g-press": "g-press 120ms ease-out",
        "g-slide-up": "g-slide-up 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
