import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { MainNav } from "@/components/MainNav"
import { FeedbackWidget } from "@/components/FeedbackWidget"
import { Toaster } from "sonner"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://partyplay.netlify.app"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PartyPlay — Game Night, Anywhere",
  description: "Create a party, rally your friends, vote on a game, and play together in real time. 10 free games, voice chat, no installs — the funnest way to host game night online.",
  applicationName: "PartyPlay",
  openGraph: {
    type: "website",
    siteName: "PartyPlay",
    title: "PartyPlay — Game Night, Anywhere",
    description: "Rally your crew, vote on a game, and play together in real time. 10 free games, voice chat, no installs.",
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "PartyPlay — Game Night, Anywhere",
    description: "Rally your crew, vote on a game, and play together in real time. Free, in your browser.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${grotesk.variable}`}>
      <body className="font-sans">
        {/* Animated aurora backdrop for the whole app */}
        <div className="aurora" aria-hidden />
        <Providers>
          <MainNav />
          <main className="pt-16 min-h-screen">
            {children}
            <Toaster position="top-right" richColors theme="dark" />
          </main>
          <FeedbackWidget />
        </Providers>
      </body>
    </html>
  )
}
