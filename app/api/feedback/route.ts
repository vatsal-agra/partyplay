import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Durable backup store for anonymous beta feedback. Email delivery happens
// client-side via Web3Forms (their free tier blocks server-side calls); this
// route just persists a copy to the feedback table so nothing is ever lost.

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
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (url && key) {
      const supabase = createClient(url, key)
      const { error } = await supabase.from("feedback").insert({ message, user_agent: userAgent, path })
      if (error) return NextResponse.json({ ok: false, store: error.message }, { status: 500 })
      return NextResponse.json({ ok: true, store: "stored" })
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, store: `${e?.message || e}` }, { status: 500 })
  }
  return NextResponse.json({ ok: false, store: "no supabase env" }, { status: 500 })
}
