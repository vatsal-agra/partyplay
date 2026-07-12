// Hexland — real-time 3D island (Three.js / React Three Fiber).
//
// A golden-hour tabletop island: extruded terrain hexes with procedural trees,
// mountains, sheep, wheat and brick stacks; an animated ocean with harbor
// docks; 3D wooden houses/cities and roads in player colors; a robber pawn
// that glides between hexes; and dice that tumble and settle on the real roll.
// Presentation layer only — all interaction flows back through the callbacks
// provided by CatanBoard (which owns the engine calls).
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, ContactShadows, Environment, Lightformer } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import {
  CatanState, TerrainType, getBoardLayout,
} from "../lib/catanEngine"

// ---- layout → world -----------------------------------------------------------
const S = 2 // world units per layout unit (hex circumradius = S)
const HEX_H = 0.38
const GOLD = "#e6b45a"

const TERRAIN_TOP: Record<TerrainType, string> = {
  FOREST: "#2e6b33", HILLS: "#a34b26", PASTURE: "#79a844", FIELDS: "#d9a32e",
  MOUNTAINS: "#75797f", DESERT: "#d3ab66",
}
const TERRAIN_SIDE: Record<TerrainType, string> = {
  FOREST: "#1d4522", HILLS: "#6e3018", PASTURE: "#4f7529", FIELDS: "#9c741d",
  MOUNTAINS: "#4a4e55", DESERT: "#a3823f",
}

function usePointer() {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer" },
    onPointerOut: () => { document.body.style.cursor = "auto" },
  }
}

// ---- procedural canvas textures ------------------------------------------------
function canvas2d(size = 128) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  return { c, ctx: c.getContext("2d")! }
}

function waterTexture(): THREE.Texture {
  const { c, ctx } = canvas2d(256)
  const g = ctx.createLinearGradient(0, 0, 256, 256)
  g.addColorStop(0, "#14586a"); g.addColorStop(1, "#0e3f50")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  ctx.lineWidth = 1.4
  for (let i = 0; i < 26; i++) {
    const y = (i / 26) * 256
    ctx.strokeStyle = `rgba(80,190,205,${0.05 + (i % 3) * 0.03})`
    ctx.beginPath()
    for (let x = 0; x <= 256; x += 8) {
      const yy = y + Math.sin((x / 256) * Math.PI * 4 + i * 1.7) * 4
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(5, 5)
  return t
}

function numberTokenTexture(n: number): THREE.Texture {
  const { c, ctx } = canvas2d(128)
  ctx.clearRect(0, 0, 128, 128)
  const g = ctx.createRadialGradient(64, 56, 8, 64, 64, 62)
  g.addColorStop(0, "#fffef0"); g.addColorStop(0.8, "#f7efd4"); g.addColorStop(1, "#dcc99a")
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fillStyle = g; ctx.fill()
  ctx.lineWidth = 4; ctx.strokeStyle = "#6b4a1f"; ctx.stroke()
  const hot = n === 6 || n === 8
  ctx.fillStyle = hot ? "#c2261f" : "#232f3f"
  ctx.font = `900 ${hot ? 58 : 52}px Georgia, serif`
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(String(n), 64, 58)
  // probability pips
  const pips = 6 - Math.abs(7 - n)
  const startX = 64 - ((pips - 1) * 10) / 2
  ctx.fillStyle = hot ? "#c2261f" : "#232f3f"
  for (let i = 0; i < pips; i++) {
    ctx.beginPath(); ctx.arc(startX + i * 10, 98, 3.4, 0, Math.PI * 2); ctx.fill()
  }
  return new THREE.CanvasTexture(c)
}

function harborTexture(label: string, emoji: string | null): THREE.Texture {
  const { c, ctx } = canvas2d(128)
  ctx.clearRect(0, 0, 128, 128)
  ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2)
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, "#fff7e0"); g.addColorStop(1, "#e3cf9e")
  ctx.fillStyle = g; ctx.fill()
  ctx.lineWidth = 5; ctx.strokeStyle = "#6b4a1f"; ctx.stroke()
  ctx.fillStyle = "#5a3c14"
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  if (emoji) {
    ctx.font = "900 34px Georgia, serif"
    ctx.fillText(label, 64, 42)
    ctx.font = "44px serif"
    ctx.fillText(emoji, 64, 88)
  } else {
    ctx.font = "900 44px Georgia, serif"
    ctx.fillText(label, 64, 64)
  }
  return new THREE.CanvasTexture(c)
}

function dieFaceTexture(n: number): THREE.Texture {
  const { c, ctx } = canvas2d(128)
  const g = ctx.createLinearGradient(0, 0, 128, 128)
  g.addColorStop(0, "#fffef8"); g.addColorStop(1, "#e9e2d0")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = "rgba(0,0,0,0.14)"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 122, 122)
  const dots: [number, number][] = ({
    1: [[64, 64]],
    2: [[36, 36], [92, 92]],
    3: [[34, 34], [64, 64], [94, 94]],
    4: [[36, 36], [92, 36], [36, 92], [92, 92]],
    5: [[36, 36], [92, 36], [64, 64], [36, 92], [92, 92]],
    6: [[36, 34], [92, 34], [36, 64], [92, 64], [36, 94], [92, 94]],
  } as Record<number, [number, number][]>)[n]!
  dots.forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2)
    ctx.fillStyle = "#20160a"; ctx.fill()
    ctx.beginPath(); ctx.arc(x - 3, y - 3, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fill()
  })
  return new THREE.CanvasTexture(c)
}

// ---- terrain decorations (deterministic layouts, no randomness) -----------------
function Tree({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, HEX_H, z]} scale={s}>
      <mesh position={[0, 0.14, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.28, 6]} />
        <meshStandardMaterial color="#5b3a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <coneGeometry args={[0.24, 0.5, 7]} />
        <meshStandardMaterial color="#1e5a26" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow>
        <coneGeometry args={[0.17, 0.36, 7]} />
        <meshStandardMaterial color="#2a7232" roughness={0.8} />
      </mesh>
    </group>
  )
}

function Sheep({ x, z, r = 0 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, HEX_H + 0.12, z]} rotation-y={r}>
      <mesh castShadow>
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshStandardMaterial color="#f2f0e8" roughness={0.95} />
      </mesh>
      <mesh position={[0.13, 0.02, 0]} castShadow>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.8} />
      </mesh>
    </group>
  )
}

function MountainPeak({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, HEX_H, z]} scale={s}>
      <mesh position={[0, 0.34, 0]} castShadow>
        <coneGeometry args={[0.42, 0.72, 5]} />
        <meshStandardMaterial color="#5a5f66" roughness={0.85} flatShading />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <coneGeometry args={[0.17, 0.24, 5]} />
        <meshStandardMaterial color="#eef2f7" roughness={0.6} flatShading />
      </mesh>
    </group>
  )
}

function BrickStack({ x, z, r = 0 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, HEX_H, z]} rotation-y={r}>
      {[[-0.13, 0.05, 0], [0.13, 0.05, 0], [0, 0.05, 0.22], [0, 0.16, 0.1]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <boxGeometry args={[0.24, 0.1, 0.13]} />
          <meshStandardMaterial color={i % 2 ? "#c2562e" : "#d4703f"} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function WheatRow({ x, z, r = 0 }: { x: number; z: number; r?: number }) {
  return (
    <group position={[x, HEX_H, z]} rotation-y={r}>
      {[-0.22, 0, 0.22].map((o, i) => (
        <mesh key={i} position={[o, 0.12, 0]} castShadow>
          <boxGeometry args={[0.09, 0.24, 0.09]} />
          <meshStandardMaterial color="#e8bc3f" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Cactus({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, HEX_H, z]}>
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.48, 8]} />
        <meshStandardMaterial color="#3f7d35" roughness={0.8} />
      </mesh>
      <mesh position={[0.14, 0.3, 0]} rotation-z={-0.6} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.2, 8]} />
        <meshStandardMaterial color="#3f7d35" roughness={0.8} />
      </mesh>
    </group>
  )
}

function TerrainDecor({ terrain, seed }: { terrain: TerrainType; seed: number }) {
  const rot = (seed * 137) % 360 * (Math.PI / 180)
  switch (terrain) {
    case "FOREST":
      return (
        <group rotation-y={rot}>
          <Tree x={-0.7} z={0.35} s={0.85} /><Tree x={0.65} z={0.4} s={0.9} />
          <Tree x={-0.15} z={-0.55} s={1.1} /><Tree x={0.75} z={-0.5} s={0.75} />
          <Tree x={-0.85} z={-0.45} s={0.7} />
        </group>
      )
    case "PASTURE":
      return (
        <group rotation-y={rot}>
          <Sheep x={0.4} z={0.3} r={0.7} /><Sheep x={-0.5} z={-0.2} r={-1.2} />
          <Sheep x={0.1} z={-0.65} r={2.1} />
        </group>
      )
    case "MOUNTAINS":
      return (
        <group rotation-y={rot}>
          <MountainPeak x={-0.4} z={0.25} s={0.85} /><MountainPeak x={0.45} z={-0.1} s={1.1} />
          <MountainPeak x={-0.2} z={-0.6} s={0.7} />
        </group>
      )
    case "HILLS":
      return (
        <group rotation-y={rot}>
          <BrickStack x={-0.35} z={0.3} r={0.4} /><BrickStack x={0.45} z={-0.25} r={-0.8} />
        </group>
      )
    case "FIELDS":
      return (
        <group rotation-y={rot}>
          <WheatRow x={-0.4} z={0.35} r={0.3} /><WheatRow x={0.4} z={0} r={0.3} />
          <WheatRow x={-0.1} z={-0.5} r={0.3} />
        </group>
      )
    case "DESERT":
      return (
        <group rotation-y={rot}>
          <Cactus x={0.4} z={-0.3} />
          <mesh position={[-0.4, HEX_H + 0.03, 0.3]} castShadow>
            <sphereGeometry args={[0.16, 8, 6]} />
            <meshStandardMaterial color="#b08545" roughness={1} />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

// ---- buildings ------------------------------------------------------------------
function Settlement({ color }: { color: string }) {
  return (
    <group scale={0.9}>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.5, 0.32, 0.38]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.4, 0]} rotation-x={Math.PI / 4} castShadow>
        <boxGeometry args={[0.54, 0.28, 0.28]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}

function City({ color }: { color: string }) {
  return (
    <group scale={0.95}>
      <mesh position={[0.08, 0.18, 0]} castShadow>
        <boxGeometry args={[0.62, 0.36, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[-0.16, 0.45, 0]} castShadow>
        <boxGeometry args={[0.3, 0.62, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[-0.16, 0.82, 0]} rotation-x={Math.PI / 4} castShadow>
        <boxGeometry args={[0.32, 0.26, 0.26]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.25} />
      </mesh>
      <mesh position={[0.2, 0.44, 0]} rotation-x={Math.PI / 4} castShadow>
        <boxGeometry args={[0.4, 0.24, 0.24]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}

// robber pawn silhouette (lathe)
const ROBBER_GEO = (() => {
  const pts: [number, number][] = [
    [0.0, 0.0], [0.3, 0.0], [0.3, 0.05], [0.18, 0.1], [0.15, 0.35],
    [0.24, 0.42], [0.2, 0.5], [0.12, 0.52], [0.11, 0.64], [0.2, 0.74],
    [0.19, 0.82], [0.11, 0.88], [0.0, 0.92],
  ]
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x * 1.4, y * 1.4)), 32)
})()

function Robber({ target }: { target: { x: number; z: number } }) {
  const g = useRef<THREE.Group>(null)
  const init = useRef(false)
  useFrame(({ clock }, dt) => {
    if (!g.current) return
    if (!init.current) { g.current.position.set(target.x, HEX_H, target.z); init.current = true }
    const k = Math.min(1, dt * 6)
    g.current.position.x += (target.x - g.current.position.x) * k
    g.current.position.z += (target.z - g.current.position.z) * k
    const d = Math.hypot(target.x - g.current.position.x, target.z - g.current.position.z)
    g.current.position.y = HEX_H + (d > 0.08 ? Math.abs(Math.sin(clock.elapsedTime * 10)) * 0.25 : 0)
  })
  return (
    <group ref={g}>
      <mesh geometry={ROBBER_GEO} castShadow>
        <meshStandardMaterial color="#23262e" roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <torusGeometry args={[0.17, 0.025, 8, 24]} />
        <meshStandardMaterial color="#c2261f" emissive="#c2261f" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}

// ---- clickable helpers ------------------------------------------------------------
function PulseMat({ color = GOLD, base = 0.55, amp = 0.35, opacity = 0.85 }: { color?: string; base?: number; amp?: number; opacity?: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = base + Math.sin(clock.elapsedTime * 3.2) * amp
  })
  return <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={base} transparent opacity={opacity} />
}

// ---- dice --------------------------------------------------------------------------
const FACE_UP_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2],
  2: [0, 0, 0], 5: [Math.PI, 0, 0],
  3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
}

function Dice({ dice, rolling }: { dice: [number, number]; rolling: boolean }) {
  const faces = useMemo(() => [1, 2, 3, 4, 5, 6].map(dieFaceTexture), [])
  const mats = useMemo(
    // BoxGeometry face order +x,-x,+y,-y,+z,-z → values 1,6,2,5,3,4
    () => [1, 6, 2, 5, 3, 4].map((v) => new THREE.MeshStandardMaterial({ map: faces[v - 1], roughness: 0.35, metalness: 0.05 })),
    [faces],
  )
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const qTarget = useMemo(() => new THREE.Quaternion(), [])
  const eTmp = useMemo(() => new THREE.Euler(), [])
  useFrame(({ clock }, dt) => {
    ;[a.current, b.current].forEach((m, i) => {
      if (!m) return
      if (rolling) {
        m.rotation.x += dt * (10 + i * 3)
        m.rotation.y += dt * (12 - i * 4)
        m.position.y = 0.9 + Math.abs(Math.sin(clock.elapsedTime * 7 + i * 1.4)) * 0.6
      } else {
        const v = dice[i] || 1
        eTmp.set(...FACE_UP_EULER[v])
        qTarget.setFromEuler(eTmp)
        m.quaternion.slerp(qTarget, Math.min(1, dt * 8))
        m.position.y += (0.31 - m.position.y) * Math.min(1, dt * 7)
      }
    })
  })
  return (
    <group position={[S * 5.4, 0, S * 4.6]}>
      {/* wooden dice tray */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.7, 1.85, 0.18, 24]} />
        <meshStandardMaterial color="#4a3018" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.04, 24]} />
        <meshStandardMaterial color="#2a1c0e" roughness={0.9} />
      </mesh>
      <group rotation-y={0.5}>
        <mesh ref={a} position={[-0.55, 0.31, 0]} material={mats} castShadow>
          <boxGeometry args={[0.62, 0.62, 0.62]} />
        </mesh>
      </group>
      <group rotation-y={-0.3}>
        <mesh ref={b} position={[0.55, 0.31, 0.1]} material={mats} castShadow>
          <boxGeometry args={[0.62, 0.62, 0.62]} />
        </mesh>
      </group>
    </group>
  )
}

// ---- ocean -------------------------------------------------------------------------
function Ocean() {
  const tex = useMemo(waterTexture, [])
  useFrame((_, dt) => {
    tex.offset.x += dt * 0.008
    tex.offset.y += dt * 0.004
  })
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]} receiveShadow>
        <circleGeometry args={[36, 72]} />
        <meshStandardMaterial map={tex} color="#9adbe8" roughness={0.35} metalness={0.25} />
      </mesh>
      {/* shallow glow ring under the island */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <circleGeometry args={[S * 5.6, 48]} />
        <meshStandardMaterial color="#2e97a8" transparent opacity={0.5} roughness={0.5} />
      </mesh>
    </>
  )
}

// ---- full scene ----------------------------------------------------------------------
export interface HexIsland3DProps {
  state: CatanState
  buildableVertices: number[]
  buildableEdges: number[]
  upgradeVertices: number[]
  buildableHexes: number[]
  selectedRoads: number[]
  rolling: boolean
  activeColor: string
  onVertexClick: (vertexId: number) => void
  onEdgeClick: (edgeId: number) => void
  onHexClick: (hexIndex: number) => void
}

const RES_EMOJI: Record<string, string> = { WOOD: "🌲", BRICK: "🧱", SHEEP: "🐑", WHEAT: "🌾", ORE: "⛰️" }

function Scene(props: HexIsland3DProps) {
  const { state, buildableVertices, buildableEdges, upgradeVertices, buildableHexes, selectedRoads, rolling, activeColor, onVertexClick, onEdgeClick, onHexClick } = props
  const layout = useMemo(getBoardLayout, [])
  const p = usePointer()

  const tokenTextures = useMemo(() => {
    const map: Record<number, THREE.Texture> = {}
    ;[2, 3, 4, 5, 6, 8, 9, 10, 11, 12].forEach((n) => { map[n] = numberTokenTexture(n) })
    return map
  }, [])

  const harborTextures = useMemo(
    () => layout.harbors.map((h) => h.resource === "GENERIC" ? harborTexture("3:1", null) : harborTexture("2:1", RES_EMOJI[h.resource])),
    [layout],
  )

  const vSet = useMemo(() => new Set(buildableVertices), [buildableVertices])
  const eSet = useMemo(() => new Set(buildableEdges), [buildableEdges])
  const uSet = useMemo(() => new Set(upgradeVertices), [upgradeVertices])
  const hSet = useMemo(() => new Set(buildableHexes), [buildableHexes])

  const robberHex = layout.hexes[state.robberHexIndex]

  return (
    <>
      {/* golden-hour light rig */}
      <ambientLight intensity={0.4} color="#ffe4bd" />
      <hemisphereLight args={["#bfe3f2", "#1a2a1c", 0.55]} />
      <directionalLight
        position={[14, 18, 8]} intensity={2.3} color="#ffdf9e" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-camera-left={-18} shadow-camera-right={18} shadow-camera-top={18} shadow-camera-bottom={-18}
        shadow-camera-near={1} shadow-camera-far={60}
      />
      <directionalLight position={[-10, 8, -12]} intensity={0.5} color="#7fb8d9" />

      <Environment resolution={256}>
        <Lightformer intensity={2.2} form="rect" position={[0, 10, 4]} scale={[12, 8, 1]} color="#ffe9c4" />
        <Lightformer intensity={1} form="circle" position={[-8, 5, -6]} scale={5} color="#8fd0e8" />
        <Lightformer intensity={1.4} form="circle" position={[10, 4, 6]} scale={4} color="#ffd9a0" />
      </Environment>

      <Ocean />

      {/* island hexes */}
      {state.hexes.map((hex) => {
        const hl = layout.hexes[hex.index]
        const cx = hl.x * S, cz = hl.y * S
        const clickable = hSet.has(hex.index)
        return (
          <group key={hex.index} position={[cx, 0, cz]}>
            {/* sandy shore under-hex */}
            <mesh position={[0, 0.07, 0]} receiveShadow>
              <cylinderGeometry args={[S * 1.09, S * 1.13, 0.14, 6]} />
              <meshStandardMaterial color="#cfa75e" roughness={0.9} />
            </mesh>
            {/* terrain prism */}
            <mesh position={[0, HEX_H / 2 + 0.1, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[S * 0.97, S * 1.0, HEX_H, 6]} />
              <meshStandardMaterial color={TERRAIN_SIDE[hex.terrain]} roughness={0.8} />
            </mesh>
            <mesh position={[0, HEX_H + 0.1, 0]} rotation-y={0} receiveShadow>
              <cylinderGeometry args={[S * 0.95, S * 0.95, 0.02, 6]} />
              <meshStandardMaterial color={TERRAIN_TOP[hex.terrain]} roughness={0.85} />
            </mesh>
            {/* decorations sit at HEX_H — group is at hex origin so lift by 0.1 base */}
            <group position={[0, 0.12, 0]}>
              <TerrainDecor terrain={hex.terrain} seed={hex.index} />
            </group>
            {/* number token */}
            {hex.numberToken > 0 && (
              <mesh position={[0, HEX_H + 0.16, 0]} castShadow>
                <cylinderGeometry args={[0.52, 0.52, 0.07, 28]} />
                <meshStandardMaterial color="#f7efd4" roughness={0.6} />
              </mesh>
            )}
            {hex.numberToken > 0 && (
              <mesh position={[0, HEX_H + 0.2, 0]} rotation-x={-Math.PI / 2}>
                <circleGeometry args={[0.5, 28]} />
                <meshStandardMaterial map={tokenTextures[hex.numberToken]} transparent roughness={0.55} />
              </mesh>
            )}
            {/* robber-move click target */}
            {clickable && (
              <mesh position={[0, HEX_H + 0.13, 0]}
                onClick={(e) => { e.stopPropagation(); onHexClick(hex.index) }} {...p}>
                <cylinderGeometry args={[S * 0.95, S * 0.95, 0.05, 6]} />
                <PulseMat opacity={0.4} base={0.5} amp={0.3} />
              </mesh>
            )}
          </group>
        )
      })}

      {/* harbors — dock planks + floating badge */}
      {layout.harbors.map((h, i) => {
        const v1 = layout.vertices[h.vertices[0]]
        const v2 = layout.vertices[h.vertices[1]]
        const mx = ((v1.x + v2.x) / 2) * S, mz = ((v1.y + v2.y) / 2) * S
        const len = Math.hypot(mx, mz) || 1
        const ux = mx / len, uz = mz / len
        const bx = mx + ux * 1.5, bz = mz + uz * 1.5
        return (
          <group key={`h${i}`}>
            {[v1, v2].map((v, j) => {
              const px = v.x * S, pz = v.y * S
              const dx = bx - px, dz = bz - pz
              const dl = Math.hypot(dx, dz)
              return (
                <mesh key={j} position={[(px + bx) / 2, 0.06, (pz + bz) / 2]} rotation-y={-Math.atan2(dz, dx)} castShadow>
                  <boxGeometry args={[dl, 0.08, 0.18]} />
                  <meshStandardMaterial color="#6e4a22" roughness={0.85} />
                </mesh>
              )
            })}
            <mesh position={[bx, 0.14, bz]} castShadow>
              <cylinderGeometry args={[0.5, 0.55, 0.12, 20]} />
              <meshStandardMaterial color="#4a3018" roughness={0.8} />
            </mesh>
            <mesh position={[bx, 0.21, bz]} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[0.46, 20]} />
              <meshStandardMaterial map={harborTextures[i]} transparent roughness={0.55} />
            </mesh>
          </group>
        )
      })}

      {/* roads */}
      {layout.edges.map((e) => {
        const ownerId = state.roads[e.id]
        const pending = selectedRoads.includes(e.id)
        const clickable = eSet.has(e.id)
        if (!ownerId && !pending && !clickable) return null
        const v1 = layout.vertices[e.vertices[0]], v2 = layout.vertices[e.vertices[1]]
        const x1 = v1.x * S, z1 = v1.y * S, x2 = v2.x * S, z2 = v2.y * S
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2
        const ang = -Math.atan2(z2 - z1, x2 - x1)
        const elen = Math.hypot(x2 - x1, z2 - z1)
        const owner = ownerId ? state.players.find((q) => q.id === ownerId) : null
        if (owner || pending) {
          return (
            <mesh key={`r${e.id}`} position={[mx, 0.62, mz]} rotation-y={ang} castShadow>
              <boxGeometry args={[elen * 0.7, 0.22, 0.3]} />
              {pending
                ? <PulseMat color="#e11d48" opacity={0.95} />
                : <meshStandardMaterial color={owner!.color} roughness={0.35} metalness={0.15} />}
            </mesh>
          )
        }
        return (
          <mesh key={`re${e.id}`} position={[mx, 0.62, mz]} rotation-y={ang}
            onClick={(ev) => { ev.stopPropagation(); onEdgeClick(e.id) }} {...p}>
            <boxGeometry args={[elen * 0.7, 0.18, 0.26]} />
            <PulseMat opacity={0.55} />
          </mesh>
        )
      })}

      {/* settlements / cities / build spots */}
      {layout.vertices.map((v) => {
        const b = state.settlements[v.id]
        const vx = v.x * S, vz = v.y * S
        const canBuild = vSet.has(v.id)
        const canUpgrade = uSet.has(v.id)
        if (b) {
          const owner = state.players.find((q) => q.id === b.playerId)!
          return (
            <group key={`b${v.id}`} position={[vx, 0.5, vz]}
              onClick={canUpgrade ? (e) => { e.stopPropagation(); onVertexClick(v.id) } : undefined}
              {...(canUpgrade ? p : {})}>
              {b.type === "city" ? <City color={owner.color} /> : <Settlement color={owner.color} />}
              {canUpgrade && (
                <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
                  <ringGeometry args={[0.5, 0.68, 28]} />
                  <PulseMat opacity={0.9} base={0.8} amp={0.5} />
                </mesh>
              )}
            </group>
          )
        }
        if (canBuild) {
          return (
            <group key={`v${v.id}`} position={[vx, 0.55, vz]}
              onClick={(e) => { e.stopPropagation(); onVertexClick(v.id) }} {...p}>
              <mesh>
                <sphereGeometry args={[0.22, 16, 12]} />
                <PulseMat color={activeColor} opacity={0.95} base={0.7} amp={0.4} />
              </mesh>
              <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 0]}>
                <ringGeometry args={[0.3, 0.42, 24]} />
                <PulseMat opacity={0.7} />
              </mesh>
            </group>
          )
        }
        return null
      })}

      {/* robber */}
      <Robber target={{ x: robberHex.x * S, z: robberHex.y * S }} />

      <Dice dice={state.dice} rolling={rolling} />

      <ContactShadows position={[0, 0.02, 0]} scale={45} blur={2.6} opacity={0.42} far={8} resolution={1024} color="#04222b" />

      <OrbitControls
        makeDefault enablePan={false} minDistance={9} maxDistance={42}
        minPolarAngle={0.15} maxPolarAngle={1.3} target={[0, 0, 0]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function HexIsland3D(props: HexIsland3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [0, 17, 15], fov: 44, near: 0.1, far: 220 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0b1c24"]} />
      <fog attach="fog" args={["#0b1c24", 42, 90]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.5} luminanceThreshold={0.65} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette eskil={false} offset={0.24} darkness={0.7} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
