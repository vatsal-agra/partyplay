import type { Metadata } from "next"
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { MainNav } from "@/components/MainNav"
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

export const metadata: Metadata = {
  title: "PartyPlay — Game Night, Anywhere",
  description: "Create a party, rally your friends, vote on a game, and play together in real time. The funnest way to host game night online.",
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
        </Providers>
      </body>
    </html>
  )
}
