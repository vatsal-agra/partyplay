"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSessionContext } from "@supabase/auth-helpers-react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Auth } from "@supabase/auth-ui-react"
import { ThemeSupa } from "@supabase/auth-ui-shared"

export default function CreateParty() {
  const router = useRouter()
  const { session, isLoading } = useSessionContext();
  const supabaseClient = createClientComponentClient()
  const [partyName, setPartyName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/auth/sign-in")
    }
  }, [session, isLoading, router])

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (!session) {
    return null;
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
      // First, find and delete any existing party for this user
      const { data: existingParties, error: fetchError } = await supabaseClient
        .from('parties')
        .select('id')
        .eq('created_by', session.user.id)
      
      if (fetchError) {
        console.error("Error fetching existing parties:", fetchError)
        // Continue anyway, we'll try to create the new party
      } else if (existingParties && existingParties.length > 0) {
        // Delete all party members for the existing parties
        const { error: deleteMembersError } = await supabaseClient
          .from('party_members')
          .delete()
          .in('party_id', existingParties.map(p => p.id))
        
        if (deleteMembersError) {
          console.error("Error deleting party members:", deleteMembersError)
          // Continue anyway, we'll try to delete the party
        }
        
        // Now delete the parties
        const { error: deletePartiesError } = await supabaseClient
          .from('parties')
          .delete()
          .eq('created_by', session.user.id)
        
        if (deletePartiesError) {
          console.error("Error deleting existing parties:", deletePartiesError)
          // Continue anyway, we'll try to create the new party
        }
      }

      // Now create the new party
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
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 relative inline-block">
            <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-pink-600">
              Create New Party
            </span>
            <span className="absolute inset-0 bg-clip-text text-transparent bg-gradient-to-r from-cyan-500 to-pink-500 [text-shadow:0_0_8px_rgba(255,255,255,0.5)]">
              Create New Party
            </span>
          </h1>
          <p className="text-white text-lg mb-8">Set up your gaming session and invite friends</p>
        </div>
        
        <Card className="bg-background/50 backdrop-blur-sm border border-foreground/10 p-8 rounded-xl shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="partyName" className="text-gray-300">Party Name</Label>
              <Input
                id="partyName"
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
                placeholder="Enter party name"
                className="bg-gray-700/50 border-gray-600 text-white/90 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxPlayers" className="text-gray-300">Maximum Players</Label>
              <Input
                id="maxPlayers"
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
                required
                min="2"
                max="10"
                placeholder="2-10 players"
                className="bg-gray-700/50 border-gray-600 text-white/90 placeholder-gray-400 focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex items-center">
              <input
                id="isPrivate"
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-5 w-5 rounded border-gray-600 bg-gray-700 text-pink-500 focus:ring-pink-500 focus:ring-offset-gray-800"
              />
              <Label htmlFor="isPrivate" className="ml-3 text-gray-300">
                Make this party private
              </Label>
            </div>
            
            {error && (
              <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white py-6 text-base font-medium transition-all duration-300 transform hover:scale-[1.02]"
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
