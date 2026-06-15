// Doodle Dash — game engine (pure state; no rendering, no side effects).
//
// A free-for-all online draw-and-guess game (skribbl-style, distinct from the
// team/board game Quick Draw): each round one player CHOOSES a word from three
// options and draws it; everyone else guesses in chat simultaneously. Letters
// of the word are revealed as hints while the timer runs down. Faster correct
// guesses score more; the drawer earns points per correct guess.
//
// The word lives in broadcast state and is gated by the UI (only the drawer
// sees it fully) — same hidden-info trade-off as the other games here.

export const ROUND_SECONDS = 70
const ROTATIONS = 2

export type Phase = 'LOBBY' | 'CHOOSE' | 'DRAWING' | 'ROUND_END' | 'GAME_OVER'

export interface DoodlePlayer {
  id: string
  name: string
  score: number
  guessedThisRound: boolean
}

export interface ChatEntry {
  id: string
  name: string
  text: string
  kind: 'guess' | 'correct' | 'system'
}

export interface DoodleState {
  players: DoodlePlayer[]
  drawerIndex: number
  wordChoices: string[] | null     // shown to the drawer during CHOOSE
  word: string | null
  revealed: number[]               // indices of revealed hint letters
  phase: Phase
  roundNumber: number
  totalRounds: number
  roundEndsAt: number | null
  correctCount: number
  chat: ChatEntry[]
  winnerId: string | null
  log: string[]
}

export const WORDS = [
  'balloon', 'tiger', 'guitar', 'rocket', 'pancake', 'igloo', 'octopus', 'cactus',
  'windmill', 'pirate', 'rainbow', 'dolphin', 'castle', 'volcano', 'snowman',
  'bicycle', 'lighthouse', 'dragon', 'umbrella', 'astronaut', 'hamburger',
  'penguin', 'campfire', 'tornado', 'jellyfish', 'telescope', 'parachute',
  'kangaroo', 'pineapple', 'ladder', 'spider', 'tractor', 'mermaid', 'scarecrow',
  'compass', 'waterfall', 'submarine', 'fireworks', 'treasure', 'skateboard',
  'dinosaur', 'helicopter', 'cupcake', 'lantern', 'whale', 'crocodile',
  'sunflower', 'wizard', 'violin', 'mushroom', 'snowflake', 'anchor', 'beehive',
  'camera', 'donut', 'elephant', 'feather', 'gorilla', 'hammock', 'jukebox',
]

const clone = (s: DoodleState): DoodleState => JSON.parse(JSON.stringify(s))
const pushLog = (s: DoodleState, m: string) => { s.log = [...s.log, m].slice(-60) }

export function getPlayerName(state: DoodleState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}
export function normalize(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
}
function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}
function threeWords(): string[] { return shuffle(WORDS).slice(0, 3) }

export function maxHints(word: string): number {
  return Math.min(Math.max(1, Math.floor(word.length / 3)), 4)
}

// Masked word: revealed letters show, the rest are underscores.
export function maskedWord(word: string | null, revealed: number[]): string {
  if (!word) return ''
  return word.split('').map((c, i) => (revealed.includes(i) ? c : '_')).join(' ')
}

// ---- Lifecycle --------------------------------------------------------------

export function initializeGame(playersData: { id: string; name: string; isBot?: boolean }[]): DoodleState {
  const players: DoodlePlayer[] = playersData.map((p) => ({ id: p.id, name: p.name, score: 0, guessedThisRound: false }))
  const base: DoodleState = {
    players,
    drawerIndex: 0,
    wordChoices: null,
    word: null,
    revealed: [],
    phase: 'LOBBY',
    roundNumber: 0,
    totalRounds: players.length * ROTATIONS,
    roundEndsAt: null,
    correctCount: 0,
    chat: [],
    winnerId: null,
    log: ['🖍️ Welcome to Doodle Dash! Pick a word, draw fast, and let everyone guess.'],
  }
  if (players.length >= 2) return offerChoices(base, 0, 1)
  return base
}

function offerChoices(state: DoodleState, drawerIndex: number, roundNumber: number): DoodleState {
  const s = clone(state)
  s.drawerIndex = drawerIndex
  s.roundNumber = roundNumber
  s.wordChoices = threeWords()
  s.word = null
  s.revealed = []
  s.phase = 'CHOOSE'
  s.roundEndsAt = null
  s.correctCount = 0
  s.players.forEach((p) => { p.guessedThisRound = false })
  pushLog(s, `✏️ Round ${roundNumber}/${s.totalRounds} — ${s.players[drawerIndex].name} is choosing a word.`)
  return s
}

export function chooseWord(state: DoodleState, word: string): DoodleState {
  if (state.phase !== 'CHOOSE' || !state.wordChoices?.includes(word)) return state
  const s = clone(state)
  s.word = word
  s.wordChoices = null
  s.phase = 'DRAWING'
  s.roundEndsAt = Date.now() + ROUND_SECONDS * 1000
  pushLog(s, `🎨 ${s.players[s.drawerIndex].name} is drawing now!`)
  return s
}

// Host-only: reveal one more random hint letter.
export function revealHint(state: DoodleState): DoodleState {
  if (state.phase !== 'DRAWING' || !state.word) return state
  if (state.revealed.length >= maxHints(state.word)) return state
  const hidden = state.word.split('').map((_, i) => i).filter((i) => !state.revealed.includes(i))
  if (!hidden.length) return state
  const s = clone(state)
  s.revealed.push(hidden[Math.floor(Math.random() * hidden.length)])
  return s
}

// Host-only: advance to the next drawer or end the game.
export function nextRound(state: DoodleState): DoodleState {
  if (state.phase === 'GAME_OVER') return state
  if (state.roundNumber >= state.totalRounds) {
    const s = clone(state)
    s.phase = 'GAME_OVER'
    const winner = [...s.players].sort((a, b) => b.score - a.score)[0]
    s.winnerId = winner?.id ?? null
    s.word = null
    pushLog(s, `🏆 ${winner?.name} wins Doodle Dash with ${winner?.score} points!`)
    return s
  }
  return offerChoices(state, (state.drawerIndex + 1) % state.players.length, state.roundNumber + 1)
}

export function endRound(state: DoodleState): DoodleState {
  if (state.phase !== 'DRAWING') return state
  const s = clone(state)
  s.phase = 'ROUND_END'
  s.roundEndsAt = null
  s.chat = [...s.chat, { id: `sys-${Date.now()}`, name: 'system', kind: 'system' as const, text: `The word was "${s.word}".` }].slice(-80)
  pushLog(s, `⏱️ Round over — the word was "${s.word}".`)
  return s
}

// ---- Guessing ---------------------------------------------------------------

export function submitGuess(state: DoodleState, playerId: string, text: string): DoodleState {
  if (state.phase !== 'DRAWING' || !state.word) return state
  const player = state.players.find((p) => p.id === playerId)
  const isDrawer = state.players[state.drawerIndex].id === playerId
  if (!player || isDrawer || player.guessedThisRound) return state

  const s = clone(state)
  const me = s.players.find((p) => p.id === playerId)!
  const correct = normalize(text) === normalize(s.word!)

  if (correct) {
    const remaining = Math.max(0, Math.round(((s.roundEndsAt ?? Date.now()) - Date.now()) / 1000))
    const points = Math.max(25, remaining)
    me.score += points
    me.guessedThisRound = true
    s.correctCount += 1
    s.players[s.drawerIndex].score += 20
    s.chat = [...s.chat, { id: `c-${Date.now()}-${playerId}`, name: me.name, kind: 'correct' as const, text: `${me.name} guessed it! (+${points})` }].slice(-80)
    pushLog(s, `✅ ${me.name} guessed the word (+${points}).`)
    const guessers = s.players.filter((p, i) => i !== s.drawerIndex)
    if (guessers.every((p) => p.guessedThisRound)) return endRound(s)
  } else {
    s.chat = [...s.chat, { id: `c-${Date.now()}-${playerId}`, name: me.name, kind: 'guess' as const, text: text.slice(0, 60) }].slice(-80)
  }
  return s
}
