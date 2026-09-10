import { shade, type PartProps } from "../palette";

/**
 * The ring around the portrait. Frames are drawn last, on top of everything,
 * and are the clearest at-a-glance signal of a rarity tier.
 */

export function FrameDefault({ color }: PartProps) {
  return <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="3" />;
}

export function FrameThin({ color }: PartProps) {
  return (
    <>
      <circle cx="50" cy="50" r="48.5" fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.45" />
    </>
  );
}

export function FrameStudded({ color }: PartProps) {
  const studs = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="3.4" />
      {studs.map((deg) => (
        <circle
          key={deg}
          cx={50 + 48 * Math.cos((deg * Math.PI) / 180)}
          cy={50 + 48 * Math.sin((deg * Math.PI) / 180)}
          r="2.2"
          fill={shade(color, 45)}
        />
      ))}
    </>
  );
}

export function FrameLaurel({ color }: PartProps) {
  const leaves = Array.from({ length: 16 }, (_, i) => 120 + (i * 300) / 16);
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="none" stroke={color} strokeWidth="2.4" />
      {leaves.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <ellipse
            key={deg}
            cx={50 + 48 * Math.cos(rad)}
            cy={50 + 48 * Math.sin(rad)}
            rx="4.2"
            ry="1.8"
            fill={color}
            fillOpacity="0.85"
            transform={`rotate(${deg} ${50 + 48 * Math.cos(rad)} ${50 + 48 * Math.sin(rad)})`}
          />
        );
      })}
    </>
  );
}

export function FrameRunic({ color, uid }: PartProps) {
  const id = `frame-runic-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(color, 55)} />
          <stop offset="50%" stopColor={color} />
          <stop offset="100%" stopColor={shade(color, -35)} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke={`url(#${id})`} strokeWidth="4" />
      <circle
        cx="50"
        cy="50"
        r="43.5"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeOpacity="0.6"
        strokeDasharray="3 5"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 50"
          to="360 50 50"
          dur="22s"
          repeatCount="indefinite"
        />
      </circle>
    </>
  );
}

export function FramePrismatic({ uid }: PartProps) {
  const id = `frame-prismatic-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="25%" stopColor="#f59e0b" />
          <stop offset="50%" stopColor="#10b981" />
          <stop offset="75%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#a855f7" />
          <animateTransform
            attributeName="gradientTransform"
            type="rotate"
            from="0 0.5 0.5"
            to="360 0.5 0.5"
            dur="8s"
            repeatCount="indefinite"
          />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke={`url(#${id})`} strokeWidth="4.5" />
    </>
  );
}
