"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { NODES, movesFrom, nodeById, type Transport } from "../lib/manhuntMap"
import {
  legalMoves, move, playBotStep, mrX, currentPlayer, nextRevealRound,
  type ManhuntState, type Ticket,
} from "../lib/manhuntEngine"

interface Props {
  state: ManhuntState
  currentPlayerId: string
  onStateChange: (s: ManhuntState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

const LINE: Record<Transport, string> = { taxi: "#fbbf24", bus: "#22d3ee", underground: "#ff4d9d" }
const TICKET_LABEL: Record<Ticket, string> = { taxi: "Taxi", bus: "Bus", underground: "Tube", black: "Black" }
const TICKET_COLOR: Record<Ticket, string> = { taxi: "#fbbf24", bus: "#22d3ee", underground: "#ff4d9d", black: "#475569" }

// Precompute undirected edges once (each pair/type drawn a single time).
const EDGES: { a: number; b: number; type: Transport }[] = (() => {
  const out: { a: number; b: number; type: Transport }[] = []
  const seen = new Set<string>()
  for (const n of NODES) {
    for (const l of movesFrom(n.id)) {
      const k = `${Math.min(n.id, l.to)}-${Math.max(n.id, l.to)}-${l.type}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ a: n.id, b: l.to, type: l.type })
    }
  }
  // underground on top, taxi underneath
  const order: Transport[] = ["taxi", "bus", "underground"]
  return out.sort((x, y) => order.indexOf(x.type) - order.indexOf(y.type))
})()

export default function ManhuntBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const commit = (next: ManhuntState) => { onStateChange(next); onBroadcastAction?.("sync_state", next) }
  const [pending, setPending] = useState<{ to: number; types: Ticket[] } | null>(null)

  const me = state.players.find((p) => p.id === currentPlayerId)
  const amMrX = me?.role === "mrx"
  const over = state.phase === "GAME_OVER"
  const showMrX = amMrX || over
  const x = mrX(state)
  const cur = currentPlayer(state)
  const isMyTurn = state.order[state.currentIndex] === currentPlayerId && !over

  const legal = useMemo(
    () => (isMyTurn ? legalMoves(state, currentPlayerId) : []),
    [state, currentPlayerId, isMyTurn]
  )
  const legalByNode = useMemo(() => {
    const m: Record<number, Ticket[]> = {}
    legal.forEach((l) => { (m[l.to] ||= []).push(l.type) })
    return m
  }, [legal])

  // Bot driver — only the first human's client steps bots (avoids double-moves).
  useEffect(() => {
    if (over) return
    const firstHuman = state.players.find((p) => !p.isBot)
    if (cur.isBot && firstHuman && currentPlayerId === firstHuman.id) {
      const t = setTimeout(() => commit(playBotStep(state)), 950)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentIndex, state.phase, state.round])

  const doMove = (to: number, type: Ticket) => { setPending(null); commit(move(state, currentPlayerId, to, type)) }
  const clickNode = (to: number) => {
    const types = legalByNode[to]
    if (!isMyTurn || !types?.length) return
    if (types.length === 1) doMove(to, types[0])
    else setPending({ to, types })
  }

  const reveal = nextRevealRound(state)
  const detectives = state.players.filter((p) => p.role === "detective")

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-950 text-white select-none md:flex-row">
      {/* Board */}
      <div className="relative flex-1 min-h-0 bg-[radial-gradient(circle_at_30%_20%,#1e293b,#0b1120)] p-2">
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {/* edges */}
          {EDGES.map((e, i) => {
            const a = nodeById(e.a)!, b = nodeById(e.b)!
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={LINE[e.type]}
                strokeOpacity={e.type === "taxi" ? 0.3 : e.type === "bus" ? 0.4 : 0.5}
                strokeWidth={e.type === "underground" ? 1.4 : e.type === "bus" ? 0.9 : 0.5}
                strokeLinecap="round"
              />
            )
          })}

          {/* nodes */}
          {NODES.map((n) => {
            const isLegal = !!legalByNode[n.id]
            return (
              <g key={n.id} onClick={() => clickNode(n.id)} style={{ cursor: isLegal ? "pointer" : "default" }}>
                {isLegal && (
                  <circle cx={n.x} cy={n.y} r={3.6} fill="none" stroke="#34e0a1" strokeWidth={0.5}>
                    <animate attributeName="r" values="3;4;3" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={n.x} cy={n.y} r={n.hub ? 2.4 : 1.8} fill={n.hub ? "#334155" : "#1e293b"} stroke="#64748b" strokeWidth={0.3} />
                <text x={n.x} y={n.y + 0.7} textAnchor="middle" fontSize={1.7} fill="#94a3b8">{n.id}</text>
              </g>
            )
          })}

          {/* detective tokens */}
          {detectives.map((d) => {
            const n = nodeById(d.position)!
            return (
              <g key={d.id}>
                <circle cx={n.x} cy={n.y} r={2.7} fill={d.color} stroke="#0b1120" strokeWidth={0.5} />
                <text x={n.x} y={n.y + 1} textAnchor="middle" fontSize={2.3} fontWeight="bold" fill="#fff">
                  {d.name.charAt(0).toUpperCase()}
                </text>
              </g>
            )
          })}

          {/* Mr X — actual only to Mr X / at game over; otherwise last-seen marker */}
          {showMrX ? (
            (() => { const n = nodeById(x.position)!; return (
              <g>
                <circle cx={n.x} cy={n.y} r={3} fill={x.color} stroke="#ff4d9d" strokeWidth={0.7} />
                <text x={n.x} y={n.y + 1.1} textAnchor="middle" fontSize={2.6} fontWeight="bold" fill="#ff79c6">X</text>
              </g>
            )})()
          ) : state.mrxLastSeen != null ? (
            (() => { const n = nodeById(state.mrxLastSeen)!; return (
              <g opacity={0.65}>
                <circle cx={n.x} cy={n.y} r={3} fill="none" stroke="#ff4d9d" strokeWidth={0.6} strokeDasharray="1 1" />
                <text x={n.x} y={n.y + 1.1} textAnchor="middle" fontSize={2.6} fontWeight="bold" fill="#ff79c6">?</text>
              </g>
            )})()
          ) : null}
        </svg>

        {/* Legend */}
        <div className="pointer-events-none absolute bottom-2 left-2 flex gap-3 rounded-lg bg-black/40 px-2.5 py-1 text-[10px] backdrop-blur">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: LINE.taxi }} /> Taxi</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: LINE.bus }} /> Bus</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: LINE.underground }} /> Tube</span>
        </div>
      </div>

      {/* Side panel */}
      <div className="flex w-full shrink-0 flex-col gap-3 border-t border-white/10 bg-slate-900/80 p-3 md:w-72 md:border-l md:border-t-0">
        {/* Role + turn */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Round {state.round} / {state.maxRounds}</p>
          <p className="mt-0.5 text-lg font-black">
            {amMrX ? <span className="text-pink-400">You are Mr X 🕶️</span> : me ? <>You are <span style={{ color: me.color }}>{me.name}</span> 🕵️</> : "Spectating"}
          </p>
          <p className="mt-1 text-sm text-white/70">
            {over ? (state.winner === "mrx" ? "Mr X escaped!" : "Detectives win!")
              : isMyTurn ? <span className="font-bold text-mint-300">Your move — pick a glowing station.</span>
              : <>Waiting for <span className="font-semibold">{cur.name}</span>…</>}
          </p>
          {!over && reveal != null && (
            <p className="mt-1 text-[11px] text-amber-300/90">
              {state.revealRounds.includes(state.round) && amMrX ? "You surface this round!" : `Mr X surfaces on round ${reveal}.`}
            </p>
          )}
        </div>

        {/* Ticket picker */}
        {pending && (
          <div className="rounded-xl border border-mint-400/40 bg-mint-500/10 p-3">
            <p className="mb-2 text-xs font-bold text-white">Travel to station {pending.to} by:</p>
            <div className="flex flex-wrap gap-2">
              {pending.types.map((t) => (
                <button key={t} onClick={() => doMove(pending.to, t)}
                  className="rounded-lg px-3 py-1.5 text-sm font-bold text-white"
                  style={{ background: TICKET_COLOR[t] }}>
                  {TICKET_LABEL[t]}
                </button>
              ))}
              <button onClick={() => setPending(null)} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white/70 hover:bg-white/20">Cancel</button>
            </div>
          </div>
        )}

        {/* My tickets */}
        {me && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">Your tickets</p>
            <div className="flex flex-wrap gap-2">
              {(["taxi", "bus", "underground"] as Ticket[]).map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-sm">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: TICKET_COLOR[t] }} />
                  {TICKET_LABEL[t]} <b>{me.tickets[t]}</b>
                </span>
              ))}
              {amMrX && (
                <span className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-sm">
                  <i className="h-2.5 w-2.5 rounded-full" style={{ background: TICKET_COLOR.black }} />
                  Black <b>{me.tickets.black}</b>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Travel log — the detectives' clues */}
        <div className="min-h-0 flex-1 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/50">Mr X travel log</p>
          {state.travelLog.length === 0 ? (
            <p className="text-xs text-white/40">No moves yet…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {state.travelLog.map((e, i) => (
                <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-1 text-[11px]"
                  title={`Round ${e.round}`}>
                  <span className="text-white/40">{e.round}</span>
                  <i className="h-2 w-2 rounded-full" style={{ background: TICKET_COLOR[e.type] }} />
                </motion.span>
              ))}
            </div>
          )}
          {state.revealRounds.length > 0 && (
            <p className="mt-2 text-[10px] text-white/40">Mr X surfaces on rounds {state.revealRounds.join(", ")}.</p>
          )}
        </div>
      </div>
    </div>
  )
}
