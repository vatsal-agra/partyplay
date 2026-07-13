// Hexland — board container. Renders the real-time 3D island (loaded
// client-only) plus the harbor-town HUD. All game logic flows through the
// pure engine; this component wires interaction, validation and dialogs.
"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import * as catanEngine from "../lib/catanEngine"
import {
  CatanState,
  ResourceType,
  DevCardType,
  RESOURCES,
  getBoardLayout,
  getPlayerName
} from "../lib/catanEngine"
import { Confetti } from "@/components/Confetti"
import {
  Dices, ChevronRight, Landmark, ArrowRightLeft,
  UserPlus, ShieldAlert, Award, FileText,
  Hammer, Loader2, Crown, RotateCcw, Share2, Eye, LogOut
} from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const HexIsland3D = dynamic(() => import("./HexIsland3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b1c24]">
      <div className="flex flex-col items-center gap-3 text-[#d6a85c]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Charting the island…</p>
      </div>
    </div>
  ),
})

interface CatanBoardProps {
  state: CatanState
  currentPlayerId: string
  onStateChange: (newState: CatanState) => void
  onBroadcastAction?: (action: string, payload: any) => void
}

const RESOURCE_ICONS: Record<ResourceType, string> = {
  WOOD: '🌲',
  BRICK: '🧱',
  SHEEP: '🐑',
  WHEAT: '🌾',
  ORE: '⛰️'
}

// What each development card actually does — shown on the card tray so
// players never have to guess.
const DEV_CARD_INFO: Record<string, { name: string; icon: string; desc: string }> = {
  KNIGHT:         { name: 'Knight',         icon: '⚔️', desc: 'Move the robber to any hex and steal 1 random card from an opponent there. 3+ played knights compete for Largest Army (+2 VP).' },
  ROAD_BUILDING:  { name: 'Road Building',  icon: '🛣️', desc: 'Build 2 roads anywhere on your network — completely free.' },
  YEAR_OF_PLENTY: { name: 'Year of Plenty', icon: '🎁', desc: 'Take any 2 resources of your choice from the bank for free.' },
  MONOPOLY:       { name: 'Embargo',        icon: '📢', desc: 'Name one resource — every opponent hands over ALL their cards of it to you.' },
  VICTORY_POINT:  { name: 'Victory Point',  icon: '🏆', desc: 'Worth 1 VP, counted automatically toward your total. Never needs to be played.' },
}

export default function CatanBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: CatanBoardProps) {
  const [activeTab, setActiveTab]         = useState<'HUD' | 'BUILD' | 'TRADE'>('HUD')
  const [tradeTargetId, setTradeTarget]   = useState<string>("")
  const [giveRes, setGiveRes]             = useState<Record<ResourceType, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  const [reqRes, setReqRes]               = useState<Record<ResourceType, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  const [selectedBuildMode, setBuildMode] = useState<'NONE' | 'SETTLEMENT' | 'ROAD' | 'CITY'>('NONE')
  // Maritime trade picker: what I give → what I get
  const [mtGive, setMtGive] = useState<ResourceType | null>(null)
  const [mtGet, setMtGet]   = useState<ResourceType | null>(null)
  const [showStealDialog, setShowSteal]   = useState(false)
  const [isRolling, setIsRolling]         = useState(false)

  // Dev Card UI States
  const [isPlayingKnight, setIsPlayingKnight] = useState(false)
  const [roadBuildingActive, setRoadBuildingActive] = useState(false)
  const [selectedRoads, setSelectedRoads] = useState<number[]>([])
  const [showYearOfPlentyDialog, setShowYearOfPlentyDialog] = useState(false)
  const [yopSelections, setYopSelections] = useState<ResourceType[]>([])
  const [showMonopolyDialog, setShowMonopolyDialog] = useState(false)
  // Full-board victory screen: dismissible to inspect the final island.
  const [endDismissed, setEndDismissed] = useState(false)

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log])

  const layout = getBoardLayout()
  const curPlayer = state.players[state.currentPlayerIndex]
  const isMyTurn  = curPlayer.id === currentPlayerId
  // The local player's seat — NOT the same as curPlayer (whoever's turn it is).
  // Anything about "my hand" (discards, inventory) must read from here.
  const me = state.players.find(p => p.id === currentPlayerId)

  // Bot Auto Play logic
  useEffect(() => {
    if (state.winnerId || state.phase === 'GAME_OVER') return

    const isBotTurn = curPlayer.isBot
    const isBotDiscard = state.phase === 'ROBBER_DISCARD' && state.players.some(p => p.isBot && state.discardRequiredPlayers.includes(p.id))

    if (isBotTurn || isBotDiscard) {
      const delay = 1500
      const t = setTimeout(() => {
        const next = catanEngine.playBotTurn(state)
        onStateChange(next)
        onBroadcastAction?.('sync_state', next)
      }, delay)
      return () => clearTimeout(t)
    }
  }, [state.currentPlayerIndex, curPlayer.isBot, state.winnerId, state.phase, state.discardRequiredPlayers])

  // Re-arm the victory screen whenever a fresh game starts.
  useEffect(() => {
    if (!state.winnerId) setEndDismissed(false)
  }, [state.winnerId])

  const handleRematch = () => {
    const next = catanEngine.initializeGame(state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })))
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  // Trigger Steal choice if robber moved and options exist
  useEffect(() => {
    if ((state.phase === 'MAIN' || state.phase === 'ROBBER_MOVE') && state.robberStealOptions.length > 0 && isMyTurn && !curPlayer.isBot) {
      setShowSteal(true)
    } else {
      setShowSteal(false)
    }
  }, [state.robberStealOptions, state.phase, isMyTurn, curPlayer.isBot])

  const act = (name: string, ...args: any[]) => {
    const fn = (catanEngine as any)[name]
    if (fn) {
      const next = fn(state, ...args)
      onStateChange(next)
      onBroadcastAction?.('sync_state', next)
    }
  }

  const handleRollComplete = () => {
    setIsRolling(false)
    const next = catanEngine.rollDice(state)
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  const handleRollDice = () => {
    if (isRolling || state.phase !== 'ROLL' || !isMyTurn) return
    setIsRolling(true)
    onBroadcastAction?.('dice_rolling', { playerId: currentPlayerId })
    setTimeout(handleRollComplete, 1200)
  }

  // Action Building validations
  const getBuildableVertices = () => {
    if (state.phase === 'GAME_OVER') return []
    const list: number[] = []

    layout.vertices.forEach(v => {
      // 1. Must be empty
      if (state.settlements[v.id]) return
      // 2. Distance rule
      if (v.adjacentVertices.some(adj => state.settlements[adj])) return

      const isSetup = state.phase === 'SETUP_1' || state.phase === 'SETUP_2'
      if (isSetup) {
        // Can build anywhere during setup if it is our turn
        if (isMyTurn && state.phase.startsWith('SETUP')) {
          // Verify we haven't already placed a settlement on this setup turn
          const mySettlementCount = Object.values(state.settlements).filter(s => s.playerId === curPlayer.id).length
          const targetCount = state.phase === 'SETUP_1' ? 0 : 1
          if (mySettlementCount === targetCount) {
            list.push(v.id)
          }
        }
      } else if (selectedBuildMode === 'SETTLEMENT' && isMyTurn) {
        // Must touch player road
        if (v.adjacentEdges.some(eId => state.roads[eId] === curPlayer.id)) {
          list.push(v.id)
        }
      }
    })
    return list
  }

  const getBuildableEdges = () => {
    if (state.phase === 'GAME_OVER') return []
    const list: number[] = []
    const isSetup = state.phase === 'SETUP_1' || state.phase === 'SETUP_2'

    // Setup rule: the road must attach to the settlement placed THIS round —
    // the one with none of my roads next to it. Until this round's settlement
    // is down, no road edges are offered (placing a road advances the phase,
    // so offering one early would let a player skip their settlement).
    let setupFresh: number[] = []
    if (isSetup && isMyTurn) {
      const myBuilds = Object.entries(state.settlements)
        .filter(([, s]) => s.playerId === curPlayer.id)
        .map(([vId]) => parseInt(vId))
      const needed = state.phase === 'SETUP_1' ? 1 : 2
      if (myBuilds.length === needed) {
        setupFresh = myBuilds.filter(vId =>
          layout.vertices[vId].adjacentEdges.every(eId => state.roads[eId] !== curPlayer.id))
      }
    }

    layout.edges.forEach(e => {
      // Must be empty
      if (state.roads[e.id]) return
      // Cannot select same road twice during dev card building
      if (roadBuildingActive && selectedRoads.includes(e.id)) return

      if (isSetup && isMyTurn) {
        if (e.vertices.some(vId => setupFresh.includes(vId))) {
          list.push(e.id)
        }
      } else if (!isSetup && isMyTurn && (selectedBuildMode === 'ROAD' || roadBuildingActive)) {
        // Must connect to player's road or settlement
        const connectsToBuilding = e.vertices.some(vId => state.settlements[vId]?.playerId === curPlayer.id)
        const connectsToRoad = e.adjacentEdges.some(adjId =>
          state.roads[adjId] === curPlayer.id ||
          (roadBuildingActive && selectedRoads.includes(adjId))
        )
        if (connectsToBuilding || connectsToRoad) {
          list.push(e.id)
        }
      }
    })
    return list
  }

  const getUpgradeVertices = () => {
    if (state.phase !== 'MAIN' || !isMyTurn || selectedBuildMode !== 'CITY') return []
    return Object.entries(state.settlements)
      .filter(([, s]) => s.playerId === curPlayer.id && s.type === 'settlement')
      .map(([vId]) => parseInt(vId))
  }

  const getBuildableHexes = () => {
    if ((state.phase === 'ROBBER_MOVE' || isPlayingKnight) && isMyTurn) {
      return state.hexes.map((h, idx) => idx === state.robberHexIndex ? -1 : idx).filter(idx => idx !== -1)
    }
    return []
  }

  const buildableVertices  = getBuildableVertices()
  const buildableEdges     = getBuildableEdges()
  const upgradeVertices    = getUpgradeVertices()
  const buildableHexes     = getBuildableHexes()

  // ---- 3D board interaction callbacks ----------------------------------------
  const handleVertexClick = (vId: number) => {
    if (upgradeVertices.includes(vId)) {
      act('upgradeToCity', vId)
    } else if (buildableVertices.includes(vId)) {
      act('placeSettlement', vId)
    }
  }

  const handleEdgeClick = (eId: number) => {
    if (!buildableEdges.includes(eId)) return
    if (roadBuildingActive) {
      if (selectedRoads.length === 0) {
        setSelectedRoads([eId])
      } else {
        act('playRoadBuilding', selectedRoads[0], eId)
        setRoadBuildingActive(false)
        setSelectedRoads([])
      }
    } else {
      act('placeRoad', eId)
    }
  }

  const handleHexClick = (hexIndex: number) => {
    if (!buildableHexes.includes(hexIndex)) return
    if (isPlayingKnight) {
      act('playKnight', hexIndex, null)
      setIsPlayingKnight(false)
    } else {
      act('moveRobber', hexIndex)
    }
  }

  // Trade actions helpers
  const handleModifyGive = (r: ResourceType, val: number) => {
    setGiveRes(prev => ({ ...prev, [r]: Math.max(0, prev[r] + val) }))
  }

  const handleModifyReq = (r: ResourceType, val: number) => {
    setReqRes(prev => ({ ...prev, [r]: Math.max(0, prev[r] + val) }))
  }

  const triggerDomesticTrade = () => {
    if (!tradeTargetId) return
    act('proposeTrade', tradeTargetId, giveRes, reqRes)
    setGiveRes({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
    setReqRes({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
    setTradeTarget("")
    setActiveTab('HUD')
  }

  // Calculate maritime rate for player
  const getMaritimeRate = (res: ResourceType) => {
    let rate = 4
    layout.harbors.forEach(h => {
      const touchesBuilding = h.vertices.some(vId => state.settlements[vId]?.playerId === currentPlayerId)
      if (touchesBuilding) {
        if (h.resource === res) rate = Math.min(rate, 2)
        else if (h.resource === 'GENERIC') rate = Math.min(rate, 3)
      }
    })
    return rate
  }

  // Dev Card Play Helper
  const playDevCard = (type: DevCardType) => {
    if (state.phase !== 'MAIN' || !isMyTurn || state.playedDevCardThisTurn) return

    if (type === 'KNIGHT') {
      setIsPlayingKnight(true)
    } else if (type === 'ROAD_BUILDING') {
      setRoadBuildingActive(true)
      setSelectedRoads([])
    } else if (type === 'YEAR_OF_PLENTY') {
      setYopSelections([])
      setShowYearOfPlentyDialog(true)
    } else if (type === 'MONOPOLY') {
      setShowMonopolyDialog(true)
    }
  }

  // Robber Discard state helper — does the LOCAL player owe a discard?
  const iMustDiscard = state.phase === 'ROBBER_DISCARD' && state.discardRequiredPlayers.includes(currentPlayerId)
  const discardTarget = state.discardCount[currentPlayerId] || 0
  const discardSum = giveRes.WOOD + giveRes.BRICK + giveRes.SHEEP + giveRes.WHEAT + giveRes.ORE

  const submitDiscard = () => {
    if (discardSum !== discardTarget) return
    act('discardCards', currentPlayerId, giveRes)
    setGiveRes({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  }

  const handleAddBot = () => {
    if (state.players.length >= 4) return
    const names = ['Tycoon Bot', 'Richie Bot', 'Settler Bot', 'Golden Bot']
    const used = state.players.map(p => p.name)
    const name = names.find(n => !used.includes(n)) || `Bot ${state.players.length + 1}`
    const players = [...state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })),
                     { id: `bot-${Date.now()}`, name, isBot: true }]
    const next = catanEngine.initializeGame(players)
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  return (
    <div className="flex w-full h-full overflow-hidden select-none gap-2.5 p-2 text-[#e9ddc5]" style={{ background: "#140d07" }}>

      {/* COLUMN 1: 3D ISLAND */}
      <div className="relative flex-1 min-w-0 h-full overflow-hidden rounded-2xl border border-[#6b5230]/30">
        <HexIsland3D
          state={state}
          buildableVertices={buildableVertices}
          buildableEdges={buildableEdges}
          upgradeVertices={upgradeVertices}
          buildableHexes={buildableHexes}
          selectedRoads={selectedRoads}
          rolling={isRolling}
          activeColor={curPlayer.color}
          onVertexClick={handleVertexClick}
          onEdgeClick={handleEdgeClick}
          onHexClick={handleHexClick}
        />
        <Confetti fire={!!state.winnerId} />

        {/* Dev-card mode banner */}
        {(isPlayingKnight || roadBuildingActive) && (
          <div className="absolute top-3 left-3 right-3 z-20 bg-black/70 backdrop-blur border border-[#d6a85c]/30 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg">
            <span className="text-[11px] font-bold text-[#f0d9a4] flex items-center gap-2">
              {isPlayingKnight ? (
                <><span>⚔️ Knight Card Active:</span> Click any glowing hex to move the robber.</>
              ) : (
                <><span>🛣️ Road Building Active:</span> Click 2 glowing edges to place free roads. ({selectedRoads.length}/2 selected)</>
              )}
            </span>
            <button
              onClick={() => {
                setIsPlayingKnight(false)
                setRoadBuildingActive(false)
                setSelectedRoads([])
              }}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase transition"
            >
              Cancel
            </button>
          </div>
        )}

        {/* orbit hint */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/40 backdrop-blur hidden lg:block">
          drag to orbit · scroll to zoom
        </div>

        {/* My hand — always visible, pops when a count changes */}
        {me && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-2xl border border-[#6b5230]/50 bg-black/60 px-2 py-1.5 backdrop-blur shadow-lg">
            <span className="hidden sm:block pl-1 pr-0.5 text-[8px] font-black uppercase tracking-widest text-[#d6a85c]">Hand</span>
            {RESOURCES.map(r => (
              <div key={r} className={`flex items-center gap-1 rounded-lg px-1.5 py-1 ${me.resources[r] > 0 ? "bg-white/10" : "bg-white/[0.03] opacity-60"}`} title={r}>
                <span className="text-sm leading-none">{RESOURCE_ICONS[r]}</span>
                <motion.span
                  key={me.resources[r]}
                  initial={{ scale: 1.6, color: "#ffd88a" }}
                  animate={{ scale: 1, color: "#f0e6d2" }}
                  className="min-w-[10px] text-center text-[11px] font-black font-mono"
                >
                  {me.resources[r]}
                </motion.span>
              </div>
            ))}
          </div>
        )}

        {/* Dev card tray — your cards live on the table, each says what it does */}
        {me && Object.values(me.devCards).some(c => c > 0) && (
          <div className="absolute bottom-3 right-3 z-10 flex items-end gap-1.5">
            {Object.entries(me.devCards).filter(([, c]) => c > 0).map(([type, count]) => {
              const info = DEV_CARD_INFO[type]
              const playable = isMyTurn && state.phase === 'MAIN' && !state.playedDevCardThisTurn && type !== 'VICTORY_POINT'
              return (
                <button
                  key={type}
                  onClick={() => playable && playDevCard(type as DevCardType)}
                  className={`group relative w-[76px] rounded-xl border p-2 pb-1.5 text-left shadow-lg backdrop-blur transition ${
                    playable
                      ? 'border-[#d6a85c]/60 bg-gradient-to-b from-[#3a2c18]/95 to-[#241a10]/95 hover:-translate-y-1 hover:border-[#f0d9a4] cursor-pointer'
                      : 'border-white/15 bg-black/60 opacity-80 cursor-default'
                  }`}
                >
                  {/* count badge */}
                  {count > 1 && (
                    <span className="absolute -top-1.5 -right-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#d6a85c] px-1 text-[9px] font-black text-[#1a120a]">
                      ×{count}
                    </span>
                  )}
                  <span className="block text-lg leading-none">{info.icon}</span>
                  <span className="mt-1 block text-[8.5px] font-black uppercase leading-tight tracking-wide text-[#f0d9a4]" style={{ fontFamily: SERIF }}>
                    {info.name}
                  </span>
                  {playable && <span className="mt-0.5 block text-[7px] font-bold uppercase tracking-wider text-emerald-400">▶ tap to play</span>}
                  {/* what-it-does tooltip */}
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 rounded-xl border border-[#6b5230]/60 bg-black/90 p-2.5 opacity-0 shadow-2xl backdrop-blur transition-opacity duration-150 group-hover:opacity-100">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-[#e8c987]">{info.icon} {info.name}</span>
                    <span className="mt-1 block text-[9.5px] leading-snug text-white/85">{info.desc}</span>
                    {!playable && type !== 'VICTORY_POINT' && (
                      <span className="mt-1 block text-[8px] italic text-white/45">
                        {state.playedDevCardThisTurn && isMyTurn ? 'Only one dev card per turn.' : 'Playable on your turn, in the Main phase.'}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Live table feed — the last few game events, newest on top */}
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex w-[290px] max-w-[46%] flex-col gap-1">
          <AnimatePresence initial={false}>
            {state.log.slice(-4).reverse().map((msg, i) => (
              <motion.div
                key={msg + (state.log.length - i)}
                layout
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: i === 0 ? 1 : 0.55 - i * 0.1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.25 }}
                className="rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[10px] leading-snug text-white/90 backdrop-blur"
              >
                {msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Full-board victory screen — the island stays alive behind it */}
        <AnimatePresence>
          {state.winnerId && !endDismissed && (
            <HexlandEndScreen
              state={state}
              currentPlayerId={currentPlayerId}
              onRematch={handleRematch}
              onDismiss={() => setEndDismissed(true)}
            />
          )}
        </AnimatePresence>

        {/* Dismissed: slim banner + a way back to the results */}
        <AnimatePresence>
          {state.winnerId && endDismissed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-4 z-20 flex justify-center">
              <button
                onClick={() => setEndDismissed(false)}
                className="flex items-center gap-2 rounded-full border border-[#d6a85c]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#f0d9a4] backdrop-blur transition hover:bg-black/85"
                style={{ fontFamily: SERIF }}
              >
                <Award className="h-4 w-4" /> {getPlayerName(state, state.winnerId)} rules Hexland! — show results
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR: turn state, phase actions, then tabs — one packed column */}
      <div className="flex w-[300px] flex-shrink-0 flex-col gap-2.5 overflow-hidden py-1">
        {/* Turn HUD Panel */}
        <div className="glass-strong rounded-2xl p-3.5 flex flex-col gap-3 relative shadow-xl overflow-hidden">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2 flex-shrink-0"
              style={{ backgroundColor: curPlayer.color, borderColor: 'rgba(255,255,255,0.4)' }}
              animate={{ boxShadow: [`0 0 0px ${curPlayer.color}`, `0 0 16px ${curPlayer.color}66`, `0 0 0px ${curPlayer.color}`] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {curPlayer.token}
            </motion.div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black uppercase text-[#d6a85c] tracking-widest">Current Player</span>
              <h3 className="text-sm font-black text-white truncate leading-tight mt-0.5" style={{ fontFamily: SERIF }}>{curPlayer.name}</h3>
              <p className="text-[10px] text-[#e0b56b] font-mono mt-1 font-bold">VP: {curPlayer.victoryPoints}/10</p>
            </div>
            {curPlayer.isBot && (
              <span className="text-[7px] bg-[#d6a85c]/20 text-[#e8c987] px-1.5 py-0.5 rounded font-black border border-[#d6a85c]/30">AI</span>
            )}
          </div>

          <div className="border-t border-white/5 pt-2 text-center flex items-center justify-between px-1">
            <span className="text-[9px] text-white/40 uppercase tracking-widest font-bold font-mono">Phase:</span>
            <span className="text-[10px] text-[#d6a85c] font-black uppercase tracking-wider font-mono">{state.phase}</span>
          </div>
        </div>

        {/* Phase Context details */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">

            {/* Setup placement directions */}
            {(state.phase === 'SETUP_1' || state.phase === 'SETUP_2') && (
              <motion.div
                key="setup-context"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass rounded-2xl p-4 text-center shadow-lg flex flex-col gap-2.5"
              >
                <Hammer className="w-8 h-8 text-[#d6a85c] mx-auto animate-bounce" />
                <h4 className="text-[9px] text-white/40 uppercase tracking-widest font-black font-mono">Setup Placement</h4>
                <p className="text-xs text-white leading-relaxed">
                  {isMyTurn ? (
                    "Place your settlement and road — glowing markers on the island show valid spots."
                  ) : (
                    `Waiting for ${curPlayer.name} to place their settlement and road...`
                  )}
                </p>
              </motion.div>
            )}

            {/* Roll Dice Phase */}
            {state.phase === 'ROLL' && (
              <motion.div
                key="roll-context"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-2xl p-4 text-center shadow-lg flex flex-col gap-3"
              >
                <div className="flex justify-center gap-4 py-2">
                  {[0, 1].map(i => (
                    <div key={i} className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl shadow-lg border-2 border-[#c9b688]"
                      style={{ background: "linear-gradient(#fffef8,#e9e2d0)", color: "#20160a" }}>
                      {state.dice[i]}
                    </div>
                  ))}
                </div>

                {isMyTurn && !curPlayer.isBot ? (
                  <button
                    onClick={handleRollDice}
                    disabled={isRolling}
                    className="py-2.5 bg-brand text-white font-black text-xs uppercase rounded-xl tracking-wider shadow-glow-grape transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    <Dices className="w-4 h-4" /> {isRolling ? "Rolling…" : "Roll Dice"}
                  </button>
                ) : (
                  <p className="text-xs text-white/40 italic">Waiting for roll...</p>
                )}
              </motion.div>
            )}

            {/* Robber Discard Overlay */}
            {state.phase === 'ROBBER_DISCARD' && (
              <motion.div
                key="discard-context"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass rounded-2xl border border-red-500/25 p-4 text-center shadow-2xl flex flex-col gap-3"
              >
                <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
                <h3 className="text-xs font-black uppercase text-red-400 tracking-wider">Robber Strikes!</h3>
                <p className="text-[10px] text-white/50">
                  {iMustDiscard ? (
                    <>You have more than 7 cards and must discard exactly <strong className="text-[#e0b56b] font-mono text-sm">{discardTarget}</strong> resources.</>
                  ) : (
                    <>A 7 was rolled — players holding more than 7 cards are discarding half.</>
                  )}
                </p>

                {iMustDiscard ? (
                  <div className="space-y-2.5">
                    {/* Discard resource selectors — gated against MY hand, not the
                        turn player's (a bot may have rolled the 7 that put us here) */}
                    <div className="grid grid-cols-5 gap-1.5 bg-black/40 p-2 rounded-xl">
                      {RESOURCES.map(r => (
                        <div key={r} className="flex flex-col items-center">
                          <span className="text-sm">{RESOURCE_ICONS[r]}</span>
                          <span className="text-[9px] font-mono text-[#e0b56b] font-bold mt-1">({giveRes[r]})</span>
                          <div className="flex flex-col gap-1 mt-1">
                            <button
                              disabled={giveRes[r] >= (me?.resources[r] ?? 0)}
                              onClick={() => handleModifyGive(r, 1)}
                              className="w-4 h-4 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded flex items-center justify-center text-[10px]"
                            >
                              +
                            </button>
                            <button
                              disabled={giveRes[r] <= 0}
                              onClick={() => handleModifyGive(r, -1)}
                              className="w-4 h-4 bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white rounded flex items-center justify-center text-[10px]"
                            >
                              -
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold">Selected: {discardSum}/{discardTarget}</div>
                    <button
                      onClick={submitDiscard}
                      disabled={discardSum !== discardTarget}
                      className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-[10px] uppercase rounded-xl transition shadow-lg"
                    >
                      Discard selected
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] text-white/35 italic">Waiting for other players to discard...</span>
                )}
              </motion.div>
            )}

            {/* Robber Move */}
            {state.phase === 'ROBBER_MOVE' && (
              <motion.div
                key="robber-move"
                className="glass rounded-2xl border border-[#e0b56b]/25 p-4 text-center shadow-lg flex flex-col gap-2"
              >
                <div className="text-lg">🕵️</div>
                <h4 className="text-xs font-black uppercase text-[#e0b56b] tracking-wider">Move Robber</h4>
                <p className="text-[10px] text-white/50 leading-normal">
                  {isMyTurn ? "Click a glowing hex on the island to place the robber." : "Opponent placing Robber..."}
                </p>
              </motion.div>
            )}

            {/* Main turn dashboard controls */}
            {state.phase === 'MAIN' && isMyTurn && !curPlayer.isBot && (
              <motion.div
                key="main-dash"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-2"
              >
                {/* Build selector */}
                <div className="glass p-3 rounded-2xl flex flex-col gap-2.5">
                  <h4 className="text-[9px] text-white/40 font-bold font-mono uppercase tracking-wider mb-0.5">Construction Mode</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'ROAD' ? 'NONE' : 'ROAD')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'ROAD' ? 'bg-brand text-white font-black' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
                    >
                      🛣️ Road (1w/1b)
                    </button>
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'SETTLEMENT' ? 'NONE' : 'SETTLEMENT')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'SETTLEMENT' ? 'bg-brand text-white font-black' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
                    >
                      🏠 Settl. (1w/1b/1s/1wh)
                    </button>
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'CITY' ? 'NONE' : 'CITY')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'CITY' ? 'bg-brand text-white font-black' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
                    >
                      🏰 City (3o/2wh)
                    </button>
                    <button
                      onClick={() => act('buyDevCard')}
                      className="py-2 text-[10px] uppercase font-bold bg-white/10 hover:bg-white/15 text-white/70 rounded-xl"
                    >
                      🃏 Buy Dev (1o/1s/1wh)
                    </button>
                  </div>
                  {selectedBuildMode !== 'NONE' && (
                    <div className="text-[8.5px] text-[#e0b56b] text-center font-bold font-mono animate-pulse">
                      * CLICK A GLOWING SPOT ON THE ISLAND *
                    </div>
                  )}
                </div>

                <button
                  onClick={() => act('endTurn')}
                  className="w-full py-2.5 bg-brand text-white font-black text-xs uppercase rounded-xl shadow-glow-grape transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  End Turn <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Default waiting */}
            {state.phase === 'MAIN' && (!isMyTurn || curPlayer.isBot) && (
              <motion.div
                key="waiting"
                className="text-center py-4 flex flex-col items-center gap-2 glass rounded-2xl"
              >
                <div className="w-5 h-5 rounded-full border-2 border-white/15 border-t-[#d6a85c] animate-spin" />
                <span className="text-[10px] text-white/40 italic">Waiting for opponent turn actions...</span>
              </motion.div>
            )}

            {/* Game Over */}
            {state.phase === 'GAME_OVER' && (
              <motion.div
                key="game-over"
                className="glass-strong border border-[#e0b56b]/25 p-5 rounded-2xl text-center shadow-2xl flex flex-col gap-3"
              >
                <Award className="w-10 h-10 text-[#e0b56b] mx-auto" />
                <h3 className="text-lg font-black text-[#e0b56b] uppercase tracking-widest" style={{ fontFamily: SERIF }}>Victory!</h3>
                <p className="text-xs text-white/80 font-medium leading-relaxed">
                  👑 <strong>{state.players.find(p => p.id === state.winnerId)?.name}</strong> won Hexland!
                </p>
                <button
                  onClick={handleRematch}
                  className="w-full py-2 bg-brand text-white font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  Start new match
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Standings & utilities tabs */}
        <div className="flex border-b border-white/10 pb-2 gap-1 flex-shrink-0">
          {(['HUD', 'BUILD', 'TRADE'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-[9px] font-black uppercase tracking-wider transition rounded-xl ${
                activeTab === tab ? 'text-[#f0d9a4] bg-[#d6a85c]/15 border border-[#d6a85c]/30' : 'text-white/35 hover:text-white/70'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* STANDINGS HUD TAB */}
        {activeTab === 'HUD' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
            <div className="space-y-2 overflow-y-auto max-h-56 pr-0.5">
              {state.players.map(p => {
                const isCurrent = state.players[state.currentPlayerIndex].id === p.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                      isCurrent ? 'bg-[#d6a85c]/10 border-[#d6a85c]/30 shadow-lg' : 'bg-black/25 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-full border-2 border-white/30 flex items-center justify-center text-sm font-black flex-shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.token}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-white font-bold truncate max-w-[90px]">{p.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {p.longestRoadActive && <span className="text-[6px] bg-sky-500/20 text-sky-400 px-1 rounded font-bold">ROAD</span>}
                          {p.largestArmyActive && <span className="text-[6px] bg-red-500/20 text-red-400 px-1 rounded font-bold">ARMY</span>}
                          {p.isBot && <span className="text-[6px] text-white/35 font-bold">BOT</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right flex-shrink-0 font-mono">
                      <span className="text-[10px] text-[#e0b56b] font-bold">VP: {p.victoryPoints}</span>
                      <span className="text-[8px] text-white/35">Cards: {Object.values(p.resources).reduce((a,b)=>a+b, 0)}</span>
                    </div>
                  </div>
                )
              })}

              {state.players.length < 4 && (
                <button
                  onClick={handleAddBot}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-white/50 hover:text-white rounded-xl text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#d6a85c]" /> Add Hexland Bot
                </button>
              )}
            </div>

            {/* Broadcast Log */}
            <div className="flex-1 flex flex-col bg-black/30 border border-white/10 rounded-2xl p-3 overflow-hidden min-h-0">
              <h4 className="text-[9px] font-black uppercase text-white/35 tracking-wider mb-2 flex items-center gap-1.5 flex-shrink-0 border-b border-white/5 pb-1">
                <FileText className="w-3.5 h-3.5 text-[#d6a85c]" /> Hexland Game Log
              </h4>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0 scrollbar-thin">
                {state.log.map((msg, i) => (
                  <div key={i} className="text-[9px] text-white/50 py-1 border-b border-white/5 leading-relaxed font-mono">
                    {msg}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* RESOURCE CARDS BUILD TAB */}
        {activeTab === 'BUILD' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
            <h4 className="text-[10px] font-black uppercase text-white/35 tracking-wider mb-1">My Hand Inventory</h4>
            <div className="grid grid-cols-1 gap-2">
              {RESOURCES.map(r => {
                const count = state.players.find(p => p.id === currentPlayerId)?.resources[r] || 0
                return (
                  <div key={r} className="flex justify-between items-center bg-black/25 border border-white/5 px-3 py-2 rounded-xl">
                    <span className="text-xs flex items-center gap-2 text-white">
                      <span className="text-base">{RESOURCE_ICONS[r]}</span>
                      <strong>{r}</strong>
                    </span>
                    <span className="text-sm font-mono font-bold text-[#e0b56b] bg-black/40 px-2 py-0.5 rounded-lg border border-white/5">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* BANK & DOMESTIC TRADING TAB */}
        {activeTab === 'TRADE' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 min-h-0 scrollbar-thin">

            {/* Maritime Trade panel — pick a give chip, a get chip, confirm */}
            <div className="glass p-3 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase text-[#d6a85c] tracking-wider mb-1.5 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Bank Trade
              </h4>
              <p className="text-[8.5px] text-white/40 mb-2.5 leading-normal">
                Your harbors set each rate — pick what to give, then what to get.
              </p>

              <span className="text-[8px] font-black uppercase tracking-widest text-white/40">You give</span>
              <div className="mt-1 mb-2 grid grid-cols-5 gap-1">
                {RESOURCES.map(r => {
                  const rate = getMaritimeRate(r)
                  const affordable = (me?.resources[r] ?? 0) >= rate
                  const sel = mtGive === r
                  return (
                    <button
                      key={r}
                      disabled={!affordable}
                      onClick={() => { setMtGive(sel ? null : r); if (mtGet === r) setMtGet(null) }}
                      className={`flex flex-col items-center rounded-lg border px-1 py-1.5 transition ${
                        sel ? 'border-[#f0d9a4] bg-[#d6a85c]/25'
                        : affordable ? 'border-white/10 bg-white/5 hover:bg-white/10'
                        : 'border-white/5 bg-white/[0.02] opacity-35'
                      }`}
                    >
                      <span className="text-base leading-none">{RESOURCE_ICONS[r]}</span>
                      <span className={`mt-1 rounded px-1 text-[8px] font-black font-mono ${rate < 4 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-[#e0b56b]'}`}>{rate}:1</span>
                    </button>
                  )
                })}
              </div>

              <span className="text-[8px] font-black uppercase tracking-widest text-white/40">You get</span>
              <div className="mt-1 mb-2.5 grid grid-cols-5 gap-1">
                {RESOURCES.map(r => {
                  const sel = mtGet === r
                  const blocked = r === mtGive || !mtGive
                  return (
                    <button
                      key={r}
                      disabled={blocked}
                      onClick={() => setMtGet(sel ? null : r)}
                      className={`flex items-center justify-center rounded-lg border px-1 py-2 transition ${
                        sel ? 'border-[#f0d9a4] bg-[#d6a85c]/25'
                        : blocked ? 'border-white/5 bg-white/[0.02] opacity-35'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base leading-none">{RESOURCE_ICONS[r]}</span>
                    </button>
                  )
                })}
              </div>

              <button
                disabled={!mtGive || !mtGet || !isMyTurn || state.phase !== 'MAIN'}
                onClick={() => { act('maritimeTrade', mtGive, mtGet); setMtGive(null); setMtGet(null) }}
                className="w-full py-2 bg-brand disabled:opacity-40 text-white font-black text-[10px] uppercase rounded-xl transition shadow-lg"
              >
                {mtGive && mtGet
                  ? `Trade ${getMaritimeRate(mtGive)} ${RESOURCE_ICONS[mtGive]} → 1 ${RESOURCE_ICONS[mtGet]}`
                  : 'Pick give & get'}
              </button>
              {mtGive && mtGet && (!isMyTurn || state.phase !== 'MAIN') && (
                <p className="mt-1 text-center text-[8px] italic text-white/40">Trades happen on your turn, in the Main phase.</p>
              )}
            </div>

            {/* Domestic Player Trading */}
            <div className="glass p-3 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase text-[#d6a85c] tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Propose Player Trade
              </h4>

              <div className="space-y-2.5">
                {/* Opponent picker chips */}
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/40">Trade with</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {state.players.filter(p => p.id !== currentPlayerId).map(p => {
                      const sel = tradeTargetId === p.id
                      return (
                        <button
                          key={p.id}
                          onClick={() => setTradeTarget(sel ? "" : p.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition ${
                            sel ? 'border-[#f0d9a4] bg-[#d6a85c]/25 text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          <span className="h-2.5 w-2.5 rounded-full border border-white/40" style={{ backgroundColor: p.color }} />
                          {p.name}{p.isBot && <span className="text-[8px] opacity-60">AI</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Offer / request steppers */}
                <div className="grid grid-cols-2 gap-2 bg-black/30 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[9px] text-[#d6a85c] uppercase font-black tracking-wider block mb-1.5">You Offer</span>
                    {RESOURCES.map(r => {
                      const max = me?.resources[r] ?? 0
                      return (
                        <div key={r} className={`flex items-center justify-between text-[10px] mb-1 ${max === 0 && giveRes[r] === 0 ? 'text-white/30' : 'text-white'}`}>
                          <span>{RESOURCE_ICONS[r]} <span className={`font-mono font-bold ${giveRes[r] > 0 ? 'text-[#e0b56b]' : ''}`}>{giveRes[r]}</span><span className="text-white/30">/{max}</span></span>
                          <div className="flex gap-1">
                            <button
                              disabled={giveRes[r] >= max}
                              onClick={() => handleModifyGive(r, 1)}
                              className="w-5 rounded bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30"
                            >
                              +
                            </button>
                            <button
                              disabled={giveRes[r] <= 0}
                              onClick={() => handleModifyGive(r, -1)}
                              className="w-5 rounded bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30"
                            >
                              -
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-400 uppercase font-black tracking-wider block mb-1.5">You Request</span>
                    {RESOURCES.map(r => (
                      <div key={r} className="flex items-center justify-between text-[10px] mb-1 text-white">
                        <span>{RESOURCE_ICONS[r]} <span className={`font-mono font-bold ${reqRes[r] > 0 ? 'text-emerald-300' : ''}`}>{reqRes[r]}</span></span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleModifyReq(r, 1)}
                            className="w-5 rounded bg-white/10 font-bold hover:bg-white/20"
                          >
                            +
                          </button>
                          <button
                            disabled={reqRes[r] <= 0}
                            onClick={() => handleModifyReq(r, -1)}
                            className="w-5 rounded bg-white/10 font-bold hover:bg-white/20 disabled:opacity-30"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live deal summary */}
                {(Object.values(giveRes).some(v => v > 0) || Object.values(reqRes).some(v => v > 0)) && (
                  <p className="text-center text-[9.5px] text-white/70">
                    <span className="text-[#e0b56b]">{RESOURCES.filter(r => giveRes[r] > 0).map(r => `${giveRes[r]}${RESOURCE_ICONS[r]}`).join(' + ') || 'nothing'}</span>
                    <span className="mx-1.5 text-white/40">→ for →</span>
                    <span className="text-emerald-300">{RESOURCES.filter(r => reqRes[r] > 0).map(r => `${reqRes[r]}${RESOURCE_ICONS[r]}`).join(' + ') || 'nothing'}</span>
                  </p>
                )}

                <button
                  disabled={!tradeTargetId || !isMyTurn || state.phase !== 'MAIN' || (Object.values(giveRes).every(v => v === 0) && Object.values(reqRes).every(v => v === 0))}
                  onClick={triggerDomesticTrade}
                  className="w-full py-2 bg-brand disabled:opacity-40 text-white font-black text-[10px] uppercase rounded-xl transition shadow-lg"
                >
                  {tradeTargetId ? `Propose to ${getPlayerName(state, tradeTargetId)}` : 'Pick an opponent'}
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* OVERLAYS / DIALOGS */}
      <AnimatePresence>

        {/* Incoming Trade Dialog offer */}
        {state.tradeOffer && state.tradeOffer.receiverId === currentPlayerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-[#d6a85c]/40 rounded-2xl p-5 shadow-2xl max-w-sm w-full"
              style={{ background: "linear-gradient(160deg,#2a2013,#211a10)" }}
            >
              <h3 className="text-sm font-black uppercase text-[#e8c987] tracking-wider mb-2 flex items-center gap-2" style={{ fontFamily: SERIF }}>
                <ArrowRightLeft className="w-5 h-5 animate-pulse" /> Incoming Trade Offer
              </h3>
              <p className="text-[10px] text-white/70 mb-3">
                {getPlayerName(state, state.tradeOffer.senderId)} proposed a deal!
              </p>

              <div className="grid grid-cols-2 gap-3 bg-black/30 p-3.5 rounded-xl mb-4 border border-white/5 text-[10px]">
                <div>
                  <span className="text-[8px] text-white/40 font-bold uppercase block mb-1">They Give</span>
                  {RESOURCES.map(r => state.tradeOffer!.senderOffer[r] > 0 ? (
                    <span key={r} className="block text-white mb-0.5">
                      {RESOURCE_ICONS[r]} {state.tradeOffer!.senderOffer[r]} {r}
                    </span>
                  ) : null)}
                </div>
                <div>
                  <span className="text-[8px] text-white/40 font-bold uppercase block mb-1">They Request</span>
                  {RESOURCES.map(r => state.tradeOffer!.receiverOffer[r] > 0 ? (
                    <span key={r} className="block text-white mb-0.5">
                      {RESOURCE_ICONS[r]} {state.tradeOffer!.receiverOffer[r]} {r}
                    </span>
                  ) : null)}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => act('acceptTrade')}
                  className="flex-1 py-2 bg-brand text-white font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  Accept
                </button>
                <button
                  onClick={() => act('rejectTrade')}
                  className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase rounded-xl transition"
                >
                  Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Robber Stealing Selection Dialog overlay */}
        {showStealDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-[#e0b56b]/30 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
              style={{ background: "linear-gradient(160deg,#2a2013,#211a10)" }}
            >
              <h3 className="text-sm font-black uppercase text-[#e0b56b] tracking-wider mb-2" style={{ fontFamily: SERIF }}>🕵️ Robber Steal Choice</h3>
              <p className="text-xs text-white/70 mb-4 leading-normal">
                Select an opponent adjacent to the robber hex to steal one random resource card from their hand.
              </p>

              <div className="flex flex-col gap-2">
                {state.robberStealOptions.map(id => {
                  const name = getPlayerName(state, id)
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        act('stealResource', id)
                        setShowSteal(false)
                      }}
                      className="py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase rounded-xl transition"
                    >
                      Steal from {name}
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowSteal(false)}
                  className="py-2 bg-white/5 hover:bg-white/10 text-white/50 text-xs rounded-xl mt-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Year of Plenty Dialog */}
        {showYearOfPlentyDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-[#6b5230]/50 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
              style={{ background: "linear-gradient(160deg,#2a2013,#211a10)" }}
            >
              <h3 className="text-sm font-black uppercase text-[#e8c987] tracking-wider mb-2" style={{ fontFamily: SERIF }}>🃏 Year of Plenty</h3>
              <p className="text-xs text-white/70 mb-4 leading-normal">
                Select exactly 2 resource cards to receive from the bank for free.
              </p>

              {/* Selected Cards Display */}
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1].map(idx => {
                  const res = yopSelections[idx];
                  return (
                    <div
                      key={idx}
                      className="w-14 h-14 bg-black/30 border border-white/10 rounded-xl flex flex-col items-center justify-center text-xs font-bold"
                    >
                      {res ? (
                        <>
                          <span className="text-lg">{RESOURCE_ICONS[res]}</span>
                          <span className="text-[9px] text-white/50">{res}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-white/30">Select...</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resources Selection Grid */}
              <div className="grid grid-cols-5 gap-1.5 mb-5">
                {RESOURCES.map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      if (yopSelections.length < 2) {
                        setYopSelections(prev => [...prev, r]);
                      } else {
                        // Replace the last choice
                        setYopSelections(prev => [prev[0], r]);
                      }
                    }}
                    className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/5 rounded-xl flex flex-col items-center justify-center transition"
                  >
                    <span className="text-lg">{RESOURCE_ICONS[r]}</span>
                    <span className="text-[8px] text-white/50 font-bold uppercase mt-1">{r}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={yopSelections.length !== 2}
                  onClick={() => {
                    act('playYearOfPlenty', yopSelections[0], yopSelections[1]);
                    setShowYearOfPlentyDialog(false);
                  }}
                  className="flex-1 py-2.5 bg-brand disabled:opacity-40 text-white font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  Claim Resources
                </button>
                <button
                  onClick={() => setShowYearOfPlentyDialog(false)}
                  className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/50 text-xs font-bold uppercase rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Embargo Dialog */}
        {showMonopolyDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="border border-[#6b5230]/50 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
              style={{ background: "linear-gradient(160deg,#2a2013,#211a10)" }}
            >
              <h3 className="text-sm font-black uppercase text-[#e8c987] tracking-wider mb-2" style={{ fontFamily: SERIF }}>🃏 Embargo</h3>
              <p className="text-xs text-white/70 mb-4 leading-normal">
                Select 1 resource. All other players must surrender all their cards of this resource type to you.
              </p>

              {/* Resources Choice Grid */}
              <div className="grid grid-cols-1 gap-2 mb-5">
                {RESOURCES.map(r => (
                  <button
                    key={r}
                    onClick={() => {
                      act('playMonopoly', r);
                      setShowMonopolyDialog(false);
                    }}
                    className="py-3 px-4 bg-white/10 hover:bg-white/15 hover:border-[#d6a85c]/40 active:scale-[0.98] border border-white/5 rounded-xl flex items-center justify-between transition"
                  >
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="text-lg">{RESOURCE_ICONS[r]}</span> {r}
                    </span>
                    <span className="text-[9px] text-[#d6a85c] font-extrabold uppercase tracking-widest">Select</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowMonopolyDialog(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-white/50 text-xs font-bold uppercase rounded-xl transition"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </div>
  )
}

// ---- Full-board victory screen ------------------------------------------------
// Takes over the play area when the game ends: the 3D island keeps breathing
// behind a cinematic dim while the full space shows the podium and each
// player's complete match stats.

function HexlandEndScreen({ state, currentPlayerId, onRematch, onDismiss }: {
  state: CatanState
  currentPlayerId: string
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const ranked = [...state.players].sort((a, b) => b.victoryPoints - a.victoryPoints)
  const winner = ranked[0]
  const youWon = state.winnerId === currentPlayerId
  const medals = ["🥇", "🥈", "🥉", "4️⃣"]

  const statsOf = (p: typeof state.players[number]) => {
    const mine = Object.values(state.settlements).filter(s => s.playerId === p.id)
    const cities = mine.filter(s => s.type === "city").length
    return {
      settlements: mine.length - cities,
      cities,
      roads: Object.values(state.roads).filter(id => id === p.id).length,
      knights: p.playedKnights,
      devs: Object.values(p.devCards).reduce((a, b) => a + b, 0),
      cards: Object.values(p.resources).reduce((a, b) => a + b, 0),
    }
  }

  const STAT_META: { key: keyof ReturnType<typeof statsOf>; icon: string; label: string }[] = [
    { key: "settlements", icon: "🏠", label: "Settlements" },
    { key: "cities", icon: "🏰", label: "Cities" },
    { key: "roads", icon: "🛣️", label: "Roads" },
    { key: "knights", icon: "⚔️", label: "Knights" },
    { key: "devs", icon: "🃏", label: "Dev cards" },
    { key: "cards", icon: "🖐️", label: "Resources" },
  ]

  const share = async () => {
    const rows = ranked.map((p, i) => `${medals[i] || `${i + 1}.`} ${p.name} — ${p.victoryPoints} pts`).join("\n")
    const text = `🏝️ Hexland on Dice Alley\n👑 ${winner.name} wins!\n\n${rows}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== "undefined" && navigator.share) await navigator.share({ title: "Hexland — Dice Alley", text })
      else await navigator.clipboard.writeText(text)
      setShared(true)
      setTimeout(() => setShared(false), 2000)
    } catch { /* user cancelled — ignore */ }
  }

  const leave = () => {
    const pid = new URLSearchParams(window.location.search).get("partyId")
    window.location.href = pid && pid !== "mock-party-id" ? `/party/${pid}` : "/games"
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-black/85 via-black/60 to-black/85 backdrop-blur-[3px]"
    >
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5">
        {/* Header */}
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#d6a85c]">Hexland — Game Over</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? "🎉 You rule Hexland!" : <>{winner.name} <span className="text-[#e8c987]">rules Hexland!</span></>}
          </h2>
        </motion.div>

        {/* Winner hero card */}
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
          className="w-full max-w-xl rounded-2xl border-2 border-[#e0b56b]/70 bg-gradient-to-b from-[#3a2c18]/95 to-[#241a10]/95 p-4 shadow-[0_0_60px_-10px_rgba(224,181,107,0.5)]"
        >
          <div className="flex items-center gap-3.5">
            <div className="relative grid h-14 w-14 flex-shrink-0 place-items-center rounded-full border-2 border-white/40 text-2xl shadow-lg" style={{ backgroundColor: winner.color }}>
              {winner.token}
              <Crown className="absolute -top-3.5 left-1/2 h-5 w-5 -translate-x-1/2 text-[#e0b56b]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-black text-white" style={{ fontFamily: SERIF }}>
                {winner.name}{winner.isBot && <span className="ml-2 rounded bg-[#d6a85c]/20 px-1.5 py-0.5 align-middle text-[8px] font-bold text-[#e8c987]">AI</span>}
              </h3>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {winner.longestRoadActive && <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[9px] font-black text-sky-300">🛣️ Longest Road +2</span>}
                {winner.largestArmyActive && <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[9px] font-black text-red-300">⚔️ Largest Army +2</span>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black leading-none text-[#e0b56b]" style={{ fontFamily: SERIF }}>{winner.victoryPoints}</p>
              <p className="text-[8px] font-black uppercase tracking-widest text-white/40">Victory Pts</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-6 gap-1.5 border-t border-white/10 pt-3">
            {STAT_META.map(m => (
              <div key={m.key} className="rounded-lg bg-black/30 py-1.5 text-center">
                <p className="text-sm leading-none">{m.icon}</p>
                <p className="mt-1 text-sm font-black leading-none text-white">{statsOf(winner)[m.key]}</p>
                <p className="mt-0.5 text-[6.5px] font-bold uppercase tracking-wide text-white/40">{m.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Runners-up */}
        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {ranked.slice(1).map((p, i) => {
            const s = statsOf(p)
            const isMe = p.id === currentPlayerId
            return (
              <motion.div
                key={p.id}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className={`rounded-xl border p-3 ${isMe ? "border-[#d6a85c]/40 bg-[#d6a85c]/10" : "border-white/10 bg-black/40"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{medals[i + 1] || `${i + 2}.`}</span>
                  <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full border border-white/30 text-base" style={{ backgroundColor: p.color }}>
                    {p.token}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white" style={{ fontFamily: SERIF }}>
                      {p.name}{isMe && <span className="ml-1.5 text-[9px] font-bold text-[#e8c987]">(you)</span>}
                    </p>
                    <div className="flex gap-1">
                      {p.longestRoadActive && <span className="text-[8px] font-black text-sky-300">🛣️ Road</span>}
                      {p.largestArmyActive && <span className="text-[8px] font-black text-red-300">⚔️ Army</span>}
                    </div>
                  </div>
                  <p className="text-xl font-black text-[#e8c987]" style={{ fontFamily: SERIF }}>{p.victoryPoints}<span className="ml-0.5 text-[9px] text-white/40">pts</span></p>
                </div>
                <div className="mt-2 flex justify-between border-t border-white/5 pt-2 text-[10px] text-white/60">
                  <span>🏠 {s.settlements}</span><span>🏰 {s.cities}</span><span>🛣️ {s.roads}</span>
                  <span>⚔️ {s.knights}</span><span>🃏 {s.devs}</span><span>🖐️ {s.cards}</span>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Actions */}
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={onRematch}
            className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
            <RotateCcw className="h-4 w-4" /> Rematch
          </button>
          <button onClick={share}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Share2 className="h-4 w-4" /> {shared ? "Copied!" : "Share"}
          </button>
          <button onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Eye className="h-4 w-4" /> View Island
          </button>
          <button onClick={leave}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase text-white/60 transition hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" /> Leave
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}
