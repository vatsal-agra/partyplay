// Color Clash — board UI. Hand, discard/draw piles, colour & direction
// indicators, wild colour picker, and a bot driver for solo play.
"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  UnoState, Card, Color, Value, COLORS,
  canPlay, playCard, chooseColor, drawCard, passTurn, playBotStep, symbolFor, getPlayerName,
} from "../lib/unoEngine"
import { RotateCw, RotateCcw, Trophy, Layers } from "lucide-react"

interface Props {
  state: UnoState
  currentPlayerId: string
  onStateChange: (s: UnoState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

const HEX: Record<string, string> = { red: '#dc2626', yellow: '#f59e0b', green: '#16a34a', blue: '#2563eb' }

function CardFace({ card, small }: { card: Card; small?: boolean }) {
  const wild = card.color === 'wild'
  const dim = small ? 'w-10 h-14 text-sm' : 'w-16 h-24 text-2xl'
  return (
    <div className={`${dim} rounded-lg flex items-center justify-center font-black text-white border-2 border-white/80 shadow-lg relative overflow-hidden`}
      style={wild ? { background: 'conic-gradient(#dc2626,#f59e0b,#16a34a,#2563eb,#dc2626)' } : { backgroundColor: HEX[card.color] }}>
      <span className="absolute inset-0 rounded-lg bg-white/10" />
      <span className="relative drop-shadow">{symbolFor(card.value)}</span>
    </div>
  )
}

function CardBack({ small }: { small?: boolean }) {
  const dim = small ? 'w-8 h-12' : 'w-16 h-24'
  return (
    <div className={`${dim} rounded-lg border-2 border-white/40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow`}>
      <span className="text-bubble-400 font-black text-[10px] rotate-[-20deg]">CC</span>
    </div>
  )
}

export default function UnoBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const commit = (next: UnoState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const meIndex = Math.max(0, state.players.findIndex((p) => p.id === currentPlayerId))
  const me = state.players[meIndex]
  const isMyTurn = state.players[state.currentPlayerIndex].id === currentPlayerId && !state.winnerId
  const topCard = state.discardPile[state.discardPile.length - 1]
  const opponents = state.players.filter((_, i) => i !== meIndex)
  const choosingColor = state.phase === 'CHOOSE_COLOR' && isMyTurn

  // Bot driver
  useEffect(() => {
    if (state.winnerId) return
    const cur = state.players[state.currentPlayerIndex]
    if (cur.isBot && state.phase === 'PLAY') {
      const t = setTimeout(() => commit(playBotStep(state)), 900)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.phase, state.winnerId, state.pendingDrawnCardId])

  const playableId = (c: Card) => {
    if (!isMyTurn || state.phase !== 'PLAY') return false
    if (state.pendingDrawnCardId) return c.id === state.pendingDrawnCardId && canPlay(c, topCard.value, state.activeColor)
    return canPlay(c, topCard.value, state.activeColor)
  }

  const onPlay = (c: Card) => {
    if (!playableId(c)) return
    // Wild: let engine move to CHOOSE_COLOR (no colour yet).
    commit(playCard(state, currentPlayerId, c.id))
  }

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-slate-950 select-none p-3 gap-2">
      {/* Opponents */}
      <div className="flex items-start justify-center gap-3 flex-wrap">
        {opponents.map((p) => {
          const isCur = state.players[state.currentPlayerIndex].id === p.id
          return (
            <div key={p.id} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl border ${isCur ? 'bg-bubble-500/20 border-bubble-500/50' : 'bg-white/5 border-white/10'}`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-white">{p.name}{p.isBot && <span className="ml-1 text-[7px] bg-bubble-500/20 text-bubble-300 px-1 rounded">AI</span>}</span>
                {p.hand.length === 1 && <span className="text-[8px] font-black text-sunny-400 animate-pulse">UNO!</span>}
              </div>
              <div className="flex -space-x-4">
                {p.hand.slice(0, 7).map((_, i) => <CardBack key={i} small />)}
                {p.hand.length > 7 && <span className="text-[9px] text-slate-400 self-end ml-5">+{p.hand.length - 7}</span>}
              </div>
              <span className="text-[9px] text-slate-400 font-mono">{p.hand.length} cards</span>
            </div>
          )
        })}
      </div>

      {/* Center: piles + status */}
      <div className="flex-1 flex items-center justify-center gap-8 min-h-0">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            disabled={!isMyTurn || state.phase !== 'PLAY' || !!state.pendingDrawnCardId}
            onClick={() => commit(drawCard(state, currentPlayerId))}
            className="relative disabled:opacity-60 disabled:cursor-default hover:-translate-y-0.5 transition">
            <CardBack />
            <Layers className="w-4 h-4 text-white/70 absolute -top-1 -right-1" />
          </button>
          <span className="text-[9px] text-slate-500 uppercase tracking-wider">Draw</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          {/* active colour + direction */}
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest">Colour</span>
            <span className="w-5 h-5 rounded-full border-2 border-white/50" style={{ background: state.activeColor === 'wild' ? '#666' : HEX[state.activeColor] }} />
            {state.direction === 1 ? <RotateCw className="w-4 h-4 text-slate-400" /> : <RotateCcw className="w-4 h-4 text-slate-400" />}
          </div>
          {/* discard top */}
          <motion.div key={topCard.id} initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}>
            <CardFace card={topCard} />
          </motion.div>
          <span className="text-[10px] text-slate-400 h-4">{state.lastAction}</span>
        </div>
      </div>

      {/* Turn banner */}
      <div className="text-center">
        <span className={`text-xs font-bold ${isMyTurn ? 'text-bubble-400' : 'text-slate-400'}`}>
          {state.winnerId ? '' : isMyTurn ? (state.pendingDrawnCardId ? 'Play the drawn card or pass.' : 'Your turn — play or draw.') : `${state.players[state.currentPlayerIndex].name} is playing…`}
        </span>
      </div>

      {/* My hand */}
      <div className="flex-shrink-0">
        <div className="flex items-end justify-center gap-1.5 flex-wrap pb-1 min-h-[100px]">
          {me?.hand.map((c) => {
            const ok = playableId(c)
            return (
              <button key={c.id} onClick={() => onPlay(c)} disabled={!ok}
                className={`transition-transform ${ok ? 'hover:-translate-y-3 cursor-pointer' : 'opacity-50 cursor-default'}`}>
                <CardFace card={c} />
              </button>
            )
          })}
        </div>
        {isMyTurn && state.pendingDrawnCardId && (
          <div className="text-center mt-1">
            <button onClick={() => commit(passTurn(state, currentPlayerId))}
              className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg">Pass</button>
          </div>
        )}
      </div>

      {/* Colour picker overlay */}
      <AnimatePresence>
        {choosingColor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 text-center">
              <h3 className="text-sm font-black text-white mb-3">Choose a colour</h3>
              <div className="grid grid-cols-2 gap-3">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => commit(chooseColor(state, c))}
                    className="w-20 h-20 rounded-xl border-2 border-white/60 hover:scale-105 transition" style={{ backgroundColor: HEX[c] }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Winner overlay */}
      <AnimatePresence>
        {state.winnerId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="bg-slate-900 border border-bubble-500/30 rounded-2xl p-6 text-center shadow-2xl">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h2 className="text-xl font-black text-white">{getPlayerName(state, state.winnerId)} wins!</h2>
              <p className="text-xs text-slate-400 mt-1">All cards played. 🎉</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
