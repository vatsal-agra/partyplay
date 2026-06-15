// XP → level math (pure). Total XP to *reach* level L is 50·(L−1)·L, giving a
// gently steepening curve: L2 = 100, L3 = 300, L4 = 600, L5 = 1000, …

export function totalXpForLevel(level: number): number {
  const l = Math.max(1, level)
  return 50 * (l - 1) * l
}

export function levelFromXp(xp: number): number {
  const x = Math.max(0, xp || 0)
  return Math.floor((50 + Math.sqrt(2500 + 200 * x)) / 100)
}

export interface LevelProgress {
  level: number
  title: string
  intoLevel: number     // xp earned within the current level
  span: number          // xp needed to clear the current level
  pct: number           // 0..100
  toNext: number        // xp remaining to next level
}

const TITLES = [
  "Newbie", "Rookie", "Regular", "Sharp", "Contender", "Pro", "Ace",
  "Veteran", "Champion", "Master", "Grandmaster", "Legend", "Mythic",
]

export function titleForLevel(level: number): string {
  return TITLES[Math.min(level - 1, TITLES.length - 1)] || "Legend"
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelFromXp(xp)
  const base = totalXpForLevel(level)
  const next = totalXpForLevel(level + 1)
  const span = Math.max(1, next - base)
  const intoLevel = Math.max(0, (xp || 0) - base)
  return {
    level,
    title: titleForLevel(level),
    intoLevel,
    span,
    pct: Math.min(100, Math.round((intoLevel / span) * 100)),
    toNext: Math.max(0, next - (xp || 0)),
  }
}

// XP a game awards (kept in sync with the record_game_result RPC).
export const XP_PER_GAME = 30
export const XP_WIN_BONUS = 70
export function xpForGame(won: boolean): number {
  return XP_PER_GAME + (won ? XP_WIN_BONUS : 0)
}
