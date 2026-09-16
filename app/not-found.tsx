import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Mascot } from "@/components/Mascot"

export const metadata: Metadata = {
  title: "Page not found",
  description: "That page rolled off the table. Head back to Dice Alley or browse the games.",
}

// Root 404. Server component on purpose: Mascot is the only client piece,
// so an unknown URL costs nothing beyond the mascot's animation bundle.
export default function NotFound() {
  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="pointer-events-none absolute -z-10 h-72 w-72 rounded-full bg-sunny-400/10 blur-3xl" />

      <Mascot mood="think" size={128} className="mb-6" />

      <p className="font-display text-6xl font-bold tracking-tight text-gradient-warm sm:text-7xl">404</p>

      <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">
        This roll came up empty
      </h1>

      <p className="mt-3 max-w-md text-muted-foreground">
        Rolly looked everywhere and could not find that page. It may have moved, or the link may be
        a little off.
      </p>

      <div className="mt-9 flex flex-col gap-4 sm:flex-row">
        <Button asChild variant="brand" size="lg" className="gap-2">
          <Link href="/">
            Back to Dice Alley
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/games">Browse the games</Link>
        </Button>
      </div>
    </main>
  )
}
