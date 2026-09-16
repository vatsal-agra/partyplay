"use client"

import Link from "next/link"
import Script from "next/script"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Dice5, Layers, ShoppingBag, Sparkles } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { equipCosmetic, formatINR, listOwnedCosmetics, listShopItems, unlockStarterCosmetics, type Cosmetic, type OwnedCosmetic } from "@/lib/shop"

type PaymentProof = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type CheckoutOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string; description: string
  theme: { color: string }; handler: (proof: PaymentProof) => void; modal: { ondismiss: () => void }
}
declare global {
  interface Window { Razorpay?: new (options: CheckoutOptions) => { open: () => void; on: (event: string, handler: () => void) => void } }
}

const categories = { felt: "Table felt", token: "Token skin", card_back: "Card backs", flair: "Name flair" }

export default function ShopPage() {
  const client = useMemo(() => getSupabaseBrowserClient(), [])
  const [items, setItems] = useState<Cosmetic[]>([])
  const [owned, setOwned] = useState<OwnedCosmetic[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState(false)
  const [checkoutReady, setCheckoutReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [pending, setPending] = useState<PaymentProof | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { user } } = await client.auth.getUser()
      setUserId(user?.id || null)
      setItems(await listShopItems(client))
      if (user) {
        await unlockStarterCosmetics(client)
        setOwned(await listOwnedCosmetics(client, user.id))
        try {
          const saved = localStorage.getItem(`dice-shop-payment:${user.id}`)
          if (saved) setPending(JSON.parse(saved))
        } catch { /* Storage may be unavailable. In-memory recovery still works. */ }
      } else { setOwned([]); setPending(null) }
    } catch {
      setMessage("The shop could not load. Please try again.")
    } finally { setLoading(false) }
  }, [client])

  useEffect(() => {
    void load()
    fetch("/api/shop/create-order", { cache: "no-store" })
      .then(response => setPayments(response.ok)).catch(() => setPayments(false))
  }, [load])

  async function post(path: string, body: unknown) {
    const { data: { session } } = await client.auth.getSession()
    if (!session) throw new Error("Sign in to continue.")
    const response = await fetch(`/api/shop/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body),
    })
    const result = await response.json()
    if (response.status === 503) {
      setPayments(false)
      throw new Error("Payments coming online")
    }
    if (!response.ok) {
      if (result.error === "payment_not_captured") throw new Error("Your payment is awaiting capture. Retry verification shortly; do not pay again.")
      if (result.error === "already_owned") throw new Error("You already own this item. Refresh the shop.")
      throw new Error(path === "verify" ? "Payment verification could not finish. Retry verification; do not pay again." : "Checkout could not start. Please try again.")
    }
    return result
  }

  async function verify(proof: PaymentProof) {
    setPending(proof)
    setBusy("verify")
    try { localStorage.setItem(`dice-shop-payment:${userId}`, JSON.stringify(proof)) } catch { /* Optional recovery storage. */ }
    try {
      await post("verify", proof)
      setPending(null)
      try { localStorage.removeItem(`dice-shop-payment:${userId}`) } catch { /* Optional recovery storage. */ }
      setOwned(await listOwnedCosmetics(client, userId!))
      setMessage("Added to your collection. Ready to equip.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Verification failed. Please retry.") }
    finally { setBusy(null) }
  }

  async function buy(item: Cosmetic) {
    if (!window.Razorpay || !userId) return
    setBusy(item.id)
    setMessage("")
    try {
      const order = await post("create-order", { itemId: item.id })
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: "Dice Alley", description: item.name, theme: { color: "#d4a843" },
        handler: proof => { void verify(proof) }, modal: { ondismiss: () => setBusy(null) },
      })
      checkout.on("payment.failed", () => { setBusy(null); setMessage("Payment did not complete. No item has been granted.") })
      checkout.open()
    } catch (error) { setBusy(null); setMessage(error instanceof Error ? error.message : "Checkout failed.") }
  }

  async function equip(item: Cosmetic) {
    setBusy(item.id)
    try {
      await equipCosmetic(client, item.id)
      setOwned(await listOwnedCosmetics(client, userId!))
      setMessage(`${item.name} equipped in your collection.`)
    } catch { setMessage("Could not equip this item. Please try again.") }
    finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-6xl py-8 text-white">
      {payments && <Script src="https://checkout.razorpay.com/v1/checkout.js" onReady={() => setCheckoutReady(true)} onError={() => setMessage("Checkout could not load. Please refresh to try again.")} />}
      <Link href="/dashboard" className="text-sm text-amber-200/70 hover:text-amber-200">Back to dashboard</Link>
      <header className="my-8 rounded-3xl border border-amber-200/20 bg-gradient-to-br from-amber-900/20 via-zinc-950 to-zinc-900 p-8 sm:p-12">
        <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-300"><ShoppingBag size={16} /> The Dice Alley collection</div>
        <h1 className="font-display text-4xl font-bold sm:text-5xl">Make it your table.</h1>
        <p className="mt-4 max-w-xl text-zinc-300">A little character for game night. Collect felt, tokens, card backs and flair. Purely cosmetic, always a level playing field.</p>
        <p className="mt-5 text-sm text-amber-200">Your starter felt and token are on the house.</p>
        <p className="mt-2 text-xs text-zinc-400">Equipped choices are saved to your collection. In-game rendering is coming later.</p>
      </header>
      {!userId && !loading && <p className="mb-6 text-zinc-300"><Link href="/auth/sign-in" className="text-amber-300 underline">Sign in</Link> to unlock your free starters and build your collection.</p>}
      {!payments && <p className="mb-6 rounded-xl border border-amber-200/15 bg-amber-200/5 px-5 py-3 text-sm text-amber-200">Payments coming online. Your free starters are ready now.</p>}
      {message && <p role="status" aria-live="polite" className="mb-5 rounded-xl bg-white/5 p-4 text-sm text-amber-100">{message}</p>}
      {pending && <button disabled={!!busy} onClick={() => void verify(pending)} className="mb-6 rounded-xl border border-amber-300 px-5 py-3 text-amber-200 disabled:opacity-50">Retry payment verification</button>}
      {loading ? <p role="status" className="py-12 text-center text-zinc-400">Opening the collection...</p> : items.length === 0 ? <button onClick={() => void load()} className="rounded-xl border border-amber-200/30 px-5 py-3">Reload shop</button> : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const ownership = owned.find(row => row.cosmetic_id === item.id)
            const Icon = item.category === "card_back" ? Layers : item.category === "flair" ? Sparkles : Dice5
            return (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-amber-100/15 bg-zinc-950/80">
                <div className="relative flex h-44 items-center justify-center border-b border-white/10" style={{ background: `radial-gradient(ellipse at center, ${item.preview_color}80, #101012)` }}>
                  <div className={`grid h-24 w-32 place-items-center border-2 border-amber-200/40 shadow-lg ${item.category === "felt" ? "rounded-[45%]" : "rounded-2xl"}`} style={{ backgroundColor: item.preview_color }}><Icon size={42} className="text-white drop-shadow-lg" aria-hidden="true" /></div>
                  {item.starter && <span className="absolute left-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs text-amber-100">Free starter</span>}
                  {ownership?.equipped && <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-3 py-1 text-xs text-amber-200"><Check size={12} /> Equipped</span>}
                </div>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-widest text-amber-200/60">{categories[item.category]}</p>
                  <h2 className="mt-2 text-xl font-semibold">{item.name}</h2>
                  <p className="mt-2 min-h-[3rem] text-sm text-zinc-400">{item.description}</p>
                  <p className="my-5 text-xl font-semibold text-amber-200">{item.price_paise === 0 ? "Free" : formatINR(item.price_paise)}<span className="ml-2 text-xs font-normal text-zinc-500">{ownership ? "Owned" : "One-time unlock"}</span></p>
                  <button
                    className="w-full rounded-xl border border-amber-200/30 bg-amber-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-400"
                    disabled={!!busy || !userId || !!ownership?.equipped || (!ownership && (!payments || !checkoutReady || !!pending || item.price_paise === 0))}
                    onClick={() => ownership ? void equip(item) : void buy(item)}
                  >{busy === item.id ? "Working..." : ownership?.equipped ? "Equipped" : ownership ? "Equip" : item.starter ? "Sign in to unlock" : !payments ? "Payments coming online" : !userId ? "Sign in to buy" : !checkoutReady ? "Loading checkout..." : "Buy pack"}</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
