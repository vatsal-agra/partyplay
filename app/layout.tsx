import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Plus_Jakarta_Sans, Playfair_Display } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { MainNav } from "@/components/MainNav"
import { FeedbackWidget } from "@/components/FeedbackWidget"
import { MobileGate } from "@/components/MobileGate"
import { Toaster } from "sonner"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const grotesk = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dice-alley.netlify.app"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Dice Alley — Game Night, Anywhere",
  description: "Create a party, rally your friends, vote on a game, and play together in real time. 9 free games, voice chat, no installs — the funnest way to host game night online.",
  applicationName: "Dice Alley",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Dice Alley",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Dice Alley",
    title: "Dice Alley — Game Night, Anywhere",
    description: "Rally your crew, vote on a game, and play together in real time. 9 free games, voice chat, no installs.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Dice Alley — Game Night, Anywhere",
    description: "Rally your crew, vote on a game, and play together in real time. Free, in your browser.",
  },
}

// Honey gold matches the theme_color in app/manifest.ts.
export const viewport: Viewport = {
  themeColor: "#d6a85c",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${grotesk.variable}`}>
      <body className="font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#d6a85c] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#2b2118] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#d6a85c]"
        >
          Skip to content
        </a>
        {/* Microsoft Clarity — web analytics / session insights */}
        <Script id="ms-clarity" strategy="lazyOnload">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","x9464swtge");`}
        </Script>
        {/* Animated aurora backdrop for the whole app */}
        <div className="aurora" aria-hidden />
        <Providers>
          <MainNav />
          <main id="main-content" tabIndex={-1} className="pt-16 min-h-screen">
            {children}
            <Toaster position="top-right" richColors theme="dark" />
          </main>
          <FeedbackWidget />
          <MobileGate />
        </Providers>
      </body>
    </html>
  )
}
