import type { SupabaseClient } from "@supabase/supabase-js"

// Records the outcome of a finished game for the signed-in user via the
// record_game_result RPC (atomic upsert + increment). Each human client calls
// this once when a game ends, so bots and guests are naturally excluded.
//
// Fails silently: a leaderboard write must never break gameplay, and if the
// game_stats migration hasn't been applied yet the RPC simply won't exist.
export async function recordGameResult(
  client: SupabaseClient,
  opts: { won: boolean; gameName: string }
): Promise<void> {
  try {
    const { error } = await client.rpc("record_game_result", {
      p_won: opts.won,
      p_game: opts.gameName,
    })
    if (error) console.warn("recordGameResult failed:", error.message)
  } catch (err) {
    console.warn("recordGameResult threw:", err)
  }
}

export interface UserStats {
  wins: number
  gamesPlayed: number
  xp: number
  streak: number
  // Despite the legacy column name, this holds the most recently completed
  // game (by name) rather than a tally-based favorite. Undefined when the
  // column, row or table isn't there.
  favoriteGame?: string
}

const EMPTY_STATS: UserStats = { wins: 0, gamesPlayed: 0, xp: 0, streak: 0 }

// The signed-in user's running totals (used for milestone badges, XP/level, and
// the daily streak). Returns zeros if the row/table doesn't exist yet.
export async function fetchUserStats(
  client: SupabaseClient,
  userId: string
): Promise<UserStats> {
  try {
    const read = (columns: string) =>
      client.from("game_stats").select(columns).eq("user_id", userId).single()

    // Older databases predate favorite_game; asking for a missing column fails
    // the whole select (PostgREST 42703), so fall back to the columns that have
    // always existed rather than losing wins/XP/streak too.
    let { data, error } = await read("wins, games_played, xp, streak, favorite_game")
    if (error?.code === "42703") ({ data } = await read("wins, games_played, xp, streak"))

    const row = data as any
    return {
      wins: row?.wins ?? 0,
      gamesPlayed: row?.games_played ?? 0,
      xp: row?.xp ?? 0,
      streak: row?.streak ?? 0,
      favoriteGame: row?.favorite_game || undefined,
    }
  } catch {
    return { ...EMPTY_STATS }
  }
}

export interface LeaderboardRow {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  avatar_emoji?: string | null
  avatar_color?: string | null
  wins: number
  games_played: number
  xp: number
  favorite_game?: string
}

// Fetches the top players by wins (then games played) with their profile info.
// Returns [] on any error (e.g. table not yet created) so the UI can show an
// honest empty state rather than crashing.
export async function fetchLeaderboard(
  client: SupabaseClient,
  limit = 10
): Promise<LeaderboardRow[]> {
  try {
    const { data, error } = await client
      .from("game_stats")
      .select("user_id, wins, games_played, xp, favorite_game, profiles ( username, display_name, avatar_url, avatar_emoji, avatar_color )")
      .order("wins", { ascending: false })
      .order("xp", { ascending: false })
      .limit(limit)

    if (error || !data) {
      if (error) console.warn("fetchLeaderboard failed:", error.message)
      return []
    }

    return data.map((row: any) => {
      // PostgREST returns a to-one embed as an object (older versions: array).
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        id: row.user_id,
        username: profile?.username || `User ${String(row.user_id).slice(0, 6)}`,
        display_name: profile?.display_name,
        avatar_url: profile?.avatar_url,
        avatar_emoji: profile?.avatar_emoji,
        avatar_color: profile?.avatar_color,
        wins: row.wins ?? 0,
        games_played: row.games_played ?? 0,
        xp: row.xp ?? 0,
        favorite_game: row.favorite_game || undefined,
      }
    })
  } catch (err) {
    console.warn("fetchLeaderboard threw:", err)
    return []
  }
}
