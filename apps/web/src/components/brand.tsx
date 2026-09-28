import Link from "next/link";
import React from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/path" className="brand" aria-label="Zandegi home">
      <span className="brand-mark" aria-hidden="true">Z</span>
      {!compact && <span className="display brand-name">zandegi</span>}
    </Link>
  );
}

export function Mascot({ mood = "ready" }: { mood?: "ready" | "thinking" | "celebrate" }) {
  return (
    <div className={`mascot mascot-${mood}`} role="img" aria-label={`Zandegi guide, ${mood}`}>
      <span aria-hidden="true">Z</span>
    </div>
  );
}
