import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "PartyPlay - Social Gaming Platform",
  description: "Play multiplayer games with friends or strangers in virtual gaming parties",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
