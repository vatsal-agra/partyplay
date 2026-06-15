import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Refreshes the Supabase auth session on every request and writes the rotated
// tokens back into the response cookies. Without this, the cookie-based
// auth-helpers client (getSupabaseBrowserClient) never gets its access token
// refreshed, so the session silently expires and the user is asked to sign in
// again every time they reopen the site — even in the same browser.
export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  // Touching the session triggers a refresh + Set-Cookie on the response.
  await supabase.auth.getSession()
  return res
}

// Run on app pages but skip Next internals and static assets (anything with a
// file extension) to avoid needless work.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.).*)"],
}
