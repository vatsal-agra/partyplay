// Poker — table container. Renders the real-time 3D casino table (loaded
// client-only) with overlay HUD: live feed, betting controls, hand-result
// banner and a full-board game-over screen. All rules flow through the pure
// engine; this component wires actions and presentation.
"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  PokerState, fold, checkCall, raiseTo, allIn, nextHand, playBotStep,
  initializeGame, getPlayerName,
} from "../lib/pokerEngine"
import { Confetti } from "@/components/Confetti"
import { Loader2, Trophy, Crown, RotateCcw, Share2, Eye, LogOut } from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const PokerScene3D = dynamic(() => import("./PokerScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0e0a08]">
      <div className="flex flex-col items-center gap-3 text-[#e6b45a]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Shuffling up…</p>
      </div>
    </div>
  ),
})

interface Props {
  state: PokerState
  currentPlayerId: string
  onStateChange: (s: PokerState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

export default function PokerBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [endDismissed, setEndDismissed] = useState(false)
  const [raiseAmt, setRaiseAmt] = useState("")   // custom raise-to amount
  const commit = (next: PokerState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const seatIndex = state.players.findIndex((p) => p.id === currentPlayerId)
  const isSpectator = seatIndex === -1
  const meIndex = Math.max(0, seatIndex)
  const me = state.players[meIndex]
  const inBetting = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(state.stage)
  const isMyTurn = !isSpectator && inBetting && state.players[state.currentPlayerIndex]?.id === currentPlayerId
  const amHost = !isSpectator && state.players[0]?.id === currentPlayerId
  const reveal = state.stage === 'HAND_OVER' && !!state.winningDesc
  const toCall = state.currentBet - (me?.bet ?? 0)

  useEffect(() => {
    if (state.stage !== 'GAME_OVER') setEndDismissed(false)
  }, [state.stage])

  // Bot driver — depends on full state so no stale snapshots commit.
  useEffect(() => {
    if (state.stage === 'GAME_OVER' || isSpectator) return
    const cur = state.players[state.currentPlayerIndex]
    if (inBetting && cur?.isBot) {
      // slow enough to actually follow the action around the table
      const t = setTimeout(() => commit(playBotStep(state)), 1600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isSpectator])

  // Host advances to the next hand automatically.
  useEffect(() => {
    if (state.stage === 'HAND_OVER' && amHost) {
      const t = setTimeout(() => commit(nextHand(state)), 4000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, amHost])

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))))
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: '#0e0a08' }}>
      <PokerScene3D state={state} meIndex={meIndex} isSpectator={isSpectator} reveal={reveal} />
      <Confetti fire={state.stage === 'GAME_OVER' && state.winnerIds.includes(currentPlayerId)} />

      {/* live feed */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex w-[280px] max-w-[46%] flex-col gap-1">
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

      {/* stage + hand chip */}
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-col items-end gap-1.5">
        <span className="rounded-full border border-[#e6b45a]/40 bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#f2d492] backdrop-blur" style={{ fontFamily: SERIF }}>
          ♠ Texas Hold&apos;em
        </span>
        <span className="rounded-full border border-[#e6b45a]/30 bg-black/55 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#e6b45a] backdrop-blur">
          Hand #{state.handNumber} · {state.stage.replace('_', ' ')} · Blinds {state.smallBlind}/{state.bigBlind}
        </span>
        {isSpectator && (
          <span className="rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] text-white/60 backdrop-blur">👁 Spectating</span>
        )}
      </div>

      {/* showdown / hand-over banner */}
      <AnimatePresence>
        {state.stage === 'HAND_OVER' && state.winnerIds.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -12, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center">
            <div className="rounded-2xl border border-[#e6b45a]/50 bg-black/75 px-6 py-3 text-center backdrop-blur">
              <p className="text-base font-black text-[#f2d492]" style={{ fontFamily: SERIF }}>
                💰 {state.winnerIds.map((id) => getPlayerName(state, id)).join(' & ')} {state.winnerIds.length > 1 ? 'split' : 'takes'} the pot
              </p>
              {state.winningDesc && <p className="mt-0.5 text-xs font-bold text-white/70">with {state.winningDesc}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* betting controls */}
      <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center">
        {isMyTurn && me ? (
          <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#e6b45a]/25 bg-black/70 p-2.5 backdrop-blur">
            <button onClick={() => commit(fold(state, currentPlayerId))}
              className="rounded-xl bg-rose-700/90 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-rose-600 active:scale-95">
              Fold
            </button>
            <button onClick={() => commit(checkCall(state, currentPlayerId))}
              className="rounded-xl bg-white/15 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-white/25 active:scale-95">
              {toCall <= 0 ? 'Check' : `Call ${Math.min(toCall, me.chips)}`}
            </button>
            {me.chips > toCall && (() => {
              const minTo = state.currentBet + state.minRaise
              const maxTo = me.bet + me.chips              // all-in ceiling
              const doRaise = (v: number) => { commit(raiseTo(state, currentPlayerId, Math.max(minTo, Math.min(maxTo, v)))); setRaiseAmt("") }
              const typed = parseInt(raiseAmt)
              return (
                <>
                  <button onClick={() => doRaise(minTo)}
                    className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-emerald-600 active:scale-95">
                    Raise {minTo}
                  </button>
                  {maxTo > state.currentBet + state.pot && (
                    <button onClick={() => doRaise(state.currentBet + state.pot)}
                      className="rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-black uppercase text-white transition hover:bg-emerald-700 active:scale-95">
                      Pot
                    </button>
                  )}
                  {/* custom raise-to amount */}
                  <div className="flex items-center gap-1 rounded-xl border border-emerald-600/40 bg-black/40 px-1 py-1">
                    <input
                      type="number" inputMode="numeric" value={raiseAmt}
                      onChange={(e) => setRaiseAmt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !isNaN(typed)) doRaise(typed) }}
                      placeholder={`${minTo}–${maxTo}`} min={minTo} max={maxTo}
                      className="w-24 bg-transparent px-2 py-1.5 text-xs font-bold text-white placeholder-white/30 focus:outline-none"
                    />
                    <button
                      disabled={isNaN(typed) || typed < minTo}
                      onClick={() => doRaise(typed)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-black uppercase text-white transition hover:bg-emerald-500 disabled:opacity-40">
                      Raise to
                    </button>
                  </div>
                </>
              )
            })()}
            <button onClick={() => commit(allIn(state, currentPlayerId))}
              className="rounded-xl bg-gradient-to-r from-[#b8860b] to-[#e6b45a] px-4 py-2.5 text-xs font-black uppercase text-[#1a120a] transition hover:brightness-110 active:scale-95">
              All-in
            </button>
          </motion.div>
        ) : (
          <div className="pointer-events-none rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] italic text-white/50 backdrop-blur">
            {state.stage === 'GAME_OVER' ? 'Game over'
              : inBetting ? `${state.players[state.currentPlayerIndex]?.name} is acting…`
              : state.stage === 'HAND_OVER' ? 'Next hand starting…'
              : ''}
          </div>
        )}
      </div>

      {/* my seat panel — fixed in the corner instead of floating over the felt */}
      {!isSpectator && me && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-2xl border border-[#e6b45a]/35 bg-black/65 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white" style={{ fontFamily: SERIF }}>{me.name}</span>
            {meIndex === state.dealerIndex && <span className="rounded bg-[#f2efe4] px-1 text-[9px] font-black text-[#1a120a]">D</span>}
            {meIndex === state.smallBlindIndex && <span className="rounded bg-[#3558c9] px-1 text-[9px] font-black text-white">SB</span>}
            {meIndex === state.bigBlindIndex && <span className="rounded bg-[#d9453a] px-1 text-[9px] font-black text-white">BB</span>}
          </div>
          <div className="mt-0.5 font-mono text-[13px] font-black text-[#e6b45a]">
            🪙 {me.chips.toLocaleString()}
            {me.bet > 0 && <span className="text-[#7fd6a8]"> · bet {me.bet}</span>}
            {me.allIn && !me.busted && <span className="text-[#ff7a6a]"> · ALL-IN</span>}
            {me.folded && !me.busted && <span className="text-white/45"> · folded</span>}
          </div>
        </div>
      )}

      {/* orbit hint */}
      <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/35 backdrop-blur lg:block">
        drag to orbit · scroll to zoom
      </div>

      {/* full-board game-over screen */}
      <AnimatePresence>
        {state.stage === 'GAME_OVER' && !endDismissed && (
          <PokerEndScreen state={state} currentPlayerId={currentPlayerId}
            canRematch={!isSpectator} onRematch={handleRematch} onDismiss={() => setEndDismissed(true)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.stage === 'GAME_OVER' && endDismissed && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-12 z-20 flex justify-center">
            <button onClick={() => setEndDismissed(false)}
              className="flex items-center gap-2 rounded-full border border-[#e6b45a]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#f2d492] backdrop-blur transition hover:bg-black/85"
              style={{ fontFamily: SERIF }}>
              <Trophy className="h-4 w-4" /> {state.winnerIds[0] ? getPlayerName(state, state.winnerIds[0]) : 'Nobody'} takes the table! — show results
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Full-board game-over screen ---------------------------------------------------

function PokerEndScreen({ state, currentPlayerId, canRematch, onRematch, onDismiss }: {
  state: PokerState
  currentPlayerId: string
  canRematch: boolean
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const ranked = [...state.players].sort((a, b) => {
    if (a.busted !== b.busted) return a.busted ? 1 : -1
    return b.chips - a.chips
  })
  const winner = ranked[0]
  const youWon = winner.id === currentPlayerId
  const medals = ['🥇', '🥈', '🥉']

  const share = async () => {
    const rows = ranked.slice(0, 4).map((p, i) =>
      `${medals[i] || `${i + 1}.`} ${p.name} — ${p.busted ? 'busted' : p.chips.toLocaleString() + ' chips'}`).join('\n')
    const text = `♠ Poker night on Dice Alley\n👑 ${winner.name} takes the table!\n\n${rows}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Poker — Dice Alley', text })
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
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#e6b45a]">Poker — Table Closed</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? '🎉 You take the table!' : <>{winner.name} <span className="text-[#f2d492]">takes the table!</span></>}
          </h2>
          <p className="mt-1 text-xs text-white/50">{state.handNumber} hands played</p>
        </motion.div>

        <div className="flex w-full max-w-md flex-col gap-2">
          {ranked.map((p, i) => {
            const isMe = p.id === currentPlayerId
            const isWinner = i === 0
            return (
              <motion.div key={p.id}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.07 }}
                className={`flex items-center gap-3 rounded-xl border p-3 ${
                  isWinner ? 'border-2 border-[#e6b45a]/70 bg-gradient-to-b from-[#2a2013]/95 to-[#1a130c]/95 shadow-[0_0_50px_-12px_rgba(230,180,90,0.5)]'
                  : isMe ? 'border-[#e6b45a]/30 bg-[#e6b45a]/10' : 'border-white/10 bg-black/40'
                }`}>
                <span className="w-7 text-center text-lg">{medals[i] || <span className="text-sm text-white/40">{i + 1}</span>}</span>
                <div className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-lg">
                  ♠{isWinner && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-[#e6b45a]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white" style={{ fontFamily: SERIF }}>
                    {p.name}
                    {p.isBot && <span className="ml-1.5 rounded bg-[#e6b45a]/20 px-1 py-0.5 text-[7px] font-bold text-[#f2d492]">AI</span>}
                    {isMe && <span className="ml-1.5 text-[9px] font-bold text-[#f2d492]">(you)</span>}
                  </p>
                </div>
                <p className={`font-mono text-sm font-black ${p.busted ? 'text-rose-400' : 'text-[#e6b45a]'}`}>
                  {p.busted ? 'BUSTED' : `${p.chips.toLocaleString()} 🪙`}
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
