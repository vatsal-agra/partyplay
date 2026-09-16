// Shared canvas / postprocessing / shadow defaults for the 3D game tables.
//
// Every table used to hand-roll the same three things: the Canvas gl block, an
// EffectComposer with Bloom + Vignette + SMAA, and a 2048 shadow map on its key
// light. Three copies of the same numbers in seven files, and the heaviest
// preset applied everywhere regardless of how much the board actually shows.
//
// Two things were costing real frames on every table:
//
//   1. `gl={{ antialias: true }}` alongside an EffectComposer. Once a composer
//      is in play the scene renders into the composer's own render targets and
//      the multisampled default framebuffer is never drawn to, so the MSAA
//      buffer was pure allocation. AA is the composer's job.
//   2. dpr up to 2 with three fullscreen passes on top. On a retina display
//      that is four times the fragment work of 1x, for every pass.
//
// So: one helper, two tiers.
//
//   high — the busy boards (monopoly, catan, battleship, cluedo). Full SMAA,
//          2048 shadow maps, dpr up to 1.75.
//   low  — the card tables (uno, poker, codenames). A flat felt, a grid of
//          cards and a few seated figures do not need a dedicated SMAA pass:
//          dpr up to 1.5 plus 4x MSAA on the composer's own target covers the
//          edges in one hardware resolve, and the shadow maps halve to 1024.
//
// Bloom and Vignette are both Effects, so the composer folds them into a single
// fullscreen pass. Dropping SMAA on the low tier takes that table from three
// passes to one.
"use client"

import * as THREE from "three"
import { EffectComposer, Bloom, Vignette, SMAA } from "@react-three/postprocessing"

export type SceneQuality = "high" | "low"

/** Canvas props shared by every table. Spread this, then add camera/style. */
export function canvasDefaults(quality: SceneQuality, exposure = 1.04) {
  return {
    shadows: true,
    // AA comes from the composer (SMAA on high, MSAA on low), never from the
    // default framebuffer — see the note above.
    dpr: (quality === "high" ? [1, 1.75] : [1, 1.5]) as [number, number],
    gl: {
      antialias: false,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: exposure,
      powerPreference: "high-performance" as const,
    },
  }
}

/** Shadow-map size for a castShadow key light at this quality. */
export function shadowMapSize(quality: SceneQuality): [number, number] {
  return quality === "high" ? [2048, 2048] : [1024, 1024]
}

/**
 * Shadow settings for a castShadow light. Spread onto the light so the map
 * size and bias stay in one place:
 *   <spotLight castShadow {...shadowDefaults(quality)} />
 */
export function shadowDefaults(quality: SceneQuality) {
  return {
    "shadow-mapSize": shadowMapSize(quality),
    "shadow-bias": -0.0004,
    "shadow-normalBias": 0.02,
  }
}

export interface SceneFXProps {
  quality: SceneQuality
  /** Bloom strength. */
  intensity?: number
  /** Only pixels above this luminance bloom — raise it to stop hot spotlights blowing out. */
  threshold?: number
  smoothing?: number
  vignetteOffset?: number
  vignetteDarkness?: number
}

/**
 * The shared postprocessing stack. Drop it inside the Canvas's Suspense,
 * after the scene:  <SceneFX quality="low" intensity={0.5} threshold={0.82} />
 */
export function SceneFX({
  quality,
  intensity = 0.5,
  threshold = 0.7,
  smoothing = 0.25,
  vignetteOffset = 0.25,
  vignetteDarkness = 0.75,
}: SceneFXProps) {
  return (
    <EffectComposer multisampling={quality === "high" ? 0 : 4}>
      <Bloom
        intensity={intensity}
        luminanceThreshold={threshold}
        luminanceSmoothing={smoothing}
        mipmapBlur
      />
      <Vignette eskil={false} offset={vignetteOffset} darkness={vignetteDarkness} />
      {quality === "high" ? <SMAA /> : <></>}
    </EffectComposer>
  )
}
