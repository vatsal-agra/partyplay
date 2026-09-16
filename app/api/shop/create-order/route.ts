import { NextResponse } from "next/server"
import { paymentsConfigured, razorpay, shopAdmin, shopError, shopUser } from "@/lib/shop-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return paymentsConfigured()
    ? NextResponse.json({ configured: true })
    : NextResponse.json({ error: "payments_unconfigured" }, { status: 503 })
}

export async function POST(req: Request) {
  if (!paymentsConfigured()) return NextResponse.json({ error: "payments_unconfigured" }, { status: 503 })
  try {
    const admin = shopAdmin()
    const user = await shopUser(req, admin)
    if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 })
    const body = await req.json().catch(() => null)
    if (typeof body?.itemId !== "string" || body.itemId.length > 100) return NextResponse.json({ error: "invalid_item" }, { status: 400 })
    const { data: item, error } = await admin.from("cosmetics").select("id,price_paise").eq("id", body.itemId).eq("active", true).single()
    if (error || !item || item.price_paise <= 0) return NextResponse.json({ error: "invalid_item" }, { status: 400 })
    const { data: owned, error: ownershipError } = await admin.from("user_cosmetics").select("cosmetic_id").eq("user_id", user.id).eq("cosmetic_id", item.id).maybeSingle()
    if (ownershipError) throw ownershipError
    if (owned) return NextResponse.json({ error: "already_owned" }, { status: 409 })
    const order = await razorpay("orders", { amount: item.price_paise, currency: "INR", receipt: crypto.randomUUID() })
    if (!/^order_[a-zA-Z0-9]+$/.test(order.id) || order.amount !== item.price_paise || order.currency !== "INR") throw new Error("invalid_provider_order")
    const { error: storeError } = await admin.from("shop_orders").insert({ id: order.id, user_id: user.id, cosmetic_id: item.id, amount: item.price_paise, currency: "INR" })
    if (storeError) throw storeError
    return NextResponse.json({ orderId: order.id, amount: item.price_paise, currency: "INR", keyId: process.env.RAZORPAY_KEY_ID })
  } catch (error) {
    return shopError(error)
  }
}
