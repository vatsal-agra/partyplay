"use client"

import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { cleanupStaleParties } from "@/lib/partyActivity"
import { fetchLeaderboard, fetchUserStats, type LeaderboardRow } from "@/lib/gameStats"
import { ACHIEVEMENTS, fetchUserAchievements, isKnownAchievement } from "@/lib/achievements"
import { levelFromXp } from "@/lib/progression"
import { randomLoading } from "@/lib/copy"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Plus, RefreshCw, Trophy, Medal, Award, Sparkles } from "lucide-react"
import PartyManager from "@/components/PartyManager"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"
import { Mascot } from "@/components/Mascot"
import { XpBar } from "@/components/XpBar"
import { StreakFlame } from "@/components/StreakFlame"
import { Avatar } from "@/components/Avatar"
import { OpenPartiesBoard } from "@/components/OpenPartiesBoard"
import { FlairPicker, type Flair } from "@/components/FlairPicker"

type LeaderboardEntry = LeaderboardRow

export default function Dashboard() {
  const router = useRouter()
  const supabaseClient = getSupabaseBrowserClient()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loadingLine] = useState(randomLoading())
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [myBadges, setMyBadges] = useState<string[]>([])
  const [stats, setStats] = useState({ wins: 0, gamesPlayed: 0, xp: 0, streak: 0 })
  const [flair, setFlair] = useState<Flair>({ emoji: null, color: null, badge: null })
  const [displayName, setDisplayName] = useState("Player")
  const [showFlair, setShowFlair] = useState(false)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      setSession(session)
      if (!session) {
        router.push('/auth/sign-in')
      } else {
        setLoading(false)
        cleanupStaleParties(supabaseClient, session.user.id)
        fetchLeaderboardData()
        fetchUserAchievements(supabaseClient, session.user.id).then(setMyBadges)
        fetchUserStats(supabaseClient, session.user.id).then(setStats)
        // Player flair + name
        supabaseClient
          .from("profiles")
          .select("username, display_name, avatar_emoji, avatar_color, equipped_badge")
          .eq("id", session.user.id)
          .single()
          .then(({ data }: any) => {
            if (data) {
              setDisplayName(data.display_name || data.username || "Player")
              setFlair({ emoji: data.avatar_emoji, color: data.avatar_color, badge: data.equipped_badge })
            }
          })
      }
    }
    getSession()
  }, [router, supabaseClient])

  // Real leaderboard, sourced from the game_stats table (populated as games
  // are played). Returns an empty list until anyone has finished a game.
  const fetchLeaderboardData = async () => {
    const rows = await fetchLeaderboard(supabaseClient, 10)
    setLeaderboardData(rows)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Mascot mood="think" size={120} className="mb-4" />
        <motion.p
          className="text-white text-xl font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          {loadingLine}
        </motion.p>
        <motion.div
          className="mt-6 w-24 h-1 bg-white/20 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.6, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
          />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="inline-block"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <h1 className="font-display text-5xl font-bold mb-4 inline-block">
              <span className="text-white">Your Game </span>
              <span className="text-gradient">Dashboard</span>
            </h1>
          </motion.div>
          
          <motion.p 
            className="text-white/90 text-lg mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Manage your gaming parties and start playing with friends
          </motion.p>
          
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="brand"
                size="lg"
                onClick={() => router.push('/dashboard/create-party')}
                className="gap-2"
              >
                <Plus className="h-5 w-5" />
                Create New Party
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Player card — level, streak, flair */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="glass shadow-soft mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        >
          <button onClick={() => setShowFlair(true)} className="group relative shrink-0 self-start sm:self-auto" title="Customize your flair">
            <Avatar name={displayName} emoji={flair.emoji} color={flair.color} size={64} />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900 ring-1 ring-white/20 text-white/80 group-hover:text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <p className="truncate text-lg font-black text-white">{displayName}</p>
              {flair.badge && ACHIEVEMENTS.find((a) => a.id === flair.badge) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white">
                  {ACHIEVEMENTS.find((a) => a.id === flair.badge)!.emoji}
                  {ACHIEVEMENTS.find((a) => a.id === flair.badge)!.name}
                </span>
              )}
            </div>
            <XpBar xp={stats.xp} />
          </div>
          <div className="flex items-center gap-5 sm:flex-col sm:items-end sm:gap-2">
            <StreakFlame streak={stats.streak} />
            <Button variant="outline" size="sm" onClick={() => setShowFlair(true)} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-aqua-400" /> Customize
            </Button>
          </div>
        </motion.div>

        {/* Main content area with Party Manager and Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Party Manager - Takes up 2/3 of the space */}
          <motion.div
            className="md:col-span-2 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <PartyManager />
            {session?.user?.id && <OpenPartiesBoard client={supabaseClient} userId={session.user.id} />}
          </motion.div>
          
          {/* Leaderboard - Takes up 1/3 of the space */}
          <motion.div
            className="md:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                  Leaderboard
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white hover:bg-white/10"
                  onClick={fetchLeaderboardData}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {leaderboardData.map((player, index) => (
                  <div 
                    key={player.id}
                    className="flex items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex-shrink-0 w-8 text-center font-bold text-lg">
                      {index === 0 ? (
                        <Trophy className="h-6 w-6 text-yellow-400 mx-auto" />
                      ) : index === 1 ? (
                        <Medal className="h-6 w-6 text-gray-300 mx-auto" />
                      ) : index === 2 ? (
                        <Award className="h-6 w-6 text-amber-700 mx-auto" />
                      ) : (
                        <span className="text-white/70">{index + 1}</span>
                      )}
                    </div>
                    
                    <div className="ml-4 flex-1 min-w-0">
                      <div className="flex items-center">
                        <Avatar name={player.username} emoji={player.avatar_emoji} color={player.avatar_color} size={40} className="mr-3 shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{player.display_name || player.username}</p>
                          <p className="text-xs text-white/60">
                            Lv {levelFromXp(player.xp)}{player.favorite_game ? ` · ${player.favorite_game}` : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="font-bold text-white">{player.wins} wins</p>
                      <p className="text-xs text-white/60">{player.games_played} games</p>
                    </div>
                  </div>
                ))}
                
                {leaderboardData.length === 0 && (
                  <div className="p-8 text-center text-white/60">
                    <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No leaderboard data available yet</p>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-white/10">
                <Button 
                  variant="outline" 
                  className="w-full text-white border-white/20 hover:bg-white/10"
                  onClick={() => router.push('/games')}
                >
                  Play More Games
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Badges */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Card className="bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-grape-300" />
                Your Badges
              </h2>
              <span className="text-sm text-white/60">{myBadges.filter(isKnownAchievement).length} / {ACHIEVEMENTS.length}</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {ACHIEVEMENTS.map((a) => {
                const earned = myBadges.includes(a.id)
                return (
                  <div
                    key={a.id}
                    title={a.description}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      earned
                        ? "border-grape-400/30 bg-grape-500/10"
                        : "border-white/5 bg-white/[0.02] opacity-50"
                    }`}
                  >
                    <span className={`text-2xl ${earned ? "" : "grayscale"}`}>{a.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm truncate">{a.name}</p>
                      <p className="text-xs text-white/50 truncate">{earned ? a.description : "Locked"}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </motion.div>
      </div>

      {showFlair && session?.user?.id && (
        <FlairPicker
          client={supabaseClient}
          userId={session.user.id}
          name={displayName}
          initial={flair}
          earnedBadges={myBadges}
          onClose={() => setShowFlair(false)}
          onSaved={setFlair}
        />
      )}
    </div>
  )
}
