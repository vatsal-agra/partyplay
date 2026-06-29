import { ImageResponse } from "next/og"

// Branded social-share card, generated in code (no image asset needed). This is
// what shows when a Dice Alley link is pasted into WhatsApp / Discord / iMessage
// / Twitter, so every shared link doubles as an ad.

export const runtime = "edge"
export const alt = "Dice Alley — Game night, anywhere"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1424 0%, #16284d 55%, #1d3a6b 100%)",
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* glow blobs */}
        <div style={{ position: "absolute", top: -120, left: -80, width: 420, height: 420, borderRadius: 999, background: "rgba(59,130,246,0.45)", filter: "blur(60px)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: -140, right: -60, width: 460, height: 460, borderRadius: 999, background: "rgba(45,212,191,0.40)", filter: "blur(70px)", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 28 }}>
          <div style={{ width: 96, height: 96, borderRadius: 28, background: "linear-gradient(135deg,#3b82f6,#2dd4bf)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 60 }}>
            🎲
          </div>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>Dice Alley</div>
        </div>

        <div style={{ fontSize: 58, fontWeight: 800, display: "flex" }}>Game night, anywhere.</div>

        <div style={{ fontSize: 34, color: "rgba(255,255,255,0.75)", marginTop: 18, display: "flex" }}>
          10 games · voice chat · play free in your browser
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {["Free", "No installs", "Rally your crew"].map((t) => (
            <div key={t} style={{ display: "flex", fontSize: 26, padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}>
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
