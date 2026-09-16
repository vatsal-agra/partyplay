import type { Metadata } from "next"
import { PUBLIC_SLUG, getGameById, gamePath } from "@/lib/games-catalog"
import { absoluteUrl } from "@/lib/site"

// The page below is a client component, so it can't export metadata itself.
// This server layout wraps it purely to give every game URL a real title and
// description for crawlers and link previews.

// Public slug -> internal id, the inverse of PUBLIC_SLUG. next.config rewrites
// /games/property-empire to /games/monopoly, so this route usually receives the
// internal id already; we still accept the pretty slug in case the page is
// rendered without the rewrite (direct hit, preview deploys).
const INTERNAL_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PUBLIC_SLUG).map(([id, slug]) => [slug, id])
)

function resolveGame(slug: string) {
  return getGameById(INTERNAL_ID[slug] || slug)
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const game = resolveGame(params.slug)

  if (!game) {
    return {
      title: "Play a Game | Dice Alley",
      description: "Create a party, rally your friends, and play together in real time on Dice Alley.",
    }
  }

  const title = `${game.name} | Dice Alley`
  const url = absoluteUrl(gamePath(game.id))

  return {
    title,
    description: game.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Dice Alley",
      title,
      description: game.description,
      url,
      images: [{ url: game.image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: game.description,
      images: [game.image],
    },
  }
}

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
