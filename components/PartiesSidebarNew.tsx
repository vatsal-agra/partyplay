"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Trash2, Users, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type Party = {
  id: string
  name: string
  is_private: boolean
  max_players: number
  created_at: string
}

export default function PartiesSidebarNew() {
  const [parties, setParties] = useState<Party[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  // Fetch parties from the database
  const fetchParties = async () => {
    try {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.user?.id) return
      
      const { data, error } = await supabase
        .from('parties')
        .select('*')
        .eq('created_by', session.user.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      setParties(data || [])
    } catch (error) {
      console.error("Error fetching parties:", error)
      alert("Failed to load parties. Please refresh the page.")
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a party
  const deleteParty = async (partyId: string) => {
    if (!confirm("Are you sure you want to delete this party?")) return
    
    try {
      setIsDeleting(partyId)
      
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyId)
      
      if (error) throw error
      
      // Remove from UI
      setParties(prev => prev.filter(p => p.id !== partyId))
      alert("Party deleted successfully!")
    } catch (error) {
      console.error("Error deleting party:", error)
      alert("Failed to delete party. Please try again.")
    } finally {
      setIsDeleting(null)
    }
  }

  // Initial fetch
  useEffect(() => {
    fetchParties()
  }, [])

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
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : parties.length === 0 ? (
        <div className="text-center p-4 bg-gray-800/30 rounded-lg">
          <p className="text-gray-400">No parties found</p>
          <p className="text-sm text-gray-500 mt-1">Create a new party to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parties.map((party) => (
            <div 
              key={party.id} 
              className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-white">{party.name}</h3>
                  <p className="text-xs text-gray-400">
                    {party.is_private ? 'Private' : 'Public'} • {party.max_players} players max
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteParty(party.id)}
                  disabled={isDeleting === party.id}
                  className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                >
                  {isDeleting === party.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
