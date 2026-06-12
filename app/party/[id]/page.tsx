"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Copy, Share2, ArrowLeft } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/auth-helpers-nextjs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Party, PartyMember, Message, Vote, UserProfile } from "@/app/types";

declare global {
  interface Window {
    partyChannel?: RealtimeChannel;
  }
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  )
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
            <p className="text-gray-300">{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PartyPage() {
  const router = useRouter()
  const { id } = useParams()
  const partyId = id as string
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [party, setParty] = useState<Party | null>(null);
  const [members, setMembers] = useState<PartyMember[]>([]);
  const [isLeader, setIsLeader] = useState(false);
  const [game, setGame] = useState<string>('');
  const [map, setMap] = useState<string>('');
  const [queue, setQueue] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const supabase = getSupabaseBrowserClient()

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        if (!session) {
          setError('Authentication required')
          setLoading(false)
          return
        }

        if (!partyId) {
          setError('Invalid party ID')
          setLoading(false)
          return
        }

        await getParty(session)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }


    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (!session) {
        setError('Authentication required')
        setLoading(false)
      }
    })

    getSession()

    return () => {
      subscription?.unsubscribe()
    }
  }, [partyId, supabase])

  const getParty = async (session: any) => {
    try {
      setLoading(true)
      
      // Fetch party data
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', partyId)
        .single()
      
      if (partyError) throw partyError

      // Auto-redirect if party is ready
      if (partyData && partyData.status === 'ready') {
        router.push(`/games/${partyData.game_id || 'monopoly'}?partyId=${partyId}`)
        return
      }
      
      if (partyData) {
        setGame(partyData.game_id || '')
        setMap(partyData.map || '')
        setQueue(partyData.queue || '')
      }

      // Fetch party members
      const { data: membersData, error: membersError } = await supabase
        .from('party_members')
        .select('*')
        .eq('party_id', partyId)
      
      if (membersError) throw membersError

      // Get user IDs for fetching user details
      const rawUserIds = [
        ...(membersData?.map(member => member.user_id) || []),
        ...(partyData?.created_by ? [partyData.created_by] : [])
      ]
      const userIds = rawUserIds.filter((v, i, a) => a.indexOf(v) === i)

      // Fetch user details one by one (client-side)
      const usersMap = {}
      
      // Process user IDs in chunks to avoid rate limiting
      const chunkSize = 5
      for (let i = 0; i < userIds.length; i += chunkSize) {
        const chunk = userIds.slice(i, i + chunkSize)
        await Promise.all(chunk.map(async (userId) => {
          try {
            const { data: user, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single()
            
            if (user && !error) {
              usersMap[userId] = {
                id: user.id,
                email: user.email || `user_${userId.slice(0, 6)}`,
                username: user.username || `User ${userId.slice(0, 6)}`,
                avatar_url: user.avatar_url
              }
            }
          } catch (err) {
            console.error(`Error fetching user ${userId}:`, err)
          }
        }))
      }

      // Combine members with user data
      let membersWithUsers = membersData?.map(member => ({
        ...member,
        user: usersMap[member.user_id] || { id: member.user_id, email: 'Unknown User' }
      })) || []

      // If host isn't already in the members list, prepend them
      const hostInMembers = membersWithUsers.some(m => m.user_id === partyData.created_by)
      if (!hostInMembers && partyData.created_by) {
        membersWithUsers = [{
          id: 'host-member',
          user_id: partyData.created_by,
          party_id: partyData.id,
          joined_at: partyData.created_at,
          role: 'leader',
          user: usersMap[partyData.created_by] || { id: partyData.created_by, email: 'Host' }
        }, ...membersWithUsers]
      }

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true })
      
      if (messagesError) throw messagesError

      // Combine messages with user data
      const messagesWithUsers = messagesData?.map(message => ({
        ...message,
        user: usersMap[message.user_id] || { id: message.user_id, email: 'Unknown User' }
      })) || []

      // Fetch votes
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*')
        .eq('party_id', partyId)
        .order('created_at', { ascending: true })
      
      if (votesError) throw votesError

      // Combine votes with user data
      const votesWithUsers = votesData?.map(vote => ({
        ...vote,
        user: usersMap[vote.user_id] || { id: vote.user_id, email: 'Unknown User' }
      })) || []

      setParty({
        ...partyData,
        created_by_user: usersMap[partyData.created_by] || { id: partyData.created_by, email: 'Unknown User' }
      })
      setMembers(membersWithUsers)
      setMessages(messagesWithUsers)
      setVotes(votesWithUsers)
      setIsLeader(session?.user?.id === partyData?.created_by)
      
      // Subscribe to real-time updates if not already subscribed
      if (!window.partyChannel) {
        window.partyChannel = supabase
          .channel(`party-updates-${partyId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'party_members',
            filter: `party_id=eq.${partyId}`,
          }, () => {
            getParty(session)
          })
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `party_id=eq.${partyId}`,
          }, () => {
            getParty(session)
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'parties',
            filter: `id=eq.${partyId}`,
          }, (payload) => {
            console.log('Party updated real-time:', payload.new)
            const updated = payload.new as any
            if (updated && updated.status === 'ready') {
              router.push(`/games/${updated.game_id || 'monopoly'}?partyId=${partyId}`)
            } else {
              getParty(session)
            }
          })
          .on('broadcast', { event: 'game_launch' }, ({ payload }) => {
            console.log('Received game_launch broadcast:', payload)
            router.push(`/games/${payload.gameId || 'monopoly'}?partyId=${partyId}`)
          })
          .subscribe()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.partyChannel) {
        window.partyChannel.unsubscribe()
        delete window.partyChannel
      }
    }
  }, [])

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (!party) {
    return <ErrorMessage message="Party not found" />
  }

  const partyCode = partyId ? partyId.substring(0, 6).toUpperCase() : "------"

  const copyPartyCode = () => {
    navigator.clipboard.writeText(partyCode)
    alert("Party code copied! Share this code with your friends to invite them.")
  }

  const shareParty = () => {
    const shareText = `Join my gaming party! Use code: ${partyCode}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Join my gaming party!',
        text: shareText,
        url: window.location.href,
      }).catch(err => console.error(err))
    } else {
      navigator.clipboard.writeText(`${shareText} - ${window.location.href}`)
      alert("Share link copied to clipboard!")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Back button */}
        <div className="flex justify-between items-center mb-6">
          <Button 
            variant="ghost" 
            className="text-white hover:bg-white/10"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1 space-y-8">
            {/* Party Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 rounded-2xl p-8 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-4xl font-bold text-white bg-clip-text bg-gradient-to-r from-white to-purple-300">
                    {party?.name}
                  </h1>
                  <p className="text-lg text-gray-200 mt-2">
                    {members.length}/{party?.max_players} players
                  </p>
                  
                  {/* Party Code Display */}
                  <div className="mt-4 flex items-center gap-2 bg-black/25 px-3 py-1.5 rounded-lg border border-white/10 w-fit">
                    <span className="text-sm text-gray-300 font-mono">Code: <span className="font-bold text-cyan-300 tracking-wider">{partyCode}</span></span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-gray-300 hover:text-white hover:bg-white/10"
                      onClick={copyPartyCode}
                      title="Copy Party Code"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-gray-300 hover:text-white hover:bg-white/10"
                      onClick={shareParty}
                      title="Invite Friends"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isLeader && (
                  <Button
                    onClick={async () => {
                      try {
                        // Find matching game to update game_id
                        const selectedGameId = game || 'monopoly';
                        
                        await supabase.from('parties').update({
                          game: selectedGameId.charAt(0).toUpperCase() + selectedGameId.slice(1),
                          game_id: selectedGameId,
                          map: map,
                          queue: queue,
                          status: 'ready'
                        }).eq('id', partyId)

                        // Broadcast game launch to other members via websocket channel
                        if (window.partyChannel) {
                          window.partyChannel.send({
                            type: 'broadcast',
                            event: 'game_launch',
                            payload: { gameId: selectedGameId }
                          })
                        }

                        // Launch game using the selected game slug
                        const gameLaunchUrl = `/games/${selectedGameId}?partyId=${partyId}`;
                        router.push(gameLaunchUrl);
                      } catch (error) {
                        console.error('Error starting game:', error)
                      }
                    }}
                    className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg shadow-lg font-bold"
                  >
                    Start Game
                  </Button>
                )}
              </div>
            </div>

            {/* Game Settings */}
            <Card className="bg-white/5 backdrop-blur-md border border-white/20 hover:border-purple-300 transition-all duration-300 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">Game Settings</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="game" className="text-white mb-2">
                    Select Game
                  </Label>
                  <select
                    id="game"
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="w-full bg-white/5 border-white/20 hover:border-white/50 focus:border-purple-300 focus:ring-purple-300 rounded-lg p-2 text-white bg-slate-900"
                    disabled={!isLeader}
                  >
                    <option value="" className="bg-slate-900">Select a game</option>
                    <option value="monopoly" className="bg-slate-900">Monopoly</option>
                    <option value="valorant" className="bg-slate-900">Valorant</option>
                    <option value="league" className="bg-slate-900">League of Legends</option>
                    <option value="apex" className="bg-slate-900">Apex Legends</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="map" className="text-white mb-2">
                    Select Map
                  </Label>
                  <select
                    id="map"
                    value={map}
                    onChange={(e) => setMap(e.target.value)}
                    className="w-full bg-white/5 border-white/20 hover:border-white/50 focus:border-purple-300 focus:ring-purple-300 rounded-lg p-2"
                  >
                    <option value="">Select a map</option>
                    <option value="ascent">Ascent</option>
                    <option value="bind">Bind</option>
                    <option value="haven">Haven</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="queue" className="text-white mb-2">
                    Queue Type
                  </Label>
                  <select
                    id="queue"
                    value={queue}
                    onChange={(e) => setQueue(e.target.value)}
                    className="w-full bg-white/5 border-white/20 hover:border-white/50 focus:border-purple-300 focus:ring-purple-300 rounded-lg p-2"
                  >
                    <option value="">Select queue</option>
                    <option value="competitive">Competitive</option>
                    <option value="unrated">Unrated</option>
                    <option value="spike_rush">Spike Rush</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Chat Section */}
            <Card className="bg-white/5 backdrop-blur-md border border-white/20 hover:border-purple-300 transition-all duration-300 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">Party Chat</h2>
              <div className="space-y-4">
                <div className="h-64 overflow-y-auto border border-white/20 p-4 rounded-lg bg-white/5">
                  {messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold">
                          {message.user.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white mb-1">{message.user.email}</p>
                        <p className="text-gray-300">{message.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(message.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-gray-300 text-center py-4">
                      No messages yet...
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border-white/20 hover:border-white/50 focus:border-purple-300 focus:ring-purple-300"
                  />
                  <Button
                    onClick={async () => {
                      if (!newMessage.trim()) return

                      await supabase.from('messages').insert([
                        {
                          party_id: partyId,
                          user_id: session?.user?.id,
                          content: newMessage,
                          created_at: new Date().toISOString()
                        }
                      ])

                      setNewMessage('')
                    }}
                    className="bg-gradient-to-r from-blue-600 to-purple-700 hover:from-blue-700 hover:to-purple-800 text-white px-6 py-3 rounded-lg shadow-lg"
                  >
                    Send
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Party Members Tab */}
          <div className="w-full md:w-96">
            <Card className="bg-white/5 backdrop-blur-md border border-white/20 hover:border-purple-300 transition-all duration-300 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">Party Members</h2>
              <div className="space-y-4">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-white/10 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold">
                          {member.user?.email?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-medium text-white">
                          {member.user?.username || member.user?.email || 'Unknown User'}
                        </h3>
                        <p className="text-sm text-gray-300">
                          {member.role === 'leader' ? 'Party Leader' : 'Member'}
                          {member.user_id === session?.user?.id && ' (You)'}
                        </p>
                      </div>
                    </div>
                    {isLeader && member.role !== 'leader' && (
                      <Button
                        onClick={async () => {
                          await supabase
                            .from('party_members')
                            .delete()
                            .eq('id', member.id)
                        }}
                        variant="ghost"
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white"
                      >
                        Kick
                      </Button>
                    )}
                  </div>
                ))}
                
                {members.length < party?.max_players && (
                  <div className="text-center text-gray-400">
                    <p>{party?.max_players - members.length} spots remaining</p>
                    <Button
                      onClick={() => {
                        // TODO: Implement invite friends functionality
                        alert('Invite friends feature coming soon!')
                      }}
                      variant="outline"
                      className="mt-4 w-full text-white hover:bg-purple-900"
                    >
                      Invite Friends
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

