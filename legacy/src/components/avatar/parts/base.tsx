import { shade, type PartProps } from "../palette";

/** Body + head silhouettes. Drawn into a 100x100 viewBox, bust framing. */

export function BaseDefault({ skinTone }: PartProps) {
  return (
    <>
      <path d="M20 100 Q20 73 50 68 Q80 73 80 100 Z" fill={skinTone} />
      <rect x="44" y="50" width="12" height="18" rx="5" fill={shade(skinTone, -22)} />
      <ellipse cx="50" cy="36" rx="20" ry="22" fill={skinTone} />
      <ellipse cx="29.5" cy="38" rx="3.5" ry="5" fill={shade(skinTone, -12)} />
      <ellipse cx="70.5" cy="38" rx="3.5" ry="5" fill={shade(skinTone, -12)} />
    </>
  );
}

export function BaseSlim({ skinTone }: PartProps) {
  return (
    <>
      <path d="M26 100 Q26 75 50 70 Q74 75 74 100 Z" fill={skinTone} />
      <rect x="45" y="50" width="10" height="19" rx="4.5" fill={shade(skinTone, -22)} />
      <ellipse cx="50" cy="35" rx="17.5" ry="21.5" fill={skinTone} />
      <ellipse cx="31.5" cy="37" rx="3" ry="4.5" fill={shade(skinTone, -12)} />
      <ellipse cx="68.5" cy="37" rx="3" ry="4.5" fill={shade(skinTone, -12)} />
    </>
  );
}

export function BaseBroad({ skinTone }: PartProps) {
  return (
    <>
      <path d="M14 100 Q14 71 50 66 Q86 71 86 100 Z" fill={skinTone} />
      <rect x="43" y="50" width="14" height="17" rx="5" fill={shade(skinTone, -22)} />
      <ellipse cx="50" cy="36" rx="21.5" ry="22" fill={skinTone} />
      <ellipse cx="28" cy="38" rx="4" ry="5.5" fill={shade(skinTone, -12)} />
      <ellipse cx="72" cy="38" rx="4" ry="5.5" fill={shade(skinTone, -12)} />
    </>
  );
}
