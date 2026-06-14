// Naval Clash — game engine (pure state; no rendering, no side effects).
//
// Classic two-player naval combat: each admiral secretly places a fleet on a
// 10x10 grid, then players alternate firing salvos. First to sink the entire
// enemy fleet wins. Includes a hunt/target bot for solo play.

export const GRID = 10

export interface ShipDef { id: string; name: string; size: number }

export const FLEET: ShipDef[] = [
  { id: 'carrier',    name: 'Carrier',    size: 5 },
  { id: 'battleship', name: 'Battleship', size: 4 },
  { id: 'cruiser',    name: 'Cruiser',    size: 3 },
  { id: 'submarine',  name: 'Submarine',  size: 3 },
  { id: 'destroyer',  name: 'Destroyer',  size: 2 },
]

export type Orientation = 'H' | 'V'
export type ShotResult = 'miss' | 'hit' | 'sunk'
export type Phase = 'PLACEMENT' | 'BATTLE' | 'GAME_OVER'

export interface Cell { x: number; y: number }

export interface Ship {
  id: string
  name: string
  size: number
  cells: Cell[]          // empty until placed
  orientation: Orientation
  hits: number
  sunk: boolean
}

export interface PlayerBoard {
  id: string
  name: string
  isBot: boolean
  ships: Ship[]
  shots: Record<string, ShotResult>   // this player's shots on the OPPONENT
  ready: boolean
}

export interface BattleshipState {
  players: [PlayerBoard, PlayerBoard]
  phase: Phase
  currentPlayerIndex: number            // whose turn to fire
  winnerId: string | null
  lastShot: { byId: string; x: number; y: number; result: ShotResult; shipName?: string } | null
  log: string[]
}

export const cellKey = (x: number, y: number) => `${x},${y}`
const clone = (s: BattleshipState): BattleshipState => JSON.parse(JSON.stringify(s))
const pushLog = (s: BattleshipState, m: string) => { s.log = [...s.log, m].slice(-80) }

export function getPlayerName(state: BattleshipState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

function freshShips(): Ship[] {
  return FLEET.map((f) => ({ id: f.id, name: f.name, size: f.size, cells: [], orientation: 'H' as Orientation, hits: 0, sunk: false }))
}

export function initializeGame(playersData: { id: string; name: string; isBot: boolean }[]): BattleshipState {
  const roster = playersData.slice(0, 2)
  const players = roster.map((p) => ({
    id: p.id, name: p.name, isBot: p.isBot,
    ships: freshShips(), shots: {}, ready: false,
  })) as [PlayerBoard, PlayerBoard]

  return {
    players,
    phase: 'PLACEMENT',
    currentPlayerIndex: 0,
    winnerId: null,
    lastShot: null,
    log: ['⚓ Welcome to Naval Clash! Position your fleet, Admiral.'],
  }
}

// ---- Placement --------------------------------------------------------------

export function shipCells(x: number, y: number, size: number, o: Orientation): Cell[] {
  const cells: Cell[] = []
  for (let i = 0; i < size; i++) cells.push(o === 'H' ? { x: x + i, y } : { x, y: y + i })
  return cells
}

export function canPlace(board: PlayerBoard, size: number, x: number, y: number, o: Orientation, excludeShipId?: string): boolean {
  const cells = shipCells(x, y, size, o)
  if (cells.some((c) => c.x < 0 || c.x >= GRID || c.y < 0 || c.y >= GRID)) return false
  const taken = new Set<string>()
  board.ships.forEach((s) => {
    if (s.id === excludeShipId) return
    s.cells.forEach((c) => taken.add(cellKey(c.x, c.y)))
  })
  return cells.every((c) => !taken.has(cellKey(c.x, c.y)))
}

export function placeShip(state: BattleshipState, playerId: string, shipId: string, x: number, y: number, o: Orientation): BattleshipState {
  if (state.phase !== 'PLACEMENT') return state
  const s = clone(state)
  const board = s.players.find((p) => p.id === playerId)
  const ship = board?.ships.find((sh) => sh.id === shipId)
  if (!board || !ship) return state
  if (!canPlace(board, ship.size, x, y, o, shipId)) return state
  ship.cells = shipCells(x, y, ship.size, o)
  ship.orientation = o
  return s
}

export function randomPlace(state: BattleshipState, playerId: string): BattleshipState {
  const s = clone(state)
  const board = s.players.find((p) => p.id === playerId)
  if (!board) return state
  board.ships.forEach((sh) => { sh.cells = [] })
  for (const ship of board.ships) {
    let placed = false
    for (let tries = 0; tries < 500 && !placed; tries++) {
      const o: Orientation = Math.random() < 0.5 ? 'H' : 'V'
      const x = Math.floor(Math.random() * GRID)
      const y = Math.floor(Math.random() * GRID)
      if (canPlace(board, ship.size, x, y, o, ship.id)) {
        ship.cells = shipCells(x, y, ship.size, o)
        ship.orientation = o
        placed = true
      }
    }
  }
  return s
}

export function setReady(state: BattleshipState, playerId: string): BattleshipState {
  const s = clone(state)
  const board = s.players.find((p) => p.id === playerId)
  if (!board) return state
  if (!board.ships.every((sh) => sh.cells.length === sh.size)) return state
  board.ready = true
  pushLog(s, `🚢 ${board.name}'s fleet is in position.`)
  if (s.players.every((p) => p.ready)) {
    s.phase = 'BATTLE'
    s.currentPlayerIndex = 0
    pushLog(s, `🔥 Battle stations! ${s.players[0].name} fires first.`)
  }
  return s
}

// ---- Battle -----------------------------------------------------------------

export function fire(state: BattleshipState, x: number, y: number): BattleshipState {
  if (state.phase !== 'BATTLE') return state
  const attackerIdx = state.currentPlayerIndex
  const defenderIdx = 1 - attackerIdx
  const attacker = state.players[attackerIdx]
  const k = cellKey(x, y)
  if (attacker.shots[k]) return state // already fired here

  const s = clone(state)
  const atk = s.players[attackerIdx]
  const def = s.players[defenderIdx]

  const hitShip = def.ships.find((sh) => sh.cells.some((c) => c.x === x && c.y === y))
  let result: ShotResult = 'miss'
  let shipName: string | undefined

  if (hitShip) {
    hitShip.hits += 1
    result = 'hit'
    if (hitShip.hits >= hitShip.size) {
      hitShip.sunk = true
      result = 'sunk'
      shipName = hitShip.name
      // Reveal the whole sunk ship on the attacker's board.
      hitShip.cells.forEach((c) => { atk.shots[cellKey(c.x, c.y)] = 'sunk' })
      pushLog(s, `💥 ${atk.name} SANK ${def.name}'s ${hitShip.name}!`)
    } else {
      atk.shots[k] = 'hit'
      pushLog(s, `💥 ${atk.name} hit a ship at ${colLabel(x)}${y + 1}.`)
    }
  } else {
    atk.shots[k] = 'miss'
    pushLog(s, `🌊 ${atk.name} fired at ${colLabel(x)}${y + 1} — miss.`)
  }

  s.lastShot = { byId: atk.id, x, y, result, shipName }

  if (def.ships.every((sh) => sh.sunk)) {
    s.winnerId = atk.id
    s.phase = 'GAME_OVER'
    pushLog(s, `🏆 ${atk.name} destroyed the enemy fleet and wins Naval Clash!`)
    return s
  }

  s.currentPlayerIndex = defenderIdx
  return s
}

export function colLabel(x: number): string {
  return String.fromCharCode(65 + x) // A..J
}

// ---- Bot --------------------------------------------------------------------

function botShot(board: PlayerBoard): Cell {
  const shot = board.shots
  const inB = (x: number, y: number) => x >= 0 && x < GRID && y >= 0 && y < GRID
  const unshot = (x: number, y: number) => inB(x, y) && !shot[cellKey(x, y)]

  const hits = Object.keys(shot)
    .filter((k) => shot[k] === 'hit')
    .map((k) => k.split(',').map(Number) as [number, number])

  const targets: { x: number; y: number; pri: number }[] = []
  for (const [hx, hy] of hits) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // Continue an established line at high priority.
      if (shot[cellKey(hx + dx, hy + dy)] === 'hit') {
        let fx = hx + dx, fy = hy + dy
        while (shot[cellKey(fx, fy)] === 'hit') { fx += dx; fy += dy }
        if (unshot(fx, fy)) targets.push({ x: fx, y: fy, pri: 10 })
        if (unshot(hx - dx, hy - dy)) targets.push({ x: hx - dx, y: hy - dy, pri: 10 })
      }
      // Otherwise probe around a lone hit.
      if (unshot(hx + dx, hy + dy)) targets.push({ x: hx + dx, y: hy + dy, pri: 1 })
    }
  }
  if (targets.length) {
    targets.sort((a, b) => b.pri - a.pri)
    return { x: targets[0].x, y: targets[0].y }
  }

  // Hunt mode — checkerboard parity for efficiency.
  const cells: Cell[] = []
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (unshot(x, y)) cells.push({ x, y })
  const parity = cells.filter((c) => (c.x + c.y) % 2 === 0)
  const pool = parity.length ? parity : cells
  return pool[Math.floor(Math.random() * pool.length)]
}

// One atomic bot action for the current situation.
export function playBotStep(state: BattleshipState): BattleshipState {
  if (state.phase === 'PLACEMENT') {
    const bot = state.players.find((p) => p.isBot && !p.ready)
    if (!bot) return state
    let s = randomPlace(state, bot.id)
    s = setReady(s, bot.id)
    return s
  }
  if (state.phase === 'BATTLE') {
    const cur = state.players[state.currentPlayerIndex]
    if (!cur.isBot) return state
    const { x, y } = botShot(cur)
    return fire(state, x, y)
  }
  return state
}
