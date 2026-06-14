// Mystery Manor — board geometry and card/cast definitions.
//
// The mansion is a real unit-square grid. Corridors are walkable cells; the
// dice roll is the exact number of squares a player may move (BFS over the
// corridor network), so a short roll can leave you unable to reach any room —
// just like the physical board game. Rooms are entered through doorway cells
// and the two corner pairs are linked by secret passages.

export const BOARD_W = 24
export const BOARD_H = 25

export type RoomId =
  | 'kitchen' | 'ballroom' | 'conservatory'
  | 'dining' | 'billiard' | 'library'
  | 'lounge' | 'hall' | 'study'

export interface Cell { x: number; y: number }

export interface RoomDef {
  id: RoomId
  name: string
  rect: { x1: number; y1: number; x2: number; y2: number }
  doors: Cell[]        // corridor cells from which the room is entered
  secret?: RoomId      // secret passage to the opposite corner room
}

// Center "cellar" — the solution pile. Never enterable, never walkable.
export const CELLAR_RECT = { x1: 9, y1: 9, x2: 14, y2: 15 }

export const ROOMS: RoomDef[] = [
  {
    id: 'kitchen', name: 'Kitchen',
    rect: { x1: 0, y1: 0, x2: 5, y2: 5 },
    doors: [{ x: 4, y: 6 }],
    secret: 'study',
  },
  {
    id: 'ballroom', name: 'Ballroom',
    rect: { x1: 9, y1: 0, x2: 14, y2: 6 },
    doors: [{ x: 8, y: 5 }, { x: 11, y: 7 }, { x: 15, y: 5 }],
  },
  {
    id: 'conservatory', name: 'Conservatory',
    rect: { x1: 18, y1: 0, x2: 23, y2: 4 },
    doors: [{ x: 19, y: 5 }],
    secret: 'lounge',
  },
  {
    id: 'dining', name: 'Dining Room',
    rect: { x1: 0, y1: 9, x2: 6, y2: 14 },
    doors: [{ x: 7, y: 11 }, { x: 4, y: 8 }],
  },
  {
    id: 'billiard', name: 'Billiard Room',
    rect: { x1: 18, y1: 7, x2: 23, y2: 11 },
    doors: [{ x: 17, y: 9 }, { x: 20, y: 12 }],
  },
  {
    id: 'library', name: 'Library',
    rect: { x1: 18, y1: 13, x2: 23, y2: 17 },
    doors: [{ x: 17, y: 15 }, { x: 20, y: 18 }],
  },
  {
    id: 'lounge', name: 'Lounge',
    rect: { x1: 0, y1: 18, x2: 5, y2: 24 },
    doors: [{ x: 6, y: 19 }],
    secret: 'conservatory',
  },
  {
    id: 'hall', name: 'Hall',
    rect: { x1: 9, y1: 18, x2: 14, y2: 24 },
    doors: [{ x: 11, y: 17 }, { x: 8, y: 21 }, { x: 15, y: 21 }],
  },
  {
    id: 'study', name: 'Study',
    rect: { x1: 18, y1: 20, x2: 23, y2: 24 },
    doors: [{ x: 20, y: 19 }],
    secret: 'kitchen',
  },
]

export interface SuspectDef {
  id: string
  name: string
  color: string
  start: Cell
}

// Original cast — color-coded archetypes, no trademarked names.
export const SUSPECTS: SuspectDef[] = [
  { id: 'vermillion', name: 'Ms. Vermillion',     color: '#dc2626', start: { x: 7,  y: 24 } },
  { id: 'amber',      name: 'General Amber',       color: '#f59e0b', start: { x: 0,  y: 7  } },
  { id: 'indigo',     name: 'Professor Indigo',    color: '#7c3aed', start: { x: 23, y: 6  } },
  { id: 'pine',       name: 'Sergeant Pine',       color: '#16a34a', start: { x: 16, y: 24 } },
  { id: 'azure',      name: 'Lady Azure',          color: '#2563eb', start: { x: 23, y: 18 } },
  { id: 'pearl',      name: 'Madame Pearl',        color: '#e5e7eb', start: { x: 8,  y: 0  } },
]

export interface WeaponDef { id: string; name: string; icon: string }

// Generic objects — not protected.
export const WEAPONS: WeaponDef[] = [
  { id: 'candlestick', name: 'Candlestick', icon: '🕯️' },
  { id: 'dagger',      name: 'Dagger',      icon: '🗡️' },
  { id: 'pipe',        name: 'Lead Pipe',   icon: '🩹' },
  { id: 'revolver',    name: 'Revolver',    icon: '🔫' },
  { id: 'rope',        name: 'Rope',        icon: '🪢' },
  { id: 'wrench',      name: 'Wrench',      icon: '🔧' },
]

export const ROOM_CARDS = ROOMS.map((r) => ({ id: r.id, name: r.name }))

// ---- Cell classification helpers -------------------------------------------

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_W && y >= 0 && y < BOARD_H
}

function inRect(x: number, y: number, r: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2
}

export function isCellar(x: number, y: number): boolean {
  return inRect(x, y, CELLAR_RECT)
}

// Which room's footprint a cell sits in (null if none).
export function roomRectAt(x: number, y: number): RoomId | null {
  for (const room of ROOMS) {
    if (inRect(x, y, room.rect)) return room.id
  }
  return null
}

// A corridor cell is in-bounds, not inside a room footprint, and not the cellar.
export function isCorridor(x: number, y: number): boolean {
  if (!inBounds(x, y)) return false
  if (isCellar(x, y)) return false
  if (roomRectAt(x, y)) return false
  return true
}

// If this corridor cell is a doorway, returns the room it leads into.
export function doorAt(x: number, y: number): RoomId | null {
  for (const room of ROOMS) {
    if (room.doors.some((d) => d.x === x && d.y === y)) return room.id
  }
  return null
}

export function getRoom(id: RoomId): RoomDef {
  return ROOMS.find((r) => r.id === id)!
}

export const cellKey = (x: number, y: number) => `${x},${y}`
