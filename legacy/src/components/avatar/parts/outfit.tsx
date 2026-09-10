import { shade, contrastOn, type PartProps } from "../palette";

/** Clothing, drawn over the torso. `color` is the user's accent colour. */

export function OutfitDefault({ color }: PartProps) {
  return (
    <>
      <path d="M20 100 Q20 73 50 68 Q80 73 80 100 Z" fill={color} />
      <path d="M42 69.5 Q50 78 58 69.5 L58 100 L42 100 Z" fill={shade(color, -28)} />
    </>
  );
}

export function OutfitHoodie({ color }: PartProps) {
  return (
    <>
      <path d="M18 100 Q18 72 50 67 Q82 72 82 100 Z" fill={color} />
      <path d="M38 68.5 Q50 82 62 68.5 Q58 66.5 50 66.5 Q42 66.5 38 68.5 Z" fill={shade(color, -34)} />
      <path d="M46 70 L46 88" stroke={shade(color, 40)} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M54 70 L54 88" stroke={shade(color, 40)} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="46" cy="89" r="1.6" fill={shade(color, 40)} />
      <circle cx="54" cy="89" r="1.6" fill={shade(color, 40)} />
    </>
  );
}

export function OutfitBlazer({ color }: PartProps) {
  const shirt = contrastOn(color);
  return (
    <>
      <path d="M20 100 Q20 73 50 68 Q80 73 80 100 Z" fill={shade(color, -40)} />
      <path d="M44 68.5 L50 78 L56 68.5 L56 100 L44 100 Z" fill={shirt} />
      <path d="M43 69 Q47 82 44 100 L34 100 Q33 78 43 69 Z" fill={shade(color, -18)} />
      <path d="M57 69 Q53 82 56 100 L66 100 Q67 78 57 69 Z" fill={shade(color, -18)} />
      <path d="M50 78 L47 84 L50 90 L53 84 Z" fill={color} />
    </>
  );
}

export function OutfitAthletic({ color }: PartProps) {
  return (
    <>
      <path d="M20 100 Q20 73 50 68 Q80 73 80 100 Z" fill={shade(color, -30)} />
      <path d="M26 84 Q50 78 74 84 L74 90 Q50 84 26 90 Z" fill={color} />
      <path d="M42 69 Q50 76 58 69" stroke={shade(color, 45)} strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </>
  );
}

export function OutfitArmour({ color }: PartProps) {
  return (
    <>
      <path d="M18 100 Q18 72 50 66 Q82 72 82 100 Z" fill={shade(color, -46)} />
      <path d="M30 76 Q50 70 70 76 L70 84 Q50 79 30 84 Z" fill={shade(color, 18)} />
      <path d="M50 70 L50 100" stroke={shade(color, 40)} strokeWidth="1.5" />
      <circle cx="27" cy="80" r="6.5" fill={shade(color, -10)} />
      <circle cx="73" cy="80" r="6.5" fill={shade(color, -10)} />
      <path d="M44 88 L50 94 L56 88 L50 100 Z" fill={color} opacity="0.9" />
    </>
  );
}
