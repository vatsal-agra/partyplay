// Color Clash — real-time 3D card table (Three.js / React Three Fiber).
//
// A neon-tinged night table: your hand fanned large and readable near the
// camera (playable cards glow and lift, click to play), a draw pile that
// pulses when it's your move, a discard stack where played cards spin in,
// a rotating direction ring, and the whole table bathed in the active color.
// The container owns every engine call; this scene renders and reports clicks.
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, Html } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import {
  UnoState, Card, Color, symbolFor,
} from "../lib/unoEngine"

const SERIF = "var(--font-display), Georgia, serif"

export const UNO_HEX: Record<string, string> = { red: "#e5342b", yellow: "#f5b81d", green: "#2fa84f", blue: "#2f6fe5", wild: "#3a3a44" }
const DARKER: Record<string, string> = { red: "#8f1f1a", yellow: "#a37a10", green: "#1d6b32", blue: "#1d4794", wild: "#232329" }

// ---- card textures (module-level cache) --------------------------------------------
const texCache = new Map<string, THREE.CanvasTexture>()

function unoFaceTexture(color: Color, value: string): THREE.CanvasTexture {
  const key = `f${color}-${value}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256; c.height = 384
  const ctx = c.getContext("2d")!
  // base
  if (color === "wild") {
    const g = ctx.createLinearGradient(0, 0, 256, 384)
    g.addColorStop(0, "#e5342b"); g.addColorStop(0.34, "#f5b81d"); g.addColorStop(0.67, "#2fa84f"); g.addColorStop(1, "#2f6fe5")
    ctx.fillStyle = g
  } else {
    ctx.fillStyle = UNO_HEX[color]
  }
  ctx.fillRect(0, 0, 256, 384)
  // white border
  ctx.strokeStyle = "#f5f2ea"; ctx.lineWidth = 14
  ctx.strokeRect(8, 8, 240, 368)
  // tilted center ellipse
  ctx.save()
  ctx.translate(128, 192); ctx.rotate(-0.6)
  ctx.beginPath(); ctx.ellipse(0, 0, 96, 150, 0, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(245,242,234,0.92)"
  ctx.fill()
  ctx.restore()
  // center symbol
  const sym = symbolFor(value as any)
  ctx.fillStyle = color === "wild" ? "#23232a" : UNO_HEX[color]
  ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 4
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.font = `900 ${sym.length > 1 ? 96 : 150}px Arial, sans-serif`
  ctx.fillText(sym, 128, 196)
  // corner marks
  ctx.fillStyle = "#f5f2ea"
  ctx.font = "900 44px Arial, sans-serif"
  ctx.fillText(sym, 40, 52)
  ctx.save(); ctx.translate(216, 336); ctx.rotate(Math.PI); ctx.fillText(sym, 0, 0); ctx.restore()
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  texCache.set(key, t)
  return t
}

function unoBackTexture(): THREE.CanvasTexture {
  const hit = texCache.get("back")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 256; c.height = 384
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#1b1b22"
  ctx.fillRect(0, 0, 256, 384)
  ctx.strokeStyle = "#f5f2ea"; ctx.lineWidth = 12
  ctx.strokeRect(8, 8, 240, 368)
  ctx.save()
  ctx.translate(128, 192); ctx.rotate(-0.6)
  const g = ctx.createLinearGradient(-90, 0, 90, 0)
  g.addColorStop(0, "#e5342b"); g.addColorStop(0.34, "#f5b81d"); g.addColorStop(0.67, "#2fa84f"); g.addColorStop(1, "#2f6fe5")
  ctx.beginPath(); ctx.ellipse(0, 0, 92, 146, 0, 0, Math.PI * 2)
  ctx.fillStyle = g; ctx.fill()
  ctx.fillStyle = "#1b1b22"
  ctx.font = "900 72px Arial, sans-serif"
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText("CC", 0, 4)
  ctx.restore()
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
  ctx.fillStyle = "#232732"
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 3600; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.03)`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  texCache.set("felt", t)
  return t
}

// ---- 3D card ------------------------------------------------------------------------
const CW = 1.0, CH = 1.5, CT = 0.02

function cardMats(card?: Card): THREE.Material[] {
  const edge = new THREE.MeshStandardMaterial({ color: "#f5f2ea", roughness: 0.7 })
  const face = card
    ? new THREE.MeshStandardMaterial({ map: unoFaceTexture(card.color, card.value), roughness: 0.5 })
    : new THREE.MeshStandardMaterial({ map: unoBackTexture(), roughness: 0.5 })
  const back = new THREE.MeshStandardMaterial({ map: unoBackTexture(), roughness: 0.5 })
  return [edge, edge, edge, edge, face, back]
}

function Card3D({ card, ...props }: { card?: Card } & JSX.IntrinsicElements["group"]) {
  const mats = useMemo(() => cardMats(card), [card ? card.color + card.value : "back"])
  return (
    <group {...props}>
      <mesh material={mats} castShadow>
        <boxGeometry args={[CW, CH, CT]} />
      </mesh>
    </group>
  )
}

// A hand card: fanned, hoverable, clickable when playable.
// A hand card. No "playable" highlighting — every card looks the same (the
// player decides what to play); the engine simply ignores an illegal click.
// Hover-lift is uniform tactile feedback on your turn, not a hint.
function HandCard({ card, i, n, canAct, onPlay }: {
  card: Card; i: number; n: number; canAct: boolean; onPlay: (id: string) => void
}) {
  const g = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const spread = Math.min(0.16, 2.0 / Math.max(1, n))
  const a = (i - (n - 1) / 2) * spread            // fan angle
  const R = 9                                     // fan radius (pivot behind camera-ish)
  const bx = Math.sin(a) * R
  const bz = 6.4 + (1 - Math.cos(a)) * R * 0.5
  const lift = hover && canAct ? 0.55 : 0
  useFrame((_, dt) => {
    if (!g.current) return
    const k = Math.min(1, dt * 10)
    g.current.position.x += (bx - g.current.position.x) * k
    g.current.position.y += (1.05 + lift + Math.abs(a) * -0.15 - g.current.position.y) * k
    g.current.position.z += (bz - g.current.position.z) * k
    g.current.rotation.z += (-a * 0.9 - g.current.rotation.z) * k
    const s = hover && canAct ? 1.12 : 1
    g.current.scale.x += (s - g.current.scale.x) * k
    g.current.scale.y += (s - g.current.scale.y) * k
  })
  return (
    <group ref={g} position={[bx, 1.05, bz]} rotation-x={-0.42}>
      <Card3D card={card} />
      {/* invisible fat hit target — any card is clickable on your turn; the
          engine no-ops an illegal play, so there's no "allowed move" tell. */}
      <mesh
        visible={false}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (canAct) { document.body.style.cursor = "auto"; onPlay(card.id) } }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); if (canAct) document.body.style.cursor = "pointer" }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = "auto" }}
      >
        <planeGeometry args={[CW + 0.06, CH + 0.3]} />
      </mesh>
    </group>
  )
}

// Discard stack: a few past cards with deterministic jitter + animated top card.
function DiscardPile({ cards }: { cards: Card[] }) {
  const top = cards[cards.length - 1]
  const under = cards.slice(-6, -1)
  const g = useRef<THREE.Group>(null)
  const t = useRef(0)
  const topId = useRef(top?.id)
  if (topId.current !== top?.id) { topId.current = top?.id; t.current = 0 }
  useFrame((_, dt) => {
    if (!g.current) return
    t.current = Math.min(1, t.current + dt * 2.4)
    const e = 1 - Math.pow(1 - t.current, 3)
    g.current.position.y = 0.4 + (1 - e) * 1.6
    g.current.rotation.z = jitter(top?.id || "") + (1 - e) * Math.PI * 2
  })
  const jitter = (id: string) => {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    return ((h % 100) / 100 - 0.5) * 0.5
  }
  return (
    <group position={[0.95, 0, -0.4]}>
      {under.map((c, i) => (
        <group key={c.id} position={[0, 0.06 + i * 0.022, 0]} rotation-x={-Math.PI / 2} rotation-z={jitter(c.id)}>
          <Card3D card={c} />
        </group>
      ))}
      {top && (
        <group ref={g} position={[0, 0.4, 0]} rotation-x={-Math.PI / 2}>
          <Card3D card={top} />
        </group>
      )}
    </group>
  )
}

// Draw pile: neat stack, pulses & clickable when drawing is legal.
function DrawPile({ count, canDraw, onDraw }: { count: number; canDraw: boolean; onDraw: () => void }) {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) {
      const m = ring.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 3.4) * 0.4
    }
  })
  const stack = Math.max(2, Math.min(10, Math.round(count / 8)))
  return (
    <group position={[-1.5, 0, -0.4]}>
      {Array.from({ length: stack }).map((_, i) => (
        <group key={i} position={[0, 0.05 + i * 0.024, 0]} rotation-x={-Math.PI / 2} rotation-z={0.06 * ((i % 3) - 1)}>
          <Card3D />
        </group>
      ))}
      {canDraw && (
        <>
          <mesh ref={ring} position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[0.95, 1.08, 36]} />
            <meshStandardMaterial color="#ffd76a" emissive="#ffd76a" emissiveIntensity={0.8} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            visible={false}
            onClick={(e) => { e.stopPropagation(); document.body.style.cursor = "auto"; onDraw() }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer" }}
            onPointerOut={() => { document.body.style.cursor = "auto" }}
            position={[0, 0.3, 0]}
          >
            <boxGeometry args={[1.4, 0.7, 1.9]} />
          </mesh>
        </>
      )}
    </group>
  )
}

// Rotating direction indicator around the center piles.
function DirectionRing({ direction, color }: { direction: 1 | -1; color: string }) {
  const g = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y -= dt * 0.9 * direction
  })
  return (
    <group ref={g} position={[0, 0.06, -0.4]}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1]} rotation-y={-a - Math.PI / 2} rotation-x={Math.PI / 2}>
            <coneGeometry args={[0.14, 0.42, 3]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.8} />
          </mesh>
        )
      })}
    </group>
  )
}

// ---- scene ----------------------------------------------------------------------------
export interface UnoScene3DProps {
  state: UnoState
  meIndex: number
  isSpectator: boolean
  isMyTurn: boolean
  playableIds: Set<string>
  canDraw: boolean
  onPlayCard: (cardId: string) => void
  onDraw: () => void
}

function Scene({ state, meIndex, isSpectator, isMyTurn, canDraw, onPlayCard, onDraw }: UnoScene3DProps) {
  const felt = useMemo(feltTexture, [])
  const me = state.players[meIndex]
  const n = state.players.length
  const activeHex = UNO_HEX[state.activeColor] || "#8a8a96"
  const opponents = state.players.map((p, idx) => ({ p, idx })).filter(({ idx }) => idx !== meIndex)

  const colorLight = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (colorLight.current) colorLight.current.intensity = 26 + Math.sin(clock.elapsedTime * 2.2) * 6
  })

  return (
    <>
      {/* night lounge lighting, tinted by the active color */}
      <ambientLight intensity={0.35} color="#cdd3e0" />
      <hemisphereLight args={["#6a7284", "#0a0b10", 0.5]} />
      <spotLight position={[0, 12, 2]} angle={0.7} penumbra={0.6} intensity={230} color="#f2ead2" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <pointLight ref={colorLight} position={[0, 4.5, -0.4]} intensity={26} color={activeHex} distance={16} decay={2} />

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.2, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#0d0e14" roughness={0.9} />
      </mesh>

      {/* round table */}
      <mesh position={[0, -0.13, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[7.6, 7.9, 0.5, 48]} />
        <meshStandardMaterial color="#2a2118" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[7.0, 7.0, 0.24, 48]} />
        <meshStandardMaterial map={felt} color="#3a4152" roughness={0.9} />
      </mesh>
      {/* active-color rim glow */}
      <mesh position={[0, 0.14, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[6.55, 6.85, 64]} />
        <meshStandardMaterial color={activeHex} emissive={activeHex} emissiveIntensity={0.9} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.75, 0]} castShadow>
        <cylinderGeometry args={[1.7, 2.3, 0.9, 24]} />
        <meshStandardMaterial color="#1a1510" roughness={0.7} />
      </mesh>

      <DirectionRing direction={state.direction} color={activeHex} />
      <DiscardPile cards={state.discardPile} />
      <DrawPile count={state.drawPile.length} canDraw={canDraw} onDraw={onDraw} />

      {/* opponents: card-back fans + plates */}
      {opponents.map(({ p, idx }, k) => {
        const count = opponents.length
        const deg = 180 + ((k + 1) * 180) / (count + 1)
        const a = (deg * Math.PI) / 180
        const px = Math.cos(a) * 5.6
        const pz = Math.sin(a) * 5.6
        const isCur = state.players[state.currentPlayerIndex].id === p.id && !state.winnerId
        const shown = Math.min(p.hand.length, 9)
        return (
          <group key={p.id} position={[px, 0, pz]} rotation-y={-a - Math.PI / 2}>
            {/* fan of backs */}
            {Array.from({ length: shown }).map((_, i) => {
              const fa = (i - (shown - 1) / 2) * 0.14
              return (
                <group key={i} position={[Math.sin(fa) * 1.6, 0.85 + Math.cos(fa) * 0.05, 0]} rotation-z={-fa} rotation-x={0.5} scale={0.62}>
                  <Card3D />
                </group>
              )
            })}
            {isCur && (
              <mesh position={[0, 0.16, 0.7]} rotation-x={-Math.PI / 2}>
                <ringGeometry args={[0.7, 0.82, 32]} />
                <meshStandardMaterial color="#ffd76a" emissive="#ffd76a" emissiveIntensity={1} transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
            )}
            <Html position={[0, 1.8, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
              <div style={{
                textAlign: "center", whiteSpace: "nowrap",
                background: isCur ? "rgba(255,215,106,0.16)" : "rgba(0,0,0,0.55)",
                border: `1px solid ${isCur ? "rgba(255,215,106,0.6)" : "rgba(255,255,255,0.14)"}`,
                borderRadius: 10, padding: "4px 10px", backdropFilter: "blur(3px)",
              }}>
                <div style={{ fontFamily: SERIF, fontWeight: 900, fontSize: 13, color: "#fff" }}>
                  {p.name}{p.isBot ? " 🤖" : ""}
                  {p.hand.length === 1 && <span style={{ color: "#ffd76a", marginLeft: 6, fontSize: 11 }}>UNO!</span>}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10.5, fontWeight: 700, color: "#9aa3b5" }}>
                  {p.hand.length} card{p.hand.length === 1 ? "" : "s"}
                </div>
              </div>
            </Html>
          </group>
        )
      })}

      {/* my hand fan — no playability highlighting; you decide what to play */}
      {me && !isSpectator && me.hand.map((c, i) => (
        <HandCard
          key={c.id} card={c} i={i} n={me.hand.length}
          canAct={isMyTurn}
          onPlay={onPlayCard}
        />
      ))}

      <OrbitControls
        makeDefault enablePan={false} minDistance={7} maxDistance={22}
        minPolarAngle={0.25} maxPolarAngle={1.2} target={[0, 0.4, 0]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function UnoScene3D(props: UnoScene3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.04 }}
      camera={{ position: [0, 7.6, 10.8], fov: 47, near: 0.1, far: 120 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0a0b10"]} />
      <fog attach="fog" args={["#0a0b10", 26, 55]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.55} luminanceThreshold={0.68} luminanceSmoothing={0.25} mipmapBlur />
          <Vignette eskil={false} offset={0.26} darkness={0.76} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
