"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { Search, Filter, X, Gamepad2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { GameCard } from "@/components/games/GameCard"
import { Game, UserParty, PartyMember, Filters } from "@/app/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PartiesSidebar } from "@/components/PartiesSidebar"

// Define the database game type
type DbGame = {
  id: string;
  name: string;
  description: string;
  min_players: number;
  max_players: number;
  image_url: string;
  duration: string;
  complexity: 'Easy' | 'Medium' | 'Hard';
  category: string[];
  slug: string;
}


export default function GamesPage() {
  const router = useRouter()
  const supabaseClient = getSupabaseBrowserClient()
  
  // State management
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isCreatingParty, setIsCreatingParty] = useState(false)
  const [userParty, setUserParty] = useState<UserParty | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [games, setGames] = useState<Game[]>([])
  const [filters, setFilters] = useState<Filters>({
    players: "",
    complexity: "",
    duration: ""
  })

  // Filter games based on search and filters
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      // Type assertion to ensure game has the correct type
      const typedGame = game as Game;
      
      // Search query filter
      const matchesSearch = typedGame.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         typedGame.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Players filter
      const matchesPlayers = !filters.players || 
                           (typedGame.minPlayers <= parseInt(filters.players) && 
                            typedGame.maxPlayers >= parseInt(filters.players));
      
      // Complexity filter
      const matchesComplexity = !filters.complexity || 
                              typedGame.complexity === filters.complexity;
      
      // Duration filter (simplified example)
      const matchesDuration = !filters.duration || 
        (() => {
          const maxDuration = parseInt(filters.duration) * 30 // Convert to minutes
          const [minDuration] = typedGame.duration.split('-').map(s => parseInt(s.trim()))
          return minDuration <= maxDuration
        })()
      
      return matchesSearch && matchesPlayers && matchesComplexity && matchesDuration;
    });
  }, [games, searchQuery, filters]);

  // Use hardcoded mock data for games
  useEffect(() => {
    console.log('Loading mock games data...')
    
    const mockGames: Game[] = [
      {
        id: 'monopoly',
        name: 'Monopoly',
        description: 'Classic real estate trading game',
        image: '/images/monopoly thumbnail.png',
        minPlayers: 2,
        maxPlayers: 6,
        duration: '60-180 min',
        complexity: 'Medium',
        category: ['Strategy', 'Economic']
      },
      {
        id: 'battleship',
        name: 'Battleship',
        description: 'Naval combat game',
        image: '/images/Battleship thumbnail.png',
        minPlayers: 2,
        maxPlayers: 2,
        duration: '15-30 min',
        complexity: 'Easy',
        category: ['Strategy']
      },
      {
        id: 'catan',
        name: 'Catan',
        description: 'Build and trade to settle the island of Catan',
        image: '/images/catan thumbnail.png',
        minPlayers: 3,
        maxPlayers: 4,
        duration: '60-120 min',
        complexity: 'Medium',
        category: ['Strategy', 'Economic']
      },
      {
        id: 'uno',
        name: 'Uno',
        description: 'Classic card game of matching colors and numbers',
        image: '/images/uno final thumbnail.png',
        minPlayers: 2,
        maxPlayers: 10,
        duration: '15-30 min',
        complexity: 'Easy' as const,
        category: ['Card Game', 'Family']
      },
      {
        id: 'poker',
        name: 'Poker',
        description: 'Popular card game of skill and chance',
        image: '/images/poker thumbnail.png',
        minPlayers: 2,
        maxPlayers: 10,
        duration: '30-60 min',
        complexity: 'Medium',
        category: ['Card Game', 'Gambling']
      },
      {
        id: 'cluedo',
        name: 'Cluedo',
        description: 'Solve the mystery of who committed the murder',
        image: '/images/cluedo thumbnail.png',
        minPlayers: 3,
        maxPlayers: 6,
        duration: '45-60 min',
        complexity: 'Easy',
        category: ['Mystery', 'Deduction']
      },
      {
        id: 'pictionary',
        name: 'Pictionary',
        description: 'Draw and guess words against the clock',
        image: '/images/pictionary thumbnail.png',
        minPlayers: 4,
        maxPlayers: 8,
        duration: '30-60 min',
        complexity: 'Easy',
        category: ['Party', 'Drawing']
      },
      {
        id: 'scribbleio',
        name: 'Scribble.io',
        description: 'Online drawing and guessing game',
        image: '/images/scribbleio thumbnail.png',
        minPlayers: 2,
        maxPlayers: 16,
        duration: '15-30 min',
        complexity: 'Easy',
        category: ['Party', 'Drawing', 'Online']
      },
      {
        id: 'codenames',
        name: 'Codenames',
        description: 'Give one-word clues to help your team guess the right words',
        image: '/images/codenames thumbnal.png',
        minPlayers: 4,
        maxPlayers: 8,
        duration: '15-30 min',
        complexity: 'Easy',
        category: ['Party', 'Word Game']
      },
      {
        id: 'terramystica',
        name: 'Terra Mystica',
        description: 'Strategic game of terrain building and resource management',
        image: '/images/terra mystica thumbnail.png',
        minPlayers: 2,
        maxPlayers: 5,
        duration: '90-120 min',
        complexity: 'Hard',
        category: ['Strategy', 'Eurogame']
      },
      {
        id: '7wonders',
        name: '7 Wonders',
        description: 'Build an ancient civilization and lead it to greatness',
        image: '/images/7wonders thumbnail.png',
        minPlayers: 3,
        maxPlayers: 7,
        duration: '30-60 min',
        complexity: 'Medium',
        category: ['Strategy', 'Card Game']
      }
    ]
    
    console.log('Setting mock games data:', mockGames)
    setGames(mockGames)
    setLoading(false)
  }, [])

  // Get unique complexities for filter
  const complexities = useMemo(() => {
    return Array.from(new Set(games.map(game => game.complexity)))
  }, [games])

  // Handle creating a new game party
  const handleCreateParty = useCallback(async (gameId: string) => {
    if (!session) {
      router.push('/auth/sign-in?redirect=/games')
      return
    }
    
    try {
      setIsCreatingParty(true)
      
      // If user already has a party, redirect to it
      if (userParty) {
        router.push(`/party/${userParty.id}`)
        return
      }
      
      // Find the selected game
      const game = games.find(g => g.id === gameId)
      if (!game) {
        throw new Error('Game not found')
      }
      
      // Create a new party
      const { data: party, error: partyError } = await supabaseClient
        .from('parties')
        .insert([
          { 
            name: `${session.user.user_metadata.full_name || 'My'} ${game.name} Party`,
            game: game.name,
            game_id: game.id,
            game_image: game.image,
            max_players: game.maxPlayers,
            created_by: session.user.id,
            status: 'waiting'
          }
        ])
        .select()
        .single()
      
      if (partyError) throw partyError
      
      // Add the creator as the first member
      const { error: memberError } = await supabaseClient
        .from('party_members')
        .insert([
          {
            party_id: party.id,
            user_id: session.user.id,
            role: 'leader'
          }
        ])
      
      if (memberError) throw memberError
      
      // Update local state
      setUserParty(party)
      
      // Redirect to the new party
      router.push(`/party/${party.id}`)
    } catch (error) {
      console.error('Error creating party:', error)
      alert('Failed to create party. Please try again.')
    } finally {
      setIsCreatingParty(false)
    }
  }, [session, userParty, router, supabaseClient])

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      players: "",
      complexity: "",
      duration: ""
    })
    setSearchQuery("")
  }, [])

  const fetchUserParty = useCallback(async (userId: string) => {
    try {
      const { data: party, error } = await supabaseClient
        .from('parties')
        .select('*')
        .eq('created_by', userId)
        .neq('status', 'ended')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      
      setUserParty(party)
    } catch (error) {
      console.error('Error fetching user party:', error)
    } finally {
      setLoading(false)
    }
  }, [supabaseClient])

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession()
        setSession(session || null)
        
        if (session?.user?.id) {
          await fetchUserParty(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error getting session:', error)
        setLoading(false)
      }
    }

    getSession()
  }, [supabaseClient, fetchUserParty])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-500 to-pink-500 dark:from-cyan-600 dark:to-pink-600 overflow-x-hidden">
      <div className="flex h-full w-full">
        {/* Main Content */}
        <div className="flex-1 overflow-y-auto py-12 w-0 min-w-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-black/20 backdrop-blur-sm rounded-2xl p-8 shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white">Find Your Next Game</h1>
                  <p className="text-gray-200">Browse our collection of board games and start playing with friends</p>
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
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 p-4 bg-black/30 rounded-lg border border-white/10">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">Players</label>
                          <select
                            className="w-full bg-black/30 border border-white/10 rounded-md px-3 py-2 text-white text-sm"
                            value={filters.players}
                            onChange={(e) => setFilters({...filters, players: e.target.value})}
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
                            onChange={(e) => setFilters({...filters, complexity: e.target.value})}
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
                            onChange={(e) => setFilters({...filters, duration: e.target.value})}
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
                            setFilters({ players: '', complexity: '', duration: '' })
                            setSearchQuery('')
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
                    const isInParty = userParty?.game_id === game.id
                    
                    return (
                      <GameCard
                        key={game.id}
                        game={game}
                        onPlay={() => {
                          // Use the game's ID for navigation
                          router.push(`/games/${game.id}`)
                        }}
                        isInParty={isInParty}
                        isCreatingParty={isCreatingParty}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Parties Sidebar */}
        <div className="hidden lg:block w-80 flex-shrink-0 bg-gray-900/50 border-l border-pink-500/20 p-4 overflow-y-auto">
          <PartiesSidebar />
        </div>
      </div>
    </div>
  )
}
