import type { Metadata } from "next"
import { PartySessionProvider } from "./PartySessionProvider"

// The party page is a client component, so it can't export metadata itself.
// This server layout exists to give invite links a real title and preview card.
//
// Deliberately static: a party is private, and reading it here would need the
// service role (RLS blocks the anon key for non-members). So no DB access, and
// nothing about the party itself leaks into the metadata that anyone holding
// the URL, or any crawler, can see.
const TITLE = "Join this Dice Alley party"
const DESCRIPTION =
  "You have been invited to a party on Dice Alley. Open the invite to join the room, vote on a game, and play with your friends in real time."

export function generateMetadata(): Metadata {
  return {
    title: TITLE,
    description: DESCRIPTION,
    // Party URLs are private invites, not pages we want in search results.
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "Dice Alley",
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  }
}

export default function PartyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PartySessionProvider>{children}</PartySessionProvider>
}
