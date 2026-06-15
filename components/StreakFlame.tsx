"use client"

import { motion } from "framer-motion"

// Daily-streak flame. Glows brighter the longer the streak; goes cold at 0.
export function StreakFlame({ streak, className = "" }: { streak: number; className?: string }) {
  const alive = streak > 0
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <motion.span
        className="text-2xl"
        style={{ filter: alive ? "none" : "grayscale(1) opacity(0.5)" }}
        animate={alive ? { scale: [1, 1.15, 1], rotate: [0, -4, 4, 0] } : {}}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        🔥
      </motion.span>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">
          {alive ? `${streak}-day streak` : "No streak yet"}
        </p>
        <p className="text-[11px] text-white/50">
          {alive ? "Play today to keep it alive" : "Play a game to start one"}
        </p>
      </div>
    </div>
  )
}
