// Answers one question across every engine: is it this player's turn right now?
//
// Each engine tracks the active seat its own way (a rotating index, a drawing
// artist, a team plus a role), so the quirks live here the same way the
// end-of-game quirks live in gameSummary. The logic is duplicated rather than
// imported from the engines on purpose: this runs on the always-loaded game
// page, and importing an engine here would drag its whole bundle along.

const BETTING_STAGES = ["PREFLOP", "FLOP", "TURN", "RIVER"]

export function isYourTurn(gameId: string, state: any, userId?: string | null): boolean {
  if (!gameId || !userId || !state || !Array.isArray(state.players)) return false
  const players: any[] = state.players
  const seat = (i: number) => players[i]?.id === userId
  const over = state.phase === "GAME_OVER"

  switch (gameId) {
    // Straight index-based turn order.
    case "monopoly":
    case "catan":
    case "uno":
      return !over && seat(state.currentPlayerIndex)

    // Same, except a suggestion pauses the turn on the player being asked to
    // disprove it.
    case "cluedo":
      if (over) return false
      if (state.phase === "DISPROVE") return seat(state.pending?.askIndex)
      return seat(state.currentPlayerIndex)

    // Ship placement is simultaneous, so nobody is "on turn" until the battle.
    case "battleship":
      return state.phase === "BATTLE" && seat(state.currentPlayerIndex)

    // Only the betting streets ask a player to act; showdown and hand-over run
    // themselves.
    case "poker":
      return BETTING_STAGES.includes(state.stage) && seat(state.currentPlayerIndex)

    // The drawer is the one on the clock, both while picking a word and while
    // drawing it. Everyone else is guessing, which is not a turn.
    case "scribbleio":
      return (state.phase === "CHOOSE" || state.phase === "DRAWING") && seat(state.drawerIndex)

    // The active team's artist draws; an All Play square puts both teams'
    // artists on at once.
    case "pictionary": {
      const artist = (team: string) => {
        const members = players.filter((p) => p.team === team)
        if (members.length === 0) return null
        return members[(state.artistIndex?.[team] ?? 0) % members.length].id
      }
      if (state.phase === "ALLPLAY") return artist("red") === userId || artist("blue") === userId
      if (state.phase === "DRAWING") return artist(state.activeTeam) === userId
      return false
    }

    // A team turn, where the phase decides which half of the team acts: the
    // spymaster gives the clue, the operatives spend it.
    case "codenames": {
      const me = players.find((p) => p.id === userId)
      if (!me || me.team !== state.currentTeam) return false
      if (state.phase === "CLUE") return me.role === "spymaster"
      if (state.phase === "GUESS") return me.role === "operative"
      return false
    }

    // Turn order is an explicit list (Mr. X first, then the detectives).
    case "manhunt":
      return !over && state.order?.[state.currentIndex] === userId
  }

  return false
}
