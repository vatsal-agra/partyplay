import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co"
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"

export const supabase = createClient(supabaseUrl, supabaseKey)

let browserClient: ReturnType<typeof createClientComponentClient> | null = null

export function getSupabaseBrowserClient() {
  if (typeof window === "undefined") {
    return createClientComponentClient({
      supabaseUrl,
      supabaseKey,
    })
  }
  if (!browserClient) {
    browserClient = createClientComponentClient({
      supabaseUrl,
      supabaseKey,
    })
  }
  return browserClient
}
