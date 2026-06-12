"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Plus, Trash2, Users, Lock, Unlock, RefreshCw, Loader2, Group, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"

interface Party {
  id: string
  name: string
  is_private: boolean
  max_players: number
  created_at: string
  created_by: string
}

export default function PartyManager() {
  const [parties, setParties] = useState<Party[]>([])
  const [joinedParties, setJoinedParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  const supabase = createClientComponentClient()
  const router = useRouter()

  // Fetch the user's active parties (hosted or joined)
  const fetchUserParty = async () => {
    try {
      setIsLoading(true)
      setJoinError(null)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error("Session error:", sessionError)
        throw sessionError
      }
      
      if (!session?.user?.id) {
        console.log("No user session found")
        return
      }
      
      const userId = session.user.id

      // 1. Fetch parties hosted by the user
      const { data: hosted, error: hostedError } = await supabase
        .from('parties')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false })
      
      if (hostedError) throw hostedError

      // 2. Fetch parties where the user is a member (but not the host)
      const { data: membershipData, error: membershipError } = await supabase
        .from('party_members')
        .select('party_id')
        .eq('user_id', userId)

      if (membershipError) throw membershipError

      const memberPartyIds = (membershipData || [])
        .map(m => m.party_id)
        .filter(id => !(hosted || []).some(h => h.id === id))

      let joined: Party[] = []
      if (memberPartyIds.length > 0) {
        const { data: joinedData, error: joinedError } = await supabase
          .from('parties')
          .select('*')
          .in('id', memberPartyIds)
          .order('created_at', { ascending: false })

        if (joinedError) throw joinedError
        joined = joinedData || []
      }

      setParties(hosted || [])
      setJoinedParties(joined)
    } catch (error: any) {
      console.error("Error in fetchUserParty:", error)
      setJoinError(`Failed to load parties: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Join a party using a 6-character code
  const handleJoinParty = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim() || joinCode.length < 6) {
      setJoinError("Please enter a valid 6-character party code.")
      return
    }

    try {
      setIsJoining(true)
      setJoinError(null)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        setJoinError("You must be signed in to join a party.")
        return
      }

      const userId = session.user.id
      const cleanCode = joinCode.trim().toUpperCase()

      // Fetch all parties to find the matching one by checking substring(0, 6)
      const { data: allActiveParties, error: fetchPartiesError } = await supabase
        .from('parties')
        .select('*')

      if (fetchPartiesError) throw fetchPartiesError

      const targetParty = allActiveParties?.find(
        (p: Party) => p.id.substring(0, 6).toUpperCase() === cleanCode
      )

      if (!targetParty) {
        setJoinError("Party not found. Please check the code and try again.")
        return
      }

      // Check if user is already a member
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('party_members')
        .select('*')
        .eq('party_id', targetParty.id)
        .eq('user_id', userId)
        .maybeSingle()

      if (memberCheckError) throw memberCheckError

      if (existingMember) {
        // Already a member, redirect
        router.push(`/party/${targetParty.id}`)
        return
      }

      // Check member count
      const { count, error: countError } = await supabase
        .from('party_members')
        .select('*', { count: 'exact', head: true })
        .eq('party_id', targetParty.id)

      if (countError) throw countError

      const currentCount = count || 0
      if (currentCount >= targetParty.max_players) {
        setJoinError("This party is already full.")
        return
      }

      // Join the party
      const { error: joinError } = await supabase
        .from('party_members')
        .insert({
          party_id: targetParty.id,
          user_id: userId,
          role: 'member',
          joined_at: new Date().toISOString()
        })

      if (joinError) throw joinError

      setJoinCode("")
      await fetchUserParty()
      router.push(`/party/${targetParty.id}`)
    } catch (error: any) {
      console.error("Error joining party:", error)
      setJoinError(error.message || "Failed to join party. Please try again.")
    } finally {
      setIsJoining(false)
    }
  }

  // Leave a party
  const handleLeaveParty = async (partyId: string) => {
    if (!confirm("Are you sure you want to leave this party?")) return

    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return

      const { error } = await supabase
        .from('party_members')
        .delete()
        .eq('party_id', partyId)
        .eq('user_id', session.user.id)

      if (error) throw error
      await fetchUserParty()
    } catch (error: any) {
      alert(`Failed to leave party: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Permanently delete a party and all its related data
  const handleDelete = async (partyId: string) => {
    if (!confirm("Are you sure you want to delete this party? This cannot be undone.")) return
    
    try {
      setIsDeleting(partyId)
      
      // 1. Delete members
      const { error: deleteMembersError } = await supabase
        .from('party_members')
        .delete()
        .eq('party_id', partyId)
      
      if (deleteMembersError) throw deleteMembersError
      
      // 2. Delete party
      const { error: deletePartyError } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId)
      
      if (deletePartyError) throw deletePartyError
      
      await fetchUserParty()
      alert("Party deleted successfully!")
    } catch (error: any) {
      console.error("Error in handleDelete:", error)
      alert(`Failed to delete party: ${error.message}`)
    } finally {
      setIsDeleting(null)
    }
  }

  useEffect(() => {
    fetchUserParty()
  }, [])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  }

  return (
    <div className="space-y-6">
      {/* Join Party Panel */}
      <motion.div 
        className="w-full bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-400" />
          Join Party via Code
        </h2>
        <form onSubmit={handleJoinParty} className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            placeholder="Enter 6-character party code (e.g. A1B2C3)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.slice(0, 6))}
            className="flex-1 bg-white/5 border-white/20 text-white placeholder-white/40 focus:border-cyan-400 focus:ring-cyan-400 uppercase font-mono tracking-widest text-center text-lg"
            disabled={isJoining}
          />
          <Button
            type="submit"
            className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white px-8 font-medium shadow-md shadow-cyan-500/10"
            disabled={isJoining}
          >
            {isJoining ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Join Party
          </Button>
        </form>
        {joinError && (
          <p className="text-red-400 text-sm mt-2 font-medium">{joinError}</p>
        )}
      </motion.div>

      {/* Party Lists Panel */}
      <motion.div 
        className="w-full bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Group className="h-5 w-5 text-pink-400" />
            Your Hosted Parties
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white hover:bg-white/10"
            onClick={fetchUserParty}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              className="flex justify-center py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="loading-hosted"
            >
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </motion.div>
          ) : parties.length === 0 ? (
            <motion.div 
              className="text-center py-6 text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key="empty-hosted"
            >
              <p>You are not hosting any active parties.</p>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-4"
              variants={container}
              initial="hidden"
              animate="show"
              key="hosted-list"
            >
              {parties.map((party) => (
                <motion.div 
                  key={party.id}
                  className="group relative bg-white/5 border border-white/10 p-5 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                  variants={item}
                  whileHover={{ y: -2 }}
                  onClick={(e) => {
                    if (e.defaultPrevented) return
                    router.push(`/party/${party.id}`)
                  }}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <h3 className="font-bold text-lg text-white">{party.name}</h3>
                      <p className="text-sm text-white/60 mt-1 flex items-center gap-2">
                        <span>Code: <span className="font-mono font-bold text-cyan-300">{party.id.substring(0, 6).toUpperCase()}</span></span>
                        <span>•</span>
                        <span>Created: {new Date(party.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDelete(party.id)
                      }}
                      disabled={isDeleting === party.id}
                    >
                      {isDeleting === party.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Joined Parties Section */}
        <h2 className="text-xl font-bold text-white mt-8 mb-6 flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-400" />
          Parties You Joined
        </h2>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              className="flex justify-center py-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              key="loading-joined"
            >
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </motion.div>
          ) : joinedParties.length === 0 ? (
            <motion.div 
              className="text-center py-6 text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              key="empty-joined"
            >
              <p>You haven't joined any other parties yet.</p>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-4"
              variants={container}
              initial="hidden"
              animate="show"
              key="joined-list"
            >
              {joinedParties.map((party) => (
                <motion.div 
                  key={party.id}
                  className="group relative bg-white/5 border border-white/10 p-5 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                  variants={item}
                  whileHover={{ y: -2 }}
                  onClick={(e) => {
                    if (e.defaultPrevented) return
                    router.push(`/party/${party.id}`)
                  }}
                >
                  <div className="flex justify-between items-center relative z-10">
                    <div>
                      <h3 className="font-bold text-lg text-white">{party.name}</h3>
                      <p className="text-sm text-white/60 mt-1 flex items-center gap-2">
                        <span>Code: <span className="font-mono font-bold text-cyan-300">{party.id.substring(0, 6).toUpperCase()}</span></span>
                        <span>•</span>
                        <span>Joined</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleLeaveParty(party.id)
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

