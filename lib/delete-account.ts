import type { SupabaseClient } from "@supabase/supabase-js"

export async function deleteAccount(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.rpc("delete_my_account")
  if (error) throw new Error("Account deletion could not be confirmed. Please try again. If this continues, contact support.")
  if (data !== true) throw new Error("Account deletion was not confirmed. Please try again.")
}

export async function signOutDeletedAccount(client: SupabaseClient): Promise<void> {
  // The user no longer exists, so only the local session needs clearing.
  const { error } = await client.auth.signOut({ scope: "local" })
  if (error) throw new Error("Your account was deleted, but signing out failed. Please retry signing out.")
}
