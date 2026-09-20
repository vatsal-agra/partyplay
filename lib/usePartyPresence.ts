import { useEffect, useMemo, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"

// Live "who has this party page open" tracking, on a channel of its own so it
// never competes with the party's database-change channel or with voice chat.
//
// The presence key is the signed-in user id, so a person with the party open in
// three tabs still counts once: Supabase files every tab under that one key and
// only drops the key when the last of them goes away.
//
// This is deliberately one-directional. A user id in the returned set means we
// have seen that tab recently. A user id missing from it means nothing at all:
// a backgrounded phone or a throttled tab can stop heartbeating while the
// person is very much still there, so callers should show a badge for presence
// and simply show nothing for absence.
export function usePartyPresence(
  supabase: SupabaseClient<any, any, any>,
  partyId: string | null | undefined,
  userId: string | null | undefined,
): Set<string> {
  const [onlineIds, setOnlineIds] = useState<string[]>([])

  useEffect(() => {
    if (!partyId || !userId) {
      setOnlineIds([])
      return
    }

    let cancelled = false
    const channel = supabase.channel(`party-presence:${partyId}`, {
      config: { presence: { key: userId } },
    })

    const syncPresence = () => {
      if (cancelled) return
      const state = channel.presenceState()
      setOnlineIds(Object.keys(state).sort())
    }

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("presence", { event: "join" }, syncPresence)
      .on("presence", { event: "leave" }, syncPresence)
      .subscribe((status) => {
        // Fires again after a dropped socket reconnects, so re-tracking here
        // is what puts us back on the list instead of silently vanishing.
        if (status !== "SUBSCRIBED" || cancelled) return
        channel.track({ user_id: userId, online_at: new Date().toISOString() })
      })

    return () => {
      cancelled = true
      setOnlineIds([])
      // untrack() drops this tab's entry promptly. Unsubscribing alone would
      // get there eventually, but leaving it to the socket teardown means
      // everyone else stares at a stale badge in the meantime. Tear the
      // channel down once untrack has settled, either way.
      channel
        .untrack()
        .catch(() => { /* channel already gone */ })
        .then(() => { supabase.removeChannel(channel) })
    }
  }, [supabase, partyId, userId])

  return useMemo(() => new Set(onlineIds), [onlineIds])
}
