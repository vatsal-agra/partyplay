"use client"

// A player's avatar: their chosen emoji on their chosen colour, falling back to
// the first letter of their name on the brand gradient. Used everywhere a
// player shows up so flair travels with them.
export function Avatar({
  name,
  emoji,
  color,
  size = 40,
  className = "",
}: {
  name?: string
  emoji?: string | null
  color?: string | null
  size?: number
  className?: string
}) {
  const content = emoji || (name ? name.charAt(0).toUpperCase() : "?")
  const style: React.CSSProperties = {
    width: size,
    height: size,
    fontSize: emoji ? size * 0.55 : size * 0.42,
    ...(color ? { background: color } : {}),
  }
  return (
    <span
      style={style}
      className={`inline-grid place-items-center rounded-full font-bold text-white leading-none ${color ? "" : "bg-brand"} ${className}`}
    >
      {content}
    </span>
  )
}

// Curated picker options.
export const AVATAR_EMOJIS = [
  "🎲", "🎮", "🕹️", "👑", "🦊", "🐉", "🐙", "🦄", "🐸", "🐼", "🦁", "🐧",
  "👾", "🤖", "🦖", "🌮", "🍕", "⚡", "🔥", "💎", "🌈", "🍀", "🚀", "🎯",
]

export const AVATAR_COLORS = [
  "#7c5cff", "#ff4d9d", "#22d3ee", "#fbbf24", "#34e0a1", "#f97316",
  "#a78bfa", "#ef4444", "#14b8a6", "#ec4899", "#3b82f6", "#84cc16",
]
