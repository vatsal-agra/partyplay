// A shared "we're in an actual room" shell for the 3D games.
//
// Instead of every board floating in a black void, this wraps the scene in an
// inward-facing box: floor, four walls and a ceiling, with a warm skirting
// band and a soft pool of light on the floor under the table. Cheap — one box
// with BackSide plus a couple of planes — and it instantly gives the games a
// sense of place.
"use client"

import * as THREE from "three"

export interface RoomBoxProps {
  size?: number       // room width/depth
  height?: number     // wall height
  y?: number          // floor level
  wall?: string
  floor?: string
  accent?: string     // skirting / trim colour
  glow?: string       // colour of the light pool on the floor
}

export function RoomBox({
  size = 46,
  height = 18,
  y = -1.2,
  wall = "#2a2018",
  floor = "#17120d",
  accent = "#3c2d1d",
  glow = "#ffca85",
}: RoomBoxProps) {
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

      {/* walls + ceiling: a single inward-facing box */}
      <mesh position={[0, y + height / 2, 0]}>
        <boxGeometry args={[size, height, size]} />
        <meshStandardMaterial color={wall} roughness={0.98} metalness={0} side={THREE.BackSide} />
      </mesh>

      {/* skirting band around the base of the walls */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * (size / 2 - 0.06), y + 0.45, Math.cos(a) * (size / 2 - 0.06)]}
            rotation-y={a}
          >
            <planeGeometry args={[size, 0.9]} />
            <meshStandardMaterial color={accent} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}
