import type { SupabaseClient } from "@supabase/supabase-js"

// Use the same session and RLS-visible parties as the dashboard join flow.
export async function joinPartyByCode(client: SupabaseClient, code: string): Promise<string> {
  const cleanCode = code.trim().toUpperCase()
  if (!/^[0-9A-F]{6}$/.test(cleanCode)) {
    throw new Error("Please enter a valid 6-character party code.")
  }

  const { data: { session }, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!session?.user?.id) throw new Error("You must be signed in to join a party.")
  const userId = session.user.id

  const { data: parties, error: fetchError } = await client.from("parties").select("*")
  if (fetchError) throw fetchError
  const party = parties?.find(p => p.id.substring(0, 6).toUpperCase() === cleanCode)
  if (!party) throw new Error("Party not found. Please check the code and try again.")

  const { data: member, error: memberError } = await client
    .from("party_members").select("*")
    .eq("party_id", party.id).eq("user_id", userId).maybeSingle()
  if (memberError) throw memberError
  if (member) return party.id

  const { count, error: countError } = await client
    .from("party_members").select("*", { count: "exact", head: true })
    .eq("party_id", party.id)
  if (countError) throw countError
  if ((count || 0) >= party.max_players) throw new Error("This party is already full.")

  const { error: joinError } = await client.from("party_members").insert({
    party_id: party.id,
    user_id: userId,
    role: "member",
    joined_at: new Date().toISOString(),
  })
  if (joinError) throw joinError
  return party.id
}
