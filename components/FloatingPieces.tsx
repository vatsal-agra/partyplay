"use client"

import { motion } from "framer-motion"

// Ambient game pieces drifting behind the hero — gives the page a sense of life
// and motion. Purely decorative, non-interactive, sits behind content.
const PIECES = [
  { e: "🎲", x: "8%", y: "18%", s: 44, d: 7 },
  { e: "🃏", x: "82%", y: "12%", s: 38, d: 9 },
  { e: "♟️", x: "18%", y: "72%", s: 34, d: 8 },
  { e: "🎯", x: "90%", y: "62%", s: 40, d: 10 },
  { e: "🏆", x: "70%", y: "80%", s: 36, d: 7.5 },
  { e: "🧩", x: "40%", y: "10%", s: 30, d: 11 },
  { e: "⭐", x: "55%", y: "85%", s: 26, d: 6.5 },
  { e: "🎮", x: "5%", y: "45%", s: 32, d: 9.5 },
]

export function FloatingPieces() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-0 overflow-hidden" aria-hidden>
      {PIECES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute select-none opacity-20"
          style={{ left: p.x, top: p.y, fontSize: p.s }}
          animate={{ y: [0, -22, 0], rotate: [0, i % 2 ? 12 : -12, 0] }}
          transition={{ duration: p.d, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
        >
          {p.e}
        </motion.span>
      ))}
    </div>
  )
}
