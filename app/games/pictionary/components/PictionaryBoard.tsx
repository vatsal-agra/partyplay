// Quick Draw — board UI. Live shared canvas, drawing tools, guess chat,
// per-round timer, and host-driven round progression.
"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PictionaryState, ROUND_SECONDS, maskedWord, getPlayerName,
  submitGuess, endRound, nextRound,
} from "../lib/pictionaryEngine"
import { Paintbrush, Eraser, Trash2, Pencil, Trophy, Users, Send, Crown } from "lucide-react"

export interface LiveEvent { type: 'draw' | 'clear'; payload?: DrawSeg; t: number }
interface DrawSeg { x0: number; y0: number; x1: number; y1: number; color: string; size: number }

interface Props {
  state: PictionaryState
  currentPlayerId: string
  onStateChange: (s: PictionaryState) => void
  onBroadcastAction?: (event: string, payload: any) => void
  liveEvent?: LiveEvent | null
}

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
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const me = state.players.find((p) => p.id === currentPlayerId)
  const drawer = state.players[state.drawerIndex]
  const isDrawer = drawer?.id === currentPlayerId
  const amHost = state.players[0]?.id === currentPlayerId
  const remaining = state.roundEndsAt ? Math.max(0, Math.round((state.roundEndsAt - now) / 1000)) : 0

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

  // ---- Lobby (not enough players) -------------------------------------------
  if (state.phase === 'LOBBY') {
    return (
      <div className="flex w-full h-full items-center justify-center bg-slate-950 p-6">
        <div className="text-center max-w-sm">
          <Users className="w-12 h-12 text-bubble-400 mx-auto mb-3" />
          <h2 className="text-xl font-black text-white mb-2">Quick Draw needs 2+ players</h2>
          <p className="text-sm text-slate-400">Invite a friend to the party to start sketching and guessing!</p>
        </div>
      </div>
    )
  }

  const sorted = [...state.players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex w-full h-full overflow-hidden bg-slate-950 select-none p-3 gap-3">
      {/* LEFT: canvas + tools */}
      <div className="flex-1 flex flex-col min-w-0 gap-2">
        {/* Word + timer header */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-4">
          <Pencil className="w-4 h-4 text-bubble-400 flex-shrink-0" />
          <div className="flex-1 text-center">
            {isDrawer ? (
              <span className="text-sm font-black text-white tracking-widest">
                Draw: <span className="text-bubble-400 uppercase">{state.word}</span>
              </span>
            ) : (
              <span className="text-lg font-black text-white tracking-[0.3em] font-mono">{maskedWord(state.word)}</span>
            )}
          </div>
          <span className="text-sm font-black text-sunny-400 font-mono w-10 text-right flex-shrink-0">{remaining}s</span>
        </div>
        {/* timer bar */}
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-bubble-500 to-sunny-400 transition-all duration-300"
            style={{ width: `${(remaining / ROUND_SECONDS) * 100}%` }} />
        </div>

        {/* Canvas */}
        <div className="flex-1 flex items-center justify-center bg-slate-900/40 rounded-xl border border-white/10 p-2 min-h-0">
          <canvas
            ref={canvasRef}
            width={CW} height={CH}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
            className={`bg-white rounded-lg w-full ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
            style={{ maxHeight: '100%', aspectRatio: `${CW}/${CH}`, touchAction: 'none' }}
          />
        </div>

        {/* Tools (drawer only) */}
        {isDrawer && state.phase === 'DRAWING' && (
          <div className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => { setColor(c); setErase(false) }}
                  className={`w-6 h-6 rounded-full border-2 ${color === c && !erase ? 'border-white scale-110' : 'border-white/20'} transition`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex gap-1.5 items-center">
              {[3, 6, 12].map((sz) => (
                <button key={sz} onClick={() => { setSize(sz); setErase(false) }}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${size === sz && !erase ? 'bg-bubble-500/30 border border-bubble-500/50' : 'bg-white/5 border border-white/10'}`}>
                  <span className="rounded-full bg-white" style={{ width: sz, height: sz }} />
                </button>
              ))}
            </div>
            <button onClick={() => setErase((e) => !e)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${erase ? 'bg-bubble-500/30 border border-bubble-500/50' : 'bg-white/5 border border-white/10'}`}>
              <Eraser className="w-4 h-4 text-white" />
            </button>
            <button onClick={handleClear}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 hover:bg-rose-500/20">
              <Trash2 className="w-4 h-4 text-rose-400" />
            </button>
            <span className="text-[10px] text-slate-500 ml-auto flex items-center gap-1"><Paintbrush className="w-3 h-3" /> You're the artist!</span>
          </div>
        )}
        {!isDrawer && state.phase === 'DRAWING' && (
          <div className="bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-center">
            <span className="text-xs text-slate-400"><strong className="text-white">{drawer?.name}</strong> is drawing — type your guess! 👇</span>
          </div>
        )}
      </div>

      {/* RIGHT: scoreboard + chat */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3">
          <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1"><Trophy className="w-3 h-3" /> Scores · Round {state.roundNumber}/{state.totalRounds}</h4>
          <div className="space-y-1">
            {sorted.map((p) => {
              const isDr = state.players[state.drawerIndex]?.id === p.id
              return (
                <div key={p.id} className={`flex items-center justify-between px-2 py-1 rounded-lg ${p.id === currentPlayerId ? 'bg-white/10' : ''}`}>
                  <span className="flex items-center gap-1.5 text-[11px] text-white truncate">
                    {isDr && <Pencil className="w-3 h-3 text-bubble-400 flex-shrink-0" />}
                    {p.guessedThisRound && <span className="text-emerald-400 text-[9px]">✓</span>}
                    {p.name}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-sunny-400">{p.score}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Chat / guesses */}
        <div className="flex-1 bg-slate-950/60 border border-white/10 rounded-2xl flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin min-h-0">
            {state.chat.map((m) => (
              <div key={m.id} className={`text-[11px] leading-snug ${m.kind === 'correct' ? 'text-emerald-400 font-bold' : m.kind === 'system' ? 'text-sunny-400 italic' : 'text-slate-300'}`}>
                {m.kind === 'guess' ? <><span className="text-slate-500 font-semibold">{m.name}:</span> {m.text}</> : m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          {state.phase === 'DRAWING' && !isDrawer && me && !me.guessedThisRound && (
            <form onSubmit={sendGuess} className="p-2 border-t border-white/10 flex gap-2">
              <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type your guess…"
                className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-bubble-500" />
              <button type="submit" className="h-9 px-3 bg-bubble-500/30 hover:bg-bubble-500/50 border border-bubble-500/40 rounded-lg">
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          )}
          {state.phase === 'DRAWING' && (isDrawer || me?.guessedThisRound) && (
            <div className="p-2 border-t border-white/10 text-center text-[10px] text-slate-500">
              {isDrawer ? 'Keep drawing!' : 'You guessed it! 🎉'}
            </div>
          )}
        </div>
      </div>

      {/* ROUND END overlay */}
      <AnimatePresence>
        {state.phase === 'ROUND_END' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 rounded-2xl p-6 text-center shadow-2xl">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-black">The word was</p>
              <h2 className="text-2xl font-black text-bubble-400 my-1 capitalize">{state.chat.filter(c => c.kind === 'system').slice(-1)[0]?.text.match(/"(.+)"/)?.[1] ?? ''}</h2>
              <p className="text-xs text-slate-400">{state.correctCount} {state.correctCount === 1 ? 'player' : 'players'} guessed it</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER overlay */}
      <AnimatePresence>
        {state.winnerId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="bg-slate-900 border border-bubble-500/30 rounded-2xl p-6 text-center shadow-2xl w-72">
              <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h2 className="text-xl font-black text-white">{getPlayerName(state, state.winnerId)} wins!</h2>
              <div className="mt-3 space-y-1">
                {sorted.map((p, i) => (
                  <div key={p.id} className="flex justify-between text-xs px-3">
                    <span className="text-slate-300">{i + 1}. {p.name}</span>
                    <span className="font-mono font-bold text-sunny-400">{p.score}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
