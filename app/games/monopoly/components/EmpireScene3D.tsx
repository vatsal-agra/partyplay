// Property Empire — real-time 3D board (Three.js / React Three Fiber).
//
// A real tabletop: cream board slab on dark wood, 40 printed tiles (canvas
// textures with color bands, names and prices, oriented inward like a real
// board), 3D houses and hotels on the bands, owner pegs, mortgage veils,
// distinct glossy player tokens that hop tile-by-tile around the track,
// tumbling dice that settle on the true roll, Fortune/Treasury deck stacks
// and floating cash deltas. Presentation only — every action flows through
// the DOM HUD in MonopolyBoard; the scene reports tile clicks and dice
// settles back to the container.
"use client"

import * as THREE from "three"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import {
  MonopolyState, Player, BOARD_SPACES, Space,
} from "../lib/monopolyEngine"
import { Mannequins } from "@/components/three/Mannequins"

const SERIF = "var(--font-display), Georgia, serif"

export const GROUP_HEX: Record<string, string> = {
  BROWN: '#8a5a2b', LIGHT_BLUE: '#57b8e8', PINK: '#e05a9e', ORANGE: '#ef8b33',
  RED: '#d9453a', YELLOW: '#e8c53a', GREEN: '#3fa356', DARK_BLUE: '#3558c9',
  RAILROAD: '#4a4a52', UTILITY: '#7a86c9', SPECIAL: '#c9c2ac',
}

// ---- board geometry -----------------------------------------------------------
// Side length 12: two 1.5 corners + nine 1.0 tiles. Board plane y = 0.13.
const CORNER = 1.5
const EDGE = 1.0
const HALF = 6
const BOARD_Y = 0.132

function isCorner(i: number) { return i % 10 === 0 }

// Center position of a tile + which way its "inward" edge faces (rotY of the tile group).
export function tileTransform(i: number): { x: number; z: number; rotY: number; w: number; d: number } {
  const size = isCorner(i) ? CORNER : EDGE
  if (i === 0) return { x: HALF - CORNER / 2, z: HALF - CORNER / 2, rotY: 0, w: CORNER, d: CORNER }
  if (i < 10) return { x: 5 - i, z: HALF - CORNER / 2, rotY: 0, w: EDGE, d: CORNER }
  if (i === 10) return { x: -(HALF - CORNER / 2), z: HALF - CORNER / 2, rotY: 0, w: CORNER, d: CORNER }
  if (i < 20) return { x: -(HALF - CORNER / 2), z: 5 - (i - 10), rotY: -Math.PI / 2, w: EDGE, d: CORNER }
  if (i === 20) return { x: -(HALF - CORNER / 2), z: -(HALF - CORNER / 2), rotY: Math.PI, w: CORNER, d: CORNER }
  if (i < 30) return { x: (i - 20) - 5, z: -(HALF - CORNER / 2), rotY: Math.PI, w: EDGE, d: CORNER }
  if (i === 30) return { x: HALF - CORNER / 2, z: -(HALF - CORNER / 2), rotY: Math.PI / 2, w: CORNER, d: CORNER }
  return { x: HALF - CORNER / 2, z: (i - 30) - 5, rotY: Math.PI / 2, w: EDGE, d: CORNER }
}

// ---- tile textures (module cache, 40 entries) -----------------------------------
const texCache = new Map<string, THREE.CanvasTexture>()

function wrapName(ctx: CanvasRenderingContext2D, name: string, maxW: number): string[] {
  const words = name.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w
    if (ctx.measureText(trial).width > maxW && cur) { lines.push(cur); cur = w } else cur = trial
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 2)
}

function tileTexture(space: Space): THREE.CanvasTexture {
  const key = `tile${space.index}`
  const hit = texCache.get(key)
  if (hit) return hit
  const corner = isCorner(space.index)
  const c = document.createElement("canvas")
  c.width = corner ? 256 : 172
  c.height = 256
  const ctx = c.getContext("2d")!
  // parchment base
  ctx.fillStyle = "#efe8d2"
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = "#1f1b12"
  ctx.lineWidth = 4
  ctx.strokeRect(0, 0, c.width, c.height)
  ctx.textAlign = "center"

  if (corner) {
    ctx.fillStyle = "#1f1b12"
    if (space.index === 0) {
      ctx.font = "900 22px Georgia, serif"
      ctx.fillText("COLLECT $200", 128, 60)
      ctx.fillStyle = "#c22b2b"
      ctx.font = "900 84px Georgia, serif"
      ctx.fillText("GO", 128, 160)
      ctx.font = "900 44px Georgia, serif"
      ctx.fillText("⬅", 128, 218)
    } else if (space.index === 10) {
      ctx.fillStyle = "#e8a33a"
      ctx.fillRect(4, 4, c.width - 8, c.height - 8)
      ctx.fillStyle = "#efe8d2"
      ctx.fillRect(40, 40, 176, 130)
      ctx.strokeStyle = "#1f1b12"; ctx.lineWidth = 6
      ctx.strokeRect(40, 40, 176, 130)
      for (let x = 66; x < 216; x += 30) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, 170); ctx.stroke() }
      ctx.fillStyle = "#1f1b12"
      ctx.font = "900 30px Georgia, serif"
      ctx.fillText("JAIL", 128, 218)
    } else if (space.index === 20) {
      ctx.fillStyle = "#c22b2b"
      ctx.font = "900 26px Georgia, serif"
      ctx.fillText("FREE", 128, 90)
      ctx.fillText("PARKING", 128, 124)
      ctx.font = "56px serif"
      ctx.fillText("🚗", 128, 195)
    } else {
      ctx.fillStyle = "#1f4bc9"
      ctx.font = "900 26px Georgia, serif"
      ctx.fillText("GO TO", 128, 90)
      ctx.fillText("JAIL", 128, 124)
      ctx.font = "56px serif"
      ctx.fillText("👮", 128, 195)
    }
  } else {
    // group band along the top (inward edge)
    ctx.fillStyle = GROUP_HEX[space.group] || "#c9c2ac"
    ctx.fillRect(4, 4, c.width - 8, 46)
    ctx.strokeStyle = "#1f1b12"; ctx.lineWidth = 3
    ctx.strokeRect(4, 4, c.width - 8, 46)
    // icon for specials
    ctx.fillStyle = "#1f1b12"
    let icon = ""
    if (space.type === "CHANCE") icon = "❓"
    else if (space.type === "COMMUNITY_CHEST") icon = "📦"
    else if (space.type === "TAX") icon = "💸"
    else if (space.type === "RAILROAD") icon = "🚂"
    else if (space.type === "UTILITY") icon = space.name.includes("Power") ? "⚡" : "💧"
    // name
    ctx.font = "900 26px Georgia, serif"
    const lines = wrapName(ctx, space.name.toUpperCase(), c.width - 20)
    lines.forEach((ln, k) => ctx.fillText(ln, c.width / 2, 86 + k * 30))
    if (icon) {
      ctx.font = "58px serif"
      ctx.fillText(icon, c.width / 2, 182)
    }
    if (space.cost) {
      ctx.font = "900 28px Georgia, serif"
      ctx.fillText(`$${space.cost}`, c.width / 2, 234)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}

function centerTexture(): THREE.CanvasTexture {
  const hit = texCache.get("center")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#dbe6d3"
  ctx.fillRect(0, 0, 512, 512)
  // subtle radial
  const g = ctx.createRadialGradient(256, 256, 60, 256, 256, 360)
  g.addColorStop(0, "rgba(255,255,255,0.25)")
  g.addColorStop(1, "rgba(90,110,80,0.25)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)
  // branding banner — auto-fit the title so it never spills past the red plate,
  // sit it a little higher and drop the tagline so they never overlap.
  ctx.save()
  ctx.translate(256, 212)
  ctx.rotate(-0.11)
  const BOX_W = 456, BOX_H = 82
  ctx.fillStyle = "#d9362c"
  ctx.fillRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H)
  ctx.strokeStyle = "#f5f2e6"
  ctx.lineWidth = 6
  ctx.strokeRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H)
  ctx.fillStyle = "#f5f2e6"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  let titleFs = 46
  ctx.font = `900 ${titleFs}px Georgia, serif`
  while (ctx.measureText("PROPERTY EMPIRE").width > BOX_W - 44 && titleFs > 26) {
    titleFs -= 2
    ctx.font = `900 ${titleFs}px Georgia, serif`
  }
  ctx.fillText("PROPERTY EMPIRE", 0, 2)
  ctx.restore()
  ctx.fillStyle = "rgba(31,27,18,0.55)"
  ctx.font = "900 17px Georgia, serif"
  ctx.textAlign = "center"
  ctx.fillText("DICE ALLEY CLASSIC EDITION", 256, 312)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  texCache.set("center", t)
  return t
}

function deckTexture(label: string, bg: string): THREE.CanvasTexture {
  const key = `deck${label}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 160; c.height = 240
  const ctx = c.getContext("2d")!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 160, 240)
  ctx.strokeStyle = "#1f1b12"; ctx.lineWidth = 6
  ctx.strokeRect(4, 4, 152, 232)
  ctx.fillStyle = "#1f1b12"
  ctx.textAlign = "center"
  ctx.font = "900 64px Georgia, serif"
  ctx.fillText(label === "FORTUNE" ? "?" : "📦", 80, 120)
  ctx.font = "900 20px Georgia, serif"
  ctx.fillText(label, 80, 190)
  const t = new THREE.CanvasTexture(c)
  texCache.set(key, t)
  return t
}

function dieFaceTexture(n: number): THREE.CanvasTexture {
  const key = `die${n}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const ctx = c.getContext("2d")!
  const g = ctx.createLinearGradient(0, 0, 128, 128)
  g.addColorStop(0, "#fffef8"); g.addColorStop(1, "#e9e2d0")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = "rgba(0,0,0,0.14)"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 122, 122)
  const dots: [number, number][] = ({
    1: [[64, 64]], 2: [[36, 36], [92, 92]], 3: [[34, 34], [64, 64], [94, 94]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[36, 34], [92, 34], [36, 64], [92, 64], [36, 94], [92, 94]],
  } as Record<number, [number, number][]>)[n]!
  dots.forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = "#20160a"; ctx.fill()
  })
  const t = new THREE.CanvasTexture(c)
  texCache.set(key, t)
  return t
}

function woodTexture(): THREE.CanvasTexture {
  const hit = texCache.get("wood")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#2e2115"
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 512
    ctx.strokeStyle = Math.random() > 0.5 ? "rgba(110,80,45,0.10)" : "rgba(15,10,5,0.16)"
    ctx.lineWidth = 0.6 + Math.random() * 2.2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 20, 170, x + (Math.random() - 0.5) * 20, 340, x + (Math.random() - 0.5) * 12, 512)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(4, 4)
  texCache.set("wood", t)
  return t
}

// ---- pieces -------------------------------------------------------------------------

// Little green house / red hotel on the color band.
function Building({ hotel }: { hotel?: boolean }) {
  const col = hotel ? "#c8352b" : "#2f9e53"
  const s = hotel ? 1.5 : 1
  return (
    <group scale={s}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.14, 0.1, 0.12]} />
        <meshStandardMaterial color={col} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation-z={Math.PI / 4} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.11]} />
        <meshStandardMaterial color={col} roughness={0.3} metalness={0.15} />
      </mesh>
    </group>
  )
}

// Distinct token shapes per seat index — all glossy, tinted the player color.
function TokenShape({ seat, color }: { seat: number; color: string }) {
  const mat = <meshStandardMaterial color={color} metalness={0.5} roughness={0.18} envMapIntensity={1.1} />
  switch (seat % 6) {
    case 0: // top hat
      return (
        <group>
          <mesh castShadow><cylinderGeometry args={[0.17, 0.19, 0.05, 20]} />{mat}</mesh>
          <mesh position={[0, 0.14, 0]} castShadow><cylinderGeometry args={[0.11, 0.12, 0.22, 20]} />{mat}</mesh>
        </group>
      )
    case 1: // race car (simplified)
      return (
        <group>
          <mesh position={[0, 0.07, 0]} castShadow><boxGeometry args={[0.34, 0.09, 0.16]} />{mat}</mesh>
          <mesh position={[0.02, 0.14, 0]} castShadow><boxGeometry args={[0.16, 0.07, 0.13]} />{mat}</mesh>
          {[-0.11, 0.11].map((x) => [-0.09, 0.09].map((z) => (
            <mesh key={x + ':' + z} position={[x, 0.04, z]} rotation-x={Math.PI / 2} castShadow>
              <cylinderGeometry args={[0.045, 0.045, 0.03, 12]} />
              <meshStandardMaterial color="#1c1c22" roughness={0.5} />
            </mesh>
          )))}
        </group>
      )
    case 2: // ship
      return (
        <group>
          <mesh position={[0, 0.06, 0]} castShadow><coneGeometry args={[0.13, 0.3, 4]} /><meshStandardMaterial color={color} metalness={0.5} roughness={0.2} flatShading /></mesh>
          <mesh position={[0, 0.2, 0]} castShadow><coneGeometry args={[0.12, 0.18, 3]} />{mat}</mesh>
        </group>
      )
    case 3: // ring
      return (
        <mesh position={[0, 0.12, 0]} rotation-x={Math.PI / 2} castShadow>
          <torusGeometry args={[0.13, 0.055, 12, 24]} />{mat}
        </mesh>
      )
    case 4: // pawn
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.14, 0.16, 0.06, 18]} />{mat}</mesh>
          <mesh position={[0, 0.16, 0]} castShadow><coneGeometry args={[0.1, 0.2, 14]} />{mat}</mesh>
          <mesh position={[0, 0.3, 0]} castShadow><sphereGeometry args={[0.07, 12, 10]} />{mat}</mesh>
        </group>
      )
    default: // die cube
      return (
        <mesh position={[0, 0.12, 0]} rotation-y={0.5} castShadow>
          <boxGeometry args={[0.2, 0.2, 0.2]} />{mat}
        </mesh>
      )
  }
}

// Board-track player token: hops tile-by-tile toward its target space.
function PlayerToken({ player, seat, isCurrent, stackIndex, stackCount }: {
  player: Player; seat: number; isCurrent: boolean; stackIndex: number; stackCount: number
}) {
  const g = useRef<THREE.Group>(null)
  const shown = useRef<number>(player.position)   // continuously displayed index
  const hop = useRef(0)                           // 0..1 progress of current hop
  const ring = useRef<THREE.Mesh>(null)

  // A lone token sits dead-center on its tile; when several share a tile they
  // fan out along the tile's depth (perpendicular to its edge) so they queue
  // one behind another instead of colliding into one blob.
  const posOf = (idx: number) => {
    const t = tileTransform(Math.round(idx) % 40)
    const lz = stackCount > 1 ? (stackIndex - (stackCount - 1) / 2) * 0.44 : 0
    return { x: t.x + lz * Math.sin(t.rotY), z: t.z + lz * Math.cos(t.rotY) }
  }

  useFrame(({ clock }, dt) => {
    if (!g.current) return
    // Sent to jail — glide straight to the cell in one displacement instead of
    // hopping through every tile (which looked chaotic right after the roll).
    if (player.inJail && player.position === 10 && shown.current !== 10) {
      shown.current = 10
      hop.current = 0
    }
    const target = player.position
    let cur = shown.current
    if (cur !== target) {
      // step one tile at a time; prefer backward when it's a short "go back"
      const fwd = ((target - cur) % 40 + 40) % 40
      const dir = fwd <= 36 ? 1 : -1
      hop.current += dt * 6.5
      if (hop.current >= 1) {
        hop.current = 0
        cur = ((cur + dir) % 40 + 40) % 40
        shown.current = cur
      }
      const next = ((cur + dir) % 40 + 40) % 40
      const a = posOf(cur), b = posOf(next)
      const k = Math.min(1, hop.current)
      const e = k * k * (3 - 2 * k)
      g.current.position.set(a.x + (b.x - a.x) * e, BOARD_Y + Math.sin(k * Math.PI) * 0.35, a.z + (b.z - a.z) * e)
    } else {
      hop.current = 0
      const p = posOf(cur)
      const k = Math.min(1, dt * 8)
      g.current.position.x += (p.x - g.current.position.x) * k
      g.current.position.z += (p.z - g.current.position.z) * k
      g.current.position.y += (BOARD_Y - g.current.position.y) * k
    }
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.12
      ring.current.scale.set(s, s, s)
    }
  })

  if (player.isBankrupt) return null
  const start = posOf(player.position)
  return (
    <group ref={g} position={[start.x, BOARD_Y, start.z]} scale={1.22}>
      <TokenShape seat={seat} color={player.color} />
      {isCurrent && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.012, 0]}>
          <ringGeometry args={[0.24, 0.31, 28]} />
          <meshStandardMaterial color="#e6b45a" emissive="#e6b45a" emissiveIntensity={1.4} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      {player.inJail && (
        <Html position={[0, 0.55, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
          <span style={{ fontSize: 13 }}>🔒</span>
        </Html>
      )}
    </group>
  )
}

// ---- dice ---------------------------------------------------------------------------
const FACE_UP_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2],
  2: [0, 0, 0], 5: [Math.PI, 0, 0],
  3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
}

function Dice({ dice, rolling, onSettled }: {
  dice: [number, number]
  rolling: boolean
  onSettled: () => void
}) {
  const mats = useMemo(
    () => [1, 6, 2, 5, 3, 4].map((v) => new THREE.MeshStandardMaterial({ map: dieFaceTexture(v), roughness: 0.35 })),
    [],
  )
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const qT = useMemo(() => new THREE.Quaternion(), [])
  const eT = useMemo(() => new THREE.Euler(), [])
  const tumbleT = useRef(0)
  const settledFired = useRef(true)
  const prevDice = useRef(dice.join())

  // reactive tumble when a remote/bot roll changes the dice
  if (prevDice.current !== dice.join()) {
    prevDice.current = dice.join()
    if (!rolling) tumbleT.current = Math.max(tumbleT.current, 0.55)
  }
  if (rolling && settledFired.current) {
    settledFired.current = false
    tumbleT.current = 1.05
  }

  useFrame(({ clock }, dt) => {
    const tumbling = tumbleT.current > 0
    if (tumbling) tumbleT.current -= dt
    ;[a.current, b.current].forEach((m, i) => {
      if (!m) return
      if (tumbling) {
        m.rotation.x += dt * (9 + i * 3)
        m.rotation.y += dt * (11 - i * 4)
        m.position.y = 0.55 + Math.abs(Math.sin(clock.elapsedTime * 7 + i * 1.3)) * 0.45
      } else {
        const v = dice[i] || 1
        eT.set(...FACE_UP_EULER[v])
        qT.setFromEuler(eT)
        m.quaternion.slerp(qT, Math.min(1, dt * 9))
        m.position.y += (0.26 - m.position.y) * Math.min(1, dt * 8)
      }
    })
    if (!tumbling && !settledFired.current) {
      settledFired.current = true
      onSettled()
    }
  })

  return (
    <group position={[0, BOARD_Y, 1.7]}>
      <group rotation-y={0.4}>
        <mesh ref={a} position={[-0.42, 0.26, 0]} material={mats} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      </group>
      <group rotation-y={-0.25}>
        <mesh ref={b} position={[0.42, 0.26, 0.08]} material={mats} castShadow>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      </group>
    </group>
  )
}

// ---- cash floaters --------------------------------------------------------------------
interface CashFx { id: number; pid: string; amount: number; x: number; z: number }

function CashFloat({ fx }: { fx: CashFx }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Html position={[fx.x, BOARD_Y + 0.7, fx.z]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
      <div ref={ref} style={{
        fontFamily: "monospace", fontWeight: 900, fontSize: 15, whiteSpace: "nowrap",
        color: fx.amount > 0 ? "#7fe0a8" : "#ff8a7a",
        textShadow: "0 2px 6px rgba(0,0,0,0.9)",
        animation: "dicealley-cashfloat 1.6s ease-out forwards",
      }}>
        {fx.amount > 0 ? "+" : "−"}${Math.abs(fx.amount).toLocaleString()}
      </div>
      <style>{`@keyframes dicealley-cashfloat { 0% { opacity: 0; transform: translateY(8px) } 15% { opacity: 1 } 100% { opacity: 0; transform: translateY(-34px) } }`}</style>
    </Html>
  )
}

// ---- scene ------------------------------------------------------------------------------
// A Fortune/Treasury deck. Pulses, lifts and becomes clickable when it's the
// local player's turn to draw the card they landed on.
function Deck({ x, rotY, label, bg, active, onDraw }: {
  x: number; rotY: number; label: string; bg: string; active: boolean; onDraw: () => void
}) {
  const ring = useRef<THREE.Mesh>(null)
  const grp = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) (ring.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(t * 3.4) * 0.4
    if (grp.current) grp.current.position.y = BOARD_Y + (active ? 0.12 + Math.sin(t * 3) * 0.05 : 0)
  })
  return (
    <group position={[x, 0, -1.9]} rotation-y={rotY}>
      <group ref={grp} position={[0, BOARD_Y, 0]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.02 + i * 0.02, 0]} rotation-x={-Math.PI / 2} castShadow={i === 3}>
            <planeGeometry args={[1.15, 1.7]} />
            <meshBasicMaterial map={deckTexture(label, bg)} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {active && (
        <>
          <mesh ref={ring} position={[0, BOARD_Y + 0.012, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.95, 1.18, 44]} />
            <meshStandardMaterial color="#ffe08a" emissive="#ffe08a" emissiveIntensity={0.8} transparent opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh visible={false} position={[0, BOARD_Y + 0.35, 0]}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); document.body.style.cursor = "auto"; onDraw() }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
            onPointerOut={() => { document.body.style.cursor = "auto" }}>
            <boxGeometry args={[1.4, 0.8, 2.0]} />
          </mesh>
        </>
      )}
    </group>
  )
}

export interface EmpireScene3DProps {
  state: MonopolyState
  rolling: boolean
  canDrawCard: boolean
  onDiceSettled: () => void
  onTileClick: (index: number) => void
  onDrawCard: () => void
}

function Scene({ state, rolling, canDrawCard, onDiceSettled, onTileClick, onDrawCard }: EmpireScene3DProps) {
  const wood = useMemo(woodTexture, [])
  const center = useMemo(centerTexture, [])
  const cur = state.players[state.currentPlayerIndex]

  // cash delta floaters
  const [cashFx, setCashFx] = useState<CashFx[]>([])
  const fxId = useRef(0)
  const prevCash = useRef<Record<string, number>>({})
  useEffect(() => {
    const fresh: CashFx[] = []
    state.players.forEach((p) => {
      const prev = prevCash.current[p.id]
      if (prev !== undefined && prev !== p.cash && !p.isBankrupt) {
        const t = tileTransform(p.position)
        fresh.push({ id: ++fxId.current, pid: p.id, amount: p.cash - prev, x: t.x, z: t.z })
      }
      prevCash.current[p.id] = p.cash
    })
    if (fresh.length) {
      setCashFx((q) => [...q, ...fresh])
      fresh.forEach((f) => setTimeout(() => setCashFx((q) => q.filter((e) => e.id !== f.id)), 1700))
    }
  }, [state.players])

  // "Passed GO" celebration — a golden +$200 burst over the GO corner.
  const [goBursts, setGoBursts] = useState<number[]>([])
  const goId = useRef(0)
  const prevLogLen = useRef(state.log.length)
  useEffect(() => {
    const freshLines = state.log.slice(prevLogLen.current)
    prevLogLen.current = state.log.length
    if (freshLines.some((l) => l.includes("Passed GO"))) {
      const id = ++goId.current
      setGoBursts((b) => [...b, id])
      setTimeout(() => setGoBursts((b) => b.filter((x) => x !== id)), 1800)
    }
  }, [state.log])

  return (
    <>
      {/* warm parlor lighting */}
      <ambientLight intensity={0.5} color="#fff2df" />
      <hemisphereLight args={["#e8d9c0", "#141009", 0.45]} />
      <spotLight position={[0, 16, 3]} angle={0.72} penumbra={0.5} intensity={300} color="#ffe9c4" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <pointLight position={[-9, 6, -6]} intensity={16} color="#ffb877" distance={26} decay={2} />
      <pointLight position={[9, 6, 6]} intensity={14} color="#ffdca8" distance={26} decay={2} />

      {/* table */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.35, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial map={wood} color="#211709" roughness={0.75} />
      </mesh>

      {/* board slab */}
      <mesh position={[0, -0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[12.7, 0.24, 12.7]} />
        <meshStandardMaterial color="#17130c" roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.075, 0]} receiveShadow>
        <boxGeometry args={[12.35, 0.1, 12.35]} />
        <meshStandardMaterial color="#e5ddc4" roughness={0.85} />
      </mesh>

      {/* center art */}
      <mesh position={[0, BOARD_Y - 0.004, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[9, 9]} />
        <meshBasicMaterial map={center} toneMapped={false} />
      </mesh>

      {/* deck stacks — click to draw when you land on a card tile */}
      <Deck x={-2.6} rotY={0.35} label="FORTUNE" bg="#ef8b33"
        active={canDrawCard && state.pendingCard === 'CHANCE'} onDraw={onDrawCard} />
      <Deck x={2.6} rotY={-0.35} label="TREASURY" bg="#e8c53a"
        active={canDrawCard && state.pendingCard === 'COMMUNITY_CHEST'} onDraw={onDrawCard} />

      {/* tiles */}
      {BOARD_SPACES.map((space) => {
        const t = tileTransform(space.index)
        const prop = state.properties[space.index]
        const owner = prop?.ownerId ? state.players.find((p) => p.id === prop.ownerId) ?? null : null
        return (
          <group key={space.index} position={[t.x, 0, t.z]} rotation-y={t.rotY}>
            {/* printed face (unlit for crispness) */}
            <mesh
              position={[0, BOARD_Y, 0]} rotation-x={-Math.PI / 2}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onTileClick(space.index) }}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
              onPointerOut={() => { document.body.style.cursor = "auto" }}
            >
              <planeGeometry args={[t.w - 0.03, t.d - 0.03]} />
              <meshBasicMaterial map={tileTexture(space)} toneMapped={false} />
            </mesh>

            {/* owner peg at the inner edge */}
            {owner && (
              <group position={[t.w / 2 - 0.16, BOARD_Y, -t.d / 2 + 0.16]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.055, 0.07, 0.16, 12]} />
                  <meshStandardMaterial color={owner.color} metalness={0.4} roughness={0.25} />
                </mesh>
                <mesh position={[0, 0.11, 0]} castShadow>
                  <sphereGeometry args={[0.06, 10, 8]} />
                  <meshStandardMaterial color={owner.color} metalness={0.4} roughness={0.25} />
                </mesh>
              </group>
            )}

            {/* houses / hotel on the band */}
            {prop && prop.houses > 0 && (
              prop.houses === 5
                ? <group position={[0, BOARD_Y, -t.d / 2 + 0.22]}><Building hotel /></group>
                : <>
                  {Array.from({ length: prop.houses }).map((_, i) => (
                    <group key={i} position={[(i - (prop.houses - 1) / 2) * 0.2, BOARD_Y, -t.d / 2 + 0.2]}>
                      <Building />
                    </group>
                  ))}
                </>
            )}

            {/* mortgage veil */}
            {prop?.isMortgaged && (
              <mesh position={[0, BOARD_Y + 0.006, 0]} rotation-x={-Math.PI / 2}>
                <planeGeometry args={[t.w - 0.06, t.d - 0.06]} />
                <meshBasicMaterial color="#3a0f0f" transparent opacity={0.55} />
              </mesh>
            )}
          </group>
        )
      })}

      {/* tokens — grouped per tile so co-located pieces fan out and center */}
      {(() => {
        const onTile: Record<number, string[]> = {}
        state.players.forEach((p) => {
          if (p.isBankrupt) return
          if (!onTile[p.position]) onTile[p.position] = []
          onTile[p.position].push(p.id)
        })
        return state.players.map((p, i) => {
          const mates = onTile[p.position] || [p.id]
          return (
            <PlayerToken key={p.id} player={p} seat={i} isCurrent={p.id === cur.id && !p.isBankrupt}
              stackIndex={Math.max(0, mates.indexOf(p.id))} stackCount={mates.length} />
          )
        })
      })()}

      {/* player mannequins seated around the board, each with their name */}
      <Mannequins
        players={state.players.filter((p) => !p.isBankrupt).map((p) => ({
          id: p.id, name: p.name, color: p.color, isBot: p.isBot, active: p.id === cur.id,
        }))}
        radius={8} y={-0.35} scale={0.78} startAngle={-Math.PI / 2}
      />

      {/* dice */}
      <Dice dice={state.lastDice} rolling={rolling} onSettled={onDiceSettled} />

      {/* cash floaters */}
      {cashFx.map((fx) => <CashFloat key={fx.id} fx={fx} />)}

      {/* GO salary celebration */}
      {goBursts.map((id) => {
        const gt = tileTransform(0)
        return (
          <Html key={id} position={[gt.x, BOARD_Y + 0.95, gt.z]} center distanceFactor={11} style={{ pointerEvents: "none" }}>
            <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: 20, whiteSpace: "nowrap", color: "#ffdf6b", textShadow: "0 2px 12px rgba(0,0,0,0.95)", animation: "dicealley-goburst 1.7s ease-out forwards" }}>
              💰 +$200 · GO!
            </div>
            <style>{`@keyframes dicealley-goburst { 0%{opacity:0;transform:scale(0.5) translateY(12px)} 20%{opacity:1;transform:scale(1.18) translateY(0)} 45%{transform:scale(1)} 100%{opacity:0;transform:scale(1) translateY(-42px)} }`}</style>
          </Html>
        )
      })}

      <OrbitControls
        makeDefault enablePan={false} minDistance={8} maxDistance={30}
        minPolarAngle={0.15} maxPolarAngle={1.2} target={[0, 0, 0.3]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function EmpireScene3D(props: EmpireScene3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.03 }}
      camera={{ position: [0, 12.5, 12.5], fov: 45, near: 0.1, far: 140 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#120d08"]} />
      <fog attach="fog" args={["#120d08", 30, 65]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.35} luminanceThreshold={0.75} luminanceSmoothing={0.3} mipmapBlur />
          <Vignette eskil={false} offset={0.24} darkness={0.72} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
