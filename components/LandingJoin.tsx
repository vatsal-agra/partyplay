"use client"

import { useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { playAsGuest } from "@/lib/guest"
import { joinPartyByCode } from "@/lib/join-party"
import { parsePartyInvite } from "@/lib/parse-party-invite"
import { SITE_URL } from "@/lib/site"

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
    const invite = parsePartyInvite(code, [SITE_URL, window.location.origin])
    if (!invite) {
      setError("Paste a valid party code, invite link, or share message.")
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
      const partyId = invite.kind === "party" ? invite.partyId : await joinPartyByCode(client, invite.code)
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
        Have a party invite?
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id="landing-party-code"
          value={code}
          onChange={event => { setCode(event.target.value); setError(null) }}
          placeholder="Party code or invite link"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={joining}
          aria-invalid={!!error}
          aria-describedby={error ? "landing-join-error" : "landing-join-hint"}
          className="min-w-0"
        />
        <Button type="submit" variant="outline" disabled={joining || !code.trim()}>
          {joining ? "Joining..." : "Join party"}
        </Button>
      </div>
      <p id="landing-join-hint" className="mt-2 text-xs text-muted-foreground">
        Paste a code, link, or share message. No account? Join as a guest.
      </p>
      {error && <p id="landing-join-error" role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </form>
  )
}
