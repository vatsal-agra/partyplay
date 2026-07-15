// Shared 3D "player mannequins" for the board games.
//
// A stylised blank artist's-mannequin figure (white body, colour-tinted base)
// for every player, ringed evenly around the table and facing the centre, each
// wearing a floating name plate. On mount they pop up in a quick staggered
// entrance so it feels like everyone is taking their seat before play begins.
//
// Presentation only — it reads a lightweight player list, nothing game-specific,
// so any R3F scene can drop in <Mannequins players={...} radius={...} />.
"use client"

import * as THREE from "three"
import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { Html } from "@react-three/drei"

export interface MannequinPlayer {
  id: string
  name: string
  color?: string
  isBot?: boolean
  active?: boolean // highlight whoever's turn it is
}

const BODY = "#e9e5db"

function Figure({ name, color, index, isBot, active }: {
  name: string; color: string; index: number; isBot?: boolean; active?: boolean
}) {
  const g = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)

  useFrame(({ clock }) => {
    const grp = g.current
    if (!grp) return
    // Staggered pop-in entrance: scale 0 -> 1, one seat after another.
    if (born.current === null) born.current = clock.elapsedTime + index * 0.16
    const k = Math.min(1, Math.max(0, clock.elapsedTime - born.current))
    const ease = k * k * (3 - 2 * k)
    const s = ease
    grp.scale.set(s, s, s)
    // Gentle idle breathing / sway once seated.
    const idle = k >= 1 ? Math.sin(clock.elapsedTime * 1.2 + index) * 0.025 : 0
    grp.rotation.z = idle
    grp.position.y = k >= 1 ? Math.sin(clock.elapsedTime * 1.6 + index * 1.7) * 0.012 : 0
  })

  const tint = color || "#8a8a8a"
  return (
    <group ref={g} scale={0}>
      {/* base disc — the player's colour, so you can tell seats apart */}
      <mesh position={[0, 0.03, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.42, 0.07, 22]} />
        <meshStandardMaterial color={tint} roughness={0.45} metalness={0.25} />
      </mesh>
      {/* hips / lower body */}
      <mesh position={[0, 0.33, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 0.36, 16]} />
        <meshStandardMaterial color={BODY} roughness={0.62} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.24, 0.5, 16]} />
        <meshStandardMaterial color={BODY} roughness={0.62} />
      </mesh>
      {/* colour sash across the chest for identity */}
      <mesh position={[0, 0.86, 0.02]} castShadow>
        <cylinderGeometry args={[0.265, 0.25, 0.1, 16]} />
        <meshStandardMaterial color={tint} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* shoulders */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshStandardMaterial color={BODY} roughness={0.62} />
      </mesh>
      {/* arms resting forward toward the table */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={x} position={[x, 0.74, 0.14]} rotation-x={0.6} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 0.46, 10]} />
          <meshStandardMaterial color={BODY} roughness={0.62} />
        </mesh>
      ))}
      {/* neck */}
      <mesh position={[0, 1.14, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.12, 12]} />
        <meshStandardMaterial color={BODY} roughness={0.62} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <sphereGeometry args={[0.2, 22, 18]} />
        <meshStandardMaterial color={BODY} roughness={0.55} />
      </mesh>

      {/* name plate */}
      <Html position={[0, 1.82, 0]} center distanceFactor={13} style={{ pointerEvents: "none" }}>
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
    </group>
  )
}

export interface MannequinsProps {
  players: MannequinPlayer[]
  radius?: number    // distance from board centre
  y?: number         // vertical placement (table height)
  scale?: number     // overall figure scale
  startAngle?: number // where seat 0 sits, radians (default: near camera / front)
  center?: [number, number, number]
}

export function Mannequins({
  players, radius = 6, y = 0, scale = 1, startAngle = Math.PI / 2, center = [0, 0, 0],
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
            <Figure name={p.name} color={p.color || "#8a8a8a"} index={i} isBot={p.isBot} active={p.active} />
          </group>
        )
      })}
    </>
  )
}
