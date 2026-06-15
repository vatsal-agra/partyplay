// Normalizes the wildly different per-engine state shapes into one summary the
// shared UI (game-over screen), the leaderboard recorder, and the achievement
// evaluator can all read. Each game stores its winner/score differently — this
// is the single place that knows those quirks, so callers never special-case.

export interface Standing {
  id?: string
  name: string
  detail?: string      // e.g. "$1,420", "8 pts", "3 cards left"
  isWinner: boolean
}

export interface GameSummary {
  isOver: boolean
  winnerIds: string[]      // player ids that won (empty for a team win or draw)
  winnerLabel: string      // display label: "Alice", "Alice & Bob", "Red Team", "Draw"
  youWon: boolean
  standings: Standing[]
  scoreLabel?: string      // header for the detail column, e.g. "Net worth"
}

const EMPTY: GameSummary = { isOver: false, winnerIds: [], winnerLabel: "", youWon: false, standings: [] }

const money = (n: number) => "$" + Math.round(n || 0).toLocaleString()

// Build standings from a player list + a numeric score accessor (higher = better
// unless ascending). winnerIds drive the isWinner flag and label.
function build(
  players: any[],
  opts: {
    winnerIds: string[]
    score?: (p: any) => number
    ascending?: boolean
    detail?: (p: any) => string | undefined
    demote?: (p: any) => boolean   // force to the bottom (bankrupt / busted / eliminated)
  }
): Standing[] {
  const rows = [...(players || [])]
  if (opts.score) {
    rows.sort((a, b) => {
      const da = opts.demote?.(a) ? 1 : 0
      const db = opts.demote?.(b) ? 1 : 0
      if (da !== db) return da - db
      const sa = opts.score!(a)
      const sb = opts.score!(b)
      return opts.ascending ? sa - sb : sb - sa
    })
  }
  return rows.map((p) => ({
    id: p.id,
    name: p.name || "Player",
    detail: opts.detail?.(p),
    isWinner: opts.winnerIds.includes(p.id),
  }))
}

function label(names: string[]): string {
  if (names.length === 0) return "Draw"
  if (names.length === 1) return names[0]
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1]
}

export function getGameSummary(gameId: string, state: any, currentUserId?: string): GameSummary {
  if (!state || !Array.isArray(state.players)) return EMPTY
  const players: any[] = state.players
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name || "Player"

  switch (gameId) {
    case "monopoly": {
      const isOver = state.phase === "GAME_OVER"
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Cash",
        standings: build(players, {
          winnerIds,
          score: (p) => p.cash,
          detail: (p) => (p.isBankrupt ? "Bankrupt" : money(p.cash)),
          demote: (p) => p.isBankrupt,
        }),
      }
    }
    case "catan": {
      const isOver = state.phase === "GAME_OVER"
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Points",
        standings: build(players, {
          winnerIds,
          score: (p) => p.victoryPoints,
          detail: (p) => `${p.victoryPoints} pts`,
        }),
      }
    }
    case "pictionary":
    case "scribbleio": {
      const isOver = state.phase === "GAME_OVER"
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Score",
        standings: build(players, {
          winnerIds,
          score: (p) => p.score,
          detail: (p) => `${p.score ?? 0} pts`,
        }),
      }
    }
    case "uno": {
      const isOver = state.phase === "GAME_OVER" || !!state.winnerId
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Cards left",
        standings: build(players, {
          winnerIds,
          score: (p) => (p.hand?.length ?? 0),
          ascending: true,
          detail: (p) => `${p.hand?.length ?? 0} cards`,
        }),
      }
    }
    case "cluedo": {
      const isOver = state.phase === "GAME_OVER" || !!state.winnerId
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        standings: build(players, {
          winnerIds,
          detail: (p) =>
            winnerIds.includes(p.id) ? "Solved it!" : p.eliminated ? "Eliminated" : "In play",
        }),
      }
    }
    case "battleship": {
      const isOver = state.phase === "GAME_OVER" || !!state.winnerId
      const winnerIds = state.winnerId ? [state.winnerId] : []
      const shipsLeft = (p: any) => (p.ships || []).filter((s: any) => !s.sunk).length
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Fleet",
        standings: build(players, {
          winnerIds,
          score: shipsLeft,
          detail: (p) => `${shipsLeft(p)} ships left`,
        }),
      }
    }
    case "poker": {
      const alive = players.filter((p) => !p.busted)
      const isOver = players.length > 1 && alive.length <= 1
      const winnerIds = isOver && alive[0] ? [alive[0].id] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        scoreLabel: "Chips",
        standings: build(players, {
          winnerIds,
          score: (p) => p.chips,
          detail: (p) => (p.busted ? "Busted" : `${p.chips} chips`),
          demote: (p) => p.busted,
        }),
      }
    }
    case "codenames": {
      const isOver = state.phase === "GAME_OVER" || !!state.winner
      const winningTeam: string | null = state.winner ?? null
      const winnerIds = winningTeam ? players.filter((p) => p.team === winningTeam).map((p) => p.id) : []
      const teamLabel = winningTeam ? winningTeam[0].toUpperCase() + winningTeam.slice(1) + " Team" : "Draw"
      const youWon = !!currentUserId && winnerIds.includes(currentUserId)
      return {
        isOver,
        winnerIds,
        winnerLabel: teamLabel,
        youWon,
        scoreLabel: "Team",
        standings: build(players, {
          winnerIds,
          detail: (p) => (p.team ? p.team[0].toUpperCase() + p.team.slice(1) : undefined),
        }),
      }
    }
    default: {
      // Best-effort generic fallback for any future game.
      const isOver =
        ["GAME_OVER", "GAMEOVER", "ENDED", "FINISHED", "COMPLETE"].includes(
          typeof state.phase === "string" ? state.phase.toUpperCase() : ""
        ) || !!state.winnerId
      const winnerIds = state.winnerId ? [state.winnerId] : []
      return {
        isOver,
        winnerIds,
        winnerLabel: label(winnerIds.map(nameOf)),
        youWon: !!currentUserId && winnerIds.includes(currentUserId),
        standings: build(players, { winnerIds }),
      }
    }
  }
}
