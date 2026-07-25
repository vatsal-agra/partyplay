// Shared 3D "player mannequins" for the board games.
//
// A proper articulated artist's mannequin — ball-jointed shoulders, elbows,
// hips and knees, tapered limb segments, an egg head and a colour-tinted
// accent so you can tell seats apart.
//
// THE ENTRANCE: when a game opens, each player's figure WALKS IN from the
// darkness beyond their seat — a real stride (legs swinging, arms pumping,
// body bobbing), staggered player by player — arrives at its waiting chair,
// and lowers itself into the seat as its legs fold under the table. Standing
// figures walk up and settle into their idle stance instead. After that they
// live: breathing, weight-shifts, heads slowly scanning the table, and a
// lean-in whenever it's that player's turn.
//
// Perf: geometry and materials are created ONCE at module scope and shared by
// every limb of every figure (only the colour accent is per-player), so a
// six-seat table costs a handful of materials rather than ~150.
"use client"

import * as THREE from "three"
import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"

export interface MannequinPlayer {
  id: string
  name: string
  color?: string
  isBot?: boolean
  active?: boolean // highlight/lean-in for whoever's turn it is
}

const BODY = "#f0ece2"      // warm blank-mannequin white
const JOINT = "#ded8cb"     // slightly darker ball joints, like real lay figures

// ---- shared materials & geometry (created once, reused by every figure) ----
const bodyMat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.45, metalness: 0.04 })
const jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.42, metalness: 0.06 })

const ballGeo = new THREE.SphereGeometry(1, 12, 9)          // scaled per joint
const headGeo = new THREE.SphereGeometry(0.165, 18, 14)
const footGeo = new THREE.BoxGeometry(0.16, 0.07, 0.26)
const neckGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.12, 10)
const pelvisGeo = new THREE.CylinderGeometry(0.2, 0.24, 0.2, 12)
const chestGeo = new THREE.CylinderGeometry(0.27, 0.21, 0.4, 12)
const sashGeo = new THREE.CylinderGeometry(0.272, 0.255, 0.08, 12)
const baseGeo = new THREE.CylinderGeometry(0.42, 0.5, 0.06, 18)
// limb segments: thigh, shin, upper arm, forearm
const thighGeo = new THREE.CylinderGeometry(0.11, 0.088, 0.42, 10)
const shinGeo = new THREE.CylinderGeometry(0.086, 0.07, 0.4, 10)
const upperArmGeo = new THREE.CylinderGeometry(0.088, 0.072, 0.36, 10)
const foreArmGeo = new THREE.CylinderGeometry(0.07, 0.058, 0.32, 10)

// simple wooden chair for seated figures — waits empty until its owner arrives
const chairMat = new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 0.6, metalness: 0.08 })
const chairSeatGeo = new THREE.BoxGeometry(0.82, 0.09, 0.76)
const chairBackGeo = new THREE.BoxGeometry(0.82, 0.74, 0.09)
const chairLegGeo = new THREE.CylinderGeometry(0.05, 0.042, 0.74, 8)
const CHAIR_LEGS: [number, number][] = [[-0.31, 0.29], [0.31, 0.29], [-0.31, -0.35], [0.31, -0.35]]

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (v: number) => { const k = clamp01(v); return k * k * (3 - 2 * k) }

// entrance timing
const WALK_DUR = 1.9      // seconds spent striding in
const SIT_DUR = 0.6       // seconds lowering into the seat
const WALK_DIST = 4.3     // local units walked (scaled by the figure's scale)
const STAGGER = 0.65      // delay between successive players entering

// A ball joint centred on its group origin.
function Ball({ r }: { r: number }) {
  return <mesh geometry={ballGeo} material={jointMat} scale={r} castShadow />
}

function Figure({ name, color, index, isBot, active, showName = true, seated = false, entrance = "walk", walkLift = 0 }: {
  name: string; color: string; index: number; isBot?: boolean; active?: boolean
  showName?: boolean; seated?: boolean; entrance?: "walk" | "drop"; walkLift?: number
}) {
  const walker = useRef<THREE.Group>(null)   // carries the walk-in translation + idle sway
  const chest = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const foreL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const thighL = useRef<THREE.Group>(null)
  const thighR = useRef<THREE.Group>(null)
  const shinL = useRef<THREE.Group>(null)
  const shinR = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)

  // only the accent colour differs per player
  const tintMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: color || "#8a8a8a", roughness: 0.4, metalness: 0.26 }),
    [color],
  )

  // final leg pose the entrance blends into
  const thighEnd = seated ? -1.45 : 0
  const shinEnd = seated ? 1.45 : 0

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const seed = index * 1.7
    const W = walker.current
    if (!W) return

    if (born.current === null) born.current = t + index * (entrance === "walk" ? STAGGER : 0.18)
    const tau = t - born.current

    // not our cue yet — stay hidden (the empty chair waits at the table)
    if (tau <= 0) { W.visible = false; return }
    W.visible = true

    const setLegs = (tl: number, tr: number, sl: number, sr: number) => {
      if (thighL.current) thighL.current.rotation.x = tl
      if (thighR.current) thighR.current.rotation.x = tr
      if (shinL.current) shinL.current.rotation.x = sl
      if (shinR.current) shinR.current.rotation.x = sr
    }

    // ---------------- ENTRANCE: WALK IN FROM THE DARK ----------------
    if (entrance === "walk" && tau < WALK_DUR) {
      const p = smooth(tau / WALK_DUR)
      W.position.z = -WALK_DIST * (1 - p)
      W.position.y = walkLift + Math.abs(Math.sin(tau * 6.8)) * 0.05
      W.rotation.z = Math.sin(tau * 6.8) * 0.03            // hip roll
      W.rotation.y = 0
      W.scale.setScalar(1)
      const stride = Math.sin(tau * 6.8)
      // legs scissor, shins kick through on the back-swing
      setLegs(stride * 0.55, -stride * 0.55, Math.max(0, -stride) * 0.75, Math.max(0, stride) * 0.75)
      // arms pump opposite the legs
      if (armL.current) armL.current.rotation.x = -stride * 0.5
      if (armR.current) armR.current.rotation.x = stride * 0.5
      if (foreL.current) foreL.current.rotation.x = -0.35
      if (foreR.current) foreR.current.rotation.x = -0.35
      if (chest.current) { chest.current.rotation.x = 0.07; chest.current.scale.setScalar(1) }
      if (head.current) { head.current.rotation.y = Math.sin(tau * 1.4) * 0.12; head.current.rotation.x = 0.05 }
      return
    }

    // ---------------- ENTRANCE: LOWER INTO THE SEAT ----------------
    if (entrance === "walk" && tau < WALK_DUR + SIT_DUR) {
      const p = smooth((tau - WALK_DUR) / SIT_DUR)
      W.position.z = 0
      W.position.y = walkLift * (1 - p)                    // body descends onto the chair
      W.rotation.z = 0
      // legs fold from standing to the final pose as the body drops
      setLegs(thighEnd * p, thighEnd * p, shinEnd * p, shinEnd * p)
      if (armL.current) armL.current.rotation.x = -0.18 * p
      if (armR.current) armR.current.rotation.x = -0.18 * p
      if (foreL.current) foreL.current.rotation.x = -0.55 * p - 0.35 * (1 - p)
      if (foreR.current) foreR.current.rotation.x = -0.55 * p - 0.35 * (1 - p)
      if (chest.current) chest.current.rotation.x = 0.07 * (1 - p)
      return
    }

    // ---------------- ENTRANCE: DROP (legacy fallback) ----------------
    if (entrance === "drop") {
      const k = clamp01(tau / 0.7)
      const ease = 1 - Math.pow(1 - k, 3)
      W.scale.setScalar(ease * (1 + Math.sin(k * Math.PI) * 0.07))
      W.position.y = (1 - ease) * 0.8
      if (k < 1) { setLegs(thighEnd, thighEnd, shinEnd, shinEnd); return }
    }

    // ---------------- IDLE: ALIVE AT THE TABLE ----------------
    W.position.z = 0
    W.position.y = 0
    W.scale.setScalar(1)
    W.rotation.z = Math.sin(t * 0.7 + seed) * 0.022
    W.rotation.y = Math.sin(t * 0.33 + seed) * 0.05
    setLegs(thighEnd, thighEnd, shinEnd, shinEnd)

    if (chest.current) {
      const breath = Math.sin(t * 1.5 + seed) * 0.03
      chest.current.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5)
      chest.current.rotation.x = (active ? 0.16 : 0) + Math.sin(t * 0.6 + seed) * 0.035
    }
    if (head.current) {
      head.current.rotation.y = Math.sin(t * 0.45 + seed) * 0.45
      head.current.rotation.x = Math.sin(t * 0.7 + seed * 1.3) * 0.13
    }
    const swing = Math.sin(t * 0.9 + seed) * 0.1
    if (armL.current) armL.current.rotation.x = -0.18 + swing
    if (armR.current) armR.current.rotation.x = -0.18 - swing
    const fore = -0.55 + Math.sin(t * 0.9 + seed) * 0.08
    if (foreL.current) foreL.current.rotation.x = fore
    if (foreR.current) foreR.current.rotation.x = fore
  })

  return (
    <group>
      {/* the chair stays AT the seat, waiting empty until its owner walks in */}
      {seated && (
        <group>
          <mesh geometry={chairSeatGeo} material={chairMat} position={[0, 0.76, -0.04]} castShadow receiveShadow />
          <mesh geometry={chairBackGeo} material={chairMat} position={[0, 1.15, -0.41]} castShadow />
          {CHAIR_LEGS.map(([lx, lz], i) => (
            <mesh key={i} geometry={chairLegGeo} material={chairMat} position={[lx, 0.37, lz]} castShadow />
          ))}
        </group>
      )}

      {/* everything that walks */}
      <group ref={walker} visible={false}>
        {/* colour-tinted base disc (standing figures only) */}
        {!seated && <mesh geometry={baseGeo} material={tintMat} position={[0, 0.03, 0]} receiveShadow castShadow />}

        {/* ---- legs: hip ball → thigh → knee ball → shin → foot ---- */}
        {[-1, 1].map((side) => (
          <group key={`leg${side}`} position={[side * 0.15, 0.86, 0]}>
            <Ball r={0.105} />
            <group ref={side < 0 ? thighL : thighR} rotation-x={thighEnd}>
              <mesh geometry={thighGeo} material={bodyMat} position={[0, -0.21, 0]} castShadow />
              <group position={[0, -0.42, 0]} ref={side < 0 ? shinL : shinR} rotation-x={shinEnd}>
                <Ball r={0.088} />
                <mesh geometry={shinGeo} material={bodyMat} position={[0, -0.2, 0]} castShadow />
                <mesh geometry={footGeo} material={jointMat} position={[0, -0.44, 0.06]} castShadow />
              </group>
            </group>
          </group>
        ))}

        {/* ---- pelvis + waist ball ---- */}
        <mesh geometry={pelvisGeo} material={bodyMat} position={[0, 0.95, 0]} castShadow />
        <group position={[0, 1.06, 0]}><Ball r={0.115} /></group>

        {/* ---- chest (breathes / leans) ---- */}
        <group ref={chest} position={[0, 1.08, 0]}>
          <mesh geometry={chestGeo} material={bodyMat} position={[0, 0.2, 0]} castShadow />
          {/* colour sash so seats read at a glance */}
          <mesh geometry={sashGeo} material={tintMat} position={[0, 0.3, 0]} castShadow />

          {/* ---- arms: shoulder ball → upper arm → elbow ball → forearm → hand ---- */}
          {[-1, 1].map((side) => (
            <group key={`arm${side}`} position={[side * 0.28, 0.34, 0]}>
              <Ball r={0.1} />
              <group ref={side < 0 ? armL : armR} rotation-z={side * 0.08}>
                <mesh geometry={upperArmGeo} material={bodyMat} position={[0, -0.18, 0]} castShadow />
                <group position={[0, -0.36, 0]}>
                  <Ball r={0.075} />
                  <group ref={side < 0 ? foreL : foreR}>
                    <mesh geometry={foreArmGeo} material={bodyMat} position={[0, -0.16, 0]} castShadow />
                    <group position={[0, -0.35, 0]}><Ball r={0.072} /></group>
                  </group>
                </group>
              </group>
            </group>
          ))}

          {/* ---- neck + head ---- */}
          <group position={[0, 0.44, 0]}>
            <mesh geometry={neckGeo} material={jointMat} castShadow />
            <group ref={head} position={[0, 0.2, 0]}>
              {/* egg head — sphere stretched slightly on Y, no face */}
              <mesh geometry={headGeo} material={bodyMat} scale={[1, 1.18, 0.94]} castShadow />
            </group>
          </group>
        </group>

        {/* name plate */}
        {showName && (
          <Html position={[0, 2.16, 0]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
            <div style={{
              whiteSpace: "nowrap",
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.3,
              padding: "2px 9px",
              borderRadius: 999,
              color: "#fff",
              background: active ? "rgba(230,180,90,0.92)" : "rgba(0,0,0,0.6)",
              border: `1px solid ${active ? "#fff3d6" : "rgba(255,255,255,0.18)"}`,
              boxShadow: active ? "0 0 14px rgba(230,180,90,0.7)" : "0 2px 8px rgba(0,0,0,0.6)",
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}>
              {name}{isBot ? " 🤖" : ""}
            </div>
          </Html>
        )}
      </group>
    </group>
  )
}

// A single figure, for scenes (like the poker ellipse) that place seats
// themselves. Caller positions/rotates the wrapping group.
export function Mannequin({ name, color, isBot, active, index = 0, showName = true, seated = false, entrance = "walk", walkLift = 0 }: {
  name: string; color?: string; isBot?: boolean; active?: boolean; index?: number
  showName?: boolean; seated?: boolean; entrance?: "walk" | "drop"; walkLift?: number
}) {
  return (
    <Figure
      name={name} color={color || "#8a8a8a"} index={index} isBot={isBot} active={active}
      showName={showName} seated={seated} entrance={entrance} walkLift={walkLift}
    />
  )
}

export interface MannequinsProps {
  players: MannequinPlayer[]
  radius?: number    // distance from board centre
  y?: number         // vertical placement (table height)
  scale?: number     // overall figure scale
  startAngle?: number // where seat 0 sits, radians (default: near camera / front)
  center?: [number, number, number]
  seated?: boolean   // sit them at the table instead of standing behind it
  entrance?: "walk" | "drop"
  walkLift?: number  // how high (local units) the walk happens above the seat origin
}

export function Mannequins({
  players, radius = 6, y = 0, scale = 1, startAngle = Math.PI / 2, center = [0, 0, 0],
  seated = false, entrance = "walk", walkLift = 0,
}: MannequinsProps) {
  const n = Math.max(1, players.length)
  return (
    <>
      {players.map((p, i) => {
        const angle = startAngle + (i / n) * Math.PI * 2
        const x = center[0] + Math.cos(angle) * radius
        const z = center[2] + Math.sin(angle) * radius
        const rotY = Math.atan2(center[0] - x, center[2] - z) // face the centre
        return (
          <group key={p.id} position={[x, y, z]} rotation-y={rotY} scale={scale}>
            <Figure
              name={p.name} color={p.color || "#8a8a8a"} index={i} isBot={p.isBot} active={p.active}
              seated={seated} entrance={entrance} walkLift={walkLift}
            />
          </group>
        )
      })}
    </>
  )
}
