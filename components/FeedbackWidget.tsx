"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { MessageSquarePlus, X, Send, Loader2, Check } from "lucide-react"

// A no-friction beta feedback box: open, type, send. No sign-in, no name, no
// email — just the message. It posts to /api/feedback which emails the owner.
export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const submit = async () => {
    const message = text.trim()
    if (!message || state === "sending") return
    setState("sending")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, path: typeof window !== "undefined" ? window.location.pathname : "" }),
      })
      if (!res.ok) throw new Error()
      setState("sent")
      setText("")
      setTimeout(() => { setOpen(false); setState("idle") }, 1600)
    } catch {
      setState("error")
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-glow-grape hover:brightness-110"
        title="Send feedback"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="fixed bottom-20 right-4 z-40 w-[min(92vw,360px)] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="flex items-center gap-2 font-bold text-white">
                  Help shape Dice Alley
                  <span className="rounded-full border border-aqua-400/40 bg-aqua-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-aqua-300">Beta</span>
                </p>
                <p className="text-xs text-white/55">We're in beta — tell us what to build, fix, or change. No sign-up needed.</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20">
                <X className="h-4 w-4" />
              </button>
            </div>

            {state === "sent" ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-mint-500/20 text-mint-400"><Check className="h-6 w-6" /></span>
                <p className="font-semibold text-white">Thank you! 🙌</p>
                <p className="text-xs text-white/50">Your feedback is on its way.</p>
              </div>
            ) : (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={4}
                  autoFocus
                  placeholder="What would make this better? Ideas, bugs, anything…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none"
                />
                {state === "error" && <p className="mt-1 text-xs text-red-300">Couldn't send — please try again.</p>}
                <button
                  onClick={submit}
                  disabled={!text.trim() || state === "sending"}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {state === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {state === "sending" ? "Sending…" : "Send feedback"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
