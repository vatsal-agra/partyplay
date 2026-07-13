// Naval Clash — board container. Renders the real-time 3D ocean battle (loaded
// client-only) plus the admiral's HUD. Every shot is computed through the pure
// engine at click time, flown as a missile, and committed at the moment of
// impact so the whole table sees the shell land before the result appears.
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  BattleshipState, Orientation, GRID, FLEET,
  placeShip, randomPlace, setReady, fire, playBotStep, canPlace, cellKey,
  getPlayerName, initializeGame,
} from "../lib/battleshipEngine"
import type { Flight } from "./NavalScene3D"
import { Confetti } from "@/components/Confetti"
import {
  Ship, RotateCw, Shuffle, Crosshair, Anchor, Trophy, Waves, Loader2,
  Crown, RotateCcw, Share2, Eye, LogOut, Target,
} from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const NavalScene3D = dynamic(() => import("./NavalScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0a141d]">
      <div className="flex flex-col items-center gap-3 text-[#7fb6cc]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Putting out to sea…</p>
      </div>
    </div>
  ),
})

interface Props {
  state: BattleshipState
  currentPlayerId: string
  onStateChange: (s: BattleshipState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

const shotSig = (s: BattleshipState["lastShot"]) => (s ? `${s.byId}:${s.x},${s.y}:${s.result}` : "")

export default function BattleshipBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [selectedShip, setSelectedShip] = useState<string>(FLEET[0].id)
  const [orientation, setOrientation] = useState<Orientation>("H")
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  // Active missile: engine result pre-computed, state committed at impact.
  const [flight, setFlight] = useState<(Flight & { next: BattleshipState }) | null>(null)
  const flightId = useRef(0)
  // Signature of the lastShot we already animated (or arrived pre-animated).
  const processedShot = useRef(shotSig(state.lastShot))
  const [endDismissed, setEndDismissed] = useState(false)

  const commit = (next: BattleshipState) => {
    onStateChange(next)
    onBroadcastAction?.("sync_state", next)
  }

  const meIndex = Math.max(0, state.players.findIndex((p) => p.id === currentPlayerId))
  const me = state.players[meIndex]
  const opp = state.players[1 - meIndex]
  const isMyTurn = state.phase === "BATTLE" && state.players[state.currentPlayerIndex].id === me.id
  const placing = state.phase === "PLACEMENT" && !me.ready

  useEffect(() => {
    if (!state.winnerId) setEndDismissed(false)
  }, [state.winnerId])

  const launchFlight = (next: BattleshipState, incoming: boolean) => {
    const shot = next.lastShot!
    processedShot.current = shotSig(shot)
    setFlight({ id: ++flightId.current, targetX: shot.x, targetY: shot.y, result: shot.result, incoming, next })
  }

  // ---- Bot driver -------------------------------------------------------------
  useEffect(() => {
    if (state.winnerId || flight) return
    if (state.phase === "PLACEMENT") {
      if (state.players.some((p) => p.isBot && !p.ready)) {
        const t = setTimeout(() => commit(playBotStep(state)), 500)
        return () => clearTimeout(t)
      }
    } else if (state.phase === "BATTLE") {
      if (state.players[state.currentPlayerIndex].isBot) {
        // Compute the bot's shot now, but fly the shell before committing it.
        const t = setTimeout(() => {
          const next = playBotStep(state)
          if (next !== state && next.lastShot) launchFlight(next, next.lastShot.byId !== me.id)
        }, 900)
        return () => clearTimeout(t)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentPlayerIndex, state.players.map((p) => p.ready).join(), state.winnerId, flight])

  // ---- Remote shots (a human opponent fired) — replay the shell locally --------
  useEffect(() => {
    const sig = shotSig(state.lastShot)
    if (!sig || sig === processedShot.current) return
    processedShot.current = sig
    const shot = state.lastShot!
    // State is already committed remotely; fly the shell for drama only.
    setFlight({
      id: ++flightId.current,
      targetX: shot.x, targetY: shot.y, result: shot.result,
      incoming: shot.byId !== me.id,
      next: state,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.lastShot])

  // ---- Firing (mine) ------------------------------------------------------------
  const fireAt = (x: number, y: number) => {
    if (!isMyTurn || flight || me.shots[cellKey(x, y)]) return
    const next = fire(state, x, y)
    if (next === state || !next.lastShot) return
    launchFlight(next, false)
  }

  const handleImpact = () => {
    if (!flight) return
    if (flight.next !== state) commit(flight.next)
    setFlight(null)
  }

  // Safety net: the scene reports impact from its render loop, which browsers
  // suspend in hidden tabs. If the shell hasn't landed after its flight time,
  // commit anyway so an alt-tabbed player never soft-locks the turn.
  useEffect(() => {
    if (!flight) return
    const t = setTimeout(() => {
      if (flight.next !== state) commit(flight.next)
      setFlight(null)
    }, 2000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.id])

  // ---- Placement helpers ----------------------------------------------------------
  const previewCells = useMemo(() => {
    if (!placing || !hover) return null
    const ship = me.ships.find((s) => s.id === selectedShip)
    if (!ship) return null
    const ok = canPlace(me, ship.size, hover.x, hover.y, orientation, ship.id)
    const cells: { x: number; y: number }[] = []
    for (let i = 0; i < ship.size; i++) {
      cells.push(orientation === "H" ? { x: hover.x + i, y: hover.y } : { x: hover.x, y: hover.y + i })
    }
    return { cells: cells.filter((c) => c.x < GRID && c.y < GRID), ok }
  }, [placing, me, hover, selectedShip, orientation])

  const handlePlace = (x: number, y: number) => {
    const next = placeShip(state, me.id, selectedShip, x, y, orientation)
    if (next === state) return
    commit(next)
    const board = next.players.find((p) => p.id === me.id)!
    const nextShip = board.ships.find((s) => s.cells.length < s.size)
    if (nextShip) setSelectedShip(nextShip.id)
  }

  const allPlaced = me.ships.every((s) => s.cells.length === s.size)

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot }))))
  }

  // Health pips for a fleet list entry.
  const ShipStatus = ({ s, hidden }: { s: (typeof me.ships)[number]; hidden?: boolean }) => (
    <div className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${s.sunk ? "bg-red-950/40 opacity-70" : "bg-white/5"}`}>
      <span className={`flex items-center gap-1.5 text-[10px] font-bold ${s.sunk ? "text-red-300 line-through" : "text-white/85"}`}>
        <Ship className="h-3 w-3 text-[#7fb6cc]" /> {s.name}
      </span>
      <span className="flex gap-0.5">
        {Array.from({ length: s.size }).map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-sm ${
            s.sunk ? "bg-red-500"
            : hidden ? "bg-white/20"
            : i < s.hits ? "bg-orange-400" : "bg-emerald-400"
          }`} />
        ))}
      </span>
    </div>
  )

  return (
    <div className="flex h-full w-full select-none overflow-hidden gap-2.5 p-2 text-[#dbe7ee]" style={{ background: "#0a141d" }}>
      {/* 3D OCEAN */}
      <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#28455a]/50">
        <NavalScene3D
          state={state}
          meIndex={meIndex}
          isMyTurn={isMyTurn}
          canFire={isMyTurn && !flight && !state.winnerId}
          flight={flight}
          onImpact={handleImpact}
          onFireCell={fireAt}
          placing={placing}
          previewCells={previewCells}
          onHoverCell={setHover}
          onClickOwnCell={handlePlace}
        />
        <Confetti fire={!!state.winnerId} />

        {/* waters labels */}
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full border border-red-400/25 bg-black/45 px-4 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-red-300/90 backdrop-blur">
          Enemy Waters
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-[#7fb6cc]/25 bg-black/45 px-4 py-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#9fd0e2]/90 backdrop-blur">
          Your Fleet
        </div>

        {/* live battle feed */}
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

        {/* orbit hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/35 backdrop-blur lg:block">
          drag to orbit · scroll to zoom
        </div>

        {/* Full-board victory screen */}
        <AnimatePresence>
          {state.winnerId && !endDismissed && (
            <NavalEndScreen
              state={state}
              meIndex={meIndex}
              onRematch={handleRematch}
              onDismiss={() => setEndDismissed(true)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {state.winnerId && endDismissed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-12 z-20 flex justify-center">
              <button
                onClick={() => setEndDismissed(false)}
                className="flex items-center gap-2 rounded-full border border-[#7fb6cc]/40 bg-black/70 px-5 py-2 text-sm font-black text-[#bfe2f0] backdrop-blur transition hover:bg-black/85"
                style={{ fontFamily: SERIF }}
              >
                <Trophy className="h-4 w-4 text-[#e0b56b]" /> {getPlayerName(state, state.winnerId)} rules the seas! — show results
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR */}
      <div className="flex w-[290px] flex-shrink-0 flex-col gap-2.5 overflow-hidden py-1">
        {/* Status banner */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl p-3.5">
          <div className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl ${isMyTurn ? "bg-[#d66a32]/25 text-[#ffb377]" : "bg-[#7fb6cc]/15 text-[#9fd0e2]"}`}>
            {state.phase === "PLACEMENT" ? <Anchor className="h-5 w-5" /> : isMyTurn ? <Target className="h-5 w-5" /> : <Waves className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-[#7fb6cc]">{state.phase}</span>
            <p className="text-[13px] font-black leading-tight text-white" style={{ fontFamily: SERIF }}>
              {state.winnerId ? `${getPlayerName(state, state.winnerId)} wins!`
                : state.phase === "PLACEMENT" ? (me.ready ? `Waiting for ${opp.name}…` : "Position your fleet, Admiral.")
                : flight ? "Shell in the air…"
                : isMyTurn ? "Your turn — fire at will!"
                : `${state.players[state.currentPlayerIndex].name} is taking aim…`}
            </p>
          </div>
        </div>

        {/* PLACEMENT controls */}
        {placing && (
          <div className="glass flex flex-col gap-2 rounded-2xl p-3">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-white/40">Deploy Fleet</h4>
            {me.ships.map((s) => {
              const placed = s.cells.length === s.size
              return (
                <button key={s.id} onClick={() => setSelectedShip(s.id)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                    selectedShip === s.id ? "border-[#7fb6cc]/50 bg-[#7fb6cc]/15 text-white" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}>
                  <span className="flex items-center gap-1.5"><Ship className="h-3.5 w-3.5 text-[#7fb6cc]" />{s.name}</span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: s.size }).map((_, i) => (
                      <span key={i} className={`h-1.5 w-1.5 rounded-sm ${placed ? "bg-emerald-400" : "bg-white/25"}`} />
                    ))}
                  </span>
                </button>
              )
            })}
            <div className="mt-1 flex gap-2">
              <button onClick={() => setOrientation((o) => (o === "H" ? "V" : "H"))}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-white hover:bg-white/20">
                <RotateCw className="h-3 w-3" /> {orientation === "H" ? "Horizontal" : "Vertical"}
              </button>
              <button onClick={() => commit(randomPlace(state, me.id))}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-white/10 py-1.5 text-[10px] font-bold text-white hover:bg-white/20">
                <Shuffle className="h-3 w-3" /> Random
              </button>
            </div>
            <button onClick={() => commit(setReady(state, me.id))} disabled={!allPlaced}
              className="w-full rounded-xl bg-brand py-2 text-xs font-black uppercase text-white shadow-glow-grape disabled:opacity-40">
              Ready to Battle
            </button>
            <p className="text-center text-[9px] text-white/35">Pick a ship, set orientation, click your waters to place it.</p>
          </div>
        )}

        {state.phase === "PLACEMENT" && me.ready && (
          <div className="glass rounded-2xl p-4 text-center">
            <Waves className="mx-auto mb-2 h-8 w-8 animate-pulse text-[#7fb6cc]" />
            <p className="text-xs font-bold text-white">Fleet positioned. Waiting for {opp.name} to deploy…</p>
          </div>
        )}

        {/* FLEET STATUS */}
        {(state.phase === "BATTLE" || state.phase === "GAME_OVER") && (
          <>
            <div className="glass flex flex-col gap-1.5 rounded-2xl p-3">
              <h4 className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[#9fd0e2]">
                <Ship className="h-3 w-3" /> Your Fleet
              </h4>
              {me.ships.map((s) => <ShipStatus key={s.id} s={s} />)}
            </div>
            <div className="glass flex flex-col gap-1.5 rounded-2xl p-3">
              <h4 className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-red-300">
                <Crosshair className="h-3 w-3" /> Enemy Fleet
              </h4>
              {opp.ships.map((s) => <ShipStatus key={s.id} s={s} hidden={!s.sunk} />)}
              <p className="text-[8px] italic text-white/30">Enemy damage stays hidden until a ship goes down.</p>
            </div>
          </>
        )}

        {/* LOG */}
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-black/30 p-3">
          <h4 className="mb-2 border-b border-white/5 pb-1 text-[9px] font-black uppercase tracking-wider text-white/35">Battle Log</h4>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto scrollbar-thin">
            {state.log.slice().reverse().map((m, i) => (
              <div key={i} className="border-b border-white/5 pb-1 text-[9px] leading-relaxed text-white/50">{m}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Full-board victory screen ----------------------------------------------------

function NavalEndScreen({ state, meIndex, onRematch, onDismiss }: {
  state: BattleshipState
  meIndex: number
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const winner = state.players.find((p) => p.id === state.winnerId)!
  const youWon = state.players[meIndex].id === state.winnerId
  const ranked = [...state.players].sort((a, b) => (a.id === state.winnerId ? -1 : 1))

  const statsOf = (p: typeof state.players[number]) => {
    const shots = Object.values(p.shots)
    const fired = shots.length
    const hits = shots.filter((r) => r === "hit" || r === "sunk").length
    const enemy = state.players.find((q) => q.id !== p.id)!
    return {
      fired,
      hits,
      accuracy: fired ? Math.round((hits / fired) * 100) : 0,
      sunk: enemy.ships.filter((s) => s.sunk).length,
      lost: p.ships.filter((s) => s.sunk).length,
    }
  }

  const share = async () => {
    const rows = ranked.map((p) => {
      const s = statsOf(p)
      return `${p.id === state.winnerId ? "🥇" : "🥈"} ${p.name} — ${s.sunk} ships sunk · ${s.accuracy}% accuracy`
    }).join("\n")
    const text = `⚓ Naval Clash on Dice Alley\n🏆 ${winner.name} rules the seas!\n\n${rows}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "Naval Clash — Dice Alley", text })
      else await navigator.clipboard.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch { /* cancelled */ }
  }

  const leave = () => {
    const pid = new URLSearchParams(window.location.search).get("partyId")
    window.location.href = pid && pid !== "mock-party-id" ? `/party/${pid}` : "/games"
  }

  const STAT_META: { key: keyof ReturnType<typeof statsOf>; icon: string; label: string }[] = [
    { key: "sunk", icon: "🚢", label: "Ships sunk" },
    { key: "hits", icon: "💥", label: "Hits" },
    { key: "fired", icon: "🎯", label: "Shots" },
    { key: "accuracy", icon: "📐", label: "Accuracy %" },
    { key: "lost", icon: "🕳️", label: "Ships lost" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-black/85 via-black/60 to-black/85 backdrop-blur-[3px]"
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7fb6cc]">Naval Clash — Battle Over</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? "🎉 You rule the seas!" : <>{winner.name} <span className="text-[#9fd0e2]">rules the seas!</span></>}
          </h2>
        </motion.div>

        {ranked.map((p, idx) => {
          const s = statsOf(p)
          const isWinner = p.id === state.winnerId
          return (
            <motion.div
              key={p.id}
              initial={{ y: 24, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + idx * 0.1, type: "spring", stiffness: 200, damping: 20 }}
              className={`w-full max-w-xl rounded-2xl border p-4 ${
                isWinner
                  ? "border-2 border-[#e0b56b]/70 bg-gradient-to-b from-[#1d3242]/95 to-[#0f1d29]/95 shadow-[0_0_60px_-10px_rgba(224,181,107,0.4)]"
                  : "border-white/10 bg-black/45"
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`relative grid h-12 w-12 flex-shrink-0 place-items-center rounded-full border-2 text-xl ${isWinner ? "border-[#e0b56b]/70 bg-[#d66a32]/30" : "border-white/25 bg-white/10"}`}>
                  ⚓
                  {isWinner && <Crown className="absolute -top-3.5 left-1/2 h-5 w-5 -translate-x-1/2 text-[#e0b56b]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-black text-white" style={{ fontFamily: SERIF }}>
                    {p.name}
                    {p.isBot && <span className="ml-2 rounded bg-[#7fb6cc]/20 px-1.5 py-0.5 align-middle text-[8px] font-bold text-[#9fd0e2]">AI</span>}
                    {p.id === state.players[meIndex].id && <span className="ml-1.5 text-[10px] font-bold text-[#9fd0e2]">(you)</span>}
                  </h3>
                  <p className={`text-[10px] font-bold ${isWinner ? "text-[#e0b56b]" : "text-white/40"}`}>
                    {isWinner ? "Fleet Admiral — victorious" : "Fleet lost at sea"}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1.5 border-t border-white/10 pt-3">
                {STAT_META.map((m) => (
                  <div key={m.key} className="rounded-lg bg-black/30 py-1.5 text-center">
                    <p className="text-sm leading-none">{m.icon}</p>
                    <p className="mt-1 text-sm font-black leading-none text-white">{s[m.key]}</p>
                    <p className="mt-0.5 text-[6.5px] font-bold uppercase tracking-wide text-white/40">{m.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )
        })}

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={onRematch}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
            <RotateCcw className="h-4 w-4" /> Rematch
          </button>
          <button onClick={share}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Share2 className="h-4 w-4" /> {shared ? "Copied!" : "Share"}
          </button>
          <button onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Eye className="h-4 w-4" /> View Ocean
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
