// Quick Draw — real team Pictionary board UI.
//
// Two teams race a token around a category-coloured track. On a team's turn
// their artist draws the word matching the square's category and ONLY their
// team guesses; a correct guess rolls the die and advances the token. On a
// rainbow "All Play" square both teams' artists draw the SAME word at once on
// their own easel and the first team to guess it advances. First team to the
// finish wins. Drawing/guessing/host logic lives in the pure engine — this is
// the presentation layer plus the shared-canvas plumbing.
"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PictionaryState, Team, Category, ROUND_SECONDS, BOARD_LENGTH,
  TEAM_META, CATEGORY_META, getPlayerName, initializeGame, submitGuess,
  timeout as timeoutTurn, nextTurn, isArtist, artistId, wordFor, teamMembers,
} from "../lib/pictionaryEngine"
import { Confetti } from "@/components/Confetti"
import {
  Paintbrush, Eraser, Trash2, Pencil, Trophy, Users, Send, Crown,
  RotateCcw, Share2, LogOut, Flag,
} from "lucide-react"

interface DrawSeg { x0: number; y0: number; x1: number; y1: number; color: string; size: number; team?: Team }
export interface LiveEvent { type: 'draw' | 'clear'; payload?: DrawSeg; t: number }

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
  // One canvas per team; in a normal turn only the active team's easel renders.
  const canvasRefs = useRef<Record<Team, HTMLCanvasElement | null>>({ red: null, blue: null })
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
  const myTeam: Team | null = me?.team ?? null
  const amHost = state.players[0]?.id === currentPlayerId
  const iAmArtist = isArtist(state, currentPlayerId)
  const isAllPlay = state.phase === 'ALLPLAY'
  const isDrawingPhase = state.phase === 'DRAWING' || state.phase === 'ALLPLAY'
  const myWord = wordFor(state, currentPlayerId) // non-null only when I'm an artist
  const cat = CATEGORY_META[state.category]

  const remaining = state.roundEndsAt ? Math.max(0, Math.round((state.roundEndsAt - now) / 1000)) : 0
  const urgent = isDrawingPhase && remaining <= 10

  // Which team can *I* guess for right now?
  const canGuess = isDrawingPhase && !iAmArtist && !!myTeam && (isAllPlay || myTeam === state.activeTeam)

  const commit = (next: PictionaryState) => {
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  // ---- Canvas helpers -------------------------------------------------------
  const fillWhite = (canvas: HTMLCanvasElement | null) => {
    const c = canvas?.getContext('2d'); if (!c) return
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, CW, CH)
  }
  const paintOn = (team: Team, seg: DrawSeg) => {
    const c = canvasRefs.current[team]?.getContext('2d'); if (!c) return
    c.strokeStyle = seg.color
    c.lineWidth = seg.size
    c.lineCap = 'round'; c.lineJoin = 'round'
    c.beginPath()
    c.moveTo(seg.x0 * CW, seg.y0 * CH)
    c.lineTo(seg.x1 * CW, seg.y1 * CH)
    c.stroke()
  }

  // Stable ref callbacks — a fresh closure each render would make React re-run
  // the ref (and wipe the canvas) on every tick. Fill white on genuine attach.
  const bindRed = useRef((el: HTMLCanvasElement | null) => {
    canvasRefs.current.red = el
    if (el) { const c = el.getContext('2d'); if (c) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, CW, CH) } }
  }).current
  const bindBlue = useRef((el: HTMLCanvasElement | null) => {
    canvasRefs.current.blue = el
    if (el) { const c = el.getContext('2d'); if (c) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, CW, CH) } }
  }).current
  const bindCanvas = (team: Team) => (team === 'red' ? bindRed : bindBlue)

  // Wipe both easels at the START of a new turn only. When a turn ENDS
  // roundEndsAt goes null — skip the wipe there so the finished drawing stays
  // up during the "the word was …" reveal instead of vanishing on the guess.
  const turnSig = `${state.activeTeam}-${state.category}-${state.roundEndsAt ?? 0}`
  useEffect(() => {
    if (!state.roundEndsAt) return
    fillWhite(canvasRefs.current.red)
    fillWhite(canvasRefs.current.blue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnSig])

  // Apply remote draw/clear events. Skip echoes of my own team's strokes while
  // I'm that team's artist (I already painted them locally).
  useEffect(() => {
    if (!liveEvent) return
    const evTeam = liveEvent.payload?.team as Team | undefined
    if (iAmArtist && evTeam && evTeam === myTeam) return
    if (liveEvent.type === 'clear') {
      if (evTeam) fillWhite(canvasRefs.current[evTeam])
      else { fillWhite(canvasRefs.current.red); fillWhite(canvasRefs.current.blue) }
    } else if (liveEvent.payload && evTeam) {
      paintOn(evTeam, liveEvent.payload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent?.t])

  // Countdown ticker.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 400)
    return () => clearInterval(i)
  }, [])

  // Host drives turn progression (with a wall-clock timeout that survives
  // hidden tabs — setTimeout still fires, unlike rAF).
  useEffect(() => {
    if (!amHost || state.winningTeam) return
    if (isDrawingPhase && state.roundEndsAt) {
      if (Date.now() >= state.roundEndsAt) { commit(timeoutTurn(state)); return }
      const t = setTimeout(() => commit(timeoutTurn(state)), Math.max(300, state.roundEndsAt - Date.now()))
      return () => clearTimeout(t)
    }
    if (state.phase === 'TURN_END') {
      const t = setTimeout(() => commit(nextTurn(state)), 3600)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, turnSig, amHost, state.winningTeam])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [state.chat])
  useEffect(() => { if (!state.winningTeam) setEndDismissed(false) }, [state.winningTeam])

  // ---- Pointer drawing (artist only, onto my own team's easel) --------------
  const canDraw = iAmArtist && isDrawingPhase && !!myTeam
  const ptToNorm = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const onDown = (e: React.PointerEvent) => {
    if (!canDraw) return
    drawing.current = true
    last.current = ptToNorm(e)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawing.current || !last.current || !myTeam) return
    const p = ptToNorm(e)
    const seg: DrawSeg = { x0: last.current.x, y0: last.current.y, x1: p.x, y1: p.y, color: erase ? '#ffffff' : color, size: erase ? 26 : size, team: myTeam }
    paintOn(myTeam, seg)
    onBroadcastAction?.('draw', seg)
    last.current = p
  }
  const onUp = () => { drawing.current = false; last.current = null }

  const handleClear = () => {
    if (!myTeam) return
    fillWhite(canvasRefs.current[myTeam])
    onBroadcastAction?.('clear', { team: myTeam })
  }

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

  const lastCorrect = [...state.chat].reverse().find((c) => c.kind === 'correct')
  const myTeamJustScored = state.phase === 'TURN_END' && lastCorrect?.team === myTeam

  // ---- Lobby (need at least one player per team) ----------------------------
  if (state.phase === 'LOBBY') {
    return (
      <div className="flex h-full w-full items-center justify-center p-6" style={{ background: 'radial-gradient(1000px 700px at 50% 0%, #241a10, #140d08)' }}>
        <div className="glass max-w-sm rounded-2xl p-8 text-center">
          <Users className="mx-auto mb-3 h-12 w-12 text-[#d6a85c]" />
          <h2 className="mb-2 text-xl font-black text-white" style={{ fontFamily: SERIF }}>Quick Draw needs two teams</h2>
          <p className="text-sm text-white/50">Invite at least one more friend — players split into a Red and a Blue team and race to the finish.</p>
        </div>
      </div>
    )
  }

  // ---- Board track ----------------------------------------------------------
  const renderTrack = () => (
    <div className="glass-strong rounded-2xl p-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-white/40">
          <Flag className="h-3 w-3 text-[#d6a85c]" /> The Board · race to the finish
        </span>
        <span className="flex items-center gap-2 text-[9px] font-bold">
          {(['red', 'blue'] as Team[]).map((t) => (
            <span key={t} className="flex items-center gap-1" style={{ color: TEAM_META[t].hex }}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_META[t].hex }} />
              {state.positions[t]}/{BOARD_LENGTH - 1}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {state.board.map((c, i) => {
          const m = CATEGORY_META[c]
          const isFinish = i === BOARD_LENGTH - 1
          const redHere = state.positions.red === i
          const blueHere = state.positions.blue === i
          return (
            <div key={i}
              className="relative grid h-6 w-6 flex-shrink-0 place-items-center rounded text-[8px] font-black"
              style={{ background: `${m.hex}${isFinish ? '' : '33'}`, border: `1px solid ${m.hex}${isFinish ? '' : '55'}`, color: isFinish ? '#1a130c' : m.hex }}
              title={`${i === 0 ? 'Start' : isFinish ? 'Finish' : `Square ${i}`} — ${m.label}`}>
              {isFinish ? '🏁' : m.short}
              {(redHere || blueHere) && (
                <span className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {redHere && <span className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: TEAM_META.red.hex }} />}
                  {blueHere && <span className="h-2 w-2 rounded-full ring-1 ring-black/40" style={{ background: TEAM_META.blue.hex }} />}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ---- A single easel for a team --------------------------------------------
  const renderEasel = (team: Team, compact: boolean) => {
    const artId = artistId(state, team)
    const iDrawThis = canDraw && myTeam === team
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center gap-1">
        <div className="flex w-full items-center justify-center gap-1.5 text-[10px] font-black" style={{ color: TEAM_META[team].hex }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_META[team].hex }} />
          {TEAM_META[team].name}
          <span className="text-white/45">· {iDrawThis ? 'you draw' : `${getPlayerName(state, artId || '')} draws`}</span>
        </div>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <div className="rounded-xl p-1.5 shadow-2xl" style={{ background: 'linear-gradient(160deg,#4a3018,#2a1c0e)', border: `1px solid ${TEAM_META[team].hex}55`, maxHeight: '100%', maxWidth: '100%' }}>
            <canvas
              ref={bindCanvas(team)}
              width={CW} height={CH}
              onPointerDown={iDrawThis ? onDown : undefined}
              onPointerMove={iDrawThis ? onMove : undefined}
              onPointerUp={iDrawThis ? onUp : undefined}
              onPointerLeave={iDrawThis ? onUp : undefined}
              className={`rounded-lg bg-white ${iDrawThis ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{ width: compact ? '100%' : undefined, maxHeight: '100%', maxWidth: '100%', aspectRatio: `${CW}/${CH}`, touchAction: 'none' }}
            />
          </div>
        </div>
      </div>
    )
  }

  // Ordered team standings for the end screen (winner first).
  const teamRows = (['red', 'blue'] as Team[])
    .map((t) => ({ id: t, name: TEAM_META[t].name, score: state.positions[t], isMe: t === myTeam }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="relative flex h-full w-full select-none gap-2.5 overflow-hidden p-2 text-[#e9ddc5]"
      style={{ background: 'radial-gradient(1200px 800px at 50% 0%, #201710, #120d08)' }}>
      <Confetti fire={myTeamJustScored || state.winningTeam === myTeam} />

      {/* LEFT: category header + track + easel(s) + tools */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Category + word + timer */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <span className="flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black"
            style={{ background: `${cat.hex}22`, color: cat.hex }}>
            <span className="text-sm leading-none">{cat.icon}</span> {isAllPlay ? 'ALL PLAY' : cat.label}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1">
            {(state.card?.[state.category] ?? '').split('').map((ch, i) => (
              <span key={i}
                className={`grid h-7 min-w-[22px] place-items-center rounded-md border px-1 text-sm font-black uppercase ${
                  myWord ? 'border-[#d6a85c]/50 bg-[#d6a85c]/15 text-[#f0d9a4]' : 'border-white/15 bg-white/5 text-white/85'
                }`}
                style={{ fontFamily: SERIF }}>
                {myWord ? ch : ch === ' ' ? ' ' : '_'}
              </span>
            ))}
          </div>
          <motion.span
            key={urgent ? 'u' + remaining : 'calm'}
            animate={urgent ? { scale: [1, 1.18, 1] } : {}}
            transition={{ duration: 0.5 }}
            className={`w-12 flex-shrink-0 text-right font-mono text-lg font-black ${urgent ? 'text-red-400' : 'text-[#e0b56b]'}`}
          >
            {isDrawingPhase ? `${remaining}s` : ''}
          </motion.span>
        </div>
        {/* timer bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full transition-all duration-300 ${urgent ? 'bg-gradient-to-r from-red-500 to-rose-400' : 'bg-gradient-to-r from-[#d6a85c] to-[#e0b56b]'}`}
            style={{ width: `${(remaining / ROUND_SECONDS) * 100}%` }} />
        </div>

        {renderTrack()}

        {/* Easel(s): one for a normal turn, both for All Play */}
        <div className="flex min-h-0 flex-1 items-stretch justify-center gap-2">
          {isAllPlay
            ? (<>{renderEasel('red', true)}{renderEasel('blue', true)}</>)
            : renderEasel(state.activeTeam, false)}
        </div>

        {/* Tools (artist only) */}
        {canDraw && (
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
            <span className="ml-auto flex items-center gap-1 text-[10px] text-[#d6a85c]"><Paintbrush className="h-3 w-3" /> Draw the {cat.label}!</span>
          </div>
        )}
        {isDrawingPhase && !iAmArtist && (
          <div className="glass rounded-2xl px-3 py-2 text-center">
            <span className="text-xs text-white/55">
              {canGuess
                ? <>Your team is guessing — type it below! 👇</>
                : isAllPlay
                  ? <>All Play — both teams are drawing…</>
                  : <><strong className="text-white">{TEAM_META[state.activeTeam].name}</strong> is playing this turn.</>}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT: team standings + turn + chat */}
      <div className="flex w-72 flex-shrink-0 flex-col gap-2.5">
        <div className="glass-strong rounded-2xl p-3">
          <h4 className="mb-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-white/40">
            <Trophy className="h-3 w-3 text-[#d6a85c]" /> Teams {isAllPlay ? '· All Play!' : `· ${TEAM_META[state.activeTeam].name}'s turn`}
          </h4>
          <div className="space-y-1.5">
            {(['red', 'blue'] as Team[]).map((t) => {
              const active = !isAllPlay && state.activeTeam === t
              const members = teamMembers(state, t)
              const artId = artistId(state, t)
              return (
                <div key={t} className={`rounded-lg px-2 py-1.5 ${active || isAllPlay ? 'ring-1' : ''} ${t === myTeam ? 'bg-white/[0.05]' : 'bg-white/[0.02]'}`}
                  style={{ boxShadow: (active || isAllPlay) ? `inset 0 0 0 1px ${TEAM_META[t].hex}` : undefined }}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-black" style={{ color: TEAM_META[t].hex }}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: TEAM_META[t].hex }} />
                      {TEAM_META[t].name}{t === myTeam && <span className="text-[8px] text-white/40">(you)</span>}
                    </span>
                    <span className="font-mono text-[11px] font-black" style={{ color: TEAM_META[t].hex }}>
                      {state.positions[t]}/{BOARD_LENGTH - 1}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[9px] text-white/45">
                    {members.map((mem) => (
                      <span key={mem.id} className={mem.id === artId && (active || isAllPlay) ? 'font-bold text-[#f0d9a4]' : ''}>
                        {mem.id === artId && (active || isAllPlay) && <Pencil className="mr-0.5 inline h-2.5 w-2.5" />}
                        {mem.name}
                      </span>
                    ))}
                  </div>
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
                  {m.kind === 'guess'
                    ? <><span className="font-semibold" style={{ color: m.team ? TEAM_META[m.team].hex : 'rgba(255,255,255,.4)' }}>{m.name}:</span> {m.text}</>
                    : m.text}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>
          {isDrawingPhase && canGuess && (
            <form onSubmit={sendGuess} className="flex gap-2 border-t border-white/10 p-2">
              <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="Type your team's guess…"
                className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/25 focus:border-[#d6a85c] focus:outline-none" />
              <button type="submit" className="h-9 rounded-lg bg-brand px-3 transition active:scale-95">
                <Send className="h-4 w-4 text-white" />
              </button>
            </form>
          )}
          {isDrawingPhase && iAmArtist && (
            <div className="border-t border-white/10 p-2 text-center text-[10px] text-white/40">You're the artist — keep drawing! ✏️</div>
          )}
        </div>
      </div>

      {/* TURN END overlay */}
      <AnimatePresence>
        {state.phase === 'TURN_END' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="rounded-2xl border border-[#6b5230]/50 p-6 text-center shadow-2xl"
              style={{ background: 'linear-gradient(160deg,#2a2013,#211a10)' }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">The word was</p>
              <h2 className="my-1 text-3xl font-black capitalize text-[#f0d9a4]" style={{ fontFamily: SERIF }}>
                {state.card?.[state.category] ?? ''}
              </h2>
              {lastCorrect
                ? <p className="text-xs font-bold" style={{ color: lastCorrect.team ? TEAM_META[lastCorrect.team].hex : '#fff' }}>{lastCorrect.text}</p>
                : <p className="text-xs text-white/55">No one guessed it — no advance.</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME OVER — team podium */}
      <AnimatePresence>
        {state.winningTeam && !endDismissed && (
          <SketchEndScreen
            title="Quick Draw — Race Finished"
            winnerName={TEAM_META[state.winningTeam].name}
            youWon={state.winningTeam === myTeam}
            rows={teamRows}
            shareTitle="Quick Draw — Dice Alley"
            shareLead="🎨 Team Pictionary on Dice Alley"
            canRematch={!!me}
            onRematch={handleRematch}
            onDismiss={() => setEndDismissed(true)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.winningTeam && endDismissed && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-4 z-20 flex justify-center">
            <button onClick={() => setEndDismissed(false)}
              className="flex items-center gap-2 rounded-full border border-[#d6a85c]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#f0d9a4] backdrop-blur transition hover:bg-black/85"
              style={{ fontFamily: SERIF }}>
              <Crown className="h-4 w-4" /> {TEAM_META[state.winningTeam].name} wins! — show results
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
