import type { MetadataRoute } from "next"

// Warm oak background with the honey-gold accent, matching app/globals.css.
const BACKGROUND = "#2a2218"
const THEME = "#d6a85c"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dice Alley",
    short_name: "Dice Alley",
    description:
      "Create a party, rally your friends, vote on a game, and play together in real time.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BACKGROUND,
    theme_color: THEME,
    categories: ["games", "entertainment", "social"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
