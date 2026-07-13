// Property Empire — board container. Renders the real-time 3D board (loaded
// client-only) plus the tycoon HUD: phase panels (jail, buy, auction, debt),
// trading, estates management, standings and a full-board victory screen.
// Every rule flows through the pure engine; dice are pre-computed on the
// roll click, tumbled in 3D, and committed the moment they settle.
"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import * as monopolyEngine from "../lib/monopolyEngine"
import {
  Player,
  MonopolyState,
  BOARD_SPACES,
  calculateRent,
  isColorSetOwnedBy,
  getPlayerName
} from "../lib/monopolyEngine"
import { PropertyCardView } from "./PropertyCardView"
import { TradeDialog } from "./TradeDialog"
import { Confetti } from "@/components/Confetti"
import {
  Dices, AlertTriangle, Trash, HeartHandshake, UserPlus, FileText, ChevronRight,
  Trophy, DollarSign, Lock, Landmark, Loader2, Crown, RotateCcw, Share2, Eye, LogOut,
} from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"

// The Three.js scene must never render on the server.
const EmpireScene3D = dynamic(() => import("./EmpireScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#120d08]">
      <div className="flex flex-col items-center gap-3 text-[#e6b45a]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Opening the board…</p>
      </div>
    </div>
  ),
})

interface MonopolyBoardProps {
  state: MonopolyState
  currentPlayerId: string
  onStateChange: (newState: MonopolyState) => void
  onBroadcastAction?: (action: string, payload: any) => void
}

const GROUP_COLORS: Record<string, string> = {
  BROWN: '#92400e', LIGHT_BLUE: '#0ea5e9', PINK: '#ec4899', ORANGE: '#f97316',
  RED: '#ef4444', YELLOW: '#eab308', GREEN: '#22c55e', DARK_BLUE: '#1d4ed8',
  RAILROAD: '#a8a29e', UTILITY: '#818cf8',
}

export default function MonopolyBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: MonopolyBoardProps) {
  const [selectedSpaceIndex, setSelected] = useState<number | null>(null)
  const [showTradeDialog, setShowTrade]   = useState(false)
  const [activeTab, setActiveTab]         = useState<'HUD' | 'PROPS'>('HUD')
  const [showCardDraw, setShowCardDraw]   = useState(false)
  const [customBidVal, setCustomBidVal]   = useState("")
  const [endDismissed, setEndDismissed]   = useState(false)
  // Pre-computed roll result: dice tumble in 3D, state commits on settle.
  const [pendingRoll, setPendingRoll]     = useState<MonopolyState | null>(null)
  const pendingRef = useRef<MonopolyState | null>(null)
  const rollBase = useRef<MonopolyState | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.log])

  const commit = (next: MonopolyState) => {
    onStateChange(next)
    onBroadcastAction?.('sync_state', next)
  }

  const seatIndex = state.players.findIndex(p => p.id === currentPlayerId)
  const isSpectator = seatIndex === -1
  const curPlayer = state.players[state.currentPlayerIndex]
  const isMyTurn  = !isSpectator && curPlayer.id === currentPlayerId
  const isRolling = !!pendingRoll
  const gameOver = state.phase === 'GAME_OVER' || !!state.winnerId

  useEffect(() => {
    if (!gameOver) setEndDismissed(false)
  }, [gameOver])

  // Show card draw overlay when state changes and contains a card draw
  useEffect(() => {
    if (state.lastCardDrawn) {
      setShowCardDraw(true)
      // If it is a bot's card draw, auto close after 2.5 seconds
      if (curPlayer.isBot) {
        const timer = setTimeout(() => setShowCardDraw(false), 2500)
        return () => clearTimeout(timer)
      }
    } else {
      setShowCardDraw(false)
    }
  }, [state.lastCardDrawn, curPlayer.isBot])

  // Bot auto-play loop with doubles and auction handling. Full-state deps so a
  // pending timer never fires against a stale snapshot; spectators never drive.
  useEffect(() => {
    if (state.winnerId || state.phase === 'GAME_OVER' || isSpectator || pendingRoll) return

    const isNormalBotTurn = curPlayer.isBot && state.phase !== 'AUCTION'
    const activeBidderId = state.auctionState?.activeBidderIds[state.auctionState.currentBidderIndex]
    const activeBidder = activeBidderId ? state.players.find(p => p.id === activeBidderId) : null
    const isBotAuctionTurn = state.phase === 'AUCTION' && activeBidder?.isBot

    if (isNormalBotTurn || isBotAuctionTurn) {
      const delay = state.lastCardDrawn ? 3000 : 1500
      const t = setTimeout(() => {
        commit(isBotAuctionTurn ? monopolyEngine.playBotAuction(state) : monopolyEngine.playBotTurn(state))
      }, delay)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, isSpectator, pendingRoll])

  // ---- Dice flow ---------------------------------------------------------------
  const handleRollDice = () => {
    if (isRolling || state.phase !== 'ROLL' || !isMyTurn || curPlayer.isBot) return
    onBroadcastAction?.('dice_rolling', { playerId: currentPlayerId })
    rollBase.current = state
    const next = monopolyEngine.rollDice(state)
    pendingRef.current = next
    setPendingRoll(next)
  }

  // Called by the scene when the dice settle AND by the fallback timer — the
  // ref makes it idempotent, and the commit happens outside any setState
  // updater (committing inside one is a setState-during-render violation).
  const settleRoll = () => {
    const pending = pendingRef.current
    if (!pending) return
    pendingRef.current = null
    setPendingRoll(null)
    // Commit only if nothing changed underneath the animation (remote sync).
    if (stateRef.current === rollBase.current) commit(pending)
  }

  // Safety net: the scene settles from its render loop, which browsers suspend
  // in hidden tabs — commit anyway so an alt-tabbed player never stalls.
  useEffect(() => {
    if (!pendingRoll) return
    const t = setTimeout(settleRoll, 2400)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRoll])

  const act = (name: string, ...args: any[]) => {
    const fn = (monopolyEngine as any)[name]
    if (fn) commit(fn(state, ...args))
  }

  const handleAddBot = () => {
    if (state.players.length >= 6) return
    const names = ['Mr. Mogul', 'Tycoon Bot', 'Richie Rich', 'Goldman AI', 'Capitalist']
    const used  = state.players.map(p => p.name)
    const name  = names.find(n => !used.includes(n)) || `Bot ${state.players.length + 1}`
    const players = [...state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot })),
                     { id: `bot-${Date.now()}`, name, isBot: true }]
    commit(monopolyEngine.initializeGame(players))
  }

  const handleRematch = () => {
    commit(monopolyEngine.initializeGame(state.players.map(p => ({ id: p.id, name: p.name, isBot: p.isBot }))))
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
    <div className="flex h-full w-full select-none overflow-hidden gap-2.5 p-2 text-[#e9ddc5]" style={{ background: '#120d08' }}>

      {/* 3D BOARD */}
      <div className="relative h-full min-w-0 flex-1 overflow-hidden rounded-2xl border border-[#6b5230]/30">
        <EmpireScene3D
          state={pendingRoll ? { ...state, lastDice: pendingRoll.lastDice } : state}
          rolling={isRolling}
          onDiceSettled={settleRoll}
          onTileClick={setSelected}
        />
        <Confetti fire={gameOver && state.winnerId === currentPlayerId} />

        {/* live feed */}
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

        {/* rent banner */}
        <AnimatePresence>
          {state.lastRentPaid && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16 }}
              className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center"
            >
              <div className="flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/85 px-4 py-1.5 font-mono text-[10px] text-white backdrop-blur">
                <DollarSign className="h-3.5 w-3.5 text-[#e6b45a]" />
                <span><strong>{state.lastRentPaid.from}</strong> paid <strong className="text-[#e6b45a]">${state.lastRentPaid.amount}</strong> rent to <strong>{state.lastRentPaid.to}</strong> · {state.lastRentPaid.propertyName}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* spectator chip */}
        {isSpectator && (
          <div className="pointer-events-none absolute top-3 right-3 z-10 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-[10px] text-white/60 backdrop-blur">👁 Spectating</div>
        )}

        {/* orbit hint */}
        <div className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/35 backdrop-blur lg:block">
          drag to orbit · scroll to zoom · tap a tile for its deed
        </div>

        {/* full-board victory screen */}
        <AnimatePresence>
          {gameOver && !endDismissed && (
            <EmpireEndScreen state={state} currentPlayerId={currentPlayerId} netWorth={netWorth}
              canRematch={!isSpectator} onRematch={handleRematch} onDismiss={() => setEndDismissed(true)} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {gameOver && endDismissed && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute inset-x-0 top-12 z-20 flex justify-center">
              <button onClick={() => setEndDismissed(false)}
                className="flex items-center gap-2 rounded-full border border-[#e6b45a]/50 bg-black/70 px-5 py-2 text-sm font-black text-[#f2d492] backdrop-blur transition hover:bg-black/85"
                style={{ fontFamily: SERIF }}>
                <Trophy className="h-4 w-4" /> {state.winnerId ? getPlayerName(state, state.winnerId) : 'Nobody'} owns the empire! — show results
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SIDEBAR */}
      <div className="flex w-[300px] flex-shrink-0 flex-col gap-2.5 overflow-hidden py-1">

        {/* Active Player HUD panel */}
        <div className="glass-strong flex items-center gap-3 rounded-2xl p-3.5">
          <motion.div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-lg shadow-lg"
            style={{ backgroundColor: curPlayer.color, borderColor: 'rgba(255,255,255,0.4)' }}
            animate={{ boxShadow: [`0 0 0px ${curPlayer.color}`, `0 0 16px ${curPlayer.color}66`, `0 0 0px ${curPlayer.color}`] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {curPlayer.token}
          </motion.div>
          <div className="min-w-0 flex-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-[#d6a85c]">Current Player</span>
            <h3 className="mt-0.5 truncate text-sm font-black leading-tight text-white" style={{ fontFamily: SERIF }}>
              {curPlayer.name}{curPlayer.isBot && <span className="ml-1.5 rounded bg-[#d6a85c]/20 px-1 py-0.5 align-middle text-[7px] font-bold text-[#e8c987]">AI</span>}
            </h3>
            <p className="mt-0.5 font-mono text-xs font-bold text-[#e6b45a]">${curPlayer.cash.toLocaleString()} cash</p>
          </div>
          <span className="rounded-md bg-black/30 px-2 py-1 font-mono text-[9px] font-bold uppercase text-[#d6a85c]">{state.phase.replace('_', ' ')}</span>
        </div>

        {/* Phase-specific context panels */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">

            {/* Roll (my turn, not in jail) */}
            {state.phase === 'ROLL' && !curPlayer.inJail && isMyTurn && !curPlayer.isBot && (
              <motion.div key="roll-context" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="glass flex flex-col gap-2 rounded-2xl p-3.5 text-center">
                <button
                  onClick={handleRollDice}
                  disabled={isRolling}
                  className="bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-glow-grape transition active:scale-95 disabled:opacity-70"
                >
                  <Dices className="h-4 w-4" /> {isRolling ? 'Rolling…' : 'Roll Dice'}
                </button>
                {state.doubleCount > 0 && <p className="text-[9px] font-bold text-[#e8c987]">🔄 Doubles — roll again!</p>}
              </motion.div>
            )}

            {/* Jail view */}
            {state.phase === 'ROLL' && curPlayer.inJail && isMyTurn && !curPlayer.isBot && (
              <motion.div key="jail-context" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="glass flex flex-col gap-3 rounded-2xl border border-[#e0b56b]/25 p-4">
                <div className="flex items-center justify-center gap-2 rounded-xl border border-[#e0b56b]/25 bg-[#e0b56b]/10 px-3 py-1.5 text-[#e8c987]">
                  <Lock className="h-4 w-4" />
                  <span className="font-mono text-[9px] font-black uppercase tracking-wider">In Jail · Turn {curPlayer.jailTurns + 1}/3</span>
                </div>
                <p className="text-center text-[9px] leading-normal text-white/50">
                  Roll doubles to escape for free, pay a $50 fine, or use a Get Out of Jail card.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {curPlayer.getOutOfJailCards > 0 && (
                    <button onClick={() => act('useJailCard')}
                      className="rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 py-2 text-[9px] font-black uppercase text-white transition hover:brightness-110 active:scale-95">
                      Use Card
                    </button>
                  )}
                  <button onClick={() => act('payJailFine')} disabled={curPlayer.cash < 50}
                    className="rounded-lg bg-white/10 py-2 text-[9px] font-black uppercase text-white transition hover:bg-white/20 active:scale-95 disabled:opacity-40">
                    Pay $50 Fine
                  </button>
                </div>
                <button onClick={handleRollDice} disabled={isRolling}
                  className="bg-brand flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition active:scale-95 disabled:opacity-70">
                  <Dices className="h-4 w-4" /> {isRolling ? 'Rolling…' : 'Roll for Escape'}
                </button>
              </motion.div>
            )}

            {/* Buy property decision */}
            {state.phase === 'BUY_OR_PASS' && (
              <motion.div key="buy-context" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="glass flex flex-col gap-3 rounded-2xl p-4 text-center">
                <Landmark className="mx-auto h-8 w-8 text-[#d6a85c] opacity-80" />
                <div>
                  <h4 className="font-mono text-[9px] font-black uppercase tracking-widest text-white/40">Buy this space?</h4>
                  <p className="mt-1 truncate text-sm font-black leading-tight text-white" style={{ fontFamily: SERIF }}>{BOARD_SPACES[curPlayer.position]?.name}</p>
                  <p className="mt-1 font-mono text-base font-black text-[#e6b45a]">${BOARD_SPACES[curPlayer.position]?.cost}</p>
                </div>
                {isMyTurn && !curPlayer.isBot ? (
                  <div className="mt-1 flex gap-2.5">
                    <button onClick={() => act('buyProperty')}
                      className="bg-brand flex-1 rounded-xl py-2 text-xs font-black uppercase text-white shadow-md transition active:scale-95">
                      Buy
                    </button>
                    <button onClick={() => act('passProperty')}
                      className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-extrabold uppercase text-white transition hover:bg-white/20">
                      Pass → Auction
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] italic text-white/40">Opponent deciding…</span>
                )}
              </motion.div>
            )}

            {/* Auction bidding UI */}
            {state.phase === 'AUCTION' && state.auctionState && (() => {
              const auc = state.auctionState
              const space = BOARD_SPACES[auc.spaceIndex]
              const activeBidderId = auc.activeBidderIds[auc.currentBidderIndex]
              const activeBidder = state.players.find(p => p.id === activeBidderId)!
              const isMyBidTurn = !isSpectator && activeBidderId === currentPlayerId

              return (
                <motion.div key="auction-context" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass-strong flex flex-col gap-2.5 rounded-2xl border border-[#d6a85c]/30 p-4 text-center">
                  <Landmark className="mx-auto h-7 w-7 animate-pulse text-[#d6a85c]" />
                  <div>
                    <h4 className="font-mono text-[9px] font-black uppercase tracking-widest text-[#d6a85c]">🔨 Live Auction</h4>
                    <p className="mt-1 truncate text-xs font-black leading-tight text-white" style={{ fontFamily: SERIF }}>{space.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-white/40">Value: ${space.cost}</p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-black/40 p-2.5 font-mono">
                    <span className="mb-1 block text-[8px] font-bold uppercase text-white/35">Current Highest Bid</span>
                    {auc.highestBidderId ? (
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-black text-[#e6b45a]">${auc.highestBid}</span>
                        <span className="text-[8px] text-white/70">by {getPlayerName(state, auc.highestBidderId)}</span>
                      </div>
                    ) : (
                      <span className="text-xs italic text-white/40">No bids placed yet</span>
                    )}
                  </div>

                  <div className="text-[10px]">
                    {isMyBidTurn ? (
                      <div className="animate-pulse font-bold text-[#e8c987]">👉 Your bid! (Cash: ${activeBidder.cash})</div>
                    ) : (
                      <div className="italic text-white/40">Waiting for {activeBidder.name} to bid…</div>
                    )}
                  </div>

                  {isMyBidTurn && !activeBidder.isBot && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1">
                        {[1, 10, 50].map(incr => {
                          const bidAmt = auc.highestBid + incr
                          const disabled = bidAmt > activeBidder.cash
                          return (
                            <button key={incr} disabled={disabled}
                              onClick={() => { act('bid', bidAmt); setCustomBidVal("") }}
                              className="flex-1 rounded-lg border border-white/5 bg-white/10 py-1.5 text-[9px] font-black uppercase text-white transition hover:bg-white/20 disabled:opacity-40">
                              +${incr}
                            </button>
                          )
                        })}
                      </div>
                      <div className="mt-0.5 flex gap-1.5">
                        <input
                          type="number"
                          placeholder="Custom bid…"
                          value={customBidVal}
                          onChange={(e) => setCustomBidVal(e.target.value)}
                          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-xs text-white placeholder-white/25 focus:border-[#d6a85c] focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const val = parseInt(customBidVal)
                            if (val > auc.highestBid && val <= activeBidder.cash) { act('bid', val); setCustomBidVal("") }
                          }}
                          disabled={!customBidVal || parseInt(customBidVal) <= auc.highestBid || parseInt(customBidVal) > activeBidder.cash}
                          className="bg-brand rounded-lg px-3.5 py-1.5 text-xs font-black uppercase text-white shadow transition disabled:opacity-45"
                        >
                          Bid
                        </button>
                      </div>
                      <button onClick={() => { act('fold'); setCustomBidVal("") }}
                        className="mt-1 w-full rounded-lg border border-red-500/25 bg-red-950/40 py-1.5 text-[9px] font-bold uppercase text-red-300 transition hover:bg-red-900/40">
                        Fold / Pass
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })()}

            {/* Debt/Bankruptcy liquidator UI */}
            {state.phase === 'BANKRUPTCY' && (
              <motion.div key="bankruptcy-context" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3 rounded-2xl border-2 border-red-500/40 bg-red-950/70 p-4 text-center">
                <AlertTriangle className="mx-auto h-7 w-7 animate-bounce text-red-500" />
                <div>
                  <h4 className="font-mono text-[9px] font-black uppercase tracking-widest text-red-400">Debt Settlement</h4>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-white/85">
                    Owes <span className="font-mono font-bold text-[#e6b45a]">${state.debtAmount}</span> to{' '}
                    <strong>{state.debtToPlayerId ? getPlayerName(state, state.debtToPlayerId) : 'the Bank'}</strong>.
                  </p>
                </div>
                {isMyTurn && !curPlayer.isBot ? (
                  <div className="mt-1 flex flex-col gap-2">
                    <p className="text-[8px] italic text-white/50">
                      Sell houses or mortgage properties in the Estates tab to raise cash — the debt settles automatically.
                    </p>
                    <button onClick={() => act('declareBankruptcy')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2 text-[10px] font-black uppercase text-white shadow-lg transition hover:brightness-110 active:scale-95">
                      <Trash className="h-3.5 w-3.5" /> Declare Bankruptcy
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] italic text-red-300">Opponent liquidating assets…</span>
                )}
              </motion.div>
            )}

            {/* Waiting */}
            {state.phase === 'ROLL' && !isMyTurn && !gameOver && (
              <motion.div key="waiting-context" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass flex flex-col items-center justify-center gap-2 rounded-2xl py-4 text-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#d6a85c]" />
                <span className="text-[10px] italic text-white/40">Waiting for {curPlayer.name} to roll…</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trade and end turn controls */}
        {isMyTurn && !curPlayer.isBot && state.phase === 'ROLL' && !isRolling && (
          <div className="glass flex gap-2 rounded-2xl p-2">
            <button onClick={() => setShowTrade(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-[10px] font-bold uppercase text-white transition hover:bg-white/20">
              <HeartHandshake className="h-3.5 w-3.5 text-[#d6a85c]" /> Trade
            </button>
            <button onClick={() => act('endTurn')}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2 text-[10px] font-bold uppercase text-white transition hover:bg-white/20">
              End Turn <ChevronRight className="h-3.5 w-3.5 text-[#d6a85c]" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-shrink-0 gap-1 border-b border-white/10 pb-2">
          {(['HUD', 'PROPS'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-center text-[10px] font-black uppercase tracking-wider transition ${
                activeTab === tab ? 'border border-[#d6a85c]/30 bg-[#d6a85c]/15 text-[#f0d9a4]' : 'text-white/35 hover:text-white/70'
              }`}>
              {tab === 'HUD' ? '📊 Standings' : '🏠 Estates'}
            </button>
          ))}
        </div>

        {/* HUD STANDINGS TAB */}
        {activeTab === 'HUD' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="max-h-56 flex-shrink-0 space-y-2 overflow-y-auto pr-0.5">
              {state.players.map(p => {
                const isCurrent = state.players[state.currentPlayerIndex].id === p.id
                return (
                  <div key={p.id}
                    className={`flex items-center justify-between rounded-xl p-2.5 transition ${
                      p.isBankrupt ? 'border border-red-950/25 bg-red-950/10 opacity-30'
                      : isCurrent ? 'border border-[#d6a85c]/30 bg-[#d6a85c]/10 shadow-lg'
                      : 'border border-white/5 bg-black/25'
                    }`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/30 text-sm font-black"
                        style={{ backgroundColor: p.color }}>
                        {p.token}
                      </div>
                      <div className="min-w-0">
                        <p className="max-w-[90px] truncate text-[11px] font-bold text-white">{p.name}</p>
                        <div className="mt-0.5 flex items-center gap-1">
                          {p.isBankrupt && <span className="rounded bg-red-500/20 px-1 text-[7px] font-bold text-red-400">DEFEAT</span>}
                          {p.inJail && !p.isBankrupt && <span className="rounded bg-[#e0b56b]/20 px-1 text-[7px] font-bold text-[#e8c987]">JAIL</span>}
                          {p.getOutOfJailCards > 0 && <span className="rounded bg-purple-500/20 px-1 text-[7px] font-bold text-purple-300">🎟{p.getOutOfJailCards}</span>}
                          {p.isBot && <span className="text-[6px] font-bold text-white/35">BOT</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end text-right">
                      <span className="font-mono text-[10px] font-bold text-[#e6b45a]">${p.cash.toLocaleString()}</span>
                      <span className="font-mono text-[8px] text-white/35">Net: ${netWorth(p).toLocaleString()}</span>
                    </div>
                  </div>
                )
              })}

              {state.players.length < 6 && (
                <button onClick={handleAddBot}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/20 bg-white/5 py-2 text-[10px] font-bold uppercase text-white/50 transition hover:bg-white/10 hover:text-white active:scale-95">
                  <UserPlus className="h-3.5 w-3.5 text-[#d6a85c]" /> Add AI Bot
                </button>
              )}
            </div>

            {/* Action game log */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-3">
              <h4 className="mb-2 flex flex-shrink-0 items-center gap-1.5 border-b border-white/5 pb-1 text-[9px] font-black uppercase tracking-wider text-white/35">
                <FileText className="h-3.5 w-3.5 text-[#d6a85c]" /> Broadcast Log
              </h4>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
                {state.log.map((msg, i) => (
                  <div key={i} className="border-b border-white/5 py-1 font-mono text-[9px] leading-relaxed text-white/50">
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
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 scrollbar-thin">
            <h4 className="mb-1 text-[10px] font-black uppercase tracking-wider text-white/35">My Owned Titles</h4>
            {(() => {
              const myProps = Object.entries(state.properties)
                .filter(([, s]) => s.ownerId === currentPlayerId)
                .map(([i]) => BOARD_SPACES[+i])

              if (myProps.length === 0) return (
                <div className="rounded-2xl border border-white/5 bg-black/25 px-4 py-12 text-center text-[10.5px] italic text-white/30">
                  No title deeds acquired yet.<br />Spaces you land on can be purchased.
                </div>
              )

              return myProps.map(sp => {
                const prop = state.properties[sp.index]
                const setOwned = isColorSetOwnedBy(state, sp.group, currentPlayerId)
                const color = GROUP_COLORS[sp.group] || '#888'

                return (
                  <div key={sp.index}
                    className="rounded-xl border border-white/5 bg-black/30 p-3 transition duration-150 hover:border-white/10"
                    style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold leading-tight text-white">{sp.name}</p>
                        <p className="mt-1 text-[9px] text-white/45">
                          {prop.houses === 5 ? '🏨 Hotel' : prop.houses > 0 ? `🟩 ${prop.houses} House${prop.houses > 1 ? 's' : ''}` : 'No buildings'}
                          {prop.isMortgaged ? ' · Mortgaged' : ` · $${calculateRent(state, sp.index)} rent`}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col gap-1.5">
                        {!prop.isMortgaged ? (
                          <button onClick={() => act('mortgageProperty', sp.index)}
                            className="rounded bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/80 hover:bg-white/20">
                            Mortgage
                          </button>
                        ) : (
                          <button onClick={() => act('unmortgageProperty', sp.index)}
                            className="rounded bg-[#d6a85c]/20 px-2 py-0.5 text-[9px] font-bold text-[#f0d9a4] hover:bg-[#d6a85c]/35">
                            Unmort.
                          </button>
                        )}
                        {sp.type === 'PROPERTY' && setOwned && !prop.isMortgaged && (
                          <div className="flex gap-1">
                            {prop.houses < 5 && (
                              <button onClick={() => act('buildHouse', sp.index)} title="Build House"
                                className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-black text-emerald-300 hover:bg-emerald-500/35">
                                +🏠
                              </button>
                            )}
                            {prop.houses > 0 && (
                              <button onClick={() => act('sellHouse', sp.index)} title="Sell House"
                                className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-300 hover:bg-red-500/35">
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

        {/* Chance / Community Chest card draw popup */}
        {showCardDraw && state.lastCardDrawn && (
          <PropertyCardView
            space={BOARD_SPACES[curPlayer.position]}
            isCardDraw={true}
            cardText={state.lastCardDrawn.text}
            cardType={state.lastCardDrawn.type}
            onClose={() => {
              setShowCardDraw(false)
              // Clear card draw status after client closes to keep sync tidy
              if (isMyTurn && !curPlayer.isBot) {
                commit({ ...state, lastCardDrawn: null })
              }
            }}
          />
        )}

        {/* Incoming trade dialog offer */}
        {state.tradeSession && state.tradeSession.receiverId === currentPlayerId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-[#d6a85c]/40 p-5 shadow-2xl"
              style={{ background: 'linear-gradient(160deg,#2a2013,#211a10)' }}
            >
              <h3 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#e8c987]" style={{ fontFamily: SERIF }}>
                <HeartHandshake className="h-5 w-5 animate-pulse" /> Incoming Trade Offer
              </h3>
              <p className="mb-3 text-[10px] text-white/70">
                {getPlayerName(state, state.tradeSession.senderId)} proposed a deal!
              </p>
              <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-black/30 p-3.5">
                <div>
                  <span className="mb-1 block text-[8px] font-bold uppercase text-white/40">They Offer</span>
                  <p className="mb-1.5 font-mono text-xs font-black text-[#e6b45a]">${state.tradeSession.senderOffer.cash}</p>
                  {state.tradeSession.senderOffer.properties.map(i => (
                    <span key={i} className="mb-1 block truncate rounded border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] text-white">
                      🏠 {BOARD_SPACES[i].name}
                    </span>
                  ))}
                </div>
                <div>
                  <span className="mb-1 block text-[8px] font-bold uppercase text-white/40">They Request</span>
                  <p className="mb-1.5 font-mono text-xs font-black text-[#e6b45a]">${state.tradeSession.receiverOffer.cash}</p>
                  {state.tradeSession.receiverOffer.properties.map(i => (
                    <span key={i} className="mb-1 block truncate rounded border border-white/5 bg-white/5 px-2 py-0.5 text-[9px] text-white">
                      🏠 {BOARD_SPACES[i].name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => act('acceptTrade')}
                  className="bg-brand flex-1 rounded-xl py-2 text-xs font-black uppercase text-white shadow-lg transition active:scale-95">
                  Accept
                </button>
                <button onClick={() => act('rejectTrade')}
                  className="flex-1 rounded-xl bg-white/10 py-2 text-xs font-bold uppercase text-white transition hover:bg-white/20">
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

// ---- Full-board victory screen ----------------------------------------------------

function EmpireEndScreen({ state, currentPlayerId, netWorth, canRematch, onRematch, onDismiss }: {
  state: MonopolyState
  currentPlayerId: string
  netWorth: (p: Player) => number
  canRematch: boolean
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const ranked = [...state.players].sort((a, b) => {
    if (a.isBankrupt !== b.isBankrupt) return a.isBankrupt ? 1 : -1
    return netWorth(b) - netWorth(a)
  })
  const winner = state.players.find(p => p.id === state.winnerId) || ranked[0]
  const youWon = winner.id === currentPlayerId
  const medals = ['🥇', '🥈', '🥉']

  const statsOf = (p: Player) => {
    const mine = Object.entries(state.properties).filter(([, s]) => s.ownerId === p.id)
    const houses = mine.reduce((a, [, s]) => a + (s.houses === 5 ? 0 : s.houses), 0)
    const hotels = mine.filter(([, s]) => s.houses === 5).length
    return { deeds: mine.length, houses, hotels }
  }

  const share = async () => {
    const rows = ranked.slice(0, 4).map((p, i) =>
      `${medals[i] || `${i + 1}.`} ${p.name} — ${p.isBankrupt ? 'bankrupt' : '$' + netWorth(p).toLocaleString() + ' net worth'}`).join('\n')
    const text = `🎩 Property Empire on Dice Alley\n👑 ${winner.name} owns the board!\n\n${rows}\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Property Empire — Dice Alley', text })
      else await navigator.clipboard.writeText(text)
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch { /* cancelled */ }
  }

  const leave = () => {
    const pid = new URLSearchParams(window.location.search).get('partyId')
    window.location.href = pid && pid !== 'mock-party-id' ? `/party/${pid}` : '/games'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-black/85 via-black/60 to-black/85 backdrop-blur-[3px]">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#e6b45a]">Property Empire — Game Over</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {youWon ? '🎉 You own the empire!' : <>{winner.name} <span className="text-[#f2d492]">owns the empire!</span></>}
          </h2>
        </motion.div>

        <div className="flex w-full max-w-lg flex-col gap-2">
          {ranked.map((p, i) => {
            const isMe = p.id === currentPlayerId
            const isWinner = p.id === winner.id
            const s = statsOf(p)
            return (
              <motion.div key={p.id}
                initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.07 }}
                className={`rounded-xl border p-3 ${
                  isWinner ? 'border-2 border-[#e6b45a]/70 bg-gradient-to-b from-[#2a2013]/95 to-[#1a130c]/95 shadow-[0_0_50px_-12px_rgba(230,180,90,0.5)]'
                  : isMe ? 'border-[#e6b45a]/30 bg-[#e6b45a]/10' : 'border-white/10 bg-black/40'
                }`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-lg">{medals[i] || <span className="text-sm text-white/40">{i + 1}</span>}</span>
                  <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/25 text-lg"
                    style={{ backgroundColor: p.color }}>
                    {p.token}
                    {isWinner && <Crown className="absolute -top-3.5 left-1/2 h-4 w-4 -translate-x-1/2 text-[#e6b45a]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white" style={{ fontFamily: SERIF }}>
                      {p.name}
                      {p.isBot && <span className="ml-1.5 rounded bg-[#e6b45a]/20 px-1 py-0.5 text-[7px] font-bold text-[#f2d492]">AI</span>}
                      {isMe && <span className="ml-1.5 text-[9px] font-bold text-[#f2d492]">(you)</span>}
                    </p>
                    <p className="text-[9px] text-white/45">
                      🏠 {s.deeds} deeds · 🟩 {s.houses} houses · 🏨 {s.hotels} hotels
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-black ${p.isBankrupt ? 'text-red-400' : 'text-[#e6b45a]'}`}>
                      {p.isBankrupt ? 'BANKRUPT' : `$${netWorth(p).toLocaleString()}`}
                    </p>
                    {!p.isBankrupt && <p className="font-mono text-[8px] text-white/35">${p.cash.toLocaleString()} cash</p>}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          {canRematch && (
            <button onClick={onRematch}
              className="bg-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
              <RotateCcw className="h-4 w-4" /> Rematch
            </button>
          )}
          <button onClick={share}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Share2 className="h-4 w-4" /> {shared ? 'Copied!' : 'Share'}
          </button>
          <button onClick={onDismiss}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold uppercase text-white transition hover:bg-white/20">
            <Eye className="h-4 w-4" /> View Board
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
