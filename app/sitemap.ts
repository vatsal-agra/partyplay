import type { MetadataRoute } from "next"
import { GAMES_CATALOG, gamePath } from "@/lib/games-catalog"
import { absoluteUrl } from "@/lib/site"

// Static sitemap built straight from the live catalog, so pulling a game from
// GAMES_CATALOG also pulls it from search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/games"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...GAMES_CATALOG.map((game) => ({
      url: absoluteUrl(gamePath(game.id)),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ]
}
