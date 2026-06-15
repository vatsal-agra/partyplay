// Spymaster — board UI. 5x5 word grid, spymaster clue entry, operative
// guessing, key visibility gating, and online + pass-and-play control.
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  SpymasterState, Team, giveClue, guessCard, endGuessing, getPlayerName,
} from "../lib/spymasterEngine"
import { Eye, EyeOff, Send, Hand, Trophy, Skull } from "lucide-react"

interface Props {
  state: SpymasterState
  currentPlayerId: string
  onStateChange: (s: SpymasterState) => void
  onBroadcastAction?: (event: string, payload: any) => void
  passAndPlay?: boolean
}

const TEAM_HEX: Record<Team, string> = { red: '#dc2626', blue: '#2563eb' }
const CELL_BG: Record<string, string> = {
  red: '#dc2626', blue: '#2563eb', neutral: '#c9b896', assassin: '#1a1a1a',
}

export default function SpymasterBoard({ state, currentPlayerId, onStateChange, onBroadcastAction, passAndPlay: passAndPlayProp }: Props) {
  const [clueWord, setClueWord] = useState('')
  const [clueNum, setClueNum] = useState(1)
  const [peek, setPeek] = useState(false)

  const commit = (next: SpymasterState) => { onStateChange(next); onBroadcastAction?.('sync_state', next) }

  const me = state.players.find((p) => p.id === currentPlayerId)
  // Pass-and-play: a single device drives every seat (mock/solo or no real party).
  const passAndPlay = passAndPlayProp || !me
  const myRole = me?.role
  const myTeam = me?.team

  // Who may act right now.
  const isMyTeamTurn = passAndPlay || myTeam === state.currentTeam
  const canGiveClue = state.phase === 'CLUE' && isMyTeamTurn && (passAndPlay || myRole === 'spymaster')
  const canGuess = state.phase === 'GUESS' && isMyTeamTurn && (passAndPlay || myRole === 'operative')

  // Key visibility: spymasters always see colours; pass-and-play reveals during
  // the clue phase (or via the peek toggle) so whoever holds the device can see.
  const showKey = state.winner != null || (passAndPlay ? (state.phase === 'CLUE' || peek) : myRole === 'spymaster')

  const cellStyle = (i: number) => {
    const c = state.board[i]
    if (c.revealed) {
      return { backgroundColor: CELL_BG[c.color], color: c.color === 'neutral' ? '#3a2f1a' : '#fff', opacity: 1 }
    }
    if (showKey) {
      return { backgroundColor: '#1f2937', color: '#e5e7eb', boxShadow: `inset 0 0 0 3px ${CELL_BG[c.color]}` }
    }
    return { backgroundColor: '#26354a', color: '#e5e7eb' }
  }

  return (
    <div className="flex w-full h-full overflow-auto bg-slate-950 select-none p-3 gap-3">
      <div className="flex-1 flex flex-col items-center gap-3 min-w-0">
        {/* Score / turn bar */}
        <div className="w-full max-w-3xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-white" style={{ backgroundColor: '#dc262633', border: '1px solid #dc262666' }}>
            <span style={{ color: TEAM_HEX.red }}>RED</span><span className="font-mono">{state.redRemaining}</span>
          </div>
          <div className="text-center">
            {state.winner ? (
              <span className="text-sm font-black" style={{ color: TEAM_HEX[state.winner] }}>{state.winner.toUpperCase()} WINS</span>
            ) : (
              <span className="text-xs font-bold text-white">
                <span style={{ color: TEAM_HEX[state.currentTeam] }}>{state.currentTeam.toUpperCase()}</span>{' '}
                {state.phase === 'CLUE' ? "spymaster's turn" : 'operatives guessing'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-white" style={{ backgroundColor: '#2563eb33', border: '1px solid #2563eb66' }}>
            <span className="font-mono">{state.blueRemaining}</span><span style={{ color: TEAM_HEX.blue }}>BLUE</span>
          </div>
        </div>

        {/* Clue banner */}
        {state.clue && state.phase === 'GUESS' && (
          <div className="px-5 py-1.5 rounded-full bg-white/10 border border-white/15 text-white font-black tracking-wide">
            “{state.clue.word}” · {state.clue.number}
            <span className="ml-2 text-xs text-slate-400 font-mono">{state.guessesLeft} guess{state.guessesLeft === 1 ? '' : 'es'} left</span>
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-5 gap-2 w-full max-w-3xl">
          {state.board.map((c, i) => {
            const clickable = canGuess && !c.revealed
            return (
              <button key={i} disabled={!clickable}
                onClick={() => commit(guessCard(state, i))}
                className={`aspect-[5/3] rounded-lg font-bold text-[11px] sm:text-sm uppercase tracking-wide flex items-center justify-center text-center px-1 transition ${clickable ? 'hover:scale-[1.03] cursor-pointer' : 'cursor-default'} ${c.revealed ? 'shadow-inner' : 'shadow'}`}
                style={cellStyle(i)}>
                {c.color === 'assassin' && c.revealed ? <Skull className="w-5 h-5" /> : c.word}
              </button>
            )
          })}
        </div>

        {/* Controls */}
        <div className="w-full max-w-3xl min-h-[56px] flex items-center justify-center">
          {state.winner ? null : canGiveClue ? (
            <form onSubmit={(e) => { e.preventDefault(); commit(giveClue(state, clueWord, clueNum)); setClueWord('') }}
              className="flex items-center gap-2">
              <input value={clueWord} onChange={(e) => setClueWord(e.target.value)} placeholder="One-word clue…"
                className="h-10 w-44 bg-white/5 border border-white/15 rounded-lg px-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-grape-500" />
              <select value={clueNum} onChange={(e) => setClueNum(+e.target.value)}
                className="h-10 bg-white/5 border border-white/15 rounded-lg px-2 text-white">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
              </select>
              <button type="submit" className="h-10 px-4 bg-grape-500/40 hover:bg-grape-500/60 border border-grape-500/50 rounded-lg text-white font-bold text-sm flex items-center gap-1">
                <Send className="w-4 h-4" /> Give Clue
              </button>
            </form>
          ) : canGuess ? (
            <button onClick={() => commit(endGuessing(state))}
              className="h-10 px-4 bg-white/10 hover:bg-white/20 border border-white/15 rounded-lg text-white font-bold text-sm flex items-center gap-1.5">
              <Hand className="w-4 h-4" /> End Guessing
            </button>
          ) : (
            <span className="text-xs text-slate-400 italic">
              {state.phase === 'CLUE' ? `Waiting for ${state.currentTeam} spymaster…` : `${state.currentTeam} operatives are guessing…`}
            </span>
          )}
        </div>

        {passAndPlay && state.phase === 'GUESS' && !state.winner && (
          <button onClick={() => setPeek((p) => !p)} className="text-[10px] text-slate-500 flex items-center gap-1 hover:text-slate-300">
            {peek ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {peek ? 'Hide' : 'Peek'} key (pass-and-play)
          </button>
        )}
      </div>

      {/* Roster + log */}
      <div className="w-56 flex-shrink-0 hidden lg:flex flex-col gap-3">
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3">
          <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Agents</h4>
          {(['red', 'blue'] as Team[]).map((tm) => (
            <div key={tm} className="mb-2">
              <span className="text-[10px] font-black uppercase" style={{ color: TEAM_HEX[tm] }}>{tm}</span>
              {state.players.filter((p) => p.team === tm).map((p) => (
                <div key={p.id} className="text-[11px] text-white flex items-center gap-1 pl-1">
                  {p.role === 'spymaster' ? '🎩' : '🔎'} {p.name}
                  {p.id === currentPlayerId && <span className="text-[8px] text-slate-500">(you)</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex-1 bg-slate-950/60 border border-white/10 rounded-2xl p-3 overflow-y-auto scrollbar-thin">
          <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-wider mb-2">Log</h4>
          {state.log.slice().reverse().map((m, i) => (
            <div key={i} className="text-[9px] text-slate-400 leading-relaxed border-b border-white/5 pb-1">{m}</div>
          ))}
        </div>
      </div>

      {/* Winner overlay */}
      <AnimatePresence>
        {state.winner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="bg-slate-900 rounded-2xl p-6 text-center shadow-2xl border-2" style={{ borderColor: TEAM_HEX[state.winner] }}>
              <Trophy className="w-12 h-12 mx-auto mb-2" style={{ color: TEAM_HEX[state.winner] }} />
              <h2 className="text-xl font-black text-white">{state.winner.toUpperCase()} team wins!</h2>
              <p className="text-xs text-slate-400 mt-1">{state.endReason}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
