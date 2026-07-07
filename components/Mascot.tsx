"use client"

import { motion } from "framer-motion"

type Mood = "idle" | "happy" | "think" | "cheer"

// Rolly — Dice Alley's dice mascot. A friendly cube with a face that bobs,
// tilts, and reacts. Pure SVG + framer-motion, no assets.
export function Mascot({
  mood = "idle",
  size = 96,
  className = "",
}: {
  mood?: Mood
  size?: number
  className?: string
}) {
  const bob = mood === "cheer"
    ? { y: [0, -14, 0], rotate: [0, -6, 6, 0] }
    : mood === "happy"
      ? { y: [0, -8, 0], rotate: [0, 3, -3, 0] }
      : mood === "think"
        ? { y: [0, -3, 0], rotate: [-4, -4, -4] }
        : { y: [0, -6, 0], rotate: [0, 2, -2, 0] }

  const dur = mood === "cheer" ? 0.9 : mood === "happy" ? 1.6 : 2.6
  const eyeY = mood === "think" ? 40 : 42
  const browTilt = mood === "think" ? -8 : 0

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      animate={bob}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <defs>
        <linearGradient id="rolly-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8c987" />
          <stop offset="55%" stopColor="#d6a85c" />
          <stop offset="100%" stopColor="#b98a4a" />
        </linearGradient>
        <filter id="rolly-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Cube body */}
      <g filter="url(#rolly-shadow)">
        <rect x="18" y="18" width="64" height="64" rx="16" fill="url(#rolly-face)" />
        <rect x="18" y="18" width="64" height="64" rx="16" fill="#fff" opacity="0.06" />
      </g>

      {/* Eyes */}
      <g fill="#1b1230">
        <motion.ellipse
          cx="38" cy={eyeY} rx="6" ry="7"
          animate={{ ry: [7, 1.5, 7] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.04, 0.08], repeatDelay: 2.5 }}
        />
        <motion.ellipse
          cx="62" cy={eyeY} rx="6" ry="7"
          animate={{ ry: [7, 1.5, 7] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.04, 0.08], repeatDelay: 2.5 }}
        />
        {/* eye sparkle */}
        <circle cx="40" cy={eyeY - 2} r="1.6" fill="#fff" />
        <circle cx="64" cy={eyeY - 2} r="1.6" fill="#fff" />
      </g>

      {/* Brows (tilt when thinking) */}
      <g stroke="#1b1230" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${browTilt} 50 32)`}>
        <line x1="32" y1="31" x2="44" y2="31" />
        <line x1="56" y1="31" x2="68" y2="31" />
      </g>

      {/* Mouth */}
      {mood === "cheer" || mood === "happy" ? (
        <path d="M38 58 Q50 70 62 58" fill="#1b1230" />
      ) : mood === "think" ? (
        <circle cx="50" cy="60" r="3.5" fill="#1b1230" />
      ) : (
        <path d="M40 60 Q50 66 60 60" stroke="#1b1230" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}

      {/* Cheeks */}
      <circle cx="30" cy="54" r="4" fill="#ff7eb6" opacity="0.55" />
      <circle cx="70" cy="54" r="4" fill="#ff7eb6" opacity="0.55" />
    </motion.svg>
  )
}
