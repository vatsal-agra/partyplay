// Manhunt — hidden-movement pursuit (Scotland Yard style), pure state engine.
//
// One player is Mr X (the fugitive); the rest are detectives hunting them across
// the transit map. Mr X's true position is held in state but the board UI only
// reveals it to Mr X (and on scheduled "surface" rounds + at game over) — the
// same hidden-info trade-off as the other deduction games here. Detectives only
// ever see the transport Mr X used (the travel log) plus his last surfaced spot.

import { distance, movesFrom, NODES, type Transport } from "./manhuntMap"

export type Role = "mrx" | "detective"
export type Phase = "PLAYING" | "GAME_OVER"
export type Ticket = Transport | "black"

export interface MHPlayer {
  id: string
  name: string
  isBot: boolean
  role: Role
  color: string
  position: number
  tickets: { taxi: number; bus: number; underground: number; black: number }
}

export interface TravelEntry { round: number; type: Ticket }

export interface ManhuntState {
  players: MHPlayer[]
  order: string[]          // turn order: [mrx, ...detectives]
  currentIndex: number     // index into order
  round: number            // 1..maxRounds
  maxRounds: number
  revealRounds: number[]
  mrxLastSeen: number | null
  travelLog: TravelEntry[]
  phase: Phase
  winner: "mrx" | "detectives" | null
  winnerId: string | null
  log: string[]
}

const DETECTIVE_TICKETS = { taxi: 8, bus: 6, underground: 3, black: 0 }
const MRX_TICKETS = { taxi: 4, bus: 3, underground: 3, black: 5 }
const MAX_ROUNDS = 12
const REVEAL_ROUNDS = [3, 6, 9, 12]
const DET_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316"]
const MRX_COLOR = "#0f172a"

const clone = (s: ManhuntState): ManhuntState => JSON.parse(JSON.stringify(s))
const pushLog = (s: ManhuntState, m: string) => { s.log = [...s.log, m].slice(-60) }

export function getPlayer(s: ManhuntState, id: string): MHPlayer | undefined {
  return s.players.find((p) => p.id === id)
}
export function mrX(s: ManhuntState): MHPlayer {
  return s.players.find((p) => p.role === "mrx")!
}
export function currentPlayer(s: ManhuntState): MHPlayer {
  return getPlayer(s, s.order[s.currentIndex])!
}
export function nextRevealRound(s: ManhuntState): number | null {
  return s.revealRounds.find((r) => r >= s.round) ?? null
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export function initializeGame(playersData: { id: string; name: string; isBot?: boolean }[]): ManhuntState {
  const startNodes = shuffle(NODES.map((n) => n.id)).slice(0, Math.max(2, playersData.length))
  let detIdx = 0
  const players: MHPlayer[] = playersData.map((p, i) => {
    const role: Role = i === 0 ? "mrx" : "detective"
    return {
      id: p.id,
      name: p.name,
      isBot: !!p.isBot,
      role,
      color: role === "mrx" ? MRX_COLOR : DET_COLORS[detIdx++ % DET_COLORS.length],
      position: startNodes[i],
      tickets: { ...(role === "mrx" ? MRX_TICKETS : DETECTIVE_TICKETS) },
    }
  })

  const mrx = players.find((p) => p.role === "mrx")!
  const order = [mrx.id, ...players.filter((p) => p.role === "detective").map((p) => p.id)]

  return {
    players,
    order,
    currentIndex: 0,
    round: 1,
    maxRounds: MAX_ROUNDS,
    revealRounds: REVEAL_ROUNDS,
    mrxLastSeen: null,
    travelLog: [],
    phase: "PLAYING",
    winner: null,
    winnerId: null,
    log: [`🕵️ The chase begins! Mr X has ${MAX_ROUNDS} rounds to evade ${order.length - 1} detective${order.length - 1 === 1 ? "" : "s"}.`],
  }
}

// Legal destinations for a player, given tickets and occupancy.
export function legalMoves(s: ManhuntState, playerId: string): { to: number; type: Ticket }[] {
  const p = getPlayer(s, playerId)
  if (!p || s.phase !== "PLAYING" || s.order[s.currentIndex] !== playerId) return []

  const detPositions = new Set(
    s.players.filter((q) => q.role === "detective" && q.id !== playerId).map((q) => q.position)
  )
  const out: { to: number; type: Ticket }[] = []
  const seen = new Set<string>()
  const add = (to: number, type: Ticket) => {
    const k = `${to}:${type}`
    if (!seen.has(k)) { seen.add(k); out.push({ to, type }) }
  }

  for (const link of movesFrom(p.position)) {
    if (detPositions.has(link.to)) continue                 // can't share a station with a detective
    if (p.tickets[link.type] > 0) add(link.to, link.type)
    if (p.role === "mrx" && p.tickets.black > 0) add(link.to, "black")   // black works on any line
  }
  return out
}

function isLegal(s: ManhuntState, playerId: string, to: number, type: Ticket): boolean {
  return legalMoves(s, playerId).some((m) => m.to === to && m.type === type)
}

// Advance to the next player who can act; resolve survival / stuck outcomes.
function advanceTurn(s: ManhuntState) {
  let guard = 0
  while (guard++ < s.order.length * 2 + 2) {
    s.currentIndex++
    if (s.currentIndex >= s.order.length) {
      s.currentIndex = 0
      s.round++
      if (s.round > s.maxRounds) {
        s.phase = "GAME_OVER"; s.winner = "mrx"; s.winnerId = mrX(s).id
        pushLog(s, `🏆 Mr X survived all ${s.maxRounds} rounds and escaped!`)
        return
      }
    }
    const cur = currentPlayer(s)
    const moves = legalMoves(s, cur.id)
    if (moves.length > 0) return                            // this player acts
    if (cur.role === "mrx") {
      s.phase = "GAME_OVER"; s.winner = "detectives"; s.winnerId = closestDetectiveId(s)
      pushLog(s, `🏆 Mr X is cornered with nowhere to run — the detectives win!`)
      return
    }
    pushLog(s, `🚧 ${cur.name} is stuck and skips the turn.`)
  }
}

function closestDetectiveId(s: ManhuntState): string {
  const x = mrX(s)
  let best = s.players.find((p) => p.role === "detective")
  let bestD = Infinity
  for (const d of s.players.filter((p) => p.role === "detective")) {
    const dd = distance(d.position, x.position)
    if (dd < bestD) { bestD = dd; best = d }
  }
  return best?.id ?? x.id
}

export function move(state: ManhuntState, playerId: string, to: number, type: Ticket): ManhuntState {
  if (!isLegal(state, playerId, to, type)) return state
  const s = clone(state)
  const p = getPlayer(s, playerId)!

  p.tickets[type] -= 1
  if (p.role === "detective" && type !== "black") {
    mrX(s).tickets[type] += 1            // spent detective tickets go to Mr X
  }
  p.position = to

  if (p.role === "mrx") {
    s.travelLog = [...s.travelLog, { round: s.round, type }]
    if (s.revealRounds.includes(s.round)) {
      s.mrxLastSeen = to
      pushLog(s, `📣 Round ${s.round}: Mr X surfaces at station ${to}!`)
    } else {
      pushLog(s, `🕶️ Mr X slips away by ${type === "black" ? "a hidden route" : type}.`)
    }
  } else {
    pushLog(s, `🚶 ${p.name} moves to station ${to} by ${type}.`)
    if (to === mrX(s).position) {
      s.phase = "GAME_OVER"; s.winner = "detectives"; s.winnerId = p.id
      s.mrxLastSeen = to
      pushLog(s, `🏆 ${p.name} caught Mr X at station ${to}! Detectives win!`)
      return s
    }
  }

  advanceTurn(s)
  return s
}

// ---- Bots -------------------------------------------------------------------

function botMrXMove(s: ManhuntState, moves: { to: number; type: Ticket }[]) {
  const dets = s.players.filter((p) => p.role === "detective")
  const score = (to: number) => Math.min(...dets.map((d) => distance(d.position, to)))
  // Maximize distance from the nearest detective; conserve black tickets on ties.
  let best = moves[0]
  let bestScore = -Infinity
  for (const m of moves) {
    const base = score(m.to)
    const adj = base - (m.type === "black" ? 0.3 : 0)   // prefer normal tickets when equal
    if (adj > bestScore) { bestScore = adj; best = m }
  }
  return best
}

function botDetectiveMove(s: ManhuntState, det: MHPlayer, moves: { to: number; type: Ticket }[]) {
  // Pursue the last known location; if Mr X has never surfaced, push toward the centre.
  const target = s.mrxLastSeen ?? 13
  let best = moves[0]
  let bestD = Infinity
  for (const m of moves) {
    const d = distance(m.to, target)
    if (d < bestD) { bestD = d; best = m }
  }
  return best
}

export function playBotStep(state: ManhuntState): ManhuntState {
  if (state.phase !== "PLAYING") return state
  const cur = currentPlayer(state)
  if (!cur.isBot) return state
  const moves = legalMoves(state, cur.id)
  if (!moves.length) return state
  const choice = cur.role === "mrx" ? botMrXMove(state, moves) : botDetectiveMove(state, cur, moves)
  return move(state, cur.id, choice.to, choice.type)
}
