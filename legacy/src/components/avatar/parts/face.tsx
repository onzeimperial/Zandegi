import { shade, type PartProps } from "../palette";

/** Eyes, brows and mouth. Sits above the base, below the hair. */

const EYE = "#1c1917";

export function FaceDefault({ skinTone }: PartProps) {
  return (
    <>
      <ellipse cx="42.5" cy="35" rx="2.6" ry="3.1" fill={EYE} />
      <ellipse cx="57.5" cy="35" rx="2.6" ry="3.1" fill={EYE} />
      <circle cx="43.4" cy="34" r="0.9" fill="#fff" />
      <circle cx="58.4" cy="34" r="0.9" fill="#fff" />
      <path d="M45 45 Q50 48.5 55 45" stroke={shade(skinTone, -55)} strokeWidth="1.7" fill="none" strokeLinecap="round" />
    </>
  );
}

export function FaceCalm({ skinTone }: PartProps) {
  return (
    <>
      <path d="M39.5 35 Q42.5 32.6 45.5 35" stroke={EYE} strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M54.5 35 Q57.5 32.6 60.5 35" stroke={EYE} strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M46 45.5 Q50 47.4 54 45.5" stroke={shade(skinTone, -55)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  );
}

export function FaceDetermined({ skinTone, hairColor }: PartProps) {
  return (
    <>
      <path d="M38.5 29.5 L46.5 31.6" stroke={hairColor} strokeWidth="2.1" strokeLinecap="round" />
      <path d="M61.5 29.5 L53.5 31.6" stroke={hairColor} strokeWidth="2.1" strokeLinecap="round" />
      <ellipse cx="42.5" cy="36" rx="2.5" ry="2.8" fill={EYE} />
      <ellipse cx="57.5" cy="36" rx="2.5" ry="2.8" fill={EYE} />
      <path d="M45.5 46 L54.5 46" stroke={shade(skinTone, -55)} strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

export function FaceGrin({ skinTone }: PartProps) {
  return (
    <>
      <path d="M40 36.5 Q42.5 32.8 45 36.5" stroke={EYE} strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M55 36.5 Q57.5 32.8 60 36.5" stroke={EYE} strokeWidth="2.1" fill="none" strokeLinecap="round" />
      <path d="M43.5 44 Q50 50.5 56.5 44 Z" fill={shade(skinTone, -60)} />
      <path d="M44.6 44.7 L55.4 44.7" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}
