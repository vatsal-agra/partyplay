import type { SupabaseClient } from "@supabase/supabase-js"
import type { GameSummary } from "@/lib/gameSummary"

// Lightweight, shareable badges. Everything here is evaluated from the final
// game state (no per-event tracking yet), so the set is intentionally "win /
// finish / flavour" oriented. Richer event-based badges (e.g. "guessed in 3s")
// can be added later once the engines emit events.

export interface Achievement {
  id: string
  name: string
  description: string
  emoji: string
  game?: string   // restrict to one game id; omit for cross-game badges
}

export const ACHIEVEMENTS: Achievement[] = [
  // Cross-game
  { id: "first_win", name: "First Blood", description: "Win your very first game.", emoji: "🥇" },
  { id: "winner", name: "Winner Winner", description: "Win a game.", emoji: "🏆" },
  { id: "finisher", name: "Good Sport", description: "Play a game all the way to the end.", emoji: "🤝" },
  { id: "bot_slayer", name: "Bot Slayer", description: "Win a game that included AI bots.", emoji: "🤖" },
  { id: "full_table", name: "Full House Party", description: "Finish a game with 4+ players.", emoji: "🎉" },
  // Game-specific signatures
  { id: "tycoon", name: "Tycoon", description: "Win Property Empire.", emoji: "🏙️", game: "monopoly" },
  { id: "bankruptcy_baron", name: "Bankruptcy Baron", description: "Win Property Empire with a rival bankrupt.", emoji: "💸", game: "monopoly" },
  { id: "master_builder", name: "Master Builder", description: "Win Hexland.", emoji: "🛖", game: "catan" },
  { id: "admiral", name: "Admiral", description: "Win Naval Clash.", emoji: "⚓", game: "battleship" },
  { id: "flawless_fleet", name: "Flawless Fleet", description: "Win Naval Clash with ships to spare.", emoji: "🚢", game: "battleship" },
  { id: "color_king", name: "Color King", description: "Win Color Clash.", emoji: "🌈", game: "uno" },
  { id: "last_one_standing", name: "Last One Standing", description: "Win the Poker table.", emoji: "🃏", game: "poker" },
  { id: "high_roller", name: "High Roller", description: "Win Poker holding 3,000+ chips.", emoji: "💰", game: "poker" },
  { id: "master_detective", name: "Master Detective", description: "Crack the case in Mystery Manor.", emoji: "🔍", game: "cluedo" },
  { id: "quick_draw_artist", name: "Quick Draw Artist", description: "Win Quick Draw.", emoji: "🎨", game: "pictionary" },
  { id: "doodle_champ", name: "Doodle Champ", description: "Win Doodle Dash.", emoji: "✏️", game: "scribbleio" },
  { id: "spymaster_supreme", name: "Spymaster Supreme", description: "Win as a Spymaster team.", emoji: "🕵️", game: "codenames" },
]

const BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))
export function getAchievement(id: string): Achievement | undefined {
  return BY_ID[id]
}

// Evaluates which achievement ids the current player earned in a finished game.
// `alreadyHave` lets us skip "first_win" for returning winners.
export function evaluateAchievements(opts: {
  gameId: string
  state: any
  summary: GameSummary
  currentUserId: string
  alreadyHave?: string[]
}): string[] {
  const { gameId, state, summary, currentUserId, alreadyHave = [] } = opts
  if (!summary.isOver) return []
  const earned = new Set<string>()
  const won = summary.youWon
  const players: any[] = Array.isArray(state?.players) ? state.players : []
  const me = players.find((p) => p.id === currentUserId)
  const hadBots = players.some((p) => p.isBot)

  // Cross-game
  earned.add("finisher")
  if (players.length >= 4) earned.add("full_table")
  if (won) {
    earned.add("winner")
    if (!alreadyHave.includes("winner") && !alreadyHave.includes("first_win")) earned.add("first_win")
    if (hadBots) earned.add("bot_slayer")
  }

  // Game-specific (only when the player won, unless noted)
  if (won) {
    switch (gameId) {
      case "monopoly":
        earned.add("tycoon")
        if (players.some((p) => p.isBankrupt)) earned.add("bankruptcy_baron")
        break
      case "catan":
        earned.add("master_builder")
        break
      case "battleship":
        earned.add("admiral")
        if (me && (me.ships || []).some((s: any) => !s.sunk)) earned.add("flawless_fleet")
        break
      case "uno":
        earned.add("color_king")
        break
      case "poker":
        earned.add("last_one_standing")
        if (me && me.chips >= 3000) earned.add("high_roller")
        break
      case "cluedo":
        earned.add("master_detective")
        break
      case "pictionary":
        earned.add("quick_draw_artist")
        break
      case "scribbleio":
        earned.add("doodle_champ")
        break
      case "codenames":
        earned.add("spymaster_supreme")
        break
    }
  }

  return Array.from(earned)
}

// Persists earned achievements via the award_achievement RPC. Returns the ids
// that were *newly* earned (so the UI can celebrate only those). Fails soft.
export async function recordAchievements(
  client: SupabaseClient,
  ids: string[]
): Promise<string[]> {
  const newly: string[] = []
  for (const id of ids) {
    try {
      const { data, error } = await client.rpc("award_achievement", { p_id: id })
      if (error) { console.warn("award_achievement failed:", error.message); continue }
      if (data === true) newly.push(id)
    } catch (err) {
      console.warn("award_achievement threw:", err)
    }
  }
  return newly
}

export async function fetchUserAchievements(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  try {
    const { data, error } = await client
      .from("user_achievements")
      .select("achievement_id")
      .eq("user_id", userId)
    if (error || !data) return []
    return data.map((r: any) => r.achievement_id)
  } catch {
    return []
  }
}
