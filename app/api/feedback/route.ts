import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Receives anonymous beta feedback and (1) emails it to the owner via Web3Forms
// and (2) stores it in the feedback table as a durable backup. No auth, no name
// required — just the message. Both sinks are best-effort: as long as one
// succeeds we report success so a visitor's feedback is never silently lost.

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
  let emailed = false

  // 1) Durable backup in Supabase (anonymous insert allowed by RLS).
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { error } = await supabase.from("feedback").insert({ message, user_agent: userAgent, path })
      stored = !error
    }
  } catch { /* table may not exist yet — ignore */ }

  // 2) Email via Web3Forms (sends to the address the access key is registered to).
  try {
    const accessKey = process.env.WEB3FORMS_ACCESS_KEY
    if (accessKey) {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: accessKey,
          subject: "🎲 New PartyPlay beta feedback",
          from_name: "PartyPlay Beta",
          message: `${message}\n\n— from ${path || "PartyPlay"}\n${userAgent}`,
        }),
      })
      emailed = res.ok
    }
  } catch { /* network/email issue — the Supabase copy still has it */ }

  if (stored || emailed) return NextResponse.json({ ok: true })
  return NextResponse.json({ error: "Could not record feedback" }, { status: 500 })
}
