import { GAMES_CATALOG } from "@/lib/games-catalog"
import { SITE_URL } from "@/lib/site"

// schema.org WebApplication for the landing page. Rendered into the SSR HTML so
// crawlers see it without running the app.
export function LandingJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Dice Alley",
    url: SITE_URL,
    applicationCategory: "GameApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern browser with JavaScript enabled",
    description: `Create a party, share one code, vote on a game, and play together in real time. ${GAMES_CATALOG.length} free multiplayer games with voice and chat built in, no installs.`,
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: GAMES_CATALOG.map((game) => game.name),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
