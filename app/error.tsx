"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Mascot } from "@/components/Mascot"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="pointer-events-none absolute -z-10 h-72 w-72 rounded-full bg-sunny-400/10 blur-3xl" />
      <Mascot mood="think" size={128} className="mb-6" />
      <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
        The table wobbled
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Something broke on this page. Try again, or head back to the lobby.
      </p>
      <div className="mt-9 flex flex-col gap-4 sm:flex-row">
        <Button variant="brand" size="lg" className="gap-2" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/" className="gap-2">
            Back to Dice Alley
            <ArrowRight className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </main>
  )
}
