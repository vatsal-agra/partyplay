import type { Game, Filters } from "@/app/types"

export const FAVORITES_STORAGE_KEY = "dice-alley:favorite-games:v1"

export function readFavorites(): Set<string> {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]")
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [])
  } catch {
    return new Set()
  }
}

export function saveFavorites(favorites: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favorites)))
  } catch {
    // Favorites still work for this visit when browser storage is unavailable.
  }
}

export function toggleFavorite(favorites: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(favorites)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function filterGames(games: Game[], query: string, filters: Filters, favorites: ReadonlySet<string>, favoritesOnly: boolean): Game[] {
  return games.filter((game) => {
    if (favoritesOnly && !favorites.has(game.id)) return false
    const search = query.toLowerCase()
    if (!game.name.toLowerCase().includes(search) && !game.description.toLowerCase().includes(search)) return false
    if (filters.players) {
      const players = parseInt(filters.players)
      if (filters.players.endsWith("+")) {
        if (game.maxPlayers < players) return false
      } else if (game.minPlayers > players || game.maxPlayers < players) return false
    }
    if (filters.complexity && game.complexity !== filters.complexity) return false
    // Classify by the shortest advertised play time.
    const minutes = parseInt(game.duration)
    if (filters.duration === "<30" && minutes >= 30) return false
    if (filters.duration === "30-60" && (minutes < 30 || minutes >= 60)) return false
    if (filters.duration === "60+" && minutes < 60) return false
    return true
  })
}
