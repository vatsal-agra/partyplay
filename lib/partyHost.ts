// Host handoff helpers.
//
// The host of a party is whoever `parties.created_by` points at. Passing the
// host therefore has to be a real database update, not a React flag, or the
// next page load (and every other member's client) would disagree about who is
// in charge.
//
// `party_members.role` is kept in step because other screens still read it to
// decide who is host. The role rows are written BEFORE `created_by` moves,
// while the old host is still the one RLS recognises as able to edit them.

import type { SupabaseClient } from "@supabase/supabase-js"

export interface SeatedMember {
  id: string
  user_id: string
  joined_at?: string | null
}

export type LeaveOutcome = "left" | "handed-off" | "party-deleted"

export interface LeaveResult {
  outcome: LeaveOutcome
  newHostId?: string
  error?: string
}

// Who takes over when `leavingUserId` walks out: the member who has been
// seated longest. Ordering by joined_at with the membership row id as the
// tie-break keeps the choice stable across clients, so two people leaving at
// once cannot pick different successors.
export function pickSuccessor(members: SeatedMember[], leavingUserId: string): SeatedMember | null {
  const others = members.filter((m) => m.user_id !== leavingUserId)
  if (others.length === 0) return null
  return others.slice().sort((a, b) => {
    const at = a.joined_at ? new Date(a.joined_at).getTime() : 0
    const bt = b.joined_at ? new Date(b.joined_at).getTime() : 0
    if (at !== bt) return at - bt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })[0]
}

// Move the host role to another seated member. Returns an error string the
// caller can surface, or null on success.
export async function passHost(
  supabase: SupabaseClient,
  partyId: string,
  currentHostId: string,
  newHostId: string
): Promise<{ error: string | null }> {
  if (newHostId === currentHostId) return { error: null }

  // Best effort: the labels other screens read. A failure here is not worth
  // blocking the handoff, since created_by is the source of truth.
  try {
    await supabase
      .from("party_members")
      .update({ role: "leader" })
      .eq("party_id", partyId)
      .eq("user_id", newHostId)
    await supabase
      .from("party_members")
      .update({ role: "member" })
      .eq("party_id", partyId)
      .eq("user_id", currentHostId)
  } catch {
    /* role is cosmetic, created_by below is what counts */
  }

  const { error } = await supabase
    .from("parties")
    .update({ created_by: newHostId })
    .eq("id", partyId)
    .eq("created_by", currentHostId)

  if (error) return { error: error.message }
  return { error: null }
}

// Leave a party, handing the host over first if the leaver is the host and
// somebody is still seated. If the host is the last member the party is taken
// down, which is what ending a party already did.
export async function leaveParty(
  supabase: SupabaseClient,
  partyId: string,
  userId: string
): Promise<LeaveResult> {
  const { data: party, error: partyError } = await supabase
    .from("parties")
    .select("id, created_by")
    .eq("id", partyId)
    .single()

  if (partyError || !party) {
    return { outcome: "left", error: partyError?.message || "Party not found." }
  }

  const deleteOwnMembership = async () => {
    const { error } = await supabase
      .from("party_members")
      .delete()
      .eq("party_id", partyId)
      .eq("user_id", userId)
    return error?.message ?? null
  }

  if (party.created_by !== userId) {
    const error = await deleteOwnMembership()
    return error ? { outcome: "left", error } : { outcome: "left" }
  }

  const { data: members, error: membersError } = await supabase
    .from("party_members")
    .select("id, user_id, joined_at")
    .eq("party_id", partyId)

  if (membersError) return { outcome: "left", error: membersError.message }

  const successor = pickSuccessor((members || []) as SeatedMember[], userId)

  if (successor) {
    const { error: handoffError } = await passHost(supabase, partyId, userId, successor.user_id)
    if (handoffError) return { outcome: "left", error: handoffError }

    const error = await deleteOwnMembership()
    return error
      ? { outcome: "handed-off", newHostId: successor.user_id, error }
      : { outcome: "handed-off", newHostId: successor.user_id }
  }

  // Last one out: same two-step teardown the delete button already does.
  const { error: membersDeleteError } = await supabase
    .from("party_members")
    .delete()
    .eq("party_id", partyId)
  if (membersDeleteError) return { outcome: "left", error: membersDeleteError.message }

  const { error: partyDeleteError } = await supabase.from("parties").delete().eq("id", partyId)
  if (partyDeleteError) return { outcome: "left", error: partyDeleteError.message }

  return { outcome: "party-deleted" }
}
