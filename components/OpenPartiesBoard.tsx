"use client"

import { useCallback, useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { Users, RefreshCw, DoorOpen, Loader2 } from "lucide-react"
import { getGameById } from "@/lib/games-catalog"
import { OPEN_PARTIES_EMPTY } from "@/lib/copy"

interface OpenParty {
  id: string
  name: string
  max_players: number
  game_id: string | null
  created_by: string
  members: number
  hostName: string
}

// A public board of parties looking for players — turns a dead lobby into
// somewhere you can walk into a game. Live-updates as parties open/fill.
export function OpenPartiesBoard({ client, userId }: { client: SupabaseClient; userId: string }) {
  const router = useRouter()
  const [parties, setParties] = useState<OpenParty[]>([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      // Open = public, not ended, not already mid-game.
      const { data: rows } = await client
        .from("parties")
        .select("id, name, max_players, game_id, status, created_by, created_at, party_members(count)")
        .eq("is_private", false)
        .not("status", "in", "(ended,ready,playing)")
        .order("created_at", { ascending: false })
        .limit(20)

      // Parties the user already belongs to (to hide).
      const { data: mine } = await client.from("party_members").select("party_id").eq("user_id", userId)
      const myIds = new Set((mine || []).map((m: any) => m.party_id))

      const hostIds = Array.from(new Set((rows || []).map((r: any) => r.created_by).filter(Boolean)))
      const nameById: Record<string, string> = {}
      if (hostIds.length) {
        const { data: profs } = await client.from("profiles").select("id, username, display_name").in("id", hostIds)
        ;(profs || []).forEach((p: any) => { nameById[p.id] = p.display_name || p.username || "Someone" })
      }

      const list: OpenParty[] = (rows || [])
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          max_players: r.max_players || 8,
          game_id: r.game_id,
          created_by: r.created_by,
          members: r.party_members?.[0]?.count ?? 0,
          hostName: nameById[r.created_by] || "Someone",
        }))
        .filter((p) => p.created_by !== userId && !myIds.has(p.id) && p.members < p.max_players)

      setParties(list)
    } catch {
      setParties([])
    } finally {
      setLoading(false)
    }
  }, [client, userId])

  useEffect(() => {
    load()
    const ch = client
      .channel("open-parties")
      .on("postgres_changes", { event: "*", schema: "public", table: "parties" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "party_members" }, () => load())
      .subscribe()
    return () => { client.removeChannel(ch) }
  }, [client, load])

  const join = async (p: OpenParty) => {
    setJoining(p.id)
    try {
      await client.from("party_members").insert({ party_id: p.id, user_id: userId, role: "member" })
    } catch {
      /* may already be a member — proceed to the party either way */
    }
    router.push(`/party/${p.id}`)
  }

  return (
    <div className="glass overflow-hidden shadow-soft">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-white">
          <DoorOpen className="h-5 w-5 text-mint-400" />
          Open Parties
        </h2>
        <button onClick={() => { setLoading(true); load() }} className="text-white/60 hover:text-white" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[320px] overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-white/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : parties.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-medium text-white">{OPEN_PARTIES_EMPTY.title}</p>
            <p className="mt-1 text-sm text-white/50">{OPEN_PARTIES_EMPTY.body}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {parties.map((p) => {
              const game = getGameById(p.game_id)
              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-1.5 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 hover:border-white/15"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{p.name}</p>
                    <p className="truncate text-xs text-white/50">
                      Hosted by {p.hostName}
                      {game ? ` · ${game.name}` : ""}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-white/60">
                    <Users className="h-3.5 w-3.5" />
                    {p.members}/{p.max_players}
                  </span>
                  <button
                    onClick={() => join(p)}
                    disabled={joining === p.id}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {joining === p.id ? "Joining…" : "Join"}
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
