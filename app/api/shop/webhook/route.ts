import { NextResponse } from "next/server"
import { paymentsConfigured, shopAdmin, shopError, validWebhookSignature } from "@/lib/shop-server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!paymentsConfigured() || !secret) return NextResponse.json({ error: "payments_unconfigured" }, { status: 503 })
  try {
    const rawBody = Buffer.from(await req.arrayBuffer())
    if (!validWebhookSignature(rawBody, req.headers.get("x-razorpay-signature") ?? "", secret)) {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 })
    }
    let body
    try {
      body = JSON.parse(rawBody.toString("utf8"))
    } catch {
      return NextResponse.json({ error: "invalid_webhook" }, { status: 400 })
    }
    if (!body || typeof body.event !== "string") return NextResponse.json({ error: "invalid_webhook" }, { status: 400 })
    if (body.event !== "payment.captured") return NextResponse.json({ ok: true })
    const payment = body.payload?.payment?.entity
    if (typeof payment?.order_id !== "string" || !/^order_[a-zA-Z0-9]{1,80}$/.test(payment.order_id) ||
        typeof payment?.id !== "string" || !/^pay_[a-zA-Z0-9]{1,80}$/.test(payment.id)) {
      return NextResponse.json({ error: "invalid_payment" }, { status: 400 })
    }
    const admin = shopAdmin()
    const { data: order, error } = await admin.from("shop_orders").select("id,amount,currency").eq("id", payment.order_id).maybeSingle()
    if (error) throw error
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 })
    if (payment.amount !== order.amount || payment.currency !== order.currency) {
      return NextResponse.json({ error: "payment_mismatch" }, { status: 400 })
    }
    if (payment.status !== "captured" || payment.captured !== true) return NextResponse.json({ error: "payment_not_captured" }, { status: 409 })
    const { error: grantError } = await admin.rpc("fulfill_shop_order", { p_order_id: order.id, p_payment_id: payment.id })
    if (grantError) throw grantError
    return NextResponse.json({ ok: true })
  } catch (error) {
    return shopError(error)
  }
}
