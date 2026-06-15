"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Confetti } from "@/components/Confetti"
import { getAchievement } from "@/lib/achievements"
import type { GameSummary } from "@/lib/gameSummary"
import { Trophy, RotateCcw, LogOut, Share2, Crown } from "lucide-react"
import { useState } from "react"

interface Props {
  gameName: string
  summary: GameSummary
  newAchievements: string[]   // ids earned this game (to celebrate)
  canRematch: boolean         // only the host can re-deal
  onRematch: () => void
  onLeave: () => void
}

export function GameOverScreen({ gameName, summary, newAchievements, canRematch, onRematch, onLeave }: Props) {
  const [shared, setShared] = useState(false)
  const medals = ["🥇", "🥈", "🥉"]

  const shareResult = async () => {
    const top = summary.standings.slice(0, 3).map((s, i) => `${medals[i] || `${i + 1}.`} ${s.name}${s.detail ? ` — ${s.detail}` : ""}`).join("\n")
    const text = `🎲 ${gameName} on PartyPlay\n🏆 ${summary.winnerLabel} wins!\n\n${top}\n\nPlay free at PartyPlay`
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${gameName} — PartyPlay`, text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch {
      /* user cancelled share — ignore */
    }
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <Confetti fire={summary.youWon} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="relative z-10 w-full max-w-md my-auto rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl"
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-4 text-center border-b border-white/10">
          <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-2xl bg-brand shadow-glow-grape">
            <Trophy className="h-7 w-7 text-white" />
          </div>
          <p className="text-[11px] uppercase tracking-widest text-white/50">{gameName} — Game Over</p>
          <h2 className="mt-1 text-2xl font-black text-white">
            {summary.youWon ? "🎉 You win!" : <>{summary.winnerLabel} <span className="text-white/80">wins!</span></>}
          </h2>
        </div>

        {/* Standings */}
        <div className="px-5 py-4">
          <div className="space-y-1.5 max-h-[34vh] overflow-y-auto pr-1">
            {summary.standings.map((s, i) => (
              <div
                key={s.id || s.name + i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  s.isWinner ? "bg-yellow-400/10 border border-yellow-300/30" : "bg-white/5"
                }`}
              >
                <span className="w-6 text-center text-sm">{medals[i] || <span className="text-white/50">{i + 1}</span>}</span>
                <span className="flex-1 truncate font-medium text-white flex items-center gap-1.5">
                  {s.name}
                  {s.isWinner && <Crown className="h-3.5 w-3.5 text-yellow-300" />}
                </span>
                {s.detail && <span className="text-sm text-white/60">{s.detail}</span>}
              </div>
            ))}
          </div>

          {/* Achievements earned this game */}
          {newAchievements.length > 0 && (
            <div className="mt-4 rounded-xl border border-grape-400/30 bg-grape-500/10 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-grape-200">
                🏅 Badge{newAchievements.length > 1 ? "s" : ""} unlocked
              </p>
              <div className="flex flex-wrap gap-2">
                {newAchievements.map((id) => {
                  const a = getAchievement(id)
                  if (!a) return null
                  return (
                    <div key={id} className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white" title={a.description}>
                      <span>{a.emoji}</span>
                      <span className="font-medium">{a.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 px-5 pb-5 sm:flex-row">
          {canRematch && (
            <Button onClick={onRematch} className="flex-1 bg-brand hover:brightness-110 font-bold">
              <RotateCcw className="mr-2 h-4 w-4" /> Rematch
            </Button>
          )}
          <Button onClick={shareResult} variant="outline" className="flex-1 text-white border-white/20 hover:bg-white/10">
            <Share2 className="mr-2 h-4 w-4" /> {shared ? "Copied!" : "Share"}
          </Button>
          <Button onClick={onLeave} variant="ghost" className="flex-1 text-white/70 hover:text-white hover:bg-white/10">
            <LogOut className="mr-2 h-4 w-4" /> Leave
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
