// Poker — Texas Hold'em table UI. Community board, pot, seats, betting
// controls, showdown reveal, and a bot driver for solo play.
"use client"

import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  PokerState, Card, fold, checkCall, raiseTo, allIn, nextHand, playBotStep,
  rankLabel, suitSymbol, getPlayerName,
} from "../lib/pokerEngine"
import { Coins, Trophy, CircleDot } from "lucide-react"

interface Props {
  state: PokerState
  currentPlayerId: string
  onStateChange: (s: PokerState) => void
  onBroadcastAction?: (event: string, payload: any) => void
}

function CardFace({ card, hidden, small }: { card?: Card; hidden?: boolean; small?: boolean }) {
  const dim = small ? 'w-9 h-12 text-sm' : 'w-12 h-16 text-lg'
  if (hidden || !card) {
    return <div className={`${dim} rounded-md border border-white/30 bg-gradient-to-br from-rose-900/70 to-slate-900 flex items-center justify-center`}>
      <span className="text-rose-300/60 text-[9px] font-black">♠</span>
    </div>
  }
  const red = card.suit === 'H' || card.suit === 'D'
  return (
    <div className={`${dim} rounded-md bg-white border border-slate-300 flex flex-col items-center justify-center font-black shadow ${red ? 'text-rose-600' : 'text-slate-900'}`}>
      <span>{rankLabel(card.rank)}</span>
      <span className="text-xs leading-none">{suitSymbol(card.suit)}</span>
    </div>
  )
}

export default function PokerBoard({ state, currentPlayerId, onStateChange, onBroadcastAction }: Props) {
  const commit = (next: PokerState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const meIndex = Math.max(0, state.players.findIndex((p) => p.id === currentPlayerId))
  const me = state.players[meIndex]
  const inBetting = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'].includes(state.stage)
  const isMyTurn = inBetting && state.players[state.currentPlayerIndex]?.id === currentPlayerId
  const amHost = state.players[0]?.id === currentPlayerId
  const reveal = state.stage === 'HAND_OVER' && !!state.winningDesc
  const toCall = state.currentBet - (me?.bet ?? 0)

  // Bot driver
  useEffect(() => {
    if (state.stage === 'GAME_OVER') return
    const cur = state.players[state.currentPlayerIndex]
    if (inBetting && cur?.isBot) {
      const t = setTimeout(() => commit(playBotStep(state)), 850)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentPlayerIndex, state.stage, state.pot])

  // Host advances to the next hand automatically.
  useEffect(() => {
    if (state.stage === 'HAND_OVER' && amHost) {
      const t = setTimeout(() => commit(nextHand(state)), 3800)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.stage, state.handNumber, amHost])

  const seatTag = (i: number) => {
    const live = state.players.map((p, idx) => idx).filter((idx) => !state.players[idx].busted)
    const heads = live.length === 2
    const sb = heads ? state.dealerIndex : live[(live.indexOf(state.dealerIndex) + 1) % live.length]
    const bb = live[(live.indexOf(sb) + 1) % live.length]
    if (i === state.dealerIndex) return 'D'
    if (i === sb) return 'SB'
    if (i === bb) return 'BB'
    return null
  }

  const opponents = state.players.filter((_, i) => i !== meIndex)

  return (
    <div className="flex flex-col w-full h-full overflow-hidden bg-gradient-to-b from-emerald-950 to-slate-950 select-none p-3 gap-2">
      {/* Opponents */}
      <div className="flex items-start justify-center gap-2 flex-wrap">
        {opponents.map((p) => {
          const i = state.players.indexOf(p)
          const isCur = state.players[state.currentPlayerIndex]?.id === p.id && inBetting
          const tag = seatTag(i)
          return (
            <div key={p.id} className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl border ${p.folded ? 'opacity-40' : ''} ${isCur ? 'bg-sunny-500/15 border-sunny-500/50' : 'bg-black/30 border-white/10'}`}>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-bold text-white">{p.name}</span>
                {p.isBot && <span className="text-[7px] bg-white/10 text-slate-300 px-1 rounded">AI</span>}
                {tag && <span className="text-[7px] bg-sunny-500/20 text-sunny-300 px-1 rounded font-black">{tag}</span>}
              </div>
              <div className="flex gap-1">
                {p.hole.length ? p.hole.map((c, k) => <CardFace key={k} card={c} hidden={!reveal || p.folded} small />) : <><CardFace hidden small /><CardFace hidden small /></>}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-sunny-400 flex items-center gap-0.5"><Coins className="w-3 h-3" />{p.chips}</span>
                {p.bet > 0 && <span className="text-emerald-300">bet {p.bet}</span>}
                {p.allIn && <span className="text-rose-400 font-black">ALL-IN</span>}
                {p.folded && <span className="text-slate-500">folded</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Center: community + pot */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 min-h-0">
        <div className="px-4 py-1 rounded-full bg-black/40 border border-white/10 text-sunny-400 font-mono font-bold text-sm flex items-center gap-1.5">
          <Coins className="w-4 h-4" /> Pot: {state.pot}
        </div>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((k) => (
            <CardFace key={k} card={state.community[k]} hidden={!state.community[k]} />
          ))}
        </div>
        <div className="h-5 text-center">
          {state.lastAction && inBetting && <span className="text-[11px] text-slate-300">{state.lastAction}</span>}
          {reveal && <span className="text-sm font-black text-sunny-400">{getPlayerName(state, state.winnerIds[0])} wins with {state.winningDesc}!</span>}
          {state.stage === 'HAND_OVER' && !state.winningDesc && state.winnerIds[0] && <span className="text-sm font-black text-sunny-400">{getPlayerName(state, state.winnerIds[0])} wins the pot.</span>}
        </div>
      </div>

      {/* My seat */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {me?.hole.length ? me.hole.map((c, k) => <CardFace key={k} card={c} />) : <><CardFace hidden /><CardFace hidden /></>}
          </div>
          <div className="text-left">
            <div className="text-sm font-black text-white flex items-center gap-1.5">
              {me?.name} {seatTag(meIndex) && <span className="text-[8px] bg-sunny-500/20 text-sunny-300 px-1 rounded font-black">{seatTag(meIndex)}</span>}
            </div>
            <div className="text-xs font-mono text-sunny-400 flex items-center gap-1"><Coins className="w-3 h-3" />{me?.chips} {me && me.bet > 0 && <span className="text-emerald-300 ml-1">bet {me.bet}</span>}</div>
            {me?.allIn && <span className="text-[10px] text-rose-400 font-black">ALL-IN</span>}
            {me?.folded && <span className="text-[10px] text-slate-500">folded</span>}
          </div>
        </div>

        {/* Action controls */}
        {isMyTurn ? (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button onClick={() => commit(fold(state, currentPlayerId))}
              className="px-4 py-2 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-black uppercase rounded-lg">Fold</button>
            <button onClick={() => commit(checkCall(state, currentPlayerId))}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-black uppercase rounded-lg">
              {toCall <= 0 ? 'Check' : `Call ${Math.min(toCall, me!.chips)}`}
            </button>
            {me!.chips > toCall && (
              <>
                <button onClick={() => commit(raiseTo(state, currentPlayerId, state.currentBet + state.minRaise))}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase rounded-lg">
                  Raise {state.currentBet + state.minRaise}
                </button>
                <button onClick={() => commit(raiseTo(state, currentPlayerId, state.currentBet + state.pot))}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black uppercase rounded-lg">
                  Pot
                </button>
              </>
            )}
            <button onClick={() => commit(allIn(state, currentPlayerId))}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase rounded-lg">All-in</button>
          </div>
        ) : (
          <div className="h-9 flex items-center">
            <span className="text-[11px] text-slate-400 italic">
              {state.stage === 'GAME_OVER' ? '' : inBetting ? `${state.players[state.currentPlayerIndex]?.name} is acting…` : state.stage === 'HAND_OVER' ? 'Next hand starting…' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Game over */}
      <AnimatePresence>
        {state.stage === 'GAME_OVER' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="bg-slate-900 border border-sunny-500/30 rounded-2xl p-6 text-center shadow-2xl">
              <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
              <h2 className="text-xl font-black text-white">{state.winnerIds[0] ? getPlayerName(state, state.winnerIds[0]) : 'Nobody'} takes the table!</h2>
              <p className="text-xs text-slate-400 mt-1">Last player with chips standing.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
