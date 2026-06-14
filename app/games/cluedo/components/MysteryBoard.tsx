// Mystery Manor — board UI. Renders the grid mansion, drives turns, and
// presents suggestion / disprove / accusation flows and the detective notebook.
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MysteryState, MoveDest, RoomId as EngineRoomId,
  rollDice, moveTo, takeSecretPassage, stayAndSuggest, makeSuggestion,
  respondDisprove, makeAccusation, endTurn, playBotStep,
  getReachable, cardName, getPlayerName,
} from "../lib/mysteryEngine"
import {
  ROOMS, SUSPECTS, WEAPONS, CELLAR_RECT, RoomId, getRoom, cellKey, isCorridor,
  BOARD_W, BOARD_H,
} from "../lib/mansionLayout"
import { Dices, KeyRound, Search, Megaphone, ChevronRight, NotebookPen, ScrollText, Trophy } from "lucide-react"

const CELL = 10
const W = BOARD_W * CELL
const H = BOARD_H * CELL

interface Props {
  state: MysteryState
  currentPlayerId: string
  onStateChange: (s: MysteryState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

type TokenPos = { type: 'room'; room: RoomId } | { type: 'cell'; x: number; y: number }

export default function MysteryBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [showSuggest, setShowSuggest] = useState(false)
  const [showAccuse, setShowAccuse] = useState(false)
  const [sgSuspect, setSgSuspect] = useState<string>(SUSPECTS[0].id)
  const [sgWeapon, setSgWeapon] = useState<string>(WEAPONS[0].id)
  const [acSuspect, setAcSuspect] = useState<string>(SUSPECTS[0].id)
  const [acWeapon, setAcWeapon] = useState<string>(WEAPONS[0].id)
  const [acRoom, setAcRoom] = useState<RoomId>(ROOMS[0].id)
  const [notes, setNotes] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<'notebook' | 'log'>('notebook')

  const commit = (next: MysteryState) => {
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  const cur = state.players[state.currentPlayerIndex]
  const isMyTurn = cur.id === currentPlayerId && !state.winnerId
  const me = state.players.find((p) => p.id === currentPlayerId)

  // ---- Bot driver -----------------------------------------------------------
  useEffect(() => {
    if (state.winnerId) return
    if (!cur.isBot) return
    if (!['ROLL', 'MOVE', 'ACTION'].includes(state.phase)) return
    const t = setTimeout(() => commit(playBotStep(state)), 900)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.phase, state.suggestionMade, state.winnerId, state.pending])

  // ---- Reachable set for the current human move -----------------------------
  const reach = useMemo(() => {
    if (!isMyTurn || state.phase !== 'MOVE') return null
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
        if (owner.inRoom) map[s.id] = { type: 'room', room: owner.inRoom }
        else if (owner.cell) map[s.id] = { type: 'cell', x: owner.cell.x, y: owner.cell.y }
      } else {
        const loc = state.suspectLocations[s.id]
        map[s.id] = loc ? { type: 'room', room: loc } : { type: 'cell', x: s.start.x, y: s.start.y }
      }
    })
    return map
  }, [state])

  // Group tokens per room for tidy in-room layout.
  const roomTokens = useMemo(() => {
    const byRoom: Record<string, { kind: 'suspect' | 'weapon'; id: string; color?: string }[]> = {}
    ROOMS.forEach((r) => (byRoom[r.id] = []))
    SUSPECTS.forEach((s) => {
      const pos = suspectPositions[s.id]
      if (pos?.type === 'room') byRoom[pos.room].push({ kind: 'suspect', id: s.id, color: s.color })
    })
    WEAPONS.forEach((w) => {
      const room = state.weaponLocations[w.id]
      if (room) byRoom[room].push({ kind: 'weapon', id: w.id })
    })
    return byRoom
  }, [state, suspectPositions])

  const slotInRoom = (room: RoomId, i: number) => {
    const r = getRoom(room).rect
    const cols = 3
    const cx = (r.x1 + 0.7 + (i % cols) * 1.6) * CELL
    const cy = (r.y1 + 1.6 + Math.floor(i / cols) * 1.6) * CELL
    return { cx, cy }
  }

  // ---- Notebook -------------------------------------------------------------
  const knownToMe = new Set(me?.known ?? [])
  const toggleNote = (id: string) => setNotes((n) => ({ ...n, [id]: !n[id] }))

  // ---- Actions --------------------------------------------------------------
  const amDisprover =
    state.phase === 'DISPROVE' && state.pending && state.revealChoices &&
    state.players[state.pending.askIndex]?.id === currentPlayerId

  const revealToMe =
    state.lastReveal && state.lastReveal.toPlayerId === currentPlayerId
      ? state.lastReveal : null

  const inRoomNow = isMyTurn && me?.inRoom

  return (
    <div className="flex w-full h-full overflow-hidden bg-slate-950 select-none p-2 gap-3">
      {/* BOARD */}
      <div className="flex items-center justify-center p-2 bg-slate-900/40 rounded-2xl border border-white/5 shadow-2xl">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: 'min(82vh, 720px)', height: 'min(82vh, 720px)' }}
          className="rounded-xl bg-[#1a2433] border-[3px] border-[#0b1220] shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
        >
          {/* corridor cells */}
          {Array.from({ length: BOARD_H }).map((_, y) =>
            Array.from({ length: BOARD_W }).map((_, x) => {
              if (!isCorridor(x, y)) return null
              const k = cellKey(x, y)
              const hot = reachableCells.has(k)
              return (
                <rect
                  key={k}
                  x={x * CELL} y={y * CELL} width={CELL} height={CELL}
                  className={hot ? "cursor-pointer" : ""}
                  fill={hot ? "#fbbf2455" : "#2b3a52"}
                  stroke="#1a2433" strokeWidth={0.6}
                  onClick={hot ? () => commit(moveTo(state, { kind: 'cell', x, y })) : undefined}
                >
                  {hot && <animate attributeName="opacity" values="0.6;1;0.6" dur="1.4s" repeatCount="indefinite" />}
                </rect>
              )
            }),
          )}

          {/* cellar */}
          <rect
            x={CELLAR_RECT.x1 * CELL} y={CELLAR_RECT.y1 * CELL}
            width={(CELLAR_RECT.x2 - CELLAR_RECT.x1 + 1) * CELL}
            height={(CELLAR_RECT.y2 - CELLAR_RECT.y1 + 1) * CELL}
            fill="#0b1220" stroke="#000" strokeWidth={1}
          />
          <text x={(CELLAR_RECT.x1 + CELLAR_RECT.x2 + 1) / 2 * CELL} y={(CELLAR_RECT.y1 + CELLAR_RECT.y2 + 1) / 2 * CELL}
            textAnchor="middle" dominantBaseline="middle" fontSize={7} fill="#475569" fontWeight="bold">CELLAR</text>

          {/* rooms */}
          {ROOMS.map((room) => {
            const r = room.rect
            const enter = reachableRooms.has(room.id)
            const x = r.x1 * CELL, y = r.y1 * CELL
            const w = (r.x2 - r.x1 + 1) * CELL, h = (r.y2 - r.y1 + 1) * CELL
            return (
              <g key={room.id}>
                <rect
                  x={x} y={y} width={w} height={h} rx={3}
                  fill={enter ? "#7c5cff44" : "#3a2c52"}
                  stroke={enter ? "#a78bfa" : "#5b4a7a"} strokeWidth={enter ? 1.6 : 1}
                  className={enter ? "cursor-pointer" : ""}
                  onClick={enter ? () => commit(moveTo(state, { kind: 'room', room: room.id })) : undefined}
                />
                <text x={x + w / 2} y={y + 8} textAnchor="middle" fontSize={6.5} fill="#e9d5ff" fontWeight="bold" pointerEvents="none">
                  {room.name}
                </text>
                {/* in-room tokens */}
                {roomTokens[room.id].map((tk, i) => {
                  const { cx, cy } = slotInRoom(room.id, i)
                  if (tk.kind === 'suspect') {
                    const owner = state.players.find((p) => p.suspectId === tk.id)
                    const isCur = owner && owner.id === cur.id
                    return (
                      <circle key={`s${tk.id}`} cx={cx} cy={cy} r={3.4} fill={tk.color}
                        stroke={isCur ? "#fff" : "#000"} strokeWidth={isCur ? 1.4 : 0.8} />
                    )
                  }
                  return (
                    <text key={`w${tk.id}`} x={cx} y={cy + 2} textAnchor="middle" fontSize={6}>
                      {WEAPONS.find((w) => w.id === tk.id)?.icon}
                    </text>
                  )
                })}
                {/* secret passage marker */}
                {room.secret && (
                  <text x={x + w - 5} y={y + h - 3} textAnchor="middle" fontSize={6} pointerEvents="none">🗝️</text>
                )}
              </g>
            )
          })}

          {/* corridor suspect tokens */}
          {SUSPECTS.map((s) => {
            const pos = suspectPositions[s.id]
            if (pos?.type !== 'cell') return null
            const owner = state.players.find((p) => p.suspectId === s.id)
            const isCur = owner && owner.id === cur.id
            return (
              <circle key={s.id} cx={pos.x * CELL + CELL / 2} cy={pos.y * CELL + CELL / 2} r={3.6}
                fill={s.color} stroke={isCur ? "#fff" : "#0b1220"} strokeWidth={isCur ? 1.6 : 0.9} />
            )
          })}
        </svg>
      </div>

      {/* SIDE PANEL */}
      <div className="flex flex-col flex-1 min-w-[300px] max-w-[360px] gap-3 overflow-hidden py-1">
        {/* Turn HUD */}
        <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border-2 border-white/40 flex items-center justify-center text-xs font-black"
            style={{ backgroundColor: cur.color, color: '#000' }}>
            {cur.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[8px] font-black uppercase text-pink-400 tracking-widest">Current Sleuth</span>
            <h3 className="text-sm font-black text-white truncate">{cur.name}{cur.isBot && <span className="ml-1.5 text-[7px] bg-pink-500/20 text-pink-300 px-1 py-0.5 rounded">AI</span>}</h3>
          </div>
          <span className="text-[10px] text-pink-400 font-mono font-bold uppercase">{state.phase}</span>
        </div>

        {/* Private reveal */}
        <AnimatePresence>
          {revealToMe && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-emerald-500/15 border border-emerald-500/40 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-emerald-300">
                <strong>{getPlayerName(state, revealToMe.fromPlayerId)}</strong> secretly showed you:
              </p>
              <p className="text-sm font-black text-white mt-0.5">{cardName(revealToMe.card)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context actions */}
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3 flex flex-col gap-2 min-h-[96px] justify-center">
          {state.winnerId ? (
            <div className="text-center">
              <Trophy className="w-7 h-7 text-yellow-400 mx-auto mb-1" />
              <p className="text-xs text-white font-bold">{getPlayerName(state, state.winnerId)} solved the case!</p>
            </div>
          ) : amDisprover ? (
            <div>
              <p className="text-[10px] text-pink-300 font-bold mb-2 text-center">You can disprove — choose a card to show privately:</p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {state.revealChoices!.map((c) => (
                  <button key={c} onClick={() => commit(respondDisprove(state, c))}
                    className="px-2.5 py-1.5 bg-pink-500/20 hover:bg-pink-500/35 text-pink-200 text-[10px] font-bold rounded-lg border border-pink-500/30">
                    {cardName(c)}
                  </button>
                ))}
              </div>
            </div>
          ) : state.phase === 'DISPROVE' ? (
            <p className="text-[10px] text-slate-400 italic text-center">
              Waiting for {getPlayerName(state, state.players[state.pending!.askIndex].id)} to respond…
            </p>
          ) : !isMyTurn ? (
            <p className="text-[10px] text-slate-400 italic text-center">Waiting for {cur.name}…</p>
          ) : state.phase === 'ROLL' ? (
            <div className="flex flex-col gap-2">
              <button onClick={() => commit(rollDice(state))}
                className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2">
                <Dices className="w-4 h-4" /> Roll Dice
              </button>
              {me?.inRoom && (
                <div className="flex gap-2">
                  <button onClick={() => commit(stayAndSuggest(state))}
                    className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                    <Search className="w-3 h-3 text-pink-400" /> Stay & Suggest
                  </button>
                  {getRoom(me.inRoom).secret && (
                    <button onClick={() => commit(takeSecretPassage(state))}
                      className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                      <KeyRound className="w-3 h-3 text-amber-400" /> Secret Passage
                    </button>
                  )}
                </div>
              )}
              <button onClick={() => setShowAccuse(true)}
                className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-300 text-[10px] font-bold rounded-lg border border-red-500/20 flex items-center justify-center gap-1">
                <Megaphone className="w-3 h-3" /> Make Accusation
              </button>
            </div>
          ) : state.phase === 'MOVE' ? (
            <p className="text-[11px] text-amber-300 text-center font-medium">
              🎲 Moves left: <strong>{state.movesLeft}</strong><br />
              <span className="text-slate-400 text-[10px]">Click a glowing tile or room to move.</span>
            </p>
          ) : state.phase === 'ACTION' ? (
            <div className="flex flex-col gap-2">
              {inRoomNow && !state.suggestionMade && (
                <button onClick={() => { setSgSuspect(SUSPECTS[0].id); setSgWeapon(WEAPONS[0].id); setShowSuggest(true) }}
                  className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" /> Make a Suggestion
                </button>
              )}
              <div className="flex gap-2">
                <button onClick={() => setShowAccuse(true)}
                  className="flex-1 py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-300 text-[10px] font-bold rounded-lg border border-red-500/20 flex items-center justify-center gap-1">
                  <Megaphone className="w-3 h-3" /> Accuse
                </button>
                <button onClick={() => commit(endTurn(state))}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                  End Turn <ChevronRight className="w-3 h-3 text-pink-400" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Tabs: notebook / log */}
        <div className="flex gap-1">
          {(['notebook', 'log'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg flex items-center justify-center gap-1 ${tab === t ? 'bg-pink-500/15 text-pink-300 border border-pink-500/25' : 'text-slate-500'}`}>
              {t === 'notebook' ? <NotebookPen className="w-3 h-3" /> : <ScrollText className="w-3 h-3" />}
              {t === 'notebook' ? 'Notebook' : 'Casebook'}
            </button>
          ))}
        </div>

        {tab === 'notebook' ? (
          <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-white/10 rounded-2xl p-3 scrollbar-thin min-h-0">
            {([['suspect', 'Suspects', SUSPECTS.map(s => s.id)], ['weapon', 'Weapons', WEAPONS.map(w => w.id)], ['room', 'Rooms', ROOMS.map(r => r.id)]] as const).map(([cat, label, ids]) => (
              <div key={cat} className="mb-3">
                <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-1">{label}</h4>
                {ids.map((id) => {
                  const ruledOut = knownToMe.has(id) || notes[id]
                  const locked = knownToMe.has(id)
                  return (
                    <button key={id} disabled={locked} onClick={() => toggleNote(id)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] mb-0.5 ${ruledOut ? 'bg-white/5 text-slate-500 line-through' : 'text-white hover:bg-white/5'}`}>
                      <span>{cardName(id)}</span>
                      <span className={`text-[8px] font-bold ${locked ? 'text-emerald-400' : ruledOut ? 'text-pink-400' : 'text-slate-600'}`}>
                        {locked ? 'KNOWN' : ruledOut ? '✗' : '?'}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
            <p className="text-[8px] text-slate-600 italic">Cards in your hand or shown to you are marked KNOWN. Tap others to track your own deductions.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto bg-slate-950/60 border border-white/10 rounded-2xl p-3 scrollbar-thin min-h-0 space-y-1">
            {state.log.slice().reverse().map((m, i) => (
              <div key={i} className="text-[9px] text-slate-400 leading-relaxed border-b border-white/5 pb-1">{m}</div>
            ))}
          </div>
        )}
      </div>

      {/* SUGGESTION DIALOG */}
      <AnimatePresence>
        {showSuggest && inRoomNow && (
          <Dialog onClose={() => setShowSuggest(false)} title={`Suggest — in the ${getRoom(me!.inRoom!).name}`}>
            <Picker label="Suspect" options={SUSPECTS.map(s => ({ id: s.id, name: s.name, color: s.color }))} value={sgSuspect} onChange={setSgSuspect} />
            <Picker label="Weapon" options={WEAPONS.map(w => ({ id: w.id, name: `${w.icon} ${w.name}` }))} value={sgWeapon} onChange={setSgWeapon} />
            <p className="text-[10px] text-slate-400 text-center">Room is fixed to where you stand.</p>
            <button onClick={() => { commit(makeSuggestion(state, sgSuspect, sgWeapon)); setShowSuggest(false) }}
              className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-xs uppercase rounded-xl mt-1">
              Suggest
            </button>
          </Dialog>
        )}
      </AnimatePresence>

      {/* ACCUSATION DIALOG */}
      <AnimatePresence>
        {showAccuse && isMyTurn && (
          <Dialog onClose={() => setShowAccuse(false)} title="Final Accusation" danger>
            <p className="text-[10px] text-red-300 text-center -mt-1">Wrong and you're out of the game. Choose carefully.</p>
            <Picker label="Suspect" options={SUSPECTS.map(s => ({ id: s.id, name: s.name, color: s.color }))} value={acSuspect} onChange={setAcSuspect} />
            <Picker label="Weapon" options={WEAPONS.map(w => ({ id: w.id, name: `${w.icon} ${w.name}` }))} value={acWeapon} onChange={setAcWeapon} />
            <Picker label="Room" options={ROOMS.map(r => ({ id: r.id, name: r.name }))} value={acRoom} onChange={(v) => setAcRoom(v as RoomId)} />
            <button onClick={() => { commit(makeAccusation(state, acSuspect, acWeapon, acRoom)); setShowAccuse(false) }}
              className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-xs uppercase rounded-xl mt-1">
              Accuse!
            </button>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Small UI helpers -------------------------------------------------------

function Dialog({ title, children, onClose, danger }: { title: string; children: React.ReactNode; onClose: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`relative z-10 w-full max-w-xs bg-slate-900 border ${danger ? 'border-red-500/30' : 'border-white/10'} rounded-2xl p-5 shadow-2xl flex flex-col gap-3`}>
        <h3 className={`text-sm font-black uppercase tracking-wider ${danger ? 'text-red-400' : 'text-pink-400'}`}>{title}</h3>
        {children}
      </motion.div>
    </div>
  )
}

function Picker({ label, options, value, onChange }: {
  label: string
  options: { id: string; name: string; color?: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">{label}</span>
      <div className="grid grid-cols-2 gap-1.5 mt-1">
        {options.map((o) => (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-2 py-1.5 rounded-lg text-[10px] font-bold text-left flex items-center gap-1.5 border transition ${value === o.id ? 'bg-pink-500/20 border-pink-500/40 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
            {o.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: o.color }} />}
            <span className="truncate">{o.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
