// Mystery Manor — real-time 3D board (Three.js / React Three Fiber).
//
// A physically-lit tabletop: a wooden mansion board with raised, walled rooms on
// felt, turned 3D character pawns that glide between squares, weapon tokens, and
// a pair of dice that tumble on a roll. Orbit/zoom with the mouse. This is the
// presentation layer only — every move is committed through the same engine via
// the onMoveCell / onMoveRoom callbacks passed down from MysteryBoard.
"use client"

import * as THREE from "three"
import { Suspense, useMemo, useRef } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, RoundedBox, Html, Environment, Lightformer, ContactShadows, useTexture } from "@react-three/drei"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"
import { Mannequins } from "@/components/three/Mannequins"
import { RoomBox } from "@/components/three/RoomBox"
import {
  ROOMS, SUSPECTS, WEAPONS, CELLAR_RECT, BOARD_W, BOARD_H, getRoom, RoomId,
} from "../lib/mansionLayout"
import type { MysteryState } from "../lib/mysteryEngine"

// ---- grid → world -----------------------------------------------------------
const gw = (gx: number) => gx - BOARD_W / 2 + 0.5
const gz = (gy: number) => gy - BOARD_H / 2 + 0.5
const GOLD = "#e6b45a"

const ROOM_ICON: Record<RoomId, string> = {
  kitchen: "🍳", ballroom: "🎭", conservatory: "🪴", dining: "🍷",
  billiard: "🎱", library: "📚", lounge: "🛋️", hall: "🏛️", study: "📜",
}
const ROOM_FELT: Record<RoomId, string> = {
  kitchen: "#7a3b2a", ballroom: "#6b5320", conservatory: "#234f39", dining: "#5c2626",
  billiard: "#1f5a3f", library: "#4a3320", lounge: "#245656", hall: "#5c4a22", study: "#3a2f52",
}

// ---- procedural canvas textures (client-only; scene is ssr:false) -----------
function canvas2d(size = 256) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  return { c, ctx: c.getContext("2d")! }
}
function woodTexture(base: string, repeat = 1): THREE.Texture {
  const { c, ctx } = canvas2d(512)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 512
    const light = Math.random() > 0.5
    ctx.strokeStyle = light ? "rgba(120,90,55,0.10)" : "rgba(20,13,7,0.18)"
    ctx.lineWidth = 0.5 + Math.random() * 2.4
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + (Math.random() - 0.5) * 22, 170, x + (Math.random() - 0.5) * 22, 340, x + (Math.random() - 0.5) * 14, 512)
    ctx.stroke()
  }
  for (let s = 1; s < 5; s++) {
    ctx.strokeStyle = "rgba(10,6,3,0.5)"
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo((512 / 5) * s, 0); ctx.lineTo((512 / 5) * s, 512); ctx.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 8
  return t
}
function feltTexture(base: string): THREE.Texture {
  const { c, ctx } = canvas2d(128)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "0,0,0"},0.04)`
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
function dieFaceTexture(n: number): THREE.Texture {
  const { c, ctx } = canvas2d(128)
  const g = ctx.createLinearGradient(0, 0, 128, 128)
  g.addColorStop(0, "#fffef8"); g.addColorStop(1, "#e7e0cf")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 6; ctx.strokeRect(3, 3, 122, 122)
  const P = [32, 64, 96]
  const dots: [number, number][] = {
    1: [[64, 64]],
    2: [[32, 32], [96, 96]],
    3: [[32, 32], [64, 64], [96, 96]],
    4: [[32, 32], [96, 32], [32, 96], [96, 96]],
    5: [[32, 32], [96, 32], [64, 64], [32, 96], [96, 96]],
    6: [[32, 32], [96, 32], [32, 64], [96, 64], [32, 96], [96, 96]],
  }[n]!.map(([x, y]) => [x, y] as [number, number])
  dots.forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2)
    ctx.fillStyle = "#1a1206"; ctx.fill()
    ctx.beginPath(); ctx.arc(x - 3, y - 3, 4, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fill()
  })
  void P
  return new THREE.CanvasTexture(c)
}

// pawn silhouette (lathed around Y) — a proper turned chess-style piece
const PAWN_GEO = (() => {
  const pts: [number, number][] = [
    [0.0, 0.0], [0.36, 0.0], [0.36, 0.06], [0.22, 0.12], [0.18, 0.44],
    [0.31, 0.52], [0.26, 0.60], [0.14, 0.63], [0.13, 0.78], [0.25, 0.9],
    [0.24, 1.0], [0.14, 1.06], [0.0, 1.1],
  ]
  return new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 40)
})()

function usePointer() {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer" },
    onPointerOut: () => { document.body.style.cursor = "auto" },
  }
}

// ---- interactive move tile --------------------------------------------------
function MoveTile({ x, y, onClick }: { x: number; y: number; onClick: () => void }) {
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 0.5 + Math.sin(clock.elapsedTime * 3 + x + y) * 0.3
  })
  const p = usePointer()
  return (
    <mesh position={[gw(x), 0.07, gz(y)]} onClick={(e) => { e.stopPropagation(); onClick() }} {...p}>
      <boxGeometry args={[0.84, 0.05, 0.84]} />
      <meshStandardMaterial ref={ref} color={GOLD} emissive={GOLD} emissiveIntensity={0.7} transparent opacity={0.85} />
    </mesh>
  )
}

// ---- pawn -------------------------------------------------------------------
function Pawn({ target, color, isCurrent, isMe, owned }: {
  target: { x: number; z: number }; color: string; isCurrent: boolean; isMe: boolean; owned: boolean
}) {
  const g = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const init = useRef(false)
  useFrame(({ clock }, dt) => {
    if (!g.current) return
    if (!init.current) { g.current.position.set(target.x, 0, target.z); init.current = true }
    const k = Math.min(1, dt * 7)
    g.current.position.x += (target.x - g.current.position.x) * k
    g.current.position.z += (target.z - g.current.position.z) * k
    // little hop while travelling
    const d = Math.hypot(target.x - g.current.position.x, target.z - g.current.position.z)
    g.current.position.y = d > 0.05 ? Math.abs(Math.sin(clock.elapsedTime * 12)) * 0.12 : 0
    if (ring.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.12
      ring.current.scale.set(s, s, s)
    }
  })
  return (
    <group ref={g}>
      <mesh geometry={PAWN_GEO} scale={0.62} castShadow>
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.22} emissive={color} emissiveIntensity={owned ? 0.12 : 0} envMapIntensity={1.1} />
      </mesh>
      <mesh geometry={PAWN_GEO} scale={0.62} position={[0, 0, 0]}>
        <meshStandardMaterial color="#ffffff" transparent opacity={0.06} roughness={0.1} />
      </mesh>
      {isCurrent && (
        <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.42, 0.56, 40]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.6} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      {isMe && (
        <mesh position={[0, 0.95, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.24, 4]} />
          <meshStandardMaterial color="#fff7e0" emissive={GOLD} emissiveIntensity={0.8} />
        </mesh>
      )}
    </group>
  )
}

// ---- weapon token -----------------------------------------------------------
function WeaponToken({ image, target }: { image: string; target: { x: number; z: number } }) {
  const tex = useTexture(image)
  const g = useRef<THREE.Group>(null)
  const init = useRef(false)
  useFrame((_, dt) => {
    if (!g.current) return
    if (!init.current) { g.current.position.set(target.x, 0, target.z); init.current = true }
    const k = Math.min(1, dt * 7)
    g.current.position.x += (target.x - g.current.position.x) * k
    g.current.position.z += (target.z - g.current.position.z) * k
  })
  return (
    <group ref={g}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.44, 0.12, 32]} />
        <meshStandardMaterial color="#c9a24a" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.121, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.34, 32]} />
        <meshStandardMaterial map={tex} transparent color="#f4ead2" roughness={0.6} />
      </mesh>
    </group>
  )
}

// ---- dice -------------------------------------------------------------------
// Rotations that bring a given value face-up (matches the material order below).
const FACE_UP_EULER: Record<number, [number, number, number]> = {
  1: [0, 0, Math.PI / 2], 6: [0, 0, -Math.PI / 2],
  2: [0, 0, 0], 5: [Math.PI, 0, 0],
  3: [-Math.PI / 2, 0, 0], 4: [Math.PI / 2, 0, 0],
}

function Dice({ dice, rolling }: { dice: [number, number] | null; rolling: boolean }) {
  const faces = useMemo(() => [1, 2, 3, 4, 5, 6].map(dieFaceTexture), [])
  const mats = useMemo(
    // BoxGeometry face order: +x,-x,+y,-y,+z,-z  → values 1,6,2,5,3,4
    () => [1, 6, 2, 5, 3, 4].map((v) => new THREE.MeshStandardMaterial({ map: faces[v - 1], roughness: 0.4, metalness: 0.05 })),
    [faces],
  )
  const a = useRef<THREE.Mesh>(null)
  const b = useRef<THREE.Mesh>(null)
  const qT = useMemo(() => new THREE.Quaternion(), [])
  const eT = useMemo(() => new THREE.Euler(), [])
  useFrame((_, dt) => {
    ;[a.current, b.current].forEach((m, i) => {
      if (!m) return
      if (rolling) {
        m.rotation.x += dt * (9 + i * 2)
        m.rotation.y += dt * (11 - i * 3)
        m.position.y = 1.1 + Math.abs(Math.sin(performanceNow() * 0.006 + i)) * 0.5
      } else {
        // Settle showing the value that was ACTUALLY rolled — these used to
        // settle to an arbitrary tilt, so the pips never matched movesLeft.
        const v = dice ? dice[i] : 1
        eT.set(...(FACE_UP_EULER[v] ?? FACE_UP_EULER[1]))
        qT.setFromEuler(eT)
        m.quaternion.slerp(qT, Math.min(1, dt * 8))
        m.position.y += (0.42 - m.position.y) * Math.min(1, dt * 6)
      }
    })
  })
  if (!rolling && !dice) return null
  return (
    <group position={[gw((CELLAR_RECT.x1 + CELLAR_RECT.x2) / 2), 0.6, gz((CELLAR_RECT.y1 + CELLAR_RECT.y2) / 2)]}>
      <mesh ref={a} position={[-0.5, 0.42, 0]} material={mats} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
      </mesh>
      <mesh ref={b} position={[0.5, 0.42, 0]} material={mats} castShadow>
        <boxGeometry args={[0.62, 0.62, 0.62]} />
      </mesh>
    </group>
  )
}
// framer-free clock (Date.now is blocked in some sandboxes but fine in browser runtime)
function performanceNow() { return typeof performance !== "undefined" ? performance.now() : 0 }

// ---- room ------------------------------------------------------------------
function Room({ room, reachable, spotlit, wood, onEnter }: {
  room: (typeof ROOMS)[number]; reachable: boolean; spotlit?: boolean; wood: THREE.Texture; onEnter: () => void
}) {
  const r = room.rect
  const cx = gw((r.x1 + r.x2) / 2), cz = gz((r.y1 + r.y2) / 2)
  const w = r.x2 - r.x1 + 1, d = r.y2 - r.y1 + 1
  const felt = useMemo(() => feltTexture(ROOM_FELT[room.id]), [room.id])
  const floorMat = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (!floorMat.current) return
    if (spotlit) {
      // a suggestion names this room — it throbs crimson while the accusation
      // hangs in the air and the disprove is resolved
      floorMat.current.emissive.set("#c8352b")
      floorMat.current.emissiveIntensity = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 4.2)) * 0.45
    } else {
      floorMat.current.emissive.set(GOLD)
      floorMat.current.emissiveIntensity = reachable ? 0.25 + Math.sin(clock.elapsedTime * 3) * 0.15 : 0
    }
  })
  const p = usePointer()
  const wallH = 0.42, tk = 0.16
  const wallMat = <meshStandardMaterial map={wood} color="#6b4e2e" roughness={0.7} metalness={0.1} />
  return (
    <group>
      {/* felt floor (click target when reachable) */}
      <mesh position={[cx, 0.04, cz]} receiveShadow
        onClick={reachable ? (e) => { e.stopPropagation(); onEnter() } : undefined}
        {...(reachable ? p : {})}>
        <boxGeometry args={[w - 0.12, 0.12, d - 0.12]} />
        <meshStandardMaterial ref={floorMat} map={felt} color={ROOM_FELT[room.id]} emissive={GOLD} emissiveIntensity={0} roughness={0.9} />
      </mesh>
      {/* perimeter walls */}
      <mesh position={[cx, wallH / 2 + 0.1, cz - d / 2 + tk / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, tk]} />{wallMat}
      </mesh>
      <mesh position={[cx, wallH / 2 + 0.1, cz + d / 2 - tk / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, wallH, tk]} />{wallMat}
      </mesh>
      <mesh position={[cx - w / 2 + tk / 2, wallH / 2 + 0.1, cz]} castShadow receiveShadow>
        <boxGeometry args={[tk, wallH, d]} />{wallMat}
      </mesh>
      <mesh position={[cx + w / 2 - tk / 2, wallH / 2 + 0.1, cz]} castShadow receiveShadow>
        <boxGeometry args={[tk, wallH, d]} />{wallMat}
      </mesh>
      {/* brass nameplate */}
      <Html position={[cx, 1.0, cz]} center distanceFactor={16} pointerEvents="none" style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: "var(--font-display), Georgia, serif", whiteSpace: "nowrap",
          color: "#f2dca6", fontWeight: 800, fontSize: 15, letterSpacing: 0.5,
          textShadow: "0 2px 6px rgba(0,0,0,0.8)", padding: "2px 10px",
          background: "linear-gradient(#3a2c18cc,#241a0fcc)", border: "1px solid #6b532e",
          borderRadius: 6, backdropFilter: "blur(2px)",
        }}>{ROOM_ICON[room.id]} {room.name}</div>
      </Html>
    </group>
  )
}

// ---- full scene -------------------------------------------------------------
function Scene({ state, currentPlayerId, reachCellKeys, reachRoomIds, onMoveCell, onMoveRoom, rolling }: SceneProps) {
  const boardWood = useMemo(() => woodTexture("#3a2c19", 3), [])
  const tableWood = useMemo(() => woodTexture("#241a10", 6), [])

  const { pieces, weapons } = useMemo(() => {
    const perP: Record<string, number> = {}, perW: Record<string, number> = {}
    const cur = state.players[state.currentPlayerIndex]
    const pieceArr = SUSPECTS.map((s) => {
      const owner = state.players.find((p) => p.suspectId === s.id)
      let room: RoomId | null = null
      let cell: { x: number; y: number } | null = null
      if (owner) { room = owner.inRoom; cell = owner.cell }
      else { room = state.suspectLocations[s.id] ?? null; if (!room) cell = { ...s.start } }
      let gx: number, gy: number
      if (room) {
        const i = perP[room] ?? 0; perP[room] = i + 1
        const rr = getRoom(room).rect
        const innerW = Math.max(1, rr.x2 - rr.x1 - 1)
        gx = rr.x1 + 1 + (i % innerW); gy = rr.y2 - 1 - Math.floor(i / innerW)
      } else { gx = cell!.x; gy = cell!.y }
      return {
        id: s.id, color: owner?.color ?? s.color, owned: !!owner,
        isCurrent: !!owner && owner.id === cur.id, isMe: !!owner && owner.id === currentPlayerId,
        target: { x: gw(gx), z: gz(gy) },
      }
    })
    const weaponArr = WEAPONS.map((w) => {
      const room = state.weaponLocations[w.id]
      const i = perW[room] ?? 0; perW[room] = i + 1
      const rr = getRoom(room).rect
      const innerW = Math.max(1, rr.x2 - rr.x1 - 1)
      return { id: w.id, image: w.image, target: { x: gw(rr.x1 + 1 + (i % innerW)), z: gz(rr.y1 + 1) } }
    })
    return { pieces: pieceArr, weapons: weaponArr }
  }, [state, currentPlayerId])

  const ccx = gw((CELLAR_RECT.x1 + CELLAR_RECT.x2) / 2), ccz = gz((CELLAR_RECT.y1 + CELLAR_RECT.y2) / 2)
  const cw = CELLAR_RECT.x2 - CELLAR_RECT.x1 + 1, cd = CELLAR_RECT.y2 - CELLAR_RECT.y1 + 1

  return (
    <>
      {/* lighting */}
      <ambientLight intensity={0.35} color="#ffe9c8" />
      <hemisphereLight args={["#fff1d8", "#1a1208", 0.5]} />
      <directionalLight
        position={[9, 20, 7]} intensity={2.1} color="#fff2d4" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16}
        shadow-camera-near={1} shadow-camera-far={60}
      />
      <pointLight position={[-8, 7, -8]} intensity={40} color="#ffb867" distance={30} decay={2} />
      <pointLight position={[8, 6, 9]} intensity={26} color="#ffd9a0" distance={28} decay={2} />

      {/* image-based lighting for glossy pieces (built from in-scene shapes; no network) */}
      <Environment resolution={256}>
        <Lightformer intensity={2} form="rect" position={[0, 8, 2]} scale={[10, 6, 1]} color="#fff2d8" />
        <Lightformer intensity={1.2} form="circle" position={[-6, 4, -6]} scale={4} color="#ffb867" />
        <Lightformer intensity={1} form="circle" position={[6, 3, 6]} scale={4} color="#ffe1b0" />
      </Environment>

      {/* games-room walls (wider than OrbitControls maxDistance 40) */}
      <RoomBox size={96} height={30} y={-0.33} floor="#171008" glow="#ffd79a" />

      {/* the detectives gathered around the board */}
      <Mannequins
        players={state.players.map((p) => ({
          id: p.id, name: p.name, color: (p as any).color, isBot: p.isBot,
          active: state.players[state.currentPlayerIndex]?.id === p.id,
        }))}
        radius={16.5} y={-0.32} scale={2.0} startAngle={-Math.PI / 2}
      />

      {/* table */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.32, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial map={tableWood} color="#2a1e12" roughness={0.8} metalness={0.05} />
      </mesh>

      {/* board slab */}
      <mesh position={[0, -0.15, 0]} receiveShadow castShadow>
        <boxGeometry args={[BOARD_W + 0.6, 0.3, BOARD_H + 0.6]} />
        <meshStandardMaterial map={boardWood} color="#3a2c19" roughness={0.65} metalness={0.1} />
      </mesh>
      {/* corridor inlay */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[BOARD_W, 0.02, BOARD_H]} />
        <meshStandardMaterial map={boardWood} color="#4a3823" roughness={0.55} metalness={0.15} />
      </mesh>

      {/* cellar plinth */}
      <mesh position={[ccx, 0.28, ccz]} castShadow receiveShadow>
        <boxGeometry args={[cw - 0.3, 0.56, cd - 0.3]} />
        <meshStandardMaterial color="#160f08" roughness={0.5} metalness={0.5} />
      </mesh>
      <mesh position={[ccx, 0.57, ccz]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[cw - 0.6, cd - 0.6]} />
        <meshStandardMaterial color="#0d0905" emissive="#5a3d18" emissiveIntensity={0.4} roughness={0.3} metalness={0.6} />
      </mesh>
      <Html position={[ccx, 0.75, ccz]} center distanceFactor={17} pointerEvents="none" style={{ pointerEvents: "none" }}>
        <div style={{
          fontFamily: "var(--font-display), Georgia, serif", color: "#8a6a34", fontWeight: 800,
          fontSize: 13, letterSpacing: 3, textShadow: "0 2px 5px rgba(0,0,0,0.9)", whiteSpace: "nowrap",
        }}>THE CELLAR</div>
      </Html>

      {/* rooms */}
      {ROOMS.map((room) => (
        <Room key={room.id} room={room} wood={boardWood}
          reachable={reachRoomIds.has(room.id)}
          spotlit={state.pending?.room === room.id}
          onEnter={() => onMoveRoom(room.id)} />
      ))}

      {/* reachable corridor tiles */}
      {Array.from(reachCellKeys).map((k) => {
        const [x, y] = k.split(",").map(Number)
        return <MoveTile key={k} x={x} y={y} onClick={() => onMoveCell(x, y)} />
      })}

      {/* weapons */}
      {weapons.map((w) => <WeaponToken key={w.id} image={w.image} target={w.target} />)}

      {/* pawns */}
      {pieces.map((p) => (
        <Pawn key={p.id} target={p.target} color={p.color} isCurrent={p.isCurrent} isMe={p.isMe} owned={p.owned} />
      ))}

      <Dice dice={state.dice} rolling={rolling} />

      <ContactShadows position={[0, 0.02, 0]} scale={40} blur={2.4} opacity={0.5} far={6} resolution={1024} color="#0a0603" />

      <OrbitControls
        makeDefault enablePan={false} minDistance={14} maxDistance={40}
        minPolarAngle={0.15} maxPolarAngle={1.35} target={[0, 0, 0]} enableDamping dampingFactor={0.08}
      />
    </>
  )
}

interface SceneProps {
  state: MysteryState
  currentPlayerId: string
  reachCellKeys: Set<string>
  reachRoomIds: Set<string>
  onMoveCell: (x: number, y: number) => void
  onMoveRoom: (room: RoomId) => void
  rolling: boolean
}

export default function MansionScene3D(props: SceneProps) {
  return (
    <Canvas
      shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      camera={{ position: [0, 18, 17], fov: 42, near: 0.1, far: 200 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#140d07"]} />
      <fog attach="fog" args={["#140d07", 34, 70]} />
      <Suspense fallback={null}>
        <Scene {...props} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.2} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.75} />
          <SMAA />
        </EffectComposer>
      </Suspense>
    </Canvas>
  )
}
