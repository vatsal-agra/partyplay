import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Receives anonymous beta feedback and (1) emails it to the owner via Web3Forms
// and (2) stores it in the feedback table as a durable backup. No auth, no name
// required — just the message. Both sinks are best-effort: as long as one
// succeeds we report success so a visitor's feedback is never silently lost.
//
// The JSON response also reports stored/emailed + a diagnostic string so the
// owner can curl this endpoint to see exactly why email isn't arriving.

export async function POST(req: Request) {
  let message = ""
  let path = ""
  try {
    const body = await req.json()
    message = (body?.message || "").toString().trim()
    path = (body?.path || "").toString().slice(0, 200)
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  if (!message) return NextResponse.json({ error: "Empty feedback" }, { status: 400 })
  if (message.length > 4000) message = message.slice(0, 4000)

  const userAgent = req.headers.get("user-agent") || ""
  let stored = false
  let storeDetail = "no supabase env"
  let emailed = false
  let emailDetail = "no WEB3FORMS_ACCESS_KEY set"

  // 1) Durable backup in Supabase (anonymous insert allowed by RLS).
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { error } = await supabase.from("feedback").insert({ message, user_agent: userAgent, path })
      stored = !error
      storeDetail = error ? `db: ${error.message}` : "stored"
    }
  } catch (e: any) { storeDetail = `db error: ${e?.message || e}` }

  // 2) Email via Web3Forms. NOTE: Web3Forms returns HTTP 200 even on failure
  // (e.g. an unverified access key) and signals the real result in `success`.
  try {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY
    if (accessKey) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject: "🎲 New Dice Alley beta feedback",
          from_name: "Dice Alley Beta",
          name: "Dice Alley Beta",
          email: "feedback@dice-alley.app",
          message: `${message}\n\n— from ${path || "Dice Alley"}\n${userAgent}`,
        }),
      })
      const data = await res.json().catch(() => ({} as any))
      emailed = res.ok && data?.success === true
      emailDetail = emailed ? "sent" : `web3forms: ${data?.message || `HTTP ${res.status}`}`
    }
  } catch (e: any) { emailDetail = `email error: ${e?.message || e}` }

  const ok = stored || emailed
  return NextResponse.json(
    { ok, stored, emailed, store: storeDetail, email: emailDetail },
    { status: ok ? 200 : 500 }
  )
}
