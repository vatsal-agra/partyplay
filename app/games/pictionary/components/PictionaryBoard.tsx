// Quick Draw — board UI. Live shared canvas in a wooden easel frame, letter-
// tile word display, urgency timer, juiced guess chat and scoreboard, and a
// full-board podium when the game ends. All drawing/guessing/host logic is
// unchanged — this is the presentation layer.
"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PictionaryState, ROUND_SECONDS, getPlayerName, initializeGame,
  submitGuess, endRound, nextRound,
} from "../lib/pictionaryEngine"
import { Confetti } from "@/components/Confetti"
import {
  Paintbrush, Eraser, Trash2, Pencil, Trophy, Users, Send, Crown,
  RotateCcw, Share2, LogOut,
} from "lucide-react"

export interface LiveEvent { type: 'draw' | 'clear'; payload?: DrawSeg; t: number }
interface DrawSeg { x0: number; y0: number; x1: number; y1: number; color: string; size: number }

interface Props {
  state: PictionaryState
  currentPlayerId: string
  onStateChange: (s: PictionaryState) => void
  onBroadcastAction?: (event: string, payload: any) => void
  liveEvent?: LiveEvent | null
}

const SERIF = "var(--font-display), Georgia, serif"
const CW = 900, CH = 620
const COLORS = ['#0b1220', '#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#ec4899', '#92400e']

export default function PictionaryBoard({ state, currentPlayerId, onStateChange, onBroadcastAction, liveEvent }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState('#0b1220')
  const [size, setSize] = useState(5)
  const [erase, setErase] = useState(false)
  const [guess, setGuess] = useState('')
  const [now, setNow] = useState(Date.now())
  const [endDismissed, setEndDismissed] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const me = state.players.find((p) => p.id === currentPlayerId)
  const drawer = state.players[state.drawerIndex]
  const isDrawer = drawer?.id === currentPlayerId
  const amHost = state.players[0]?.id === currentPlayerId
  const remaining = state.roundEndsAt ? Math.max(0, Math.round((state.roundEndsAt - now) / 1000)) : 0
  const urgent = state.phase === 'DRAWING' && remaining <= 10

  const commit = (next: PictionaryState) => {
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  // ---- Canvas helpers -------------------------------------------------------
  const ctx = () => canvasRef.current?.getContext('2d') ?? null
  const clearCanvas = () => {
    const c = ctx(); if (!c) return
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, CW, CH)
  }
  const paint = (seg: DrawSeg) => {
    const c = ctx(); if (!c) return
    c.strokeStyle = seg.color
    c.lineWidth = seg.size
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(seg.x0 * CW, seg.y0 * CH)
    c.lineTo(seg.x1 * CW, seg.y1 * CH)
    c.stroke()
  }

  // Initialize / clear on new round.
  useEffect(() => { clearCanvas() /* eslint-disable-next-line */ }, [state.roundNumber, state.phase === 'DRAWING'])

  // Apply remote draw/clear events (skip my own when I'm drawing locally).
  useEffect(() => {
    if (!liveEvent) return
    if (isDrawer) return
    if (liveEvent.type === 'clear') clearCanvas()
    else if (liveEvent.payload) paint(liveEvent.payload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent?.t])

  // Countdown ticker.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(i)
  }, [])

  // Host drives round progression.
  useEffect(() => {
    if (!amHost || state.winnerId) return
    if (state.phase === 'DRAWING' && state.roundEndsAt) {
      if (Date.now() >= state.roundEndsAt) { commit(endRound(state)); return }
      const t = setTimeout(() => commit(endRound(state)), Math.max(250, state.roundEndsAt - Date.now()))
      return () => clearTimeout(t)
    }
    if (state.phase === 'ROUND_END') {
      const t = setTimeout(() => commit(nextRound(state)), 4000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.roundNumber, state.roundEndsAt, amHost, state.winnerId])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state.chat])
  useEffect(() => { if (!state.winnerId) setEndDismissed(false) }, [state.winnerId])

  // ---- Pointer drawing (drawer only) ----------------------------------------
  const ptToNorm = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const canDraw = isDrawer && state.phase === 'DRAWING'
  const onDown = (e: React.PointerEvent) => {
    if (!canDraw) return
    drawing.current = true
    last.current = ptToNorm(e)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawing.current || !last.current) return
    const p = ptToNorm(e)
    const seg: DrawSeg = { x0: last.current.x, y0: last.current.y, x1: p.x, y1: p.y, color: erase ? '#ffffff' : color, size: erase ? 26 : size }
    paint(seg)
    onBroadcastAction?.('draw', seg)
    last.current = p
  }
  const onUp = () => { drawing.current = false; last.current = null }

  const handleClear = () => { clearCanvas(); onBroadcastAction?.('clear', {}) }

  const sendGuess = (e: React.FormEvent) => {
    e.preventDefault()
    const text = guess.trim()
    if (!text) return
    commit(submitGuess(state, currentPlayerId, text))
    setGuess('')
  }

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name }))))
  }

  // ---- Lobby (not enough players) -------------------------------------------
  if (state.phase === 'LOBBY') {
    return (
      <div className="flex h-full w-full items-center justify-center p-6" style={{ background: 'radial-gradient(1000px 700px at 50% 0%, #241a10, #140d08)' }}>
        <div className="glass max-w-sm rounded-2xl p-8 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-[#d6a85c]" />
          <h2 className="mb-2 text-xl font-black text-white" style={{ fontFamily: SERIF }}>Quick Draw needs 2+ players</h2>
          <p className="text-sm text-white/50">Invite a friend to the party to start sketching and guessing!</p>
        </div>
      </div>
    )
  }

  const sorted = [...state.players].sort((a, b) => b.score - a.score)

  return (
    <div className="relative flex h-full w-full select-none gap-2.5 overflow-hidden p-2 text-[#e9ddc5]"
      style={{ background: 'radial-gradient(1200px 800px at 50% 0%, #201710, #120d08)' }}>
      <Confetti fire={!!me?.guessedThisRound && state.phase === 'DRAWING'} />

      {/* LEFT: word header + canvas + tools */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Word tiles + artist + timer */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[#d6a85c]/15 px-2.5 py-1 text-[10px] font-black text-[#e8c987]">
            <Pencil className="h-3 w-3" /> {isDrawer ? 'You are drawing' : `${drawer?.name} is drawing`}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
            {(state.word ?? '').split('').map((ch, i) => (
              <span key={i}
                className={`grid h-7 min-w-[22px] place-items-center rounded-md border px-1 text-sm font-black uppercase ${
                  isDrawer ? 'border-[#d6a85c]/50 bg-[#d6a85c]/15 text-[#f0d9a4]' : 'border-white/15 bg-white/5 text-white/85'
                }`}
                style={{ fontFamily: SERIF }}>
                {isDrawer ? ch : ch === ' ' ? ' ' : '_'}
              </span>
            ))}
            {!state.word && <span className="text-xs italic text-white/35">round starting…</span>}
          </div>
          <motion.span
            key={urgent ? 'u' + remaining : 'calm'}
            animate={urgent ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5 }}
            className={`w-12 flex-shrink-0 text-right font-mono text-lg font-black ${urgent ? 'text-red-400' : 'text-[#e0b56b]'}`}
          >
            {state.phase === 'DRAWING' ? `${remaining}s` : ''}
          </motion.span>
        </div>
        {/* timer bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full transition-all duration-300 ${urgent ? 'bg-gradient-to-r from-red-500 to-rose-400' : 'bg-gradient-to-r from-[#d6a85c] to-[#e0b56b]'}`}
            style={{ width: `${(remaining / ROUND_SECONDS) * 100}%` }} />
        </div>

        {/* Canvas in a wooden easel frame */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="rounded-xl p-2 shadow-2xl" style={{ background: 'linear-gradient(160deg,#4a3018,#2a1c0e)', border: '1px solid #6b523055', maxHeight: '100%', maxWidth: '100%' }}>
            <canvas
              ref={canvasRef}
              width={CW} height={CH}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              className={`w-full rounded-lg bg-white ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{ maxHeight: 'calc(100% - 0px)', aspectRatio: `${CW}/${CH}`, touchAction: 'none' }}
            />
          </div>
        </div>

        {/* Tools (drawer only) */}
        {isDrawer && state.phase === 'DRAWING' && (
          <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-3 py-2">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => { setColor(c); setErase(false) }}
                  className={`h-6 w-6 rounded-full border-2 transition ${color === c && !erase ? 'scale-125 border-[#f0d9a4]' : 'border-white/20 hover:scale-110'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              {[3, 6, 12].map((sz) => (
                <button key={sz} onClick={() => { setSize(sz); setErase(false) }}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${size === sz && !erase ? 'border border-[#d6a85c]/60 bg-[#d6a85c]/20' : 'border border-white/10 bg-white/5'}`}>
                  <span className="rounded-full bg-white" style={{ width: sz, height: sz }} />
                </button>
              ))}
            </div>
            <button onClick={() => setErase((e) => !e)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg ${erase ? 'border border-[#d6a85c]/60 bg-[#d6a85c]/20' : 'border border-white/10 bg-white/5'}`}>
              <Eraser className="h-4 w-4 text-white" />
            </button>
            <button onClick={handleClear}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-rose-500/20">
              <Trash2 className="h-4 w-4 text-rose-400" />
            </button>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-[#d6a85c]"><Paintbrush className="h-3 w-3" /> You're the artist!</span>
          </div>
        )}
        {!isDrawer && state.phase === 'DRAWING' && (
          <div className="glass rounded-2xl px-3 py-2 text-center">
            <span className="text-xs text-white/55"><strong className="text-white">{drawer?.name}</strong> is drawing — type your guess! 👇</span>
          </div>
        )}
      </div>

      {/* RIGHT: scoreboard + chat */}
      <div className="flex w-72 flex-shrink-0 flex-col gap-2.5">
        <div className="glass-strong rounded-2xl p-3">
          <h4 className="mb-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-white/40">
            <Trophy className="h-3 w-3 text-[#d6a85c]" /> Scores · Round {state.roundNumber}/{state.totalRounds}
          </h4>
          <div className="space-y-1">
            {sorted.map((p, rank) => {
              const isDr = state.players[state.drawerIndex]?.id === p.id
              return (
                <div key={p.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${p.id === currentPlayerId ? 'border border-[#d6a85c]/25 bg-[#d6a85c]/10' : 'bg-white/[0.03]'}`}>
                  <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-white">
                    <span className="w-4 text-center text-[10px]">{['🥇', '🥈', '🥉'][rank] || rank + 1}</span>
                    <span className="truncate">{p.name}</span>
                    {isDr && <Pencil className="h-3 w-3 flex-shrink-0 text-[#d6a85c]" />}
                    {p.guessedThisRound && <span className="text-[9px] text-emerald-400">✓</span>}
                  </span>
                  <motion.span key={p.score} initial={{ scale: 1.4, color: '#7fe0a8' }} animate={{ scale: 1, color: '#e0b56b' }}
                    className="font-mono text-[11px] font-black">{p.score}</motion.span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat / guesses */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-black/30">
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
            <AnimatePresence initial={false}>
              {state.chat.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className={`rounded px-1 text-[11px] leading-snug ${
                    m.kind === 'correct' ? 'bg-emerald-500/10 py-0.5 font-bold text-emerald-400'
                    : m.kind === 'system' ? 'italic text-[#e8c987]'
                    : 'text-white/70'
                  }`}>
                  {m.kind === 'guess' ? <><span className="font-semibold text-white/40">{m.name}:</span> {m.text}</> : m.text}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
          {state.phase === 'DRAWING' && !isDrawer && me && !me.guessedThisRound && (
            <form onSubmit={sendGuess} className="flex gap-2 border-t border-white/10 p-2">
              <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type your guess…"
                className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:border-[#d6a85c] focus:outline-none" />
              <button type="submit" className="h-9 rounded-lg bg-brand px-3 transition active:scale-95">
                <Send className="h-4 w-4 text-white" />
              </button>
            </form>
          )}
          {state.phase === 'DRAWING' && (isDrawer || me?.guessedThisRound) && (
            <div className="border-t border-white/10 p-2 text-center text-[10px] text-white/40">
              {isDrawer ? 'Keep drawing!' : 'You guessed it! 🎉'}
            </div>
          )}
        </div>
      </div>

      {/* ROUND END overlay */}
      <AnimatePresence>
        {state.phase === 'ROUND_END' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="rounded-2xl border border-[#6b5230]/50 p-6 text-center shadow-2xl"
              style={{ background: 'linear-gradient(160deg,#2a2013,#211a10)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">The word was</p>
              <h2 className="my-1 text-3xl font-black capitalize text-[#f0d9a4]" style={{ fontFamily: SERIF }}>
                {state.word ?? state.chat.filter(c => c.kind === 'system').slice(-1)[0]?.text.match(/"(.+)"/)?.[1] ?? ''}
              </h2>
              <p className="text-xs text-white/55">{state.correctCount} {state.correctCount === 1 ? 'player' : 'players'} guessed it</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER — full-board podium */}
      <AnimatePresence>
        {state.winnerId && !endDismissed && (
          <SketchEndScreen
            title="Quick Draw — Gallery Closed"
            winnerName={getPlayerName(state, state.winnerId)}
            youWon={state.winnerId === currentPlayerId}
            rows={sorted.map((p) => ({ id: p.id, name: p.name, score: p.score, isMe: p.id === currentPlayerId }))}
            shareTitle="Quick Draw — Dice Alley"
            shareLead="🎨 Quick Draw on Dice Alley"
            canRematch={!!me}
            onRematch={handleRematch}
            onDismiss={() => setEndDismissed(true)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.winnerId && endDismissed && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-4 z-20 flex justify-center">
            <button onClick={() => setEndDismissed(false)}
              className="flex items-center gap-2 rounded-full border border-[#d6a85c]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#f0d9a4] backdrop-blur transition hover:bg-black/85"
              style={{ fontFamily: SERIF }}>
              <Crown className="h-4 w-4" /> {getPlayerName(state, state.winnerId)} wins! — show results
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Shared podium end screen for the drawing games ---------------------------------

export function SketchEndScreen({ title, winnerName, youWon, rows, shareTitle, shareLead, canRematch, onRematch, onDismiss }: {
  title: string
  winnerName: string
  youWon: boolean
  rows: { id: string; name: string; score: number; isMe: boolean }[]
  shareTitle: string
  shareLead: string
  canRematch: boolean
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const medals = ['🥇', '🥈', '🥉']

  const share = async () => {
    const lines = rows.slice(0, 4).map((p, i) => `${medals[i] || `${i + 1}.`} ${p.name} — ${p.score} pts`).join('\n')
    const text = `${shareLead}\n👑 ${winnerName} wins!\n\n${lines}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: shareTitle, text })
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
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#d6a85c]">{title}</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? '🎉 You are the master artist!' : <>{winnerName} <span className="text-[#f0d9a4]">wins!</span></>}
          </h2>
        </motion.div>

        <div className="flex w-full max-w-md flex-col gap-2">
          {rows.map((p, i) => (
            <motion.div key={p.id}
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.07 }}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                i === 0 ? 'border-2 border-[#e6b45a]/70 bg-gradient-to-b from-[#2a2013]/95 to-[#1a130c]/95 shadow-[0_0_50px_-12px_rgba(230,180,90,0.5)]'
                : p.isMe ? 'border-[#e6b45a]/30 bg-[#e6b45a]/10' : 'border-white/10 bg-black/40'
              }`}>
              <span className="w-7 text-center text-lg">{medals[i] || <span className="text-sm text-white/40">{i + 1}</span>}</span>
              <div className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-lg">
                🎨{i === 0 && <Crown className="absolute -top-3 left-1/2 h-4 w-4 -translate-x-1/2 text-[#e6b45a]" />}
              </div>
              <p className="min-w-0 flex-1 truncate text-sm font-black text-white" style={{ fontFamily: SERIF }}>
                {p.name}{p.isMe && <span className="ml-1.5 text-[9px] font-bold text-[#f2d492]">(you)</span>}
              </p>
              <p className="font-mono text-sm font-black text-[#e6b45a]">{p.score} pts</p>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          {canRematch && (
            <button onClick={onRematch}
              className="bg-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
              <RotateCcw className="h-4 w-4" /> Play Again
            </button>
          )}
          <button onClick={share}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Share2 className="h-4 w-4" /> {shared ? 'Copied!' : 'Share'}
          </button>
          <button onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            🖼 View Gallery
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
