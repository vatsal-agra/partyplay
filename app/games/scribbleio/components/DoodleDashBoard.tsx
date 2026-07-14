// Doodle Dash — board UI. Word-choice cards, live shared canvas in a wooden
// frame, gold hint letters that flip in as the clock runs, juiced chat and
// scoreboard, and a full-board podium at game end. All engine/host logic is
// unchanged — this is the presentation layer.
"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  DoodleState, ROUND_SECONDS, maxHints, getPlayerName, initializeGame,
  chooseWord, submitGuess, revealHint, endRound, nextRound,
} from "../lib/doodleEngine"
import { SketchEndScreen } from "../../pictionary/components/PictionaryBoard"
import { Confetti } from "@/components/Confetti"
import {
  Paintbrush, Eraser, Trash2, Pencil, Trophy, Users, Send, Crown,
} from "lucide-react"

export interface LiveEvent { type: 'draw' | 'clear'; payload?: DrawSeg; t: number }
interface DrawSeg { x0: number; y0: number; x1: number; y1: number; color: string; size: number }

interface Props {
  state: DoodleState
  currentPlayerId: string
  onStateChange: (s: DoodleState) => void
  onBroadcastAction?: (event: string, payload: any) => void
  liveEvent?: LiveEvent | null
}

const SERIF = "var(--font-display), Georgia, serif"
const CW = 900, CH = 600
const COLORS = ['#0b1220', '#dc2626', '#f59e0b', '#16a34a', '#2563eb', '#7c3aed', '#ec4899', '#92400e']

export default function DoodleDashBoard({ state, currentPlayerId, onStateChange, onBroadcastAction, liveEvent }: Props) {
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

  const commit = (next: DoodleState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const me = state.players.find((p) => p.id === currentPlayerId)
  const drawer = state.players[state.drawerIndex]
  const isDrawer = drawer?.id === currentPlayerId
  const amHost = state.players[0]?.id === currentPlayerId
  const remaining = state.roundEndsAt ? Math.max(0, Math.round((state.roundEndsAt - now) / 1000)) : 0
  const urgent = state.phase === 'DRAWING' && remaining <= 10

  // ---- Canvas ---------------------------------------------------------------
  const ctx = () => canvasRef.current?.getContext('2d') ?? null
  const clearCanvas = () => { const c = ctx(); if (c) { c.fillStyle = '#fff'; c.fillRect(0, 0, CW, CH) } }
  const paint = (s: DrawSeg) => {
    const c = ctx(); if (!c) return
    c.strokeStyle = s.color; c.lineWidth = s.size; c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath(); c.moveTo(s.x0 * CW, s.y0 * CH); c.lineTo(s.x1 * CW, s.y1 * CH); c.stroke()
  }
  useEffect(() => { clearCanvas() /* eslint-disable-next-line */ }, [state.roundNumber, state.phase === 'DRAWING'])
  useEffect(() => {
    if (!liveEvent || isDrawer) return
    if (liveEvent.type === 'clear') clearCanvas()
    else if (liveEvent.payload) paint(liveEvent.payload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent?.t])

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 400); return () => clearInterval(i) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state.chat])
  useEffect(() => { if (!state.winnerId) setEndDismissed(false) }, [state.winnerId])

  // ---- Host: word-choice timeout + round end ---------------------------------
  useEffect(() => {
    if (!amHost || state.winnerId) return
    if (state.phase === 'CHOOSE') {
      const t = setTimeout(() => { if (state.wordChoices) commit(chooseWord(state, state.wordChoices[0])) }, 10000)
      return () => clearTimeout(t)
    }
    if (state.phase === 'ROUND_END') {
      const t = setTimeout(() => commit(nextRound(state)), 4200)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.roundNumber, amHost, state.winnerId])

  // ---- Host: timer-driven hints + round end (via the `now` ticker) -----------
  useEffect(() => {
    if (!amHost || state.winnerId || state.phase !== 'DRAWING' || !state.roundEndsAt || !state.word) return
    if (now >= state.roundEndsAt) { commit(endRound(state)); return }
    const total = ROUND_SECONDS * 1000
    const elapsed = total - (state.roundEndsAt - now)
    const mh = maxHints(state.word)
    const interval = total / (mh + 1)
    const expected = Math.min(mh, Math.floor(elapsed / interval))
    if (state.revealed.length < expected) commit(revealHint(state))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, amHost, state.phase, state.roundEndsAt, state.word, state.revealed.length, state.winnerId])

  // ---- Drawing pointer handlers ---------------------------------------------
  const ptToNorm = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const canDraw = isDrawer && state.phase === 'DRAWING'
  const onDown = (e: React.PointerEvent) => { if (!canDraw) return; drawing.current = true; last.current = ptToNorm(e) }
  const onMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawing.current || !last.current) return
    const p = ptToNorm(e)
    const seg: DrawSeg = { x0: last.current.x, y0: last.current.y, x1: p.x, y1: p.y, color: erase ? '#fff' : color, size: erase ? 26 : size }
    paint(seg); onBroadcastAction?.('draw', seg); last.current = p
  }
  const onUp = () => { drawing.current = false; last.current = null }
  const handleClear = () => { clearCanvas(); onBroadcastAction?.('clear', {}) }

  const sendGuess = (e: React.FormEvent) => {
    e.preventDefault()
    const text = guess.trim(); if (!text) return
    commit(submitGuess(state, currentPlayerId, text)); setGuess('')
  }

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name }))))
  }

  if (state.phase === 'LOBBY') {
    return (
      <div className="flex h-full w-full items-center justify-center p-6" style={{ background: 'radial-gradient(1000px 700px at 50% 0%, #241a10, #140d08)' }}>
        <div className="glass max-w-sm rounded-2xl p-8 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-[#d6a85c]" />
          <h2 className="mb-2 text-xl font-black text-white" style={{ fontFamily: SERIF }}>Doodle Dash needs 2+ players</h2>
          <p className="text-sm text-white/50">Invite friends to the party to start doodling!</p>
        </div>
      </div>
    )
  }

  const sorted = [...state.players].sort((a, b) => b.score - a.score)

  return (
    <div className="relative flex h-full w-full select-none gap-2.5 overflow-hidden p-2 text-[#e9ddc5]"
      style={{ background: 'radial-gradient(1200px 800px at 50% 0%, #201710, #120d08)' }}>
      <Confetti fire={!!me?.guessedThisRound && state.phase === 'DRAWING'} />

      {/* LEFT: header + canvas + tools */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Word tiles / choose banner + timer */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full bg-[#d6a85c]/15 px-2.5 py-1 text-[10px] font-black text-[#e8c987]">
            <Pencil className="h-3 w-3" /> {state.phase === 'CHOOSE' ? (isDrawer ? 'Pick your word' : `${drawer?.name} is choosing`) : isDrawer ? 'You are drawing' : `${drawer?.name} is drawing`}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
            {state.phase === 'CHOOSE' ? (
              <span className="text-xs italic text-white/40">a new word is being chosen…</span>
            ) : state.word ? (
              state.word.split('').map((ch, i) => {
                const shown = isDrawer || state.revealed.includes(i)
                return (
                  <motion.span key={`${state.roundNumber}-${i}-${shown}`}
                    initial={shown && !isDrawer ? { rotateX: 90, scale: 1.3 } : false}
                    animate={{ rotateX: 0, scale: 1 }}
                    className={`grid h-7 min-w-[22px] place-items-center rounded-md border px-1 text-sm font-black uppercase ${
                      shown ? 'border-[#d6a85c]/60 bg-[#d6a85c]/20 text-[#f0d9a4]' : 'border-white/15 bg-white/5 text-white/85'
                    }`}
                    style={{ fontFamily: SERIF }}>
                    {shown ? ch : '_'}
                  </motion.span>
                )
              })
            ) : (
              <span className="text-xs italic text-white/35">round starting…</span>
            )}
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
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full transition-all duration-300 ${urgent ? 'bg-gradient-to-r from-red-500 to-rose-400' : 'bg-gradient-to-r from-[#d6a85c] to-[#e0b56b]'}`}
            style={{ width: `${(remaining / ROUND_SECONDS) * 100}%` }} />
        </div>

        {/* Canvas in a wooden frame */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          <div className="rounded-xl p-2 shadow-2xl" style={{ background: 'linear-gradient(160deg,#4a3018,#2a1c0e)', border: '1px solid #6b523055', maxHeight: '100%', maxWidth: '100%' }}>
            <canvas ref={canvasRef} width={CW} height={CH}
              onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
              className={`w-full rounded-lg bg-white ${canDraw ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{ maxHeight: '100%', aspectRatio: `${CW}/${CH}`, touchAction: 'none' }} />
          </div>

          {/* Word choice overlay */}
          <AnimatePresence>
            {state.phase === 'CHOOSE' && isDrawer && state.wordChoices && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm">
                <motion.div initial={{ scale: 0.92, y: 10 }} animate={{ scale: 1, y: 0 }}
                  className="rounded-2xl border border-[#6b5230]/50 p-6 text-center shadow-2xl"
                  style={{ background: 'linear-gradient(160deg,#2a2013,#211a10)' }}>
                  <h3 className="mb-4 text-base font-black text-white" style={{ fontFamily: SERIF }}>🎨 Pick a word to draw</h3>
                  <div className="flex gap-3">
                    {state.wordChoices.map((w, i) => (
                      <motion.button key={w} onClick={() => commit(chooseWord(state, w))}
                        initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.08 * i }}
                        whileHover={{ scale: 1.08, rotate: i === 1 ? 0 : i === 0 ? -2 : 2 }}
                        className="rounded-xl border border-[#d6a85c]/50 bg-[#d6a85c]/15 px-5 py-4 text-base font-black capitalize text-[#f0d9a4] shadow-lg transition hover:bg-[#d6a85c]/30"
                        style={{ fontFamily: SERIF }}>
                        {w}
                      </motion.button>
                    ))}
                  </div>
                  <p className="mt-3 text-[9px] italic text-white/35">auto-picks the first word in 10s</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Tools (drawer) */}
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

      {/* RIGHT: scores + chat */}
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
            title="Doodle Dash — Gallery Closed"
            winnerName={getPlayerName(state, state.winnerId)}
            youWon={state.winnerId === currentPlayerId}
            rows={sorted.map((p) => ({ id: p.id, name: p.name, score: p.score, isMe: p.id === currentPlayerId }))}
            shareTitle="Doodle Dash — Dice Alley"
            shareLead="🖍️ Doodle Dash on Dice Alley"
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
