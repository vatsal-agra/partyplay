"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { Home, Gamepad2, Users, LogIn, LogOut, UserPlus } from "lucide-react"
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

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white">
      <div className="px-4 sm:px-6 flex h-16 items-center justify-between mx-auto max-w-7xl">
        {/* Logo on the left */}
        <div className="flex-shrink-0 -ml-[325px]">
          <Link href="/" className="flex items-center space-x-2">
            <Gamepad2 className="h-6 w-6 text-gray-800" />
            <span className="text-xl font-bold text-gray-800">
              BoardGame Nexus
            </span>
          </Link>
        </div>

        {/* Navigation links in the center */}
        <nav className="hidden md:flex items-center justify-center flex-1 ml-[100px]">
          <div className="flex space-x-6">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 h-12 px-4 text-gray-600 hover:text-gray-900 transition-colors text-base font-medium",
                  isActive('/dashboard') && "text-gray-900 border-b-2 border-gray-900"
                )}
              >
                <Home className="h-5 w-5" />
                Dashboard
              </Button>
            </Link>
            <Link href="/games">
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 h-12 px-4 text-gray-600 hover:text-gray-900 transition-colors text-base font-medium",
                  isActive('/games') && "text-gray-900 border-b-2 border-gray-900"
                )}
              >
                <Gamepad2 className="h-5 w-5" />
                Games
              </Button>
            </Link>
          </div>
        </nav>

        {/* Sign out button on the right */}
        <div className="flex-shrink-0 absolute right-[25px]">
          {pathname === '/' ? (
            <div className="flex items-center space-x-2">
              <Link href="/auth/sign-in">
                <Button variant="ghost" className="gap-2 text-gray-800 hover:bg-gray-100">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/sign-up">
                <Button className="gap-2 bg-gray-800 text-white hover:bg-gray-700">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Button>
              </Link>
            </div>
          ) : (
            <Button 
              variant="destructive" 
              size="lg"
              className="gap-2 text-white hover:bg-red-600 px-6 py-2 text-base"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
