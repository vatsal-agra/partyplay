// Color Clash — game engine (pure state; no rendering, no side effects).
//
// A fast color/number matching card game. Match the top card by color, number,
// or symbol; action cards skip, reverse, and force draws; wilds change the
// active color. First to empty their hand wins. Includes a bot for solo play.
//
// Card-type names (Skip, Reverse, +2, Wild, +4) are generic mechanics terms;
// the title is original ("Color Clash"). No trademarked content.

export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type Value =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

export type Phase = 'PLAY' | 'CHOOSE_COLOR' | 'GAME_OVER'

export interface Card { id: string; color: Color; value: Value }

export interface UnoPlayer {
  id: string
  name: string
  isBot: boolean
  hand: Card[]
}

export interface UnoState {
  players: UnoPlayer[]
  currentPlayerIndex: number
  direction: 1 | -1
  drawPile: Card[]
  discardPile: Card[]
  activeColor: Color           // colour currently in effect (after a wild this is the chosen one)
  phase: Phase
  pendingDrawnCardId: string | null   // a freshly drawn card the player may still play
  unoCallNeeded: string | null        // player who reached 1 card and hasn't called "UNO!" — catchable
  winnerId: string | null
  lastAction: string | null
  log: string[]
}

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue']

const clone = (s: UnoState): UnoState => JSON.parse(JSON.stringify(s))
const pushLog = (s: UnoState, m: string) => { s.log = [...s.log, m].slice(-70) }

export function getPlayerName(state: UnoState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

function buildDeck(): Card[] {
  const deck: Card[] = []
  let n = 0
  const add = (color: Color, value: Value) => deck.push({ id: `${color}-${value}-${n++}`, color, value })
  for (const color of COLORS) {
    add(color, '0')
    for (let v = 1; v <= 9; v++) { add(color, String(v) as Value); add(color, String(v) as Value) }
    for (const a of ['skip', 'reverse', 'draw2'] as Value[]) { add(color, a); add(color, a) }
  }
  for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'wild4') }
  return deck
}

export function symbolFor(value: Value): string {
  switch (value) {
    case 'skip': return '🚫'
    case 'reverse': return '🔄'
    case 'draw2': return '+2'
    case 'wild': return '🌈'
    case 'wild4': return '+4'
    default: return value
  }
}

export function canPlay(card: Card, topValue: Value, activeColor: Color): boolean {
  if (card.color === 'wild') return true
  return card.color === activeColor || card.value === topValue
}

// ---- Initialization ---------------------------------------------------------

export function initializeGame(playersData: { id: string; name: string; isBot: boolean }[]): UnoState {
  const roster = playersData.slice(0, 10)
  let deck = shuffle(buildDeck())

  const players: UnoPlayer[] = roster.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, hand: [] }))
  for (let r = 0; r < 7; r++) for (const pl of players) pl.hand.push(deck.pop()!)

  // First discard must be a plain coloured number card.
  let first = deck.pop()!
  while (first.color === 'wild' || ['skip', 'reverse', 'draw2'].includes(first.value)) {
    deck.unshift(first)
    deck = shuffle(deck)
    first = deck.pop()!
  }

  return {
    players,
    currentPlayerIndex: 0,
    direction: 1,
    drawPile: deck,
    discardPile: [first],
    activeColor: first.color,
    phase: 'PLAY',
    pendingDrawnCardId: null,
    unoCallNeeded: null,
    winnerId: null,
    lastAction: null,
    log: [`🎴 Color Clash begins! Top card: ${first.color} ${first.value}.`],
  }
}

// ---- Helpers ----------------------------------------------------------------

function top(s: UnoState): Card { return s.discardPile[s.discardPile.length - 1] }

function advance(s: UnoState, steps = 1) {
  const n = s.players.length
  s.currentPlayerIndex = (((s.currentPlayerIndex + s.direction * steps) % n) + n) % n
}

function nextIndex(s: UnoState): number {
  const n = s.players.length
  return (((s.currentPlayerIndex + s.direction) % n) + n) % n
}

function ensureDraw(s: UnoState) {
  if (s.drawPile.length === 0) {
    const keep = s.discardPile.pop()!
    s.drawPile = shuffle(s.discardPile)
    s.discardPile = [keep]
  }
}

function drawN(s: UnoState, playerIndex: number, count: number) {
  for (let i = 0; i < count; i++) {
    ensureDraw(s)
    const c = s.drawPile.pop()
    if (c) s.players[playerIndex].hand.push(c)
  }
}

// Applies the effect of a non-wild action card, then advances the turn.
function resolveColoredEffect(s: UnoState, card: Card) {
  if (card.value === 'skip') {
    pushLog(s, `🚫 ${s.players[nextIndex(s)].name} is skipped.`)
    advance(s, 2)
  } else if (card.value === 'reverse') {
    s.direction = (s.direction * -1) as 1 | -1
    if (s.players.length === 2) advance(s, 2)
    else advance(s, 1)
    pushLog(s, `🔄 Direction reversed.`)
  } else if (card.value === 'draw2') {
    const tgt = nextIndex(s)
    drawN(s, tgt, 2)
    pushLog(s, `➕ ${s.players[tgt].name} draws 2 and is skipped.`)
    advance(s, 2)
  } else {
    advance(s, 1)
  }
}

// ---- Actions ----------------------------------------------------------------

export function playCard(state: UnoState, playerId: string, cardId: string, chosenColor?: Color): UnoState {
  if (state.phase !== 'PLAY') return state
  const idx = state.currentPlayerIndex
  const player = state.players[idx]
  if (player.id !== playerId) return state
  const card = player.hand.find((c) => c.id === cardId)
  if (!card) return state
  if (!canPlay(card, top(state).value, state.activeColor)) return state

  const s = clone(state)
  const me = s.players[idx]
  // If I was the one who owed an "UNO!" call, reaching my turn again safely
  // closes the catch window.
  if (s.unoCallNeeded === me.id) s.unoCallNeeded = null
  me.hand = me.hand.filter((c) => c.id !== cardId)
  s.discardPile.push(card)
  s.pendingDrawnCardId = null
  s.lastAction = `${me.name} played ${card.color === 'wild' ? '' : card.color + ' '}${card.value}`
  pushLog(s, `▶️ ${me.name} played ${card.color === 'wild' ? '' : card.color + ' '}${card.value}.`)

  // Down to one card — must call "UNO!" or risk being caught for +2.
  if (me.hand.length === 1) s.unoCallNeeded = me.id

  // Win check — emptying your hand ends it immediately.
  if (me.hand.length === 0) {
    s.winnerId = me.id
    s.phase = 'GAME_OVER'
    pushLog(s, `🏆 ${me.name} played their last card and wins Color Clash!`)
    return s
  }

  if (card.color === 'wild') {
    if (!chosenColor) {
      s.phase = 'CHOOSE_COLOR'   // human must pick a colour
      return s
    }
    return applyWildColor(s, chosenColor)
  }

  s.activeColor = card.color
  resolveColoredEffect(s, card)
  return s
}

// Operates on an already-cloned state (caller clones).
function applyWildColor(s: UnoState, color: Color): UnoState {
  const t = top(s)
  s.activeColor = color
  pushLog(s, `🎨 Colour is now ${color}.`)
  if (t.value === 'wild4') {
    const tgt = nextIndex(s)
    drawN(s, tgt, 4)
    pushLog(s, `➕ ${s.players[tgt].name} draws 4 and is skipped.`)
    advance(s, 2)
  } else {
    advance(s, 1)
  }
  s.phase = 'PLAY'
  return s
}

export function chooseColor(state: UnoState, color: Color): UnoState {
  if (state.phase !== 'CHOOSE_COLOR') return state
  return applyWildColor(clone(state), color)
}

export function drawCard(state: UnoState, playerId: string): UnoState {
  if (state.phase !== 'PLAY') return state
  const idx = state.currentPlayerIndex
  if (state.players[idx].id !== playerId) return state
  if (state.pendingDrawnCardId) return state // already drew this turn

  const s = clone(state)
  // Reaching your turn again safely closes any pending UNO catch window.
  if (s.unoCallNeeded === s.players[idx].id) s.unoCallNeeded = null
  ensureDraw(s)
  const c = s.drawPile.pop()
  if (!c) { advance(s, 1); return s }
  s.players[idx].hand.push(c)
  pushLog(s, `🃏 ${s.players[idx].name} drew a card.`)

  if (canPlay(c, top(s).value, s.activeColor)) {
    s.pendingDrawnCardId = c.id  // may play it or pass
    return s
  }
  advance(s, 1)
  return s
}

// Call "UNO!" — the player at one card claims safety before anyone catches them.
export function callUno(state: UnoState, playerId: string): UnoState {
  if (state.unoCallNeeded !== playerId) return state
  const s = clone(state)
  s.unoCallNeeded = null
  pushLog(s, `🔔 ${getPlayerName(s, playerId)} calls UNO!`)
  return s
}

// Catch a player who forgot to call "UNO!" — they draw 2 as a penalty.
export function catchUno(state: UnoState, catcherId: string): UnoState {
  const targetId = state.unoCallNeeded
  if (!targetId || targetId === catcherId) return state
  const s = clone(state)
  const targetIdx = s.players.findIndex((p) => p.id === targetId)
  if (targetIdx < 0) return state
  s.unoCallNeeded = null
  drawN(s, targetIdx, 2)
  pushLog(s, `🚨 ${getPlayerName(s, catcherId)} caught ${getPlayerName(s, targetId)} not calling UNO — draw 2!`)
  return s
}

// Decline to play the just-drawn card.
export function passTurn(state: UnoState, playerId: string): UnoState {
  if (state.phase !== 'PLAY') return state
  const idx = state.currentPlayerIndex
  if (state.players[idx].id !== playerId) return state
  const s = clone(state)
  s.pendingDrawnCardId = null
  advance(s, 1)
  pushLog(s, `⏭️ ${s.players[idx].name} passes.`)
  return s
}

// ---- Bot --------------------------------------------------------------------

function bestColor(hand: Card[]): Color {
  const counts: Record<string, number> = { red: 0, yellow: 0, green: 0, blue: 0 }
  hand.forEach((c) => { if (c.color !== 'wild') counts[c.color]++ })
  return (COLORS.slice().sort((a, b) => counts[b] - counts[a])[0]) as Color
}

export function playBotStep(state: UnoState): UnoState {
  if (state.phase === 'GAME_OVER') return state
  const idx = state.currentPlayerIndex
  const bot = state.players[idx]
  if (!bot.isBot) return state

  const t = top(state)
  const playable = bot.hand.filter((c) => canPlay(c, t.value, state.activeColor))

  if (playable.length > 0) {
    // Prefer to shed action/wild cards, keep simple otherwise.
    const order = (c: Card) => (c.value === 'wild4' ? 1 : c.color === 'wild' ? 2 : ['skip', 'reverse', 'draw2'].includes(c.value) ? 3 : 4)
    const pick = playable.slice().sort((a, b) => order(a) - order(b))[0]
    const color = pick.color === 'wild' ? bestColor(bot.hand) : undefined
    return playCard(state, bot.id, pick.id, color)
  }

  // Nothing to play — draw, then play the drawn card if possible.
  let s = drawCard(state, bot.id)
  if (s.pendingDrawnCardId && s.currentPlayerIndex === idx) {
    const drawn = s.players[idx].hand.find((c) => c.id === s.pendingDrawnCardId)!
    const color = drawn.color === 'wild' ? bestColor(s.players[idx].hand) : undefined
    return playCard(s, bot.id, drawn.id, color)
  }
  return s
}
