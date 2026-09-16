import { LOADING_LINES } from "@/lib/copy"

// Root App Router pending UI. Deliberately a server component: it ships zero JS,
// so the branded frame shows up the instant a navigation starts. That rules out
// Mascot and framer-motion (both client-only) — the layout below mirrors the
// dashboard's loading state with plain CSS instead.
//
// The line is a fixed pick rather than a random one: a loading fallback renders
// on the server, and rotating the copy per render would only churn the markup.
const LOADING_LINE = LOADING_LINES[0]

export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center"
    >
      <p className="animate-fade-up text-xl font-medium text-white">{LOADING_LINE}</p>

      <div
        aria-hidden="true"
        className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/20"
      >
        <div className="h-full w-1/2 rounded-full bg-brand animate-shimmer" />
      </div>
    </div>
  )
}
