/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production"

// Content Security Policy — allow only the origins this app actually talks to.
// In dev we permit 'unsafe-eval' (Next's HMR needs it); production omits it.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.clarity.ms https://*.clarity.ms`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.clarity.ms https://*.clarity.ms https://c.clarity.ms https://api.web3forms.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ")

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Block the site being framed by other origins (clickjacking).
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Don't let browsers guess content types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Trim referrer info sent to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful features; keep the mic for voice chat.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), browsing-topics=(), microphone=(self)" },
  // Force HTTPS for a long time.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
]

const nextConfig = {
  images: {
    domains: [
      'm.media-amazon.com',
      'cf.geekdo-images.com',
      'scribbl.io',
      'images.unsplash.com',
      'via.placeholder.com'
    ],
  },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  // Pretty, rebranded game URLs → internal routes. beforeFiles so they resolve
  // before the /games/[slug] dynamic route. Query strings are preserved.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/games/property-empire", destination: "/games/monopoly" },
        { source: "/games/naval-clash", destination: "/games/battleship" },
        { source: "/games/hexland", destination: "/games/catan" },
        { source: "/games/color-clash", destination: "/games/uno" },
        { source: "/games/mystery-manor", destination: "/games/cluedo" },
        { source: "/games/quick-draw", destination: "/games/pictionary" },
        { source: "/games/doodle-dash", destination: "/games/scribbleio" },
        { source: "/games/spymaster", destination: "/games/codenames" },
      ],
    }
  },
}

module.exports = nextConfig
