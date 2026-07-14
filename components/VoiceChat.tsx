"use client"

import { useEffect, useMemo, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { AnimatePresence, motion } from "framer-motion"
import { Mic, MicOff, PhoneOff, Loader2, Headphones, Volume2, Minus } from "lucide-react"
import { useVoiceChat } from "@/lib/useVoiceChat"

interface MemberLike {
  user_id: string
  profile?: { username?: string; display_name?: string }
}

// Floating, always-accessible voice widget for a game/party room. Self-contained:
// it owns its own Supabase signalling channel and renders both the controls and
// the live participant list.
export function VoiceChat({
  client,
  roomId,
  userId,
  members,
}: {
  client: SupabaseClient
  roomId: string
  userId: string
  members: MemberLike[]
}) {
  const { joined, connecting, muted, error, participants, selfSpeaking, join, leave, toggleMute } =
    useVoiceChat({ client, roomId, userId, enabled: true })

  // Collapsible so it never blocks a game's bottom-left controls. Remembered
  // across navigations.
  const [minimized, setMinimized] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem("da_voice_min") === "1") setMinimized(true) } catch {}
  }, [])
  const setMin = (v: boolean) => {
    setMinimized(v)
    try { localStorage.setItem("da_voice_min", v ? "1" : "0") } catch {}
  }

  const nameOf = useMemo(() => {
    const map: Record<string, string> = {}
    members.forEach((m) => {
      map[m.user_id] = m.profile?.display_name || m.profile?.username || "Player"
    })
    return (id: string) => (id === userId ? "You" : map[id] || "Player")
  }, [members, userId])

  const others = Object.values(participants)
  const connectedCount = others.filter((p) => p.connected).length

  // Collapsed: a small pill that stays out of the way of game controls.
  if (minimized) {
    return (
      <button
        onClick={() => setMin(false)}
        title="Open voice"
        className="glass-strong fixed bottom-4 left-4 z-40 flex select-none items-center gap-2 rounded-full px-3 py-2 shadow-soft transition hover:brightness-110"
      >
        <Headphones className="h-4 w-4 text-aqua-400" />
        <span className="text-xs font-semibold text-white">Voice</span>
        {joined && <span className="flex items-center gap-1 text-[10px] font-bold text-mint-400"><span className="h-1.5 w-1.5 rounded-full bg-mint-400" />{connectedCount + 1}</span>}
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[230px] select-none">
      <div className="glass-strong overflow-hidden rounded-2xl shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2 text-white">
            <Headphones className="h-4 w-4 text-aqua-400" />
            <span className="text-sm font-semibold">Voice</span>
            {joined && (
              <span className="text-[11px] text-white/50">· {connectedCount + 1} in call</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {joined && (
              <button
                onClick={leave}
                title="Leave voice"
                className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setMin(true)}
              title="Minimise"
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {!joined ? (
            <div className="space-y-2">
              <button
                onClick={join}
                disabled={connecting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white shadow hover:brightness-110 disabled:opacity-60"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                {connecting ? "Joining…" : "Join Voice"}
              </button>
              <p className="text-[11px] leading-snug text-white/45">
                Talk with your party while you play. Your mic is only on while you&apos;re in the call.
              </p>
              {error && <p className="text-[11px] text-red-300">{error}</p>}
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Participant list */}
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-0.5">
                {/* Self */}
                <Tile name="You" speaking={selfSpeaking} muted={muted} connected />
                {/* Others */}
                <AnimatePresence>
                  {others.map((p) => (
                    <motion.div
                      key={p.userId}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <Tile name={nameOf(p.userId)} speaking={p.speaking} muted={p.muted} connected={p.connected} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {others.length === 0 && (
                  <p className="px-1 py-1 text-[11px] text-white/40">Waiting for others to join…</p>
                )}
              </div>

              {/* Mic toggle */}
              <button
                onClick={toggleMute}
                className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${
                  muted
                    ? "bg-red-500/20 text-red-200 hover:bg-red-500/30"
                    : "bg-white/10 text-white hover:bg-white/15"
                }`}
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Tile({ name, speaking, muted, connected }: { name: string; speaking: boolean; muted: boolean; connected: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-2 py-1.5">
      <span
        className={`relative grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white transition-shadow ${
          speaking && !muted ? "ring-2 ring-mint-400 shadow-[0_0_10px_rgba(52,224,161,0.7)]" : ""
        }`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="flex-1 truncate text-sm text-white">{name}</span>
      {muted ? (
        <MicOff className="h-3.5 w-3.5 text-red-300" />
      ) : speaking ? (
        <Volume2 className="h-3.5 w-3.5 text-mint-400" />
      ) : !connected ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
      ) : (
        <Mic className="h-3.5 w-3.5 text-white/40" />
      )}
    </div>
  )
}
