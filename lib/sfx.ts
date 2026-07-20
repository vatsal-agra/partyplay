// Synthesized game sound effects — no audio assets required.
//
// Every sound is generated on the fly with the Web Audio API, so there are no
// files to ship and it works offline. A small set of distinct sounds is mapped
// to the emoji each game already prefixes its log lines with, which gives "a
// sound for every event" across all nine games without touching any engine.
//
// Master mute is persisted to localStorage and shared app-wide.

export type SfxName =
  | "dice" | "move" | "turn" | "buy" | "cash" | "card" | "chip"
  | "correct" | "wrong" | "error" | "hit" | "miss" | "win" | "lose"
  | "bell" | "whoosh" | "draw" | "clue" | "build" | "pop"

const MUTE_KEY = "pp_sfx_muted"

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false
const listeners = new Set<(m: boolean) => void>()

if (typeof window !== "undefined") {
  muted = window.localStorage.getItem(MUTE_KEY) === "1"
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {})
  return ctx
}

export function isSfxMuted(): boolean {
  return muted
}

export function setSfxMuted(value: boolean) {
  muted = value
  if (typeof window !== "undefined") window.localStorage.setItem(MUTE_KEY, value ? "1" : "0")
  listeners.forEach((l) => l(value))
}

export function toggleSfxMuted(): boolean {
  setSfxMuted(!muted)
  return muted
}

export function onSfxMutedChange(cb: (m: boolean) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---- Low-level builders -----------------------------------------------------

function tone(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: { freq: number; to?: number; dur: number; type?: OscillatorType; gain?: number; delay?: number }
) {
  const start = t + (o.delay || 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = o.type || "sine"
  osc.frequency.setValueAtTime(o.freq, start)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), start + o.dur)
  const peak = o.gain ?? 0.3
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(peak, start + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur)
  osc.connect(g)
  g.connect(out)
  osc.start(start)
  osc.stop(start + o.dur + 0.02)
}

function noise(
  c: AudioContext,
  out: AudioNode,
  t: number,
  o: { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; delay?: number }
) {
  const start = t + (o.delay || 0)
  const frames = Math.floor(c.sampleRate * o.dur)
  const buffer = c.createBuffer(1, frames, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  const filt = c.createBiquadFilter()
  filt.type = o.type || "bandpass"
  filt.frequency.value = o.freq ?? 1200
  const g = c.createGain()
  const peak = o.gain ?? 0.25
  g.gain.setValueAtTime(peak, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + o.dur)
  src.connect(filt)
  filt.connect(g)
  g.connect(out)
  src.start(start)
  src.stop(start + o.dur + 0.02)
}

// ---- The sound set ----------------------------------------------------------

const RECIPES: Record<SfxName, (c: AudioContext, out: AudioNode, t: number) => void> = {
  dice: (c, o, t) => { noise(c, o, t, { dur: 0.08, freq: 2200, gain: 0.22 }); noise(c, o, t, { dur: 0.06, freq: 1600, gain: 0.2, delay: 0.1 }); noise(c, o, t, { dur: 0.05, freq: 1900, gain: 0.18, delay: 0.18 }) },
  move: (c, o, t) => tone(c, o, t, { freq: 440, to: 620, dur: 0.1, type: "triangle", gain: 0.22 }),
  turn: (c, o, t) => { tone(c, o, t, { freq: 587, dur: 0.12, type: "sine", gain: 0.28 }); tone(c, o, t, { freq: 880, dur: 0.16, type: "sine", gain: 0.26, delay: 0.1 }) },
  buy: (c, o, t) => tone(c, o, t, { freq: 880, to: 1320, dur: 0.16, type: "sine", gain: 0.3 }),
  cash: (c, o, t) => { tone(c, o, t, { freq: 1318, dur: 0.12, type: "sine", gain: 0.3 }); tone(c, o, t, { freq: 1760, dur: 0.18, type: "sine", gain: 0.28, delay: 0.09 }) },
  // a soft paper card-flick, not a metallic clang
  card: (c, o, t) => { noise(c, o, t, { dur: 0.08, freq: 1600, gain: 0.1, type: "bandpass" }); noise(c, o, t, { dur: 0.05, freq: 2400, gain: 0.07, type: "highpass", delay: 0.03 }) },
  // a clean poker-chip "tik-tik" tap, not a square-wave squeal
  chip: (c, o, t) => { noise(c, o, t, { dur: 0.03, freq: 2600, gain: 0.12, type: "highpass" }); tone(c, o, t, { freq: 420, to: 300, dur: 0.05, type: "sine", gain: 0.12 }); noise(c, o, t, { dur: 0.03, freq: 2200, gain: 0.09, type: "highpass", delay: 0.05 }) },
  correct: (c, o, t) => { tone(c, o, t, { freq: 659, dur: 0.1, type: "sine", gain: 0.28 }); tone(c, o, t, { freq: 988, dur: 0.16, type: "sine", gain: 0.28, delay: 0.09 }) },
  wrong: (c, o, t) => tone(c, o, t, { freq: 360, to: 150, dur: 0.28, type: "sawtooth", gain: 0.22 }),
  error: (c, o, t) => tone(c, o, t, { freq: 160, to: 110, dur: 0.22, type: "square", gain: 0.2 }),
  // a proper explosion: deep boom + rumble + an initial crack
  hit: (c, o, t) => { tone(c, o, t, { freq: 130, to: 38, dur: 0.5, type: "sine", gain: 0.4 }); noise(c, o, t, { dur: 0.4, freq: 500, gain: 0.3, type: "lowpass" }); noise(c, o, t, { dur: 0.09, freq: 1800, gain: 0.22, type: "bandpass" }) },
  // a water splash (missile into the sea), not a cartoon "bloop"
  miss: (c, o, t) => { noise(c, o, t, { dur: 0.22, freq: 1100, gain: 0.2, type: "bandpass" }); tone(c, o, t, { freq: 260, to: 120, dur: 0.16, type: "sine", gain: 0.12 }); noise(c, o, t, { dur: 0.14, freq: 400, gain: 0.1, type: "lowpass", delay: 0.05 }) },
  win: (c, o, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, o, t, { freq: f, dur: 0.22, type: "sine", gain: 0.26, delay: i * 0.1 })) },
  lose: (c, o, t) => { [440, 349, 262].forEach((f, i) => tone(c, o, t, { freq: f, dur: 0.26, type: "triangle", gain: 0.24, delay: i * 0.13 })) },
  bell: (c, o, t) => { tone(c, o, t, { freq: 1568, dur: 0.4, type: "sine", gain: 0.26 }); tone(c, o, t, { freq: 2093, dur: 0.3, type: "sine", gain: 0.14 }) },
  // a missile launch: airy rush with a rising then arcing-down pitch
  whoosh: (c, o, t) => { noise(c, o, t, { dur: 0.34, freq: 900, gain: 0.22, type: "bandpass" }); tone(c, o, t, { freq: 200, to: 1400, dur: 0.16, type: "sawtooth", gain: 0.1 }); tone(c, o, t, { freq: 1400, to: 500, dur: 0.16, type: "sine", gain: 0.08, delay: 0.16 }) },
  draw: (c, o, t) => noise(c, o, t, { dur: 0.14, freq: 2600, gain: 0.12, type: "highpass" }),
  clue: (c, o, t) => { tone(c, o, t, { freq: 784, dur: 0.18, type: "sine", gain: 0.24 }); tone(c, o, t, { freq: 1175, dur: 0.26, type: "sine", gain: 0.2, delay: 0.12 }) },
  build: (c, o, t) => { tone(c, o, t, { freq: 220, dur: 0.06, type: "square", gain: 0.22 }); tone(c, o, t, { freq: 330, dur: 0.1, type: "square", gain: 0.2, delay: 0.08 }) },
  pop: (c, o, t) => tone(c, o, t, { freq: 700, to: 1100, dur: 0.07, type: "sine", gain: 0.2 }),
}

export function playSfx(name: SfxName) {
  if (muted) return
  const c = ac()
  if (!c || !master) return
  try {
    RECIPES[name]?.(c, master, c.currentTime)
  } catch {
    /* never let a sound break gameplay */
  }
}

// ---- Map a game log line to a sound -----------------------------------------
//
// Engines prefix log lines with an emoji describing the event; we read that
// first glyph and map it to a sound. Unknown events fall back to a soft "pop".

const EMOJI_SFX: Record<string, SfxName> = {
  // dice / movement / turn flow
  "🎲": "dice",
  "🚶": "move", "➡️": "move", "👣": "move", "🚪": "move",
  "👉": "turn",
  // property / building
  "🏡": "buy", "🏠": "buy", "🏘️": "buy",
  "🏗️": "build", "🔨": "build", "🛣️": "build", "🏰": "build",
  // money
  "💰": "cash", "💵": "cash", "💸": "cash", "🪙": "cash", "🏦": "cash",
  // cards
  "🃏": "card", "🂠": "card", "🎴": "card", "➕": "card", "🚮": "card", "▶️": "card", "📦": "card",
  // betting chips / calls
  "✔️": "chip", "📞": "chip", "⬆️": "chip",
  // correct / wrong / errors
  "✅": "correct",
  "❌": "wrong", "🛑": "wrong", "⚠️": "wrong",
  "🚫": "error", "🚨": "error", "👮": "error",
  // combat / hits
  "💥": "hit", "🔥": "hit", "⚔️": "hit",
  "🌊": "miss", "📉": "miss", "👋": "miss",
  // wins / losses
  "🏆": "win", "🎉": "win", "🎊": "win", "👑": "win",
  "☠️": "lose", "💀": "lose",
  // bells / trades
  "🔔": "bell", "🤝": "bell",
  // whooshes / reversals / sailing
  "🔄": "whoosh", "⏭️": "whoosh", "↪️": "whoosh", "🚢": "whoosh", "🚁": "whoosh", "⛵": "whoosh", "🕵️": "whoosh",
  // drawing games
  "🎨": "draw", "✏️": "draw", "🖍️": "draw",
  // clues / deduction / detective
  "💬": "clue", "❓": "clue", "🗝️": "clue", "🔍": "clue", "📣": "clue",
  // misc pops
  "🔓": "pop", "⏱️": "pop", "🗳️": "pop", "⚓": "pop", "🔒": "pop", "🎯": "pop", "⭐": "pop",
}

// Returns [emoji, sound] for a log line, or null if it has no leading emoji.
export function eventForLogLine(line: string): { emoji: string; sound: SfxName } | null {
  if (!line) return null
  // Grab the leading run of non-space, non-alphanumeric glyphs (the emoji + any
  // variation selector), then match the longest key that prefixes it.
  const lead = line.trimStart()
  for (const emoji of Object.keys(EMOJI_SFX)) {
    if (lead.startsWith(emoji)) return { emoji, sound: EMOJI_SFX[emoji] }
  }
  // Fallback: take the first glyph if it's clearly an emoji (outside ASCII).
  const first = Array.from(lead)[0]
  if (first && first.codePointAt(0)! > 0x2000) return { emoji: first, sound: "pop" }
  return null
}
