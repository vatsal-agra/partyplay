import type { SupabaseClient } from "@supabase/supabase-js"

// Guest play with zero friction: tap link → type a name → playing. Backed by
// Supabase anonymous auth, so a guest gets a real session/user id and can join
// parties, vote, and play exactly like a signed-up user — they just skipped the
// form. They can create a full account later to keep their progress.
//
// REQUIRES: "Anonymous sign-ins" enabled in the Supabase dashboard
// (Authentication → Sign In / Providers → Anonymous).

function randomSuffix(): string {
  // 4 lowercase-alphanumeric chars; avoids profile username collisions.
  return Math.random().toString(36).slice(2, 6)
}

export async function playAsGuest(
  client: SupabaseClient,
  rawName: string
): Promise<{ error: string | null }> {
  const name = (rawName || "").trim().slice(0, 24) || "Guest"
  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "") || "guest"
  // Unique username for the profiles table; display_name stays the clean name.
  const username = `${slug}-${randomSuffix()}`

  const { data, error } = await client.auth.signInAnonymously({
    options: { data: { username, display_name: name, is_guest: true } },
  })

  if (error) {
    return {
      error:
        /anonymous|disabled|not enabled/i.test(error.message)
          ? "Guest play isn't enabled yet. (Admin: turn on Anonymous sign-ins in Supabase.)"
          : error.message,
    }
  }

  // The new-user trigger sets display_name = username; correct it to the clean
  // name the guest typed. Best-effort.
  const uid = data.user?.id
  if (uid) {
    try { await client.from("profiles").update({ display_name: name }).eq("id", uid) } catch { /* ignore */ }
  }
  return { error: null }
}

export function isGuestSession(session: any): boolean {
  return !!session?.user && (session.user.is_anonymous === true || session.user.user_metadata?.is_guest === true)
}
