"use client"

import { useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const MAX_DISPLAY_NAME = 24

// A profile with no display name (or a leftover "Guest") shows up as Guest
// everywhere. One compact card on the dashboard fixes that in a single field,
// writing profiles.display_name for the signed-in user.
export function DisplayNamePrompt({
  client,
  userId,
  onSaved,
}: {
  client: SupabaseClient
  userId: string
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()

  const save = async () => {
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    const clean = trimmed.slice(0, MAX_DISPLAY_NAME)
    const { error } = await client.from("profiles").update({ display_name: clean }).eq("id", userId)
    if (error) {
      setError("Could not save that name. Try again in a moment.")
      setSaving(false)
      return
    }
    onSaved(clean)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass shadow-soft mb-6 p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-aqua-400" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">What should we call you?</p>
          <p className="text-sm text-white/70">
            Pick the name your friends see on the leaderboard and in parties.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="mt-3 flex flex-wrap items-center gap-2"
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_DISPLAY_NAME}
          autoComplete="nickname"
          placeholder="Your name"
          aria-label="Display name"
          className="h-10 min-w-0 flex-1 sm:max-w-xs"
        />
        <Button type="submit" variant="brand" size="sm" disabled={!trimmed || saving} className="shrink-0">
          {saving ? "Saving…" : "Save name"}
        </Button>
      </form>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </motion.div>
  )
}
