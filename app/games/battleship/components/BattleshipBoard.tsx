// Naval Clash — board UI. Fleet placement with live preview, dual battle
// grids, turn flow, and a bot driver for solo play.
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  BattleshipState, Orientation, GRID, FLEET,
  placeShip, randomPlace, setReady, fire, playBotStep, canPlace, cellKey, colLabel,
  getPlayerName,
} from "../lib/battleshipEngine"
import { Ship, RotateCw, Shuffle, Crosshair, Anchor, Trophy, Waves } from "lucide-react"

interface Props {
  state: BattleshipState
  currentPlayerId: string
  onStateChange: (s: BattleshipState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

export default function BattleshipBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const [selectedShip, setSelectedShip] = useState<string>(FLEET[0].id)
  const [orientation, setOrientation] = useState<Orientation>('H')
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)

  const commit = (next: BattleshipState) => {
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  const meIndex = Math.max(0, state.players.findIndex((p) => p.id === currentPlayerId))
  const me = state.players[meIndex]
  const opp = state.players[1 - meIndex]
  const isMyTurn = state.phase === 'BATTLE' && state.players[state.currentPlayerIndex].id === me.id

  // ---- Bot driver -----------------------------------------------------------
  useEffect(() => {
    if (state.winnerId) return
    if (state.phase === 'PLACEMENT') {
      if (state.players.some((p) => p.isBot && !p.ready)) {
        const t = setTimeout(() => commit(playBotStep(state)), 500)
        return () => clearTimeout(t)
      }
    } else if (state.phase === 'BATTLE') {
      if (state.players[state.currentPlayerIndex].isBot) {
        const t = setTimeout(() => commit(playBotStep(state)), 750)
        return () => clearTimeout(t)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.currentPlayerIndex, state.players.map((p) => p.ready).join(), state.winnerId])

  // ---- Placement helpers ----------------------------------------------------
  const myShipAt = useMemo(() => {
    const m = new Map<string, string>() // cellKey -> shipId
    me.ships.forEach((s) => s.cells.forEach((c) => m.set(cellKey(c.x, c.y), s.id)))
    return m
  }, [me])

  const previewCells = useMemo(() => {
    if (state.phase !== 'PLACEMENT' || me.ready || !hover) return null
    const ship = me.ships.find((s) => s.id === selectedShip)
    if (!ship) return null
    const ok = canPlace(me, ship.size, hover.x, hover.y, orientation, ship.id)
    const cells: string[] = []
    for (let i = 0; i < ship.size; i++) {
      const cx = orientation === 'H' ? hover.x + i : hover.x
      const cy = orientation === 'H' ? hover.y : hover.y + i
      cells.push(cellKey(cx, cy))
    }
    return { cells: new Set(cells), ok }
  }, [state.phase, me, hover, selectedShip, orientation])

  const handlePlace = (x: number, y: number) => {
    const next = placeShip(state, me.id, selectedShip, x, y, orientation)
    if (next === state) return
    commit(next)
    const board = next.players.find((p) => p.id === me.id)!
    const nextShip = board.ships.find((s) => s.cells.length < s.size)
    if (nextShip) setSelectedShip(nextShip.id)
  }

  const allPlaced = me.ships.every((s) => s.cells.length === s.size)

  // ---- Cell renderers -------------------------------------------------------
  const ownCell = (x: number, y: number) => {
    const k = cellKey(x, y)
    const ship = myShipAt.get(k)
    const incoming = opp.shots[k]              // opponent's shot on me
    const inPreview = previewCells?.cells.has(k)
    let bg = '#16304a', content: React.ReactNode = null
    if (ship) bg = '#3b6ea5'
    if (incoming === 'hit') { bg = '#b91c1c'; content = '✸' }
    else if (incoming === 'sunk') { bg = '#7f1d1d'; content = '✸' }
    else if (incoming === 'miss') { content = <span className="text-sky-300/60 text-[8px]">•</span> }
    if (inPreview) bg = previewCells!.ok ? '#16a34a' : '#dc2626'
    return (
      <div key={k}
        onMouseEnter={() => setHover({ x, y })}
        onClick={state.phase === 'PLACEMENT' && !me.ready ? () => handlePlace(x, y) : undefined}
        className={`w-6 h-6 sm:w-7 sm:h-7 border border-[#0b1220] flex items-center justify-center text-[11px] ${state.phase === 'PLACEMENT' && !me.ready ? 'cursor-pointer' : ''}`}
        style={{ backgroundColor: bg }}>
        {content}
      </div>
    )
  }

  const targetCell = (x: number, y: number) => {
    const k = cellKey(x, y)
    const r = me.shots[k]                       // my shot on opponent
    let bg = '#16304a', content: React.ReactNode = null
    if (r === 'miss') { content = <span className="text-sky-300/60 text-[8px]">•</span> }
    else if (r === 'hit') { bg = '#b91c1c'; content = '✸' }
    else if (r === 'sunk') { bg = '#7f1d1d'; content = '🔥' }
    const clickable = isMyTurn && !r
    return (
      <div key={k}
        onClick={clickable ? () => commit(fire(state, x, y)) : undefined}
        className={`w-6 h-6 sm:w-7 sm:h-7 border border-[#0b1220] flex items-center justify-center text-[11px] ${clickable ? 'cursor-crosshair hover:bg-aqua-500/30' : ''}`}
        style={{ backgroundColor: bg }}>
        {content}
      </div>
    )
  }

  const Grid = ({ render, dim }: { render: (x: number, y: number) => React.ReactNode; dim?: boolean }) => (
    <div className={`inline-block select-none ${dim ? 'opacity-60' : ''}`} onMouseLeave={() => setHover(null)}>
      <div className="flex">
        <div className="w-4 h-5" />
        {Array.from({ length: GRID }).map((_, x) => (
          <div key={x} className="w-6 sm:w-7 h-5 flex items-center justify-center text-[8px] font-mono text-slate-400">{colLabel(x)}</div>
        ))}
      </div>
      {Array.from({ length: GRID }).map((_, y) => (
        <div key={y} className="flex">
          <div className="w-4 h-6 sm:h-7 flex items-center justify-center text-[8px] font-mono text-slate-400">{y + 1}</div>
          {Array.from({ length: GRID }).map((_, x) => render(x, y))}
        </div>
      ))}
    </div>
  )

  // ---- Render ---------------------------------------------------------------
  return (
    <div className="flex w-full h-full overflow-auto bg-slate-950 select-none p-3 gap-4">
      <div className="flex-1 flex flex-col items-center justify-center gap-4 min-w-0">
        {/* Turn / status banner */}
        <div className="w-full max-w-3xl bg-slate-900/60 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-3">
          <Anchor className="w-5 h-5 text-aqua-400" />
          <div className="flex-1">
            {state.winnerId ? (
              <span className="text-sm font-black text-white">🏆 {getPlayerName(state, state.winnerId)} wins!</span>
            ) : state.phase === 'PLACEMENT' ? (
              <span className="text-sm font-bold text-white">Position your fleet, Admiral {me.name}.</span>
            ) : (
              <span className="text-sm font-bold text-white">
                {isMyTurn ? "🎯 Your turn — fire on Enemy Waters!" : `${state.players[state.currentPlayerIndex].name} is taking aim…`}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono text-aqua-400 uppercase tracking-widest">{state.phase}</span>
        </div>

        {/* PLACEMENT */}
        {state.phase === 'PLACEMENT' && !me.ready && (
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div>
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 text-center">Your Waters</h3>
              <div className="bg-slate-900/50 p-2 rounded-xl border border-white/10"><Grid render={ownCell} /></div>
            </div>
            <div className="w-56 flex flex-col gap-2">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Fleet</h3>
              {me.ships.map((s) => {
                const placed = s.cells.length === s.size
                return (
                  <button key={s.id} onClick={() => setSelectedShip(s.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] transition ${selectedShip === s.id ? 'bg-aqua-500/20 border-aqua-500/40 text-white' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                    <span className="flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-aqua-400" />{s.name}</span>
                    <span className="flex items-center gap-1">
                      <span className="flex gap-0.5">{Array.from({ length: s.size }).map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-sm ${placed ? 'bg-emerald-400' : 'bg-slate-600'}`} />)}</span>
                    </span>
                  </button>
                )
              })}
              <div className="flex gap-2 mt-1">
                <button onClick={() => setOrientation((o) => (o === 'H' ? 'V' : 'H'))}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                  <RotateCw className="w-3 h-3" /> {orientation === 'H' ? 'Horizontal' : 'Vertical'}
                </button>
                <button onClick={() => commit(randomPlace(state, me.id))}
                  className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1">
                  <Shuffle className="w-3 h-3" /> Random
                </button>
              </div>
              <button onClick={() => commit(setReady(state, me.id))} disabled={!allPlaced}
                className="w-full py-2 bg-gradient-to-r from-aqua-500 to-sky-500 disabled:opacity-40 text-slate-950 font-black text-xs uppercase rounded-xl mt-1">
                Ready to Battle
              </button>
              <p className="text-[9px] text-slate-500 text-center">Pick a ship, set orientation, click a cell. Drag-free placement.</p>
            </div>
          </div>
        )}

        {/* WAITING for opponent placement */}
        {state.phase === 'PLACEMENT' && me.ready && (
          <div className="text-center py-10">
            <Waves className="w-10 h-10 text-aqua-400 mx-auto mb-3 animate-pulse" />
            <p className="text-sm text-white font-bold">Fleet positioned. Waiting for {opp.name} to deploy…</p>
          </div>
        )}

        {/* BATTLE / GAME OVER */}
        {(state.phase === 'BATTLE' || state.phase === 'GAME_OVER') && (
          <div className="flex flex-col xl:flex-row items-start justify-center gap-8">
            <div>
              <h3 className="text-[10px] font-black uppercase text-rose-400 tracking-widest mb-1 text-center flex items-center justify-center gap-1">
                <Crosshair className="w-3.5 h-3.5" /> Enemy Waters
              </h3>
              <div className={`bg-slate-900/50 p-2 rounded-xl border ${isMyTurn ? 'border-aqua-500/40 shadow-[0_0_20px_rgba(34,211,238,0.15)]' : 'border-white/10'}`}>
                <Grid render={targetCell} />
              </div>
              <p className="text-[9px] text-slate-500 text-center mt-1">Click to fire</p>
            </div>
            <div>
              <h3 className="text-[10px] font-black uppercase text-aqua-400 tracking-widest mb-1 text-center flex items-center justify-center gap-1">
                <Ship className="w-3.5 h-3.5" /> Your Fleet
              </h3>
              <div className="bg-slate-900/50 p-2 rounded-xl border border-white/10"><Grid render={ownCell} dim={isMyTurn} /></div>
              <div className="flex flex-wrap gap-1 justify-center mt-2 max-w-[260px]">
                {opp.ships.map((s) => (
                  <span key={s.id} className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${s.sunk ? 'bg-rose-500/20 text-rose-300 line-through' : 'bg-white/5 text-slate-400'}`}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LOG */}
      <div className="w-60 flex-shrink-0 hidden md:flex flex-col bg-slate-950/60 border border-white/10 rounded-2xl p-3">
        <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Battle Log</h4>
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
          {state.log.slice().reverse().map((m, i) => (
            <div key={i} className="text-[9px] text-slate-400 leading-relaxed border-b border-white/5 pb-1">{m}</div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {state.winnerId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-aqua-500/30 rounded-2xl p-6 text-center shadow-2xl">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h2 className="text-xl font-black text-white">{getPlayerName(state, state.winnerId)} wins!</h2>
              <p className="text-xs text-slate-400 mt-1">The enemy fleet lies at the bottom of the sea.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
