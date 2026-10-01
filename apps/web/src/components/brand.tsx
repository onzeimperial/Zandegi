import Image from "next/image";
import Link from "next/link";
import React from "react";

const mascotSrc = "/design/mascot-abe2675ee7fc68d644fa0e93dc74b94ffb85b330e5b5e02bcac4b0ab8c569d29.png";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/path" className="brand" aria-label="Zandegi home">
      <Image className="brand-mark" src={mascotSrc} width={44} height={44} alt="" priority unoptimized />
      {!compact && <span className="display brand-name">zandegi</span>}
    </Link>
  );
}

export function Mascot({ mood = "ready" }: { mood?: "ready" | "thinking" | "celebrate" }) {
  return (
    <Image
      className={`mascot mascot-${mood}`}
      src={mascotSrc}
      width={260}
      height={260}
      alt={`Zandegi guide, ${mood}`}
      priority unoptimized
    />
  );
}
