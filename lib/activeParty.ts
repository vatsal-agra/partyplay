"use client"

// The party the signed-in user is most likely to want back: the one they
// hosted or joined most recently. The dashboard "Jump back in" card and the
// nav link share pickLatestParty so both agree on what "most recent" means.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

export type ActiveParty = { id: string; name: string }

type Membership = { party_id: string; joined_at?: string | null }

// Hosted parties rank by when they were created, joined parties by when the
// user joined them.
export function pickLatestParty<T extends { id: string; created_at: string }>(
  hosted: T[],
  joined: T[],
  memberships: Membership[]
): T | null {
  const joinedAt = new Map<string, string | null | undefined>(
    memberships.map((m) => [m.party_id, m.joined_at])
  )
  const candidates = [
    ...hosted.map((party) => ({ party, timestamp: party.created_at })),
    ...joined.map((party) => ({ party, timestamp: joinedAt.get(party.id) || party.created_at })),
  ]
  candidates.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  return candidates[0]?.party || null
}

// Lighter than PartyManager's fetch: only what the nav link needs.
export async function fetchLatestParty(
  supabase: SupabaseClient,
  userId?: string | null
): Promise<ActiveParty | null> {
  if (!userId) return null

  const { data: hosted, error: hostedError } = await supabase
    .from("parties")
    .select("id, name, created_at")
    .eq("created_by", userId)
  if (hostedError) throw hostedError

  const { data: memberships, error: membershipError } = await supabase
    .from("party_members")
    .select("party_id, joined_at")
    .eq("user_id", userId)
  if (membershipError) throw membershipError

  const memberPartyIds = (memberships || [])
    .map((m) => m.party_id)
    .filter((id) => !(hosted || []).some((h) => h.id === id))

  let joined: { id: string; name: string; created_at: string }[] = []
  if (memberPartyIds.length > 0) {
    const { data: joinedData, error: joinedError } = await supabase
      .from("parties")
      .select("id, name, created_at")
      .in("id", memberPartyIds)
    if (joinedError) throw joinedError
    joined = joinedData || []
  }

  const latest = pickLatestParty(hosted || [], joined, memberships || [])
  return latest ? { id: latest.id, name: latest.name } : null
}

// Null while signed out, with no party, or if the lookup fails: the nav link
// is an extra, never something that can break the header.
export function useActiveParty(): ActiveParty | null {
  const [party, setParty] = useState<ActiveParty | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let disposed = false
    let revision = 0
    let unsubscribe: (() => void) | undefined

    try {
      const client = getSupabaseBrowserClient()
      const load = async (userId?: string | null) => {
        const request = ++revision
        try {
          const latest = await fetchLatestParty(client, userId)
          if (!disposed && request === revision) setParty(latest)
        } catch {
          if (!disposed && request === revision) setParty(null)
        }
      }

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // Leave the auth callback before making further Supabase requests.
        void Promise.resolve().then(() => load(session?.user.id))
      })
      unsubscribe = () => data.subscription.unsubscribe()

      const initialRevision = revision
      void client.auth.getSession().then(({ data, error }) => {
        if (!disposed && revision === initialRevision) void load(error ? undefined : data.session?.user.id)
      }).catch(() => {
        if (!disposed && revision === initialRevision) setParty(null)
      })
    } catch {
      setParty(null)
    }

    return () => {
      disposed = true
      revision++
      unsubscribe?.()
    }
    // Re-checked on navigation so creating, joining or leaving a party is
    // reflected as soon as the user moves around.
  }, [pathname])

  return party
}
