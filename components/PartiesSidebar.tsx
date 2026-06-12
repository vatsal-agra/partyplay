"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { Loader2, Group } from 'lucide-react'
import { useEffect, useState, useCallback } from "react"
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'

type Party = {
  id: string
  name: string
  max_players: number
  is_private: boolean
  status: string
  created_at: string
  created_by: string
  members?: PartyMember[]
}

type PartyMemberProfile = {
  username: string | null
  display_name?: string | null
  avatar_url?: string | null
  id: string
}

type PartyMember = {
  id: string
  user_id: string
  party_id: string
  joined_at: string
  is_muted?: boolean
  profile?: PartyMemberProfile
}

export function PartiesSidebar() {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState<{[key: string]: boolean}>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [partyToEndId, setPartyToEndId] = useState<string | null>(null)
  const [expandedParty, setExpandedParty] = useState<string | null>(null)
  const [memberToAction, setMemberToAction] = useState<{partyId: string, memberId: string, action: 'kick' | 'mute'} | null>(null)
  
  const supabase = createClientComponentClient()

  const fetchParties = useCallback(async () => {
    console.log('[fetchParties] Fetching parties from database...')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        setCurrentUserId(session.user.id)
        
        // Clear current parties immediately for better UX
        setParties([])
        
        // 1. Fetch parties hosted by the user
        const { data: hostedData, error: hostedError } = await supabase
          .from('parties')
          .select('*')
          .eq('created_by', session.user.id)
          .order('created_at', { ascending: false })

        if (hostedError) throw hostedError

        // 2. Fetch parties the user has joined as a member
        const { data: memberOfData, error: memberOfError } = await supabase
          .from('party_members')
          .select('party_id')
          .eq('user_id', session.user.id)

        if (memberOfError) throw memberOfError

        const joinedPartyIds = (memberOfData || [])
          .map(m => m.party_id)
          .filter(id => !(hostedData || []).some(h => h.id === id))

        let joinedData: any[] = []
        if (joinedPartyIds.length > 0) {
          const { data: jData, error: jError } = await supabase
            .from('parties')
            .select('*')
            .in('id', joinedPartyIds)
            .order('created_at', { ascending: false })
          
          if (jError) throw jError
          joinedData = jData || []
        }

        const allParties = [...(hostedData || []), ...joinedData]
        console.log(`[fetchParties] Fetched ${allParties.length} parties from database`)
        setParties(allParties)
        
        // Fetch members for each party
        if (allParties.length > 0) {
          allParties.forEach(party => {
            fetchPartyMembers(party.id)
          })
        }
      } else {
        console.log('[fetchParties] No active session, clearing parties')
        setParties([])
      }
    } catch (error) {
      console.error('[fetchParties] Error fetching parties:', error)
      setParties([])
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const confirmEndParty = async () => {
    if (!partyToEndId) return
    
    try {
      // 1. Optimistic UI update
      setParties(prev => {
        console.log('[confirmEndParty] Optimistic update: removing party', partyToEndId)
        return prev.filter(p => p.id !== partyToEndId)
      })
      
      // 2. Delete from database
      console.log(`[confirmEndParty] Deleting party ${partyToEndId} from database`)
      const { error } = await supabase
        .from('parties')
        .delete()
        .eq('id', partyToEndId)
      
      if (error) throw error
      
      console.log(`[confirmEndParty] Successfully deleted party ${partyToEndId}`)
      
    } catch (error) {
      console.error('[confirmEndParty] Error deleting party:', error)
      // Re-fetch to ensure UI is in sync with database
      fetchParties()
    } finally {
      setIsConfirmModalOpen(false)
      setPartyToEndId(null)
    }
  }

  useEffect(() => {
    fetchParties()

    // Set up real-time subscription
    const partiesChannel = supabase
      .channel('public:parties')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'parties' 
      }, (payload) => {
        console.log('Real-time change received:', payload)
        if (payload.eventType === 'DELETE') {
          console.log(`Party ${payload.old.id} was deleted`)
          setParties(prev => prev.filter(p => p.id !== payload.old.id))
        } else {
          // For any other change, refetch to be safe
          fetchParties()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(partiesChannel)
    }
  }, [fetchParties, supabase])

  const fetchPartyMembers = async (partyId: string) => {
    setLoadingMembers(prev => ({ ...prev, [partyId]: true }))
    try {
      // Fetch party members with their profiles
      const { data: membersData, error: membersError } = await supabase
        .from('party_members')
        .select(`
          *,
          profile:user_id(username, display_name, avatar_url)
        `)
        .eq('party_id', partyId)

      if (membersError) {
        console.error("Error fetching party members:", membersError)
        return
      }

      // Update the party with members
      setParties(prev => prev.map(party => {
        if (party.id === partyId) {
          return { ...party, members: membersData }
        }
        return party
      }))
    } catch (error) {
      console.error("Error in fetchPartyMembers:", error)
    } finally {
      setLoadingMembers(prev => ({ ...prev, [partyId]: false }))
    }
  }

  const handleKickMember = async (partyId: string, memberId: string) => {
    try {
      // Optimistic UI update
      setParties(prev => prev.map(party => {
        if (party.id === partyId && party.members) {
          return {
            ...party,
            members: party.members.filter(member => member.id !== memberId)
          }
        }
        return party
      }))
      
      // Delete from database
      const { error } = await supabase
        .from('party_members')
        .delete()
        .eq('id', memberId)
      
      if (error) throw error
      
      console.log(`Successfully kicked member ${memberId} from party ${partyId}`)
    } catch (error) {
      console.error('Error kicking member:', error)
      // Re-fetch to ensure UI is in sync with database
      fetchPartyMembers(partyId)
    } finally {
      setMemberToAction(null)
    }
  }

  const handleToggleMuteMember = async (partyId: string, memberId: string, currentMuteState: boolean) => {
    try {
      // Optimistic UI update
      setParties(prev => prev.map(party => {
        if (party.id === partyId && party.members) {
          return {
            ...party,
            members: party.members.map(member => {
              if (member.id === memberId) {
                return { ...member, is_muted: !currentMuteState }
              }
              return member
            })
          }
        }
        return party
      }))
      
      // Update in database
      const { error } = await supabase
        .from('party_members')
        .update({ is_muted: !currentMuteState })
        .eq('id', memberId)
      
      if (error) throw error
      
      console.log(`Successfully ${currentMuteState ? 'unmuted' : 'muted'} member ${memberId} in party ${partyId}`)
    } catch (error) {
      console.error('Error toggling mute status:', error)
      // Re-fetch to ensure UI is in sync with database
      fetchPartyMembers(partyId)
    }
  }

  const toggleExpandParty = (partyId: string) => {
    setExpandedParty(prev => prev === partyId ? null : partyId)
    
    // Fetch members if expanding and we don't have them yet
    const party = parties.find(p => p.id === partyId)
    if (!party?.members && expandedParty !== partyId) {
      fetchPartyMembers(partyId)
    }
  }

  const isLeader = (party: Party) => currentUserId === party.created_by

  return (
    <div className="h-full bg-gray-900/50 border-l border-pink-500/20 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Group className="h-5 w-5 text-pink-400" />
          Your Parties
        </h2>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800/50 rounded-lg animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {parties.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No active parties found</p>
          ) : (
            parties.map((party) => (
              <Card key={party.id} className="bg-gray-800/50 border-pink-500/20 overflow-hidden">
                <div className="p-4 cursor-pointer" onClick={() => toggleExpandParty(party.id)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-white">{party.name}</h3>
                      <p className="text-sm text-gray-400">
                        {party.is_private ? 'Private' : 'Public'} • {party.members?.length || 0} members
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white/70 hover:bg-white/10 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpandParty(party.id);
                        }}
                      >
                        {expandedParty === party.id ? 'Hide' : 'Show'}
                      </Button>
                      {isLeader(party) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-900/20 hover:text-red-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPartyToEndId(party.id);
                            setIsConfirmModalOpen(true);
                          }}
                        >
                          End Party
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Party Members List */}
                {expandedParty === party.id && (
                  <div className="bg-gray-900/50 border-t border-pink-500/20 p-3">
                    <h4 className="text-sm font-medium text-white mb-2">Party Members</h4>
                    
                    {loadingMembers[party.id] ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-5 w-5 animate-spin text-pink-400" />
                      </div>
                    ) : party.members && party.members.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {party.members.map((member) => (
                          <div 
                            key={member.id} 
                            className="flex items-center justify-between p-2 rounded-md bg-gray-800/70 hover:bg-gray-800"
                          >
                            <div className="flex items-center">
                              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center text-white font-bold mr-2 text-xs">
                                {member.profile?.username ? member.profile.username[0].toUpperCase() : 'U'}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white flex items-center">
                                  {member.profile?.display_name || member.profile?.username || 'Unknown User'}
                                  {member.user_id === party.created_by && (
                                    <span className="ml-1 text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full flex items-center">
                                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                                      Host
                                    </span>
                                  )}
                                  {member.is_muted && (
                                    <span className="ml-1 text-xs bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded-full">
                                      Muted
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            
                            {/* Host Controls - only show for non-host members */}
                            {isLeader(party) && member.user_id !== party.created_by && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 rounded-full ${member.is_muted ? 'text-red-400 hover:text-red-300' : 'text-gray-400 hover:text-white'}`}
                                  onClick={() => handleToggleMuteMember(party.id, member.id, !!member.is_muted)}
                                >
                                  {member.is_muted ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="1" y1="1" x2="23" y2="23"></line>
                                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                                      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                                      <line x1="12" y1="19" x2="12" y2="23"></line>
                                      <line x1="8" y1="23" x2="16" y2="23"></line>
                                    </svg>
                                  ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                      <line x1="12" y1="19" x2="12" y2="23"></line>
                                      <line x1="8" y1="23" x2="16" y2="23"></line>
                                    </svg>
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-full text-gray-400 hover:text-red-400"
                                  onClick={() => {
                                    setMemberToAction({
                                      partyId: party.id,
                                      memberId: member.id,
                                      action: 'kick'
                                    });
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                    <polyline points="16 17 21 12 16 7"></polyline>
                                    <line x1="21" y1="12" x2="9" y2="12"></line>
                                  </svg>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-3">No members have joined this party yet</p>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmEndParty}
        title="End Party"
        message="Are you sure you want to end this party? This action cannot be undone."
        confirmButtonText="End Party"
      />
      
      {/* Kick Member Confirmation Modal */}
      <ConfirmationModal
        isOpen={memberToAction !== null && memberToAction.action === 'kick'}
        onClose={() => setMemberToAction(null)}
        onConfirm={() => {
          if (memberToAction) {
            handleKickMember(memberToAction.partyId, memberToAction.memberId)
          }
        }}
        title="Kick Member"
        message="Are you sure you want to kick this member from the party?"
        confirmButtonText="Kick Member"
      />
    </div>
  )
}
