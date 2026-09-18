import Link from "next/link"

export function LegalFooter() {
  return (
    <footer className="border-t border-white/10 px-4 py-8 text-xs text-muted-foreground">
      <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-6">
        <span>Dice Alley</span>
        <Link href="/privacy" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Privacy</Link>
        <Link href="/terms" className="rounded hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Terms</Link>
      </nav>
    </footer>
  )
}
