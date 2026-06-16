"use client"

import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { playAsGuest } from "@/lib/guest"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestName, setGuestName] = useState("")
  const [guestLoading, setGuestLoading] = useState(false)
  const router = useRouter()

  const supabaseClient = getSupabaseBrowserClient()

  const handleGuest = async () => {
    setGuestLoading(true)
    setError(null)
    const { error } = await playAsGuest(supabaseClient, guestName)
    if (error) { setError(error); setGuestLoading(false); return }
    await new Promise((r) => setTimeout(r, 600))
    router.push("/dashboard")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Wait for auth state to update
      await new Promise((resolve) => setTimeout(resolve, 1000))
      router.push("/dashboard")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-white">
            Welcome back 👋
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            New here?{' '}
            <a href="/auth/sign-up" className="font-semibold text-grape-300 hover:text-grape-200 hover:underline">
              Create an account
            </a>
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" variant="brand" className="w-full" size="lg" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="relative flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            supabaseClient.auth.signInWithOAuth({ provider: "google" })
          }}
        >
          Continue with Google
        </Button>

        {/* Guest play — no signup needed */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs font-medium text-white/70">In a hurry? Jump in as a guest — just pick a name.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuest()}
              maxLength={24}
            />
            <Button type="button" variant="brand" onClick={handleGuest} disabled={guestLoading} className="shrink-0">
              {guestLoading ? "…" : "Play as guest"}
            </Button>
          </div>
        </div>
      </div>
  )
}
