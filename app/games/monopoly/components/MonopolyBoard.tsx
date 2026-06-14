// Main Monopoly Board UI Component — Full Premium Overhaul
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import * as monopolyEngine from "../lib/monopolyEngine"
import {
  Space,
  Player,
  MonopolyState,
  BOARD_SPACES,
  calculateRent,
  isColorSetOwnedBy,
  getPlayerName
} from "../lib/monopolyEngine"
import { DiceRoll } from "./DiceRoll"
import { PropertyCardView } from "./PropertyCardView"
import { TradeDialog } from "./TradeDialog"
import { PropertyGroupIllustration } from "./PropertyGroupIllustration"
import {
  Dices, Home, Shield, RotateCcw, AlertTriangle,
  Gift, Trash, HeartHandshake, UserPlus, FileText, ChevronRight,
  Trophy, Zap, Train, HelpCircle, DollarSign, ParkingCircle,
  Lock, ArrowRightToLine, Landmark
} from "lucide-react"

interface MonopolyBoardProps {
  state: MonopolyState
  currentPlayerId: string
  onStateChange: (newState: MonopolyState) => void
  onBroadcastAction?: (action: string, payload: any) => void
}

const GROUP_COLORS: Record<string, string> = {
  BROWN:      '#92400e',
  LIGHT_BLUE: '#0ea5e9',
  PINK:       '#ec4899',
  ORANGE:     '#f97316',
  RED:        '#ef4444',
  YELLOW:     '#eab308',
  GREEN:      '#22c55e',
  DARK_BLUE:  '#1d4ed8',
  RAILROAD:   '#a8a29e',
  UTILITY:    '#818cf8',
}

const GROUP_ICONS: Record<string, string> = {
  BROWN:      '🏚',
  LIGHT_BLUE: '🌊',
  PINK:       '🌸',
  ORANGE:     '🍊',
  RED:        '🔥',
  YELLOW:     '⭐',
  GREEN:      '🌿',
  DARK_BLUE:  '💎',
  RAILROAD:   '🚂',
  UTILITY:    '⚡',
  SPECIAL:    '',
}

function getBandSide(index: number): 'bottom' | 'left' | 'top' | 'right' | null {
  if (index === 0 || index === 10 || index === 20 || index === 30) return null
  if (index > 0  && index < 10)  return 'bottom'
  if (index > 10 && index < 20)  return 'left'
  if (index > 20 && index < 30)  return 'top'
  if (index > 30 && index < 40)  return 'right'
  return null
}

function getSpaceGridCoords(index: number) {
  if (index === 0)  return { row: 11, col: 11 }
  if (index > 0  && index < 10)  return { row: 11, col: 11 - index }
  if (index === 10) return { row: 11, col: 1 }
  if (index > 10 && index < 20)  return { row: 11 - (index - 10), col: 1 }
  if (index === 20) return { row: 1, col: 1 }
  if (index > 20 && index < 30)  return { row: 1, col: index - 19 }
  if (index === 30) return { row: 1, col: 11 }
  return { row: index - 29, col: 11 }
}

function CornerSpace({ space, playersOn }: { space: Space; playersOn: Player[] }) {
  const icons: Record<string, JSX.Element> = {
    START: (
      <div className="flex flex-col items-center justify-center h-full gap-0.5 select-none">
        <span className="text-[7px] font-black text-[#1b1b1b] uppercase tracking-wider">Collect</span>
        <span className="text-[10px] font-black text-[#1b1b1b]">$200</span>
        <ArrowRightToLine className="w-3.5 h-3.5 text-red-600 rotate-90" />
        <span className="text-[11px] font-black text-red-600 tracking-wider uppercase">GO</span>
      </div>
    ),
    JAIL: (
      <div className="relative w-full h-full flex items-center justify-center bg-[#f0a83c] p-1">
        <div className="absolute top-0 right-0 left-0 bottom-0 border-2 border-[#1b1b1b]/70 m-0.5 rounded flex flex-col items-center justify-center gap-0.5 bg-[#f7f2e4]">
          <Lock className="w-3.5 h-3.5 text-[#1b1b1b]" />
          <span className="text-[7px] font-black text-[#1b1b1b] uppercase tracking-widest leading-none">JAIL</span>
        </div>
        <div className="absolute bottom-0.5 left-0.5 text-[6px] text-red-600 font-bold uppercase tracking-tighter rotate-45 pointer-events-none">Visiting</div>
      </div>
    ),
    FREE_PARKING: (
      <div className="flex flex-col items-center justify-center h-full gap-0.5">
        <span className="text-base leading-none">🚗</span>
        <span className="text-[7px] font-black text-red-600 uppercase tracking-wider text-center leading-none">Free<br/>Parking</span>
      </div>
    ),
    GO_TO_JAIL: (
      <div className="flex flex-col items-center justify-center h-full gap-0.5">
        <span className="text-sm">👮</span>
        <span className="text-[7px] font-black text-red-600 uppercase tracking-wider text-center leading-none">Go To<br/>Jail</span>
      </div>
    ),
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-[#f7f2e4] border border-black/30 select-none shadow-md">
      {icons[space.type] || <span className="text-[#1b1b1b] text-[9px]">{space.name}</span>}
      
      {/* Player tokens inside space */}
      <div className="absolute inset-0 flex items-center justify-center p-1 gap-1 flex-wrap pointer-events-none">
        {playersOn.map(p => (
          <motion.div
            key={p.id}
            layoutId={`token-${p.id}`}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            className="w-4 h-4 rounded-full border border-white/80 shadow-md z-30 flex items-center justify-center text-[10px] select-none pointer-events-auto bg-slate-900 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
            style={{ borderColor: p.color }}
            title={p.name}
          >
            {p.token}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function BoardSpace({
  space, propState, owner, playersOn, onClick
}: {
  space: Space
  propState: any
  owner: Player | null
  playersOn: Player[]
  onClick: () => void
}) {
  const bandSide = getBandSide(space.index)
  const bandColor = GROUP_COLORS[space.group] || 'transparent'

  const bandStyle: React.CSSProperties = bandSide ? {
    [`border${bandSide.charAt(0).toUpperCase() + bandSide.slice(1)}`]: `6px solid ${bandColor}`,
  } : {}

  const backgroundStyle = owner
    ? { backgroundColor: `${owner.color}30` } // light color overlay on cream
    : {}

  let specialIcon: string | null = null
  if (space.type === 'CHANCE')          specialIcon = '❓'
  if (space.type === 'COMMUNITY_CHEST') specialIcon = '📦'
  if (space.type === 'TAX')             specialIcon = '💸'
  if (space.type === 'RAILROAD')        specialIcon = '🚂'
  if (space.type === 'UTILITY')         specialIcon = space.name.includes('Electric') ? '⚡' : '💧'

  return (
    <div
      onClick={onClick}
      className="relative w-full h-full cursor-pointer transition-all duration-150 hover:bg-[#efe8d4] bg-[#f7f2e4] border border-black/20 overflow-hidden flex flex-col justify-between select-none"
      style={{ ...bandStyle, ...backgroundStyle }}
    >
      <div className="w-full h-full flex flex-col justify-between p-1.5 relative">
        {/* Name */}
        <span
          className="text-[6.5px] leading-tight font-extrabold text-[#1b1b1b] truncate"
          style={{ color: owner ? owner.color : undefined }}
        >
          {space.name.replace(' Avenue', ' Ave').replace(' Railroad', ' RR').replace('Community Chest', 'Comm. Chest')}
        </span>

        {/* Middle illustration */}
        <div className="flex-1 flex items-center justify-center my-0.5">
          {specialIcon ? (
            <span className="text-[12px] filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{specialIcon}</span>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center opacity-70">
              <PropertyGroupIllustration group={space.group} name={space.name} mini={true} />
            </div>
          )}
        </div>

        {/* Cost */}
        {space.cost && (
          <span className="text-[6px] text-[#1b1b1b] font-mono font-bold text-center">
            ${space.cost}
          </span>
        )}

        {/* Houses */}
        {propState?.houses > 0 && (
          <div className="absolute top-1 right-1 flex gap-[2px]">
            {propState.houses === 5 ? (
              <div className="w-2.5 h-2.5 bg-red-500 rounded-sm border border-red-300/30 shadow-sm shadow-red-500/40" title="Hotel" />
            ) : (
              Array.from({ length: propState.houses }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full border border-emerald-200/30 shadow-sm shadow-emerald-500/20" />
              ))
            )}
          </div>
        )}

        {/* Mortgaged */}
        {propState?.isMortgaged && (
          <div className="absolute inset-0 bg-red-950/75 flex items-center justify-center backdrop-blur-[1px]">
            <span className="text-[6px] text-red-400 font-black tracking-widest rotate-12 border border-red-500/40 px-1 bg-slate-950/90 rounded shadow-md">MORTGAGED</span>
          </div>
        )}

        {/* Owner status */}
        {owner && !propState?.isMortgaged && (
          <div
            className="absolute bottom-1 right-1 w-2 h-2 rounded-full border border-white/50 shadow-inner shadow-black/40"
            style={{ backgroundColor: owner.color }}
            title={`Owned by ${owner.name}`}
          />
        )}
      </div>

      {/* Players */}
      {playersOn.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 pointer-events-none flex-wrap p-1">
          {playersOn.map(p => (
            <motion.div
              key={p.id}
              layoutId={`token-${p.id}`}
              transition={{ type: 'spring', stiffness: 120, damping: 14 }}
              className="w-4 h-4 rounded-full border border-white/80 shadow-md z-30 flex items-center justify-center text-[10px] select-none pointer-events-auto bg-slate-900 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              style={{ borderColor: p.color }}
              title={p.name}
            >
              {p.token}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MonopolyBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: MonopolyBoardProps) {
  const [isRolling, setIsRolling]         = useState(false)
  const [selectedSpaceIndex, setSelected] = useState<number | null>(null)
  const [showTradeDialog, setShowTrade]   = useState(false)
  const [activeTab, setActiveTab]         = useState<'HUD' | 'PROPS'>('HUD')
  const [showCardDraw, setShowCardDraw]   = useState(false)
  const [dismissedCardText, setDismissedCardText] = useState<string | null>(null)
  const [customBidVal, setCustomBidVal]   = useState("")

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log])

  const curPlayer = state.players[state.currentPlayerIndex]
  const isMyTurn  = curPlayer.id === currentPlayerId

  // Show card draw overlay when state changes and contains a card draw
  useEffect(() => {
    if (state.lastCardDrawn) {
      setShowCardDraw(true)
      // If it is a bot's card draw, auto close after 2.5 seconds
      if (curPlayer.isBot) {
        const timer = setTimeout(() => {
          setShowCardDraw(false)
        }, 2500)
        return () => clearTimeout(timer)
      }
    } else {
      setShowCardDraw(false)
    }
  }, [state.lastCardDrawn, curPlayer.isBot])

  // Bot auto-play loop with doubles and auction handling
  useEffect(() => {
    if (state.winnerId || state.phase === 'GAME_OVER') return

    const isNormalBotTurn = curPlayer.isBot && state.phase !== 'AUCTION'
    
    const activeBidderId = state.auctionState?.activeBidderIds[state.auctionState.currentBidderIndex]
    const activeBidder = activeBidderId ? state.players.find(p => p.id === activeBidderId) : null
    const isBotAuctionTurn = state.phase === 'AUCTION' && activeBidder?.isBot

    if (isNormalBotTurn || isBotAuctionTurn) {
      const delay = state.lastCardDrawn ? 3000 : 1500
      const t = setTimeout(() => {
        if (isBotAuctionTurn) {
          const next = monopolyEngine.playBotAuction(state)
          onStateChange(next)
          onBroadcastAction?.('sync_state', next)
        } else {
          const next = monopolyEngine.playBotTurn(state)
          onStateChange(next)
          onBroadcastAction?.('sync_state', next)
        }
      }, delay)
      return () => clearTimeout(t)
    }
  }, [state.currentPlayerIndex, curPlayer.isBot, state.winnerId, state.phase, state.lastCardDrawn, state.auctionState])

  const handleRollDice = () => {
    if (isRolling || state.phase !== 'ROLL' || !isMyTurn) return
    setIsRolling(true)
    onBroadcastAction?.('dice_rolling', { playerId: currentPlayerId })
  }

  const handleRollComplete = useCallback(() => {
    setIsRolling(false)
    const next = monopolyEngine.rollDice(state)
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }, [state, onStateChange, onBroadcastAction])

  const act = (name: string, ...args: any[]) => {
    const fn = (monopolyEngine as any)[name]
    if (fn) {
      const next = fn(state, ...args)
      onStateChange(next)
      onBroadcastAction?.('sync_state', next)
    }
  }

  const handleAddBot = () => {
    if (state.players.length >= 6) return
    const names = ['Mr. Mogul', 'Tycoon Bot', 'Richie Rich', 'Goldman AI', 'Capitalist']
    const used  = state.players.map(p => p.name)
    const name  = names.find(n => !used.includes(n)) || `Bot ${state.players.length + 1}`
    const players = [...state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })),
                     { id: `bot-${Date.now()}`, name, isBot: true }]
    const next = monopolyEngine.initializeGame(players)
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  const netWorth = (p: Player) => {
    let w = p.cash
    Object.entries(state.properties).forEach(([i, prop]) => {
      const sp = BOARD_SPACES[+i]
      if (prop.ownerId === p.id) {
        if (!prop.isMortgaged) w += sp.cost || 0
        w += prop.houses * (sp.houseCost || 0)
      }
    })
    return w
  }

  return (
    <div className="flex w-full h-full overflow-hidden bg-slate-950 select-none p-2 gap-3">

      {/* COLUMN 1: BOARD */}
      <div className="flex flex-col items-center justify-center p-1 bg-slate-900/40 rounded-2xl border border-white/5 shadow-2xl relative">
        <div
          className="grid grid-cols-11 grid-rows-11 gap-[1.5px] bg-[#0c0c0c] border-[6px] border-[#0c0c0c] rounded-xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          style={{ width: 'min(78vh, 700px)', height: 'min(78vh, 700px)' }}
        >
          {BOARD_SPACES.map(space => {
            const coords      = getSpaceGridCoords(space.index)
            const propState   = state.properties[space.index]
            const owner       = propState?.ownerId ? state.players.find(p => p.id === propState.ownerId) ?? null : null
            const playersOn   = state.players.filter(p => p.position === space.index && !p.isBankrupt)
            const isCorner    = [0, 10, 20, 30].includes(space.index)

            return (
              <div
                key={space.index}
                style={{ gridRow: coords.row, gridColumn: coords.col }}
                className="relative"
              >
                {isCorner ? (
                  <CornerSpace space={space} playersOn={playersOn} />
                ) : (
                  <BoardSpace
                    space={space}
                    propState={propState}
                    owner={owner}
                    playersOn={playersOn}
                    onClick={() => setSelected(space.index)}
                  />
                )}
              </div>
            )
          })}

          {/* Center Area */}
          <div
            className="relative overflow-hidden flex flex-col items-center justify-between bg-[#cfe6cb] rounded-lg border border-black/20 p-6"
            style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}
          >
            {/* Branding Logo */}
            <div className="rotate-[-10deg] text-center select-none pointer-events-none drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)] z-10 mt-2">
              <span className="block text-[8px] font-black uppercase tracking-widest text-red-700/70 font-mono mb-1">Classic Edition</span>
              <h2 className="text-2xl xl:text-3xl font-black text-white tracking-wider px-5 py-2 bg-[#e2362d] border-2 border-white rounded shadow-2xl uppercase font-serif -skew-x-6">
                PROPERTY EMPIRE
              </h2>
            </div>

            {/* Deck slots */}
            <div className="absolute inset-x-8 top-[38%] flex justify-between items-center opacity-90 pointer-events-none">
              <div className="w-16 h-24 bg-[#f4943f] border-2 border-[#1b1b1b]/40 rounded-lg rotate-12 flex flex-col items-center justify-center text-[#1b1b1b] shadow-lg">
                <span className="text-xl font-black">?</span>
                <span className="text-[7px] uppercase font-mono tracking-widest font-bold">Fortune</span>
              </div>
              <div className="w-16 h-24 bg-[#f6d35a] border-2 border-[#1b1b1b]/40 rounded-lg -rotate-12 flex flex-col items-center justify-center text-[#1b1b1b] shadow-lg">
                <span className="text-lg font-black">📦</span>
                <span className="text-[7px] uppercase font-mono tracking-widest font-bold text-center leading-tight">Treasury</span>
              </div>
            </div>

            {/* Rent notification banner */}
            <AnimatePresence>
              {state.lastRentPaid && (
                <motion.div
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.9 }}
                  className="absolute top-[28%] z-40 bg-red-950/90 border border-red-500/30 text-white font-mono text-[9px] px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 backdrop-blur-md"
                >
                  <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                  <span>
                    <strong>{state.lastRentPaid.from}</strong> paid <strong>${state.lastRentPaid.amount}</strong> rent to <strong>{state.lastRentPaid.to}</strong> on {state.lastRentPaid.propertyName}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Central Controls: Dice and Actions */}
            <div className="w-full flex flex-col items-center justify-center z-30 pt-6">
              <DiceRoll
                dice={state.lastDice}
                isRolling={isRolling}
                playerColor={curPlayer.color}
                onRollComplete={handleRollComplete}
              />

              {state.phase === 'ROLL' && !curPlayer.inJail && isMyTurn && !curPlayer.isBot && !isRolling && (
                <motion.button
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  onClick={handleRollDice}
                  className="px-6 py-2.5 bg-gradient-to-r from-pink-500 via-rose-500 to-red-500 hover:from-pink-600 hover:to-rose-600 text-slate-950 font-black text-xs uppercase rounded-xl shadow-2xl tracking-widest transition duration-150 flex items-center gap-2 mt-2 border border-white/20 active:scale-95"
                >
                  <Dices className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} /> ROLL DICE
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* COLUMN 2: TURN & GAME ACTIONS (Glassmorphism panels) */}
      <div className="flex flex-col flex-1 min-w-[220px] max-w-[280px] gap-3 overflow-hidden justify-between py-2">
        
        {/* Active Player HUD panel */}
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
              <p className="text-xs text-yellow-400 font-mono font-bold mt-1">${curPlayer.cash} cash</p>
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

        {/* Phase-specific Context panels */}
        <div className="flex-1 flex flex-col justify-center min-h-[160px]">
          <AnimatePresence mode="wait">
            
            {/* Jail view */}
            {state.phase === 'ROLL' && curPlayer.inJail && isMyTurn && !curPlayer.isBot && (
              <motion.div
                key="jail-context"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900/80 border border-yellow-500/20 p-4 rounded-2xl flex flex-col gap-3 shadow-lg"
              >
                <div className="flex items-center gap-2 justify-center text-yellow-400 border border-yellow-500/20 rounded-xl bg-yellow-500/5 py-1.5 px-3">
                  <Lock className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-wider font-mono">In Jail · Turn {curPlayer.jailTurns + 1}/3</span>
                </div>
                
                <p className="text-[9px] text-slate-400 text-center leading-normal">
                  Roll doubles to escape for free, pay a $50 fine, or use a Get Out of Jail Card.
                </p>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  {curPlayer.getOutOfJailCards > 0 && (
                    <button
                      onClick={() => act('useJailCard')}
                      className="py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-[9px] font-black uppercase rounded-lg shadow-md transition active:scale-95"
                    >
                      Use Card
                    </button>
                  )}
                  <button
                    onClick={() => act('payJailFine')}
                    disabled={curPlayer.cash < 50}
                    className="py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[9px] font-black uppercase rounded-lg transition active:scale-95 flex items-center justify-center gap-1 border border-white/5"
                  >
                    Pay $50 Fine
                  </button>
                </div>
                <button
                  onClick={handleRollDice}
                  disabled={isRolling}
                  className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 text-[10px] font-black uppercase rounded-xl shadow-lg flex items-center justify-center gap-1.5 font-mono tracking-wider transition active:scale-95"
                >
                  <Dices className="w-4 h-4" /> Roll for Escape
                </button>
              </motion.div>
            )}

            {/* Buy property decision */}
            {state.phase === 'BUY_OR_PASS' && (
              <motion.div
                key="buy-context"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-slate-900/80 border border-white/10 p-4 rounded-2xl text-center shadow-lg flex flex-col gap-3 relative overflow-hidden"
              >
                <Landmark className="w-8 h-8 text-pink-400 mx-auto opacity-80" />
                <div>
                  <h4 className="text-[9px] text-slate-400 uppercase tracking-widest font-black font-mono">Buy space?</h4>
                  <p className="text-sm text-white font-black leading-tight mt-1 truncate">{BOARD_SPACES[curPlayer.position]?.name}</p>
                  <p className="text-base text-yellow-400 font-mono font-black mt-1">
                    ${BOARD_SPACES[curPlayer.position]?.cost}
                  </p>
                </div>

                {isMyTurn && !curPlayer.isBot ? (
                  <div className="flex gap-2.5 mt-1">
                    <button
                      onClick={() => act('buyProperty')}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs uppercase rounded-xl shadow-md transition active:scale-95"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => act('passProperty')}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs uppercase rounded-xl transition"
                    >
                      Pass
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Opponent deciding...</span>
                )}
              </motion.div>
            )}

            {/* Auction bidding UI */}
            {state.phase === 'AUCTION' && state.auctionState && (() => {
              const auc = state.auctionState;
              const space = BOARD_SPACES[auc.spaceIndex];
              const activeBidderId = auc.activeBidderIds[auc.currentBidderIndex];
              const activeBidder = state.players.find(p => p.id === activeBidderId)!;
              const isMyBidTurn = activeBidderId === currentPlayerId;

              return (
                <motion.div
                  key="auction-context"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-slate-900/95 border border-pink-500/30 p-4 rounded-2xl text-center shadow-2xl flex flex-col gap-3 relative overflow-hidden max-w-xs mx-auto"
                >
                  <Landmark className="w-8 h-8 text-pink-400 mx-auto animate-pulse" />
                  <div>
                    <h4 className="text-[9px] text-pink-400 uppercase tracking-widest font-black font-mono">🔨 Live Auction</h4>
                    <p className="text-xs text-white font-black leading-tight mt-1 truncate">{space.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">Value: ${space.cost}</p>
                  </div>

                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-white/5 font-mono">
                    <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Current Highest Bid</span>
                    {auc.highestBidderId ? (
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-yellow-400">${auc.highestBid}</span>
                        <span className="text-[8px] text-slate-300">by {getPlayerName(state, auc.highestBidderId)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic font-sans">No bids placed yet</span>
                    )}
                  </div>

                  <div className="text-[10px]">
                    {isMyBidTurn ? (
                      <div className="text-pink-300 font-bold animate-pulse">👉 Your turn to Bid! (Cash: ${activeBidder.cash})</div>
                    ) : (
                      <div className="text-slate-400 italic">Waiting for {activeBidder.name} to bid...</div>
                    )}
                  </div>

                  {isMyBidTurn && !activeBidder.isBot ? (
                    <div className="flex flex-col gap-2">
                      {/* Bid presets */}
                      <div className="flex gap-1">
                        {[1, 10, 50].map(incr => {
                          const bidAmt = auc.highestBid + incr;
                          const disabled = bidAmt > activeBidder.cash;
                          return (
                            <button
                              key={incr}
                              disabled={disabled}
                              onClick={() => {
                                act('bid', bidAmt);
                                setCustomBidVal("");
                              }}
                              className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-[9px] font-black uppercase rounded-lg border border-white/5 transition"
                            >
                              +${incr}
                            </button>
                          );
                        })}
                      </div>

                      {/* Custom bid */}
                      <div className="flex gap-1.5 mt-0.5">
                        <input
                          type="number"
                          placeholder="Custom bid..."
                          value={customBidVal}
                          onChange={(e) => setCustomBidVal(e.target.value)}
                          className="flex-1 min-w-0 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-pink-500 font-mono"
                        />
                        <button
                          onClick={() => {
                            const val = parseInt(customBidVal);
                            if (val > auc.highestBid && val <= activeBidder.cash) {
                              act('bid', val);
                              setCustomBidVal("");
                            }
                          }}
                          disabled={!customBidVal || parseInt(customBidVal) <= auc.highestBid || parseInt(customBidVal) > activeBidder.cash}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-45 text-slate-950 font-black text-xs uppercase rounded-lg shadow transition"
                        >
                          Bid
                        </button>
                      </div>

                      {/* Fold button */}
                      <button
                        onClick={() => {
                          act('fold');
                          setCustomBidVal("");
                        }}
                        className="w-full py-1.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 font-bold text-[9px] uppercase rounded-lg border border-red-500/20 transition mt-1"
                      >
                        Fold / Pass
                      </button>
                    </div>
                  ) : null}
                </motion.div>
              );
            })()}

            {/* Debt/Bankruptcy liquidator UI */}
            {state.phase === 'BANKRUPTCY' && (
              <motion.div
                key="bankruptcy-context"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-red-950/80 border-2 border-red-500/40 p-4 rounded-2xl text-center shadow-2xl flex flex-col gap-3"
              >
                <AlertTriangle className="w-7 h-7 text-red-500 mx-auto animate-bounce" />
                <div>
                  <h4 className="text-[9px] text-red-400 uppercase font-black tracking-widest font-mono">Debt Settlement</h4>
                  <p className="text-[10px] text-slate-200 mt-1.5 leading-relaxed">
                    Owes <span className="text-yellow-400 font-bold font-mono">${state.debtAmount}</span> to{' '}
                    <strong>{state.debtToPlayerId ? getPlayerName(state, state.debtToPlayerId) : 'the Bank'}</strong>.
                  </p>
                </div>

                {isMyTurn && !curPlayer.isBot ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <p className="text-[8px] text-slate-400 italic">
                      Sell houses or mortgage your properties from the "Estates" tab to raise cash. Debt will settle automatically.
                    </p>
                    <button
                      onClick={() => act('declareBankruptcy')}
                      className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-black text-[10px] uppercase rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition active:scale-95"
                    >
                      <Trash className="w-3.5 h-3.5" /> Declare Bankruptcy
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-red-300 italic">Opponent liquidating assets...</span>
                )}
              </motion.div>
            )}

            {/* Game Over screen */}
            {state.phase === 'GAME_OVER' && (
              <motion.div
                key="gameover-context"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900 border border-yellow-500/30 p-5 rounded-2xl text-center shadow-2xl flex flex-col gap-3 relative overflow-hidden"
              >
                <div className="absolute -top-12 -left-12 w-28 h-28 bg-yellow-500/10 rounded-full filter blur-2xl pointer-events-none" />
                <Trophy className="w-10 h-10 text-yellow-400 mx-auto animate-pulse" />
                <div>
                  <h3 className="text-lg font-black text-yellow-400 uppercase tracking-widest font-mono">Game Completed!</h3>
                  <p className="text-xs text-slate-300 mt-2 font-medium">
                    🏆 <strong>{state.players.find(p => p.id === state.winnerId)?.name}</strong> has bankrupt all opponents and conquered the board!
                  </p>
                </div>
                <button
                  onClick={() => {
                    const next = monopolyEngine.initializeGame(state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })))
                    onStateChange(next)
                    onBroadcastAction?.('sync_state', next)
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition active:scale-95"
                >
                  START NEW GAME
                </button>
              </motion.div>
            )}

            {/* Default waiting status */}
            {state.phase === 'ROLL' && !isMyTurn && (
              <motion.div
                key="waiting-context"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-4 flex flex-col items-center justify-center gap-2 border border-white/5 rounded-2xl bg-slate-900/30"
              >
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-pink-500 animate-spin" />
                <span className="text-[10px] text-slate-400 italic">
                  Waiting for {curPlayer.name} to roll...
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trade and end turn controls */}
        {isMyTurn && !curPlayer.isBot && state.phase === 'ROLL' && !isRolling && (
          <div className="flex gap-2.5 mt-auto bg-slate-900/60 p-2 border border-white/10 rounded-2xl">
            <button
              onClick={() => setShowTrade(true)}
              className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 border border-white/5 transition rounded-xl"
            >
              <HeartHandshake className="w-3.5 h-3.5 text-pink-400" /> Trade
            </button>
            <button
              onClick={() => act('endTurn')}
              className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 transition"
            >
              End Turn <ChevronRight className="w-3.5 h-3.5 text-pink-500" />
            </button>
          </div>
        )}
      </div>

      {/* COLUMN 3: SIDEBAR DETAILS (estates & stats) */}
      <div className="flex flex-col w-64 gap-2 overflow-hidden flex-shrink-0 py-2">
        
        {/* Navigation tabs */}
        <div className="flex border-b border-white/10 pb-2 gap-1 flex-shrink-0">
          {(['HUD', 'PROPS'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-2 text-[10px] font-black uppercase tracking-wider transition rounded-xl ${
                activeTab === tab ? 'text-pink-400 bg-pink-500/10 border border-pink-500/20' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab === 'HUD' ? '📊 Standings' : '🏠 Estates'}
            </button>
          ))}
        </div>

        {/* HUD STANDINGS TAB */}
        {activeTab === 'HUD' && (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
            {/* Player list */}
            <div className="space-y-2 overflow-y-auto flex-shrink-0 max-h-56 pr-0.5">
              {state.players.map(p => {
                const isCurrent = state.players[state.currentPlayerIndex].id === p.id
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl transition ${
                      p.isBankrupt ? 'opacity-30 bg-red-950/10 border border-red-950/20'
                      : isCurrent ? 'bg-white/10 border border-white/20 shadow-lg'
                      : 'bg-slate-900/40 border border-white/5'
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
                          {p.isBankrupt && <span className="text-[7px] bg-red-500/20 text-red-400 px-1 rounded font-bold">DEFEAT</span>}
                          {p.inJail && !p.isBankrupt && <span className="text-[7px] bg-yellow-500/20 text-yellow-400 px-1 rounded font-bold">JAIL</span>}
                          {p.isBot && <span className="text-[6px] text-slate-500 font-bold">BOT</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-right flex-shrink-0">
                      <span className="text-[10px] text-yellow-400 font-mono font-bold">${p.cash}</span>
                      <span className="text-[8px] text-slate-500 font-mono">Net: ${netWorth(p)}</span>
                    </div>
                  </div>
                )
              })}

              {state.players.length < 6 && (
                <button
                  onClick={handleAddBot}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-slate-400 hover:text-white rounded-xl text-[10px] uppercase font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5 text-pink-400" /> Add AI Bot
                </button>
              )}
            </div>

            {/* Action game log */}
            <div className="flex-1 flex flex-col bg-slate-950 border border-white/10 rounded-2xl p-3 overflow-hidden min-h-0">
              <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2 flex items-center gap-1.5 flex-shrink-0 border-b border-white/5 pb-1">
                <FileText className="w-3.5 h-3.5 text-pink-400" /> Broadcast Log
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

        {/* ESTATES TAB */}
        {activeTab === 'PROPS' && (
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0 scrollbar-thin">
            <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-1">My Owned Titles</h4>
            {(() => {
              const myProps = Object.entries(state.properties)
                .filter(([, s]) => s.ownerId === currentPlayerId)
                .map(([i]) => BOARD_SPACES[+i])

              if (myProps.length === 0) return (
                <div className="text-center py-12 text-slate-650 text-[10.5px] italic bg-slate-950 rounded-2xl border border-white/5 px-4">
                  No title deeds acquired yet.<br/>Spaces you land on can be purchased.
                </div>
              )

              return myProps.map(sp => {
                const prop = state.properties[sp.index]
                const setOwned = isColorSetOwnedBy(state, sp.group, currentPlayerId)
                const color = GROUP_COLORS[sp.group] || '#888'

                return (
                  <div
                    key={sp.index}
                    className="bg-slate-900/70 border border-white/5 p-3 rounded-xl transition duration-150 hover:border-white/10"
                    style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] text-white font-bold leading-tight truncate">{sp.name}</p>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {prop.houses === 5 ? '🏨 Hotel' : prop.houses > 0 ? `🟩 ${prop.houses} House${prop.houses > 1 ? 's' : ''}` : 'No buildings'}
                          {prop.isMortgaged ? ' · Mortgaged' : ` · $${calculateRent(state, sp.index)} rent`}
                        </p>
                      </div>
                      
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {!prop.isMortgaged ? (
                          <button
                            onClick={() => act('mortgageProperty', sp.index)}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-[9px] font-bold rounded"
                          >
                            Mortgage
                          </button>
                        ) : (
                          <button
                            onClick={() => act('unmortgageProperty', sp.index)}
                            className="px-2 py-0.5 bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 text-[9px] font-bold rounded"
                          >
                            Unmort.
                          </button>
                        )}

                        {sp.type === 'PROPERTY' && setOwned && !prop.isMortgaged && (
                          <div className="flex gap-1">
                            {prop.houses < 5 && (
                              <button
                                onClick={() => act('buildHouse', sp.index)}
                                className="px-1.5 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[9px] font-black rounded"
                                title="Build House"
                              >
                                +🏠
                              </button>
                            )}
                            {prop.houses > 0 && (
                              <button
                                onClick={() => act('sellHouse', sp.index)}
                                className="px-1.5 py-0.5 bg-red-500/20 hover:bg-red-500/35 text-red-300 text-[9px] font-black rounded"
                                title="Sell House"
                              >
                                -🏠
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        )}
      </div>

      {/* OVERLAYS / MODALS */}
      <AnimatePresence>
        
        {/* Info card display */}
        {selectedSpaceIndex !== null && (
          <PropertyCardView
            space={BOARD_SPACES[selectedSpaceIndex]}
            propertyState={state.properties[selectedSpaceIndex]}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Chance / Community Chest Card draw popup */}
        {showCardDraw && state.lastCardDrawn && (
          <PropertyCardView
            space={BOARD_SPACES[curPlayer.position]} // Correct space lookup using position
            isCardDraw={true}
            cardText={state.lastCardDrawn.text}
            cardType={state.lastCardDrawn.type}
            onClose={() => {
              setShowCardDraw(false)
              setDismissedCardText(state.lastCardDrawn?.text || null)
              // Clear card draw status after client closes to ensure game state sync
              if (isMyTurn && !curPlayer.isBot) {
                const updated = { ...state, lastCardDrawn: null }
                onStateChange(updated)
                onBroadcastAction?.('sync_state', updated)
              }
            }}
          />
        )}

        {/* Incoming trade dialog offer */}
        {state.tradeSession && state.tradeSession.receiverId === currentPlayerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-pink-500/30 rounded-2xl p-5 shadow-2xl max-w-sm w-full"
            >
              <h3 className="text-sm font-black uppercase text-pink-400 tracking-wider mb-2 flex items-center gap-2">
                <HeartHandshake className="w-5 h-5 animate-pulse" /> Incoming Trade Offer
              </h3>
              <p className="text-[10px] text-slate-300 mb-3">
                {getPlayerName(state, state.tradeSession.senderId)} proposed a deal!
              </p>
              
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl mb-4 border border-white/5">
                <div>
                  <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">They Offer</span>
                  <p className="text-xs text-yellow-400 font-mono font-black mb-1.5">${state.tradeSession.senderOffer.cash}</p>
                  {state.tradeSession.senderOffer.properties.map(i => (
                    <span key={i} className="block text-[9px] text-white bg-white/5 px-2 py-0.5 rounded mb-1 truncate border border-white/5">
                      🏠 {BOARD_SPACES[i].name}
                    </span>
                  ))}
                </div>
                <div>
                  <span className="text-[8px] text-slate-500 font-bold uppercase block mb-1">They Request</span>
                  <p className="text-xs text-yellow-400 font-mono font-black mb-1.5">${state.tradeSession.receiverOffer.cash}</p>
                  {state.tradeSession.receiverOffer.properties.map(i => (
                    <span key={i} className="block text-[9px] text-white bg-white/5 px-2 py-0.5 rounded mb-1 truncate border border-white/5">
                      🏠 {BOARD_SPACES[i].name}
                    </span>
                  ))}
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

        {/* Trade proposing dialog */}
        {showTradeDialog && (
          <TradeDialog
            players={state.players}
            currentPlayerId={currentPlayerId}
            properties={state.properties}
            onClose={() => setShowTrade(false)}
            onPropose={(receiverId, offerCash, offerProps, requestCash, requestProps) => {
              act('proposeTrade', receiverId, { cash: offerCash, properties: offerProps }, { cash: requestCash, properties: requestProps })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
