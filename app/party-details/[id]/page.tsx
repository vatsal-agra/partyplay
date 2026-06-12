"use client"

import { useState, useEffect } from "react"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Users, Calendar, Clock, ArrowLeft, Share2, RefreshCw } from "lucide-react"
import { toast } from 'sonner'

interface PartyDetails {
  id: string
  name: string
  is_private: boolean
  max_players: number
  created_at: string
  created_by: string
  host_name?: string
  members?: {
    id: string
    user_id: string
    username?: string
    joined_at: string
    is_host?: boolean
    profile?: {
      username: string
      display_name?: string
      avatar_url?: string
    }
  }[]
}

export default function PartyDetailsPage({ params }: { params: { id: string } }) {
  const [party, setParty] = useState<PartyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Generate a unique party code based on the party ID
  const partyCode = party?.id ? `${party.id.substring(0, 6).toUpperCase()}` : "------"

  useEffect(() => {
    const fetchPartyDetails = async () => {
      try {
        setLoading(true)
        
        // First, check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          router.push('/auth/sign-in')
          return
        }

        // Fetch party details
        const { data: partyData, error: partyError } = await supabase
          .from('parties')
          .select('*')
          .eq('id', params.id)
          .single()

        if (partyError || !partyData) {
          console.error("Error fetching party:", partyError)
          toast.error("Party not found. The party you're looking for doesn't exist or you don't have access.")
          router.push('/dashboard')
          return
        }

        // Fetch party members
        const { data: membersData, error: membersError } = await supabase
          .from('party_members')
          .select('*')
          .eq('party_id', params.id)

        if (membersError) {
          console.error("Error fetching party members:", membersError)
        }

        // Collect all user IDs we need to look up
        const userIds = new Set<string>()
        if (partyData.created_by) userIds.add(partyData.created_by)
        membersData?.forEach(m => { if (m.user_id) userIds.add(m.user_id) })

        // Fetch all profiles in one query
        const profilesMap: Record<string, { username: string; display_name?: string; avatar_url?: string }> = {}
        if (userIds.size > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .in('id', Array.from(userIds))

          if (!profilesError && profiles) {
            profiles.forEach(p => {
              profilesMap[p.id] = {
                username: p.username || `User ${p.id.slice(0, 6)}`,
                display_name: p.display_name,
                avatar_url: p.avatar_url,
              }
            })
          }
        }

        // Build members list with profiles attached
        let allMembers = (membersData || []).map(member => ({
          ...member,
          profile: profilesMap[member.user_id] || { username: `User ${member.user_id.slice(0, 6)}` },
          is_host: member.user_id === partyData.created_by,
        }))

        // If host isn't already in the members list, prepend them
        const hostInMembers = allMembers.some(m => m.user_id === partyData.created_by)
        if (!hostInMembers && partyData.created_by) {
          allMembers = [{
            id: 'host-member',
            user_id: partyData.created_by,
            party_id: partyData.id,
            joined_at: partyData.created_at,
            profile: profilesMap[partyData.created_by] || { username: 'Host' },
            is_host: true,
          }, ...allMembers]
        } else {
          // Move host to the top
          allMembers.sort((a, b) => (b.is_host ? 1 : 0) - (a.is_host ? 1 : 0))
        }
        
        const hostProfile = profilesMap[partyData.created_by]
        setParty({
          ...partyData,
          host_name: hostProfile?.display_name || hostProfile?.username || 'Unknown Host',
          members: allMembers
        })
      } catch (error) {
        console.error("Error in fetchPartyDetails:", error)
        toast.error("Error loading party. There was a problem loading the party details.")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchPartyDetails()
    }
  }, [params.id, router, supabase])

  const copyPartyCode = () => {
    navigator.clipboard.writeText(partyCode)
    setCopySuccess(true)
    toast.success("Party code copied! Share this code with your friends to invite them to your party.")
    setTimeout(() => setCopySuccess(false), 2000)
  }

  const shareParty = () => {
    const shareText = `Join my gaming party! Use code: ${partyCode}`
    
    if (navigator.share) {
      navigator.share({
        title: 'Join my gaming party!',
        text: shareText,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(`${shareText} - ${window.location.href}`)
      toast.success("Share link copied! Share link has been copied to your clipboard.")
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white">Loading party details...</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 pt-16 pb-12">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex justify-between items-center mb-4">
            <motion.div
              className="inline-block"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <h1 className="text-5xl font-bold relative inline-block">
                <span className="relative z-10 text-white">
                  {party?.name || "Party Details"}
                </span>
                <span className="absolute inset-0 text-transparent bg-clip-text [text-shadow:0_0_1px_#fff,0_0_2px_#fff,0_0_3px_#fff]">
                  {party?.name || "Party Details"}
                </span>
              </h1>
            </motion.div>
            
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/10"
              onClick={() => router.push('/dashboard')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Party Code Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="bg-background/50 backdrop-blur-sm border-foreground/10 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">Party Code</CardTitle>
                <CardDescription className="text-white/70">Share this code with friends to invite them</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-foreground/10">
                  <div className="text-3xl font-mono font-bold tracking-wider text-white">
                    {partyCode}
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-white hover:bg-white/20"
                    onClick={copyPartyCode}
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
                <Button 
                  className="w-full mt-4 bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white"
                  onClick={shareParty}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Invite Friends
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Party Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card className="bg-background/50 backdrop-blur-sm border-foreground/10 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">Party Information</CardTitle>
                <CardDescription className="text-white/70">Details about this gaming party</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-3 text-cyan-300" />
                  <div>
                    <p className="text-sm text-white/70">Created</p>
                    <p className="text-white font-medium">
                      {party?.created_at ? new Date(party.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Clock className="h-5 w-5 mr-3 text-pink-300" />
                  <div>
                    <p className="text-sm text-white/70">Time</p>
                    <p className="text-white font-medium">
                      {party?.created_at ? new Date(party.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Unknown'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Users className="h-5 w-5 mr-3 text-purple-300" />
                  <div>
                    <p className="text-sm text-white/70">Max Players</p>
                    <p className="text-white font-medium">{party?.max_players || 'Unknown'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Members Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="md:col-span-2"
          >
            <Card className="bg-background/50 backdrop-blur-sm border-foreground/10 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl text-white">Party Members</CardTitle>
                <CardDescription className="text-white/70">
                  {party?.members && party.members.length > 0 
                    ? `${party.members.length} ${party.members.length === 1 ? 'person' : 'people'} have joined this party`
                    : 'No members have joined yet'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {party?.members && party.members.length > 0 ? (
                  <div className="space-y-3">
                    {party.members.map((member, index) => (
                      <motion.div 
                        key={member.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index }}
                        className={`flex items-center p-3 bg-background/30 rounded-lg border ${member.is_host ? 'border-green-500/50' : 'border-foreground/10'}`}
                      >
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-pink-500 flex items-center justify-center text-white font-bold mr-3">
                          {member.profile?.username ? member.profile.username[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {member.profile?.display_name || member.profile?.username || 'Unknown User'}
                            {member.is_host && <span className="ml-2 text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded-full inline-flex items-center"><span className="w-2 h-2 bg-green-400 rounded-full mr-1"></span>Host</span>}
                          </p>
                          <p className="text-xs text-white/60">
                            Joined {new Date(member.joined_at).toLocaleString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto mb-3 text-white/30" />
                    <p className="text-white/70">No other members have joined this party yet.</p>
                    <p className="text-white/50 text-sm mt-1">Share your party code to invite friends!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
