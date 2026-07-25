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
import { RoomBox } from "@/components/three/RoomBox"

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
  // negative start = stagger: the flop cascades card by card instead of
  // slapping down all three at once; turn/river get a dramatic beat too
  const t = useRef(-slot * 0.18)
  const targetX = (slot - 2) * 1.18   // wider spread so the board reads clearly
  useFrame((_, dt) => {
    if (!g.current) return
    t.current = Math.min(1, t.current + dt * 2.2)
    if (t.current <= 0) { g.current.visible = false; return }
    g.current.visible = true
    const k = Math.max(0, t.current)
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
    <group ref={g} visible={false} position={[-3.4, FELT_Y, -0.35]} rotation-x={-Math.PI / 2}>
      <Card3D card={card} faceUp scale={1.4} />
    </group>
  )
}

// Hole card at a seat. Every new hand the cards are DEALT — each one flies
// spinning from the dealer's spot at the table centre to its seat, in true
// dealing order (one lap around the table, then a second). Opponents hold
// theirs upright; we see the backs until they flip toward us at showdown.
function HoleCard({ card, mine, revealed, seatAngle, offset, dealDelay = 0 }: {
  card?: Card; mine: boolean; revealed: boolean; seatAngle: number; offset: number; dealDelay?: number
}) {
  const flip = useRef(0)
  const inner = useRef<THREE.Group>(null)
  const fly = useRef<THREE.Group>(null)
  const dealT = useRef(-dealDelay)

  const finalPos = useMemo<[number, number, number]>(() => (
    mine
      ? [offset * 1.35, 0.62, TB - 0.35]
      : [Math.cos(seatAngle) * (TA - 1.15), FELT_Y + 0.52, Math.sin(seatAngle) * (TB - 0.72)]
  ), [mine, seatAngle, offset])

  useFrame((_, dt) => {
    // deal-in flight from the table centre, spinning as it goes
    if (fly.current) {
      dealT.current = Math.min(1, dealT.current + dt * 2.6)
      if (dealT.current <= 0) {
        fly.current.visible = false
      } else {
        fly.current.visible = true
        const e = 1 - Math.pow(1 - Math.max(0, dealT.current), 3)
        fly.current.position.set(
          finalPos[0] * e,
          (FELT_Y + 0.45) + (finalPos[1] - (FELT_Y + 0.45)) * e + Math.sin(e * Math.PI) * 0.55,
          -0.35 + (finalPos[2] + 0.35) * e,
        )
        fly.current.rotation.y = (1 - e) * Math.PI * 3
      }
    }
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
      <group ref={fly} visible={false} position={[0, FELT_Y + 0.45, -0.35]}>
        <group rotation-x={-0.55} rotation-z={-offset * 0.12}>
          <Card3D card={card} faceUp scale={1.35} />
        </group>
      </group>
    )
  }

  // Opponent: a small standing fan just inside their seat, faces angled toward
  // the player (so the back shows to the table) until the showdown flip.
  const faceOut = Math.PI / 2 - seatAngle   // card front (+z) points out toward the seat
  return (
    <group ref={fly} visible={false} position={[0, FELT_Y + 0.45, -0.35]}>
      <group rotation-y={faceOut}>
        <group position={[offset * 0.34, 0, 0]} rotation-z={-offset * 0.5} rotation-x={0.34}>
          <group ref={inner}>
            <Card3D card={card} faceUp concealed={!revealed} scale={0.86} />
          </group>
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

// `wager` renders a small pile pushed forward (a bet), `compact` a seat bank,
// neither a big centre pile. A bet is deliberately fewer, smaller chips so it
// never reads as a duplicate of the stack it came from.
function ChipStack({ amount, compact, wager }: { amount: number; compact?: boolean; wager?: boolean }) {
  const stacks = useMemo(() => {
    const out: { color: string; stripe: string; count: number }[] = []
    let rest = amount
    const maxPer = wager ? 3 : compact ? 4 : 8
    for (const d of CHIP_DENOMS) {
      const n = Math.floor(rest / d.v)
      if (n > 0) { out.push({ color: d.color, stripe: d.stripe, count: Math.min(n, maxPer) }); rest -= n * d.v }
    }
    return out.slice(0, wager ? 2 : compact ? 4 : 5)
  }, [amount, compact, wager])
  // satisfying pop whenever the amount changes — chips land, don't just morph
  const wrap = useRef<THREE.Group>(null)
  const prevAmt = useRef(amount)
  const pop = useRef(0)
  if (prevAmt.current !== amount) { prevAmt.current = amount; pop.current = 1 }
  useFrame((_, dt) => {
    if (!wrap.current) return
    pop.current = Math.max(0, pop.current - dt * 3.2)
    const s = 1 + Math.sin(pop.current * Math.PI) * 0.3
    wrap.current.scale.set(s, 1 + Math.sin(pop.current * Math.PI) * 0.45, s)
  })
  return (
    <group ref={wrap}>
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
const POT_Z = -1.45
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

// Rising golden sparkles over a winning seat while the hand result shows.
const sparkGeo = new THREE.SphereGeometry(1, 6, 5)
const sparkMat = new THREE.MeshStandardMaterial({
  color: "#ffd76a", emissive: "#ffb62e", emissiveIntensity: 2.6,
  transparent: true, opacity: 0.95, depthWrite: false,
})

function WinnerBurst({ x, z }: { x: number; z: number }) {
  const g = useRef<THREE.Group>(null)
  const parts = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2 + (i % 3) * 0.4,
      r: 0.35 + ((i * 29) % 10) / 16,
      speed: 0.5 + ((i * 13) % 7) / 11,
      ph: ((i * 37) % 10) / 10,
    })), [])
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.elapsedTime
    g.current.children.forEach((m, i) => {
      const p = parts[i]
      const k = (t * p.speed + p.ph) % 1
      m.position.set(Math.cos(p.a + k * 2) * p.r, 0.2 + k * 2.1, Math.sin(p.a + k * 2) * p.r)
      const s = Math.max(0.001, 0.085 * (1 - k))
      m.scale.set(s, s, s)
    })
  })
  return (
    <group position={[x, FELT_Y, z]}>
      <group ref={g}>
        {parts.map((_, i) => <mesh key={i} geometry={sparkGeo} material={sparkMat} />)}
      </group>
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

      {/* the card room itself, instead of a black void */}
      {/* wider than OrbitControls' maxDistance (22) so the camera stays inside */}
      <RoomBox size={54} height={20} y={-1.2} floor="#17120d" glow="#ffca85" />

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
            {/* winner glow is sparkles, NOT a mounted pointLight — adding or
                removing a light recompiles every shader (visible hitch) */}
            {isWinner && <WinnerBurst x={Math.cos(ang) * (TA - 1.6)} z={Math.sin(ang) * (TB - 1.1)} />}

            {/* hole cards — dealt in true order: one lap, then the second */}
            {showCards && !p.folded && p.hole.map((c, k) => (
              <HoleCard key={c.id} card={c} mine={mine}
                revealed={revealThem} seatAngle={ang} offset={k === 0 ? -0.42 : 0.42}
                dealDelay={(((idx - state.dealerIndex - 1 + n) % n) + k * n) * 0.13} />
            ))}

            {/* seated player figure — opponents only (I'm the camera at my seat) */}
            {!mine && (
              <group
                position={[Math.cos(ang) * (TA + 1.9), -2.85, Math.sin(ang) * (TB + 1.9)]}
                rotation-y={Math.atan2(-Math.cos(ang), -Math.sin(ang))}
                scale={2.45}
              >
                <Mannequin name={p.name} color={SEAT_COLORS[idx % SEAT_COLORS.length]} isBot={p.isBot} active={isCur} index={idx} showName={false} seated walkLift={0.67} />
              </group>
            )}

            {/* chip stack (player's bank) — my own bank sits to my right so it's
                not hidden behind my hole cards; opponents' by their seat. */}
            {p.chips > 0 && (
              <group position={mine
                ? [2.6, 0.16, TB - 0.1]
                : [
                    Math.cos(ang) * (TA - 1.5) - Math.sin(ang) * 1.5,
                    0.16,
                    Math.sin(ang) * (TB - 1.05) + Math.cos(ang) * 1.5,
                  ]}>
                <ChipStack amount={p.chips} compact />
              </group>
            )}

            {/* current-round bet — a small pile pushed toward the pot, visibly
                lighter than the seat's bank so the two never look duplicated */}
            {p.bet > 0 && (
              <group position={[Math.cos(ang) * (TA - 2.9), 0.16, Math.sin(ang) * (TB - 1.95)]} scale={0.82}>
                <ChipStack amount={p.bet} wager />
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
            {/* Seat plates float above each opponent's mannequin. MY OWN plate
                is not drawn in 3D at all — it hovered awkwardly in mid-air over
                the felt; PokerBoard renders my name/stack as a fixed HUD panel
                in the corner instead. */}
            {!mine && (
            <Html
              position={[sx * 1.12, 2.95, sz * 1.12]}
              center distanceFactor={13} style={{ pointerEvents: "none" }}
            >
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
            )}
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
      <fog attach="fog" args={["#120c08", 34, 88]} />
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
