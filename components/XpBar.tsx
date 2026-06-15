"use client"

import { motion } from "framer-motion"
import { levelProgress } from "@/lib/progression"

// Level badge + animated XP progress bar.
export function XpBar({ xp, className = "" }: { xp: number; className?: string }) {
  const p = levelProgress(xp)
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-black text-white shadow-glow-grape">
            {p.level}
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">{p.title}</p>
            <p className="text-[11px] text-white/50">Level {p.level}</p>
          </div>
        </div>
        <p className="text-[11px] text-white/50">{p.toNext} XP to L{p.level + 1}</p>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: 0 }}
          animate={{ width: `${p.pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}
