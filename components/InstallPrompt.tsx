"use client"

import { useCallback, useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"

// "Add to Home Screen" nudge. Chromium fires `beforeinstallprompt`, which we
// stash and replay when the player taps Install. iOS Safari has no such event,
// so there we can only tell them where the Share menu item lives.
//
// Either way the dismissal is remembered for two weeks so it never nags.
const DISMISS_KEY = "dice-alley:install-dismissed"
const DISMISS_DAYS = 14

// The event is Chromium-only, so it is missing from the DOM lib typings.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY))
    if (!at) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

function rememberDismiss() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* private mode, no storage: the banner just comes back next visit */
  }
}

// iPhone/iPad Safari only. Every iOS browser renders with WebKit, but Chrome,
// Firefox, Edge and Opera on iOS cannot add to the home screen, so their UA
// tokens are excluded. iPadOS 13+ reports itself as "Macintosh", hence the
// touch-point check.
function isIosSafari() {
  const ua = window.navigator.userAgent
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && window.navigator.maxTouchPoints > 1)
  if (!ios) return false
  return !/CriOS|FxiOS|EdgiOS|OPiOS|Mercury/.test(ua)
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return

    const onBeforeInstallPrompt = (event: Event) => {
      // Keep the browser's own mini-infobar out of the way; we drive it.
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setDeferred(null)
      setIosHint(false)
      rememberDismiss()
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    window.addEventListener("appinstalled", onInstalled)

    // The iOS hint is one-time: nothing on that side tells us whether they
    // followed it, so mark it seen as soon as it goes up.
    if (isIosSafari()) {
      setIosHint(true)
      rememberDismiss()
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  const dismiss = useCallback(() => {
    rememberDismiss()
    setDeferred(null)
    setIosHint(false)
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    setDeferred(null)
    try {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      // A "no thanks" in the native sheet counts as a dismissal too.
      if (outcome === "dismissed") rememberDismiss()
    } catch {
      /* the event can only be used once; nothing to recover */
    }
  }, [deferred])

  if (!deferred && !iosHint) return null

  return (
    <div
      role="dialog"
      aria-label="Install Dice Alley"
      className="fixed bottom-4 left-4 z-40 w-[min(88vw,300px)] rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="absolute right-2 top-2 rounded-lg p-1 text-muted-foreground hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {deferred ? (
        <div className="flex items-center gap-3 pr-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Download className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Install Dice Alley</p>
            <p className="text-xs text-muted-foreground">Game night, one tap away.</p>
          </div>
          <button
            type="button"
            onClick={install}
            className="ml-auto shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:brightness-110"
          >
            Install
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3 pr-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Share className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Add Dice Alley to your home screen</p>
            <p className="text-xs text-muted-foreground">Tap Share, then Add to Home Screen.</p>
          </div>
        </div>
      )}
    </div>
  )
}
