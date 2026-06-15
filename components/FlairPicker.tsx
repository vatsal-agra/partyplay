"use client"

import { useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import { X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AVATAR_EMOJIS, AVATAR_COLORS } from "@/components/Avatar"
import { ACHIEVEMENTS, getAchievement } from "@/lib/achievements"

export interface Flair {
  emoji: string | null
  color: string | null
  badge: string | null
}

// Lets a player customize how they show up everywhere: avatar emoji, colour,
// and a badge to wear as flair (only ones they've earned).
export function FlairPicker({
  client,
  userId,
  name,
  initial,
  earnedBadges,
  onClose,
  onSaved,
}: {
  client: SupabaseClient
  userId: string
  name?: string
  initial: Flair
  earnedBadges: string[]
  onClose: () => void
  onSaved: (flair: Flair) => void
}) {
  const [emoji, setEmoji] = useState<string | null>(initial.emoji)
  const [color, setColor] = useState<string | null>(initial.color || AVATAR_COLORS[0])
  const [badge, setBadge] = useState<string | null>(initial.badge)
  const [saving, setSaving] = useState(false)

  const wearable = earnedBadges.filter((id) => getAchievement(id))

  const save = async () => {
    setSaving(true)
    try {
      await client
        .from("profiles")
        .update({ avatar_emoji: emoji, avatar_color: color, equipped_badge: badge })
        .eq("id", userId)
      onSaved({ emoji, color, badge })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20">
          <X className="h-4 w-4" />
        </button>

        {/* Preview */}
        <div className="shrink-0 flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Avatar name={name} emoji={emoji} color={color} size={56} />
          <div>
            <p className="text-lg font-black text-white">{name || "You"}</p>
            {badge && getAchievement(badge) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                {getAchievement(badge)!.emoji} {getAchievement(badge)!.name}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Emoji */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Avatar</p>
            <div className="grid grid-cols-8 gap-1.5">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`grid aspect-square place-items-center rounded-lg text-xl transition ${
                    emoji === e ? "bg-brand scale-105" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Colour</p>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={`grid h-8 w-8 place-items-center rounded-full transition ${color === c ? "ring-2 ring-white scale-110" : ""}`}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Badge flair */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Wear a badge</p>
            {wearable.length === 0 ? (
              <p className="text-xs text-white/40">Earn badges by playing — then show one off here.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setBadge(null)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${badge === null ? "bg-brand text-white" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
                >
                  None
                </button>
                {wearable.map((id) => {
                  const a = getAchievement(id)!
                  return (
                    <button
                      key={id}
                      onClick={() => setBadge(id)}
                      title={a.description}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${badge === id ? "bg-brand text-white" : "bg-white/5 text-white/80 hover:bg-white/10"}`}
                    >
                      <span>{a.emoji}</span> {a.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 px-5 py-4">
          <Button onClick={save} disabled={saving} className="w-full bg-brand hover:brightness-110 font-bold">
            {saving ? "Saving…" : "Save flair"}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
