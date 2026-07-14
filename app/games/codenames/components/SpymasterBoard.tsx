// Spymaster — board container. Renders the real-time 3D briefing table
// (loaded client-only) plus the agency HUD: team score chips, clue banner,
// spymaster clue entry, operative controls, pass-and-play peek, roster and a
// full-board mission-report end screen. All rules flow through the pure
// engine; the key-visibility gating is identical to the original board.
"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { motion, AnimatePresence } from "framer-motion"
import {
  SpymasterState, Team, giveClue, guessCard, endGuessing, initializeGame,
} from "../lib/spymasterEngine"
import { Confetti } from "@/components/Confetti"
import {
  Eye, EyeOff, Send, Hand, Trophy, Loader2, Crown, RotateCcw, Share2, LogOut,
} from "lucide-react"

const SERIF = "var(--font-display), Georgia, serif"
const TEAM_HEX: Record<Team, string> = { red: '#d9453a', blue: '#3467d9' }

// The Three.js scene must never render on the server.
const SpyTableScene3D = dynamic(() => import("./SpyTableScene3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#0b0c10]">
      <div className="flex flex-col items-center gap-3 text-[#9aa3b5]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: SERIF }}>Opening the case file…</p>
      </div>
    </div>
  ),
})

interface Props {
  state: SpymasterState
  currentPlayerId: string
  onStateChange: (s: SpymasterState) => void
  onBroadcastAction?: (event: string, payload: any) => void
  passAndPlay?: boolean
}

export default function SpymasterBoard({ state, currentPlayerId, onStateChange, onBroadcastAction, passAndPlay: passAndPlayProp }: Props) {
  const [clueWord, setClueWord] = useState('')
  const [clueNum, setClueNum] = useState(1)
  const [peek, setPeek] = useState(false)
  const [endDismissed, setEndDismissed] = useState(false)

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

  const handleRematch = () => {
    commit(initializeGame(state.players.map((p) => ({ id: p.id, name: p.name }))))
    setEndDismissed(false)
  }

  const iWon = !!state.winner && (passAndPlay || myTeam === state.winner)

  return (
    <div className="relative h-full w-full select-none overflow-hidden" style={{ background: '#0b0c10' }}>
      <SpyTableScene3D
        state={state}
        showKey={showKey}
        canGuess={canGuess && !state.winner}
        onGuess={(i) => commit(guessCard(state, i))}
      />
      <Confetti fire={iWon} />

      {/* team score chips */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2 rounded-2xl border px-3.5 py-2 backdrop-blur"
        style={{ backgroundColor: '#d9453a22', borderColor: '#d9453a66' }}>
        <span className="text-sm font-black" style={{ color: TEAM_HEX.red, fontFamily: SERIF }}>RED</span>
        <motion.span key={state.redRemaining} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          className="font-mono text-lg font-black text-white">{state.redRemaining}</motion.span>
        <span className="text-[8px] uppercase tracking-wider text-white/40">left</span>
      </div>
      <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2 rounded-2xl border px-3.5 py-2 backdrop-blur"
        style={{ backgroundColor: '#3467d922', borderColor: '#3467d966' }}>
        <span className="text-[8px] uppercase tracking-wider text-white/40">left</span>
        <motion.span key={state.blueRemaining} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
          className="font-mono text-lg font-black text-white">{state.blueRemaining}</motion.span>
        <span className="text-sm font-black" style={{ color: TEAM_HEX.blue, fontFamily: SERIF }}>BLUE</span>
      </div>

      {/* turn / clue banner */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
        <div className="flex flex-col items-center gap-1.5">
          {!state.winner && (
            <div className="rounded-full border border-white/12 bg-black/55 px-4 py-1.5 backdrop-blur">
              <span className="text-xs font-bold text-white">
                <span style={{ color: TEAM_HEX[state.currentTeam] }}>{state.currentTeam.toUpperCase()}</span>{' '}
                {state.phase === 'CLUE' ? "spymaster is thinking…" : 'operatives in the field'}
              </span>
            </div>
          )}
          <AnimatePresence>
            {state.clue && state.phase === 'GUESS' && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl border px-5 py-2 backdrop-blur"
                style={{ borderColor: `${TEAM_HEX[state.currentTeam]}88`, backgroundColor: `${TEAM_HEX[state.currentTeam]}1f` }}>
                <span className="text-lg font-black tracking-wide text-white" style={{ fontFamily: SERIF }}>
                  “{state.clue.word}” · {state.clue.number}
                </span>
                <span className="ml-2 font-mono text-[10px] font-bold text-white/60">
                  {state.guessesLeft} guess{state.guessesLeft === 1 ? '' : 'es'} left
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* roster chip (compact) */}
      <div className="pointer-events-none absolute right-3 top-20 z-10 hidden w-44 flex-col gap-1.5 md:flex">
        {(['red', 'blue'] as Team[]).map((tm) => (
          <div key={tm} className="rounded-xl border border-white/10 bg-black/50 p-2 backdrop-blur">
            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: TEAM_HEX[tm] }}>{tm} team</span>
            {state.players.filter((p) => p.team === tm).map((p) => (
              <div key={p.id} className="flex items-center gap-1 pl-0.5 text-[10.5px] text-white/85">
                {p.role === 'spymaster' ? '🎩' : '🔎'} <span className="truncate">{p.name}</span>
                {p.id === currentPlayerId && <span className="text-[8px] text-[#e8c987]">(you)</span>}
              </div>
            ))}
            {state.players.filter((p) => p.team === tm).length === 0 && (
              <p className="text-[9px] italic text-white/30">pass-and-play</p>
            )}
          </div>
        ))}
      </div>

      {/* live feed */}
      <div className="pointer-events-none absolute left-3 top-20 z-10 flex w-[250px] max-w-[40%] flex-col gap-1">
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

      {/* bottom controls */}
      <div className="absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2">
        {!state.winner && canGiveClue && (
          <motion.form
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onSubmit={(e) => { e.preventDefault(); if (clueWord.trim()) { commit(giveClue(state, clueWord, clueNum)); setClueWord('') } }}
            className="flex items-center gap-2 rounded-2xl border border-[#6b5230]/40 bg-black/70 p-2.5 backdrop-blur"
          >
            <span className="pl-1 text-[9px] font-black uppercase tracking-widest text-[#d6a85c]">🎩 Your clue</span>
            <input value={clueWord} onChange={(e) => setClueWord(e.target.value)} placeholder="One word…" autoFocus
              className="h-10 w-44 rounded-xl border border-white/15 bg-white/5 px-3 text-white placeholder:text-white/25 focus:border-[#d6a85c] focus:outline-none" />
            <select value={clueNum} onChange={(e) => setClueNum(+e.target.value)}
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-2 text-white focus:border-[#d6a85c] focus:outline-none">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <option key={n} value={n} className="bg-[#16161d]">{n}</option>)}
            </select>
            <button type="submit"
              className="bg-brand flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-black text-white shadow-glow-grape transition active:scale-95">
              <Send className="h-4 w-4" /> Give Clue
            </button>
          </motion.form>
        )}

        {!state.winner && canGuess && (
          <motion.button initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            onClick={() => commit(endGuessing(state))}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-white/15 bg-black/70 px-4 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15">
            <Hand className="h-4 w-4 text-[#d6a85c]" /> End Guessing
          </motion.button>
        )}

        {!state.winner && !canGiveClue && !canGuess && (
          <div className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 text-[11px] italic text-white/50 backdrop-blur">
            {state.phase === 'CLUE' ? `Waiting for the ${state.currentTeam} spymaster…` : `${state.currentTeam} operatives are guessing…`}
          </div>
        )}

        <div className="flex items-center gap-3">
          {passAndPlay && state.phase === 'GUESS' && !state.winner && (
            <button onClick={() => setPeek((p) => !p)}
              className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-[10px] text-white/45 backdrop-blur transition hover:text-white/80">
              {peek ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} {peek ? 'Hide' : 'Peek'} key (pass-and-play)
            </button>
          )}
          <span className="pointer-events-none hidden rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] text-white/35 backdrop-blur lg:block">
            drag to orbit · scroll to zoom
          </span>
        </div>
      </div>

      {/* full-board mission report */}
      <AnimatePresence>
        {state.winner && !endDismissed && (
          <SpyEndScreen state={state} currentPlayerId={currentPlayerId} iWon={iWon}
            canRematch onRematch={handleRematch} onDismiss={() => setEndDismissed(true)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.winner && endDismissed && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute inset-x-0 top-12 z-20 flex justify-center">
            <button onClick={() => setEndDismissed(false)}
              className="flex items-center gap-2 rounded-full border bg-black/70 px-5 py-2 text-sm font-black backdrop-blur transition hover:bg-black/85"
              style={{ borderColor: `${TEAM_HEX[state.winner]}88`, color: TEAM_HEX[state.winner], fontFamily: SERIF }}>
              <Trophy className="h-4 w-4" /> {state.winner.toUpperCase()} team wins! — show mission report
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---- Full-board mission report -------------------------------------------------------

function SpyEndScreen({ state, currentPlayerId, iWon, canRematch, onRematch, onDismiss }: {
  state: SpymasterState
  currentPlayerId: string
  iWon: boolean
  canRematch: boolean
  onRematch: () => void
  onDismiss: () => void
}) {
  const [shared, setShared] = useState(false)
  const winner = state.winner!
  const loser: Team = winner === 'red' ? 'blue' : 'red'
  const found = (tm: Team) => {
    const total = state.startingTeam === tm ? 9 : 8
    const remaining = tm === 'red' ? state.redRemaining : state.blueRemaining
    return { found: total - remaining, total }
  }

  const share = async () => {
    const w = found(winner), l = found(loser)
    const text = `🕵️ Spymaster on Dice Alley\n🏆 ${winner.toUpperCase()} team wins — ${state.endReason}\n\n${winner.toUpperCase()}: ${w.found}/${w.total} agents · ${loser.toUpperCase()}: ${l.found}/${l.total} agents\n\nPlay free at Dice Alley`
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Spymaster — Dice Alley', text })
      else await navigator.clipboard.writeText(text)
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch { /* cancelled */ }
  }

  const leave = () => {
    const pid = new URLSearchParams(window.location.search).get('partyId')
    window.location.href = pid && pid !== 'mock-party-id' ? `/party/${pid}` : '/games'
  }

  const TeamCard = ({ tm, isWinner }: { tm: Team; isWinner: boolean }) => {
    const f = found(tm)
    const roster = state.players.filter((p) => p.team === tm)
    return (
      <motion.div
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: isWinner ? 0.2 : 0.3 }}
        className={`w-full rounded-2xl border p-4 ${isWinner ? 'border-2 shadow-[0_0_50px_-12px]' : 'border-white/10 bg-black/40'}`}
        style={isWinner ? { borderColor: `${TEAM_HEX[tm]}bb`, backgroundColor: `${TEAM_HEX[tm]}14`, boxShadow: `0 0 50px -12px ${TEAM_HEX[tm]}88` } : undefined}
      >
        <div className="flex items-center gap-3">
          <div className="relative grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border-2 border-white/25 text-xl"
            style={{ backgroundColor: TEAM_HEX[tm] }}>
            🕵️
            {isWinner && <Crown className="absolute -top-3.5 left-1/2 h-4 w-4 -translate-x-1/2 text-[#e6b45a]" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-black text-white" style={{ fontFamily: SERIF }}>
              {tm.toUpperCase()} TEAM {isWinner && <span className="text-[10px] font-bold text-[#e6b45a]">WINNERS</span>}
            </p>
            {roster.length > 0 ? (
              <p className="truncate text-[10px] text-white/55">
                {roster.map((p) => `${p.role === 'spymaster' ? '🎩' : '🔎'} ${p.name}${p.id === currentPlayerId ? ' (you)' : ''}`).join(' · ')}
              </p>
            ) : (
              <p className="text-[10px] italic text-white/35">pass-and-play crew</p>
            )}
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-black" style={{ color: TEAM_HEX[tm] }}>{f.found}/{f.total}</p>
            <p className="text-[7.5px] font-bold uppercase tracking-widest text-white/40">agents found</p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 overflow-y-auto bg-gradient-to-b from-black/85 via-black/60 to-black/85 backdrop-blur-[3px]">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-5">
        <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#9aa3b5]">Spymaster — Mission Complete</p>
          <h2 className="mt-1 text-3xl font-black text-white sm:text-4xl" style={{ fontFamily: SERIF }}>
            {iWon ? '🎉 Mission accomplished!' : <><span style={{ color: TEAM_HEX[winner] }}>{winner.toUpperCase()}</span> team wins!</>}
          </h2>
          <p className="mt-1 text-xs text-white/55">{state.endReason}</p>
        </motion.div>

        <div className="flex w-full max-w-md flex-col gap-2.5">
          <TeamCard tm={winner} isWinner />
          <TeamCard tm={loser} isWinner={false} />
        </div>

        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.45 }}
          className="flex flex-wrap items-center justify-center gap-2">
          {canRematch && (
            <button onClick={onRematch}
              className="bg-brand flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black uppercase text-white shadow-glow-grape transition active:scale-95">
              <RotateCcw className="h-4 w-4" /> New Mission
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
