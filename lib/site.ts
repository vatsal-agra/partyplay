// Canonical public origin for absolute URLs (sitemap, robots, structured data).
// Mirrors the metadataBase used in app/layout.tsx.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://dice-alley.netlify.app").replace(/\/$/, "")

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`
}
