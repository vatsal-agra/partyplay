"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Copy, Share2, ArrowLeft, Crown, Trophy, Vote as VoteIcon, Rocket } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { getGameById } from "@/lib/games-catalog";
import { PartyInactivityWarning } from "@/components/PartyInactivityWarning";
import { VoiceChat } from "@/components/VoiceChat";
import { playAsGuest } from "@/lib/guest";
import { touchParty } from "@/lib/partyActivity";
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
    <div className="min-h-screen">
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [selectedWinnerId, setSelectedWinnerId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const launchChannelRef = useRef<RealtimeChannel | null>(null);
  const supabase = getSupabaseBrowserClient()

  const handleGuestJoin = async () => {
    setGuestLoading(true);
    setGuestError(null);
    const { error } = await playAsGuest(supabase, guestName);
    if (error) { setGuestError(error); setGuestLoading(false); return; }
    // onAuthStateChange picks up the new session and loads the party.
  };

  // Aggregate the party's votes into a per-game tally.
  const voteTally = useMemo(() => {
    const map: Record<string, { gameId: string; name: string; count: number; voters: string[] }> = {}
    for (const v of votes as any[]) {
      const gid: string | undefined = v.game_id
      if (!gid) continue
      if (!map[gid]) {
        map[gid] = { gameId: gid, name: v.game_name || getGameById(gid)?.name || gid, count: 0, voters: [] }
      }
      map[gid].count += 1
      map[gid].voters.push(v.user_name || v.user?.username || v.user?.email || 'Someone')
    }
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [votes])

  const maxVotes = voteTally.length ? voteTally[0].count : 0
  const winners = useMemo(
    () => voteTally.filter((t) => t.count === maxVotes && maxVotes > 0),
    [voteTally, maxVotes]
  )
  const isTie = winners.length > 1
  // The game the host will launch: their pick on a tie, else the sole winner.
  const effectiveWinnerId = isTie ? selectedWinnerId : winners[0]?.gameId ?? null
  const effectiveWinner = winners.find((w) => w.gameId === effectiveWinnerId) ?? null

  const myVote = useMemo(
    () => (votes as any[]).find((v) => v.user_id === session?.user?.id) ?? null,
    [votes, session]
  )
  const myVoteName: string | null = myVote ? (myVote.game_name || getGameById(myVote.game_id)?.name || null) : null

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
      } else {
        // e.g. a guest just signed in — load the party for them.
        setError(null)
        getParty(session)
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
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'votes',
            filter: `party_id=eq.${partyId}`,
          }, () => {
            getParty(session)
          })
          .on('broadcast', { event: 'game_launch' }, ({ payload }) => {
            console.log('Received game_launch broadcast:', payload)
            router.push(`/games/${payload.gameId || 'monopoly'}?partyId=${partyId}`)
          })
          .subscribe()
      }

      // Shared launch channel — same one the games page uses, so a launch from
      // either screen reliably moves every member into the game.
      if (!launchChannelRef.current) {
        launchChannelRef.current = supabase
          .channel(`party-launch-${partyId}`)
          .on('broadcast', { event: 'launch' }, ({ payload }) => {
            router.push(`/games/${payload?.gameId || 'monopoly'}?partyId=${partyId}`)
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
      if (launchChannelRef.current) {
        supabase.removeChannel(launchChannelRef.current)
        launchChannelRef.current = null
      }
    }
  }, [supabase])

  // Host launches the winning game (or their chosen game on a tie).
  const launchGame = async (gameId: string) => {
    if (!gameId || launching) return
    try {
      setLaunching(true)
      const catalogGame = getGameById(gameId)
      await supabase.from('parties').update({
        game: catalogGame?.name || gameId,
        game_id: gameId,
        game_image: catalogGame?.image || null,
        status: 'ready',
      }).eq('id', partyId)

      // Tell everyone (party page + games page voters) to jump into the game.
      window.partyChannel?.send({ type: 'broadcast', event: 'game_launch', payload: { gameId } })
      launchChannelRef.current?.send({ type: 'broadcast', event: 'launch', payload: { gameId } })

      router.push(`/games/${gameId}?partyId=${partyId}`)
    } catch (error) {
      console.error('Error launching game:', error)
      setLaunching(false)
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  // No account? Join the party as a guest — just pick a name.
  if (!session) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="glass-strong w-full max-w-sm p-6 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-2xl shadow-glow-grape">🎉</div>
          <h2 className="text-xl font-black text-white">You're invited to a party!</h2>
          <p className="mt-1 text-sm text-white/60">Pick a name and jump straight in — no sign-up needed.</p>
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGuestJoin()}
            maxLength={24}
            className="mt-4"
          />
          {guestError && <p className="mt-2 text-xs text-red-300">{guestError}</p>}
          <Button variant="brand" className="mt-3 w-full" onClick={handleGuestJoin} disabled={guestLoading}>
            {guestLoading ? "Joining…" : "Join the party"}
          </Button>
          <p className="mt-3 text-xs text-white/45">
            Want to keep your progress?{" "}
            <a href="/auth/sign-up" className="text-grape-300 hover:underline">Create an account</a>
          </p>
        </div>
      </div>
    )
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
    <div className="min-h-screen">
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
            <div className="relative overflow-hidden bg-brand rounded-2xl p-8 shadow-glow-grape">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="font-display text-4xl font-bold text-white drop-shadow">
                    {party?.name}
                  </h1>
                  <p className="text-lg text-white/80 mt-2">
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
                <Button
                  variant="ghost"
                  onClick={() => router.push('/games')}
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-3 rounded-lg font-semibold whitespace-nowrap"
                >
                  <VoteIcon className="mr-2 h-4 w-4" />
                  {myVoteName ? `You voted: ${myVoteName}` : 'Vote on a game'}
                </Button>
              </div>
            </div>

            {/* Game Voting */}
            <Card className="bg-white/5 backdrop-blur-md border border-white/20 hover:border-purple-300 transition-all duration-300 p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <VoteIcon className="h-6 w-6 text-cyan-300" />
                  Game Voting
                </h2>
                <span className="text-sm text-gray-300">
                  {votes.length} / {members.length} voted
                </span>
              </div>

              {voteTally.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-300 mb-1">No votes yet.</p>
                  <p className="text-sm text-gray-400 mb-5">
                    Head to the games page and vote for what you want to play — the most-voted game wins!
                  </p>
                  <Button
                    onClick={() => router.push('/games')}
                    variant="brand"
                  >
                    <VoteIcon className="mr-2 h-4 w-4" />
                    Open Voting
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {voteTally.map((t) => {
                    const isWinner = t.count === maxVotes
                    const pct = maxVotes > 0 ? Math.round((t.count / maxVotes) * 100) : 0
                    const gameImg = getGameById(t.gameId)?.image
                    return (
                      <div
                        key={t.gameId}
                        className={`relative overflow-hidden rounded-lg border p-3 ${
                          isWinner ? 'border-yellow-400/70 bg-yellow-400/10' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        {/* progress fill */}
                        <div
                          className={`absolute inset-y-0 left-0 ${isWinner ? 'bg-yellow-400/15' : 'bg-cyan-400/10'}`}
                          style={{ width: `${pct}%` }}
                        />
                        <div className="relative flex items-center gap-3">
                          {gameImg && (
                            <div className="h-10 w-10 rounded-md overflow-hidden flex-shrink-0 bg-black/30">
                              <Image src={gameImg} alt={t.name} width={40} height={40} className="h-full w-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isWinner && <Crown className="h-4 w-4 text-yellow-300 flex-shrink-0" />}
                              <span className="font-semibold text-white truncate">{t.name}</span>
                            </div>
                            <p className="text-xs text-gray-300 truncate">{t.voters.join(', ')}</p>
                          </div>
                          <span className="font-bold text-white whitespace-nowrap">
                            {t.count} {t.count === 1 ? 'vote' : 'votes'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Launch controls */}
              <div className="mt-6 border-t border-white/10 pt-5">
                {isLeader ? (
                  maxVotes === 0 ? (
                    <Button
                      disabled
                      className="w-full bg-white/10 text-white/60 font-bold cursor-not-allowed"
                    >
                      Waiting for votes…
                    </Button>
                  ) : (
                    <>
                      {isTie && (
                        <div className="mb-4">
                          <p className="text-sm text-yellow-200 mb-2 flex items-center gap-1.5">
                            <Trophy className="h-4 w-4" />
                            It&apos;s a tie! Pick the winner to launch:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {winners.map((w) => (
                              <button
                                key={w.gameId}
                                onClick={() => setSelectedWinnerId(w.gameId)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                                  selectedWinnerId === w.gameId
                                    ? 'bg-yellow-400 text-yellow-950 border-yellow-300'
                                    : 'bg-white/5 text-white border-white/20 hover:bg-white/15'
                                }`}
                              >
                                {w.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        onClick={() => effectiveWinnerId && launchGame(effectiveWinnerId)}
                        disabled={!effectiveWinnerId || launching}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-6 py-6 rounded-lg shadow-lg font-bold text-lg disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <Rocket className="mr-2 h-5 w-5" />
                        {launching
                          ? 'Launching…'
                          : effectiveWinner
                            ? `Start ${effectiveWinner.name}`
                            : 'Pick a game to start'}
                      </Button>
                    </>
                  )
                ) : (
                  <div className="text-center">
                    {effectiveWinner ? (
                      <p className="text-sm text-gray-200 mb-3">
                        <span className="text-yellow-200 font-semibold">{effectiveWinner.name}</span> is winning — waiting for the host to launch.
                      </p>
                    ) : isTie ? (
                      <p className="text-sm text-gray-200 mb-3">It&apos;s a tie — the host will pick the winner.</p>
                    ) : (
                      <p className="text-sm text-gray-200 mb-3">Cast your vote to help decide the game!</p>
                    )}
                    <Button
                      onClick={() => router.push('/games')}
                      variant="outline"
                      className="text-white border-white/20 hover:bg-white/10"
                    >
                      <VoteIcon className="mr-2 h-4 w-4" />
                      {myVoteName ? 'Change my vote' : 'Cast my vote'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Chat Section */}
            <Card className="bg-white/5 backdrop-blur-md border border-white/20 hover:border-purple-300 transition-all duration-300 p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold text-white mb-4">Party Chat</h2>
              <div className="space-y-4">
                <div className="h-64 overflow-y-auto border border-white/20 p-4 rounded-lg bg-white/5">
                  {messages.map((message) => (
                    <div key={message.id} className="flex items-start gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
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
                      touchParty(supabase, partyId)

                      setNewMessage('')
                    }}
                    variant="brand"
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
                      <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center">
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

      <PartyInactivityWarning
        partyId={partyId}
        isHost={isLeader}
        onClosed={() => router.push('/dashboard')}
      />

      {/* Lobby voice — talk with the party before the game even starts */}
      {partyId && session?.user?.id && (
        <VoiceChat
          client={supabase}
          roomId={partyId}
          userId={session.user.id}
          members={members.map((m: any) => ({
            user_id: m.user_id,
            profile: { username: m.user?.username || m.user?.email, display_name: m.user?.username },
          }))}
        />
      )}
    </div>
  )
}

