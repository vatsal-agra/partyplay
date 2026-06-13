"use client"

import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Crown, Check, ThumbsUp, Users, Clock, Play } from "lucide-react"

import { Game } from "@/app/types"

type GameCardProps = {
  game: Game
  onPlay: () => void
  isInParty: boolean
  isCreatingParty: boolean
  // Voting mode (only active when the viewer is in a party)
  votingEnabled?: boolean
  voteCount?: number
  voters?: string[]
  hasVoted?: boolean
  isLeading?: boolean
  onVote?: () => void
}

const complexityColor: Record<string, string> = {
  Easy: "bg-mint-500/20 text-mint-500",
  Medium: "bg-sunny-500/20 text-sunny-400",
  Hard: "bg-bubble-500/20 text-bubble-400",
}

export function GameCard({
  game,
  onPlay,
  isInParty,
  isCreatingParty,
  votingEnabled = false,
  voteCount = 0,
  voters = [],
  hasVoted = false,
  isLeading = false,
  onVote,
}: GameCardProps) {
  const { name, description, minPlayers, maxPlayers, image, complexity, duration } = game
  const highlight = votingEnabled && isLeading && voteCount > 0

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card/70 backdrop-blur-xl transition-colors duration-300 ${
        highlight
          ? "border-sunny-400/60 shadow-glow-sunny"
          : votingEnabled && hasVoted
            ? "border-grape-400/70 shadow-glow-grape"
            : "border-white/10 hover:border-white/25"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={image}
          alt={name}
          width={400}
          height={250}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.onerror = null
            target.src = `https://via.placeholder.com/400x250/1a1430/ffffff?text=${encodeURIComponent(name)}`
          }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

        {/* Leading crown */}
        <AnimatePresence>
          {highlight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-sunny-400 px-2.5 py-1 text-xs font-extrabold text-yellow-950 shadow-lg"
            >
              <Crown className="h-3.5 w-3.5" />
              Leading
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top-right badge */}
        {votingEnabled ? (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
            <ThumbsUp className="h-3.5 w-3.5 text-aqua-400" />
            <AnimatePresence mode="popLayout">
              <motion.span key={voteCount} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}>
                {voteCount}
              </motion.span>
            </AnimatePresence>
          </div>
        ) : (
          isInParty && (
            <div className="absolute right-3 top-3 rounded-full bg-mint-500 px-2.5 py-1 text-xs font-bold text-emerald-950">
              In Party
            </div>
          )
        )}

        {/* Title over image */}
        <h3 className="absolute bottom-3 left-4 right-4 font-display text-xl font-bold text-white drop-shadow">
          {name}
        </h3>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-white/90">
            <Users className="h-3.5 w-3.5 text-aqua-400" />
            {minPlayers}-{maxPlayers}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-white/90">
            <Clock className="h-3.5 w-3.5 text-grape-300" />
            {duration}
          </span>
          <span className={`rounded-full px-2.5 py-1 ${complexityColor[complexity] ?? "bg-white/8 text-white/90"}`}>
            {complexity}
          </span>
        </div>

        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>

        {votingEnabled && voters.length > 0 && (
          <p className="mb-3 truncate text-xs text-grape-200/80">
            🗳️ {voters.slice(0, 3).join(", ")}
            {voters.length > 3 ? ` +${voters.length - 3} more` : ""}
          </p>
        )}

        <div className="mt-auto pt-1">
          {votingEnabled ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onVote?.()
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-[0.97] ${
                hasVoted
                  ? "bg-brand text-white shadow-glow-grape"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {hasVoted ? (
                <>
                  <Check className="h-4 w-4" /> Voted
                </>
              ) : (
                <>
                  <ThumbsUp className="h-4 w-4" /> Vote
                </>
              )}
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPlay()
              }}
              disabled={isCreatingParty}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-200 active:scale-[0.97] disabled:opacity-50 ${
                isInParty
                  ? "bg-gradient-to-r from-mint-500 to-aqua-500 text-emerald-950"
                  : "bg-brand hover:brightness-110"
              }`}
            >
              <Play className="h-4 w-4" />
              {isCreatingParty ? "Creating..." : isInParty ? "Join Party" : "Play Now"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
