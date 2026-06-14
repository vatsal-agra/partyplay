// Hexland Board UI Component — Premium Visual Overhaul
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import * as catanEngine from "../lib/catanEngine"
import {
  CatanState,
  CatanPlayer,
  ResourceType,
  TerrainType,
  DevCardType,
  RESOURCES,
  getBoardLayout,
  BoardLayout,
  getPlayerName
} from "../lib/catanEngine"
import {
  Dice1, Dices, ChevronRight, RefreshCw, Landmark, ArrowRightLeft,
  UserPlus, UserMinus, ShieldAlert, Award, FileText, Check, X,
  Hammer, ShoppingBag, HelpCircle
} from "lucide-react"

interface CatanBoardProps {
  state: CatanState
  currentPlayerId: string
  onStateChange: (newState: CatanState) => void
  onBroadcastAction?: (action: string, payload: any) => void
}

// Earthy, painted palette tuned to the real Catan terrain tiles
const TERRAIN_STYLES: Record<TerrainType, { name: string; fill: string; grad: [string, string]; icon: string }> = {
  FOREST:    { name: 'Forest',    fill: '#2f7d36', grad: ['#3c8a3f', '#1c4d22'], icon: '🌲' },
  HILLS:     { name: 'Hills',     fill: '#c2562e', grad: ['#cf6a3a', '#7e3417'], icon: '🧱' },
  PASTURE:   { name: 'Pasture',   fill: '#7cb342', grad: ['#9fcf52', '#56962a'], icon: '🐑' },
  FIELDS:    { name: 'Fields',    fill: '#e0a82e', grad: ['#f2c84c', '#bd861a'], icon: '🌾' },
  MOUNTAINS: { name: 'Mountains', fill: '#6b7280', grad: ['#97a0af', '#3c424d'], icon: '🏔️' },
  DESERT:    { name: 'Desert',    fill: '#d9b066', grad: ['#e8c98f', '#c2954a'], icon: '🏜️' }
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  WOOD: '🌲',
  BRICK: '🧱',
  SHEEP: '🐑',
  WHEAT: '🌾',
  ORE: '🏔️'
};

function renderTerrainGraphics(terrain: TerrainType) {
  switch (terrain) {
    // LUMBER — a dense stand of pine trees
    case 'FOREST':
      return (
        <g className="opacity-95">
          {[
            { x: -16, y: 6, s: 0.5, a: '#1f5a27', b: '#174420', c: '#0f3017' },
            { x: 16, y: 7, s: 0.5, a: '#1f5a27', b: '#174420', c: '#0f3017' },
            { x: -9, y: 0, s: 0.72, a: '#2f7d36', b: '#1f5a27', c: '#163f1c' },
            { x: 10, y: -1, s: 0.72, a: '#2f7d36', b: '#1f5a27', c: '#163f1c' },
            { x: 0, y: -8, s: 0.96, a: '#3c9342', b: '#2a7232', c: '#194a20' },
          ].map((t, i) => (
            <g key={i} transform={`translate(${t.x}, ${t.y}) scale(${t.s})`}>
              <rect x="-1.6" y="6" width="3.2" height="7" fill="#5b3a1a" />
              <path d="M 0,-15 L 8,-3 L -8,-3 Z" fill={t.a} />
              <path d="M 0,-9 L 10,4 L -10,4 Z" fill={t.b} />
              <path d="M 0,-3 L 11,10 L -11,10 Z" fill={t.c} />
            </g>
          ))}
        </g>
      )
    // BRICK — rolling clay hills with a stack of bricks
    case 'HILLS':
      return (
        <g className="opacity-95">
          <path d="M -27,13 Q -13,-5 1,13 Z" fill="#9c4521" />
          <path d="M -3,13 Q 13,-7 29,13 Z" fill="#b5532a" />
          <path d="M -28,14 Q -6,3 16,14 Z" fill="#7e3417" opacity="0.55" />
          <g transform="translate(2, 1)">
            <rect x="-9" y="-2.5" width="8" height="3.6" rx="0.6" fill="#d4703f" stroke="#5a2310" strokeWidth="0.5" />
            <rect x="1" y="-2.5" width="8" height="3.6" rx="0.6" fill="#c2562e" stroke="#5a2310" strokeWidth="0.5" />
            <rect x="-13" y="1.6" width="8" height="3.6" rx="0.6" fill="#cf6536" stroke="#5a2310" strokeWidth="0.5" />
            <rect x="-4" y="1.6" width="8" height="3.6" rx="0.6" fill="#bb5028" stroke="#5a2310" strokeWidth="0.5" />
            <rect x="5" y="1.6" width="8" height="3.6" rx="0.6" fill="#cf6536" stroke="#5a2310" strokeWidth="0.5" />
          </g>
        </g>
      )
    // WOOL — green pasture with a fence and grazing sheep
    case 'PASTURE':
      return (
        <g className="opacity-95">
          <path d="M -27,11 Q 0,-3 27,11 Z" fill="#6fae35" />
          <path d="M -27,13 Q 0,3 27,13 Z" fill="#56962a" opacity="0.7" />
          <g stroke="#6b4a23" strokeWidth="1.4" strokeLinecap="round">
            <line x1="-20" y1="2" x2="-20" y2="8" />
            <line x1="-14" y1="1" x2="-14" y2="7" />
            <line x1="-8" y1="0" x2="-8" y2="6" />
            <line x1="-21" y1="3.5" x2="-7" y2="1.5" />
          </g>
          {[
            { x: 7, y: -2, s: 0.85 },
            { x: 15, y: 4, s: 0.7 },
            { x: -1, y: 7, s: 0.7 },
          ].map((s, i) => (
            <g key={i} transform={`translate(${s.x}, ${s.y}) scale(${s.s})`}>
              <ellipse cx="0" cy="0" rx="5" ry="3.6" fill="#f4f4f0" stroke="#d6d3cc" strokeWidth="0.6" />
              <circle cx="-5" cy="-1" r="2.2" fill="#3b3b42" />
              <line x1="-4" y1="3" x2="-4" y2="4.6" stroke="#3b3b42" strokeWidth="0.8" />
              <line x1="3" y1="3" x2="3" y2="4.6" stroke="#3b3b42" strokeWidth="0.8" />
            </g>
          ))}
        </g>
      )
    // GRAIN — golden field with furrows and wheat sheaves
    case 'FIELDS':
      return (
        <g className="opacity-95">
          <g stroke="#b8860b" strokeWidth="1" opacity="0.5" fill="none">
            <path d="M -24,11 Q 0,3 24,11" />
            <path d="M -22,6 Q 0,-1 22,6" />
            <path d="M -18,1 Q 0,-5 18,1" />
          </g>
          {[-11, 0, 11].map((x, i) => (
            <g key={i} transform={`translate(${x}, ${i === 1 ? -2 : 2})`} strokeLinecap="round">
              <line x1="0" y1="9" x2="0" y2="-6" stroke="#c9920f" strokeWidth="1.3" />
              <line x1="0" y1="-2" x2="-4" y2="-7" stroke="#e8b923" strokeWidth="0.8" />
              <line x1="0" y1="-2" x2="4" y2="-7" stroke="#e8b923" strokeWidth="0.8" />
              <line x1="0" y1="1" x2="-4" y2="-3" stroke="#e8b923" strokeWidth="0.8" />
              <line x1="0" y1="1" x2="4" y2="-3" stroke="#e8b923" strokeWidth="0.8" />
              <line x1="0" y1="-6" x2="0" y2="-10" stroke="#f2c84c" strokeWidth="0.9" />
            </g>
          ))}
        </g>
      )
    // ORE — grey mountain range with snow caps and a mine
    case 'MOUNTAINS':
      return (
        <g className="opacity-95">
          <path d="M -24,13 L -12,-6 L 0,13 Z" fill="#5b6470" stroke="#363c46" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M -16,-1 L -12,-6 L -8,-1 L -12,1 Z" fill="#eef2f7" />
          <path d="M 2,13 L 14,-8 L 26,13 Z" fill="#6b7280" stroke="#363c46" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M 9,-1 L 14,-8 L 19,-1 L 14,1 Z" fill="#eef2f7" />
          <path d="M -13,14 L 2,-16 L 17,14 Z" fill="#4b5360" stroke="#2b303a" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M -5,-3 L 2,-16 L 9,-3 L 2,0 Z" fill="#ffffff" />
          <path d="M -2.5,14 Q -2.5,8 2,8 Q 6.5,8 6.5,14 Z" fill="#1f242c" stroke="#11141a" strokeWidth="0.6" />
          <circle cx="0.5" cy="12" r="0.8" fill="#fbbf24" />
          <circle cx="4" cy="12.5" r="0.6" fill="#fcd34d" />
        </g>
      )
    // DESERT — dunes, a sun and a cactus
    case 'DESERT':
      return (
        <g className="opacity-95">
          <path d="M -27,11 Q -10,-1 8,11 Z" fill="#d9b066" opacity="0.7" />
          <path d="M -6,12 Q 12,3 28,12 Z" fill="#c2954a" opacity="0.6" />
          <circle cx="-14" cy="-9" r="4" fill="#fcd34d" opacity="0.85" />
          <g transform="translate(8, -2)">
            <path d="M 0,12 L 0,-7" fill="none" stroke="#3f7d35" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 0,2 L -4,2 L -4,-3" fill="none" stroke="#3f7d35" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M 0,5 L 4,5 L 4,0" fill="none" stroke="#3f7d35" strokeWidth="2.6" strokeLinecap="round" />
          </g>
          <ellipse cx="-9" cy="11" rx="3" ry="1.6" fill="#b08545" />
        </g>
      )
    default:
      return null
  }
}

function renderPips(num: number) {
  const count = 6 - Math.abs(7 - num)
  if (count <= 0) return null
  const isRed = [6, 8].includes(num)
  const spacing = 3.2
  const startX = -((count - 1) * spacing) / 2
  return Array.from({ length: count }).map((_, i) => (
    <circle
      key={i}
      cx={startX + i * spacing}
      cy={7.5}
      r={0.9}
      fill={isRed ? "#dc2626" : "#1e293b"}
    />
  ))
}

export default function CatanBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: CatanBoardProps) {
  const [activeTab, setActiveTab]         = useState<'HUD' | 'BUILD' | 'TRADE' | 'DEV'>('HUD')
  const [tradeTargetId, setTradeTarget]   = useState<string>("")
  const [giveRes, setGiveRes]             = useState<Record<ResourceType, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  const [reqRes, setReqRes]               = useState<Record<ResourceType, number>>({ WOOD: 0, BRICK: 0, SHEEP: 0, WHEAT: 0, ORE: 0 })
  const [selectedBuildMode, setBuildMode] = useState<'NONE' | 'SETTLEMENT' | 'ROAD' | 'CITY'>('NONE')
  const [showStealDialog, setShowSteal]   = useState(false)
  const [isRolling, setIsRolling]         = useState(false)
  
  // Dev Card UI States
  const [isPlayingKnight, setIsPlayingKnight] = useState(false)
  const [roadBuildingActive, setRoadBuildingActive] = useState(false)
  const [selectedRoads, setSelectedRoads] = useState<number[]>([])
  const [showYearOfPlentyDialog, setShowYearOfPlentyDialog] = useState(false)
  const [yopSelections, setYopSelections] = useState<ResourceType[]>([])
  const [showMonopolyDialog, setShowMonopolyDialog] = useState(false)
  
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log])

  const layout = getBoardLayout()
  const curPlayer = state.players[state.currentPlayerIndex]
  const isMyTurn  = curPlayer.id === currentPlayerId

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

  // Trigger Steal choice if robber moved and options exist
  useEffect(() => {
    if ((state.phase === 'MAIN' || state.phase === 'ROBBER_MOVE') && state.robberStealOptions.length > 0 && isMyTurn && !curPlayer.isBot) {
      setShowSteal(true)
    } else {
      setShowSteal(false)
    }
  }, [state.robberStealOptions, state.phase, isMyTurn, curPlayer.isBot])

  // Coordinate conversion to fit 500x500 board SVG
  const cx = 250
  const cy = 250
  const scale = 36

  const toPx = useCallback((x: number, y: number) => {
    return {
      x: cx + x * scale,
      y: cy + y * scale
    }
  }, [])

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

    layout.edges.forEach(e => {
      // Must be empty
      if (state.roads[e.id]) return
      // Cannot select same road twice during dev card building
      if (roadBuildingActive && selectedRoads.includes(e.id)) return

      const isSetup = state.phase === 'SETUP_1' || state.phase === 'SETUP_2'
      if (isSetup && isMyTurn) {
        // Setup roads must touch the newly built settlement of the player
        const myBuilds = Object.entries(state.settlements)
          .filter(([, s]) => s.playerId === curPlayer.id)
          .map(([vId]) => parseInt(vId))
        
        const touchesMySettlement = e.vertices.some(vId => myBuilds.includes(vId))
        if (touchesMySettlement) {
          list.push(e.id)
        }
      } else if (isMyTurn && (selectedBuildMode === 'ROAD' || roadBuildingActive)) {
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

  // Robber Discard state helper
  const botNeedsDiscard = state.phase === 'ROBBER_DISCARD' && state.discardRequiredPlayers.includes(currentPlayerId)
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

  // Ocean frame boundary coordinates
  const oceanPoints = Array.from({ length: 6 }).map((_, i) => {
    const angle = ((30 + 60 * i) * Math.PI) / 180
    const px = 250 + 235 * Math.cos(angle)
    const py = 250 + 235 * Math.sin(angle)
    return `${px},${py}`
  }).join(" ")

  const oceanPointsInner = Array.from({ length: 6 }).map((_, i) => {
    const angle = ((30 + 60 * i) * Math.PI) / 180
    const px = 250 + 227 * Math.cos(angle)
    const py = 250 + 227 * Math.sin(angle)
    return `${px},${py}`
  }).join(" ")

  return (
    <div className="flex w-full h-full overflow-hidden bg-slate-950 select-none p-2 gap-3 text-slate-200">
      
      {/* COLUMN 1: BOARD MAP */}
      <div className="flex flex-col items-center justify-center p-1 bg-slate-900/40 rounded-2xl border border-white/5 shadow-2xl relative">
        {(isPlayingKnight || roadBuildingActive) && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-slate-900/90 backdrop-blur border border-pink-500/20 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <span className="text-[11px] font-bold text-slate-200 flex items-center gap-2">
              {isPlayingKnight ? (
                <><span className="text-yellow-400">⚔️ Knight Card Active:</span> Click any hex to move the robber.</>
              ) : (
                <><span className="text-sky-400">🛣️ Road Building Active:</span> Click 2 edges to place free roads. ({selectedRoads.length}/2 selected)</>
              )}
            </span>
            <button
              onClick={() => {
                setIsPlayingKnight(false)
                setRoadBuildingActive(false)
                setSelectedRoads([])
              }}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-[9px] font-black uppercase transition"
            >
              Cancel
            </button>
          </div>
        )}

        <svg
          viewBox="0 0 500 500"
          className="bg-slate-950 border-4 border-slate-800 rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          style={{ width: 'min(78vh, 700px)', height: 'min(78vh, 700px)' }}
        >
          <defs>
            {/* Terrain Gradients */}
            {Object.entries(TERRAIN_STYLES).map(([key, style]) => (
              <linearGradient id={`${key}-grad`} key={key} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={style.grad[0]} />
                <stop offset="100%" stopColor={style.grad[1]} />
              </linearGradient>
            ))}
            {/* Ocean Gradient — teal Catan sea */}
            <linearGradient id="ocean-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2a8fa0" />
              <stop offset="50%" stopColor="#1c6e80" />
              <stop offset="100%" stopColor="#0e3f4d" />
            </linearGradient>
            {/* Sand Gradient */}
            <linearGradient id="sand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef3c7" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            {/* Parchment Gradient */}
            <radialGradient id="parchment-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fffef0" />
              <stop offset="80%" stopColor="#fcf8e3" />
              <stop offset="100%" stopColor="#eadeb6" />
            </radialGradient>
            {/* Tile vignette shading — gives each hex a printed, beveled depth */}
            <radialGradient id="hex-shade" cx="50%" cy="42%" r="62%">
              <stop offset="55%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#1a0f04" stopOpacity="0.32" />
            </radialGradient>
            {/* Top gloss highlight */}
            <linearGradient id="hex-gloss" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            {/* Soft shadow to lift the island off the sea */}
            <filter id="island-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#03161b" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Wooden Ocean Frame */}
          <polygon
            points={oceanPoints}
            fill="url(#ocean-grad)"
            stroke="#78350f"
            strokeWidth="12"
            strokeLinejoin="round"
            className="filter drop-shadow-[0_10px_30px_rgba(0,0,0,0.6)]"
          />
          <polygon
            points={oceanPointsInner}
            fill="none"
            stroke="#451a03"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* 1. Harbors (Docks and Sailing Ships) */}
          {layout.harbors.map((h, i) => {
            const v1 = layout.vertices[h.vertices[0]]
            const v2 = layout.vertices[h.vertices[1]]
            const p1 = toPx(v1.x, v1.y)
            const p2 = toPx(v2.x, v2.y)
            const midX = (p1.x + p2.x) / 2
            const midY = (p1.y + p2.y) / 2
            
            // Outward projection vector
            const dx = midX - 250
            const dy = midY - 250
            const len = Math.hypot(dx, dy) || 1
            const ux = dx / len
            const uy = dy / len
            
            // Badge & Ship locations
            const badgeX = midX + ux * 18
            const badgeY = midY + uy * 18
            const shipX = midX + ux * 36
            const shipY = midY + uy * 36

            return (
              <g key={`harbor-${i}`}>
                {/* Wooden Docks V-shape */}
                <line x1={p1.x} y1={p1.y} x2={badgeX} y2={badgeY} stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
                <line x1={p1.x} y1={p1.y} x2={badgeX} y2={badgeY} stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
                <line x1={p2.x} y1={p2.y} x2={badgeX} y2={badgeY} stroke="#78350f" strokeWidth="3.5" strokeLinecap="round" />
                <line x1={p2.x} y1={p2.y} x2={badgeX} y2={badgeY} stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />

                {/* Sailing Ship with rocking motion */}
                <g transform={`translate(${shipX}, ${shipY})`}>
                  <motion.g
                    transformTemplate={({ rotate, y }) => `translate(0, ${y}) rotate(${rotate}) scale(0.6)`}
                    animate={{
                      y: [-1, 1, -1],
                      rotate: [-2.5, 2.5, -2.5]
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 3 + (i % 3) * 0.7,
                      ease: "easeInOut"
                    }}
                  >
                    {/* Hull */}
                    <path d="M -12,2 L 12,2 L 8,8 L -8,8 Z" fill="#5c2e0b" stroke="#331904" strokeWidth="1" />
                    {/* Mast */}
                    <line x1="0" y1="2" x2="0" y2="-12" stroke="#331904" strokeWidth="1.5" />
                    {/* Sails */}
                    <path d="M 0,-12 L 8,0 L 0,0 Z" fill="#fafaf9" stroke="#d6d3d1" strokeWidth="0.5" />
                    <path d="M 0,-10 L -6,-2 L 0,-2 Z" fill="#e7e5e4" stroke="#d6d3d1" strokeWidth="0.5" />
                    {/* Flag */}
                    <polygon points="0,-12 -3,-10 0,-8" fill="#ef4444" />
                  </motion.g>
                </g>

                {/* Circular Banner Badge */}
                <g transform={`translate(${badgeX}, ${badgeY})`} className="filter drop-shadow-md">
                  <circle r="12" fill="url(#parchment-grad)" stroke="#78350f" strokeWidth="1.5" />
                  <circle r="10" fill="none" stroke="#d97706" strokeWidth="0.5" strokeDasharray="1,1" />
                  {h.resource === 'GENERIC' ? (
                    <text y="3" textAnchor="middle" className="text-[7.5px] font-black fill-[#78350f] font-mono">
                      3:1
                    </text>
                  ) : (
                    <g>
                      <text y="-2" textAnchor="middle" className="text-[6px] font-bold fill-[#78350f] font-mono">
                        2:1
                      </text>
                      <text y="6" textAnchor="middle" className="text-[9px] pointer-events-none select-none">
                        {RESOURCE_ICONS[h.resource]}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            )
          })}

          {/* 2. Sandy Coastline (rendered underneath land hexes to border the island) */}
          <g filter="url(#island-shadow)">
            {state.hexes.map((hex) => {
              const hexLayout = layout.hexes[hex.index]
              const center = toPx(hexLayout.x, hexLayout.y)
              const sandyPoints = hexLayout.vertices
                .map(vId => {
                  const v = layout.vertices[vId]
                  const pt = toPx(v.x, v.y)
                  const sx = center.x + (pt.x - center.x) * 1.10
                  const sy = center.y + (pt.y - center.y) * 1.10
                  return `${sx},${sy}`
                })
                .join(" ")

              return (
                <polygon
                  key={`sand-${hex.index}`}
                  points={sandyPoints}
                  fill="url(#sand-grad)"
                  stroke="#d97706"
                  strokeWidth="1"
                  opacity="0.95"
                />
              )
            })}
          </g>

          {/* 3. Hexagons (Land Tiles) */}
          {state.hexes.map((hex, idx) => {
            const hexLayout = layout.hexes[hex.index]
            const points = hexLayout.vertices
              .map(vId => {
                const v = layout.vertices[vId]
                const pt = toPx(v.x, v.y)
                return `${pt.x},${pt.y}`
              })
              .join(" ")

            const center = toPx(hexLayout.x, hexLayout.y)
            const isClickableRobber = buildableHexes.includes(hex.index)

            return (
              <g key={hex.index} className="group">
                {/* Terrain Tile Face */}
                <polygon
                  points={points}
                  fill={`url(#${hex.terrain}-grad)`}
                  stroke="#2d1706"
                  strokeWidth="2.5"
                  className={`transition duration-200 hover:brightness-110 ${
                    isClickableRobber ? 'cursor-pointer stroke-yellow-400 fill-yellow-500/20 animate-pulse' : 'cursor-default'
                  }`}
                  onClick={() => {
                    if (isClickableRobber) {
                      if (isPlayingKnight) {
                        act('playKnight', hex.index, null)
                        setIsPlayingKnight(false)
                      } else {
                        act('moveRobber', hex.index)
                      }
                    }
                  }}
                />
                
                {/* Vector Terrain Art */}
                <g transform={`translate(${center.x}, ${center.y})`} className="pointer-events-none select-none">
                  {renderTerrainGraphics(hex.terrain)}
                </g>

                {/* Printed-tile shading: edge vignette + top gloss (non-interactive) */}
                <polygon points={points} fill="url(#hex-shade)" className="pointer-events-none" />
                <polygon points={points} fill="url(#hex-gloss)" className="pointer-events-none" />

                {/* Parchment Number Token */}
                {hex.numberToken > 0 && (
                  <g transform={`translate(${center.x}, ${center.y})`} className="pointer-events-none">
                    <circle r="12" fill="url(#parchment-grad)" stroke="#78350f" strokeWidth="1.5" className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
                    <circle r="9.5" fill="none" stroke="#b45309" strokeWidth="0.5" strokeDasharray="1,1" />
                    <text
                      y="3.5"
                      textAnchor="middle"
                      className={`text-[11px] font-black font-mono tracking-tight ${
                        [6, 8].includes(hex.numberToken) ? 'fill-[#dc2626] font-extrabold' : 'fill-[#1e293b]'
                      }`}
                    >
                      {hex.numberToken}
                    </text>
                    {/* Probability pips */}
                    {renderPips(hex.numberToken)}
                  </g>
                )}

                {/* Robber Visor Pawn Silhouette (placed offset to keep number token visible) */}
                {hex.hasRobber && (
                  <g transform={`translate(${center.x + 9}, ${center.y - 9})`} className="pointer-events-none">
                    <ellipse cx="0" cy="12" rx="10" ry="4" fill="rgba(15,23,42,0.4)" />
                    <circle r="18" fill="rgba(15,23,42,0.65)" stroke="#ef4444" strokeWidth="1.5" className="animate-pulse" />
                    <path
                      d="M -5,11 C -5,11 -8,9 -8,5 C -8,2 -4,1 -4,-2 C -4,-5 -6,-5 -6,-8 C -6,-11 -3,-12 0,-12 C 3,-12 6,-11 6,-8 C 6,-5 4,-5 4,-2 C 4,1 8,2 8,5 C 8,9 5,11 5,11 Z"
                      fill="#1e293b"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                      className="filter drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]"
                    />
                    <path d="M -2.5,-8 L 2.5,-8" stroke="#ef4444" strokeWidth="1" strokeLinecap="round" />
                  </g>
                )}
              </g>
            )
          })}

          {/* 4. Roads (Edges) */}
          {layout.edges.map(e => {
            const v1 = layout.vertices[e.vertices[0]]
            const v2 = layout.vertices[e.vertices[1]]
            const p1 = toPx(v1.x, v1.y)
            const p2 = toPx(v2.x, v2.y)

            const ownerId = state.roads[e.id]
            const owner = ownerId ? state.players.find(p => p.id === ownerId) : null
            const isClickable = buildableEdges.includes(e.id)
            const isSelectedPending = roadBuildingActive && selectedRoads.includes(e.id)

            if (owner || isSelectedPending) {
              return (
                <g key={`road-${e.id}`}>
                  {/* Road Shadow/Border */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke="#1e293b"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Road Core (Wooden look) */}
                  <line
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={isSelectedPending ? '#e11d48' : owner!.color}
                    strokeWidth="5.2"
                    strokeLinecap="round"
                    className={`filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${isSelectedPending ? 'animate-pulse' : ''}`}
                  />
                </g>
              )
            }

            if (isClickable) {
              return (
                <line
                  key={`clickable-road-${e.id}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={curPlayer.color}
                  strokeWidth="4"
                  strokeDasharray="4,4"
                  className="cursor-pointer hover:stroke-white stroke-white/50 transition animate-pulse"
                  onClick={() => {
                    if (roadBuildingActive) {
                      if (selectedRoads.length === 0) {
                        setSelectedRoads([e.id])
                      } else {
                        act('playRoadBuilding', selectedRoads[0], e.id)
                        setRoadBuildingActive(false)
                        setSelectedRoads([])
                      }
                    } else {
                      act('placeRoad', e.id)
                    }
                  }}
                />
              )
            }

            return null
          })}

          {/* 5. Settlements / Cities (Vertices) */}
          {layout.vertices.map(v => {
            const pt = toPx(v.x, v.y)
            const building = state.settlements[v.id]
            const owner = building ? state.players.find(p => p.id === building.playerId) : null

            const isClickableBuild = buildableVertices.includes(v.id)
            const isClickableUpgrade = upgradeVertices.includes(v.id)

            if (owner && building) {
              return (
                <g
                  key={`building-${v.id}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  className="cursor-pointer"
                  onClick={() => isClickableUpgrade && act('upgradeToCity', v.id)}
                >
                  {building.type === 'city' ? (
                    /* 3D Wooden City Piece */
                    <g className="filter drop-shadow-[0_2.5px_4px_rgba(0,0,0,0.5)]">
                      {/* Left face */}
                      <path d="M -8,4 L -8,-1 L -4,-4 L 0,-1 L 0,4 Z" fill={owner.color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
                      {/* Right face (shaded) */}
                      <path d="M 0,-1 L 0,-6 L 6,-6 L 6,4 L 0,4 Z" fill={owner.color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
                      <path d="M 0,-1 L 0,-6 L 6,-6 L 6,4 L 0,4 Z" fill="rgba(0,0,0,0.22)" stroke="none" />
                    </g>
                  ) : (
                    /* 3D Wooden Settlement Piece */
                    <g className="filter drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)]">
                      {/* Left face */}
                      <path d="M -6,3 L -6,-2 L 0,-6 L 0,3 Z" fill={owner.color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
                      {/* Right face (shaded) */}
                      <path d="M 0,-6 L 6,-2 L 6,3 L 0,3 Z" fill={owner.color} stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
                      <path d="M 0,-6 L 6,-2 L 6,3 L 0,3 Z" fill="rgba(0,0,0,0.2)" stroke="none" />
                    </g>
                  )}
                </g>
              )
            }

            if (isClickableBuild) {
              return (
                <g key={`clickable-vertex-${v.id}`} transform={`translate(${pt.x}, ${pt.y})`} className="cursor-pointer">
                  {/* Flashing glow indicator */}
                  <circle
                    r="9"
                    fill="none"
                    stroke={curPlayer.color}
                    strokeWidth="1.5"
                    className="animate-ping"
                  />
                  {/* Solid building spot */}
                  <circle
                    r="5"
                    fill={curPlayer.color}
                    stroke="#fff"
                    strokeWidth="1.2"
                    onClick={() => act('placeSettlement', v.id)}
                  />
                </g>
              )
            }

            if (isClickableUpgrade) {
              return (
                <circle
                  key={`upgrade-vertex-${v.id}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="9"
                  fill="none"
                  stroke={curPlayer.color}
                  strokeWidth="2.5"
                  strokeDasharray="2,2"
                  className="cursor-pointer animate-spin"
                  onClick={() => act('upgradeToCity', v.id)}
                />
              )
            }

            return null
          })}
        </svg>
      </div>

      {/* COLUMN 2: ACTIVE TURN & CONTEXT CONTROLS */}
      <div className="flex flex-col flex-1 min-w-[220px] max-w-[280px] gap-3 overflow-hidden justify-between py-2">
        {/* Turn HUD Panel */}
        <div className="bg-slate-900/60 backdrop-blur-lg border border-white/10 rounded-2xl p-4 flex flex-col gap-3 relative shadow-xl overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-pink-500/10 to-transparent rounded-full filter blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-3">
            <motion.div
              className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg border-2"
              style={{ backgroundColor: curPlayer.color, borderColor: 'rgba(255,255,255,0.4)' }}
              animate={{ boxShadow: [`0 0 0px ${curPlayer.color}`, `0 0 16px ${curPlayer.color}66`, `0 0 0px ${curPlayer.color}`] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {curPlayer.token}
            </motion.div>
            <div className="flex-1 min-w-0">
              <span className="text-[8px] font-black uppercase text-pink-400 tracking-widest font-mono">Current Player</span>
              <h3 className="text-sm font-black text-white truncate leading-tight mt-0.5">{curPlayer.name}</h3>
              <p className="text-[10px] text-yellow-400 font-mono mt-1 font-bold">VP: {curPlayer.victoryPoints}/10</p>
            </div>
            {curPlayer.isBot && (
              <span className="text-[7px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded font-black border border-pink-500/30">AI BOT</span>
            )}
          </div>

          <div className="border-t border-white/5 pt-2 text-center flex items-center justify-between px-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold font-mono">Phase:</span>
            <span className="text-[10px] text-pink-400 font-black uppercase tracking-wider font-mono">{state.phase}</span>
          </div>
        </div>

        {/* Phase Context details */}
        <div className="flex-1 flex flex-col justify-center min-h-[160px]">
          <AnimatePresence mode="wait">
            
            {/* Setup placement directions */}
            {(state.phase === 'SETUP_1' || state.phase === 'SETUP_2') && (
              <motion.div
                key="setup-context"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl text-center shadow-lg flex flex-col gap-2.5"
              >
                <Hammer className="w-8 h-8 text-pink-400 mx-auto animate-bounce" />
                <h4 className="text-[9px] text-slate-400 uppercase tracking-widest font-black font-mono">Lobby Setup Placement</h4>
                <p className="text-xs text-white leading-relaxed font-sans">
                  {isMyTurn ? (
                    "Place your settlement and road on the board. Vertex rings highlight valid locations."
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
                className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl text-center shadow-lg flex flex-col gap-3"
              >
                <div className="flex justify-center gap-4 py-2">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg border-2 border-slate-300">
                    {state.dice[0]}
                  </div>
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg border-2 border-slate-300">
                    {state.dice[1]}
                  </div>
                </div>
                
                {isMyTurn && !curPlayer.isBot ? (
                  <button
                    onClick={handleRollDice}
                    disabled={isRolling}
                    className="py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-slate-950 font-black text-xs uppercase rounded-xl tracking-wider shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Dices className="w-4 h-4" /> Roll Dice
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 italic">Waiting for roll...</p>
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
                className="bg-slate-900/95 border border-red-500/25 p-4 rounded-2xl text-center shadow-2xl flex flex-col gap-3"
              >
                <ShieldAlert className="w-8 h-8 text-red-500 mx-auto" />
                <h3 className="text-xs font-black uppercase text-red-400 tracking-wider">💳 Discard Required!</h3>
                <p className="text-[10px] text-slate-400">
                  You have more than 7 cards and must discard exactly <strong className="text-yellow-400 font-mono text-sm">{discardTarget}</strong> resources.
                </p>

                {botNeedsDiscard ? (
                  <div className="space-y-2.5">
                    {/* Discard resource selectors */}
                    <div className="grid grid-cols-5 gap-1.5 bg-slate-950 p-2 rounded-xl">
                      {RESOURCES.map(r => (
                        <div key={r} className="flex flex-col items-center">
                          <span className="text-sm">{RESOURCE_ICONS[r]}</span>
                          <span className="text-[9px] font-mono text-yellow-400 font-bold mt-1">({giveRes[r]})</span>
                          <div className="flex flex-col gap-1 mt-1">
                            <button
                              disabled={giveRes[r] >= curPlayer.resources[r]}
                              onClick={() => handleModifyGive(r, 1)}
                              className="w-4 h-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded flex items-center justify-center text-[10px]"
                            >
                              +
                            </button>
                            <button
                              disabled={giveRes[r] <= 0}
                              onClick={() => handleModifyGive(r, -1)}
                              className="w-4 h-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded flex items-center justify-center text-[10px]"
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
                  <span className="text-[9px] text-slate-500 italic">Waiting for other players to discard...</span>
                )}
              </motion.div>
            )}

            {/* Robber Move */}
            {state.phase === 'ROBBER_MOVE' && (
              <motion.div
                key="robber-move"
                className="bg-slate-900/80 border border-yellow-500/20 p-4 rounded-2xl text-center shadow-lg flex flex-col gap-2"
              >
                <div className="text-lg">🕵️</div>
                <h4 className="text-xs font-black uppercase text-yellow-500 tracking-wider">Move Robber</h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  {isMyTurn ? "Select a different hexagon tile on the board map to place the robber." : "Opponent placing Robber..."}
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
                <div className="bg-slate-900/60 p-3 rounded-2xl border border-white/10 flex flex-col gap-2.5">
                  <h4 className="text-[9px] text-slate-400 font-bold font-mono uppercase tracking-wider mb-0.5">Construction Mode</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'ROAD' ? 'NONE' : 'ROAD')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'ROAD' ? 'bg-pink-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}
                    >
                      🛣️ Road (1w/1b)
                    </button>
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'SETTLEMENT' ? 'NONE' : 'SETTLEMENT')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'SETTLEMENT' ? 'bg-pink-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}
                    >
                      🏠 Settl. (1w/1b/1s/1wh)
                    </button>
                    <button
                      onClick={() => setBuildMode(selectedBuildMode === 'CITY' ? 'NONE' : 'CITY')}
                      className={`py-2 text-[10px] uppercase font-bold rounded-xl transition ${selectedBuildMode === 'CITY' ? 'bg-pink-500 text-slate-950 font-black' : 'bg-slate-800 text-slate-300'}`}
                    >
                      🏰 City (3o/2wh)
                    </button>
                    <button
                      onClick={() => act('buyDevCard')}
                      className="py-2 text-[10px] uppercase font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl"
                    >
                      🃏 Buy Dev (1o/1s/1wh)
                    </button>
                  </div>
                  {selectedBuildMode !== 'NONE' && (
                    <div className="text-[8.5px] text-yellow-500 text-center font-bold font-mono animate-pulse">
                      * CLICK TARGET ON MAP TO PLACE BUILD *
                    </div>
                  )}
                </div>

                <button
                  onClick={() => act('endTurn')}
                  className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  End Turn <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Default waiting */}
            {state.phase === 'MAIN' && (!isMyTurn || curPlayer.isBot) && (
              <motion.div
                key="waiting"
                className="text-center py-4 flex flex-col items-center gap-2 bg-slate-900/30 rounded-2xl border border-white/5"
              >
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-pink-500 animate-spin" />
                <span className="text-[10px] text-slate-500 italic">Waiting for opponent turn actions...</span>
              </motion.div>
            )}

            {/* Game Over */}
            {state.phase === 'GAME_OVER' && (
              <motion.div
                key="game-over"
                className="bg-slate-900 border border-yellow-500/20 p-5 rounded-2xl text-center shadow-2xl flex flex-col gap-3"
              >
                <Award className="w-10 h-10 text-yellow-400 mx-auto" />
                <h3 className="text-lg font-black text-yellow-400 uppercase tracking-widest font-mono">Completed!</h3>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  👑 <strong>{state.players.find(p => p.id === state.winnerId)?.name}</strong> won Hexland!
                </p>
                <button
                  onClick={() => {
                    const next = catanEngine.initializeGame(state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })))
                    onStateChange(next)
                    onBroadcastAction?.('sync_state', next)
                  }}
                  className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  Start new match
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* COLUMN 3: STANDINGS & UTILITIES TABS */}
      <div className="flex flex-col w-64 gap-2 overflow-hidden flex-shrink-0 py-2">
        <div className="flex border-b border-white/10 pb-2 gap-1 flex-shrink-0">
          {(['HUD', 'BUILD', 'TRADE', 'DEV'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-[9px] font-black uppercase tracking-wider transition rounded-xl ${
                activeTab === tab ? 'text-pink-400 bg-pink-500/10 border border-pink-500/20' : 'text-slate-500 hover:text-slate-300'
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
                      isCurrent ? 'bg-white/10 border-white/20 shadow-lg' : 'bg-slate-900/40 border-white/5'
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
                          {p.isBot && <span className="text-[6px] text-slate-500 font-bold">BOT</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right flex-shrink-0 font-mono">
                      <span className="text-[10px] text-yellow-400 font-bold">VP: {p.victoryPoints}</span>
                      <span className="text-[8px] text-slate-500">Cards: {Object.values(p.resources).reduce((a,b)=>a+b, 0)}</span>
                    </div>
                  </div>
                )
              })}

              {state.players.length < 4 && (
                <button
                  onClick={handleAddBot}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-slate-400 hover:text-white rounded-xl text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5 text-pink-400" /> Add Hexland Bot
                </button>
              )}
            </div>

            {/* Broadcast Log */}
            <div className="flex-1 flex flex-col bg-slate-950 border border-white/10 rounded-2xl p-3 overflow-hidden min-h-0">
              <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5 flex-shrink-0 border-b border-white/5 pb-1">
                <FileText className="w-3.5 h-3.5 text-pink-400" /> Hexland Game Log
              </h4>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 min-h-0 scrollbar-thin">
                {state.log.map((msg, i) => (
                  <div key={i} className="text-[9px] text-slate-400 py-1 border-b border-white/5 leading-relaxed font-mono">
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
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">My Hand Inventory</h4>
            <div className="grid grid-cols-1 gap-2">
              {RESOURCES.map(r => {
                const count = state.players.find(p => p.id === currentPlayerId)?.resources[r] || 0
                return (
                  <div key={r} className="flex justify-between items-center bg-slate-900/40 border border-white/5 px-3 py-2 rounded-xl">
                    <span className="text-xs flex items-center gap-2">
                      <span className="text-base">{RESOURCE_ICONS[r]}</span>
                      <strong>{r}</strong>
                    </span>
                    <span className="text-sm font-mono font-bold text-yellow-400 bg-slate-950/60 px-2 py-0.5 rounded-lg border border-white/5">
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
            
            {/* Maritime Trade panel */}
            <div className="bg-slate-900/30 border border-white/5 p-3 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase text-pink-400 tracking-wider mb-2 flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" /> Maritime Exchange
              </h4>
              <p className="text-[8.5px] text-slate-500 mb-3 leading-normal">
                Trade matching resources directly with Bank. Rates auto calculate based on harbor ownership.
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {RESOURCES.map(give => {
                  const rate = getMaritimeRate(give)
                  const hasEnough = (state.players.find(p => p.id === currentPlayerId)?.resources[give] || 0) >= rate
                  return (
                    <div key={give} className="flex flex-col gap-1 bg-slate-950 p-2 rounded-xl border border-white/5">
                      <div className="flex justify-between items-center text-[10px]">
                        <span>Give {rate} {RESOURCE_ICONS[give]}</span>
                      </div>
                      <select
                        disabled={!hasEnough || !isMyTurn || state.phase !== 'MAIN'}
                        onChange={(e) => {
                          const get = e.target.value as ResourceType
                          if (get) act('maritimeTrade', give, get)
                          e.target.value = ""
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-white focus:outline-none focus:border-pink-500"
                      >
                        <option value="">Trade Rate: {rate}:1</option>
                        {RESOURCES.filter(x => x !== give).map(get => (
                          <option key={get} value={get}>Get 1 {RESOURCE_ICONS[get]} {get}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Domestic Player Trading */}
            <div className="bg-slate-900/30 border border-white/5 p-3 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase text-pink-400 tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Propose Player Trade
              </h4>
              
              <div className="space-y-3">
                {/* Select Player target */}
                <div>
                  <select
                    value={tradeTargetId}
                    onChange={(e) => setTradeTarget(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-xs text-white"
                  >
                    <option value="">Select Opponent...</option>
                    {state.players.filter(p => p.id !== currentPlayerId).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Offer Input selectors */}
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-[9px] text-pink-400 uppercase font-black tracking-wider block mb-1.5">You Offer</span>
                    {RESOURCES.map(r => (
                      <div key={r} className="flex items-center justify-between text-[10px] mb-1">
                        <span>{RESOURCE_ICONS[r]} ({giveRes[r]})</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleModifyGive(r, 1)}
                            className="px-1.5 bg-slate-800 rounded font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleModifyGive(r, -1)}
                            className="px-1.5 bg-slate-800 rounded font-bold"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <span className="text-[9px] text-cyan-400 uppercase font-black tracking-wider block mb-1.5">You Request</span>
                    {RESOURCES.map(r => (
                      <div key={r} className="flex items-center justify-between text-[10px] mb-1">
                        <span>{RESOURCE_ICONS[r]} ({reqRes[r]})</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleModifyReq(r, 1)}
                            className="px-1.5 bg-slate-800 rounded font-bold"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleModifyReq(r, -1)}
                            className="px-1.5 bg-slate-800 rounded font-bold"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  disabled={!tradeTargetId || !isMyTurn || state.phase !== 'MAIN'}
                  onClick={triggerDomesticTrade}
                  className="w-full py-2 bg-gradient-to-r from-pink-500 to-rose-500 disabled:opacity-40 text-slate-950 font-black text-[10px] uppercase rounded-xl transition shadow-lg"
                >
                  Send Trade Proposal
                </button>
              </div>
            </div>

          </div>
        )}

        {/* DEVELOPMENT CARDS TAB */}
        {activeTab === 'DEV' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">My Development Deck</h4>
            {(() => {
              const myDevs = state.players.find(p => p.id === currentPlayerId)?.devCards
              if (!myDevs) return null

              const list = Object.entries(myDevs).filter(([, count]) => count > 0)
              if (list.length === 0) return (
                <div className="text-center py-12 text-slate-600 text-xs italic bg-slate-950 rounded-2xl border border-white/5 px-4">
                  No development cards purchased yet.
                </div>
              )

              return list.map(([type, count]) => {
                const DEV_LABELS: Record<string, string> = { KNIGHT: 'Knight', ROAD_BUILDING: 'Road Building', YEAR_OF_PLENTY: 'Year of Plenty', MONOPOLY: 'Embargo', VICTORY_POINT: 'Victory Point' }
                const cardName = DEV_LABELS[type] || type.replace('_', ' ')
                return (
                  <div key={type} className="flex justify-between items-center bg-slate-900/40 border border-white/5 px-3 py-2 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold capitalize">{cardName}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Quantity: {count}</span>
                    </div>
                    {isMyTurn && state.phase === 'MAIN' && !state.playedDevCardThisTurn && type !== 'VICTORY_POINT' && (
                      <button
                        onClick={() => playDevCard(type as DevCardType)}
                        className="px-2.5 py-1 bg-pink-500/20 hover:bg-pink-500/35 text-pink-300 text-[9px] font-black rounded uppercase tracking-wider transition"
                      >
                        Play
                      </button>
                    )}
                  </div>
                )
              })
            })()}
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
              className="bg-slate-900 border border-pink-500/30 rounded-2xl p-5 shadow-2xl max-w-sm w-full"
            >
              <h3 className="text-sm font-black uppercase text-pink-400 tracking-wider mb-2 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 animate-pulse" /> Incoming Trade Offer
              </h3>
              <p className="text-[10px] text-slate-300 mb-3">
                {getPlayerName(state, state.tradeOffer.senderId)} proposed a deal!
              </p>
              
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl mb-4 border border-white/5 text-[10px]">
                <div>
                  <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">They Give</span>
                  {RESOURCES.map(r => state.tradeOffer!.senderOffer[r] > 0 ? (
                    <span key={r} className="block text-white mb-0.5">
                      {RESOURCE_ICONS[r]} {state.tradeOffer!.senderOffer[r]} {r}
                    </span>
                  ) : null)}
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">They Request</span>
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
                  className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
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
              className="bg-slate-900 border border-yellow-500/20 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
            >
              <h3 className="text-sm font-black uppercase text-yellow-500 tracking-wider mb-2">🕵️ Robber Steal Choice</h3>
              <p className="text-xs text-slate-300 mb-4 leading-normal">
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
                      className="py-2.5 bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold uppercase rounded-xl transition"
                    >
                      Steal from {name}
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowSteal(false)}
                  className="py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded-xl mt-1"
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
              className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
            >
              <h3 className="text-sm font-black uppercase text-pink-400 tracking-wider mb-2">🃏 Year of Plenty</h3>
              <p className="text-xs text-slate-300 mb-4 leading-normal">
                Select exactly 2 resource cards to receive from the bank for free.
              </p>

              {/* Selected Cards Display */}
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1].map(idx => {
                  const res = yopSelections[idx];
                  return (
                    <div
                      key={idx}
                      className="w-14 h-14 bg-slate-950 border border-white/10 rounded-xl flex flex-col items-center justify-center text-xs font-bold"
                    >
                      {res ? (
                        <>
                          <span className="text-lg">{RESOURCE_ICONS[res]}</span>
                          <span className="text-[9px] text-slate-400">{res}</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-600">Select...</span>
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
                    className="p-2 bg-slate-800 hover:bg-slate-750 active:scale-95 border border-white/5 rounded-xl flex flex-col items-center justify-center transition"
                  >
                    <span className="text-lg">{RESOURCE_ICONS[r]}</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">{r}</span>
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
                  className="flex-1 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  Claim Resources
                </button>
                <button
                  onClick={() => setShowYearOfPlentyDialog(false)}
                  className="py-2.5 px-4 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold uppercase rounded-xl transition"
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
              className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl max-w-sm w-full text-center"
            >
              <h3 className="text-sm font-black uppercase text-pink-400 tracking-wider mb-2">🃏 Embargo</h3>
              <p className="text-xs text-slate-300 mb-4 leading-normal">
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
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-750 hover:border-pink-500/30 active:scale-98 border border-white/5 rounded-xl flex items-center justify-between transition"
                  >
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="text-lg">{RESOURCE_ICONS[r]}</span> {r}
                    </span>
                    <span className="text-[9px] text-pink-400 font-extrabold uppercase tracking-widest">Select</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowMonopolyDialog(false)}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold uppercase rounded-xl transition"
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
