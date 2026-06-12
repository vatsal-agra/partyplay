"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { Loader2, Users, Plus, Trash2, Lock, Unlock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface Party {
  id: string
  name: string
  is_private: boolean
  created_at: string
  created_by: string
  max_players: number
  current_players?: number
}

const PartiesSidebarV2 = () => {
  const [parties, setParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isEnding, setIsEnding] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null)
  
  const supabase = createClientComponentClient()

  // Fetch parties from the database
  const fetchParties = async () => {
    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) {
        setParties([])
        return
      }

      setCurrentUserId(session.user.id)

      // Fetch parties where the user is the creator
      const { data: partiesData, error: partiesError } = await supabase
        .from('parties')
        .select('*')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false })

      if (partiesError) throw partiesError

      // For each party, fetch the current number of players
      const partiesWithPlayerCount = await Promise.all(
        (partiesData || []).map(async (party) => {
          const { count, error: countError } = await supabase
            .from('party_members')
            .select('*', { count: 'exact', head: true })
            .eq('party_id', party.id)

          if (countError) throw countError

          return {
            ...party,
            current_players: count || 0
          }
        })
      )

      setParties(partiesWithPlayerCount)
    } catch (error) {
      console.error("Error fetching parties:", error)
      toast.error("Failed to load parties. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle ending a party
  const handleEndParty = async (partyId: string) => {
    if (!partyId || !window.confirm("Are you sure you want to end this party? This action cannot be undone.")) {
      return
    }

    try {
      setIsEnding(true)
      setSelectedPartyId(partyId)
      
      // Optimistic update
      setParties(prev => prev.filter(p => p.id !== partyId))
      
      // Delete from database
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId)

      if (error) throw error

      toast.success("Party ended successfully!")
    } catch (error) {
      console.error("Error ending party:", error)
      toast.error("Failed to end party. Please try again.")
      fetchParties() // Re-fetch to sync UI
    } finally {
      setIsEnding(false)
      setSelectedPartyId(null)
    }
  }

  // Set up real-time updates
  useEffect(() => {
    fetchParties()

    // Subscribe to changes in the parties table
    const channel = supabase
      .channel('parties_changes')
      .on(
        'postgres_changes',
        { 
          event: '*',
          schema: 'public',
          table: 'parties'
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setParties(prev => prev.filter(p => p.id !== payload.old.id))
          } else {
            fetchParties()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Animation variants for framer-motion
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <div className="h-full bg-gray-900/50 border-l border-pink-500/20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-pink-400" />
          Your Parties
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchParties}
          disabled={isLoading}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-white"
        >
          {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full bg-gray-800/50 rounded-lg" />
          ))}
        </div>
      ) : (
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {parties.length === 0 ? (
            <motion.div 
              variants={item}
              className="text-center p-6 bg-gray-800/30 rounded-lg border border-gray-700/50"
            >
              <Users className="h-10 w-10 mx-auto text-gray-500 mb-2" />
              <h3 className="text-gray-300 font-medium">No parties yet</h3>
              <p className="text-sm text-gray-500 mt-1">Create a new party to get started!</p>
            </motion.div>
          ) : (
            parties.map((party) => (
              <motion.div 
                key={party.id} 
                variants={item}
                layout
                className="relative"
              >
                <Card className="bg-gray-800/50 border-pink-500/20 overflow-hidden">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-white">{party.name}</h3>
                          {party.is_private ? (
                            <Lock className="h-3.5 w-3.5 text-gray-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-gray-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          {party.current_players || 0} / {party.max_players} players
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                          onClick={() => handleEndParty(party.id)}
                          disabled={isEnding && selectedPartyId === party.id}
                        >
                          {isEnding && selectedPartyId === party.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1">End</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      )}
    </div>
  )
}

export default PartiesSidebarV2
