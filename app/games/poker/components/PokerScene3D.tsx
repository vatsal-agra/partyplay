// Poker — real-time 3D table (Three.js / React Three Fiber).
//
// A casino night: oval felt table with a wood rail under warm spotlights,
// seats arranged in turn order, chip stacks that match each player's stack,
// hole cards dealt to every seat (yours readable, theirs face-down until the
// showdown flip), community cards that rise and flip in as they're dealt, and
// a pot that physically slides to the winner. Pure display — every action
// flows through the DOM controls in PokerBoard.
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import {
  PokerState, Card, rankLabel, suitSymbol,
} from "../lib/pokerEngine"
import { Mannequin } from "@/components/three/Mannequins"

const SERIF = "var(--font-display), Georgia, serif"

// table ellipse
const TA = 6.3   // x radius
const TB = 4.1   // z radius

// per-seat identity colours for the seated mannequins
const SEAT_COLORS = ["#d9453a", "#3558c9", "#3fa356", "#e8c53a", "#e05a9e", "#57b8e8", "#ef8b33", "#7a86c9"]

// ---- card textures (module-level cache; bounded at 52 + back) -------------------
const texCache = new Map<string, THREE.CanvasTexture>()

function pokerFaceTexture(card: Card): THREE.CanvasTexture {
  const key = `f${card.id}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256; c.height = 372
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#f7f5ee"
  ctx.fillRect(0, 0, 256, 372)
  ctx.strokeStyle = "#c9c4b4"; ctx.lineWidth = 6
  ctx.strokeRect(4, 4, 248, 364)
  const red = card.suit === "H" || card.suit === "D"
  ctx.fillStyle = red ? "#c22b2b" : "#1d232b"
  const r = rankLabel(card.rank), s = suitSymbol(card.suit)
  ctx.textAlign = "center"
  ctx.font = "900 64px Georgia, serif"
  ctx.fillText(r, 44, 74)
  ctx.font = "52px serif"
  ctx.fillText(s, 44, 126)
  ctx.font = "150px serif"
  ctx.fillText(s, 128, 240)
  ctx.save()
  ctx.translate(212, 298); ctx.rotate(Math.PI)
  ctx.font = "900 64px Georgia, serif"
  ctx.fillText(r, 0, 0)
  ctx.font = "52px serif"
  ctx.fillText(s, 0, 52)
  ctx.restore()
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}

function pokerBackTexture(): THREE.CanvasTexture {
  const hit = texCache.get("back")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256; c.height = 372
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#5c1f24"
  ctx.fillRect(0, 0, 256, 372)
  ctx.strokeStyle = "#e8d9b8"; ctx.lineWidth = 8
  ctx.strokeRect(10, 10, 236, 352)
  ctx.strokeStyle = "rgba(232,217,184,0.35)"; ctx.lineWidth = 2
  for (let i = -12; i < 14; i++) {
    ctx.beginPath(); ctx.moveTo(i * 24, 0); ctx.lineTo(i * 24 + 180, 372); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(i * 24 + 180, 0); ctx.lineTo(i * 24, 372); ctx.stroke()
  }
  ctx.fillStyle = "#e8d9b8"
  ctx.font = "900 54px Georgia, serif"
  ctx.textAlign = "center"
  ctx.fillText("♠", 128, 206)
  const t = new THREE.CanvasTexture(c)
  texCache.set("back", t)
  return t
}

function feltTexture(): THREE.CanvasTexture {
  const hit = texCache.get("felt")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#1e5c40"
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 3800; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.035)`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  texCache.set("felt", t)
  return t
}

// ---- 3D card ---------------------------------------------------------------------
const CARD_W = 0.72, CARD_H = 1.05, CARD_T = 0.014

function Card3D({ card, faceUp, concealed, ...props }: { card?: Card; faceUp: boolean; concealed?: boolean } & JSX.IntrinsicElements["group"]) {
  const mats = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: "#e8e4d8", roughness: 0.7 })
    const back = new THREE.MeshStandardMaterial({ map: pokerBackTexture(), roughness: 0.55 })
    // Concealed cards (opponents' hole cards) show the BACK on both faces, so
    // orbiting the table can never expose a rival's hand until the showdown.
    const face = concealed
      ? back
      : card
        ? new THREE.MeshStandardMaterial({ map: pokerFaceTexture(card), roughness: 0.55 })
        : new THREE.MeshStandardMaterial({ color: "#f7f5ee", roughness: 0.55 })
    return [edge, edge, edge, edge, face, back]
  }, [card?.id, concealed])
  return (
    <group {...props}>
      <mesh material={mats} castShadow rotation-y={faceUp ? 0 : Math.PI}>
        <boxGeometry args={[CARD_W, CARD_H, CARD_T]} />
      </mesh>
    </group>
  )
}

// Community card: rises from the deck spot and flips face-up on mount.
// Rests at y=0.17 — the felt surface is at ~0.15, so anything lower is
// swallowed by the table.
const FELT_Y = 0.17

function CommunityCard({ card, slot }: { card: Card; slot: number }) {
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const targetX = (slot - 2) * 1.18   // wider spread so the board reads clearly
  useFrame((_, dt) => {
    if (!g.current) return
    t.current = Math.min(1, t.current + dt * 2.2)
    const k = t.current
    const e = 1 - Math.pow(1 - k, 3) // ease-out
    g.current.position.set(
      -3.4 + (targetX + 3.4) * e,
      FELT_Y + Math.sin(e * Math.PI) * 0.9,
      -0.35,
    )
    g.current.rotation.x = -Math.PI / 2
    g.current.rotation.y = Math.PI * (1 - e)   // flip during the slide
  })
  return (
    <group ref={g} position={[-3.4, FELT_Y, -0.35]} rotation-x={-Math.PI / 2}>
      <Card3D card={card} faceUp scale={1.4} />
    </group>
  )
}

// Hole card at a seat. Opponents hold their cards upright (like a real hand) —
// we see the backs until they flip toward us at showdown.
function HoleCard({ card, mine, revealed, seatAngle, offset }: {
  card?: Card; mine: boolean; revealed: boolean; seatAngle: number; offset: number
}) {
  const flip = useRef(0)
  const inner = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!inner.current) return
    const target = revealed ? 1 : 0
    flip.current += (target - flip.current) * Math.min(1, dt * 5)
    // 0 = back faces the camera (held toward the player), PI = face turned to us
    inner.current.rotation.y = Math.PI * flip.current
    inner.current.position.z = Math.sin(flip.current * Math.PI) * 0.12
  })

  if (mine) {
    // my cards: laid toward the camera, big and readable
    return (
      <group position={[offset * 1.35, 0.62, TB - 0.35]} rotation-x={-0.55} rotation-z={-offset * 0.12}>
        <Card3D card={card} faceUp scale={1.35} />
      </group>
    )
  }

  // Opponent: a small standing fan just inside their seat, faces angled toward
  // the player (so the back shows to the table) until the showdown flip.
  const bx = Math.cos(seatAngle) * (TA - 1.15)
  const bz = Math.sin(seatAngle) * (TB - 0.72)
  const faceOut = Math.PI / 2 - seatAngle   // card front (+z) points out toward the seat
  return (
    <group position={[bx, FELT_Y + 0.52, bz]} rotation-y={faceOut}>
      <group position={[offset * 0.34, 0, 0]} rotation-z={-offset * 0.5} rotation-x={0.34}>
        <group ref={inner}>
          <Card3D card={card} faceUp concealed={!revealed} scale={0.86} />
        </group>
      </group>
    </group>
  )
}

// ---- chips -----------------------------------------------------------------------
const CHIP_DENOMS: { v: number; color: string; stripe: string }[] = [
  { v: 500, color: "#6b3fa0", stripe: "#d9c6f2" },
  { v: 100, color: "#23272e", stripe: "#e8e4d8" },
  { v: 25, color: "#1e6b45", stripe: "#bfe8d2" },
  { v: 5, color: "#a83232", stripe: "#f2caca" },
  { v: 1, color: "#d8d4c8", stripe: "#8a8578" },
]

function ChipStack({ amount, compact }: { amount: number; compact?: boolean }) {
  const stacks = useMemo(() => {
    const out: { color: string; stripe: string; count: number }[] = []
    let rest = amount
    for (const d of CHIP_DENOMS) {
      const n = Math.floor(rest / d.v)
      if (n > 0) { out.push({ color: d.color, stripe: d.stripe, count: Math.min(n, compact ? 5 : 9) }); rest -= n * d.v }
    }
    return out.slice(0, compact ? 2 : 4)
  }, [amount, compact])
  return (
    <group>
      {stacks.map((s, si) => (
        <group key={si} position={[si * 0.56 - (stacks.length - 1) * 0.28, 0, 0]}>
          {Array.from({ length: s.count }).map((_, i) => (
            <group key={i} position={[0, 0.036 + i * 0.072, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.24, 0.24, 0.066, 20]} />
                <meshStandardMaterial color={s.color} roughness={0.4} metalness={0.1} />
              </mesh>
              <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.12, 0.2, 20]} />
                <meshStandardMaterial color={s.stripe} roughness={0.5} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

// Pot pile: slides to the winner seat when the hand ends.
// Pot rests BEHIND the community cards (toward the far rail) so it never sits
// on top of the board from the player's camera, then slides to the winner.
const POT_Z = -2.65
function PotPile({ amount, winnerAngle }: { amount: number; winnerAngle: number | null }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (!g.current) return
    const tx = winnerAngle === null ? 0 : Math.cos(winnerAngle) * (TA - 2.2)
    const tz = winnerAngle === null ? POT_Z : Math.sin(winnerAngle) * (TB - 1.5)
    const k = Math.min(1, dt * 3.5)
    g.current.position.x += (tx - g.current.position.x) * k
    g.current.position.z += (tz - g.current.position.z) * k
  })
  if (amount <= 0) return null
  return (
    <group ref={g} position={[0, FELT_Y - 0.02, POT_Z]}>
      <ChipStack amount={amount} />
    </group>
  )
}

// ---- scene --------------------------------------------------------------------------
export interface PokerScene3DProps {
  state: PokerState
  meIndex: number
  isSpectator: boolean
  reveal: boolean
}

function Scene({ state, meIndex, isSpectator, reveal }: PokerScene3DProps) {
  const felt = useMemo(feltTexture, [])
  const n = state.players.length
  const inBetting = ["PREFLOP", "FLOP", "TURN", "RIVER"].includes(state.stage)

  // Seats in turn order around the ellipse; my seat faces the camera.
  const seatAngle = (idx: number) => {
    const rel = ((idx - meIndex) % n + n) % n
    return Math.PI / 2 + (rel / n) * Math.PI * 2
  }

  const winnerAngle = state.stage === "HAND_OVER" && state.winnerIds.length
    ? seatAngle(state.players.findIndex((p) => p.id === state.winnerIds[0]))
    : null

  const spot = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (spot.current) {
      const m = spot.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 3.2) * 0.35
    }
  })

  return (
    <>
      {/* casino night lighting */}
      <ambientLight intensity={0.32} color="#ffe9cf" />
      <hemisphereLight args={["#8a7a5e", "#0c0a08", 0.4]} />
      <spotLight position={[0, 12, 0]} angle={0.75} penumbra={0.55} intensity={260} color="#ffe2b0" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <pointLight position={[-8, 5, 6]} intensity={18} color="#ff9d5c" distance={24} decay={2} />
      <pointLight position={[8, 5, -6]} intensity={14} color="#ffd9a0" distance={24} decay={2} />

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#14100c" roughness={0.9} />
      </mesh>

      {/* table: felt + wood rail */}
      <group scale={[TA / 5, 1, TB / 5]}>
        <mesh position={[0, -0.11, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[5.55, 5.75, 0.5, 48]} />
          <meshStandardMaterial color="#3a2716" roughness={0.55} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[5.05, 5.05, 0.26, 48]} />
          <meshStandardMaterial map={felt} color="#2a7a52" roughness={0.9} />
        </mesh>
        {/* inner betting line */}
        <mesh position={[0, 0.155, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[3.3, 3.38, 48]} />
          <meshStandardMaterial color="#e8d9b8" transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* pedestal */}
      <mesh position={[0, -0.75, 0]} castShadow>
        <cylinderGeometry args={[1.6, 2.2, 0.9, 24]} />
        <meshStandardMaterial color="#241a10" roughness={0.7} />
      </mesh>

      {/* community cards */}
      {state.community.map((c, i) => <CommunityCard key={c.id} card={c} slot={i} />)}

      {/* pot */}
      <PotPile amount={state.pot} winnerAngle={winnerAngle} />

      {/* seats */}
      {state.players.map((p, idx) => {
        const ang = seatAngle(idx)
        const mine = idx === meIndex && !isSpectator
        const sx = Math.cos(ang) * (TA - 0.6)
        const sz = Math.sin(ang) * (TB - 0.35)
        const isCur = inBetting && idx === state.currentPlayerIndex
        const isWinner = state.stage === "HAND_OVER" && state.winnerIds.includes(p.id)
        const showCards = p.hole.length > 0 && !p.busted
        const revealThem = mine ? true : (reveal && !p.folded)
        return (
          <group key={p.id}>
            {/* acting spotlight ring */}
            {isCur && (
              <mesh ref={spot} position={[Math.cos(ang) * (TA - 1.6), 0.17, Math.sin(ang) * (TB - 1.1)]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.85, 0.98, 36]} />
                <meshStandardMaterial color="#e6b45a" emissive="#e6b45a" emissiveIntensity={0.9} transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
            )}
            {isWinner && <pointLight position={[sx, 1.4, sz]} intensity={9} color="#ffd76a" distance={5} decay={2} />}

            {/* hole cards */}
            {showCards && !p.folded && p.hole.map((c, k) => (
              <HoleCard key={c.id} card={c} mine={mine}
                revealed={revealThem} seatAngle={ang} offset={k === 0 ? -0.42 : 0.42} />
            ))}

            {/* seated player figure — opponents only (I'm the camera at my seat) */}
            {!mine && (
              <group
                position={[Math.cos(ang) * (TA + 0.55), -1.05, Math.sin(ang) * (TB + 0.5)]}
                rotation-y={Math.atan2(-Math.cos(ang), -Math.sin(ang))}
                scale={1.25}
              >
                <Mannequin name={p.name} color={SEAT_COLORS[idx % SEAT_COLORS.length]} isBot={p.isBot} active={isCur} index={idx} showName={false} seated />
              </group>
            )}

            {/* chip stack (player's bank) — my own bank sits to my right so it's
                not hidden behind my hole cards; opponents' by their seat. */}
            {p.chips > 0 && (
              <group position={mine
                ? [2.5, 0.16, TB - 0.1]
                : [Math.cos(ang) * (TA - 0.95), 0.16, Math.sin(ang) * (TB - 0.62)]}>
                <ChipStack amount={p.chips} compact />
              </group>
            )}

            {/* current-round bet chips */}
            {p.bet > 0 && (
              <group position={[Math.cos(ang) * (TA - 2.7), 0.16, Math.sin(ang) * (TB - 1.85)]}>
                <ChipStack amount={p.bet} compact />
              </group>
            )}

            {/* dealer button */}
            {idx === state.dealerIndex && (
              <mesh position={[Math.cos(ang + 0.35) * (TA - 1.5), 0.2, Math.sin(ang + 0.35) * (TB - 1.0)]} castShadow>
                <cylinderGeometry args={[0.2, 0.2, 0.07, 20]} />
                <meshStandardMaterial color="#f2efe4" roughness={0.4} />
              </mesh>
            )}

            {/* seat plate */}
            <Html position={[sx * 1.12, mine ? 0.4 : 1.05, sz * 1.12]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
              <div style={{
                textAlign: "center", whiteSpace: "nowrap", opacity: p.folded || p.busted ? 0.45 : 1,
                background: isCur ? "rgba(230,180,90,0.16)" : "rgba(0,0,0,0.55)",
                border: `1px solid ${isWinner ? "#e6b45a" : isCur ? "rgba(230,180,90,0.6)" : "rgba(255,255,255,0.14)"}`,
                borderRadius: 10, padding: "4px 10px", backdropFilter: "blur(3px)",
              }}>
                <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 13, color: "#fff" }}>
                  {p.name}{p.isBot ? " 🤖" : ""}{isWinner ? " 👑" : ""}
                  {idx === state.dealerIndex && <span style={{ marginLeft: 5, background: "#f2efe4", color: "#1a120a", borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 900 }}>D</span>}
                  {idx === state.smallBlindIndex && <span style={{ marginLeft: 4, background: "#3558c9", color: "#fff", borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 900 }}>SB</span>}
                  {idx === state.bigBlindIndex && <span style={{ marginLeft: 4, background: "#d9453a", color: "#fff", borderRadius: 4, padding: "0 4px", fontSize: 9, fontWeight: 900 }}>BB</span>}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e6b45a" }}>
                  {p.busted ? "BUSTED" : `🪙 ${p.chips.toLocaleString()}`}
                  {p.bet > 0 && <span style={{ color: "#7fd6a8" }}> · bet {p.bet}</span>}
                  {p.allIn && !p.busted && <span style={{ color: "#ff7a6a" }}> · ALL-IN</span>}
                  {p.folded && !p.busted && <span style={{ color: "#8a8578" }}> · folded</span>}
                </div>
              </div>
            </Html>
          </group>
        )
      })}

      {/* pot label — sits above the pot pile at the far rail, clear of the board */}
      {state.pot > 0 && (
        <Html position={[0, 0.95, POT_Z]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
          <div style={{
            fontFamily: "monospace", fontWeight: 900, fontSize: 13, color: "#e6b45a",
            background: "rgba(0,0,0,0.62)", border: "1px solid rgba(230,180,90,0.4)",
            borderRadius: 99, padding: "3px 12px", whiteSpace: "nowrap",
          }}>
            POT {state.pot.toLocaleString()}
          </div>
        </Html>
      )}

      <OrbitControls
        makeDefault enablePan={false} minDistance={6} maxDistance={22}
        minPolarAngle={0.25} maxPolarAngle={1.25} target={[0, 0, 0]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function PokerScene3D(props: PokerScene3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [0, 7.2, 9.2], fov: 46, near: 0.1, far: 120 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0e0a08"]} />
      <fog attach="fog" args={["#0e0a08", 24, 55]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.5} luminanceThreshold={0.7} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette eskil={false} offset={0.26} darkness={0.78} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
