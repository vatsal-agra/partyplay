"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { Home, Gamepad2, LogIn, LogOut, UserPlus, Dice5 } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { useRouter } from "next/navigation"

export function MainNav() {
  const pathname = usePathname()
  const supabase = getSupabaseBrowserClient()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/games", label: "Games", icon: Gamepad2 },
  ]

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="px-4 sm:px-6 flex h-16 items-center justify-between mx-auto max-w-7xl">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-glow-grape transition-transform duration-300 group-hover:rotate-12">
            <Dice5 className="h-5 w-5 text-white" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight text-gradient">
            Dice Alley
          </span>
          <span className="rounded-full border border-aqua-400/40 bg-aqua-400/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-aqua-300">
            Beta
          </span>
        </Link>

        {/* Center nav — icons stay visible on mobile so pages remain reachable */}
        <nav className="flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors sm:px-4",
                  isActive(href)
                    ? "text-white"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
                {isActive(href) && (
                  <span className="absolute inset-0 -z-10 rounded-xl bg-white/10 ring-1 ring-white/15" />
                )}
              </span>
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {pathname === "/" ? (
            <>
              <Link href="/auth/sign-in">
                <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-white">
                  <LogIn className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign In</span>
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button variant="brand" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Button>
              </Link>
            </>
          ) : (
            <Button
              variant="outline"
              className="gap-2 text-white hover:border-destructive/50 hover:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
