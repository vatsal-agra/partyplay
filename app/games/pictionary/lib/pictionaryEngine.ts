// Quick Draw — game engine (pure state; no rendering, no side effects).
//
// Real-time multiplayer drawing & guessing. Each round one player is the
// drawer with a secret word and sketches it on a shared canvas; everyone else
// races to guess in chat. Faster correct guesses score more; the drawer earns
// points when others guess their drawing. Highest score after all rounds wins.
//
// Note: the secret word lives in broadcast state and is gated by the UI (only
// the drawer sees it). True secrecy would need a server authority — acceptable
// for casual play, same trade-off as the other hidden-info games here.

export const ROUND_SECONDS = 75
const ROTATIONS = 2           // how many times each player draws

export type Phase = 'LOBBY' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER'

export interface PictionaryPlayer {
  id: string
  name: string
  score: number
  guessedThisRound: boolean
}

export interface ChatEntry {
  id: string
  playerId: string
  name: string
  text: string
  kind: 'guess' | 'correct' | 'system'
}

export interface PictionaryState {
  players: PictionaryPlayer[]
  drawerIndex: number
  word: string | null            // secret; UI reveals only to the drawer
  phase: Phase
  roundNumber: number            // 1-based; counts every drawer turn
  totalRounds: number
  roundEndsAt: number | null     // epoch ms
  correctCount: number           // correct guessers this round
  chat: ChatEntry[]
  winnerId: string | null
  log: string[]
}

// ---- Word bank (generic, original — no trademarked terms) -------------------
export const WORDS = [
  'apple', 'rocket', 'elephant', 'guitar', 'mountain', 'pizza', 'robot',
  'rainbow', 'butterfly', 'castle', 'octopus', 'volcano', 'snowman', 'bicycle',
  'lighthouse', 'dragon', 'umbrella', 'cactus', 'astronaut', 'hamburger',
  'penguin', 'anchor', 'campfire', 'tornado', 'jellyfish', 'windmill',
  'telescope', 'sandcastle', 'parachute', 'kangaroo', 'pineapple', 'ladder',
  'spider', 'tractor', 'igloo', 'mermaid', 'scarecrow', 'hammock', 'compass',
  'waterfall', 'beehive', 'submarine', 'fireworks', 'treasure', 'skateboard',
  'dinosaur', 'helicopter', 'snail', 'cupcake', 'lantern', 'tent', 'whale',
  'crocodile', 'sunflower', 'wizard', 'pirate', 'rollercoaster', 'violin',
  'mushroom', 'igloo', 'snowflake', 'kite', 'cactus', 'dolphin',
]

const clone = (s: PictionaryState): PictionaryState => JSON.parse(JSON.stringify(s))
const pushLog = (s: PictionaryState, m: string) => { s.log = [...s.log, m].slice(-60) }

export function getPlayerName(state: PictionaryState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

export function normalize(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}

function pickWord(exclude?: string | null): string {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)]
  let guard = 0
  while (w === exclude && guard++ < 10) w = WORDS[Math.floor(Math.random() * WORDS.length)]
  return w
}

// ---- Lifecycle --------------------------------------------------------------

export function initializeGame(playersData: { id: string; name: string; isBot?: boolean }[]): PictionaryState {
  const players: PictionaryPlayer[] = playersData.map((p) => ({
    id: p.id, name: p.name, score: 0, guessedThisRound: false,
  }))

  const base: PictionaryState = {
    players,
    drawerIndex: 0,
    word: null,
    phase: 'LOBBY',
    roundNumber: 0,
    totalRounds: players.length * ROTATIONS,
    roundEndsAt: null,
    correctCount: 0,
    chat: [],
    winnerId: null,
    log: ['🎨 Welcome to Quick Draw! Sketch the word and let friends guess.'],
  }

  if (players.length >= 2) return beginRound(base, 0, 1)
  return base
}

function beginRound(state: PictionaryState, drawerIndex: number, roundNumber: number): PictionaryState {
  const s = clone(state)
  s.drawerIndex = drawerIndex
  s.roundNumber = roundNumber
  s.word = pickWord(s.word)
  s.phase = 'DRAWING'
  s.roundEndsAt = Date.now() + ROUND_SECONDS * 1000
  s.correctCount = 0
  s.players.forEach((p) => { p.guessedThisRound = false })
  pushLog(s, `✏️ Round ${roundNumber}/${s.totalRounds} — ${s.players[drawerIndex].name} is drawing.`)
  return s
}

// Host-only: advance to the next drawer (or end the game).
export function nextRound(state: PictionaryState): PictionaryState {
  if (state.phase === 'GAME_OVER') return state
  if (state.roundNumber >= state.totalRounds) {
    const s = clone(state)
    s.phase = 'GAME_OVER'
    const winner = [...s.players].sort((a, b) => b.score - a.score)[0]
    s.winnerId = winner?.id ?? null
    s.word = null
    pushLog(s, `🏆 ${winner?.name} wins Quick Draw with ${winner?.score} points!`)
    return s
  }
  const nextDrawer = (state.drawerIndex + 1) % state.players.length
  return beginRound(state, nextDrawer, state.roundNumber + 1)
}

// Host-only: close the current round (timer expired or everyone guessed).
export function endRound(state: PictionaryState): PictionaryState {
  if (state.phase !== 'DRAWING') return state
  const s = clone(state)
  s.phase = 'ROUND_END'
  s.roundEndsAt = null
  s.chat = [...s.chat, {
    id: `sys-${Date.now()}`, playerId: 'system', name: 'system', kind: 'system' as const,
    text: `The word was "${s.word}".`,
  }].slice(-80)
  pushLog(s, `⏱️ Round over — the word was "${s.word}".`)
  return s
}

// ---- Guessing ---------------------------------------------------------------

export function submitGuess(state: PictionaryState, playerId: string, text: string): PictionaryState {
  if (state.phase !== 'DRAWING' || !state.word) return state
  const player = state.players.find((p) => p.id === playerId)
  const isDrawer = state.players[state.drawerIndex].id === playerId
  if (!player || isDrawer || player.guessedThisRound) return state

  const s = clone(state)
  const me = s.players.find((p) => p.id === playerId)!
  const correct = normalize(text) === normalize(s.word!)

  if (correct) {
    const remaining = Math.max(0, Math.round(((s.roundEndsAt ?? Date.now()) - Date.now()) / 1000))
    const points = Math.max(25, remaining)              // faster guess scores more
    me.score += points
    me.guessedThisRound = true
    s.correctCount += 1
    s.players[s.drawerIndex].score += 20                // drawer reward per correct guess
    s.chat = [...s.chat, {
      id: `c-${Date.now()}-${playerId}`, playerId, name: me.name, kind: 'correct' as const,
      text: `${me.name} guessed the word! (+${points})`,
    }].slice(-80)
    pushLog(s, `✅ ${me.name} guessed it (+${points}).`)

    // Everyone (besides the drawer) has guessed — end early.
    const guessers = s.players.filter((p, i) => i !== s.drawerIndex)
    if (guessers.every((p) => p.guessedThisRound)) {
      return endRound(s)
    }
  } else {
    s.chat = [...s.chat, {
      id: `c-${Date.now()}-${playerId}`, playerId, name: me.name, kind: 'guess' as const,
      text: text.slice(0, 60),
    }].slice(-80)
  }
  return s
}

// Convenience for the UI: masked word hint (underscores per letter).
export function maskedWord(word: string | null): string {
  if (!word) return ''
  return word.split('').map((c) => (c === ' ' ? '  ' : '_')).join(' ')
}
