// Naval Clash — real-time 3D battle (Three.js / React Three Fiber).
//
// A dusk naval engagement: your procedural warship fleet bobs on home waters,
// the enemy grid lies shrouded across the open sea. Missiles physically launch
// from your ships, arc with a glowing trail and detonate on the enemy grid —
// fireball + shockwave on a hit, a spray column on a miss, and revealed
// burning wrecks that list and sink. Presentation layer only: the container
// owns every engine call; this scene renders state and reports clicks/impacts.
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef, useState, useEffect } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, Trail } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import {
  BattleshipState, Ship, ShotResult, GRID, cellKey,
} from "../lib/battleshipEngine"
import { playSfx } from "@/lib/sfx"

// ---- world mapping ------------------------------------------------------------
const CELL = 1.15
const GAP = 3.2                    // open sea between the two grids
const wx = (x: number) => (x - (GRID - 1) / 2) * CELL
const ownZ = (y: number) => GAP + y * CELL          // my grid: toward camera
const enemyZ = (y: number) => -(GAP + y * CELL)     // enemy grid: away
const GOLD = "#e6b45a"

export interface Flight {
  id: number
  targetX: number
  targetY: number
  result: ShotResult
  incoming: boolean       // true = enemy shell falling on MY fleet
  dramaOnly?: boolean     // replay of an already-committed remote shot — never commits
}

export interface NavalScene3DProps {
  state: BattleshipState
  meIndex: number
  isMyTurn: boolean
  canFire: boolean
  flight: Flight | null
  onImpact: (f: Flight) => void
  onFireCell: (x: number, y: number) => void
  // placement
  placing: boolean
  previewCells: { cells: { x: number; y: number }[]; ok: boolean } | null
  onHoverCell: (c: { x: number; y: number } | null) => void
  onClickOwnCell: (x: number, y: number) => void
}

function usePointer(cursor = "pointer") {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = cursor },
    onPointerOut: () => { document.body.style.cursor = "auto" },
  }
}

// ---- water ----------------------------------------------------------------------
function waterTexture(): THREE.Texture {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  // A real deep-sea teal, not near-black — so the ocean reads as water.
  const g = ctx.createLinearGradient(0, 0, 256, 256)
  g.addColorStop(0, "#1d6b86"); g.addColorStop(0.5, "#14566f"); g.addColorStop(1, "#0e4257")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  // brighter, more visible swell crests
  for (let i = 0; i < 42; i++) {
    ctx.strokeStyle = `rgba(150,218,238,${0.06 + (i % 3) * 0.045})`
    ctx.lineWidth = 1 + (i % 2)
    ctx.beginPath()
    const y = (i / 42) * 256
    for (let x = 0; x <= 256; x += 6) {
      const yy = y + Math.sin((x / 256) * Math.PI * 5 + i * 2.1) * 3.5
      x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy)
    }
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(7, 7)
  return t
}

function Ocean() {
  const tex = useMemo(waterTexture, [])
  useFrame((_, dt) => { tex.offset.y += dt * 0.006; tex.offset.x += dt * 0.002 })
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]} receiveShadow>
      <planeGeometry args={[130, 130]} />
      {/* matte-ish sea: low metalness + higher roughness so the lights don't
          blow out into two glaring hotspots. */}
      <meshStandardMaterial map={tex} color="#5fa8c4" roughness={0.68} metalness={0.05} />
    </mesh>
  )
}

// dusk horizon glow behind enemy waters
function Horizon() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas")
    c.width = 64; c.height = 256
    const ctx = c.getContext("2d")!
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, "rgba(10,18,28,0)")
    g.addColorStop(0.55, "rgba(35,30,40,0.25)")
    g.addColorStop(0.8, "rgba(214,110,50,0.55)")
    g.addColorStop(1, "rgba(255,160,70,0.9)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 256)
    return new THREE.CanvasTexture(c)
  }, [])
  return (
    <mesh position={[0, 9, -55]}>
      <planeGeometry args={[170, 26]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  )
}

// ---- warships (procedural, size 2..5) --------------------------------------------
const HULL_GREY = "#7d8894"
const HULL_DARK = "#59636e"
const DECK = "#4b545e"

function Turret({ z }: { z: number }) {
  return (
    <group position={[0, 0.34, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.16, 0.19, 0.14, 10]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.05, 0.02, -0.16]} rotation-x={-0.06} castShadow>
        <boxGeometry args={[0.035, 0.035, 0.34]} />
        <meshStandardMaterial color="#3a4149" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[-0.05, 0.02, -0.16]} rotation-x={-0.06} castShadow>
        <boxGeometry args={[0.035, 0.035, 0.34]} />
        <meshStandardMaterial color="#3a4149" roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  )
}

// One warship model. Length spans `size` cells; origin at ship center, bow -z.
function WarshipModel({ ship }: { ship: Ship }) {
  const L = ship.size * CELL * 0.92
  const W = CELL * 0.52
  const isCarrier = ship.id === "carrier"
  const isSub = ship.id === "submarine"

  if (isSub) {
    return (
      <group>
        {/* capsule axis is Y by default — lay it along the ship's Z axis */}
        <mesh castShadow position={[0, 0.12, 0]} rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[W * 0.42, L * 0.72, 6, 12]} />
          <meshStandardMaterial color="#2c333c" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* conning tower */}
        <mesh castShadow position={[0, 0.38, -L * 0.08]}>
          <cylinderGeometry args={[0.14, 0.17, 0.3, 8]} />
          <meshStandardMaterial color="#232930" roughness={0.55} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.55, -L * 0.08]}>
          <cylinderGeometry args={[0.015, 0.015, 0.22, 6]} />
          <meshStandardMaterial color="#161a1f" />
        </mesh>
      </group>
    )
  }

  return (
    <group>
      {/* hull */}
      <mesh castShadow position={[0, 0.16, 0]}>
        <boxGeometry args={[W, 0.32, L * 0.78]} />
        <meshStandardMaterial color={HULL_GREY} roughness={0.55} metalness={0.35} />
      </mesh>
      {/* bow (pointed) */}
      <mesh castShadow position={[0, 0.16, -L * 0.39 - L * 0.09]} rotation-x={Math.PI / 2}>
        <coneGeometry args={[W * 0.5, L * 0.2, 4]} />
        <meshStandardMaterial color={HULL_GREY} roughness={0.55} metalness={0.35} flatShading />
      </mesh>
      {/* stern */}
      <mesh castShadow position={[0, 0.16, L * 0.41]}>
        <boxGeometry args={[W * 0.9, 0.28, L * 0.06]} />
        <meshStandardMaterial color={HULL_DARK} roughness={0.6} metalness={0.35} />
      </mesh>
      {/* waterline stripe */}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[W * 1.02, 0.05, L * 0.8]} />
        <meshStandardMaterial color="#8a2f24" roughness={0.7} />
      </mesh>

      {isCarrier ? (
        <>
          {/* flight deck */}
          <mesh castShadow position={[0, 0.36, 0]}>
            <boxGeometry args={[W * 1.35, 0.07, L * 0.98]} />
            <meshStandardMaterial color={DECK} roughness={0.8} metalness={0.2} />
          </mesh>
          {/* deck stripe */}
          <mesh position={[0, 0.402, 0]}>
            <boxGeometry args={[0.06, 0.005, L * 0.9]} />
            <meshStandardMaterial color="#c8ccd2" roughness={0.7} />
          </mesh>
          {/* island tower */}
          <group position={[W * 0.48, 0.55, L * 0.12]}>
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.34, 0.5]} />
              <meshStandardMaterial color={HULL_DARK} roughness={0.55} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0.26, 0]} castShadow>
              <boxGeometry args={[0.16, 0.18, 0.3]} />
              <meshStandardMaterial color="#3a4149" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.44, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.26, 6]} />
              <meshStandardMaterial color="#161a1f" />
            </mesh>
          </group>
        </>
      ) : (
        <>
          {/* superstructure */}
          <mesh castShadow position={[0, 0.42, L * 0.04]}>
            <boxGeometry args={[W * 0.62, 0.22, L * 0.3]} />
            <meshStandardMaterial color={DECK} roughness={0.6} metalness={0.3} />
          </mesh>
          <mesh castShadow position={[0, 0.58, L * 0.02]}>
            <boxGeometry args={[W * 0.4, 0.14, L * 0.16]} />
            <meshStandardMaterial color={HULL_DARK} roughness={0.55} metalness={0.35} />
          </mesh>
          {/* funnel */}
          <mesh castShadow position={[0, 0.62, L * 0.16]}>
            <cylinderGeometry args={[0.07, 0.09, 0.22, 10]} />
            <meshStandardMaterial color="#31383f" roughness={0.6} />
          </mesh>
          {/* radar mast */}
          <mesh position={[0, 0.78, -L * 0.02]}>
            <cylinderGeometry args={[0.012, 0.012, 0.34, 6]} />
            <meshStandardMaterial color="#161a1f" />
          </mesh>
          {/* turrets fore/aft */}
          <Turret z={-L * 0.26} />
          {ship.size >= 4 && <Turret z={-L * 0.14} />}
          {ship.size >= 3 && (
            <group rotation-y={Math.PI}>
              <Turret z={-L * 0.3} />
            </group>
          )}
        </>
      )}
    </group>
  )
}

// A placed ship: positioned/rotated on my grid, bobbing; burns when hit, sinks when sunk.
function FleetShip({ ship, shotsOnMe, phase }: { ship: Ship; shotsOnMe: Record<string, ShotResult>; phase: number }) {
  const g = useRef<THREE.Group>(null)
  const sunkT = useRef(0)
  const cx = ship.cells.reduce((a, c) => a + c.x, 0) / ship.cells.length
  const cy = ship.cells.reduce((a, c) => a + c.y, 0) / ship.cells.length
  const px = wx(cx), pz = ownZ(cy)
  const rotY = ship.orientation === "H" ? Math.PI / 2 : 0

  useFrame(({ clock }, dt) => {
    if (!g.current) return
    if (ship.sunk) {
      sunkT.current = Math.min(1, sunkT.current + dt * 0.42)
      const k = sunkT.current
      const ease = k * k * (3 - 2 * k)                       // smoothstep
      // she rolls hard onto her side as she goes down…
      g.current.rotation.z = ease * 0.92
      // …bow heaves up mid-sink, then pitches under bow-first
      g.current.rotation.x = Math.sin(k * Math.PI) * 0.3 - ease * 0.55
      // settle, then accelerate down below the waves so she vanishes cleanly
      g.current.position.y = -Math.pow(k, 1.7) * 1.9
      // a dying shudder that fades out as she slips under
      g.current.position.x = Math.sin(clock.elapsedTime * 20) * (1 - k) * 0.035
    } else {
      const t = clock.elapsedTime
      g.current.position.y = Math.sin(t * 1.1 + phase) * 0.045
      g.current.rotation.z = Math.sin(t * 0.9 + phase * 2) * 0.02
      g.current.rotation.x = Math.sin(t * 0.7 + phase) * 0.012
    }
  })

  const hitCells = ship.cells.filter((c) => {
    const r = shotsOnMe[cellKey(c.x, c.y)]
    return r === "hit" || r === "sunk"
  })

  return (
    <group position={[px, 0, pz]}>
      <group ref={g} rotation-y={rotY}>
        <WarshipModel ship={ship} />
        {/* fires on damaged sections (local coords along ship axis) */}
        {hitCells.map((c) => {
          const off = (ship.orientation === "H" ? c.x - cx : c.y - cy) * CELL
          return <Fire key={cellKey(c.x, c.y)} position={[0, 0.35, off]} big={ship.sunk} />
        })}
      </group>
    </group>
  )
}

// ---- fire & smoke (persistent, cheap) ---------------------------------------------
function Fire({ position, big }: { position: [number, number, number]; big?: boolean }) {
  const flame = useRef<THREE.Mesh>(null)
  const inner = useRef<THREE.Mesh>(null)
  const smoke = useRef<THREE.Group>(null)
  const s = big ? 1.5 : 1
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flame.current) {
      const k = 1 + Math.sin(t * 11 + position[2] * 7) * 0.22
      flame.current.scale.set(k * s, (1.25 + Math.sin(t * 9) * 0.3) * s, k * s)
    }
    if (inner.current) {
      const k = 1 + Math.sin(t * 14 + 1.7) * 0.3
      inner.current.scale.set(k * s * 0.55, k * s * 0.8, k * s * 0.55)
    }
    if (smoke.current) {
      smoke.current.children.forEach((m, i) => {
        const cycle = (t * 0.55 + i * 0.33) % 1
        m.position.y = 0.25 + cycle * 1.6
        m.position.x = Math.sin(t + i * 2.1) * 0.08
        const ms = (0.14 + cycle * 0.3) * s
        m.scale.set(ms, ms, ms)
        ;(m as THREE.Mesh).material && (((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.38 * (1 - cycle))
      })
    }
  })
  return (
    <group position={position}>
      <mesh ref={flame}>
        <coneGeometry args={[0.14, 0.36, 7]} />
        <meshStandardMaterial color="#ff7a1a" emissive="#ff5f00" emissiveIntensity={2.2} transparent opacity={0.9} />
      </mesh>
      <mesh ref={inner} position={[0, 0.06, 0]}>
        <coneGeometry args={[0.1, 0.3, 6]} />
        <meshStandardMaterial color="#ffd23e" emissive="#ffb300" emissiveIntensity={3} transparent opacity={0.95} />
      </mesh>
      <pointLight color="#ff7a1a" intensity={big ? 3.2 : 1.6} distance={4} decay={2} />
      <group ref={smoke}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial color="#20242a" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---- transient effects --------------------------------------------------------------
type FxKind = "boom" | "splash" | "bigboom"
interface Fx { id: number; kind: FxKind; x: number; z: number }

// Explosion: particle burst + expanding shock ring + flash.
function Boom({ x, z, big }: { x: number; z: number; big?: boolean }) {
  const N = big ? 34 : 22
  const parts = useMemo(() =>
    Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2
      const v = 2.2 + ((i * 37) % 10) / 6
      return {
        vx: Math.cos(a) * v * (0.5 + ((i * 13) % 7) / 9),
        vy: 2.6 + ((i * 29) % 11) / 4,
        vz: Math.sin(a) * v * (0.5 + ((i * 17) % 5) / 7),
      }
    }), [N])
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const flash = useRef<THREE.PointLight>(null)
  const t = useRef(0)
  const s = big ? 1.6 : 1
  useFrame((_, dt) => {
    t.current += dt
    const tt = t.current
    if (group.current) {
      group.current.children.forEach((m, i) => {
        const p = parts[i]
        m.position.set(p.vx * tt * s, (p.vy * tt - 4.4 * tt * tt) * s, p.vz * tt * s)
        const sc = Math.max(0.001, (0.16 - tt * 0.075) * s)
        m.scale.set(sc, sc, sc)
        const mat = (m as THREE.Mesh).material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 1 - tt * 0.7)
      })
    }
    if (ring.current) {
      const rs = 0.3 + tt * (big ? 7 : 4.6)
      ring.current.scale.set(rs, rs, rs)
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = Math.max(0, 0.75 - tt * 0.75)
    }
    if (flash.current) flash.current.intensity = Math.max(0, (big ? 26 : 16) * (1 - tt * 1.8))
  })
  return (
    <group position={[x, 0.25, z]}>
      <group ref={group}>
        {parts.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? "#ffd23e" : i % 3 === 1 ? "#ff7a1a" : "#3a3f46"}
              emissive={i % 3 === 2 ? "#20242a" : "#ff6a00"} emissiveIntensity={i % 3 === 2 ? 0.2 : 2.4}
              transparent depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, -0.12, 0]}>
        <ringGeometry args={[0.9, 1.05, 40]} />
        <meshBasicMaterial color="#ffb35c" transparent opacity={0.75} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <pointLight ref={flash} color="#ffab4a" distance={14} decay={2} />
    </group>
  )
}

// Miss: column of spray + expanding ripples.
function Splash({ x, z }: { x: number; z: number }) {
  const N = 18
  const parts = useMemo(() =>
    Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2
      return { vx: Math.cos(a) * (0.5 + ((i * 11) % 5) / 8), vy: 3.4 + ((i * 23) % 9) / 5, vz: Math.sin(a) * (0.5 + ((i * 7) % 5) / 8) }
    }), [])
  const group = useRef<THREE.Group>(null)
  const rings = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    const tt = t.current
    if (group.current) {
      group.current.children.forEach((m, i) => {
        const p = parts[i]
        m.position.set(p.vx * tt, Math.max(0, p.vy * tt - 5.5 * tt * tt), p.vz * tt)
        const sc = Math.max(0.001, 0.11 - tt * 0.05)
        m.scale.set(sc, sc * 1.6, sc)
        ;((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = Math.max(0, 0.85 - tt * 0.6)
      })
    }
    if (rings.current) {
      rings.current.children.forEach((m, i) => {
        const rt = Math.max(0, tt - i * 0.18)
        const rs = 0.2 + rt * 3
        m.scale.set(rs, rs, rs)
        ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 - rt * 0.45)
      })
    }
  })
  return (
    <group position={[x, 0, z]}>
      <group ref={group}>
        {parts.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 6, 5]} />
            <meshStandardMaterial color="#cfe9f2" transparent opacity={0.85} depthWrite={false} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <group ref={rings}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} rotation-x={-Math.PI / 2} position={[0, 0.02 + i * 0.005, 0]}>
            <ringGeometry args={[0.85, 0.95, 36]} />
            <meshBasicMaterial color="#bfe6f5" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ---- missile ---------------------------------------------------------------------
function Missile({ flight, launchFrom, onArrive }: {
  flight: Flight
  launchFrom: { x: number; z: number }
  onArrive: () => void
}) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const done = useRef(false)
  const DUR = 0.9   // snappier arc so the shot doesn't feel like it hangs on impact
  const from = useMemo(() => new THREE.Vector3(launchFrom.x, 0.45, launchFrom.z), [launchFrom.x, launchFrom.z])
  const to = useMemo(() => new THREE.Vector3(
    wx(flight.targetX), 0.1,
    flight.incoming ? ownZ(flight.targetY) : enemyZ(flight.targetY),
  ), [flight])
  const mid = useMemo(() => new THREE.Vector3(
    (from.x + to.x) / 2, 7.5 + Math.abs(from.z - to.z) * 0.12, (from.z + to.z) / 2,
  ), [from, to])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(from, mid, to), [from, mid, to])
  // Preallocated hot-path vectors — this runs every frame of every shot.
  const tmpP = useMemo(() => new THREE.Vector3(), [])
  const tmpA = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, dt) => {
    if (!g.current || done.current) return
    t.current = Math.min(1, t.current + dt / DUR)
    curve.getPoint(t.current, tmpP)
    g.current.position.copy(tmpP)
    // finite-difference tangent (getTangent allocates internally)
    curve.getPoint(Math.min(1, t.current + 0.01), tmpA)
    if (tmpA.distanceToSquared(tmpP) > 1e-8) g.current.lookAt(tmpA)
    if (t.current >= 1 && !done.current) {
      done.current = true
      onArrive()
    }
  })

  return (
    <group>
      <Trail width={1.6} length={5} color="#ffb35c" attenuation={(w) => w * w}>
        <group ref={g} position={[from.x, from.y, from.z]}>
          {/* body */}
          <mesh rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.055, 0.055, 0.42, 8]} />
            <meshStandardMaterial color="#c9ced4" roughness={0.35} metalness={0.6} />
          </mesh>
          {/* nose */}
          <mesh position={[0, 0, 0.3]} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.055, 0.16, 8]} />
            <meshStandardMaterial color="#8a2f24" roughness={0.4} metalness={0.4} />
          </mesh>
          {/* exhaust glow */}
          <mesh position={[0, 0, -0.26]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshStandardMaterial color="#ffd23e" emissive="#ff9d00" emissiveIntensity={4} transparent opacity={0.9} />
          </mesh>
          <pointLight color="#ffab4a" intensity={5} distance={6} decay={2} />
        </group>
      </Trail>
    </group>
  )
}

// ---- grid layers ------------------------------------------------------------------
function GridLines({ own }: { own: boolean }) {
  const geo = useMemo(() => {
    const pts: number[] = []
    const z0 = own ? ownZ(0) - CELL / 2 : enemyZ(0) + CELL / 2
    const z1 = own ? ownZ(GRID - 1) + CELL / 2 : enemyZ(GRID - 1) - CELL / 2
    for (let i = 0; i <= GRID; i++) {
      const x = wx(0) - CELL / 2 + i * CELL
      pts.push(x, 0.02, z0, x, 0.02, z1)
    }
    for (let i = 0; i <= GRID; i++) {
      const z = own ? ownZ(0) - CELL / 2 + i * CELL : enemyZ(0) + CELL / 2 - i * CELL
      pts.push(wx(0) - CELL / 2, 0.02, z, wx(GRID - 1) + CELL / 2, 0.02, z)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [own])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color={own ? "#3f6a80" : "#7a4a3a"} transparent opacity={own ? 0.4 : 0.45} />
    </lineSegments>
  )
}

// Pulsing highlight material for interactive cells.
function PulseMat({ color = GOLD, opacity = 0.5 }: { color?: string; opacity?: number }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 0.6 + Math.sin(clock.elapsedTime * 3.4) * 0.35
  })
  return <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={0.6} transparent opacity={opacity} depthWrite={false} />
}

// Targeting reticle on the hovered enemy cell.
function Reticle({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 1.4
      const s = 1 + Math.sin(clock.elapsedTime * 5) * 0.07
      ref.current.scale.set(s, 1, s)
    }
  })
  return (
    <group ref={ref} position={[x, 0.06, z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.34, 0.4, 32]} />
        <meshBasicMaterial color="#ff5c4a" transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {[0, 90, 180, 270].map((a) => (
        <mesh key={a} rotation-y={(a * Math.PI) / 180} position={[0, 0, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.2]} />
          <meshBasicMaterial color="#ff5c4a" />
        </mesh>
      ))}
    </group>
  )
}

// Burning revealed wreck on the enemy grid (a sunk enemy ship).
function EnemyWreck({ ship }: { ship: Ship }) {
  const cx = ship.cells.reduce((a, c) => a + c.x, 0) / ship.cells.length
  const cy = ship.cells.reduce((a, c) => a + c.y, 0) / ship.cells.length
  const rotY = ship.orientation === "H" ? Math.PI / 2 : 0
  const L = ship.size * CELL * 0.9
  return (
    <group position={[wx(cx), -0.18, enemyZ(cy)]} rotation-y={rotY} rotation-z={0.42}>
      <mesh castShadow>
        <boxGeometry args={[CELL * 0.45, 0.28, L]} />
        <meshStandardMaterial color="#23272d" roughness={0.8} />
      </mesh>
      <Fire position={[0, 0.25, -L * 0.2]} big />
      <Fire position={[0, 0.22, L * 0.24]} />
    </group>
  )
}

// ---- scene ----------------------------------------------------------------------------
function Scene(props: NavalScene3DProps) {
  const { state, meIndex, isMyTurn, canFire, flight, onImpact, onFireCell, placing, previewCells, onHoverCell, onClickOwnCell } = props
  const me = state.players[meIndex]
  const opp = state.players[1 - meIndex]
  const p = usePointer()
  const cross = usePointer("crosshair")

  const [fx, setFx] = useState<Fx[]>([])
  const fxId = useRef(0)
  const shake = useRef(0)
  const [hoverTarget, setHoverTarget] = useState<{ x: number; y: number } | null>(null)

  // Whoosh the instant a shell leaves the deck; the impact boom / splash comes
  // from the result log so the two land in sequence — launch, then explosion.
  const firedRef = useRef<number | null>(null)
  useEffect(() => {
    if (flight && flight.id !== firedRef.current) { firedRef.current = flight.id; playSfx("whoosh") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.id])

  const spawnFx = (kind: FxKind, x: number, z: number) => {
    const id = ++fxId.current
    setFx((q) => [...q, { id, kind, x, z }])
    setTimeout(() => setFx((q) => q.filter((e) => e.id !== id)), kind === "splash" ? 1700 : 2100)
  }

  // Missile launch origin: one of my alive ships (outgoing) or offshore (incoming).
  const launchFrom = useMemo(() => {
    if (!flight) return { x: 0, z: 0 }
    if (flight.incoming) return { x: wx(flight.targetX) * 0.6, z: enemyZ(GRID - 2) - 3 }
    const alive = me.ships.filter((s) => !s.sunk && s.cells.length)
    const src = alive[(flight.id % Math.max(1, alive.length))] || me.ships[0]
    if (!src || !src.cells.length) return { x: 0, z: ownZ(4) }
    const c = src.cells[Math.floor(src.cells.length / 2)]
    return { x: wx(c.x), z: ownZ(c.y) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.id])

  const handleArrive = () => {
    if (!flight) return
    const tx = wx(flight.targetX)
    const tz = flight.incoming ? ownZ(flight.targetY) : enemyZ(flight.targetY)
    if (flight.result === "miss") {
      spawnFx("splash", tx, tz)
      shake.current = Math.max(shake.current, 0.25)
    } else {
      spawnFx(flight.result === "sunk" ? "bigboom" : "boom", tx, tz)
      shake.current = flight.result === "sunk" ? 1.6 : 1
    }
    onImpact(flight)
  }

  // my shots on the enemy grid → markers
  const myShots = Object.entries(me.shots).map(([k, r]) => {
    const [x, y] = k.split(",").map(Number)
    return { x, y, r }
  })
  // opponent misses on my grid → ripple markers (hits render as ship fires)
  const oppMisses = Object.entries(opp.shots).filter(([, r]) => r === "miss").map(([k]) => {
    const [x, y] = k.split(",").map(Number)
    return { x, y }
  })

  // Gentle world bob + impact shake — applied to the scene group, NOT the
  // camera (OrbitControls re-derives its orbit from camera.position every
  // frame, so camera offsets get absorbed and permanently drift the view).
  const bob = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!bob.current) return
    const t = clock.elapsedTime
    const k = shake.current
    bob.current.position.y = Math.sin(t * 0.5) * 0.02 + (k > 0.001 ? Math.sin(t * 83 + 1) * 0.07 * k : 0)
    bob.current.position.x = k > 0.001 ? Math.sin(t * 91) * 0.09 * k : 0
    if (k > 0.001) shake.current = k * 0.88
  })

  return (
    <>
      {/* dusk light rig — softened so the sea isn't blown out by two hotspots */}
      <ambientLight intensity={0.44} color="#c2d2e0" />
      <hemisphereLight args={["#9fb6cc", "#123244", 0.7]} />
      <directionalLight
        position={[-6, 14, -24]} intensity={1.05} color="#ffc49a" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={24} shadow-camera-bottom={-24}
        shadow-camera-near={1} shadow-camera-far={70}
      />
      <directionalLight position={[10, 10, 16]} intensity={0.32} color="#9fc0da" />

      <Ocean />
      <Horizon />

      <group ref={bob}>
        {/* grids */}
        <GridLines own />
        <GridLines own={false} />

        {/* enemy targeting cells */}
        {Array.from({ length: GRID }).map((_, y) =>
          Array.from({ length: GRID }).map((_, x) => {
            const k = cellKey(x, y)
            const r = me.shots[k]
            const clickable = canFire && !r && !flight
            if (!clickable) return null
            return (
              <mesh key={`t${k}`} position={[wx(x), 0.015, enemyZ(y)]} rotation-x={-Math.PI / 2}
                onClick={(e) => {
                  e.stopPropagation()
                  // this plane unmounts on fire, so its onPointerOut never runs
                  document.body.style.cursor = "auto"
                  setHoverTarget(null)
                  onFireCell(x, y)
                }}
                onPointerOver={(e) => { e.stopPropagation(); setHoverTarget({ x, y }); document.body.style.cursor = "crosshair" }}
                onPointerOut={() => { setHoverTarget(null); document.body.style.cursor = "auto" }}
              >
                <planeGeometry args={[CELL * 0.96, CELL * 0.96]} />
                <meshStandardMaterial color="#d66a32" emissive="#d66a32" emissiveIntensity={0.12} transparent opacity={0.1} depthWrite={false} />
              </mesh>
            )
          })
        )}
        {hoverTarget && canFire && !flight && !me.shots[cellKey(hoverTarget.x, hoverTarget.y)] && (
          <Reticle x={wx(hoverTarget.x)} z={enemyZ(hoverTarget.y)} />
        )}

        {/* my shot markers on enemy waters */}
        {myShots.map(({ x, y, r }) => {
          if (r === "miss") {
            return (
              <mesh key={`m${x},${y}`} position={[wx(x), 0.03, enemyZ(y)]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.16, 0.24, 20]} />
                <meshBasicMaterial color="#9fc6d8" transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            )
          }
          if (r === "hit") {
            return <Fire key={`h${x},${y}`} position={[wx(x), 0.12, enemyZ(y)]} />
          }
          return null // sunk cells render as the wreck below
        })}

        {/* revealed enemy wrecks */}
        {opp.ships.filter((s) => s.sunk).map((s) => <EnemyWreck key={s.id} ship={s} />)}

        {/* MY fleet */}
        {me.ships.filter((s) => s.cells.length > 0).map((s, i) => (
          <FleetShip key={s.id} ship={s} shotsOnMe={opp.shots} phase={i * 1.7} />
        ))}

        {/* opponent miss markers on my waters */}
        {oppMisses.map(({ x, y }) => (
          <mesh key={`om${x},${y}`} position={[wx(x), 0.03, ownZ(y)]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.16, 0.24, 20]} />
            <meshBasicMaterial color="#88a8b8" transparent opacity={0.4} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* placement: hover targets + ghost preview */}
        {placing && Array.from({ length: GRID }).map((_, y) =>
          Array.from({ length: GRID }).map((_, x) => (
            <mesh key={`p${x},${y}`} position={[wx(x), 0.015, ownZ(y)]} rotation-x={-Math.PI / 2}
              onClick={(e) => { e.stopPropagation(); onClickOwnCell(x, y) }}
              onPointerOver={(e) => { e.stopPropagation(); onHoverCell({ x, y }) }}
              onPointerOut={() => onHoverCell(null)}
              {...p}
            >
              <planeGeometry args={[CELL * 0.96, CELL * 0.96]} />
              <meshStandardMaterial color="#3f6a80" transparent opacity={0.12} depthWrite={false} />
            </mesh>
          ))
        )}
        {placing && previewCells && previewCells.cells.map((c) => (
          <group key={`g${c.x},${c.y}`}>
            {/* solid ghost hull so it's obvious exactly where the ship lands */}
            <mesh position={[wx(c.x), 0.2, ownZ(c.y)]}>
              <boxGeometry args={[CELL * 0.92, 0.4, CELL * 0.92]} />
              <PulseMat color={previewCells.ok ? "#35d07f" : "#e5484d"} opacity={0.7} />
            </mesh>
            {/* bright outline ring on the water for extra clarity */}
            <mesh position={[wx(c.x), 0.04, ownZ(c.y)]} rotation-x={-Math.PI / 2}>
              <ringGeometry args={[CELL * 0.34, CELL * 0.46, 4]} />
              <meshBasicMaterial color={previewCells.ok ? "#7dffbf" : "#ff9a9d"} transparent opacity={0.9} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}

        {/* transient effects */}
        {fx.map((e) =>
          e.kind === "splash"
            ? <Splash key={e.id} x={e.x} z={e.z} />
            : <Boom key={e.id} x={e.x} z={e.z} big={e.kind === "bigboom"} />
        )}

        {/* the missile in flight */}
        {flight && <Missile key={flight.id} flight={flight} launchFrom={launchFrom} onArrive={handleArrive} />}
      </group>

      {/* my-turn glow strip under the enemy grid */}
      {isMyTurn && !flight && (
        <mesh position={[0, 0.005, enemyZ(4.5)]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[GRID * CELL + 0.6, GRID * CELL + 0.6]} />
          <PulseMat color="#d66a32" opacity={0.07} />
        </mesh>
      )}

      <OrbitControls
        makeDefault enablePan minDistance={8} maxDistance={46} screenSpacePanning
        minPolarAngle={0.2} maxPolarAngle={1.52} target={[0, 0, -1]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function NavalScene3D(props: NavalScene3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
      camera={{ position: [0, 13, 18], fov: 46, near: 0.1, far: 240 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0a141d"]} />
      <fog attach="fog" args={["#0a141d", 46, 110]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.75} luminanceThreshold={0.6} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette eskil={false} offset={0.22} darkness={0.72} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
