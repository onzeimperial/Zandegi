import { shade, type PartProps } from "../palette";

/** Hair styles. Drawn over the head, so they mask the top of the skull. */

export function HairDefault({ hairColor }: PartProps) {
  return (
    <>
      <path d="M30 34 Q30 13 50 13 Q70 13 70 34 Q66 24 50 24 Q34 24 30 34 Z" fill={hairColor} />
      <path d="M30 34 Q32 26 38 23" stroke={shade(hairColor, 26)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  );
}

export function HairShort({ hairColor }: PartProps) {
  return (
    <path d="M31 32 Q31 15 50 15 Q69 15 69 32 Q65 22.5 50 22.5 Q35 22.5 31 32 Z" fill={hairColor} />
  );
}

export function HairLong({ hairColor }: PartProps) {
  return (
    <>
      <path d="M27 66 Q24 34 32 24 Q40 13 50 13 Q60 13 68 24 Q76 34 73 66 Q70 48 66 42 Q64 27 50 27 Q36 27 34 42 Q30 48 27 66 Z" fill={hairColor} />
      <path d="M32 24 Q40 18 50 18" stroke={shade(hairColor, 26)} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </>
  );
}

export function HairCurly({ hairColor }: PartProps) {
  return (
    <>
      <circle cx="35" cy="22" r="9" fill={hairColor} />
      <circle cx="50" cy="16.5" r="10.5" fill={hairColor} />
      <circle cx="65" cy="22" r="9" fill={hairColor} />
      <circle cx="30.5" cy="31" r="7" fill={hairColor} />
      <circle cx="69.5" cy="31" r="7" fill={hairColor} />
      <circle cx="46" cy="19" r="4" fill={shade(hairColor, 20)} opacity="0.5" />
    </>
  );
}

export function HairBun({ hairColor }: PartProps) {
  return (
    <>
      <circle cx="50" cy="10" r="7.5" fill={shade(hairColor, -12)} />
      <path d="M30 33 Q30 14 50 14 Q70 14 70 33 Q66 23 50 23 Q34 23 30 33 Z" fill={hairColor} />
    </>
  );
}

export function HairSpiky({ hairColor }: PartProps) {
  return (
    <path
      d="M30 33 L34 18 L38.5 27 L43 13 L47.5 25 L52 11 L56.5 25 L61 14 L65 27 L70 19 L70 33 Q66 23.5 50 23.5 Q34 23.5 30 33 Z"
      fill={hairColor}
    />
  );
}
