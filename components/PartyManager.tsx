"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Plus, Trash2, Users, Lock, Unlock, RefreshCw, Loader2, Group, LogOut, Copy, Check, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Party {
  id: string
  name: string
  is_private: boolean
  max_players: number
  created_at: string
  created_by: string
}

export default function PartyManager({ showJumpBackIn = false }: { showJumpBackIn?: boolean }) {
  const [lastParty, setLastParty] = useState<Party | null>(null)
  const [parties, setParties] = useState<Party[]>([])
  const [joinedParties, setJoinedParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState<string | null>(null)
  // Which share button last fired, keyed "<partyId>:code" / "<partyId>:link",
  // so only the button that was pressed flips to the confirmation tick.
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()

  const copyToClipboard = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyError(null)
      setCopied(key)
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800)
    } catch {
      setCopyError("Your browser blocked the clipboard. Select the code and copy it manually.")
    }
  }

  // Code + invite link chips shown on every party card. Both stop propagation
  // so tapping them never also opens the party.
  const renderShareRow = (party: Party) => {
    const code = party.id.substring(0, 6).toUpperCase()
    const link = typeof window !== "undefined"
      ? `${window.location.origin}/party/${party.id}`
      : `/party/${party.id}`
    const stop = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="Copy the party code"
          onClick={(e) => { stop(e); copyToClipboard(`${party.id}:code`, code) }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/25 px-2.5 py-1 font-mono text-sm font-bold tracking-[0.2em] text-cyan-300 transition-colors hover:border-cyan-300/50 hover:bg-black/40"
        >
          {code}
          {copied === `${party.id}:code`
            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
            : <Copy className="h-3.5 w-3.5 text-white/50" />}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          onClick={(e) => { stop(e); copyToClipboard(`${party.id}:link`, link) }}
        >
          {copied === `${party.id}:link`
            ? <Check className="h-3.5 w-3.5 text-emerald-400" />
            : <Link2 className="h-3.5 w-3.5" />}
          {copied === `${party.id}:link` ? "Link copied" : "Copy invite link"}
        </Button>
        {copied === `${party.id}:code` && (
          <span className="text-xs font-medium text-emerald-400">Code copied, paste it in the group chat</span>
        )}
      </div>
    )
  }

  // Fetch the user's active parties (hosted or joined)
  const fetchUserParty = async () => {
    try {
      setIsLoading(true)
      setLastParty(null)
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
        .select('party_id, joined_at')
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
      const joinedAt = new Map<string, string>(
        (membershipData || []).map(m => [m.party_id, m.joined_at])
      )
      const candidates = [
        ...(hosted || []).map(party => ({ party, timestamp: party.created_at })),
        ...joined.map(party => ({ party, timestamp: joinedAt.get(party.id) || party.created_at }))
      ]
      candidates.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      setLastParty(candidates[0]?.party || null)
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
      {showJumpBackIn && !isLoading && lastParty && (
        <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-bold text-white">Your latest party</h2>
            <p className="mt-1 truncate text-sm text-white/60">{lastParty.name}</p>
          </div>
          <Button asChild variant="brand" className="shrink-0">
            <Link href={`/party/${lastParty.id}`}>Jump back in</Link>
          </Button>
        </div>
      )}

      {/* Join Party Panel */}
      <motion.div 
        className="w-full bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="font-display text-xl font-bold text-white mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-aqua-400" />
          Join Party via Code
        </h2>
        <p className="mb-4 text-sm text-white/60">
          Got a code from a friend? Paste the code or the whole invite link, either one works.
        </p>
        <form onSubmit={handleJoinParty} className="flex flex-col sm:flex-row gap-3">
          <Input
            type="text"
            placeholder="Enter party code (e.g. A1B2C3)"
            value={joinCode}
            onChange={(e) => {
              // Friends paste all sorts of things: a bare code, a code with
              // spaces, or the full /party/<uuid> invite link. Take the code
              // out of whatever arrives.
              const raw = e.target.value.trim()
              const fromLink = raw.match(/\/party\/([0-9a-f-]{6,})/i)
              const value = fromLink ? fromLink[1] : raw
              setJoinCode(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6))
            }}
            className="flex-1 uppercase font-mono tracking-[0.3em] text-center text-lg"
            disabled={isJoining}
          />
          <Button
            type="submit"
            variant="brand"
            className="px-8"
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
          <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
            <Group className="h-5 w-5 text-bubble-400" />
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

        {copyError && (
          <p className="mb-4 text-sm font-medium text-amber-300">{copyError}</p>
        )}

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
              <Button asChild variant="brand" className="mt-4 gap-2">
                <Link href="/dashboard/create-party">
                  <Plus className="h-4 w-4" />
                  Create a party
                </Link>
              </Button>
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
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg text-white">{party.name}</h3>
                      <p className="text-sm text-white/60 mt-1">
                        Created {new Date(party.created_at).toLocaleDateString()}
                      </p>
                      {renderShareRow(party)}
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
                    <div className="min-w-0">
                      <h3 className="font-bold text-lg text-white">{party.name}</h3>
                      <p className="text-sm text-white/60 mt-1">Joined</p>
                      {renderShareRow(party)}
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

