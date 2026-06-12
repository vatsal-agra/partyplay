import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"
import { MainNav } from "@/components/MainNav"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BoardGame Nexus - Play Board Games Online",
  description: "Play your favorite board games online with friends in real-time. Create or join game sessions and have fun together!",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <MainNav />
          <main className="pt-16 min-h-screen">
            {children}
            <Toaster position="top-right" richColors />
          </main>
        </Providers>
      </body>
    </html>
  )
}
