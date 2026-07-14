"use client"

import { useEffect, useState } from "react"
import { Laptop, TabletSmartphone } from "lucide-react"

// Dice Alley's 3D tables need real screen real-estate + a precise pointer, so
// phones are blocked with a friendly notice. Tablets and laptops pass through.
// Detection: a coarse pointer (touch) AND a small shortest-viewport-edge —
// phones are ~360–430px on their short edge in any orientation, tablets ~768+.
export function MobileGate() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const check = () => {
      const coarse = window.matchMedia("(pointer: coarse)").matches
      const shortEdge = Math.min(window.innerWidth, window.innerHeight)
      setBlocked(coarse && shortEdge < 600)
    }
    check()
    window.addEventListener("resize", check)
    window.addEventListener("orientationchange", check)
    return () => {
      window.removeEventListener("resize", check)
      window.removeEventListener("orientationchange", check)
    }
  }, [])

  if (!blocked) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-[#140d07] p-6 text-center">
      <div className="aurora pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative max-w-sm">
        <div className="mx-auto mb-5 flex items-center justify-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#6b5230]/50 bg-black/40 text-[#e6b45a]">
            <Laptop className="h-7 w-7" />
          </span>
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-[#6b5230]/50 bg-black/40 text-[#e6b45a]">
            <TabletSmartphone className="h-7 w-7" />
          </span>
        </div>
        <h1 className="text-2xl font-black text-white" style={{ fontFamily: "var(--font-display), Georgia, serif" }}>
          Built for the big screen
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Dice Alley&apos;s 3D game tables need the room and precision of a{" "}
          <span className="font-bold text-[#e6b45a]">laptop or tablet</span>. Pop back open on a bigger
          screen and your game night&apos;s ready to roll. 🎲
        </p>
        <p className="mt-4 text-[11px] uppercase tracking-widest text-white/35">A mobile app is on the roadmap</p>
      </div>
    </div>
  )
}
