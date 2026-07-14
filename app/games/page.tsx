"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Search, Filter, Gamepad2, Vote as VoteIcon, ArrowRight, Rocket } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { GameCard } from "@/components/games/GameCard"
import { Game, Filters } from "@/app/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PartiesSidebar } from "@/components/PartiesSidebar"
import { GAMES_CATALOG, gamePath } from "@/lib/games-catalog"
import { PartyInactivityWarning } from "@/components/PartyInactivityWarning"
import { touchParty, cleanupStaleParties } from "@/lib/partyActivity"

// The party the current viewer belongs to (host or member).
interface ActiveParty {
  id: string
  name: string
  status: string | null
  created_by: string
  game_id?: string | null
  isHost: boolean
}

interface VoteRow {
  user_id: string
  game_id: string
  game_name: string
  user_name: string | null
}

export default function GamesPage() {
  const router = useRouter()
  const supabaseClient = getSupabaseBrowserClient()
  const launchChannelRef = useRef<any>(null)

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [games] = useState<Game[]>(GAMES_CATALOG)
  const [activeParty, setActiveParty] = useState<ActiveParty | null>(null)
  const [votes, setVotes] = useState<VoteRow[]>([])
  const [filters, setFilters] = useState<Filters>({
    players: "",
    complexity: "",
    duration: "",
  })

  const displayName = useMemo(() => {
    if (!session?.user) return "Someone"
    return (
      session.user.user_metadata?.username ||
      session.user.user_metadata?.full_name ||
      session.user.email?.split("@")[0] ||
      "Someone"
    )
  }, [session])

  // Filter games based on search and filters
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch =
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.description.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesPlayers =
        !filters.players ||
        (game.minPlayers <= parseInt(filters.players) && game.maxPlayers >= parseInt(filters.players))

      const matchesComplexity = !filters.complexity || game.complexity === filters.complexity

      const matchesDuration =
        !filters.duration ||
        (() => {
          const maxDuration = parseInt(filters.duration) * 30
          const [minDuration] = game.duration.split("-").map((s) => parseInt(s.trim()))
          return minDuration <= maxDuration
        })()

      return matchesSearch && matchesPlayers && matchesComplexity && matchesDuration
    })
  }, [games, searchQuery, filters])

  // ----- Vote tallies -------------------------------------------------------
  const tally = useMemo(() => {
    const map: Record<string, { count: number; voters: string[] }> = {}
    for (const v of votes) {
      if (!map[v.game_id]) map[v.game_id] = { count: 0, voters: [] }
      map[v.game_id].count += 1
      map[v.game_id].voters.push(v.user_name || "Someone")
    }
    return map
  }, [votes])

  const maxVotes = useMemo(() => {
    const counts = Object.values(tally).map((t) => t.count)
    return counts.length ? Math.max(...counts) : 0
  }, [tally])

  const myVoteGameId = useMemo(() => {
    if (!session?.user?.id) return null
    return votes.find((v) => v.user_id === session.user.id)?.game_id ?? null
  }, [votes, session])

  const leadingGameName = useMemo(() => {
    if (maxVotes === 0) return null
    const leaders = Object.entries(tally)
      .filter(([, t]) => t.count === maxVotes)
      .map(([gameId]) => games.find((g) => g.id === gameId)?.name)
      .filter(Boolean) as string[]
    if (leaders.length === 0) return null
    if (leaders.length === 1) return leaders[0]
    return `${leaders.slice(0, -1).join(", ")} & ${leaders[leaders.length - 1]} (tie)`
  }, [tally, maxVotes, games])

  // The single game the host will launch (first leader on a tie).
  const leadingGameId = useMemo(() => {
    if (maxVotes === 0) return null
    const leaders = Object.entries(tally)
      .filter(([, t]) => t.count === maxVotes)
      .map(([gameId]) => gameId)
    return leaders[0] ?? null
  }, [tally, maxVotes])

  // ----- Data fetching ------------------------------------------------------
  const fetchVotes = useCallback(
    async (partyId: string) => {
      const { data, error } = await supabaseClient
        .from("votes")
        .select("user_id, game_id, game_name, user_name")
        .eq("party_id", partyId)
      if (!error && data) setVotes(data as VoteRow[])
    },
    [supabaseClient]
  )

  // Find the party the user is currently part of (as host or as a member).
  const fetchActiveParty = useCallback(
    async (userId: string) => {
      try {
        // Remove the user's own parties that have gone idle past the TTL.
        await cleanupStaleParties(supabaseClient, userId)

        // Parties this user is a member of
        const { data: memberships } = await supabaseClient
          .from("party_members")
          .select("party_id")
          .eq("user_id", userId)

        const partyIds = new Set<string>((memberships || []).map((m: any) => m.party_id))

        // Parties this user hosts
        const { data: hosted } = await supabaseClient
          .from("parties")
          .select("*")
          .eq("created_by", userId)
          .neq("status", "ended")
          .order("created_at", { ascending: false })

        let party: any = (hosted || [])[0] || null

        // If not hosting, resolve the most recent active party they belong to
        if (!party && partyIds.size > 0) {
          const { data: memberParties } = await supabaseClient
            .from("parties")
            .select("*")
            .in("id", Array.from(partyIds))
            .neq("status", "ended")
            .order("created_at", { ascending: false })
          party = (memberParties || [])[0] || null
        }

        if (party) {
          setActiveParty({
            id: party.id,
            name: party.name,
            status: party.status ?? null,
            created_by: party.created_by,
            game_id: party.game_id ?? null,
            isHost: party.created_by === userId,
          })
          await fetchVotes(party.id)
        } else {
          setActiveParty(null)
        }
      } catch (error) {
        console.error("Error fetching active party:", error)
      } finally {
        setLoading(false)
      }
    },
    [supabaseClient, fetchVotes]
  )

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession()
        setSession(session || null)
        if (session?.user?.id) {
          await fetchActiveParty(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error("Error getting session:", error)
        setLoading(false)
      }
    }
    getSession()
  }, [supabaseClient, fetchActiveParty])

  // Realtime: keep tallies live + auto-launch when the host starts the game.
  useEffect(() => {
    if (!activeParty?.id) return
    const partyId = activeParty.id

    const channel = supabaseClient
      .channel(`games-voting-${partyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `party_id=eq.${partyId}` },
        () => fetchVotes(partyId)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "parties", filter: `id=eq.${partyId}` },
        (payload) => {
          const updated = payload.new as any
          if (updated?.status === "ready") {
            router.push(gamePath(updated.game_id || "monopoly", `?partyId=${partyId}`))
          }
        }
      )
      // Party ended/deleted → stop showing the voting UI.
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "parties", filter: `id=eq.${partyId}` },
        () => {
          setActiveParty(null)
          setVotes([])
        }
      )
      // Membership changed (you left / were kicked) → re-resolve the active party.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "party_members", filter: `party_id=eq.${partyId}` },
        () => {
          const uid = session?.user?.id
          if (uid) fetchActiveParty(uid)
        }
      )
      .subscribe()

    // Shared launch channel — reliable redirect for every party member,
    // independent of postgres realtime config (works from games or party page).
    const launchChannel = supabaseClient
      .channel(`party-launch-${partyId}`)
      .on("broadcast", { event: "launch" }, ({ payload }) => {
        router.push(gamePath(payload?.gameId || "monopoly", `?partyId=${partyId}`))
      })
      .subscribe()
    launchChannelRef.current = launchChannel

    return () => {
      supabaseClient.removeChannel(channel)
      supabaseClient.removeChannel(launchChannel)
      launchChannelRef.current = null
    }
  }, [activeParty?.id, supabaseClient, fetchVotes, fetchActiveParty, router, session])

  // ----- Voting -------------------------------------------------------------
  const handleVote = useCallback(
    async (game: Game) => {
      if (!session?.user?.id || !activeParty) return
      const userId = session.user.id
      const partyId = activeParty.id
      touchParty(supabaseClient, partyId)

      // Toggle off if voting for the game you already chose
      if (myVoteGameId === game.id) {
        setVotes((prev) => prev.filter((v) => v.user_id !== userId)) // optimistic
        await supabaseClient.from("votes").delete().eq("party_id", partyId).eq("user_id", userId)
        fetchVotes(partyId)
        return
      }

      // Optimistic update (single vote per member)
      setVotes((prev) => [
        ...prev.filter((v) => v.user_id !== userId),
        { user_id: userId, game_id: game.id, game_name: game.name, user_name: displayName },
      ])

      const { error } = await supabaseClient.from("votes").upsert(
        {
          party_id: partyId,
          user_id: userId,
          game_id: game.id,
          game_name: game.name,
          user_name: displayName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "party_id,user_id" }
      )
      if (error) console.error("Error casting vote:", error)
      fetchVotes(partyId)
    },
    [session, activeParty, myVoteGameId, displayName, supabaseClient, fetchVotes]
  )

  // Host launches the most-voted game for the whole party.
  const handleHostLaunch = useCallback(async () => {
    if (!activeParty?.isHost || !leadingGameId) return
    const game = games.find((g) => g.id === leadingGameId)
    const partyId = activeParty.id

    // 1. Persist the choice first — this is the durable path: every member's
    //    parties-row realtime listener redirects them, even if the ephemeral
    //    broadcast is missed. Set status back and forth so a repeat launch of
    //    the same game still fires a fresh UPDATE event.
    await supabaseClient
      .from("parties")
      .update({
        game: game?.name || leadingGameId,
        game_id: leadingGameId,
        game_image: game?.image || null,
        status: "ready",
        last_active_at: new Date().toISOString(), // guarantees a fresh UPDATE event even on a repeat launch
      })
      .eq("id", partyId)

    // 2. Broadcast the fast path — AWAIT so it actually flushes to subscribers
    //    before we navigate away and tear the channel down (this race was why
    //    it used to take 2–3 tries). Send twice for good measure.
    try {
      const ch = launchChannelRef.current
      if (ch) {
        await ch.send({ type: "broadcast", event: "launch", payload: { gameId: leadingGameId } })
        await ch.send({ type: "broadcast", event: "launch", payload: { gameId: leadingGameId } })
      }
    } catch { /* the DB path still redirects everyone */ }

    // 3. Now take the host in too.
    router.push(gamePath(leadingGameId, `?partyId=${partyId}`))
  }, [activeParty, leadingGameId, games, supabaseClient, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-grape-400"></div>
      </div>
    )
  }

  const votingEnabled = !!activeParty
  const totalVotes = votes.length

  return (
    <div className="min-h-screen overflow-x-hidden">
      <div className="flex h-full w-full">
        <div className="flex-1 overflow-y-auto py-10 w-0 min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass p-6 sm:p-8 shadow-soft">
              {/* Voting banner (only when in a party) */}
              <AnimatePresence>
                {votingEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 rounded-xl border border-cyan-300/40 bg-gradient-to-r from-cyan-500/20 to-pink-500/20 p-5"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-cyan-500/30 p-2">
                          <VoteIcon className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">
                            🗳️ Voting for{" "}
                            <span className="text-cyan-200">{activeParty?.name}</span>
                          </h2>
                          <p className="text-sm text-white/80">
                            {myVoteGameId
                              ? "Your vote is in — tap another game to change it, or tap it again to undo."
                              : "Tap Vote on the game you want to play. Most votes wins!"}
                            {leadingGameName && (
                              <>
                                {" "}
                                Currently leading: <span className="font-semibold text-yellow-200">{leadingGameName}</span>.
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {activeParty?.isHost && leadingGameId && (
                          <Button
                            onClick={handleHostLaunch}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold whitespace-nowrap"
                          >
                            <Rocket className="mr-2 h-4 w-4" />
                            Start {games.find((g) => g.id === leadingGameId)?.name || "game"}
                          </Button>
                        )}
                        <Button
                          onClick={() => router.push(`/party/${activeParty?.id}`)}
                          className="bg-white/15 hover:bg-white/25 text-white border border-white/20 whitespace-nowrap"
                        >
                          Back to party
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/60">
                      {totalVotes} {totalVotes === 1 ? "vote" : "votes"} cast so far
                      {activeParty?.isHost && " · As host, you can start the winning game right here."}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white">
                    {votingEnabled ? "Vote For Your Next Game" : "Find Your Next Game"}
                  </h1>
                  <p className="text-gray-200">
                    {votingEnabled
                      ? "Rally your party around a favourite — the most-voted game gets played."
                      : "Browse our collection of board games and start playing with friends"}
                  </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search games..."
                      className="pl-10 w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border-white/20 text-white"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 p-4 bg-black/30 rounded-lg border border-white/10 mb-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Players</label>
                          <select
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                            value={filters.players}
                            onChange={(e) => setFilters({ ...filters, players: e.target.value })}
                          >
                            <option value="">Any</option>
                            <option value="1">1 Player</option>
                            <option value="2">2 Players</option>
                            <option value="3">3 Players</option>
                            <option value="4">4 Players</option>
                            <option value="5+">5+ Players</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Complexity</label>
                          <select
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                            value={filters.complexity}
                            onChange={(e) => setFilters({ ...filters, complexity: e.target.value })}
                          >
                            <option value="">Any</option>
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Duration</label>
                          <select
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                            value={filters.duration}
                            onChange={(e) => setFilters({ ...filters, duration: e.target.value })}
                          >
                            <option value="">Any</option>
                            <option value="<30">Under 30 min</option>
                            <option value="30-60">30-60 min</option>
                            <option value="60+">60+ min</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFilters({ players: "", complexity: "", duration: "" })
                            setSearchQuery("")
                          }}
                          className="text-white border-white/50 hover:bg-white/10"
                        >
                          Clear all filters
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredGames.length === 0 ? (
                <div className="text-center py-12">
                  <Gamepad2 className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-lg font-medium text-white">No games found</h3>
                  <p className="mt-1 text-gray-300">Try adjusting your search or filter criteria</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredGames.map((game) => {
                    const t = tally[game.id]
                    const count = t?.count ?? 0
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        onPlay={() => router.push(gamePath(game.id))}
                        isInParty={activeParty?.game_id === game.id}
                        isCreatingParty={false}
                        votingEnabled={votingEnabled}
                        voteCount={count}
                        voters={t?.voters ?? []}
                        hasVoted={myVoteGameId === game.id}
                        isLeading={count === maxVotes && maxVotes > 0}
                        onVote={() => handleVote(game)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parties Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0 border-l border-white/10 bg-white/[0.02] backdrop-blur-xl p-4 overflow-y-auto">
          <PartiesSidebar />
        </div>
      </div>

      <PartyInactivityWarning
        partyId={activeParty?.id ?? null}
        isHost={!!activeParty?.isHost}
        onClosed={() => { setActiveParty(null); setVotes([]) }}
      />
    </div>
  )
}
