// Mystery Manor — game engine (pure state; no rendering, no side effects).
//
// Mechanics mirror the classic deduction board game: a hidden solution of one
// suspect + one weapon + one room; players move across a unit-square mansion,
// enter rooms to make suggestions, and opponents disprove privately by showing
// a single matching card. Deduce the solution, then accuse to win.

import {
  ROOMS, SUSPECTS, WEAPONS, ROOM_CARDS, RoomId, Cell,
  isCorridor, getRoom, cellKey,
} from './mansionLayout'

export type Phase = 'ROLL' | 'MOVE' | 'ACTION' | 'DISPROVE' | 'GAME_OVER'
export type CardCategory = 'suspect' | 'weapon' | 'room'

export interface MysteryPlayer {
  id: string
  name: string
  isBot: boolean
  suspectId: string
  color: string
  inRoom: RoomId | null
  cell: Cell | null
  hand: string[]
  eliminated: boolean   // made a wrong accusation — still disproves, can't win
  known: string[]       // cards proven NOT in the solution (own hand + reveals)
}

export interface SuggestionRecord {
  suggesterId: string
  suggesterName: string
  suspect: string
  weapon: string
  room: RoomId
  disproverId: string | null
  disproverName: string | null
  shownCard?: string    // only meaningful to the suggester (UI gates visibility)
}

export interface PendingSuggestion {
  suspect: string
  weapon: string
  room: RoomId
  suggesterId: string
  askIndex: number      // player currently asked to disprove
}

export interface MysteryState {
  players: MysteryPlayer[]
  solution: { suspect: string; weapon: string; room: RoomId }
  suspectLocations: Record<string, RoomId | null>  // non-player tokens too
  weaponLocations: Record<string, RoomId>
  currentPlayerIndex: number
  phase: Phase
  dice: [number, number] | null
  movesLeft: number
  suggestionMade: boolean
  pending: PendingSuggestion | null
  revealChoices: string[] | null     // cards a human disprover may show
  lastReveal: { toPlayerId: string; fromPlayerId: string; card: string } | null
  suggestionLog: SuggestionRecord[]
  log: string[]
  winnerId: string | null
}

// ---- Card helpers -----------------------------------------------------------

export function cardCategory(id: string): CardCategory {
  if (SUSPECTS.some((s) => s.id === id)) return 'suspect'
  if (WEAPONS.some((w) => w.id === id)) return 'weapon'
  return 'room'
}

export function cardName(id: string): string {
  return (
    SUSPECTS.find((s) => s.id === id)?.name ||
    WEAPONS.find((w) => w.id === id)?.name ||
    ROOM_CARDS.find((r) => r.id === id)?.name ||
    id
  )
}

export function categoryCards(cat: CardCategory): string[] {
  if (cat === 'suspect') return SUSPECTS.map((s) => s.id)
  if (cat === 'weapon') return WEAPONS.map((w) => w.id)
  return ROOMS.map((r) => r.id)
}

const clone = (s: MysteryState): MysteryState => JSON.parse(JSON.stringify(s))
const pushLog = (s: MysteryState, msg: string) => { s.log = [...s.log, msg].slice(-120) }

export function getPlayerName(state: MysteryState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---- Initialization ---------------------------------------------------------

export function initializeGame(
  playersData: { id: string; name: string; isBot: boolean }[],
): MysteryState {
  const roster = playersData.slice(0, 6)

  // Hidden solution: one of each category.
  const solution = {
    suspect: shuffle(SUSPECTS.map((s) => s.id))[0],
    weapon: shuffle(WEAPONS.map((w) => w.id))[0],
    room: shuffle(ROOMS.map((r) => r.id))[0] as RoomId,
  }

  // Remaining 18 cards dealt round-robin.
  const deck = shuffle([
    ...SUSPECTS.map((s) => s.id).filter((c) => c !== solution.suspect),
    ...WEAPONS.map((w) => w.id).filter((c) => c !== solution.weapon),
    ...ROOMS.map((r) => r.id).filter((c) => c !== solution.room),
  ])

  const hands: string[][] = roster.map(() => [])
  deck.forEach((card, i) => hands[i % roster.length].push(card))

  const players: MysteryPlayer[] = roster.map((p, i) => {
    const suspect = SUSPECTS[i]
    return {
      id: p.id,
      name: p.name,
      isBot: p.isBot,
      suspectId: suspect.id,
      color: suspect.color,
      inRoom: null,
      cell: { ...suspect.start },
      hand: hands[i],
      eliminated: false,
      known: [...hands[i]],   // you know your own cards aren't the solution
    }
  })

  // Suspect tokens (incl. unused suspects) start outside rooms.
  const suspectLocations: Record<string, RoomId | null> = {}
  SUSPECTS.forEach((s) => { suspectLocations[s.id] = null })

  // Scatter weapons across rooms.
  const shuffledRooms = shuffle(ROOMS.map((r) => r.id))
  const weaponLocations: Record<string, RoomId> = {}
  WEAPONS.forEach((w, i) => { weaponLocations[w.id] = shuffledRooms[i % shuffledRooms.length] as RoomId })

  return {
    players,
    solution,
    suspectLocations,
    weaponLocations,
    currentPlayerIndex: 0,
    phase: 'ROLL',
    dice: null,
    movesLeft: 0,
    suggestionMade: false,
    pending: null,
    revealChoices: null,
    lastReveal: null,
    suggestionLog: [],
    log: ['🕵️ Welcome to Mystery Manor! A murder has been committed — deduce who, what, and where.'],
    winnerId: null,
  }
}

// ---- Movement ---------------------------------------------------------------

export interface Reachable {
  cells: { x: number; y: number; dist: number }[]
  rooms: { room: RoomId; dist: number }[]
  secret: RoomId | null
}

export function getReachable(state: MysteryState, idx: number): Reachable {
  const p = state.players[idx]
  const occupied = new Set(
    state.players
      .filter((q, i) => i !== idx && q.cell && !q.eliminated)
      .map((q) => cellKey(q.cell!.x, q.cell!.y)),
  )

  const dist = new Map<string, number>()
  const queue: { x: number; y: number; d: number }[] = []
  const seed = (x: number, y: number, d: number) => {
    const k = cellKey(x, y)
    if (!dist.has(k) || d < dist.get(k)!) { dist.set(k, d); queue.push({ x, y, d }) }
  }

  if (p.cell) seed(p.cell.x, p.cell.y, 0)
  else if (p.inRoom) {
    for (const d of getRoom(p.inRoom).doors) {
      if (!occupied.has(cellKey(d.x, d.y))) seed(d.x, d.y, 1)
    }
  }

  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    if (cur.d >= state.movesLeft) continue
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const nx = cur.x + dx, ny = cur.y + dy
      if (!isCorridor(nx, ny)) continue
      const k = cellKey(nx, ny)
      if (occupied.has(k)) continue
      const nd = cur.d + 1
      if (dist.has(k) && dist.get(k)! <= nd) continue
      dist.set(k, nd)
      queue.push({ x: nx, y: ny, d: nd })
    }
  }

  const cells: Reachable['cells'] = []
  for (const [k, d] of dist) {
    if (d >= 1 && d <= state.movesLeft) {
      const [x, y] = k.split(',').map(Number)
      cells.push({ x, y, dist: d })
    }
  }

  const rooms: Reachable['rooms'] = []
  for (const room of ROOMS) {
    if (p.inRoom === room.id) continue
    let best = Infinity
    for (const dr of room.doors) {
      const k = cellKey(dr.x, dr.y)
      if (dist.has(k)) best = Math.min(best, dist.get(k)!)
    }
    if (best !== Infinity && best <= state.movesLeft) rooms.push({ room: room.id, dist: best })
  }

  const secret = p.inRoom ? getRoom(p.inRoom).secret ?? null : null
  return { cells, rooms, secret }
}

// ---- Actions ----------------------------------------------------------------

export function rollDice(state: MysteryState, manual?: [number, number]): MysteryState {
  if (state.phase !== 'ROLL') return state
  const s = clone(state)
  const d: [number, number] = manual ?? [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]
  s.dice = d
  s.movesLeft = d[0] + d[1]
  s.phase = 'MOVE'
  pushLog(s, `🎲 ${getPlayerName(s, s.players[s.currentPlayerIndex].id)} rolled ${d[0]} + ${d[1]} = ${d[0] + d[1]}.`)
  return s
}

function placeInRoom(p: MysteryPlayer, room: RoomId) {
  p.inRoom = room
  p.cell = null
}

export type MoveDest =
  | { kind: 'cell'; x: number; y: number }
  | { kind: 'room'; room: RoomId }

export function moveTo(state: MysteryState, dest: MoveDest): MysteryState {
  if (state.phase !== 'MOVE') return state
  const s = clone(state)
  const p = s.players[s.currentPlayerIndex]

  if (dest.kind === 'cell') {
    p.cell = { x: dest.x, y: dest.y }
    p.inRoom = null
    pushLog(s, `🚶 ${p.name} moved along the hallway.`)
  } else {
    placeInRoom(p, dest.room)
    s.suspectLocations[p.suspectId] = dest.room
    pushLog(s, `🚪 ${p.name} entered the ${getRoom(dest.room).name}.`)
  }
  s.movesLeft = 0
  s.phase = 'ACTION'
  return s
}

export function takeSecretPassage(state: MysteryState): MysteryState {
  if (state.phase !== 'ROLL') return state
  const p = state.players[state.currentPlayerIndex]
  if (!p.inRoom) return state
  const dest = getRoom(p.inRoom).secret
  if (!dest) return state
  const s = clone(state)
  const me = s.players[s.currentPlayerIndex]
  placeInRoom(me, dest)
  s.suspectLocations[me.suspectId] = dest
  s.phase = 'ACTION'
  pushLog(s, `🗝️ ${me.name} slipped through a secret passage into the ${getRoom(dest).name}.`)
  return s
}

// Stay in the room you began the turn in (e.g. dragged here by a suggestion).
export function stayAndSuggest(state: MysteryState): MysteryState {
  if (state.phase !== 'ROLL') return state
  const p = state.players[state.currentPlayerIndex]
  if (!p.inRoom) return state
  const s = clone(state)
  s.phase = 'ACTION'
  s.movesLeft = 0
  return s
}

function nextOpponentIndex(state: MysteryState, fromIdx: number): number {
  const n = state.players.length
  return (fromIdx + 1) % n
}

export function makeSuggestion(state: MysteryState, suspectId: string, weaponId: string): MysteryState {
  if (state.phase !== 'ACTION' || state.suggestionMade) return state
  const p = state.players[state.currentPlayerIndex]
  if (!p.inRoom) return state
  const room = p.inRoom
  const s = clone(state)

  // Drag the accused suspect + weapon into this room.
  s.suspectLocations[suspectId] = room
  s.players.forEach((q) => { if (q.suspectId === suspectId) placeInRoom(q, room) })
  s.weaponLocations[weaponId] = room

  s.pending = { suspect: suspectId, weapon: weaponId, room, suggesterId: p.id, askIndex: nextOpponentIndex(s, s.currentPlayerIndex) }
  s.phase = 'DISPROVE'
  pushLog(s, `❓ ${p.name} suggests it was ${cardName(suspectId)} with the ${cardName(weaponId)} in the ${getRoom(room).name}.`)
  return advanceDisprove(s)
}

// Auto-resolves through bots and opponents with no matching card; pauses only
// when a human opponent holds a matching card and must choose which to show.
function advanceDisprove(state: MysteryState): MysteryState {
  let s = state
  while (s.pending) {
    const pend = s.pending
    const asked = s.players[pend.askIndex]

    // Came back around to the suggester — nobody could disprove.
    if (asked.id === pend.suggesterId) {
      return finalizeNoDisprove(s)
    }

    const matching = asked.hand.filter((c) => c === pend.suspect || c === pend.weapon || c === pend.room)

    if (matching.length === 0) {
      s = clone(s)
      s.pending!.askIndex = nextOpponentIndex(s, s.pending!.askIndex)
      continue
    }

    if (asked.isBot) {
      // Prefer a card already revealed before, to leak less new information.
      const prevShown = new Set(s.suggestionLog.filter((r) => r.disproverId === asked.id).map((r) => r.shownCard))
      const pick = matching.find((c) => prevShown.has(c)) ?? matching[0]
      s = finalizeDisprove(s, pend.askIndex, pick)
      continue
    }

    // Human opponent must choose — pause for their input.
    s = clone(s)
    s.revealChoices = matching
    return s
  }
  return s
}

function finalizeDisprove(state: MysteryState, disproverIdx: number, card: string): MysteryState {
  const s = clone(state)
  const pend = s.pending!
  const disprover = s.players[disproverIdx]
  const suggester = s.players.find((p) => p.id === pend.suggesterId)!

  s.suggestionLog = [...s.suggestionLog, {
    suggesterId: suggester.id, suggesterName: suggester.name,
    suspect: pend.suspect, weapon: pend.weapon, room: pend.room,
    disproverId: disprover.id, disproverName: disprover.name, shownCard: card,
  }]
  s.lastReveal = { toPlayerId: suggester.id, fromPlayerId: disprover.id, card }
  if (!suggester.known.includes(card)) suggester.known.push(card)

  pushLog(s, `🃏 ${disprover.name} privately showed ${suggester.name} a card.`)
  s.pending = null
  s.revealChoices = null
  s.suggestionMade = true
  s.phase = 'ACTION'
  return s
}

function finalizeNoDisprove(state: MysteryState): MysteryState {
  const s = clone(state)
  const pend = s.pending!
  const suggester = s.players.find((p) => p.id === pend.suggesterId)!

  // Deduction: any named card the suggester doesn't hold must be the solution.
  ;[
    ['suspect', pend.suspect] as const,
    ['weapon', pend.weapon] as const,
    ['room', pend.room] as const,
  ].forEach(([cat, card]) => {
    if (!suggester.hand.includes(card)) {
      // Confirm it: every OTHER card of that category is not the solution.
      categoryCards(cat).forEach((c) => {
        if (c !== card && !suggester.known.includes(c)) suggester.known.push(c)
      })
    }
  })

  s.suggestionLog = [...s.suggestionLog, {
    suggesterId: suggester.id, suggesterName: suggester.name,
    suspect: pend.suspect, weapon: pend.weapon, room: pend.room,
    disproverId: null, disproverName: null,
  }]
  pushLog(s, `🔍 No one could disprove ${suggester.name}'s suggestion!`)
  s.pending = null
  s.revealChoices = null
  s.suggestionMade = true
  s.phase = 'ACTION'
  return s
}

// Human disprover reveals a chosen card.
export function respondDisprove(state: MysteryState, card: string): MysteryState {
  if (state.phase !== 'DISPROVE' || !state.pending) return state
  return finalizeDisprove(state, state.pending.askIndex, card)
}

export function makeAccusation(state: MysteryState, suspectId: string, weaponId: string, roomId: RoomId): MysteryState {
  if (state.phase !== 'ACTION' && state.phase !== 'ROLL') return state
  const s = clone(state)
  const p = s.players[s.currentPlayerIndex]
  const correct =
    suspectId === s.solution.suspect &&
    weaponId === s.solution.weapon &&
    roomId === s.solution.room

  pushLog(s, `📣 ${p.name} accuses: ${cardName(suspectId)}, the ${cardName(weaponId)}, in the ${getRoom(roomId).name}.`)

  if (correct) {
    s.winnerId = p.id
    s.phase = 'GAME_OVER'
    pushLog(s, `🏆 Correct! ${p.name} cracked the case and wins Mystery Manor!`)
    return s
  }

  p.eliminated = true
  pushLog(s, `❌ Wrong! ${p.name} is out of the investigation (but must still disprove others).`)

  const active = s.players.filter((q) => !q.eliminated)
  if (active.length === 1) {
    s.winnerId = active[0].id
    s.phase = 'GAME_OVER'
    pushLog(s, `🏆 ${active[0].name} is the last sleuth standing and wins by default!`)
    return s
  }
  return endTurn(s)
}

export function endTurn(state: MysteryState): MysteryState {
  if (state.phase === 'GAME_OVER') return state
  const s = clone(state)
  let next = s.currentPlayerIndex
  for (let i = 0; i < s.players.length; i++) {
    next = (next + 1) % s.players.length
    if (!s.players[next].eliminated) break
  }
  s.currentPlayerIndex = next
  s.phase = 'ROLL'
  s.dice = null
  s.movesLeft = 0
  s.suggestionMade = false
  s.lastReveal = null
  pushLog(s, `➡️ It is now ${s.players[next].name}'s turn.`)
  return s
}

// ---- Bot AI -----------------------------------------------------------------

function candidates(p: MysteryPlayer, cat: CardCategory): string[] {
  return categoryCards(cat).filter((c) => !p.known.includes(c))
}

function roomCenter(room: RoomId): Cell {
  const r = getRoom(room).rect
  return { x: Math.round((r.x1 + r.x2) / 2), y: Math.round((r.y1 + r.y2) / 2) }
}

// One atomic decision for the active bot, based on the current phase.
export function playBotStep(state: MysteryState): MysteryState {
  const p = state.players[state.currentPlayerIndex]
  if (!p.isBot) return state

  const suspectCands = candidates(p, 'suspect')
  const weaponCands = candidates(p, 'weapon')
  const roomCands = candidates(p, 'room')
  const solved = suspectCands.length === 1 && weaponCands.length === 1 && roomCands.length === 1

  switch (state.phase) {
    case 'ROLL': {
      if (solved) return makeAccusation(state, suspectCands[0], weaponCands[0], roomCands[0] as RoomId)
      return rollDice(state)
    }
    case 'MOVE': {
      const reach = getReachable(state, state.currentPlayerIndex)
      // Prefer entering a room we still want to test, else the nearest room.
      const wanted = reach.rooms.filter((r) => roomCands.includes(r.room))
      const target = (wanted.length ? wanted : reach.rooms).sort((a, b) => a.dist - b.dist)[0]
      if (target) return moveTo(state, { kind: 'room', room: target.room })

      // No room in range — step toward the nearest candidate room.
      if (reach.cells.length) {
        const goalRoom = (roomCands[0] ?? ROOMS[0].id) as RoomId
        const goal = roomCenter(goalRoom)
        const best = reach.cells
          .slice()
          .sort((a, b) =>
            (Math.abs(a.x - goal.x) + Math.abs(a.y - goal.y)) -
            (Math.abs(b.x - goal.x) + Math.abs(b.y - goal.y)))[0]
        return moveTo(state, { kind: 'cell', x: best.x, y: best.y })
      }
      return endTurn(state) // stuck
    }
    case 'ACTION': {
      if (p.inRoom && !state.suggestionMade) {
        const suspect = suspectCands[0] ?? SUSPECTS[0].id
        const weapon = weaponCands[0] ?? WEAPONS[0].id
        return makeSuggestion(state, suspect, weapon)
      }
      if (solved) return makeAccusation(state, suspectCands[0], weaponCands[0], roomCands[0] as RoomId)
      return endTurn(state)
    }
    default:
      return state // DISPROVE handled elsewhere; GAME_OVER terminal
  }
}
