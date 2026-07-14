// Quick Draw — real team Pictionary engine (pure state; no side effects).
//
// Two teams race a token around a board of category-coloured squares. On a
// team's turn their current artist draws the word matching their square's
// category while only their team guesses; a correct guess rolls the die and
// advances the token. Rainbow "All Play" squares pit both teams' artists
// drawing the SAME word at once — the first team to guess it advances. First
// team to reach FINISH wins.
//
// Secret words live in broadcast state, gated by the UI (only the drawing
// artist(s) see them) — the same hidden-info trade-off as the other games.

export const ROUND_SECONDS = 70

export type Team = "red" | "blue"
export type Category = "PERSON" | "OBJECT" | "ACTION" | "DIFFICULT" | "ALLPLAY"
export type Phase = "LOBBY" | "DRAWING" | "ALLPLAY" | "TURN_END" | "GAME_OVER"

export const TEAMS: Team[] = ["red", "blue"]

export const TEAM_META: Record<Team, { name: string; hex: string }> = {
  red: { name: "Red Team", hex: "#e0524a" },
  blue: { name: "Blue Team", hex: "#4a7fe0" },
}

export const CATEGORY_META: Record<Category, { label: string; short: string; hex: string; icon: string }> = {
  PERSON: { label: "Person / Place / Animal", short: "P", hex: "#e8b53a", icon: "🧍" },
  OBJECT: { label: "Object", short: "O", hex: "#3fa356", icon: "📦" },
  ACTION: { label: "Action", short: "A", hex: "#4a7fe0", icon: "🎬" },
  DIFFICULT: { label: "Difficult", short: "D", hex: "#c2452e", icon: "🎲" },
  ALLPLAY: { label: "All Play", short: "AP", hex: "#a24fb0", icon: "🌈" },
}

export interface PictionaryPlayer {
  id: string
  name: string
  team: Team
}

export interface Card {
  PERSON: string
  OBJECT: string
  ACTION: string
  DIFFICULT: string
  ALLPLAY: string
}

export interface ChatEntry {
  id: string
  playerId: string
  name: string
  team: Team | null
  text: string
  kind: "guess" | "correct" | "system"
}

export interface PictionaryState {
  players: PictionaryPlayer[]
  board: Category[]                 // square index -> category; last index is FINISH
  positions: Record<Team, number>   // token position per team (0 = start)
  artistIndex: Record<Team, number> // rotating drawer within each team
  activeTeam: Team
  phase: Phase
  card: Card | null                 // current card (secret words)
  category: Category                // category to draw this turn
  roundEndsAt: number | null        // epoch ms
  lastRoll: number | null
  chat: ChatEntry[]
  winningTeam: Team | null
  winnerId: string | null           // kept for the shared summary layer (first player of winning team)
  log: string[]
}

// ---- Card bank (each card: one word per category — generic, original) -------
export const CARDS: Card[] = [
  { PERSON: "astronaut", OBJECT: "umbrella", ACTION: "juggling", DIFFICULT: "gravity", ALLPLAY: "volcano" },
  { PERSON: "wizard", OBJECT: "telescope", ACTION: "sneezing", DIFFICULT: "echo", ALLPLAY: "lighthouse" },
  { PERSON: "pirate", OBJECT: "anchor", ACTION: "tiptoe", DIFFICULT: "loyalty", ALLPLAY: "waterfall" },
  { PERSON: "kangaroo", OBJECT: "hammock", ACTION: "yawning", DIFFICULT: "silence", ALLPLAY: "rainbow" },
  { PERSON: "mermaid", OBJECT: "compass", ACTION: "shivering", DIFFICULT: "jealousy", ALLPLAY: "fireworks" },
  { PERSON: "scarecrow", OBJECT: "lantern", ACTION: "sculpting", DIFFICULT: "freedom", ALLPLAY: "tornado" },
  { PERSON: "penguin", OBJECT: "ladder", ACTION: "whispering", DIFFICULT: "patience", ALLPLAY: "castle" },
  { PERSON: "dragon", OBJECT: "kite", ACTION: "surfing", DIFFICULT: "courage", ALLPLAY: "windmill" },
  { PERSON: "octopus", OBJECT: "violin", ACTION: "yodeling", DIFFICULT: "memory", ALLPLAY: "carousel" },
  { PERSON: "cowboy", OBJECT: "cactus", ACTION: "hiccuping", DIFFICULT: "wisdom", ALLPLAY: "campfire" },
  { PERSON: "ballerina", OBJECT: "trophy", ACTION: "sprinting", DIFFICULT: "dizzy", ALLPLAY: "beehive" },
  { PERSON: "chef", OBJECT: "kettle", ACTION: "stretching", DIFFICULT: "invisible", ALLPLAY: "submarine" },
  { PERSON: "robot", OBJECT: "toothbrush", ACTION: "shrugging", DIFFICULT: "future", ALLPLAY: "treasure" },
  { PERSON: "vampire", OBJECT: "candle", ACTION: "floating", DIFFICULT: "shadow", ALLPLAY: "snowman" },
  { PERSON: "farmer", OBJECT: "wheelbarrow", ACTION: "digging", DIFFICULT: "harvest", ALLPLAY: "tent" },
  { PERSON: "clown", OBJECT: "balloon", ACTION: "tripping", DIFFICULT: "chaos", ALLPLAY: "rollercoaster" },
  { PERSON: "knight", OBJECT: "shield", ACTION: "bowing", DIFFICULT: "honor", ALLPLAY: "drawbridge" },
  { PERSON: "surfer", OBJECT: "surfboard", ACTION: "paddling", DIFFICULT: "balance", ALLPLAY: "hurricane" },
  { PERSON: "detective", OBJECT: "magnifier", ACTION: "sniffing", DIFFICULT: "mystery", ALLPLAY: "mansion" },
  { PERSON: "gardener", OBJECT: "watering can", ACTION: "pruning", DIFFICULT: "growth", ALLPLAY: "greenhouse" },
]

// ---- Board layout -----------------------------------------------------------
// A repeating category ribbon with an All-Play every few squares, ending on
// FINISH (represented by the ALLPLAY tile at the last index).
const BOARD_PATTERN: Category[] = [
  "PERSON", "OBJECT", "ACTION", "DIFFICULT", "ALLPLAY",
  "OBJECT", "ACTION", "PERSON", "DIFFICULT", "ALLPLAY",
  "ACTION", "PERSON", "OBJECT", "DIFFICULT",
]
export const BOARD_LENGTH = 30 // squares 0..29; index 29 = FINISH

function buildBoard(): Category[] {
  const b: Category[] = []
  for (let i = 0; i < BOARD_LENGTH - 1; i++) b.push(BOARD_PATTERN[i % BOARD_PATTERN.length])
  b.push("ALLPLAY") // FINISH is a rainbow square
  return b
}

const clone = (s: PictionaryState): PictionaryState => JSON.parse(JSON.stringify(s))
const pushLog = (s: PictionaryState, m: string) => { s.log = [...s.log, m].slice(-60) }

export function getPlayerName(state: PictionaryState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || "Unknown"
}

export function normalize(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]/g, "")
}

export function teamOf(state: PictionaryState, playerId: string): Team | null {
  return state.players.find((p) => p.id === playerId)?.team ?? null
}

export function teamMembers(state: PictionaryState, team: Team): PictionaryPlayer[] {
  return state.players.filter((p) => p.team === team)
}

// The player currently drawing for a team (rotates each of that team's turns).
export function artistId(state: PictionaryState, team: Team): string | null {
  const members = teamMembers(state, team)
  if (members.length === 0) return null
  return members[state.artistIndex[team] % members.length].id
}

// Is this player one of the artists who should see the word right now?
export function isArtist(state: PictionaryState, playerId: string): boolean {
  if (state.phase === "DRAWING") return artistId(state, state.activeTeam) === playerId
  if (state.phase === "ALLPLAY") return TEAMS.some((t) => artistId(state, t) === playerId)
  return false
}

// The secret word a given artist is drawing (null if they shouldn't see one).
export function wordFor(state: PictionaryState, playerId: string): string | null {
  if (!state.card || !isArtist(state, playerId)) return null
  return state.card[state.category]
}

function pickCard(prev: Card | null): Card {
  let c = CARDS[Math.floor(Math.random() * CARDS.length)]
  let guard = 0
  while (prev && c.PERSON === prev.PERSON && guard++ < 8) c = CARDS[Math.floor(Math.random() * CARDS.length)]
  return c
}
const rollDie = () => 1 + Math.floor(Math.random() * 6)

// ---- Lifecycle --------------------------------------------------------------

export function initializeGame(playersData: { id: string; name: string; isBot?: boolean }[]): PictionaryState {
  // Split into two balanced teams by join order.
  const players: PictionaryPlayer[] = playersData.map((p, i) => ({
    id: p.id, name: p.name, team: i % 2 === 0 ? "red" : "blue",
  }))

  const base: PictionaryState = {
    players,
    board: buildBoard(),
    positions: { red: 0, blue: 0 },
    artistIndex: { red: 0, blue: 0 },
    activeTeam: "red",
    phase: "LOBBY",
    card: null,
    category: "PERSON",
    roundEndsAt: null,
    lastRoll: null,
    chat: [],
    winningTeam: null,
    winnerId: null,
    log: ["🎨 Welcome to Quick Draw — real team Pictionary! Split into two teams and race to the finish."],
  }

  // Need at least one player on each team to start.
  if (teamMembers(base, "red").length >= 1 && teamMembers(base, "blue").length >= 1) {
    return beginTurn(base, "red")
  }
  return base
}

// Start a team's drawing turn. If the team's square is All-Play, both teams draw.
function beginTurn(state: PictionaryState, team: Team): PictionaryState {
  const s = clone(state)
  s.activeTeam = team
  const square = s.positions[team]
  const category = s.board[square] || "PERSON"
  s.category = category
  s.card = pickCard(s.card)
  s.lastRoll = null
  s.roundEndsAt = Date.now() + ROUND_SECONDS * 1000
  if (category === "ALLPLAY") {
    s.phase = "ALLPLAY"
    pushLog(s, `🌈 All Play! Both teams draw "${CATEGORY_META.ALLPLAY.label}" — first team to guess advances.`)
  } else {
    s.phase = "DRAWING"
    const artist = artistId(s, team)
    pushLog(s, `✏️ ${TEAM_META[team].name}: ${getPlayerName(s, artist || "")} is drawing a ${CATEGORY_META[category].label}.`)
  }
  return s
}

// Host-only: the timer expired without a correct guess.
export function timeout(state: PictionaryState): PictionaryState {
  if (state.phase !== "DRAWING" && state.phase !== "ALLPLAY") return state
  const s = clone(state)
  s.phase = "TURN_END"
  s.roundEndsAt = null
  s.chat = [...s.chat, sysMsg(`Time! The word was "${s.card ? s.card[s.category] : "?"}".`)].slice(-80)
  pushLog(s, `⏱️ Time up — the word was "${s.card ? s.card[s.category] : "?"}".`)
  return s
}

// Host-only: advance to the next turn after a turn ends.
export function nextTurn(state: PictionaryState): PictionaryState {
  if (state.phase === "GAME_OVER") return state
  const s = clone(state)
  // Rotate the artist for whichever team(s) just drew, then hand off.
  if (s.phase === "TURN_END" || s.phase === "DRAWING" || s.phase === "ALLPLAY") {
    // The team that just had the turn rotates its artist; on all-play both do.
    if (s.category === "ALLPLAY") TEAMS.forEach((t) => { s.artistIndex[t] += 1 })
    else s.artistIndex[s.activeTeam] += 1
  }
  const next: Team = s.activeTeam === "red" ? "blue" : "red"
  return beginTurn(s, next)
}

function sysMsg(text: string): ChatEntry {
  return { id: `sys-${Math.random().toString(36).slice(2)}`, playerId: "system", name: "system", team: null, kind: "system", text }
}

function advanceAndCheckWin(s: PictionaryState, team: Team, steps: number): void {
  const target = Math.min(BOARD_LENGTH - 1, s.positions[team] + steps)
  s.positions[team] = target
  if (target >= BOARD_LENGTH - 1) {
    s.phase = "GAME_OVER"
    s.winningTeam = team
    s.winnerId = teamMembers(s, team)[0]?.id ?? null
    s.roundEndsAt = null
    pushLog(s, `🏆 ${TEAM_META[team].name} reached the finish and wins Quick Draw!`)
  }
}

// ---- Guessing ---------------------------------------------------------------

export function submitGuess(state: PictionaryState, playerId: string, text: string): PictionaryState {
  if (state.phase !== "DRAWING" && state.phase !== "ALLPLAY") return state
  if (!state.card) return state
  const guesser = state.players.find((p) => p.id === playerId)
  if (!guesser) return state
  // Artists can't guess their own drawing.
  if (isArtist(state, playerId)) return state
  // In a normal turn only the active team may guess; in all-play, anyone may.
  if (state.phase === "DRAWING" && guesser.team !== state.activeTeam) return state

  const s = clone(state)
  const me = s.players.find((p) => p.id === playerId)!
  const answer = s.card![s.category]
  const correct = normalize(text) === normalize(answer)

  if (!correct) {
    s.chat = [...s.chat, { id: `c-${Date.now()}-${playerId}`, playerId, name: me.name, team: me.team, kind: "guess" as const, text: text.slice(0, 60) }].slice(-80)
    return s
  }

  // Correct! The guesser's team advances by a die roll.
  const winTeam = me.team
  const roll = rollDie()
  s.lastRoll = roll
  s.chat = [...s.chat, { id: `c-${Date.now()}-${playerId}`, playerId, name: me.name, team: me.team, kind: "correct" as const, text: `${me.name} guessed "${answer}"! ${TEAM_META[winTeam].name} rolls ${roll}.` }].slice(-80)
  pushLog(s, `✅ ${me.name} got it — ${TEAM_META[winTeam].name} advances ${roll}.`)
  advanceAndCheckWin(s, winTeam, roll)
  if (s.phase !== "GAME_OVER") {
    s.phase = "TURN_END"
    s.roundEndsAt = null
  }
  return s
}

// Masked hint for guessers (underscores per letter, spaces preserved).
export function maskedWord(word: string | null): string {
  if (!word) return ""
  return word.split("").map((c) => (c === " " ? "  " : "_")).join(" ")
}
