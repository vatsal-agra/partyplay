"use client"

import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { cleanupStaleParties } from "@/lib/partyActivity"
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/gameStats"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Plus, RefreshCw, Trophy, Medal, Award } from "lucide-react"
import PartyManager from "@/components/PartyManager"
import { motion } from "framer-motion"
import { Card } from "@/components/ui/card"

type LeaderboardEntry = LeaderboardRow

export default function Dashboard() {
  const router = useRouter()
  const supabaseClient = getSupabaseBrowserClient()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabaseClient.auth.getSession()
      setSession(session)
      if (!session) {
        router.push('/auth/sign-in')
      } else {
        setLoading(false)
        // Sweep away any of the user's parties that have gone idle.
        cleanupStaleParties(supabaseClient, session.user.id)
        // Fetch leaderboard data
        fetchLeaderboardData()
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
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.2, 0.5, 0.8, 1],
            repeat: Infinity,
            repeatType: "loop"
          }}
          className="text-6xl mb-6"
        >
          🎮
        </motion.div>
        <motion.p 
          className="text-white text-xl font-medium"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Loading your gaming dashboard...
        </motion.p>
        <motion.div 
          className="mt-6 w-24 h-1 bg-white/20 rounded-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-400 to-pink-400"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{
              duration: 2,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut'
            }}
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

        {/* Main content area with Party Manager and Leaderboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Party Manager - Takes up 2/3 of the space */}
          <motion.div
            className="md:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <PartyManager />
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
                    
                    <div className="ml-4 flex-1">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-bold mr-3">
                          {player.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{player.display_name || player.username}</p>
                          {player.favorite_game && (
                            <p className="text-xs text-white/60">
                              Last played: {player.favorite_game}
                            </p>
                          )}
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
      </div>
    </div>
  )
}
