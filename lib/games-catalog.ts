import { Game } from "@/app/types"

// Single source of truth for the playable game catalog.
//
// IMPORTANT: each `id` here MUST match the route slug handled in
// app/games/[slug]/page.tsx (the `mockGames` keys), because launching a game
// navigates to `/games/${id}`. Keep them in sync.
export const GAMES_CATALOG: Game[] = [
  {
    id: 'monopoly',
    name: 'Property Empire',
    description: 'Buy, sell, and trade properties to become the wealthiest player in this classic board game of economic strategy.',
    image: '/images/games/property-empire.png',
    minPlayers: 2,
    maxPlayers: 6,
    duration: '60-180 min',
    complexity: 'Medium',
    category: ['Strategy', 'Economic'],
  },
  {
    id: 'battleship',
    name: 'Naval Clash',
    description: 'Strategically place your fleet and take turns firing at your opponent\'s ships in this classic naval combat game.',
    image: '/images/games/naval-clash.jpg',
    minPlayers: 2,
    maxPlayers: 2,
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Strategy', 'Deduction'],
  },
  {
    id: 'catan',
    name: 'Hexland',
    description: 'Collect resources and build settlements in this classic strategy game of trading and development.',
    image: '/images/games/hexland.jpg',
    minPlayers: 3,
    maxPlayers: 4,
    duration: '60-120 min',
    complexity: 'Medium',
    category: ['Strategy', 'Trading'],
  },
  {
    id: 'uno',
    name: 'Color Clash',
    description: 'Be the first to play all your cards by matching color or number in this fast-paced card game.',
    image: '/images/games/color-clash.png',
    minPlayers: 2,
    maxPlayers: 10,
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Card Game', 'Family'],
  },
  {
    id: 'poker',
    name: 'Poker',
    description: 'Test your luck and bluffing skills in this classic card game of strategy and chance.',
    image: '/images/poker thumbnail.png',
    minPlayers: 2,
    maxPlayers: 8, // engine seats at most 8
    duration: '30-120 min',
    complexity: 'Medium',
    category: ['Card Game', 'Bluffing'],
  },
  {
    id: 'cluedo',
    name: 'Mystery Manor',
    description: 'Solve the mystery of who committed the murder, with what weapon, and in which room.',
    image: '/images/games/mystery-manor.png',
    minPlayers: 3,
    maxPlayers: 6,
    duration: '45-60 min',
    complexity: 'Easy',
    category: ['Deduction', 'Mystery'],
  },
  {
    id: 'pictionary',
    name: 'Quick Draw',
    description: 'Draw clues for your team to guess in this classic drawing and guessing game.',
    image: '/images/games/quick-draw.png',
    minPlayers: 4,
    maxPlayers: 8,
    duration: '30-60 min',
    complexity: 'Easy',
    category: ['Party', 'Drawing'],
  },
  {
    id: 'scribbleio',
    name: 'Doodle Dash',
    description: 'Draw and guess drawings in this fun online multiplayer game where creativity meets competition.',
    image: '/images/games/doodle-dash.png',
    minPlayers: 2,
    maxPlayers: 12,
    duration: '10-30 min',
    complexity: 'Easy',
    category: ['Online', 'Drawing'],
  },
  // NOTE: 'manhunt' (Scotland Yard) is intentionally hidden from the store for
  // now — it still needs work. The engine/board/map live in app/games/manhunt/
  // and the route wiring remains, so it's playable at /games/manhunt for WIP.
  // To relist it, restore this catalog entry (and its two badges in achievements.ts).
  {
    id: 'codenames',
    name: 'Spymaster',
    description: 'Give one-word clues to help your team identify agents while avoiding the assassin.',
    image: '/images/games/spymaster.png',
    minPlayers: 4,
    maxPlayers: 8,
    duration: '15-30 min',
    complexity: 'Easy',
    category: ['Party', 'Word Game'],
  },
]

export function getGameById(id: string | null | undefined): Game | undefined {
  if (!id) return undefined
  return GAMES_CATALOG.find((g) => g.id === id)
}

// Public URL slugs — the route shows the rebranded name, not the original game.
// The internal id (and the engine/board behind it) stays the same; next.config
// rewrites map these pretty slugs back to the internal route, so links and the
// address bar never expose a trademarked name. Games not listed keep their id.
export const PUBLIC_SLUG: Record<string, string> = {
  monopoly: 'property-empire',
  battleship: 'naval-clash',
  catan: 'hexland',
  uno: 'color-clash',
  cluedo: 'mystery-manor',
  pictionary: 'quick-draw',
  scribbleio: 'doodle-dash',
  codenames: 'spymaster',
}

// Build a public game URL from an internal id (+ optional query like "?partyId=x").
export function gamePath(id: string, query = ''): string {
  return `/games/${PUBLIC_SLUG[id] || id}${query}`
}
