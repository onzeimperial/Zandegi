"use client";

import { useEffect, useState } from "react";

/**
 * The global CSS rule in game-tokens.css already collapses CSS transitions
 * and keyframe animations to ~0 under prefers-reduced-motion. That does NOT
 * cover JS-driven animation (e.g. a requestAnimationFrame count-up loop),
 * which is why this hook exists — components doing their own frame-by-frame
 * work check it and jump straight to the end state instead.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
