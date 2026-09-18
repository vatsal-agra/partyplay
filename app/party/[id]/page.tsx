"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Copy, Check, Share2, ArrowLeft, Crown, Trophy, Vote as VoteIcon, Rocket } from "lucide-react"
import { useRouter, useParams } from "next/navigation"
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import { getGameById, gamePath } from "@/lib/games-catalog";
import { PartyInactivityWarning } from "@/components/PartyInactivityWarning";
import { VoiceChat } from "@/components/VoiceChat";
import { playAsGuest } from "@/lib/guest";
import { touchParty } from "@/lib/partyActivity";
import { passHost } from "@/lib/partyHost";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import type { Session } from "@supabase/auth-helpers-nextjs";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Party, PartyMember, Message, Vote, UserProfile } from "@/app/types";

declare global {
  interface Window {
    partyChannel?: RealtimeChannel;
  }
}

// Chat stamps: a quiet local time on the line, the full local datetime on hover.
function chatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function chatTimeFull(iso: string) {
  return new Date(iso).toLocaleString()
}

// Consecutive lines from the same person inside the same minute read cleaner
// with a single stamp on the first of them.
function sameMinute(a: string, b: string) {
  const x = new Date(a)
  const y = new Date(b)
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate() &&
    x.getHours() === y.getHours() &&
    x.getMinutes() === y.getMinutes()
  )
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
  // Which share control was last used, so the button itself confirms the copy
  // instead of throwing a browser alert() at the host.
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  // Host handoff: the member the host picked, held until they confirm.
  const [memberToPromote, setMemberToPromote] = useState<PartyMember | null>(null);
  const [passingHost, setPassingHost] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);
  const launchChannelRef = useRef<RealtimeChannel | null>(null);
  const unreadChatCountRef = useRef(0);
  const originalTitleRef = useRef<string | null>(null);
  // Last known party status — so only a genuine transition INTO "ready" (a fresh
  // launch) auto-redirects, not an in-progress "playing"/"ready" heartbeat.
  const prevPartyStatusRef = useRef<string | null>(null);
  const supabase = getSupabaseBrowserClient()

  const handleGuestJoin = async () => {
    setGuestLoading(true);
    setGuestError(null);
    const { error } = await playAsGuest(supabase, guestName);
    if (error) { setGuestError(error); setGuestLoading(false); return; }
    // onAuthStateChange picks up the new session and loads the party.
  };

  const sendPartyChat = async () => {
    const text = newMessage.trim()
    if (!text || !session?.user?.id) return
    await supabase.from("messages").insert([
      {
        party_id: partyId,
        user_id: session.user.id,
        content: text,
        created_at: new Date().toISOString(),
      },
    ])
    touchParty(supabase, partyId)
    setNewMessage("")
  }

  // Hand the host role to another seated member. The old host stays in the
  // party as an ordinary member until they leave on their own.
  const confirmPassHost = async () => {
    const target = memberToPromote
    if (!target || !session?.user?.id) return
    setPassingHost(true)
    setHostError(null)
    const { error } = await passHost(supabase, partyId, session.user.id, target.user_id)
    setPassingHost(false)
    setMemberToPromote(null)
    if (error) {
      setHostError(`Could not pass the host: ${error}`)
      return
    }
    touchParty(supabase, partyId)
    await getParty(session)
  }

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

  // Turnout, for the "who is winning" banner. Guests can outnumber the member
  // rows in odd states, so clamp rather than render a >100% bar.
  const totalVotes = votes.length
  const undecidedCount = Math.max(0, members.length - totalVotes)
  const everyoneVoted = members.length > 0 && undecidedCount === 0
  const turnoutPct = members.length ? Math.min(100, Math.round((totalVotes / members.length) * 100)) : 0

  useEffect(() => {
    const restoreTitle = () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
      unreadChatCountRef.current = 0;
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) restoreTitle();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      restoreTitle();
    };
  }, [partyId]);

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

      // Remember the current status for the transition-guarded realtime listener.
      prevPartyStatusRef.current = partyData?.status ?? null

      // Auto-redirect only if a game is actively being launched. Once a game is
      // in progress the status is "playing", so reloading /party mid-game no
      // longer forces the member back into the game.
      if (partyData && partyData.status === 'ready') {
        router.push(gamePath(partyData.game_id || 'monopoly', `?partyId=${partyId}`))
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
          }, (payload) => {
            if (payload.eventType === 'INSERT' &&
                payload.new.user_id !== session.user.id && document.hidden) {
              if (originalTitleRef.current === null) {
                originalTitleRef.current = document.title;
              }
              unreadChatCountRef.current += 1;
              document.title = `(${unreadChatCountRef.current}) ${originalTitleRef.current}`;
            }
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
            const wasReady = prevPartyStatusRef.current === 'ready'
            prevPartyStatusRef.current = updated?.status ?? prevPartyStatusRef.current
            if (updated && updated.status === 'ready' && !wasReady) {
              router.push(gamePath(updated.game_id || 'monopoly', `?partyId=${partyId}`))
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
            router.push(gamePath(payload.gameId || 'monopoly', `?partyId=${partyId}`))
          })
          .subscribe()
      }

      // Shared launch channel — same one the games page uses, so a launch from
      // either screen reliably moves every member into the game.
      if (!launchChannelRef.current) {
        launchChannelRef.current = supabase
          .channel(`party-launch-${partyId}`)
          .on('broadcast', { event: 'launch' }, ({ payload }) => {
            router.push(gamePath(payload?.gameId || 'monopoly', `?partyId=${partyId}`))
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

      router.push(gamePath(gameId, `?partyId=${partyId}`))
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
          <p className="mt-1 text-sm text-white/60">Pick a name and jump straight in. No sign-up needed.</p>
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

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/party/${partyId}` : ''
  const shareText = `Join my Dice Alley game night! Party code: ${partyCode}`

  const flashCopied = (what: "code" | "link") => {
    setCopied(what)
    setTimeout(() => setCopied((current) => (current === what ? null : current)), 1800)
  }

  const copyPartyCode = () => {
    navigator.clipboard.writeText(partyCode).then(() => flashCopied("code")).catch(() => {})
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${shareText} ${inviteLink}`).then(() => flashCopied("link")).catch(() => {})
  }

  const shareParty = () => {
    // Native share sheet where it exists (tablets, some laptops), clipboard
    // everywhere else so the button always does something useful.
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Join my Dice Alley game night!',
        text: shareText,
        url: inviteLink,
      }).catch(() => {})
    } else {
      copyInviteLink()
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
                  
                  {/* Invite card: the one thing a host needs to hand out */}
                  <div className="mt-4 w-fit max-w-full rounded-xl border border-white/15 bg-black/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                      Invite your friends
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={copyPartyCode}
                        title="Copy the party code"
                        className="inline-flex items-center gap-3 rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 transition-colors hover:border-cyan-300/60 hover:bg-black/60"
                      >
                        <span className="font-mono text-xl font-bold tracking-[0.35em] text-cyan-300">{partyCode}</span>
                        {copied === "code"
                          ? <Check className="h-4 w-4 text-emerald-400" />
                          : <Copy className="h-4 w-4 text-white/60" />}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 bg-white/10 text-white hover:bg-white/20"
                        onClick={shareParty}
                        title="Share the invite link"
                      >
                        {copied === "link"
                          ? <Check className="h-4 w-4 text-emerald-400" />
                          : <Share2 className="h-4 w-4" />}
                        {copied === "link" ? "Link copied" : "Share invite link"}
                      </Button>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${inviteLink}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-[#d6a85c]/40 bg-background px-3 text-xs font-semibold text-[#efd9a4] transition-colors hover:border-[#d6a85c] hover:bg-[#d6a85c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a85c] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label="Share invite on WhatsApp (opens in a new tab)"
                      >
                        WhatsApp
                      </a>
                      <a
                        href={`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-[#d6a85c]/40 bg-background px-3 text-xs font-semibold text-[#efd9a4] transition-colors hover:border-[#d6a85c] hover:bg-[#d6a85c]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6a85c] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label="Share invite on Telegram (opens in a new tab)"
                      >
                        Telegram
                      </a>
                    </div>
                    <p className="mt-2 text-xs text-white/60">
                      {copied === "code"
                        ? "Code copied. Paste it in the group chat."
                        : "Friends can join as guests, no account needed."}
                    </p>
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
                {myVoteName && (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    Your vote: {myVoteName}
                  </span>
                )}
              </div>

              {/* Who is actually winning, stated plainly before the tally, plus
                  how many players are still deciding. */}
              <div
                className={`mb-5 rounded-xl border p-4 ${
                  maxVotes === 0
                    ? 'border-white/10 bg-white/5'
                    : isTie
                      ? 'border-amber-300/50 bg-amber-400/10'
                      : 'border-emerald-400/50 bg-emerald-400/10'
                }`}
              >
                {maxVotes === 0 ? (
                  <p className="text-sm text-gray-300">No votes yet. The first vote sets the pace.</p>
                ) : isTie ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-200/80">
                      Tied at {maxVotes} {maxVotes === 1 ? 'vote' : 'votes'}
                    </p>
                    <p className="mt-1 font-display text-2xl font-bold text-white">
                      {winners.map((w) => w.name).join(' vs ')}
                    </p>
                    <p className="mt-1 text-sm text-amber-100/80">
                      {isLeader ? 'Pick the winner below to launch it.' : 'The host will break the tie.'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200/80">
                      {everyoneVoted ? 'Winner' : 'Currently winning'}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Crown className="h-6 w-6 shrink-0 text-yellow-300" />
                      <p className="font-display text-2xl font-bold text-white">{winners[0].name}</p>
                    </div>
                    <p className="mt-1 text-sm text-emerald-100/80">
                      {winners[0].count} of {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                      {isLeader ? '. Start it below whenever you are ready.' : '. Waiting for the host to launch.'}
                    </p>
                  </>
                )}

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>{totalVotes} of {members.length} players voted</span>
                    <span>
                      {undecidedCount > 0
                        ? `${undecidedCount} still deciding`
                        : 'Everyone has voted'}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
                      style={{ width: `${turnoutPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {voteTally.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-300 mb-1">Nobody has voted yet.</p>
                  <p className="text-sm text-gray-400 mb-5">
                    Head to the games page and vote for what you want to play. The most-voted game wins.
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
                    // Share of all votes cast, so the bar lengths tell the real
                    // story instead of pinning the leader at 100%.
                    const pct = totalVotes > 0 ? Math.round((t.count / totalVotes) * 100) : 0
                    const gameImg = getGameById(t.gameId)?.image
                    return (
                      <div
                        key={t.gameId}
                        className={`relative overflow-hidden rounded-lg border p-3 ${
                          isWinner ? 'border-yellow-400/70 bg-yellow-400/10 shadow-lg shadow-yellow-400/5' : 'border-white/10 bg-white/5'
                        }`}
                      >
                        {/* progress fill */}
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-500 ${isWinner ? 'bg-yellow-400/20' : 'bg-cyan-400/10'}`}
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
                              {isWinner && (
                                <span className="shrink-0 rounded-full bg-yellow-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-200">
                                  {isTie ? 'Tied' : everyoneVoted ? 'Winner' : 'Leading'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-300 truncate">{t.voters.join(', ')}</p>
                          </div>
                          <div className="text-right">
                            <span className="block font-bold text-white whitespace-nowrap">
                              {t.count} {t.count === 1 ? 'vote' : 'votes'}
                            </span>
                            <span className="block text-xs text-gray-400">{pct}%</span>
                          </div>
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
                        <span className="text-yellow-200 font-semibold">{effectiveWinner.name}</span> is winning. Waiting for the host to launch.
                      </p>
                    ) : isTie ? (
                      <p className="text-sm text-gray-200 mb-3">It&apos;s a tie. The host will pick the winner.</p>
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
                  {messages.map((message, i) => {
                    const prev = i > 0 ? messages[i - 1] : null
                    const stacked =
                      !!prev &&
                      prev.user_id === message.user_id &&
                      sameMinute(prev.created_at, message.created_at)
                    return (
                      <div key={message.id} className="flex items-start gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center">
                          <span className="text-white font-bold">
                            {message.user.email[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white mb-1 flex items-baseline gap-2">
                            <span>{message.user.email}</span>
                            {!stacked && (
                              <span
                                className="text-xs text-gray-400"
                                title={chatTimeFull(message.created_at)}
                              >
                                {chatTime(message.created_at)}
                              </span>
                            )}
                          </p>
                          <p className="text-gray-300">{message.content}</p>
                        </div>
                      </div>
                    )
                  })}
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        void sendPartyChat()
                      }
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-white/5 border-white/20 hover:border-white/50 focus:border-purple-300 focus:ring-purple-300"
                  />
                  <Button onClick={() => void sendPartyChat()} variant="brand">
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
              {hostError && (
                <p className="mb-4 text-sm font-medium text-red-300">{hostError}</p>
              )}
              <div className="space-y-4">
                {members.map((member) => {
                  const isHostMember = member.user_id === party?.created_by
                  return (
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
                          {isHostMember ? 'Party Leader' : 'Member'}
                          {member.user_id === session?.user?.id && ' (You)'}
                        </p>
                      </div>
                    </div>
                    {isLeader && !isHostMember && (
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => {
                            setHostError(null)
                            setMemberToPromote(member)
                          }}
                          variant="ghost"
                          disabled={passingHost}
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-200 hover:text-white"
                        >
                          <Crown className="h-4 w-4 mr-1" />
                          Pass host
                        </Button>
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
                      </div>
                    )}
                  </div>
                  )
                })}
                
                {members.length < party?.max_players && (
                  <div className="text-center text-gray-400">
                    <p>{party?.max_players - members.length} spots remaining</p>
                    <Button
                      onClick={shareParty}
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

      <ConfirmationModal
        isOpen={memberToPromote !== null}
        onClose={() => setMemberToPromote(null)}
        onConfirm={() => { void confirmPassHost() }}
        title="Pass host"
        message={`Make ${memberToPromote?.user?.username || memberToPromote?.user?.email || 'this member'} the host? They get the host controls and you stay in the party as a member.`}
        confirmButtonText={passingHost ? 'Passing...' : 'Pass host'}
      />

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

