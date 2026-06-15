// Party inactivity helpers.
//
// A party is considered "active" while members do things (vote, chat, launch).
// After PARTY_TTL_MS of no activity it is closed — a 2-minute warning is shown
// to anyone still on screen, and stale parties are deleted lazily on load.
//
// All calls are defensive: if the `last_active_at` migration hasn't been
// applied yet, errors are swallowed so the app keeps working.

import type { SupabaseClient } from "@supabase/supabase-js"

export const PARTY_TTL_MS = 60 * 60 * 1000          // 1 hour of inactivity
export const PARTY_WARN_MS = 2 * 60 * 1000          // warn 2 minutes before closing

const isReal = (partyId?: string | null) =>
  !!partyId && partyId !== "mock-party-id"

// Bump a party's activity timestamp. Call on meaningful member actions.
export async function touchParty(supabase: SupabaseClient, partyId?: string | null) {
  if (!isReal(partyId)) return
  try {
    await supabase
      .from("parties")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", partyId as string)
  } catch {
    /* column may not exist yet — ignore */
  }
}

// Delete the user's parties that have been idle past the TTL.
export async function cleanupStaleParties(supabase: SupabaseClient, userId?: string | null) {
  if (!userId) return
  const cutoff = new Date(Date.now() - PARTY_TTL_MS).toISOString()
  try {
    await supabase
      .from("parties")
      .delete()
      .eq("created_by", userId)
      .lt("last_active_at", cutoff)
  } catch {
    /* column may not exist yet — ignore */
  }
}

// How long until a party is auto-closed, in ms (clamped at 0). Falls back to
// created_at if last_active_at is missing (pre-migration).
export function msUntilClose(party: { last_active_at?: string | null; created_at?: string | null }): number {
  const stamp = party.last_active_at || party.created_at
  if (!stamp) return PARTY_TTL_MS
  const age = Date.now() - new Date(stamp).getTime()
  return Math.max(0, PARTY_TTL_MS - age)
}
