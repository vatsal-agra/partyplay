// Mystery Manor — board container. Renders the real-time 3D mansion (loaded
// client-only) plus the detective HUD. All game logic flows through the pure
// engine; this component only wires interaction and presentation.
"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  MysteryState,
  rollDice, moveTo, takeSecretPassage, stayAndSuggest, makeSuggestion,
  respondDisprove, makeAccusation, endTurn, playBotStep,
  getReachable, cardName, getPlayerName,
} from "../lib/mysteryEngine"
import { ROOMS, SUSPECTS, WEAPONS, RoomId, getRoom, cellKey } from "../lib/mansionLayout"
import { Confetti } from "@/components/Confetti"
import { Dices, KeyRound, Search, Megaphone, ChevronRight, NotebookPen, ScrollText, Trophy, Skull, Loader2 } from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const MansionScene3D = dynamic(() => import("./MansionScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#140d07]">
      <div className="flex flex-col items-center gap-3 text-[#d6a85c]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Lighting the manor…</p>
      </div>
    </div>
  ),
})

interface Props {
  state: MysteryState
  currentPlayerId: string
  onStateChange: (s: MysteryState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

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

  const commit = (next: MysteryState) => {
    onStateChange(next)
    onBroadcastAction?.("sync_state", next)
  }

  const cur = state.players[state.currentPlayerIndex]
  const isMyTurn = cur.id === currentPlayerId && !state.winnerId
  const me = state.players.find((p) => p.id === currentPlayerId)

  const doRoll = () => {
    if (rolling) return
    setRolling(true)
    setTimeout(() => { setRolling(false); commit(rollDice(state)) }, 850)
  }

  // ---- Bot driver -----------------------------------------------------------
  useEffect(() => {
    if (state.winnerId) return
    if (!cur.isBot) return
    if (!["ROLL", "MOVE", "ACTION"].includes(state.phase)) return
    const t = setTimeout(() => commit(playBotStep(state)), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.phase, state.suggestionMade, state.winnerId, state.pending])

  // ---- Reachable set (feeds the 3D board's clickable tiles/rooms) -----------
  const reach = useMemo(() => {
    if (!isMyTurn || state.phase !== "MOVE") return null
    return getReachable(state, state.currentPlayerIndex)
  }, [state, isMyTurn])
  const reachCellKeys = useMemo(() => {
    const s = new Set<string>()
    reach?.cells.forEach((c) => s.add(cellKey(c.x, c.y)))
    return s
  }, [reach])
  const reachRoomIds = useMemo(() => new Set<string>(reach?.rooms.map((r) => r.room) ?? []), [reach])

  const knownToMe = new Set(me?.known ?? [])
  const toggleNote = (id: string) => setNotes((n) => ({ ...n, [id]: !n[id] }))

  const amDisprover =
    state.phase === "DISPROVE" && state.pending && state.revealChoices &&
    state.players[state.pending.askIndex]?.id === currentPlayerId
  const revealToMe =
    state.lastReveal && state.lastReveal.toPlayerId === currentPlayerId ? state.lastReveal : null
  const inRoomNow = isMyTurn && me?.inRoom

  return (
    <div className="flex h-full w-full overflow-hidden select-none" style={{ background: "#140d07" }}>
      {/* 3D BOARD */}
      <div className="relative h-full flex-1 min-w-0">
        <MansionScene3D
          state={state}
          currentPlayerId={currentPlayerId}
          reachCellKeys={reachCellKeys}
          reachRoomIds={reachRoomIds}
          rolling={rolling}
          onMoveCell={(x, y) => commit(moveTo(state, { kind: "cell", x, y }))}
          onMoveRoom={(room) => commit(moveTo(state, { kind: "room", room }))}
        />
        <Confetti fire={!!state.winnerId} />

        {/* orbit hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/40 backdrop-blur lg:block">
          drag to orbit · scroll to zoom
        </div>

        {/* Your case cards — the hand you were dealt (your evidence), shown as
            real cards so you can see them, not just ticks in the notebook. */}
        {me && me.hand.length > 0 && (() => {
          const ROOM_ICON: Record<string, string> = {
            kitchen: '🍳', ballroom: '🎭', conservatory: '🪴', dining: '🍷',
            billiard: '🎱', library: '📚', lounge: '🛋️', hall: '🏛️', study: '📜',
          }
          return (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-center pb-1">
              <div className="flex items-end">
                {me.hand.map((id, i) => {
                  const suspect = SUSPECTS.find((s) => s.id === id)
                  const weapon = WEAPONS.find((w) => w.id === id)
                  return (
                    <div key={id}
                      className="h-[74px] w-[50px] flex-shrink-0 overflow-hidden rounded-lg border-2 shadow-lg"
                      style={{ marginLeft: i === 0 ? 0 : -18, borderColor: suspect ? suspect.color : '#6b5230', background: 'linear-gradient(160deg,#2a2013,#171009)' }}>
                      <div className="flex h-full flex-col items-center justify-between p-1">
                        <span className="h-2 w-full rounded-sm" style={{ backgroundColor: suspect ? suspect.color : weapon ? '#8a6a34' : '#4a3b6b' }} />
                        <div className="flex flex-1 items-center justify-center">
                          {weapon ? (
                            <img src={weapon.image} alt="" className="h-8 w-8 object-contain" />
                          ) : suspect ? (
                            <span className="grid h-7 w-7 place-items-center rounded-full text-xs font-black text-[#1a120a]" style={{ backgroundColor: suspect.color }}>{suspect.name[0]}</span>
                          ) : (
                            <span className="text-2xl">{ROOM_ICON[id] || '🚪'}</span>
                          )}
                        </div>
                        <span className="text-center text-[6.5px] font-black uppercase leading-tight tracking-wide text-[#e8c987]">{cardName(id)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

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
      <div className="flex w-[320px] max-w-[340px] flex-shrink-0 flex-col gap-2.5 overflow-hidden border-l border-[#6b5230]/30 bg-[#1b130b] p-2.5">
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
          <div className="min-w-0 flex-1">
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
                <motion.span animate={rolling ? { rotate: 360 } : {}} transition={{ duration: 0.3, repeat: rolling ? Infinity : 0, ease: "linear" }}>
                  <Dices className="h-4 w-4" />
                </motion.span>
                {rolling ? "Rolling…" : "Roll the Dice"}
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
              <p className="mt-0.5 text-[10px] text-white/50">Click a glowing tile or room on the board.</p>
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
