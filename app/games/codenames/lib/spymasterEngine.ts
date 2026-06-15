// Spymaster — game engine (pure state; no rendering, no side effects).
//
// Two teams race to contact all their agents on a 5x5 grid of code words.
// Each team's spymaster (who alone sees the secret key) gives a one-word clue
// plus a number; their operatives tap words to guess. Hit your own agent and
// keep going; hit a neutral or the enemy and your turn ends; hit the assassin
// and you lose instantly. First team to find all its agents wins.
//
// Human spymasters only (no bot — clue-giving is a language task best left to
// people or a future Claude-powered option). Supports online + pass-and-play.

export type Team = 'red' | 'blue'
export type CellColor = 'red' | 'blue' | 'neutral' | 'assassin'
export type Role = 'spymaster' | 'operative'
export type Phase = 'CLUE' | 'GUESS' | 'GAME_OVER'

export interface Cell { word: string; color: CellColor; revealed: boolean }

export interface SpyPlayer { id: string; name: string; team: Team; role: Role }

export interface SpymasterState {
  players: SpyPlayer[]
  board: Cell[]
  startingTeam: Team
  currentTeam: Team
  phase: Phase
  clue: { word: string; number: number } | null
  guessesLeft: number
  redRemaining: number
  blueRemaining: number
  winner: Team | null
  endReason: string | null
  log: string[]
}

// Original, generic single words — no trademarked content.
export const WORD_BANK = [
  'apple', 'river', 'knight', 'robot', 'crown', 'engine', 'forest', 'planet',
  'anchor', 'comet', 'dragon', 'harbor', 'jungle', 'ladder', 'mammoth', 'needle',
  'opera', 'pirate', 'quartz', 'rocket', 'saddle', 'temple', 'violin', 'wizard',
  'yacht', 'bridge', 'castle', 'diamond', 'falcon', 'glacier', 'hammer', 'island',
  'jacket', 'kettle', 'lantern', 'marble', 'nugget', 'orbit', 'pyramid', 'quill',
  'ranch', 'signal', 'tiger', 'umbrella', 'volcano', 'walnut', 'zebra', 'beacon',
  'canyon', 'desert', 'ember', 'fossil', 'garden', 'helmet', 'igloo', 'jewel',
  'kayak', 'lemon', 'meteor', 'nomad', 'oasis', 'prism', 'raven', 'storm',
  'thunder', 'vortex', 'willow', 'maple', 'cobra', 'saturn',
]

const clone = (s: SpymasterState): SpymasterState => JSON.parse(JSON.stringify(s))
const pushLog = (s: SpymasterState, m: string) => { s.log = [...s.log, m].slice(-60) }

export function getPlayerName(state: SpymasterState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}

export function initializeGame(playersData: { id: string; name: string; isBot?: boolean }[]): SpymasterState {
  // Split into two teams; first on each team is the spymaster.
  const roster = playersData.slice(0, 8)
  const players: SpyPlayer[] = []
  const redCount = Math.ceil(roster.length / 2)
  roster.forEach((p, i) => {
    const team: Team = i < redCount ? 'red' : 'blue'
    players.push({ id: p.id, name: p.name, team, role: 'operative' })
  })
  // Promote first of each team to spymaster.
  const firstRed = players.find((p) => p.team === 'red'); if (firstRed) firstRed.role = 'spymaster'
  const firstBlue = players.find((p) => p.team === 'blue'); if (firstBlue) firstBlue.role = 'spymaster'

  const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue'
  const other: Team = startingTeam === 'red' ? 'blue' : 'red'

  // 9 starting / 8 other / 7 neutral / 1 assassin.
  const colors: CellColor[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(other),
    ...Array(7).fill('neutral'),
    'assassin',
  ]
  const words = shuffle(WORD_BANK).slice(0, 25)
  const shuffledColors = shuffle(colors)
  const board: Cell[] = words.map((word, i) => ({ word, color: shuffledColors[i], revealed: false }))

  return {
    players,
    board,
    startingTeam,
    currentTeam: startingTeam,
    phase: 'CLUE',
    clue: null,
    guessesLeft: 0,
    redRemaining: startingTeam === 'red' ? 9 : 8,
    blueRemaining: startingTeam === 'blue' ? 9 : 8,
    winner: null,
    endReason: null,
    log: [`🕵️ Spymaster begins! ${startingTeam.toUpperCase()} team goes first — spymaster, give a clue.`],
  }
}

function switchTeam(s: SpymasterState) {
  s.currentTeam = s.currentTeam === 'red' ? 'blue' : 'red'
  s.phase = 'CLUE'
  s.clue = null
  s.guessesLeft = 0
}

// ---- Actions ----------------------------------------------------------------

export function giveClue(state: SpymasterState, word: string, number: number): SpymasterState {
  if (state.phase !== 'CLUE') return state
  const w = word.trim()
  if (!w || number < 1) return state
  const s = clone(state)
  s.clue = { word: w.slice(0, 24), number }
  s.guessesLeft = number + 1   // operatives may make one extra guess
  s.phase = 'GUESS'
  pushLog(s, `💬 ${s.currentTeam.toUpperCase()} spymaster: "${s.clue.word}" — ${number}.`)
  return s
}

export function guessCard(state: SpymasterState, index: number): SpymasterState {
  if (state.phase !== 'GUESS') return state
  const cell = state.board[index]
  if (!cell || cell.revealed) return state

  const s = clone(state)
  const c = s.board[index]
  c.revealed = true
  pushLog(s, `👉 ${s.currentTeam.toUpperCase()} reveals "${c.word}" — ${c.color}.`)

  if (c.color === 'red') s.redRemaining--
  if (c.color === 'blue') s.blueRemaining--

  // Win checks
  if (s.redRemaining === 0) return endGame(s, 'red', 'Red contacted all their agents!')
  if (s.blueRemaining === 0) return endGame(s, 'blue', 'Blue contacted all their agents!')

  if (c.color === 'assassin') {
    const winner: Team = s.currentTeam === 'red' ? 'blue' : 'red'
    return endGame(s, winner, `${s.currentTeam.toUpperCase()} hit the assassin!`)
  }

  if (c.color === s.currentTeam) {
    // correct — may keep guessing
    s.guessesLeft--
    if (s.guessesLeft <= 0) { pushLog(s, `↪️ ${s.currentTeam.toUpperCase()} is out of guesses.`); switchTeam(s) }
    return s
  }

  // neutral or enemy agent — turn ends
  pushLog(s, c.color === 'neutral' ? `⬜ Neutral — turn ends.` : `🔁 Enemy agent — turn ends.`)
  switchTeam(s)
  return s
}

export function endGuessing(state: SpymasterState): SpymasterState {
  if (state.phase !== 'GUESS') return state
  const s = clone(state)
  pushLog(s, `🛑 ${s.currentTeam.toUpperCase()} stops guessing.`)
  switchTeam(s)
  return s
}

function endGame(s: SpymasterState, winner: Team, reason: string): SpymasterState {
  s.winner = winner
  s.phase = 'GAME_OVER'
  s.endReason = reason
  pushLog(s, `🏆 ${winner.toUpperCase()} team wins — ${reason}`)
  return s
}
