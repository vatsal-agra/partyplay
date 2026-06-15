// Manhunt city map — an original transit network (no real-world map copied).
//
// A 5×5 lattice of stations wired with three transport types:
//   • taxi        — short hops to adjacent stations (dense)
//   • bus         — medium hops skipping a station (the avenues)
//   • underground — long hops between the five hub stations (sparse)
//
// Coordinates live in a 0–100 viewBox so the board scales cleanly, and a real
// map image can later be slotted behind these nodes.

export type Transport = "taxi" | "bus" | "underground"

export interface MapNode {
  id: number
  x: number
  y: number
  hub: boolean
}

export interface Link {
  to: number
  type: Transport
}

const W = 5
const H = 5
const rc = (r: number, c: number) => r * W + c + 1
const inBounds = (r: number, c: number) => r >= 0 && r < H && c >= 0 && c < W

export const HUBS = [1, 5, 13, 21, 25]

export const NODES: MapNode[] = []
for (let r = 0; r < H; r++) {
  for (let c = 0; c < W; c++) {
    const id = rc(r, c)
    // Small deterministic jitter so it reads as a city, not graph paper.
    const jx = (((id * 7) % 5) - 2) * 1.3
    const jy = (((id * 13) % 5) - 2) * 1.3
    NODES.push({ id, x: 12 + c * 19 + jx, y: 12 + r * 19 + jy, hub: HUBS.includes(id) })
  }
}

const adj: Record<number, Link[]> = {}
function link(a: number, b: number, type: Transport) {
  ;(adj[a] ||= []).some((l) => l.to === b && l.type === type) || adj[a].push({ to: b, type })
  ;(adj[b] ||= []).some((l) => l.to === a && l.type === type) || adj[b].push({ to: a, type })
}

for (let r = 0; r < H; r++) {
  for (let c = 0; c < W; c++) {
    const id = rc(r, c)
    if (inBounds(r, c + 1)) link(id, rc(r, c + 1), "taxi")
    if (inBounds(r + 1, c)) link(id, rc(r + 1, c), "taxi")
    if ((r + c) % 2 === 0 && inBounds(r + 1, c + 1)) link(id, rc(r + 1, c + 1), "taxi")
    if (inBounds(r, c + 2)) link(id, rc(r, c + 2), "bus")
    if (inBounds(r + 2, c)) link(id, rc(r + 2, c), "bus")
  }
}
// Underground ring + spokes through the centre hub.
link(1, 5, "underground"); link(5, 25, "underground"); link(25, 21, "underground"); link(21, 1, "underground")
link(13, 1, "underground"); link(13, 5, "underground"); link(13, 21, "underground"); link(13, 25, "underground")

export const LINKS = adj
export function movesFrom(id: number): Link[] {
  return adj[id] || []
}
export function nodeById(id: number): MapNode | undefined {
  return NODES.find((n) => n.id === id)
}

// BFS distance ignoring transport type — used by the bots.
export function distance(from: number, to: number): number {
  if (from === to) return 0
  const seen = new Set<number>([from])
  let frontier = [from]
  let d = 0
  while (frontier.length) {
    d++
    const next: number[] = []
    for (const n of frontier) {
      for (const l of adj[n] || []) {
        if (l.to === to) return d
        if (!seen.has(l.to)) { seen.add(l.to); next.push(l.to) }
      }
    }
    frontier = next
  }
  return Infinity
}
