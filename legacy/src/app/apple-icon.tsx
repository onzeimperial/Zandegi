import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#7B2FF7",
        }}
      >
        <div style={{ fontSize: 112, fontWeight: 800, color: "#F2F4FF", fontFamily: "sans-serif" }}>Z</div>
      </div>
    ),
    { ...size },
  );
}
