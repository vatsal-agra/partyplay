// Mystery Manor — board UI. An atmospheric detective mansion: warm wood floor,
// parchment rooms with brass labels, glossy character pawns that glide, weapon
// tokens, a dice-roll flourish and a parchment case notebook. All engine hooks
// are unchanged — this is the presentation layer.
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MysteryState,
  rollDice, moveTo, takeSecretPassage, stayAndSuggest, makeSuggestion,
  respondDisprove, makeAccusation, endTurn, playBotStep,
  getReachable, cardName, getPlayerName,
} from "../lib/mysteryEngine"
import {
  ROOMS, SUSPECTS, WEAPONS, CELLAR_RECT, RoomId, getRoom, cellKey, isCorridor,
  BOARD_W, BOARD_H,
} from "../lib/mansionLayout"
import { Confetti } from "@/components/Confetti"
import { Dices, KeyRound, Search, Megaphone, ChevronRight, NotebookPen, ScrollText, Trophy, Skull } from "lucide-react"

const CELL = 10
const W = BOARD_W * CELL
const H = BOARD_H * CELL
const SERIF = "var(--font-display), Georgia, serif"

const ROOM_ICON: Record<RoomId, string> = {
  kitchen: "🍳", ballroom: "🎭", conservatory: "🪴", dining: "🍷",
  billiard: "🎱", library: "📚", lounge: "🛋️", hall: "🏛️", study: "📜",
}
const ROOM_TINT: Record<RoomId, string> = {
  kitchen: "#c0522d", ballroom: "#c9a227", conservatory: "#2f6b4f", dining: "#7d2b2b",
  billiard: "#1f6b4a", library: "#6b4a2a", lounge: "#2a6b6b", hall: "#b08d3a", study: "#4a3b6b",
}

interface Props {
  state: MysteryState
  currentPlayerId: string
  onStateChange: (s: MysteryState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

type TokenPos = { type: "room"; room: RoomId } | { type: "cell"; x: number; y: number }

export default function MysteryBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [showAccuse, setShowAccuse] = useState(false)
  const [sgSuspect, setSgSuspect] = useState<string>(SUSPECTS[0].id)
  const [sgWeapon, setSgWeapon] = useState<string>(WEAPONS[0].id)
  const [acSuspect, setAcSuspect] = useState<string>(SUSPECTS[0].id)
  const [acWeapon, setAcWeapon] = useState<string>(WEAPONS[0].id)
  const [acRoom, setAcRoom] = useState<RoomId>(ROOMS[0].id)
  const [notes, setNotes] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<"notebook" | "log">("notebook")
  const [rolling, setRolling] = useState(false)
  const [dieFace, setDieFace] = useState(1)

  const commit = (next: MysteryState) => {
    onStateChange(next)
    onBroadcastAction?.("sync_state", next)
  }

  const cur = state.players[state.currentPlayerIndex]
  const isMyTurn = cur.id === currentPlayerId && !state.winnerId
  const me = state.players.find((p) => p.id === currentPlayerId)

  // Dice-roll flourish: tumble faces, then apply the engine roll.
  const doRoll = () => {
    if (rolling) return
    setRolling(true)
    let ticks = 0
    const iv = setInterval(() => {
      setDieFace(1 + Math.floor(Math.random() * 6))
      if (++ticks > 7) { clearInterval(iv); setRolling(false); commit(rollDice(state)) }
    }, 90)
  }

  // ---- Bot driver -----------------------------------------------------------
  useEffect(() => {
    if (state.winnerId) return
    if (!cur.isBot) return
    if (!["ROLL", "MOVE", "ACTION"].includes(state.phase)) return
    const t = setTimeout(() => commit(playBotStep(state)), 950)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.phase, state.suggestionMade, state.winnerId, state.pending])

  // ---- Reachable set --------------------------------------------------------
  const reach = useMemo(() => {
    if (!isMyTurn || state.phase !== "MOVE") return null
    return getReachable(state, state.currentPlayerIndex)
  }, [state, isMyTurn])
  const reachableCells = useMemo(() => {
    const s = new Set<string>()
    reach?.cells.forEach((c) => s.add(cellKey(c.x, c.y)))
    return s
  }, [reach])
  const reachableRooms = useMemo(() => new Set(reach?.rooms.map((r) => r.room)), [reach])

  // ---- Token positions ------------------------------------------------------
  const suspectPositions = useMemo(() => {
    const map: Record<string, TokenPos> = {}
    SUSPECTS.forEach((s) => {
      const owner = state.players.find((p) => p.suspectId === s.id)
      if (owner) {
        if (owner.inRoom) map[s.id] = { type: "room", room: owner.inRoom }
        else if (owner.cell) map[s.id] = { type: "cell", x: owner.cell.x, y: owner.cell.y }
      } else {
        const loc = state.suspectLocations[s.id]
        map[s.id] = loc ? { type: "room", room: loc } : { type: "cell", x: s.start.x, y: s.start.y }
      }
    })
    return map
  }, [state])

  // Ordered occupants per room for tidy, non-overlapping slots.
  const { roomSuspects, roomWeapons } = useMemo(() => {
    const rs: Record<string, string[]> = {}
    const rw: Record<string, string[]> = {}
    ROOMS.forEach((r) => { rs[r.id] = []; rw[r.id] = [] })
    SUSPECTS.forEach((s) => {
      const pos = suspectPositions[s.id]
      if (pos?.type === "room") rs[pos.room].push(s.id)
    })
    WEAPONS.forEach((w) => {
      const room = state.weaponLocations[w.id]
      if (room) rw[room].push(w.id)
    })
    return { roomSuspects: rs, roomWeapons: rw }
  }, [state, suspectPositions])

  const roomSlot = (room: RoomId, i: number, row: "top" | "bottom") => {
    const r = getRoom(room).rect
    const wCells = r.x2 - r.x1 + 1
    const perRow = Math.max(2, wCells - 2)
    const col = i % perRow
    const cx = (r.x1 + 1.2 + col * ((wCells - 2.2) / Math.max(1, perRow - 1 || 1))) * CELL
    const cy = row === "bottom" ? (r.y2 - 0.3) * CELL : (r.y1 + 2.0) * CELL
    return { cx, cy }
  }

  const suspectTarget = (id: string) => {
    const pos = suspectPositions[id]
    if (!pos) return { cx: 0, cy: 0 }
    if (pos.type === "cell") return { cx: pos.x * CELL + CELL / 2, cy: pos.y * CELL + CELL / 2 }
    return roomSlot(pos.room, roomSuspects[pos.room].indexOf(id), "bottom")
  }

  const knownToMe = new Set(me?.known ?? [])
  const toggleNote = (id: string) => setNotes((n) => ({ ...n, [id]: !n[id] }))

  const amDisprover =
    state.phase === "DISPROVE" && state.pending && state.revealChoices &&
    state.players[state.pending.askIndex]?.id === currentPlayerId
  const revealToMe =
    state.lastReveal && state.lastReveal.toPlayerId === currentPlayerId ? state.lastReveal : null
  const inRoomNow = isMyTurn && me?.inRoom

  return (
    <div className="flex w-full h-full overflow-hidden select-none p-2 gap-3"
      style={{ background: "radial-gradient(1200px 800px at 50% 0%, #2c2013, #1a120a)" }}>
      {/* BOARD */}
      <div className="relative flex items-center justify-center p-2 rounded-2xl border border-[#6b5230]/30 shadow-2xl"
        style={{ background: "linear-gradient(160deg,#2a1e12,#1c140b)" }}>
        <Confetti fire={!!state.winnerId} />
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "min(84vh, 740px)", height: "min(84vh, 740px)" }}
          className="rounded-xl border-[3px] border-[#0f0a05]"
        >
          <defs>
            <linearGradient id="floor" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a1d10" />
              <stop offset="1" stopColor="#1b130a" />
            </linearGradient>
            <linearGradient id="parch" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3a2d1b" />
              <stop offset="1" stopColor="#2c2113" />
            </linearGradient>
            <radialGradient id="lamp" cx="50%" cy="46%" r="55%">
              <stop offset="0" stopColor="#d6a85c" stopOpacity="0.16" />
              <stop offset="70%" stopColor="#d6a85c" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vig" cx="50%" cy="46%" r="72%">
              <stop offset="58%" stopColor="#000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
            </radialGradient>
            <filter id="tok" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.4" stdDeviation="1.1" floodColor="#000" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* wood floor + plank lines */}
          <rect x="0" y="0" width={W} height={H} fill="url(#floor)" />
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1="0" x2={W} y1={(i + 1) * (H / 13)} y2={(i + 1) * (H / 13)} stroke="#000" strokeOpacity="0.14" strokeWidth="0.6" />
          ))}
          <rect x="0" y="0" width={W} height={H} fill="url(#lamp)" />

          {/* corridor cells */}
          {Array.from({ length: BOARD_H }).map((_, y) =>
            Array.from({ length: BOARD_W }).map((_, x) => {
              if (!isCorridor(x, y)) return null
              const k = cellKey(x, y)
              const hot = reachableCells.has(k)
              return (
                <rect
                  key={k}
                  x={x * CELL + 0.4} y={y * CELL + 0.4} width={CELL - 0.8} height={CELL - 0.8} rx={1.2}
                  className={hot ? "cursor-pointer" : ""}
                  fill={hot ? "#d6a85c" : "#3a2c1b"}
                  fillOpacity={hot ? 0.5 : 1}
                  stroke={hot ? "#f0d9a4" : "#4a3826"} strokeWidth={hot ? 0.7 : 0.4}
                  onClick={hot ? () => commit(moveTo(state, { kind: "cell", x, y })) : undefined}
                >
                  {hot && <animate attributeName="fill-opacity" values="0.35;0.7;0.35" dur="1.3s" repeatCount="indefinite" />}
                </rect>
              )
            })
          )}

          {/* cellar / solution vault */}
          <rect
            x={CELLAR_RECT.x1 * CELL} y={CELLAR_RECT.y1 * CELL}
            width={(CELLAR_RECT.x2 - CELLAR_RECT.x1 + 1) * CELL}
            height={(CELLAR_RECT.y2 - CELLAR_RECT.y1 + 1) * CELL}
            rx={3} fill="#0f0a05" stroke="#3a2c1b" strokeWidth={1}
          />
          <text x={(CELLAR_RECT.x1 + CELLAR_RECT.x2 + 1) / 2 * CELL} y={(CELLAR_RECT.y1 + CELLAR_RECT.y2 + 1) / 2 * CELL}
            textAnchor="middle" dominantBaseline="middle" fontSize={6.5} fill="#6b5230" fontWeight="bold"
            letterSpacing="1" style={{ fontFamily: SERIF }}>THE CELLAR</text>

          {/* rooms */}
          {ROOMS.map((room) => {
            const r = room.rect
            const enter = reachableRooms.has(room.id)
            const x = r.x1 * CELL, y = r.y1 * CELL
            const w = (r.x2 - r.x1 + 1) * CELL, h = (r.y2 - r.y1 + 1) * CELL
            return (
              <g key={room.id}>
                <rect x={x} y={y} width={w} height={h} rx={3} fill="url(#parch)"
                  stroke={enter ? "#f0d9a4" : "#6b5230"} strokeWidth={enter ? 2 : 1.2}
                  className={enter ? "cursor-pointer" : ""}
                  onClick={enter ? () => commit(moveTo(state, { kind: "room", room: room.id })) : undefined} />
                <rect x={x} y={y} width={w} height={h} rx={3} fill={ROOM_TINT[room.id]} fillOpacity={enter ? 0.2 : 0.12} pointerEvents="none" />
                {/* big faded room icon */}
                <text x={x + w / 2} y={y + h / 2 + 3} textAnchor="middle" dominantBaseline="middle"
                  fontSize={Math.min(w, h) * 0.42} opacity={0.14} pointerEvents="none">{ROOM_ICON[room.id]}</text>
                {/* brass label */}
                <text x={x + w / 2} y={y + 7.5} textAnchor="middle" fontSize={6} fill="#f0d9a4"
                  fontWeight="bold" letterSpacing="0.3" style={{ fontFamily: SERIF }} pointerEvents="none">{room.name}</text>
                {room.secret && (
                  <text x={x + w - 4.5} y={y + h - 2.5} textAnchor="middle" fontSize={5.5} pointerEvents="none" opacity={0.8}>🗝️</text>
                )}
                {/* weapons (top row) */}
                {roomWeapons[room.id].map((wid, i) => {
                  const { cx, cy } = roomSlot(room.id, i, "top")
                  const wp = WEAPONS.find((w) => w.id === wid)!
                  return (
                    <motion.image key={`w${wid}`} href={wp.image} width={7.5} height={7.5}
                      initial={false} animate={{ x: cx - 3.75, y: cy - 3.75 }}
                      transition={{ type: "spring", stiffness: 180, damping: 20 }}
                      style={{ filter: "url(#tok)" }} preserveAspectRatio="xMidYMid slice" />
                  )
                })}
              </g>
            )
          })}

          {/* suspect pawns (glide to target) */}
          {SUSPECTS.map((s) => {
            const owner = state.players.find((p) => p.suspectId === s.id)
            const isCur = owner && owner.id === cur.id
            const isMe = owner && owner.id === currentPlayerId
            const { cx, cy } = suspectTarget(s.id)
            return (
              <motion.g key={s.id} initial={false} animate={{ x: cx, y: cy }}
                transition={{ type: "spring", stiffness: 170, damping: 22 }} style={{ filter: "url(#tok)" }}>
                {isCur && <circle r={5.4} fill="none" stroke="#f0d9a4" strokeWidth={0.8} opacity={0.9}>
                  <animate attributeName="r" values="4.6;5.8;4.6" dur="1.4s" repeatCount="indefinite" />
                </circle>}
                {/* pawn body */}
                <path d="M -3 3.4 Q -3 0 -1.6 -0.9 Q -2.4 -2 -1.1 -2.9 Q 0 -3.6 1.1 -2.9 Q 2.4 -2 1.6 -0.9 Q 3 0 3 3.4 Z"
                  fill={s.color} stroke="#0f0a05" strokeWidth={0.7} />
                <ellipse cx={-0.7} cy={-1.6} rx={0.9} ry={1.3} fill="#fff" opacity={0.35} />
                {isMe && <circle cx={0} cy={-1.9} r={0.7} fill="#fff" opacity={0.9} />}
              </motion.g>
            )
          })}

          <rect x="0" y="0" width={W} height={H} fill="url(#vig)" pointerEvents="none" />
        </svg>

        {/* Win overlay */}
        <AnimatePresence>
          {state.winnerId && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-x-0 top-6 flex justify-center pointer-events-none">
              <div className="rounded-full border border-[#d6a85c]/50 bg-black/70 px-5 py-2 text-center backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-black text-[#f0d9a4]" style={{ fontFamily: SERIF }}>
                  <Trophy className="h-4 w-4" /> {getPlayerName(state, state.winnerId)} cracked the case!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDE PANEL */}
      <div className="flex flex-col flex-1 min-w-[300px] max-w-[370px] gap-2.5 overflow-hidden py-1">
        {/* Detective roster */}
        <div className="flex items-center gap-1.5">
          {state.players.map((p) => {
            const isCurP = p.id === cur.id
            return (
              <div key={p.id} title={p.name}
                className={`relative grid h-9 w-9 place-items-center rounded-full text-xs font-black transition ${isCurP ? "ring-2 ring-[#f0d9a4] scale-110" : p.eliminated ? "opacity-40 grayscale" : "opacity-80"}`}
                style={{ backgroundColor: p.color, color: "#1a120a" }}>
                {p.name[0]}
                {p.eliminated && <Skull className="absolute h-3 w-3 text-white" />}
                {p.id === currentPlayerId && <span className="absolute -bottom-1 h-1.5 w-1.5 rounded-full bg-[#f0d9a4]" />}
              </div>
            )
          })}
        </div>

        {/* Turn HUD */}
        <div className="glass-strong flex items-center gap-3 p-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl text-base font-black shadow"
            style={{ backgroundColor: cur.color, color: "#1a120a", fontFamily: SERIF }}>{cur.name[0]}</div>
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#d6a85c]">Now investigating</span>
            <h3 className="truncate text-base font-black text-white" style={{ fontFamily: SERIF }}>
              {cur.name}{cur.isBot && <span className="ml-1.5 rounded bg-[#d6a85c]/20 px-1 py-0.5 text-[7px] font-bold text-[#e8c987]">AI</span>}
            </h3>
          </div>
          <span className="rounded-md bg-black/30 px-2 py-1 text-[9px] font-mono font-bold uppercase text-[#d6a85c]">{state.phase}</span>
        </div>

        {/* Private reveal */}
        <AnimatePresence>
          {revealToMe && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-2.5 text-center">
              <p className="text-[10px] text-emerald-300"><strong>{getPlayerName(state, revealToMe.fromPlayerId)}</strong> secretly showed you:</p>
              <p className="mt-0.5 text-sm font-black text-white" style={{ fontFamily: SERIF }}>{cardName(revealToMe.card)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context actions */}
        <div className="glass flex min-h-[104px] flex-col justify-center gap-2 p-3">
          {state.winnerId ? (
            <div className="text-center">
              <Trophy className="mx-auto mb-1 h-7 w-7 text-[#e0b56b]" />
              <p className="text-xs font-bold text-white">{getPlayerName(state, state.winnerId)} solved the case!</p>
            </div>
          ) : amDisprover ? (
            <div>
              <p className="mb-2 text-center text-[10px] font-bold text-[#e8c987]">You can disprove — show one card privately:</p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {state.revealChoices!.map((c) => (
                  <button key={c} onClick={() => commit(respondDisprove(state, c))}
                    className="rounded-lg border border-[#d6a85c]/30 bg-[#d6a85c]/15 px-2.5 py-1.5 text-[10px] font-bold text-[#f0d9a4] hover:bg-[#d6a85c]/30">
                    {cardName(c)}
                  </button>
                ))}
              </div>
            </div>
          ) : state.phase === "DISPROVE" ? (
            <p className="text-center text-[10px] italic text-white/45">Waiting for {getPlayerName(state, state.players[state.pending!.askIndex].id)} to respond…</p>
          ) : !isMyTurn ? (
            <p className="text-center text-[10px] italic text-white/45">Waiting for {cur.name}…</p>
          ) : state.phase === "ROLL" ? (
            <div className="flex flex-col gap-2">
              <button onClick={doRoll} disabled={rolling}
                className="bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase text-white shadow-glow-grape disabled:opacity-70">
                <motion.span animate={rolling ? { rotate: 360 } : {}} transition={{ duration: 0.25, repeat: rolling ? Infinity : 0, ease: "linear" }}>
                  <Dices className="h-4 w-4" />
                </motion.span>
                {rolling ? `Rolling… ${dieFace}` : "Roll the Dice"}
              </button>
              {me?.inRoom && (
                <div className="flex gap-2">
                  <button onClick={() => commit(stayAndSuggest(state))}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-white hover:bg-white/20">
                    <Search className="h-3 w-3 text-[#d6a85c]" /> Stay &amp; Suggest
                  </button>
                  {getRoom(me.inRoom).secret && (
                    <button onClick={() => commit(takeSecretPassage(state))}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-white hover:bg-white/20">
                      <KeyRound className="h-3 w-3 text-[#e0b56b]" /> Secret Passage
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => setShowAccuse(true)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-500/25 bg-red-950/40 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-900/40">
                <Megaphone className="h-3 w-3" /> Make Accusation
              </button>
            </div>
          ) : state.phase === "MOVE" ? (
            <div className="text-center">
              <p className="text-sm font-black text-[#e8c987]" style={{ fontFamily: SERIF }}>🎲 {state.movesLeft} step{state.movesLeft === 1 ? "" : "s"} left</p>
              <p className="mt-0.5 text-[10px] text-white/50">Click a glowing tile or room to move.</p>
            </div>
          ) : state.phase === "ACTION" ? (
            <div className="flex flex-col gap-2">
              {inRoomNow && !state.suggestionMade && (
                <button onClick={() => { setSgSuspect(SUSPECTS[0].id); setSgWeapon(WEAPONS[0].id); setShowSuggest(true) }}
                  className="bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase text-white shadow-glow-grape">
                  <Search className="h-4 w-4" /> Make a Suggestion
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowAccuse(true)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-500/25 bg-red-950/40 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-900/40">
                  <Megaphone className="h-3 w-3" /> Accuse
                </button>
                <button onClick={() => commit(endTurn(state))}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-white hover:bg-white/20">
                  End Turn <ChevronRight className="h-3 w-3 text-[#d6a85c]" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(["notebook", "log"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] font-black uppercase ${tab === t ? "border border-[#d6a85c]/30 bg-[#d6a85c]/15 text-[#f0d9a4]" : "text-white/40"}`}>
              {t === "notebook" ? <NotebookPen className="h-3 w-3" /> : <ScrollText className="h-3 w-3" />}
              {t === "notebook" ? "Notebook" : "Casebook"}
            </button>
          ))}
        </div>

        {tab === "notebook" ? (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl p-3"
            style={{ background: "linear-gradient(#efe3c6,#e6d7b3)", boxShadow: "inset 0 0 30px rgba(120,90,40,0.25)" }}>
            {([["suspect", "Suspects", SUSPECTS.map((s) => s.id)], ["weapon", "Weapons", WEAPONS.map((w) => w.id)], ["room", "Rooms", ROOMS.map((r) => r.id)]] as const).map(([cat, label, ids]) => (
              <div key={cat} className="mb-3">
                <h4 className="mb-1 border-b border-[#b89a5e]/50 pb-0.5 text-[10px] font-black uppercase tracking-wider text-[#7d5a24]" style={{ fontFamily: SERIF }}>{label}</h4>
                {ids.map((id) => {
                  const ruledOut = knownToMe.has(id) || notes[id]
                  const locked = knownToMe.has(id)
                  return (
                    <button key={id} disabled={locked} onClick={() => toggleNote(id)}
                      className={`flex w-full items-center justify-between px-1 py-0.5 text-[11px] ${ruledOut ? "text-[#a98f5e] line-through" : "text-[#3a2c14] hover:bg-[#00000010]"}`}>
                      <span>{cardName(id)}</span>
                      <span className={`text-[10px] font-black ${locked ? "text-emerald-700" : ruledOut ? "text-red-700/70" : "text-[#b89a5e]"}`}>
                        {locked ? "✓" : ruledOut ? "✗" : "?"}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <p className="text-[8px] italic text-[#9a7d45]">Cards in your hand or shown to you are ticked. Tap the rest to cross off your own deductions.</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/30 p-3">
            {state.log.slice().reverse().map((m, i) => (
              <div key={i} className="border-b border-white/5 pb-1 text-[10px] leading-relaxed text-white/55">{m}</div>
            ))}
          </div>
        )}
      </div>

      {/* SUGGESTION DIALOG */}
      <AnimatePresence>
        {showSuggest && inRoomNow && (
          <Dialog onClose={() => setShowSuggest(false)} title={`Suggestion — the ${getRoom(me!.inRoom!).name}`}>
            <Picker label="Suspect" options={SUSPECTS.map((s) => ({ id: s.id, name: s.name, color: s.color }))} value={sgSuspect} onChange={setSgSuspect} />
            <Picker label="Weapon" options={WEAPONS.map((w) => ({ id: w.id, name: w.name, image: w.image }))} value={sgWeapon} onChange={setSgWeapon} />
            <p className="text-center text-[10px] text-white/45">The room is fixed to where you stand.</p>
            <button onClick={() => { commit(makeSuggestion(state, sgSuspect, sgWeapon)); setShowSuggest(false) }}
              className="bg-brand mt-1 w-full rounded-xl py-2.5 text-xs font-black uppercase text-white">Suggest</button>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ACCUSATION DIALOG */}
      <AnimatePresence>
        {showAccuse && isMyTurn && (
          <Dialog onClose={() => setShowAccuse(false)} title="Final Accusation" danger>
            <p className="-mt-1 text-center text-[10px] text-red-300">Wrong, and you're out of the case. Choose carefully.</p>
            <Picker label="Suspect" options={SUSPECTS.map((s) => ({ id: s.id, name: s.name, color: s.color }))} value={acSuspect} onChange={setAcSuspect} />
            <Picker label="Weapon" options={WEAPONS.map((w) => ({ id: w.id, name: w.name, image: w.image }))} value={acWeapon} onChange={setAcWeapon} />
            <Picker label="Room" options={ROOMS.map((r) => ({ id: r.id, name: r.name }))} value={acRoom} onChange={(v) => setAcRoom(v as RoomId)} />
            <button onClick={() => { commit(makeAccusation(state, acSuspect, acWeapon, acRoom)); setShowAccuse(false) }}
              className="mt-1 w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-black uppercase text-white">Accuse!</button>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Small UI helpers -------------------------------------------------------

function Dialog({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`relative z-10 flex w-full max-w-xs flex-col gap-3 rounded-2xl border p-5 shadow-2xl ${danger ? "border-red-500/30" : "border-[#6b5230]/50"}`}
        style={{ background: "linear-gradient(160deg,#2a2013,#211a10)" }}>
        <h3 className={`text-base font-black uppercase tracking-wider ${danger ? "text-red-400" : "text-[#e8c987]"}`} style={{ fontFamily: SERIF }}>{title}</h3>
        {children}
      </motion.div>
    </div>
  )
}

function Picker({ label, options, value, onChange }: {
  label: string
  options: { id: string; name: string; color?: string; image?: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="text-[9px] font-black uppercase tracking-wider text-white/45">{label}</span>
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-[10px] font-bold transition ${value === o.id ? "border-[#d6a85c]/50 bg-[#d6a85c]/20 text-white" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"}`}>
            {o.image
              ? <img src={o.image} alt="" className="h-8 w-8 flex-shrink-0 rounded border border-white/10 object-cover" />
              : o.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.color }} />}
            <span className="truncate">{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
