import Image from "next/image";

const sceneSrc = "/landing/home-background.png";

/**
 * The golden-hour beach behind the sign-in panel. Decorative, so hidden from
 * assistive tech. The panel's gradient shows until the image loads.
 */
export function LandingScene() {
  return (
    <Image
      className="auth-scene"
      src={sceneSrc}
      alt=""
      fill
      priority
      unoptimized
      sizes="100vw"
      aria-hidden="true"
    />
  );
}
