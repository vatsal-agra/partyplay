// Shows a 2-minute warning before an idle party is auto-closed, and closes it
// when the timer runs out. Mounted on the party screen and the games (voting)
// screen. Polls the party's `last_active_at`; "Keep party alive" resets it.
"use client"

import { useEffect, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { touchParty, msUntilClose, PARTY_WARN_MS } from "@/lib/partyActivity"

interface Props {
  partyId: string | null
  isHost: boolean
  onClosed: () => void
}

export function PartyInactivityWarning({ partyId, isHost, onClosed }: Props) {
  const supabase = getSupabaseBrowserClient()
  const [remaining, setRemaining] = useState<number | null>(null)
  const lastActiveRef = useRef<string | null>(null)
  const closedRef = useRef(false)
  const onClosedRef = useRef(onClosed)
  useEffect(() => { onClosedRef.current = onClosed })

  const real = !!partyId && partyId !== "mock-party-id"

  // Poll the party's activity stamp (and detect external deletion).
  useEffect(() => {
    if (!real) return
    closedRef.current = false
    setRemaining(null)
    let alive = true
    const poll = async () => {
      try {
        const { data } = await supabase
          .from("parties")
          .select("last_active_at, created_at")
          .eq("id", partyId as string)
          .maybeSingle()
        if (!alive) return
        if (!data) {
          if (!closedRef.current) { closedRef.current = true; onClosedRef.current() }
          return
        }
        lastActiveRef.current = data.last_active_at || data.created_at || null
      } catch { /* ignore (pre-migration) */ }
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => { alive = false; clearInterval(id) }
  }, [real, partyId, supabase])

  // Tick every second: surface the warning, and close at zero.
  useEffect(() => {
    if (!real) return
    const tick = async () => {
      const stamp = lastActiveRef.current
      if (!stamp) { setRemaining(null); return }
      const ms = msUntilClose({ last_active_at: stamp })
      if (ms <= 0) {
        if (closedRef.current) return
        closedRef.current = true
        if (isHost) { try { await supabase.from("parties").delete().eq("id", partyId as string) } catch { /* ignore */ } }
        onClosedRef.current()
        return
      }
      setRemaining(ms <= PARTY_WARN_MS ? ms : null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [real, partyId, isHost, supabase])

  const keepAlive = async () => {
    await touchParty(supabase, partyId)
    lastActiveRef.current = new Date().toISOString()
    setRemaining(null)
  }

  if (!real || remaining === null) return null
  const secs = Math.ceil(remaining / 1000)

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass-strong w-full max-w-sm p-6 text-center">
        <h2 className="font-display text-xl font-bold text-white mb-2">Party about to close</h2>
        <p className="text-muted-foreground text-sm mb-1">
          This party has been idle. It will close automatically in
        </p>
        <p className="text-4xl font-black text-bubble-400 font-mono mb-4">{secs}s</p>
        <button
          onClick={keepAlive}
          className="w-full py-2.5 rounded-xl bg-brand text-white font-bold hover:brightness-110 active:scale-[0.98] transition"
        >
          Keep party alive
        </button>
      </div>
    </div>
  )
}
