"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { playAsGuest } from "@/lib/guest"
import { joinPartyByCode } from "@/lib/join-party"

export function LandingJoin() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current) return
    setError(null)
    if (!/^[0-9A-F]{6}$/i.test(code.trim())) {
      setError("Please enter a valid 6-character party code.")
      return
    }
    pending.current = true
    setJoining(true)
    try {
      const client = getSupabaseBrowserClient()
      const { data: { session }, error: sessionError } = await client.auth.getSession()
      if (sessionError) throw sessionError
      if (!session) {
        const { error: guestError } = await playAsGuest(client, "Guest")
        if (guestError) throw new Error(guestError)
      }
      const partyId = await joinPartyByCode(client, code)
      router.push(`/party/${partyId}`)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to join party. Please try again.")
    } finally {
      pending.current = false
      setJoining(false)
    }
  }

  return (
    <form onSubmit={handleJoin} className="mt-6 max-w-sm mx-auto lg:mx-0 text-left" aria-busy={joining}>
      <label htmlFor="landing-party-code" className="text-sm font-medium text-white">
        Have a party code?
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id="landing-party-code"
          value={code}
          onChange={event => { setCode(event.target.value.toUpperCase()); setError(null) }}
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={joining}
          aria-invalid={!!error}
          aria-describedby={error ? "landing-join-error" : "landing-join-hint"}
          className="min-w-0 font-mono uppercase tracking-widest"
        />
        <Button type="submit" variant="outline" disabled={joining || !code.trim()}>
          {joining ? "Joining..." : "Join party"}
        </Button>
      </div>
      <p id="landing-join-hint" className="mt-2 text-xs text-muted-foreground">
        No account? You will join as a guest.
      </p>
      {error && <p id="landing-join-error" role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  )
}
