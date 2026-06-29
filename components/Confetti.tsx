"use client"

import { useEffect, useRef } from "react"

// Dependency-free canvas confetti burst. Runs for a few seconds then stops on
// its own. Pointer-events:none so it never blocks the UI underneath.
export function Confetti({ fire = true, durationMs = 4000 }: { fire?: boolean; durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!fire) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const colors = ["#3b82f6", "#38d4ff", "#2dd4bf", "#34e0a1", "#ef4444", "#60a5fa"]
    let w = (canvas.width = canvas.offsetWidth)
    let h = (canvas.height = canvas.offsetHeight)

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    window.addEventListener("resize", onResize)

    type P = { x: number; y: number; r: number; c: string; vx: number; vy: number; rot: number; vr: number }
    const count = Math.min(180, Math.floor(w / 6))
    const parts: P[] = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.5,
      r: 4 + Math.random() * 6,
      c: colors[(Math.random() * colors.length) | 0],
      vx: -1.5 + Math.random() * 3,
      vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI,
      vr: -0.15 + Math.random() * 0.3,
    }))

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      ctx.clearRect(0, 0, w, h)
      const fade = elapsed > durationMs - 800 ? Math.max(0, (durationMs - elapsed) / 800) : 1
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.03
        p.rot += p.vr
        if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w }
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.c
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6)
        ctx.restore()
      }
      if (elapsed < durationMs) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w, h)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [fire, durationMs])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  )
}
