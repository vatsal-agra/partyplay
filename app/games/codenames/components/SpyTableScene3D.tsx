// Spymaster — real-time 3D briefing table (Three.js / React Three Fiber).
//
// A noir agency backroom: 25 code-word cards on charcoal felt under a cone of
// light, the table rim glowing in the acting team's color. Guessed cards
// physically flip over to reveal their agent — red, blue, tan neutral, or the
// black assassin. Spymasters (and pass-and-play peeks) see a soft colored
// glow under every unrevealed card. Presentation only — the container owns
// all engine calls and gating; this scene renders state and reports clicks.
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import { SpymasterState, CellColor } from "../lib/spymasterEngine"

const CARD_W = 1.9
const CARD_H = 1.3
const GAP = 0.24
const CELL_HEX: Record<CellColor, string> = {
  red: "#d9453a", blue: "#3467d9", neutral: "#b3a077", assassin: "#0a0a0d",
}

// grid index → world position (5x5, centered)
const colX = (i: number) => ((i % 5) - 2) * (CARD_W + GAP)
const rowZ = (i: number) => (Math.floor(i / 5) - 2) * (CARD_H + GAP)

// ---- textures (module cache) --------------------------------------------------
const texCache = new Map<string, THREE.CanvasTexture>()

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, startPx: number): number {
  let px = startPx
  ctx.font = `900 ${px}px Georgia, serif`
  while (ctx.measureText(text).width > maxW && px > 18) {
    px -= 2
    ctx.font = `900 ${px}px Georgia, serif`
  }
  return px
}

function wordTexture(word: string): THREE.CanvasTexture {
  const key = `w:${word}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 384; c.height = 264
  const ctx = c.getContext("2d")!
  const g = ctx.createLinearGradient(0, 0, 0, 264)
  g.addColorStop(0, "#f2ecd8"); g.addColorStop(1, "#ded4b5")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 384, 264)
  ctx.strokeStyle = "#8a7a55"; ctx.lineWidth = 6
  ctx.strokeRect(10, 10, 364, 244)
  ctx.strokeStyle = "rgba(138,122,85,0.4)"; ctx.lineWidth = 2
  ctx.strokeRect(20, 20, 344, 224)
  // small crosshair decorations
  ctx.fillStyle = "rgba(138,122,85,0.55)"
  ctx.font = "22px serif"
  ctx.textAlign = "center"
  ctx.fillText("⌖", 44, 52)
  ctx.fillText("⌖", 340, 226)
  // the code word
  ctx.fillStyle = "#262012"
  ctx.textBaseline = "middle"
  fitText(ctx, word.toUpperCase(), 320, 58)
  ctx.fillText(word.toUpperCase(), 192, 136)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}

function agentTexture(color: CellColor, word: string): THREE.CanvasTexture {
  const key = `a:${color}:${word}`
  const hit = texCache.get(key)
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 384; c.height = 264
  const ctx = c.getContext("2d")!
  const base = CELL_HEX[color]
  const g = ctx.createLinearGradient(0, 0, 0, 264)
  if (color === "assassin") { g.addColorStop(0, "#17171c"); g.addColorStop(1, "#050507") }
  else if (color === "neutral") { g.addColorStop(0, "#c4b287"); g.addColorStop(1, "#9c8a60") }
  else { g.addColorStop(0, base); g.addColorStop(1, color === "red" ? "#8f231a" : "#1d3d94") }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 384, 264)
  ctx.strokeStyle = color === "assassin" ? "#5a5a66" : "rgba(255,255,255,0.65)"
  ctx.lineWidth = 8
  ctx.strokeRect(10, 10, 364, 244)
  ctx.textAlign = "center"
  // big agent mark
  ctx.font = "104px serif"
  ctx.textBaseline = "middle"
  ctx.fillText(color === "assassin" ? "💀" : color === "neutral" ? "🕶️" : "🕵️", 192, 128)
  // the word, small, so history stays readable
  ctx.font = "900 30px Georgia, serif"
  ctx.fillStyle = color === "neutral" ? "#3a2f1a" : "rgba(255,255,255,0.9)"
  ctx.fillText(word.toUpperCase().slice(0, 14), 192, 228)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  texCache.set(key, t)
  return t
}

function feltTexture(): THREE.CanvasTexture {
  const hit = texCache.get("felt")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#23262e"
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 3400; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.03)`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  texCache.set("felt", t)
  return t
}

// ---- word card ------------------------------------------------------------------
function WordCard({ index, word, color, revealed, keyGlow, clickable, onGuess }: {
  index: number
  word: string
  color: CellColor
  revealed: boolean
  keyGlow: boolean
  clickable: boolean
  onGuess: (i: number) => void
}) {
  const flipG = useRef<THREE.Group>(null)
  const flip = useRef(0)
  const [hover, setHover] = useState(false)

  const mats = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: "#ded4b5", roughness: 0.7 })
    const face = new THREE.MeshStandardMaterial({ map: wordTexture(word), roughness: 0.6 })
    // the agent side faces the felt until the card flips
    const back = new THREE.MeshStandardMaterial({ map: agentTexture(color, word), roughness: 0.55 })
    return [edge, edge, edge, edge, face, back]
  }, [word, color])

  useFrame((_, dt) => {
    if (!flipG.current) return
    const target = revealed ? 1 : 0
    flip.current += (target - flip.current) * Math.min(1, dt * 4.5)
    const f = flip.current
    flipG.current.rotation.x = Math.PI * f
    // an extra half-turn of showmanship and a swell at the top of the arc
    flipG.current.rotation.z = Math.sin(f * Math.PI) * 0.35
    flipG.current.position.y = 0.03 + Math.sin(f * Math.PI) * 0.9 + (hover && clickable ? 0.14 : 0)
    const s = 1 + Math.sin(f * Math.PI) * 0.28
    flipG.current.scale.set(s, s, s)
  })

  return (
    <group position={[colX(index), 0.16, rowZ(index)]} rotation-x={-Math.PI / 2}>
      {/* spymaster key glow under the card */}
      {keyGlow && !revealed && (
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[CARD_W + 0.18, CARD_H + 0.18]} />
          <meshStandardMaterial
            color={CELL_HEX[color]} emissive={CELL_HEX[color]}
            emissiveIntensity={color === "assassin" ? 0.25 : 0.75}
            transparent opacity={0.85}
          />
        </mesh>
      )}
      <group ref={flipG} position={[0, 0, 0.03]}>
        <mesh
          material={mats}
          castShadow
          onClick={clickable ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); document.body.style.cursor = "auto"; onGuess(index) } : undefined}
          onPointerOver={clickable ? (e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer" } : undefined}
          onPointerOut={clickable ? () => { setHover(false); document.body.style.cursor = "auto" } : undefined}
        >
          <boxGeometry args={[CARD_W, CARD_H, 0.035]} />
        </mesh>
      </group>
    </group>
  )
}

// pulsing team-colored rim around the play area
function TeamRim({ color }: { color: string }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 0.75 + Math.sin(clock.elapsedTime * 2.4) * 0.35
  })
  return (
    <mesh position={[0, 0.145, 0]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[7.45, 7.7, 64]} />
      <meshStandardMaterial ref={ref} color={color} emissive={color} emissiveIntensity={0.75} transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ---- scene -------------------------------------------------------------------------
export interface SpyTableScene3DProps {
  state: SpymasterState
  showKey: boolean
  canGuess: boolean
  onGuess: (index: number) => void
}

function Scene({ state, showKey, canGuess, onGuess }: SpyTableScene3DProps) {
  const felt = useMemo(feltTexture, [])
  const teamHex = state.currentTeam === "red" ? CELL_HEX.red : CELL_HEX.blue
  const rimColor = state.winner ? CELL_HEX[state.winner] : teamHex

  return (
    <>
      {/* noir light rig — a hard cone over the table, team-tinted fill */}
      <ambientLight intensity={0.3} color="#cdd3e0" />
      <hemisphereLight args={["#5a6274", "#08090c", 0.5]} />
      <spotLight position={[0, 13, 1.5]} angle={0.62} penumbra={0.45} intensity={280} color="#f2ead2" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <pointLight position={[-9, 4, 0]} intensity={9} color={CELL_HEX.red} distance={16} decay={2} />
      <pointLight position={[9, 4, 0]} intensity={9} color={CELL_HEX.blue} distance={16} decay={2} />

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.1, 0]} receiveShadow>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial color="#0b0c10" roughness={0.9} />
      </mesh>

      {/* table */}
      <mesh position={[0, -0.12, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[8.3, 8.6, 0.5, 48]} />
        <meshStandardMaterial color="#241a10" roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[7.75, 7.75, 0.26, 48]} />
        <meshStandardMaterial map={felt} color="#343845" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.72, 0]} castShadow>
        <cylinderGeometry args={[1.8, 2.4, 0.85, 24]} />
        <meshStandardMaterial color="#16100a" roughness={0.7} />
      </mesh>

      <TeamRim color={rimColor} />

      {/* the 25 code cards */}
      {state.board.map((cell, i) => (
        <WordCard
          key={cell.word}
          index={i}
          word={cell.word}
          color={cell.color}
          revealed={cell.revealed}
          keyGlow={showKey}
          clickable={canGuess && !cell.revealed}
          onGuess={onGuess}
        />
      ))}

      <OrbitControls
        makeDefault enablePan={false} minDistance={7} maxDistance={22}
        minPolarAngle={0.15} maxPolarAngle={1.05} target={[0, 0, -0.2]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

export default function SpyTableScene3D(props: SpyTableScene3DProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.04 }}
      camera={{ position: [0, 10.2, 8.2], fov: 45, near: 0.1, far: 120 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0b0c10"]} />
      <fog attach="fog" args={["#0b0c10", 24, 55]} />
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
