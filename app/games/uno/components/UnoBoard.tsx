// Color Clash — board container. Renders the real-time 3D card table (loaded
// client-only) with overlay HUD: live feed, turn banner, pass control, wild
// colour picker and a full-board victory screen. All rules flow through the
// pure engine; this component wires interaction and presentation.
"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  UnoState, Card, COLORS,
  canPlay, playCard, chooseColor, drawCard, passTurn, playBotStep,
  initializeGame, getPlayerName,
} from "../lib/unoEngine"
import { UNO_HEX } from "./UnoScene3D"
import { Confetti } from "@/components/Confetti"
import { Loader2, Trophy, Crown, RotateCcw, Share2, Eye, LogOut, RotateCw } from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const UnoScene3D = dynamic(() => import("./UnoScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0b10]">
      <div className="flex flex-col items-center gap-3 text-[#ffd76a]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Dealing the deck…</p>
      </div>
    </div>
  ),
})

interface Props {
  state: UnoState
  currentPlayerId: string
  onStateChange: (s: UnoState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

export default function UnoBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [endDismissed, setEndDismissed] = useState(false)
  const commit = (next: UnoState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const seatIndex = state.players.findIndex((p) => p.id === currentPlayerId)
  const isSpectator = seatIndex === -1
  const meIndex = Math.max(0, seatIndex)
  const me = state.players[meIndex]
  const isMyTurn = !isSpectator && state.players[state.currentPlayerIndex].id === currentPlayerId && !state.winnerId
  const topCard = state.discardPile[state.discardPile.length - 1]
  const choosingColor = state.phase === 'CHOOSE_COLOR' && isMyTurn

  useEffect(() => {
    if (!state.winnerId) setEndDismissed(false)
  }, [state.winnerId])

  // Bot driver — full-state deps so no stale snapshots commit.
  useEffect(() => {
    if (state.winnerId || isSpectator) return
    const cur = state.players[state.currentPlayerIndex]
    if (cur.isBot && state.phase === 'PLAY') {
      const t = setTimeout(() => commit(playBotStep(state)), 1000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isSpectator])

  const isPlayable = (c: Card) => {
    if (!isMyTurn || state.phase !== 'PLAY') return false
    if (state.pendingDrawnCardId) return c.id === state.pendingDrawnCardId && canPlay(c, topCard.value, state.activeColor)
    return canPlay(c, topCard.value, state.activeColor)
  }
  const playableIds = new Set((me?.hand ?? []).filter(isPlayable).map((c) => c.id))

  const handlePlay = (cardId: string) => {
    const c = me?.hand.find((x) => x.id === cardId)
    if (!c || !isPlayable(c)) return
    // Wild: engine moves to CHOOSE_COLOR (colour picked in the dialog).
    commit(playCard(state, currentPlayerId, c.id))
  }

  const canDraw = isMyTurn && state.phase === 'PLAY' && !state.pendingDrawnCardId

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))))
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: '#0a0b10' }}>
      <UnoScene3D
        state={state}
        meIndex={meIndex}
        isSpectator={isSpectator}
        isMyTurn={isMyTurn}
        playableIds={playableIds}
        canDraw={canDraw}
        onPlayCard={handlePlay}
        onDraw={() => commit(drawCard(state, currentPlayerId))}
      />
      <Confetti fire={!!state.winnerId && state.winnerId === currentPlayerId} />

      {/* live feed */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex w-[270px] max-w-[46%] flex-col gap-1">
        <AnimatePresence initial={false}>
          {state.log.slice(-4).reverse().map((msg, i) => (
            <motion.div
              key={msg + (state.log.length - i)}
              layout
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: i === 0 ? 1 : 0.55 - i * 0.1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
              className="rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[10px] leading-snug text-white/90 backdrop-blur"
            >
              {msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* active colour + direction chip */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/45">Colour</span>
          <span className="h-4 w-4 rounded-full border-2 border-white/60" style={{ backgroundColor: UNO_HEX[state.activeColor] || '#666' }} />
          <RotateCw className={`h-3.5 w-3.5 text-white/60 ${state.direction === -1 ? 'scale-x-[-1]' : ''}`} />
        </div>
        {isSpectator && (
          <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] text-white/60 backdrop-blur">👁 Spectating</span>
        )}
      </div>

      {/* turn banner + pass */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2">
        {isMyTurn && state.pendingDrawnCardId && (
          <button onClick={() => commit(passTurn(state, currentPlayerId))}
            className="pointer-events-auto rounded-xl bg-white/15 px-5 py-2 text-xs font-black uppercase text-white backdrop-blur transition hover:bg-white/25 active:scale-95">
            Pass
          </button>
        )}
        <div className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] backdrop-blur">
          {state.winnerId ? (
            <span className="text-white/50">Game over</span>
          ) : isMyTurn ? (
            <span className="font-bold text-[#ffd76a]">
              {state.phase === 'CHOOSE_COLOR' ? 'Pick a colour!' : state.pendingDrawnCardId ? 'Play the drawn card or pass.' : 'Your turn — play a glowing card or tap the deck.'}
            </span>
          ) : (
            <span className="italic text-white/50">{state.players[state.currentPlayerIndex].name} is playing…</span>
          )}
        </div>
      </div>

      {/* orbit hint */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/35 backdrop-blur lg:block">
        drag to orbit · scroll to zoom
      </div>

      {/* wild colour picker */}
      <AnimatePresence>
        {choosingColor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="rounded-2xl border border-[#6b5230]/50 p-5 text-center shadow-2xl"
              style={{ background: 'linear-gradient(160deg,#22222b,#16161d)' }}>
              <h3 className="mb-4 text-base font-black text-white" style={{ fontFamily: SERIF }}>🌈 Choose a colour</h3>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => commit(chooseColor(state, c))}
                    className="h-20 w-20 rounded-2xl border-2 border-white/60 shadow-lg transition hover:scale-110 hover:border-white active:scale-95"
                    style={{ backgroundColor: UNO_HEX[c], boxShadow: `0 0 24px -6px ${UNO_HEX[c]}` }} />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* full-board victory screen */}
      <AnimatePresence>
        {state.winnerId && !endDismissed && (
          <UnoEndScreen state={state} currentPlayerId={currentPlayerId}
            canRematch={!isSpectator} onRematch={handleRematch} onDismiss={() => setEndDismissed(true)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.winnerId && endDismissed && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-12 z-20 flex justify-center">
            <button onClick={() => setEndDismissed(false)}
              className="flex items-center gap-2 rounded-full border border-[#ffd76a]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#ffd76a] backdrop-blur transition hover:bg-black/85"
              style={{ fontFamily: SERIF }}>
              <Trophy className="h-4 w-4" /> {getPlayerName(state, state.winnerId)} wins! — show results
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Full-board victory screen -------------------------------------------------------

function UnoEndScreen({ state, currentPlayerId, canRematch, onRematch, onDismiss }: {
  state: UnoState
  currentPlayerId: string
  canRematch: boolean
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const ranked = [...state.players].sort((a, b) => {
    if (a.id === state.winnerId) return -1
    if (b.id === state.winnerId) return 1
    return a.hand.length - b.hand.length
  })
  const winner = ranked[0]
  const youWon = state.winnerId === currentPlayerId
  const medals = ['🥇', '🥈', '🥉']

  const share = async () => {
    const rows = ranked.slice(0, 4).map((p, i) =>
      `${medals[i] || `${i + 1}.`} ${p.name} — ${p.id === state.winnerId ? 'all cards played!' : `${p.hand.length} cards left`}`).join('\n')
    const text = `🎴 Color Clash on Dice Alley\n👑 ${winner.name} wins!\n\n${rows}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Color Clash — Dice Alley', text })
      else await navigator.clipboard.writeText(text)
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch { /* cancelled */ }
  }

  const leave = () => {
    const pid = new URLSearchParams(window.location.search).get('partyId')
    window.location.href = pid && pid !== 'mock-party-id' ? `/party/${pid}` : '/games'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-black/85 via-black/60 to-black/85 backdrop-blur-[3px]">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#ffd76a]">Color Clash — Game Over</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? '🎉 You cleared your hand!' : <>{winner.name} <span className="text-[#ffd76a]">wins!</span></>}
          </h2>
        </motion.div>

        <div className="flex w-full max-w-md flex-col gap-2">
          {ranked.map((p, i) => {
            const isMe = p.id === currentPlayerId
            const isWinner = p.id === state.winnerId
            return (
              <motion.div key={p.id}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.07 }}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isWinner ? 'border-2 border-[#ffd76a]/70 bg-gradient-to-b from-[#26221a]/95 to-[#17140f]/95 shadow-[0_0_50px_-12px_rgba(255,215,106,0.5)]'
                  : isMe ? 'border-[#ffd76a]/30 bg-[#ffd76a]/10' : 'border-white/10 bg-black/40'
                }`}>
                <span className="w-7 text-center text-lg">{medals[i] || <span className="text-sm text-white/40">{i + 1}</span>}</span>
                <div className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-lg">
                  🎴{isWinner && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-[#ffd76a]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white" style={{ fontFamily: SERIF }}>
                    {p.name}
                    {p.isBot && <span className="ml-1.5 rounded bg-[#ffd76a]/20 px-1 py-0.5 text-[7px] font-bold text-[#ffd76a]">AI</span>}
                    {isMe && <span className="ml-1.5 text-[9px] font-bold text-[#ffd76a]">(you)</span>}
                  </p>
                </div>
                <p className={`font-mono text-sm font-black ${isWinner ? 'text-[#ffd76a]' : 'text-white/60'}`}>
                  {isWinner ? 'CLEARED! 🎉' : `${p.hand.length} left`}
                </p>
              </motion.div>
            )
          })}
        </div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          {canRematch && (
            <button onClick={onRematch}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
              <RotateCcw className="h-4 w-4" /> Rematch
            </button>
          )}
          <button onClick={share}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Share2 className="h-4 w-4" /> {shared ? 'Copied!' : 'Share'}
          </button>
          <button onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Eye className="h-4 w-4" /> View Table
          </button>
          <button onClick={leave}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase text-white/60 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Leave
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
