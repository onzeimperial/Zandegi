import type { PartProps } from "../palette";

/**
 * Background effects, drawn behind the character. These are the payoff for
 * high-rarity drops, so the top tiers animate.
 */

export function AuraGlow({ color, uid }: PartProps) {
  const id = `aura-glow-${uid}`;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="35%" stopColor={color} stopOpacity="0.55" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="48" r="50" fill={`url(#${id})`} />
    </>
  );
}

export function AuraRings({ color }: PartProps) {
  return (
    <g fill="none" stroke={color} strokeOpacity="0.55">
      <circle cx="50" cy="48" r="43" strokeWidth="1.4" strokeDasharray="7 6">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 50 48"
          to="360 50 48"
          dur="18s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="50" cy="48" r="35" strokeWidth="1" strokeDasharray="4 8" strokeOpacity="0.35">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="360 50 48"
          to="0 50 48"
          dur="26s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
}

export function AuraFlame({ color, uid }: PartProps) {
  const id = `aura-flame-${uid}`;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="30%" stopColor={color} stopOpacity="0.7" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id})`}>
        <animate attributeName="r" values="44;50;44" dur="3.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.75;1;0.75" dur="3.2s" repeatCount="indefinite" />
      </circle>
    </>
  );
}

export function AuraSparks({ color }: PartProps) {
  const sparks = [
    { cx: 18, cy: 30, r: 2.2, dur: "2.6s" },
    { cx: 82, cy: 26, r: 1.7, dur: "3.4s" },
    { cx: 12, cy: 62, r: 1.5, dur: "2.9s" },
    { cx: 88, cy: 58, r: 2, dur: "3.8s" },
    { cx: 50, cy: 8, r: 1.6, dur: "3.1s" },
  ];
  return (
    <g fill={color}>
      {sparks.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={s.r}>
          <animate attributeName="opacity" values="0.2;1;0.2" dur={s.dur} repeatCount="indefinite" />
          <animate attributeName="r" values={`${s.r * 0.6};${s.r};${s.r * 0.6}`} dur={s.dur} repeatCount="indefinite" />
        </circle>
      ))}
    </g>
  );
}

export function AuraCosmic({ color, uid }: PartProps) {
  const id = `aura-cosmic-${uid}`;
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="20%" stopColor={color} stopOpacity="0.75" />
          <stop offset="70%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="48" r="50" fill={`url(#${id})`}>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="4s" repeatCount="indefinite" />
      </circle>
      <g fill="none" stroke={color} strokeOpacity="0.6" strokeWidth="1.2">
        <ellipse cx="50" cy="48" rx="46" ry="18">
          <animateTransform attributeName="transform" type="rotate" from="0 50 48" to="360 50 48" dur="12s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="50" cy="48" rx="46" ry="18" strokeOpacity="0.3">
          <animateTransform attributeName="transform" type="rotate" from="60 50 48" to="420 50 48" dur="16s" repeatCount="indefinite" />
        </ellipse>
      </g>
    </>
  );
}
