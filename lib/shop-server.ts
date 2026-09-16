import "server-only"
import { createClient } from "@supabase/supabase-js"
import { createHmac, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

export function paymentsConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function shopAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("shop_unconfigured")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function shopUser(req: Request, admin: ReturnType<typeof shopAdmin>) {
  const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  return error ? null : data.user
}

export async function razorpay(path: string, body?: unknown) {
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error("payment_provider_unavailable")
  return response.json()
}

export function validPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest()
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
}

export function shopError(error: unknown) {
  const message = error instanceof Error ? error.message : ""
  if (message === "shop_unconfigured") return NextResponse.json({ error: message }, { status: 503 })
  return NextResponse.json({ error: "shop_request_failed" }, { status: 502 })
}

export function validWebhookSignature(body: Buffer, signature: string, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false
  const expected = createHmac("sha256", secret).update(body).digest()
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
}
