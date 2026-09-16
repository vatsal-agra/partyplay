"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSessionContext } from "@supabase/auth-helpers-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { playAsGuest, isGuestSession } from "@/lib/guest"
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"
import { motion } from "framer-motion"
import { Mascot } from "@/components/Mascot"
import { randomLoading } from "@/lib/copy"

export default function CreateParty() {
  const router = useRouter()
  const { session, isLoading } = useSessionContext();
  const supabaseClient = getSupabaseBrowserClient()
  const [partyName, setPartyName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [guestName, setGuestName] = useState("")
  const [guestLoading, setGuestLoading] = useState(false)
  const [loadingLine] = useState(randomLoading())

  const handleGuest = async () => {
    if (guestLoading) return
    setGuestLoading(true)
    setError(null)
    const { error } = await playAsGuest(supabaseClient, guestName)
    if (error) {
      setError(error)
      setGuestLoading(false)
      return
    }
    // The session context picks up the new anonymous session and this page
    // swaps straight to the party form. No redirect, no bounce.
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Mascot mood="think" size={120} className="mb-4" />
        <motion.p
          className="text-white text-xl font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {loadingLine}
        </motion.p>
        <motion.div
          className="mt-6 w-24 h-1 bg-white/20 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    )
  }

  // No session: host as a guest right here instead of bouncing to sign-in.
  if (!session) {
    return (
      <div className="w-full">
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h1 className="font-display text-4xl font-bold mb-3">
              <span className="text-white">Start your </span>
              <span className="text-gradient">Party</span>
            </h1>
            <p className="text-muted-foreground text-lg">Pick a name and you are hosting. No signup needed.</p>
          </div>

          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="guestName" className="text-white/90">Your name</Label>
              <Input
                id="guestName"
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleGuest() } }}
                maxLength={24}
                placeholder="Dice Boss"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive rounded-xl text-sm">
                {error}
              </div>
            )}

            <Button
              type="button"
              variant="brand"
              size="lg"
              disabled={guestLoading}
              className="w-full"
              onClick={handleGuest}
            >
              {guestLoading ? "Setting you up..." : "Host as guest"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Prefer email?{' '}
              <a href="/auth/sign-in" className="font-semibold text-grape-300 hover:text-grape-200 hover:underline">
                Sign in
              </a>
            </p>
          </Card>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    console.log("Submitting party creation form...")

    // Ensure session is available
    if (!session?.user?.id) {
      setError("User session not found. Please sign in again.")
      setLoading(false)
      return
    }

    try {
      // Create a new party without changing existing parties or their members.
      const { data, error } = await supabaseClient
        .from('parties')
        .insert({
          name: partyName,
          max_players: parseInt(maxPlayers),
          is_private: isPrivate,
          created_by: session.user.id,
          status: 'active',
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) {
        console.error("Party creation error:", error)
        throw error
      }
      console.log("Party created, data:", data)

      if (data) {
        try {
          // Create a party member record for the creator
          const { error: memberError } = await supabaseClient
            .from('party_members')
            .insert({
              party_id: data.id,
              user_id: session.user.id, // We already checked this exists
              role: 'leader',
              joined_at: new Date().toISOString(),
              status: 'active'
            })
            
          if (memberError) {
            console.error("Party member creation error:", memberError)
            // Don't throw here, just log and continue to dashboard
            console.log("Proceeding to dashboard despite member creation error")
          } else {
            console.log("Party member added successfully")
          }
          
          console.log("Redirecting to dashboard...")
          router.push('/dashboard')
        } catch (memberError) {
          console.error("Error in member creation:", memberError)
          // Still redirect to dashboard even if member creation fails
          router.push('/dashboard')
        }
      }
    } catch (error: any) {
      setError(error.message)
      console.error("Error in handleSubmit:", error)
    } finally {
      setLoading(false)
    }
  }

  console.log("Rendering CreateParty form")
  return (
    <div className="w-full">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl font-bold mb-3">
            <span className="text-white">Create a </span>
            <span className="text-gradient">New Party</span>
          </h1>
          <p className="text-muted-foreground text-lg">Set up your game night and invite friends</p>
        </div>

        {/* Guests own the parties they create through an anonymous session. If they
            lose it the party is orphaned, so nudge them inline before they host. */}
        {isGuestSession(session) && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-aqua-400/30 bg-aqua-500/10 px-4 py-3">
            <ShieldCheck className="h-5 w-5 shrink-0 text-aqua-400" />
            <p className="min-w-0 flex-1 text-sm text-white/90">
              <span className="font-bold text-white">Save this account.</span>{" "}
              You are playing as a guest. Add an email so you keep your parties and progress.
            </p>
            <Button asChild variant="brand" size="sm" className="shrink-0">
              <Link href="/auth/sign-up">Save this account</Link>
            </Button>
          </div>
        )}

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="partyName" className="text-white/90">Party Name</Label>
              <Input
                id="partyName"
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
                placeholder="Friday Night Showdown"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxPlayers" className="text-white/90">Maximum Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                required
                min="2"
                max="10"
                placeholder="2-10 players"
              />
            </div>

            <div className="flex items-center">
              <input
                id="isPrivate"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-5 w-5 rounded border-white/20 bg-white/10 text-grape-500 focus:ring-grape-500 focus:ring-offset-background"
              />
              <Label htmlFor="isPrivate" className="ml-3 text-white/90">
                Make this party private
              </Label>
            </div>

            {error && (
              <div className="p-3 bg-destructive/15 border border-destructive/40 text-destructive rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                variant="brand"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  'Create Party'
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
