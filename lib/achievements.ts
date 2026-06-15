import type { SupabaseClient } from "@supabase/supabase-js"
import type { GameSummary } from "@/lib/gameSummary"

// Badges — the fun kind. Every one is earnable from the final game state (plus
// the player's running win/play totals for the milestone ones), so they all
// actually unlock during real play. Names lean funny on purpose.

export interface Achievement {
  id: string
  name: string
  description: string
  emoji: string
  game?: string   // restrict to one game id; omit for cross-game badges
}

export const ACHIEVEMENTS: Achievement[] = [
  // ---- Milestones (running totals) ----------------------------------------
  { id: "one_hit_wonder", name: "One-Hit Wonder", description: "Win your first game. Quit while you're ahead?", emoji: "🌟" },
  { id: "hat_trick", name: "Hat Trick", description: "Rack up 3 career wins.", emoji: "🎩" },
  { id: "certified_sweat", name: "Certified Sweat", description: "Win 10 games. Touch grass occasionally.", emoji: "😅" },
  { id: "hall_of_famer", name: "Hall of Famer", description: "Win 25 games. Absolute legend.", emoji: "👑" },
  { id: "couch_potato", name: "Couch Potato", description: "Play 10 games. The couch has a dent now.", emoji: "🛋️" },
  { id: "glutton", name: "Glutton for Punishment", description: "Play 25 games regardless of outcome.", emoji: "🍩" },

  // ---- Cross-game flavour ---------------------------------------------------
  { id: "lone_wolf", name: "Lone Wolf", description: "Win a game where every opponent was a bot. Friendless but victorious.", emoji: "🐺" },
  { id: "robot_uprising", name: "Robot Uprising Survivor", description: "Beat a lobby with AI bots in it.", emoji: "🤖" },
  { id: "participation_trophy", name: "Participation Trophy", description: "Finish dead last. You showed up, that counts.", emoji: "🥉" },
  { id: "held_the_l", name: "Held the L", description: "Finish a game without winning. With grace.", emoji: "🫠" },
  { id: "full_squad", name: "Full Squad", description: "Finish a game with 4 or more players.", emoji: "🎉" },
  { id: "photo_finish", name: "Photo Finish", description: "Win a nail-bitingly close game.", emoji: "📸" },
  { id: "domination", name: "Absolute Domination", description: "Win by a humiliating margin.", emoji: "💪" },

  // ---- Property Empire ------------------------------------------------------
  { id: "slumlord", name: "Slumlord", description: "Win Property Empire.", emoji: "🏙️", game: "monopoly" },
  { id: "monopoly_money", name: "Monopoly Money", description: "Win Property Empire holding $5,000+ in cash.", emoji: "🤑", game: "monopoly" },
  { id: "bankrupt_fab", name: "Bankrupt & Fabulous", description: "Go completely bankrupt. Style points only.", emoji: "💸", game: "monopoly" },
  { id: "menace", name: "Menace to Society", description: "Win Property Empire with a rival left bankrupt.", emoji: "😈", game: "monopoly" },

  // ---- Hexland --------------------------------------------------------------
  { id: "wood_for_sheep", name: "Wood for Sheep?", description: "Win Hexland. Anyone got wood?", emoji: "🐏", game: "catan" },
  { id: "road_nowhere", name: "Longest Road to Nowhere", description: "Lose Hexland. Beautiful roads though.", emoji: "🛣️", game: "catan" },

  // ---- Naval Clash ----------------------------------------------------------
  { id: "you_sank", name: "You Sank My Battleship!", description: "Lose Naval Clash with your whole fleet at the bottom.", emoji: "🚢", game: "battleship" },
  { id: "bathtub_admiral", name: "Admiral of the Bathtub", description: "Win Naval Clash with a single ship left afloat.", emoji: "🛁", game: "battleship" },
  { id: "untouchable", name: "Untouchable Armada", description: "Win Naval Clash without losing a single ship.", emoji: "🛡️", game: "battleship" },

  // ---- Color Clash ----------------------------------------------------------
  { id: "uno_reverse", name: "Uno Reverse", description: "Win Color Clash.", emoji: "🔄", game: "uno" },
  { id: "cry_more", name: "Draw Four, Cry More", description: "Lose Color Clash stuck with 7+ cards.", emoji: "😭", game: "uno" },

  // ---- Poker ----------------------------------------------------------------
  { id: "poker_face", name: "Poker Face", description: "Win the Poker table.", emoji: "🃏", game: "poker" },
  { id: "all_gone", name: "All In, All Gone", description: "Bust out of Poker with zero chips.", emoji: "🪙", game: "poker" },
  { id: "high_roller", name: "High Roller", description: "Win Poker holding 3,000+ chips.", emoji: "💰", game: "poker" },

  // ---- Mystery Manor --------------------------------------------------------
  { id: "sherlock", name: "Sherlock Homie", description: "Crack the case in Mystery Manor.", emoji: "🔍", game: "cluedo" },
  { id: "accuse_myself", name: "J'Accuse… Myself", description: "Get eliminated by a wildly wrong accusation.", emoji: "⚖️", game: "cluedo" },

  // ---- Quick Draw / Doodle Dash --------------------------------------------
  { id: "picasso", name: "Picasso's Nightmare", description: "Win Quick Draw with questionable art.", emoji: "🎨", game: "pictionary" },
  { id: "stick_figure", name: "Stick-Figure Savant", description: "Win Doodle Dash. A true minimalist.", emoji: "✏️", game: "scribbleio" },

  // ---- Spymaster ------------------------------------------------------------
  { id: "big_brain", name: "Big Brain Energy", description: "Win Spymaster.", emoji: "🧠", game: "codenames" },
  { id: "assassin", name: "Touched the Assassin", description: "Lose Spymaster by hitting the assassin.", emoji: "🔪", game: "codenames" },
]

const BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]))
export function getAchievement(id: string): Achievement | undefined {
  return BY_ID[id]
}
export function isKnownAchievement(id: string): boolean {
  return id in BY_ID
}

// First integer in a standings detail string ("$1,420" → 1420, "8 pts" → 8).
function num(detail?: string): number | null {
  if (!detail) return null
  const digits = detail.replace(/[^0-9]/g, "")
  return digits ? parseInt(digits, 10) : null
}

export function evaluateAchievements(opts: {
  gameId: string
  state: any
  summary: GameSummary
  currentUserId: string
  stats?: { wins: number; gamesPlayed: number }
}): string[] {
  const { gameId, state, summary, currentUserId, stats } = opts
  if (!summary.isOver) return []

  const earned = new Set<string>()
  const players: any[] = Array.isArray(state?.players) ? state.players : []
  const me = players.find((p) => p.id === currentUserId)
  if (!me && gameId !== "codenames") return []   // didn't actually play (spectator)

  const won = summary.youWon
  const standings = summary.standings
  const myRank = standings.findIndex((s) => s.id === currentUserId)
  const lastPlace = myRank >= 0 && standings.length > 1 && myRank === standings.length - 1
  const hadBots = players.some((p) => p.isBot)
  const opponents = players.filter((p) => p.id !== currentUserId)
  const allOppsBots = opponents.length > 0 && opponents.every((p) => p.isBot)

  // ---- Milestones ----
  if (stats) {
    if (won && stats.wins >= 1) earned.add("one_hit_wonder")
    if (stats.wins >= 3) earned.add("hat_trick")
    if (stats.wins >= 10) earned.add("certified_sweat")
    if (stats.wins >= 25) earned.add("hall_of_famer")
    if (stats.gamesPlayed >= 10) earned.add("couch_potato")
    if (stats.gamesPlayed >= 25) earned.add("glutton")
  }

  // ---- Cross-game ----
  if (players.length >= 4) earned.add("full_squad")
  if (won) {
    if (allOppsBots) earned.add("lone_wolf")
    if (hadBots) earned.add("robot_uprising")
    const top = num(standings[0]?.detail)
    const second = num(standings[1]?.detail)
    if (top != null && second != null) {
      const margin = top - second
      if (margin >= 0 && margin <= 3) earned.add("photo_finish")
      if (margin >= 20) earned.add("domination")
    }
  } else {
    earned.add("held_the_l")
    if (lastPlace) earned.add("participation_trophy")
  }

  // ---- Game-specific ----
  switch (gameId) {
    case "monopoly":
      if (won) {
        earned.add("slumlord")
        if (me?.cash >= 5000) earned.add("monopoly_money")
        if (players.some((p) => p.isBankrupt)) earned.add("menace")
      }
      if (me?.isBankrupt) earned.add("bankrupt_fab")
      break
    case "catan":
      if (won) earned.add("wood_for_sheep")
      else earned.add("road_nowhere")
      break
    case "battleship": {
      const shipsLeft = me ? (me.ships || []).filter((s: any) => !s.sunk).length : 0
      const total = me ? (me.ships || []).length : 0
      if (won) {
        if (shipsLeft === 1) earned.add("bathtub_admiral")
        if (total > 0 && shipsLeft === total) earned.add("untouchable")
      } else {
        earned.add("you_sank")
      }
      break
    }
    case "uno":
      if (won) earned.add("uno_reverse")
      else if ((me?.hand?.length ?? 0) >= 7) earned.add("cry_more")
      break
    case "poker":
      if (won) {
        earned.add("poker_face")
        if (me?.chips >= 3000) earned.add("high_roller")
      }
      if (me?.busted) earned.add("all_gone")
      break
    case "cluedo":
      if (won) earned.add("sherlock")
      if (me?.eliminated) earned.add("accuse_myself")
      break
    case "pictionary":
      if (won) earned.add("picasso")
      break
    case "scribbleio":
      if (won) earned.add("stick_figure")
      break
    case "codenames":
      if (won) earned.add("big_brain")
      else earned.add("assassin")
      break
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
