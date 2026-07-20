// Poker — Texas Hold'em engine (pure state; no rendering, no side effects).
//
// Standard hold'em: 2 private hole cards each, five shared community cards over
// four betting rounds (pre-flop, flop, turn, river), best five-card hand wins.
// Side-pot math is simplified (single main pot) — fine for casual play.
//
// Hole cards live in broadcast state, gated by the UI (you see only your own) —
// same hidden-info trade-off as the other games here.

export type Suit = 'S' | 'H' | 'D' | 'C'
export interface Card { rank: number; suit: Suit; id: string }   // rank 2..14 (14=A)

export type Stage = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN' | 'HAND_OVER' | 'GAME_OVER'
export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'allin'

export interface PokerPlayer {
  id: string
  name: string
  isBot: boolean
  chips: number
  hole: Card[]
  bet: number          // contribution in the current betting round
  folded: boolean
  allIn: boolean
  hasActed: boolean
  busted: boolean
}

export interface PokerState {
  players: PokerPlayer[]
  dealerIndex: number
  currentPlayerIndex: number
  deck: Card[]
  community: Card[]
  pot: number
  currentBet: number   // highest bet this round
  minRaise: number
  stage: Stage
  smallBlind: number
  bigBlind: number
  smallBlindIndex: number   // seat that posted the small blind this hand
  bigBlindIndex: number     // seat that posted the big blind this hand
  handNumber: number
  winnerIds: string[]
  winningDesc: string | null
  lastAction: string | null
  log: string[]
}

export const HAND_NAMES = [
  'High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight',
  'Flush', 'Full House', 'Four of a Kind', 'Straight Flush',
]
const SUITS: Suit[] = ['S', 'H', 'D', 'C']
const START_CHIPS = 1000

const clone = (s: PokerState): PokerState => JSON.parse(JSON.stringify(s))
const pushLog = (s: PokerState, m: string) => { s.log = [...s.log, m].slice(-80) }

export function getPlayerName(state: PokerState, id: string): string {
  return state.players.find((p) => p.id === id)?.name || 'Unknown'
}

export function rankLabel(r: number): string {
  return r <= 10 ? String(r) : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' } as Record<number, string>)[r]
}
export function suitSymbol(s: Suit): string {
  return ({ S: '♠', H: '♥', D: '♦', C: '♣' } as Record<Suit, string>)[s]
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] }
  return r
}
function freshDeck(): Card[] {
  const d: Card[] = []
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ rank: r, suit: s, id: `${r}${s}` })
  return shuffle(d)
}

// ---- Hand evaluation (best 5 of 7) -----------------------------------------
// Returns a comparable score array: [category, ...tiebreakers]; bigger wins.
export function evaluate(cards: Card[]): number[] {
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a)
  const countByRank: Record<number, number> = {}
  ranks.forEach((r) => { countByRank[r] = (countByRank[r] || 0) + 1 })
  const bySuit: Record<string, number[]> = {}
  cards.forEach((c) => { (bySuit[c.suit] ||= []).push(c.rank) })

  const flushSuit = Object.keys(bySuit).find((s) => bySuit[s].length >= 5)
  const flushRanks = flushSuit ? bySuit[flushSuit].slice().sort((a, b) => b - a) : null

  const straightHigh = (rs: number[]): number | null => {
    const uniq = Array.from(new Set(rs)).sort((a, b) => b - a)
    if (uniq.includes(14)) uniq.push(1) // wheel A-2-3-4-5
    let run = 1
    for (let i = 1; i < uniq.length; i++) {
      if (uniq[i] === uniq[i - 1] - 1) { run++; if (run >= 5) return uniq[i] + 4 } else run = 1
    }
    return null
  }

  const sfHigh = flushRanks ? straightHigh(flushRanks) : null
  if (sfHigh) return [8, sfHigh]

  // group ranks by count
  const groups = Object.entries(countByRank)
    .map(([r, c]) => ({ r: +r, c }))
    .sort((a, b) => b.c - a.c || b.r - a.r)

  const quad = groups.find((g) => g.c === 4)
  if (quad) {
    const kicker = ranks.find((r) => r !== quad.r)!
    return [7, quad.r, kicker]
  }
  const trips = groups.filter((g) => g.c === 3)
  const pairs = groups.filter((g) => g.c === 2)
  if (trips.length && (pairs.length || trips.length > 1)) {
    const pairRank = trips.length > 1 ? trips[1].r : pairs[0].r
    return [6, trips[0].r, pairRank]
  }
  if (flushRanks) return [5, ...flushRanks.slice(0, 5)]
  const sHigh = straightHigh(ranks)
  if (sHigh) return [4, sHigh]
  if (trips.length) {
    const kick = ranks.filter((r) => r !== trips[0].r).slice(0, 2)
    return [3, trips[0].r, ...kick]
  }
  if (pairs.length >= 2) {
    const [p1, p2] = pairs
    const kick = ranks.find((r) => r !== p1.r && r !== p2.r)!
    return [2, p1.r, p2.r, kick]
  }
  if (pairs.length === 1) {
    const kick = ranks.filter((r) => r !== pairs[0].r).slice(0, 3)
    return [1, pairs[0].r, ...kick]
  }
  return [0, ...ranks.slice(0, 5)]
}

export function compareScore(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

// ---- Lifecycle --------------------------------------------------------------

export function initializeGame(playersData: { id: string; name: string; isBot: boolean }[]): PokerState {
  const players: PokerPlayer[] = playersData.slice(0, 8).map((p) => ({
    id: p.id, name: p.name, isBot: p.isBot, chips: START_CHIPS,
    hole: [], bet: 0, folded: false, allIn: false, hasActed: false, busted: false,
  }))
  const base: PokerState = {
    players, dealerIndex: 0, currentPlayerIndex: 0, deck: [], community: [],
    pot: 0, currentBet: 0, minRaise: 20, stage: 'HAND_OVER',
    smallBlind: 10, bigBlind: 20, smallBlindIndex: -1, bigBlindIndex: -1, handNumber: 0,
    winnerIds: [], winningDesc: null, lastAction: null,
    log: ["♠ Welcome to the Poker table! Good luck."],
  }
  return startHand(base)
}

function activeIndices(s: PokerState): number[] {
  return s.players.map((p, i) => i).filter((i) => !s.players[i].busted)
}
function nextActive(s: PokerState, from: number): number {
  const n = s.players.length
  let i = from
  for (let k = 0; k < n; k++) { i = (i + 1) % n; if (!s.players[i].busted) return i }
  return from
}

export function startHand(state: PokerState): PokerState {
  const s = clone(state)
  s.players.forEach((p) => { if (p.chips <= 0) p.busted = true })
  const live = activeIndices(s)
  if (live.length < 2) {
    s.stage = 'GAME_OVER'
    s.winnerIds = live.length === 1 ? [s.players[live[0]].id] : []
    if (s.winnerIds[0]) pushLog(s, `🏆 ${getPlayerName(s, s.winnerIds[0])} wins the table!`)
    return s
  }

  s.handNumber++
  s.deck = freshDeck()
  s.community = []
  s.pot = 0
  s.winnerIds = []
  s.winningDesc = null
  s.lastAction = null
  s.players.forEach((p) => { p.hole = []; p.bet = 0; p.folded = p.busted; p.allIn = false; p.hasActed = false })

  // advance dealer to a live seat
  s.dealerIndex = nextActive(s, s.dealerIndex)

  // deal 2 each
  for (let r = 0; r < 2; r++) for (const i of live) s.players[i].hole.push(s.deck.pop()!)

  const heads = live.length === 2
  const sbIndex = heads ? s.dealerIndex : nextActive(s, s.dealerIndex)
  const bbIndex = nextActive(s, sbIndex)

  postBlind(s, sbIndex, s.smallBlind)
  postBlind(s, bbIndex, s.bigBlind)
  s.smallBlindIndex = sbIndex
  s.bigBlindIndex = bbIndex
  s.currentBet = s.bigBlind
  s.minRaise = s.bigBlind
  s.stage = 'PREFLOP'

  s.currentPlayerIndex = nextActive(s, bbIndex)
  pushLog(s, `🂠 Hand #${s.handNumber} dealt. Blinds ${s.smallBlind}/${s.bigBlind}.`)
  return s
}

function postBlind(s: PokerState, idx: number, amount: number) {
  const p = s.players[idx]
  const pay = Math.min(amount, p.chips)
  p.chips -= pay; p.bet += pay; s.pot += pay
  if (p.chips === 0) p.allIn = true
}

// ---- Betting helpers --------------------------------------------------------

function needsToAct(s: PokerState, i: number): boolean {
  const p = s.players[i]
  return !p.folded && !p.allIn && (!p.hasActed || p.bet < s.currentBet)
}

function nextToAct(s: PokerState): number | null {
  const n = s.players.length
  let i = s.currentPlayerIndex
  for (let k = 0; k < n; k++) {
    i = (i + 1) % n
    if (needsToAct(s, i)) return i
  }
  return null
}

function contenders(s: PokerState): number[] {
  return s.players.map((p, i) => i).filter((i) => !s.players[i].folded)
}

function startBettingRound(s: PokerState, firstFrom: number) {
  s.players.forEach((p) => { if (!p.folded && !p.allIn) p.hasActed = false; p.bet = 0 })
  s.currentBet = 0
  s.minRaise = s.bigBlind
  let i = firstFrom
  const n = s.players.length
  for (let k = 0; k < n; k++) { if (needsToAct(s, i)) { s.currentPlayerIndex = i; return } i = (i + 1) % n }
  s.currentPlayerIndex = firstFrom
}

function advanceStage(s: PokerState): PokerState {
  // everyone but one folded → award immediately
  const live = contenders(s)
  if (live.length === 1) return awardHand(s)

  // if all remaining are all-in (no more betting), deal out the rest then showdown
  const canBet = live.filter((i) => !s.players[i].allIn)
  const dealAndShow = canBet.length <= 1

  const deal = (count: number) => { for (let c = 0; c < count; c++) s.community.push(s.deck.pop()!) }

  if (s.stage === 'PREFLOP') { deal(3); s.stage = 'FLOP'; pushLog(s, `🃏 Flop: ${s.community.map(cardStr).join(' ')}`) }
  else if (s.stage === 'FLOP') { deal(1); s.stage = 'TURN'; pushLog(s, `🃏 Turn: ${cardStr(s.community[3])}`) }
  else if (s.stage === 'TURN') { deal(1); s.stage = 'RIVER'; pushLog(s, `🃏 River: ${cardStr(s.community[4])}`) }
  else if (s.stage === 'RIVER') { return showdown(s) }

  if (dealAndShow && s.stage !== 'RIVER') return advanceStage(s)   // keep dealing to the river
  if (dealAndShow && s.stage === 'RIVER') return showdown(s)

  startBettingRound(s, s.dealerIndex)
  return s
}

function cardStr(c?: Card): string { return c ? `${rankLabel(c.rank)}${suitSymbol(c.suit)}` : '' }

function showdown(s: PokerState): PokerState {
  s.stage = 'SHOWDOWN'
  const live = contenders(s)
  let best: number[] | null = null
  let winners: number[] = []
  for (const i of live) {
    const score = evaluate([...s.players[i].hole, ...s.community])
    if (!best || compareScore(score, best) > 0) { best = score; winners = [i] }
    else if (compareScore(score, best) === 0) winners.push(i)
  }
  s.winningDesc = best ? HAND_NAMES[best[0]] : null
  return awardHand(s, winners)
}

function awardHand(s: PokerState, winnerIdxs?: number[]): PokerState {
  const live = contenders(s)
  const winners = winnerIdxs ?? live
  const share = Math.floor(s.pot / winners.length)
  winners.forEach((i) => { s.players[i].chips += share })
  s.winnerIds = winners.map((i) => s.players[i].id)
  s.stage = 'HAND_OVER'
  const names = winners.map((i) => s.players[i].name).join(', ')
  pushLog(s, `💰 ${names} ${winners.length > 1 ? 'split' : 'wins'} the pot (${s.pot})${s.winningDesc ? ' with ' + s.winningDesc : ''}.`)
  s.players.forEach((p) => { if (p.chips <= 0) p.busted = true })
  return s
}

function afterAction(s: PokerState): PokerState {
  if (contenders(s).length === 1) return awardHand(s)
  const nxt = nextToAct(s)
  if (nxt === null) return advanceStage(s)
  s.currentPlayerIndex = nxt
  return s
}

// ---- Public actions ---------------------------------------------------------

function validTurn(state: PokerState, playerId: string): boolean {
  return ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(state.stage) &&
    state.players[state.currentPlayerIndex]?.id === playerId
}

export function fold(state: PokerState, playerId: string): PokerState {
  if (!validTurn(state, playerId)) return state
  const s = clone(state)
  const p = s.players[s.currentPlayerIndex]
  p.folded = true; p.hasActed = true
  s.lastAction = `${p.name} folds`
  pushLog(s, `🚪 ${p.name} folds.`)
  return afterAction(s)
}

export function checkCall(state: PokerState, playerId: string): PokerState {
  if (!validTurn(state, playerId)) return state
  const s = clone(state)
  const p = s.players[s.currentPlayerIndex]
  const need = s.currentBet - p.bet
  if (need <= 0) {
    p.hasActed = true
    s.lastAction = `${p.name} checks`
    pushLog(s, `✔️ ${p.name} checks.`)
  } else {
    const pay = Math.min(need, p.chips)
    p.chips -= pay; p.bet += pay; s.pot += pay; p.hasActed = true
    if (p.chips === 0) p.allIn = true
    s.lastAction = `${p.name} calls ${pay}`
    pushLog(s, `📞 ${p.name} calls ${pay}.`)
  }
  return afterAction(s)
}

// Raise the round bet to `toTotal` (a player's total contribution this round).
export function raiseTo(state: PokerState, playerId: string, toTotal: number): PokerState {
  if (!validTurn(state, playerId)) return state
  const s = clone(state)
  const p = s.players[s.currentPlayerIndex]
  const maxTotal = p.bet + p.chips
  let target = Math.min(toTotal, maxTotal)
  const minTarget = s.currentBet + s.minRaise
  if (target < minTarget && target < maxTotal) target = minTarget       // enforce min raise unless all-in
  if (target <= s.currentBet && target < maxTotal) return state          // not a real raise
  const pay = target - p.bet
  if (pay > p.chips) return state
  p.chips -= pay; s.pot += pay
  const raiseBy = target - s.currentBet
  p.bet = target
  s.currentBet = target
  if (raiseBy >= s.minRaise) s.minRaise = raiseBy
  p.hasActed = true
  if (p.chips === 0) p.allIn = true
  // everyone else must respond
  s.players.forEach((q, i) => { if (i !== s.currentPlayerIndex && !q.folded && !q.allIn) q.hasActed = false })
  s.lastAction = `${p.name} ${p.allIn ? 'is all-in' : 'raises to'} ${target}`
  pushLog(s, `⬆️ ${p.name} ${p.allIn ? 'goes all-in for' : 'raises to'} ${target}.`)
  return afterAction(s)
}

export function allIn(state: PokerState, playerId: string): PokerState {
  if (!validTurn(state, playerId)) return state
  const p = state.players[state.currentPlayerIndex]
  return raiseTo(state, playerId, p.bet + p.chips)
}

// Start the next hand after one concludes.
export function nextHand(state: PokerState): PokerState {
  if (state.stage !== 'HAND_OVER') return state
  return startHand(state)
}

// ---- Bot --------------------------------------------------------------------

const chenVal = (r: number): number =>
  r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2

// Pre-flop hand strength in [0,1], from the Chen formula — so junk like 7-2
// folds to a raise and premium hands play back, instead of calling everything.
function preflopStrength(hole: Card[]): number {
  const ranks = hole.map((c) => c.rank).sort((a, b) => b - a)
  const [hi, lo] = ranks
  const suited = hole[0].suit === hole[1].suit
  if (hi === lo) return Math.min(1, Math.max(5, chenVal(hi) * 2) / 20) // pocket pair
  let pts = chenVal(hi)
  if (suited) pts += 2
  const gap = hi - lo - 1
  pts -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && hi < 12) pts += 1 // low-connector straight potential
  return Math.max(0, Math.min(1, pts / 20))
}

// Extra equity from a live flush / open-ended straight draw (flop & turn only).
function drawBonus(hole: Card[], community: Card[]): number {
  if (community.length < 3 || community.length >= 5) return 0
  const all = [...hole, ...community]
  const bySuit: Record<string, number> = {}
  all.forEach((c) => { bySuit[c.suit] = (bySuit[c.suit] || 0) + 1 })
  const flushDraw = Object.values(bySuit).some((nn) => nn === 4)
  const ranks = Array.from(new Set(all.map((c) => c.rank))).sort((a, b) => a - b)
  let straightDraw = false
  for (let i = 0; i + 3 < ranks.length; i++) {
    if (ranks[i + 3] - ranks[i] <= 4) { straightDraw = true; break }
  }
  return (flushDraw ? 0.16 : 0) + (straightDraw ? 0.1 : 0)
}

// Made-hand base strength per category (high card … straight flush).
const CAT_BASE = [0.10, 0.40, 0.62, 0.75, 0.85, 0.91, 0.96, 0.99, 1]

function strength(s: PokerState, idx: number): number {
  const p = s.players[idx]
  if (s.community.length === 0) return preflopStrength(p.hole)
  const score = evaluate([...p.hole, ...s.community])
  const cat = score[0]
  let str = (CAT_BASE[cat] ?? 0.1) + ((score[1] || 0) / 14) * 0.12 // nudge by top kicker/pair rank
  str += drawBonus(p.hole, s.community)
  return Math.max(0, Math.min(1, str))
}

export function playBotStep(state: PokerState): PokerState {
  if (!['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(state.stage)) return state
  const idx = state.currentPlayerIndex
  const p = state.players[idx]
  if (!p.isBot) return state

  // A little noise so bots aren't perfectly predictable.
  const str = Math.max(0, Math.min(1, strength(state, idx) + (Math.random() * 0.12 - 0.06)))
  const toCall = state.currentBet - p.bet
  const pot = Math.max(1, state.pot)
  const potOdds = toCall / (pot + toCall)

  // Standard raise sizing: ~⅔ pot, rounded to big blinds, capped at all-in.
  const maxTotal = p.bet + p.chips
  const raiseSize = Math.max(state.bigBlind, Math.round((pot * 0.66) / state.bigBlind) * state.bigBlind)
  const raiseTarget = Math.min(maxTotal, state.currentBet + raiseSize)
  const canRaise = p.chips > toCall && raiseTarget > state.currentBet

  if (toCall === 0) {
    // Unbet: value-bet strong hands, occasionally stab, otherwise check.
    if (str > 0.58 && canRaise) return raiseTo(state, p.id, raiseTarget)
    if (str > 0.34 && canRaise && Math.random() < 0.22) return raiseTo(state, p.id, raiseTarget)
    return checkCall(state, p.id)
  }

  // Facing a bet.
  if (str > 0.8) {
    // Big hand — usually raise for value, sometimes flat-call to trap.
    if (canRaise && Math.random() < 0.72) return raiseTo(state, p.id, raiseTarget)
    return checkCall(state, p.id)
  }
  if (str >= potOdds + 0.16) {
    // Enough equity to continue; sometimes raise the strong end of the range.
    if (str > 0.62 && canRaise && Math.random() < 0.4) return raiseTo(state, p.id, raiseTarget)
    return checkCall(state, p.id)
  }
  // Weak — fold, with the rare post-flop bluff-raise.
  if (canRaise && str < 0.3 && state.community.length >= 3 && Math.random() < 0.05) {
    return raiseTo(state, p.id, raiseTarget)
  }
  return fold(state, p.id)
}
