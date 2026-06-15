// Playful microcopy — loading lines, empty states, and toast wording. Keeping
// it in one place makes the whole app sound like it has a personality instead
// of a status bar.

export const LOADING_LINES = [
  "Shuffling the deck…",
  "Rolling the dice…",
  "Rallying the troops…",
  "Bribing the bots to play fair…",
  "Polishing the trophies…",
  "Untangling the friendship bracelets…",
  "Counting everyone's chips…",
  "Warming up the dice…",
  "Setting the table…",
  "Convincing the cat to move off the board…",
  "Drawing straws for who goes first…",
  "Hyping up the crowd…",
]

export const DASHBOARD_EMPTY = {
  title: "No parties yet",
  body: "Start one and we'll rally the troops. Game night doesn't host itself.",
  cta: "Create a party",
}

export const OPEN_PARTIES_EMPTY = {
  title: "Nobody's looking for players right now",
  body: "Be the trendsetter — open a party and friends can drop in.",
}

export const LEADERBOARD_EMPTY = {
  title: "The leaderboard is hungry",
  body: "Play a game to put the first name up in lights.",
}

// Deterministic-free random pick (client only). Vary by passing a seed index.
export function pick<T>(arr: T[], seed?: number): T {
  if (seed != null) return arr[seed % arr.length]
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomLoading(): string {
  return pick(LOADING_LINES)
}

// Win/lose toast flavour.
export const WIN_LINES = [
  "GG! 🏆", "Victory royale!", "You cooked. 🔥", "Certified W.", "Flawless.",
]
export const LOSE_LINES = [
  "So close!", "Rematch?", "They got lucky.", "Shake it off.", "Next one's yours.",
]
