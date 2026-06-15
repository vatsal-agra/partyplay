"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { touchParty } from "@/lib/partyActivity"
import { getGameRules } from "@/lib/game-rules"
import { recordGameResult, fetchUserStats } from "@/lib/gameStats"
import { getGameSummary } from "@/lib/gameSummary"
import { evaluateAchievements, recordAchievements } from "@/lib/achievements"
import { GameOverScreen } from "@/components/GameOverScreen"
import { VoiceChat } from "@/components/VoiceChat"
import { playSfx, eventForLogLine, isSfxMuted, toggleSfxMuted, onSfxMutedChange } from "@/lib/sfx"
import { toast } from "sonner"
import { Eye, Volume2, VolumeX } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Gamepad2, Users, MessageSquare, BookOpen } from "lucide-react"
import MonopolyBoard from "../monopoly/components/MonopolyBoard"
import { initializeGame } from "../monopoly/lib/monopolyEngine"
import CatanBoard from "../catan/components/CatanBoard"
import { initializeGame as initializeCatan } from "../catan/lib/catanEngine"
import MysteryBoard from "../cluedo/components/MysteryBoard"
import { initializeGame as initializeMystery } from "../cluedo/lib/mysteryEngine"
import BattleshipBoard from "../battleship/components/BattleshipBoard"
import { initializeGame as initializeBattleship } from "../battleship/lib/battleshipEngine"
import PictionaryBoard, { LiveEvent } from "../pictionary/components/PictionaryBoard"
import { initializeGame as initializePictionary } from "../pictionary/lib/pictionaryEngine"
import UnoBoard from "../uno/components/UnoBoard"
import { initializeGame as initializeUno } from "../uno/lib/unoEngine"
import PokerBoard from "../poker/components/PokerBoard"
import { initializeGame as initializePoker } from "../poker/lib/pokerEngine"
import SpymasterBoard from "../codenames/components/SpymasterBoard"
import { initializeGame as initializeSpymaster } from "../codenames/lib/spymasterEngine"
import DoodleDashBoard from "../scribbleio/components/DoodleDashBoard"
import { initializeGame as initializeDoodle } from "../scribbleio/lib/doodleEngine"


// Define types
interface GameData {
  id: string
  name: string
  description: string
  image: string
  minPlayers: number
  maxPlayers: number
  complexity: string
  duration: string
}

interface PartyMember {
  id: string
  user_id: string
  joined_at: string
  is_host?: boolean
  is_muted?: boolean
  profile?: {
    username: string
    display_name?: string
    avatar_url?: string
  }
}

interface ChatMessage {
  id: string
  user_id: string
  content: string
  created_at: string
  username?: string
  display_name?: string
}

// Games that support AI bots, with their bot name pools. Multiplayer-only
// games (pictionary, codenames, scribbleio) are intentionally absent.
const BOT_SUPPORT: Record<string, string[]> = {
  monopoly:   ['Mr. Mogul', 'Tycoon Bot', 'Richie Rich', 'Goldman AI', 'Capitalist'],
  catan:      ['Settler Bot', 'Golden Bot', 'Frontier AI', 'Harbor Bot', 'Trader Bot'],
  cluedo:     ['Inspector Vox', 'Detective Cyan', 'Sleuth Sigma', 'Agent Onyx', 'Constable Vale'],
  battleship: ['Admiral Bot', 'Captain AI', 'Commodore', 'Cmdr. Salvo', 'First Mate'],
  uno:        ['Card Shark', 'Wild Bot', 'Skip Bot', 'Reverso', 'Draw Two'],
  poker:      ['Ace Bot', 'Bluff Bot', 'Chip Bot', 'River Bot', 'All-in Al'],
}

export default function GamePlayPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => getSupabaseBrowserClient(), [])
  
  const [loading, setLoading] = useState(true)
  const [gameData, setGameData] = useState<GameData | null>(null)
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  const urlPartyId = searchParams.get('partyId')
  const [partyId, setPartyId] = useState<string | null>(urlPartyId)
  
  const [monopolyState, setMonopolyStateState] = useState<any>(null)
  const monopolyStateRef = useRef<any>(null)
  
  const setMonopolyState = (state: any) => {
    setMonopolyStateState(state)
    monopolyStateRef.current = state
  }

  const [isPlaying, setIsPlaying] = useState(false)
  const [liveEvent, setLiveEvent] = useState<LiveEvent | null>(null)
  const [lobbyBots, setLobbyBots] = useState<{ id: string; name: string }[]>([])
  const [showRules, setShowRules] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  
  const partyMembersRef = useRef(partyMembers)
  const activeChannelRef = useRef<any>(null)
  // Guards against recording the same finished game more than once.
  const recordedResultRef = useRef(false)
  const persistTimerRef = useRef<any>(null)

  // Badges earned in the just-finished game (shown on the game-over screen).
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  // Lets the player dismiss the game-over overlay to peek at the final board.
  const [gameOverDismissed, setGameOverDismissed] = useState(false)
  const inRealParty = !!partyId && partyId !== "mock-party-id"

  const isHost = useMemo(
    () => partyMembers.some((m) => m.user_id === currentUserId && m.is_host),
    [partyMembers, currentUserId]
  )

  // Normalized end-of-game view of whatever engine is running.
  const summary = useMemo(
    () => getGameSummary(gameData?.id || "", monopolyState, currentUserId || undefined),
    [gameData?.id, monopolyState, currentUserId]
  )

  // A late-joiner who isn't one of the seated players watches instead of plays.
  const isSpectator = useMemo(() => {
    if (!isPlaying || !monopolyState?.players || !currentUserId) return false
    return !monopolyState.players.some((p: any) => p.id === currentUserId)
  }, [isPlaying, monopolyState, currentUserId])

  // ---- Sound effects + floating event animations ---------------------------
  const [sfxMuted, setSfxMutedState] = useState(false)
  const [eventFx, setEventFx] = useState<{ id: number; emoji: string; x: number }[]>([])
  const prevLogLenRef = useRef<number | null>(null)
  const fxIdRef = useRef(0)
  const gameOverSfxRef = useRef(false)

  useEffect(() => {
    setSfxMutedState(isSfxMuted())
    return onSfxMutedChange(setSfxMutedState)
  }, [])

  // Watch the engine log: each newly-appended line carries a leading emoji that
  // identifies the event (🎲 dice, 💰 cash, ✅ correct, 💥 hit, 🏆 win …). Play
  // its mapped sound and pop the emoji on screen. Big jumps (a full state sync)
  // are skipped so reconnecting doesn't replay the whole history at once.
  useEffect(() => {
    const log: string[] = monopolyState?.log
    if (!Array.isArray(log)) return
    const prev = prevLogLenRef.current
    prevLogLenRef.current = log.length
    if (prev === null || log.length <= prev || log.length - prev > 4) return

    log.slice(prev).slice(-2).forEach((line, i) => {
      const ev = eventForLogLine(line)
      if (!ev) return
      setTimeout(() => {
        playSfx(ev.sound)
        const id = ++fxIdRef.current
        const x = Math.round((Math.random() - 0.5) * 120)
        setEventFx((q) => [...q, { id, emoji: ev.emoji, x }])
        setTimeout(() => setEventFx((q) => q.filter((f) => f.id !== id)), 1400)
      }, i * 140)
    })
  }, [monopolyState])

  // Victory / defeat stinger when the game ends (re-arms on rematch).
  useEffect(() => {
    if (!summary.isOver) { gameOverSfxRef.current = false; return }
    if (gameOverSfxRef.current) return
    gameOverSfxRef.current = true
    playSfx(summary.youWon ? "win" : "lose")
  }, [summary])

  useEffect(() => {
    partyMembersRef.current = partyMembers
  }, [partyMembers])

  
  // Hardcoded mock games data
  const mockGames = {
    monopoly: {
      id: 'monopoly',
      name: 'Property Empire',
      description: 'Classic real estate trading game',
      image: '/images/games/property-empire.png',
      minPlayers: 2,
      maxPlayers: 6,
      duration: '60-180 min',
      complexity: 'Medium'
    },
    battleship: {
      id: 'battleship',
      name: 'Naval Clash',
      description: 'Naval combat game',
      image: '/images/games/naval-clash.jpg',
      minPlayers: 2,
      maxPlayers: 2,
      duration: '15-30 min',
      complexity: 'Easy'
    },
    catan: {
      id: 'catan',
      name: 'Hexland',
      description: 'Build and trade to settle the island',
      image: '/images/games/hexland.jpg',
      minPlayers: 3,
      maxPlayers: 4,
      duration: '60-120 min',
      complexity: 'Medium'
    },
    uno: {
      id: 'uno',
      name: 'Color Clash',
      description: 'Classic card game of matching colors and numbers',
      image: '/images/games/color-clash.png',
      minPlayers: 2,
      maxPlayers: 10,
      duration: '15-30 min',
      complexity: 'Easy'
    },
    poker: {
      id: 'poker',
      name: 'Poker',
      description: 'Popular card game of skill and chance',
      image: '/images/poker thumbnail.png',
      minPlayers: 2,
      maxPlayers: 10,
      duration: '30-60 min',
      complexity: 'Medium'
    },
    cluedo: {
      id: 'cluedo',
      name: 'Mystery Manor',
      description: 'Solve the mystery of who committed the murder',
      image: '/images/games/mystery-manor.png',
      minPlayers: 3,
      maxPlayers: 6,
      duration: '45-60 min',
      complexity: 'Easy'
    },
    pictionary: {
      id: 'pictionary',
      name: 'Quick Draw',
      description: 'Draw and guess words against the clock',
      image: '/images/games/quick-draw.png',
      minPlayers: 4,
      maxPlayers: 8,
      duration: '30-60 min',
      complexity: 'Easy'
    },
    scribbleio: {
      id: 'scribbleio',
      name: 'Doodle Dash',
      description: 'Online drawing and guessing game',
      image: '/images/games/doodle-dash.png',
      minPlayers: 2,
      maxPlayers: 16,
      duration: '15-30 min',
      complexity: 'Easy'
    },
    codenames: {
      id: 'codenames',
      name: 'Spymaster',
      description: 'Give one-word clues to help your team guess the right words',
      image: '/images/games/spymaster.png',
      minPlayers: 4,
      maxPlayers: 8,
      duration: '15-30 min',
      complexity: 'Easy'
    }
  }


  const refreshPartyDetails = useCallback(async (pId: string, currentUid: string) => {
    if (!pId || pId === "mock-party-id") return

    try {
      // Fetch party data
      const { data: partyData, error: partyError } = await supabase
        .from('parties')
        .select('*')
        .eq('id', pId)
        .single()

      if (partyError) throw partyError

      // Fetch party members
      const { data: membersData, error: membersError } = await supabase
        .from('party_members')
        .select('*')
        .eq('party_id', pId)

      if (membersError) throw membersError

      // Fetch profiles for the members
      const userIds = membersData?.map(m => m.user_id) || []
      if (partyData && !userIds.includes(partyData.created_by)) {
        userIds.push(partyData.created_by)
      }

      const profilesMap: Record<string, any> = {}
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)

        if (!profilesError && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = {
              username: p.username || `User ${p.id.slice(0, 6)}`,
              display_name: p.display_name,
              avatar_url: p.avatar_url
            }
          })
        }
      }

      // Map to PartyMember interface
      const mappedMembers = (membersData || []).map(m => ({
        id: m.id,
        user_id: m.user_id,
        joined_at: m.joined_at,
        is_host: m.user_id === partyData.created_by || m.role === 'leader',
        is_muted: m.is_muted,
        profile: profilesMap[m.user_id] || { username: `User ${m.user_id.slice(0, 6)}` }
      }))

      // Prepend host if not in list
      const hostInMembers = mappedMembers.some(m => m.user_id === partyData.created_by)
      if (!hostInMembers && partyData.created_by) {
        mappedMembers.unshift({
          id: 'host-member',
          user_id: partyData.created_by,
          joined_at: partyData.created_at,
          is_host: true,
          is_muted: false,
          profile: profilesMap[partyData.created_by] || { username: 'Host' }
        })
      }

      setPartyMembers(mappedMembers)

      // Fetch messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('party_id', pId)
        .order('created_at', { ascending: true })

      if (!messagesError && messagesData) {
        const mappedMessages = messagesData.map(msg => {
          const profile = profilesMap[msg.user_id] || {}
          return {
            id: msg.id,
            user_id: msg.user_id,
            content: msg.content,
            created_at: msg.created_at,
            username: profile.username || 'User',
            display_name: profile.display_name || profile.username || 'User'
          }
        })
        setChatMessages(mappedMessages)
      }
    } catch (err) {
      console.error('Error refreshing party details in game page:', err)
    }
  }, [supabase])

  // Fetch game data, party members, and chat messages
  useEffect(() => {
    const fetchGameData = async () => {
      setLoading(true)
      
      try {
        // Get current user session – fall back to a local mock user if Supabase is offline
        const { data: { session } } = await supabase.auth.getSession()
        const mockUser = {
          id: 'local-player-' + (typeof window !== 'undefined' ? (localStorage.getItem('guestId') || (() => { const id = Math.random().toString(36).slice(2, 10); localStorage.setItem('guestId', id); return id; })()) : 'guest'),
          user_metadata: { username: 'You' }
        }
        const activeUser = session?.user ?? mockUser
        
        setCurrentUserId(activeUser.id)
        
        // Find game data from slug
        const gameSlug = params.slug as string
        
        console.log('Looking for game with ID:', gameSlug)
        
        // Find game in mock data
        const game = mockGames[gameSlug as keyof typeof mockGames]
        
        if (!game) {
          console.error('Game not found in mock data:', gameSlug)
          router.push('/games')
          return
        }
        
        console.log('Found game:', game)
        
        // Set the game data from mock data
        setGameData({
          id: game.id,
          name: game.name,
          description: game.description,
          image: game.image,
          minPlayers: game.minPlayers,
          maxPlayers: game.maxPlayers,
          complexity: game.complexity,
          duration: game.duration
        })
        
        if (partyId && partyId !== "mock-party-id") {
          await refreshPartyDetails(partyId, activeUser.id)
        } else {
          // Mock party data for now (when no partyId query param is provided)
          setPartyId("mock-party-id")
          
          // Solo play: just you. Bots are added explicitly via the lobby button.
          setPartyMembers([
            {
              id: "member-1",
              user_id: activeUser.id,
              joined_at: new Date().toISOString(),
              is_host: true,
              profile: {
                username: activeUser.user_metadata?.username || "You",
                display_name: activeUser.user_metadata?.username || "You"
              }
            }
          ])
          setChatMessages([])
        }
      } catch (error) {
        console.error("Error fetching game data:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchGameData()
  }, [params.slug, router, supabase, partyId, refreshPartyDetails])

  // Listen for real-time game broadcasts & db changes
  useEffect(() => {
    if (!partyId || !currentUserId) return

    const channel = supabase.channel(`game-${partyId}`)
    activeChannelRef.current = channel
    
    channel
      .on('broadcast', { event: 'sync_state' }, ({ payload }) => {
        console.log('Received broadcast state update:', payload)
        setMonopolyState(payload)
        setIsPlaying(true)
      })
      .on('broadcast', { event: 'game_start' }, ({ payload }) => {
        console.log('Received game start broadcast:', payload)
        setMonopolyState(payload)
        setIsPlaying(true)
      })
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        setLiveEvent({ type: 'draw', payload, t: Date.now() })
      })
      .on('broadcast', { event: 'clear' }, () => {
        setLiveEvent({ type: 'clear', t: Date.now() })
      })
      .on('broadcast', { event: 'request_sync' }, () => {
        console.log('Received request_sync from player. monopolyStateRef.current:', monopolyStateRef.current)
        const currentMembers = partyMembersRef.current
        const isHost = currentMembers.some(m => m.user_id === currentUserId && m.is_host)
        if (isHost && monopolyStateRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'sync_state',
            payload: monopolyStateRef.current
          })
        }
      })
      .subscribe()

    // Database changes channel
    const dbChannel = supabase.channel(`game-db-${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_members',
        filter: `party_id=eq.${partyId}`
      }, () => {
        refreshPartyDetails(partyId, currentUserId)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `party_id=eq.${partyId}`
      }, () => {
        refreshPartyDetails(partyId, currentUserId)
      })
      .subscribe()

    // Reconnect: a guest entering (or refreshing into) the page asks the host
    // to re-send state. Retries a few times in case the host isn't ready yet,
    // then falls back to the state the host persisted to the DB — so a refresh
    // or dropped connection rejoins the same game instead of breaking it.
    let attempts = 0
    const timers: any[] = []
    const askForSync = () => {
      const currentMembers = partyMembersRef.current
      const amHost = currentMembers.some(m => m.user_id === currentUserId && m.is_host)
      if (amHost || monopolyStateRef.current) return   // host has the truth, or we already synced
      channel.send({ type: 'broadcast', event: 'request_sync', payload: {} })
      if (++attempts < 4) timers.push(setTimeout(askForSync, 2000))
      else if (partyId !== 'mock-party-id') {
        // Last resort — restore from the host's persisted snapshot.
        supabase.from('parties').select('game_state').eq('id', partyId).single()
          .then(({ data }: any) => {
            if (data?.game_state && !monopolyStateRef.current) {
              setMonopolyState(data.game_state)
              setIsPlaying(true)
            }
          })
      }
    }
    timers.push(setTimeout(askForSync, 1500))

    return () => {
      activeChannelRef.current = null
      supabase.removeChannel(channel)
      supabase.removeChannel(dbChannel)
      timers.forEach(clearTimeout)
    }
  }, [partyId, currentUserId, supabase, refreshPartyDetails])

  // When the current game reaches a terminal state, record the result + award
  // badges for the signed-in player. Driven by the normalized summary so it
  // works across every engine (incl. poker's last-one-standing and codenames'
  // team win). Spectators, bots and guests are skipped; each human client
  // records its own row exactly once per game.
  useEffect(() => {
    if (!summary.isOver || recordedResultRef.current) return
    if (!currentUserId || currentUserId.startsWith("local-player-") || isSpectator) return
    recordedResultRef.current = true

    const gameId = gameData?.id || (params.slug as string)
    const gameName = gameData?.name || gameId

    ;(async () => {
      // Record the result first so the milestone badges see up-to-date totals.
      await recordGameResult(supabase, { won: summary.youWon, gameName })
      const stats = await fetchUserStats(supabase, currentUserId)
      const earned = evaluateAchievements({ gameId, state: monopolyState, summary, currentUserId, stats })
      const newly = await recordAchievements(supabase, earned)
      if (newly.length) {
        setNewAchievements(newly)
        toast.success(`🏅 ${newly.length} badge${newly.length > 1 ? "s" : ""} unlocked!`)
      }
    })()
  }, [summary, currentUserId, isSpectator, supabase, gameData, monopolyState, params.slug])

  // Reconnect — host persists the latest state to the DB (debounced) so anyone
  // who refreshes or drops can restore the game even if the host has left.
  useEffect(() => {
    if (!isHost || !isPlaying || !monopolyState || !partyId || partyId === "mock-party-id") return
    clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      // Persist the snapshot AND mark the party active — active play must keep
      // the party alive so the idle-cleanup sweep never reaps it mid-session.
      supabase
        .from("parties")
        .update({ game_state: monopolyState, last_active_at: new Date().toISOString() })
        .eq("id", partyId)
        .then(({ error }: any) => { if (error) console.warn("persist game_state failed:", error.message) })
    }, 1200)
    return () => clearTimeout(persistTimerRef.current)
  }, [isHost, isPlaying, monopolyState, partyId, supabase])

  
  // Handle starting a new game
  const handleStartGame = async () => {
    if (!gameData || !currentUserId) return

    // Build the player list: real party members + any AI bots added in the lobby.
    const initializers: Record<string, (players: { id: string; name: string; isBot: boolean }[]) => any> = {
      monopoly: initializeGame,
      catan: initializeCatan,
      cluedo: initializeMystery,
      battleship: initializeBattleship,
      pictionary: initializePictionary,
      uno: initializeUno,
      poker: initializePoker,
      codenames: initializeSpymaster,
      scribbleio: initializeDoodle,
    }

    const init = initializers[gameData.id]
    if (init) {
      const humans = partyMembers.map(m => ({
        id: m.user_id,
        name: m.profile?.display_name || m.profile?.username || "You",
        isBot: false,
      }))
      const bots = lobbyBots.map(b => ({ id: b.id, name: b.name, isBot: true }))
      const initialState = init([...humans, ...bots])
      recordedResultRef.current = false   // fresh game — allow a new result to record
      setNewAchievements([])
      setGameOverDismissed(false)
      touchParty(supabase, partyId)       // starting a game counts as activity
      setMonopolyState(initialState)
      setIsPlaying(true)

      if (partyId && activeChannelRef.current) {
        activeChannelRef.current.send({ type: 'broadcast', event: 'game_start', payload: initialState })
      }
      return
    }

  }

  // Handle sending a chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!messageInput.trim() || !currentUserId || !partyId) return
    
    setSendingMessage(true)
    
    try {
      if (partyId && partyId !== "mock-party-id") {
        const { error } = await supabase
          .from('messages')
          .insert([
            {
              party_id: partyId,
              user_id: currentUserId,
              content: messageInput,
              created_at: new Date().toISOString()
            }
          ])
        if (error) throw error
        touchParty(supabase, partyId)
      } else {
        // In a mock implementation, save locally
        const newMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          user_id: currentUserId,
          content: messageInput,
          created_at: new Date().toISOString(),
          username: partyMembers.find(m => m.user_id === currentUserId)?.profile?.username,
          display_name: partyMembers.find(m => m.user_id === currentUserId)?.profile?.display_name
        }
        setChatMessages(prev => [...prev, newMessage])
      }
      setMessageInput("")
    } catch (error) {
      console.error("Error sending message:", error)
    } finally {
      setSendingMessage(false)
    }
  }
  
  // Handle copying invite link
  const handleInviteFriends = () => {
    if (!partyId) return
    // If mock-party-id, just simulate
    if (partyId === "mock-party-id") {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      return
    }
    const inviteUrl = `${window.location.origin}${window.location.pathname}?partyId=${partyId}`
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      })
      .catch((err) => {
        console.error("Failed to copy link:", err)
      })
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-white mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Loading Game...</h2>
        </div>
      </div>
    )
  }
  
  if (!gameData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Game not found</h2>
          <Button onClick={() => router.push('/games')}>
            Back to Games
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen bg-gradient-to-br from-[#0d0a17] via-[#140e26] to-[#1c1033] p-0 m-0 overflow-hidden">
      <div className="h-full p-0 flex w-full">
        {/* Main content - Game and Sidebar */}
        <div className="flex flex-col md:flex-row h-full w-full overflow-y-auto md:overflow-hidden">
          {/* Game screen - Left side */}
          <motion.div 
            className="w-full md:w-[calc(100%-300px)] h-[72vh] md:h-full bg-black/20 backdrop-blur-md overflow-hidden shadow-xl border-r border-white/10 flex flex-col flex-shrink-0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {/* Game title */}
            <div className="p-2 bg-black/30 border-b border-white/10">
              <motion.h1 
                className="text-xl font-bold text-white"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                {gameData.name}
              </motion.h1>
            </div>
            
            <div className="flex-1 w-full relative overflow-hidden">
              {isPlaying && gameData.id === 'monopoly' && monopolyState ? (
                <MonopolyBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'catan' && monopolyState ? (
                <CatanBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'cluedo' && monopolyState ? (
                <MysteryBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'battleship' && monopolyState ? (
                <BattleshipBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'pictionary' && monopolyState ? (
                <PictionaryBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  liveEvent={liveEvent}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'uno' && monopolyState ? (
                <UnoBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'poker' && monopolyState ? (
                <PokerBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'codenames' && monopolyState ? (
                <SpymasterBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  passAndPlay={!partyId || partyId === 'mock-party-id'}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : isPlaying && gameData.id === 'scribbleio' && monopolyState ? (
                <DoodleDashBoard
                  state={monopolyState}
                  currentPlayerId={currentUserId || ''}
                  liveEvent={liveEvent}
                  onStateChange={(nextState) => {
                    setMonopolyState(nextState)
                  }}
                  onBroadcastAction={(event, payload) => {
                    if (partyId && activeChannelRef.current) {
                      activeChannelRef.current.send({
                        type: 'broadcast',
                        event: event,
                        payload: payload
                      })
                    }
                  }}
                />
              ) : (
                <>
                  <Image
                    src={gameData.image}
                    alt={gameData.name}
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center p-6 bg-slate-950/70 border border-white/10 rounded-2xl backdrop-blur-md max-w-md mx-4">
                      <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-wide bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">
                        {gameData.name}
                      </h2>
                      <p className="text-white/85 text-xs mb-5 leading-relaxed">
                        {gameData.description}
                      </p>

                      {BOT_SUPPORT[gameData.id] && (
                        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-3">
                          <p className="text-[11px] uppercase tracking-wider text-white/50 font-bold mb-2">
                            Players: {partyMembers.length + lobbyBots.length} / {gameData.maxPlayers}
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setLobbyBots(prev => prev.slice(0, -1))}
                              disabled={lobbyBots.length === 0}
                              className="text-white border-white/20 hover:bg-white/10 disabled:opacity-40"
                            >
                              − Bot
                            </Button>
                            <span className="text-white font-mono text-sm">{lobbyBots.length} bot{lobbyBots.length === 1 ? '' : 's'}</span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setLobbyBots(prev => {
                                const pool = BOT_SUPPORT[gameData.id] || []
                                return [...prev, { id: `bot-${prev.length + 1}`, name: pool[prev.length] || `Bot ${prev.length + 1}` }]
                              })}
                              disabled={partyMembers.length + lobbyBots.length >= gameData.maxPlayers}
                              className="text-white border-white/20 hover:bg-white/10 disabled:opacity-40"
                            >
                              + Add AI Bot
                            </Button>
                          </div>
                        </div>
                      )}

                      <Button
                        onClick={handleStartGame}
                        disabled={!!BOT_SUPPORT[gameData.id] && (partyMembers.length + lobbyBots.length) < gameData.minPlayers}
                        className="bg-brand hover:brightness-110 font-bold px-8 py-5 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Start Game Lobby
                      </Button>
                      {!!BOT_SUPPORT[gameData.id] && (partyMembers.length + lobbyBots.length) < gameData.minPlayers && (
                        <p className="text-[11px] text-amber-300 mt-2">
                          Add {gameData.minPlayers - (partyMembers.length + lobbyBots.length)} more {gameData.minPlayers - (partyMembers.length + lobbyBots.length) === 1 ? 'player/bot' : 'players/bots'} to start.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Floating event emojis — popped in sync with the sound effects */}
              <div className="pointer-events-none absolute inset-x-0 top-12 z-30 flex justify-center">
                <AnimatePresence>
                  {eventFx.map((f) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 24, scale: 0.4 }}
                      animate={{ opacity: 1, y: -34, scale: 1.35 }}
                      exit={{ opacity: 0, y: -70, scale: 0.8 }}
                      transition={{ duration: 1.3, ease: "easeOut" }}
                      style={{ x: f.x }}
                      className="absolute text-4xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                    >
                      {f.emoji}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Spectator banner — late joiners watch until the next game */}
              {isSpectator && !summary.isOver && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-sm text-white shadow-lg backdrop-blur">
                  <Eye className="h-4 w-4 text-aqua-400" />
                  Spectating — you&apos;ll join the next game
                </div>
              )}

              {/* Reopen the recap after peeking at the final board */}
              {isPlaying && summary.isOver && gameOverDismissed && (
                <button
                  onClick={() => setGameOverDismissed(false)}
                  className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-lg hover:brightness-110"
                >
                  🏆 Show results
                </button>
              )}
            </div>

            {/* Game controls would go here */}
            <div className="p-3 sm:p-4 bg-black/30 border-t border-white/5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <div>
                  <p className="text-white/70 text-xs sm:text-sm">
                    Players: {gameData.minPlayers}-{gameData.maxPlayers} •
                    Complexity: {gameData.complexity} •
                    Duration: {gameData.duration}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  <Button
                    onClick={() => toggleSfxMuted()}
                    variant="outline"
                    title={sfxMuted ? "Unmute sound effects" : "Mute sound effects"}
                    className="text-white border-white/20 hover:bg-white/10 px-2.5"
                  >
                    {sfxMuted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-aqua-400" />}
                  </Button>
                  <Button
                    onClick={() => setShowRules(true)}
                    variant="outline"
                    className="text-white border-white/20 hover:bg-white/10 flex items-center gap-1.5"
                  >
                    <BookOpen className="w-4 h-4 text-pink-400" />
                    Game Rules
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
          
          {/* Sidebar - Right side */}
          <motion.div 
            className="w-full md:w-[300px] h-[55vh] md:h-full bg-black/20 backdrop-blur-md overflow-hidden shadow-xl border-l border-white/10 flex flex-col flex-shrink-0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Tabs defaultValue="party" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="party" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Party</span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span>Chat</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Party Members Tab */}
              <TabsContent value="party" className="p-0">
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-bold text-white">Party Members</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto p-2">
                  {partyMembers.map((member) => (
                    <div 
                      key={member.id}
                      className={`flex items-center p-3 mb-2 rounded-lg ${
                        member.is_host ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10'
                      }`}
                    >
                      <div className="h-8 w-8 rounded-full bg-brand flex items-center justify-center text-white font-bold mr-3">
                        {member.profile?.username?.[0].toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-medium text-white flex items-center">
                          {member.profile?.display_name || member.profile?.username || 'Unknown User'}
                          {member.is_host && (
                            <span className="ml-2 text-xs bg-green-500/30 text-green-300 px-1.5 py-0.5 rounded-full flex items-center">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                              Host
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-white/10">
                  <Button 
                    onClick={handleInviteFriends}
                    className="w-full bg-brand hover:brightness-110"
                  >
                    {copiedLink ? "Link Copied!" : "Invite Friends"}
                  </Button>
                </div>
              </TabsContent>
              
              {/* Chat Tab */}
              <TabsContent value="chat" className="p-0 flex flex-col flex-1 overflow-hidden">
                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {chatMessages.map((message) => (
                    <div 
                      key={message.id}
                      className={`flex ${message.user_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.user_id === currentUserId 
                            ? 'bg-grape-500/30 text-white'
                            : 'bg-white/10 text-white'
                        }`}
                      >
                        {message.user_id !== currentUserId && (
                          <p className="text-xs font-medium mb-1 text-cyan-300">
                            {message.display_name || message.username}
                          </p>
                        )}
                        <p>{message.content}</p>
                        <p className="text-xs opacity-70 mt-1 text-right">
                          {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Message input */}
                <div className="p-2 border-t border-white/10">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 h-9 bg-white/10 border-0 text-white placeholder:text-white/50 focus-visible:ring-1 focus-visible:ring-white/30 text-sm"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                    />
                    <Button 
                      type="submit" 
                      size="sm" 
                      className="h-9 px-3 bg-brand hover:brightness-110"
                      disabled={sendingMessage}
                    >
                      {sendingMessage ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </form>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
      
      {/* Game Rules Modal Overlay */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="absolute inset-0" onClick={() => setShowRules(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative z-10 w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <h3 className="text-lg font-black uppercase text-pink-400 tracking-wider mb-4 border-b border-white/10 pb-2">
                {getGameRules(gameData.id)?.title || `${gameData.name} — How to Play`}
              </h3>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed font-sans">
                {getGameRules(gameData.id)?.sections.map((section) => (
                  <div key={section.heading}>
                    <h4 className="font-bold text-white uppercase text-[10px] tracking-wider mb-1">{section.heading}</h4>
                    <p>{section.body}</p>
                  </div>
                )) || (
                  <p>{gameData.description}</p>
                )}
              </div>

              <Button
                onClick={() => setShowRules(false)}
                className="w-full mt-6 bg-brand hover:brightness-110 font-bold uppercase tracking-wider text-xs py-2 rounded-lg text-slate-950"
              >
                Close Rules
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Game-over recap — rendered at top level so its fixed overlay covers the
          full viewport (a transformed ancestor would otherwise trap it). */}
      {isPlaying && summary.isOver && !gameOverDismissed && (
        <GameOverScreen
          gameName={gameData.name}
          summary={summary}
          newAchievements={newAchievements}
          canRematch={isHost && !isSpectator}
          leaveLabel={inRealParty ? "Back to Party" : "Leave"}
          onRematch={() => { setNewAchievements([]); setGameOverDismissed(false); handleStartGame() }}
          onLeave={() => router.push(inRealParty ? `/party/${partyId}` : "/games")}
          onClose={() => setGameOverDismissed(true)}
        />
      )}

      {/* Party voice chat — real parties only (skip solo / mock games) */}
      {partyId && partyId !== "mock-party-id" && currentUserId && !currentUserId.startsWith("local-player-") && (
        <VoiceChat client={supabase} roomId={partyId} userId={currentUserId} members={partyMembers} />
      )}
    </div>
  )
}

