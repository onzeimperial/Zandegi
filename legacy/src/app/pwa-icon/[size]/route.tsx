import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

/**
 * Generates the PWA install icon on the fly — no external image asset
 * needed. `maskable=1` adds safe-zone padding so Android's adaptive-icon
 * mask (circle/squircle/etc.) never clips the glyph.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = Math.min(1024, Math.max(16, Number(sizeParam) || 512));
  const maskable = req.nextUrl.searchParams.get("maskable") === "1";
  const glyphSize = maskable ? size * 0.5 : size * 0.62;

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7B2FF7",
        }}
      >
        <div
          style={{
            fontSize: glyphSize,
            fontWeight: 800,
            color: "#F2F4FF",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          Z
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
