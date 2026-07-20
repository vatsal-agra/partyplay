// A shared "we're in an actual games room" shell for the 3D games.
//
// Instead of every board floating in a black void, this wraps the scene in a
// room: panelled walls with a chair-rail wainscot, a ceiling, a floor, and a
// lit DICE ALLEY sign on the far walls.
//
// The walls carry a little emissive of their own. The table lighting in these
// scenes is a tight spot aimed at the board, so anything 20+ units out would
// otherwise fall off to pure black — self-lighting the walls means the room
// always reads without adding more lights to every scene.
"use client"

import * as THREE from "three"
import { useMemo } from "react"

const cache = new Map<string, THREE.CanvasTexture>()

function wallTexture(): THREE.CanvasTexture {
  const hit = cache.get("wall")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = c.height = 512
  const ctx = c.getContext("2d")!

  // base wall
  ctx.fillStyle = "#2f2418"
  ctx.fillRect(0, 0, 512, 512)

  // vertical panelling
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = "rgba(255,235,200,0.04)"
    ctx.fillRect(x, 0, 3, 512)
    ctx.fillStyle = "rgba(0,0,0,0.18)"
    ctx.fillRect(x + 60, 0, 4, 512)
  }

  // chair-rail wainscot across the lower third
  ctx.fillStyle = "#3d2e1d"
  ctx.fillRect(0, 360, 512, 152)
  ctx.fillStyle = "rgba(255,235,200,0.12)"
  ctx.fillRect(0, 356, 512, 5)
  ctx.fillStyle = "rgba(0,0,0,0.32)"
  ctx.fillRect(0, 350, 512, 6)

  // crown trim at the top
  ctx.fillStyle = "rgba(0,0,0,0.28)"
  ctx.fillRect(0, 0, 512, 10)
  ctx.fillStyle = "rgba(255,235,200,0.07)"
  ctx.fillRect(0, 10, 512, 3)

  // faint grain
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2)
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 4
  cache.set("wall", t)
  return t
}

function signTexture(): THREE.CanvasTexture {
  const hit = cache.get("sign")
  if (hit) return hit
  const c = document.createElement("canvas")
  c.width = 1024
  c.height = 300
  const ctx = c.getContext("2d")!

  // dark plaque with a gold border
  ctx.fillStyle = "#140e08"
  ctx.fillRect(0, 0, 1024, 300)
  ctx.strokeStyle = "#e6b45a"
  ctx.lineWidth = 8
  ctx.strokeRect(14, 14, 996, 272)
  ctx.strokeStyle = "rgba(230,180,90,0.35)"
  ctx.lineWidth = 3
  ctx.strokeRect(30, 30, 964, 240)

  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // wordmark
  ctx.fillStyle = "#f2d492"
  ctx.font = "900 128px Georgia, serif"
  ctx.fillText("DICE ALLEY", 512, 132)

  // tagline
  ctx.fillStyle = "rgba(230,180,90,0.8)"
  ctx.font = "900 34px Georgia, serif"
  ctx.fillText("G A M E   N I G H T ,   A N Y W H E R E", 512, 224)

  // little dice pips flanking the wordmark
  ctx.fillStyle = "#e6b45a"
  ;[92, 932].forEach((cx) => {
    ctx.fillRect(cx - 26, 106, 52, 52)
    ctx.fillStyle = "#140e08"
    ctx.fillRect(cx - 14, 118, 12, 12)
    ctx.fillRect(cx + 2, 134, 12, 12)
    ctx.fillStyle = "#e6b45a"
  })

  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 4
  cache.set("sign", t)
  return t
}

export interface RoomBoxProps {
  size?: number       // room width/depth
  height?: number     // wall height
  y?: number          // floor level
  floor?: string
  glow?: string       // colour of the light pool on the floor
  sign?: boolean      // show the DICE ALLEY plaque on the far walls
}

export function RoomBox({
  size = 46,
  height = 18,
  y = -1.2,
  floor = "#17120d",
  glow = "#ffca85",
  sign = true,
}: RoomBoxProps) {
  const wallTex = useMemo(() => {
    const t = wallTexture().clone()
    t.needsUpdate = true
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(Math.max(2, Math.round(size / 9)), Math.max(1, Math.round(height / 9)))
    return t
  }, [size, height])
  const signTex = useMemo(signTexture, [])

  const half = size / 2
  const midY = y + height / 2
  // back, front, left, right — each rotated to face inward
  const walls: { pos: [number, number, number]; rot: number }[] = [
    { pos: [0, midY, -half], rot: 0 },
    { pos: [0, midY, half], rot: Math.PI },
    { pos: [-half, midY, 0], rot: Math.PI / 2 },
    { pos: [half, midY, 0], rot: -Math.PI / 2 },
  ]

  // These cameras all look DOWN at the table, so the visible slice of the far
  // wall is the band just above the floor — a sign high up is always out of
  // frame no matter how you orbit. Keep it low and make it large.
  const signW = size * 0.42
  const signH = signW * (300 / 1024)
  const signY = y + height * 0.17

  return (
    <group>
      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, y, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={floor} roughness={0.95} metalness={0.02} />
      </mesh>

      {/* soft pool of light on the floor beneath the table */}
      <mesh rotation-x={-Math.PI / 2} position={[0, y + 0.01, 0]}>
        <circleGeometry args={[size * 0.3, 40]} />
        <meshBasicMaterial color={glow} transparent opacity={0.05} depthWrite={false} />
      </mesh>

      {/* ceiling */}
      <mesh rotation-x={Math.PI / 2} position={[0, y + height, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#140f0a" roughness={1} />
      </mesh>

      {/* panelled walls — lightly self-lit so they never fall to pure black */}
      {walls.map((w, i) => (
        <mesh key={i} position={w.pos} rotation-y={w.rot} receiveShadow>
          <planeGeometry args={[size, height]} />
          <meshStandardMaterial
            map={wallTex}
            emissiveMap={wallTex}
            emissive="#ffffff"
            emissiveIntensity={0.26}
            roughness={0.95}
            metalness={0}
          />
        </mesh>
      ))}

      {/* DICE ALLEY plaque on the two long walls */}
      {sign && [-1, 1].map((s) => (
        <mesh key={s} position={[0, signY, s * (half - 0.08)]} rotation-y={s < 0 ? 0 : Math.PI}>
          <planeGeometry args={[signW, signH]} />
          <meshBasicMaterial map={signTex} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
