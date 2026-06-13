import { Metadata } from "next";
import Link from "next/link";
import { Dice5 } from "lucide-react";

export const metadata: Metadata = {
  title: "PartyPlay — Sign In",
  description: "Sign in or create an account to start playing games with friends",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand shadow-glow-grape transition-transform duration-300 group-hover:rotate-12">
            <Dice5 className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-2xl font-bold text-gradient">PartyPlay</span>
        </Link>

        {/* Panel */}
        <div className="glass-strong p-8 shadow-soft animate-fade-in">
          {children}
        </div>
      </div>
    </div>
  );
}
