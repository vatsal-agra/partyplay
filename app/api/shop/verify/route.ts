import { NextResponse } from "next/server"
import { paymentsConfigured, razorpay, shopAdmin, shopError, shopUser, validPaymentSignature } from "@/lib/shop-server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  if (!paymentsConfigured()) return NextResponse.json({ error: "payments_unconfigured" }, { status: 503 })
  try {
    const admin = shopAdmin()
    const user = await shopUser(req, admin)
    if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 })
    const body = await req.json().catch(() => null)
    const orderId = body?.razorpay_order_id
    const paymentId = body?.razorpay_payment_id
    const signature = body?.razorpay_signature
    if (typeof orderId !== "string" || !/^order_[a-zA-Z0-9]{1,80}$/.test(orderId) ||
        typeof paymentId !== "string" || !/^pay_[a-zA-Z0-9]{1,80}$/.test(paymentId) || typeof signature !== "string") {
      return NextResponse.json({ error: "invalid_payment" }, { status: 400 })
    }
    const { data: order, error } = await admin.from("shop_orders").select("id,user_id,amount,currency,cosmetic_id").eq("id", orderId).eq("user_id", user.id).single()
    if (error || !order) return NextResponse.json({ error: "order_not_found" }, { status: 404 })
    if (!validPaymentSignature(order.id, paymentId, signature)) return NextResponse.json({ error: "invalid_signature" }, { status: 400 })
    const payment = await razorpay(`payments/${paymentId}`)
    if (payment.id !== paymentId || payment.order_id !== order.id || payment.amount !== order.amount || payment.currency !== order.currency) {
      return NextResponse.json({ error: "payment_mismatch" }, { status: 400 })
    }
    if (payment.status !== "captured" || payment.captured !== true) return NextResponse.json({ error: "payment_not_captured" }, { status: 409 })
    const { error: grantError } = await admin.rpc("fulfill_shop_order", { p_order_id: order.id, p_payment_id: paymentId })
    if (grantError) throw grantError
    return NextResponse.json({ ok: true, itemId: order.cosmetic_id })
  } catch (error) {
    return shopError(error)
  }
}
