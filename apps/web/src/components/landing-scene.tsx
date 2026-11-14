"use client";

import { useEffect, useRef } from "react";

const sceneSrc = "/landing/golden-hour-desk.mp4";

/**
 * The golden-hour beach behind the sign-in panel. Decorative, so hidden from
 * assistive tech. It only plays when motion is welcome; otherwise its first
 * frame stands as a still. The panel's gradient shows until it loads.
 */
export function LandingScene() {
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = video.current;
    if (element === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      if (reduce.matches) element.pause();
      // Autoplay can be refused (data saver, battery); the still frame is fine then.
      else element.play().catch(() => undefined);
    };
    sync();
    reduce.addEventListener("change", sync);
    return () => reduce.removeEventListener("change", sync);
  }, []);

  return (
    <video
      ref={video}
      className="auth-scene"
      src={sceneSrc}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
