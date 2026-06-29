"use client"

import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { playAsGuest } from "@/lib/guest"

// Add type declaration for window.usernameTimeout
declare global {
  interface Window {
    usernameTimeout: ReturnType<typeof setTimeout> | null;
  }
}

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [guestName, setGuestName] = useState("")
  const [guestLoading, setGuestLoading] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const handleGuest = async () => {
    setGuestLoading(true)
    setError(null)
    const { error } = await playAsGuest(supabase, guestName)
    if (error) { setError(error); setGuestLoading(false); return }
    await new Promise((r) => setTimeout(r, 600))
    router.push("/dashboard")
  }
  
  // Initialize the timeout property if it doesn't exist
  if (typeof window !== 'undefined' && window.usernameTimeout === undefined) {
    window.usernameTimeout = null;
  }

  // Check if username is available
  const checkUsername = async (username: string) => {
    if (!username.trim()) {
      setUsernameAvailable(null);
      return;
    }
    
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase.rpc('is_username_available', {
        username: username.trim().toLowerCase()
      });
      
      if (error) throw error;
      
      // If username is not available, apply red styling immediately
      if (data === false) {
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        if (usernameInput) {
          usernameInput.classList.add('border-red-500', 'bg-red-50/10');
          usernameInput.classList.add('animate-shake');
          setTimeout(() => {
            usernameInput.classList.remove('animate-shake');
          }, 500);
        }
      }
      
      setUsernameAvailable(data);
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  // Debounce username check
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    
    // Clear previous timeout
    if (window.usernameTimeout) {
      clearTimeout(window.usernameTimeout);
    }
    
    // Set new timeout
    window.usernameTimeout = setTimeout(() => {
      checkUsername(value);
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }
    
    if (!username.trim()) {
      setError("Username is required")
      setLoading(false)
      return
    }
    
    if (usernameAvailable === false) {
      setError("Username is already taken")
      // Highlight the username field with a red border and background
      const usernameInput = document.getElementById('username') as HTMLInputElement;
      if (usernameInput) {
        usernameInput.classList.add('border-red-500', 'bg-red-50/10');
        // Add a shake animation
        usernameInput.classList.add('animate-shake');
        setTimeout(() => {
          usernameInput.classList.remove('animate-shake');
        }, 500);
      }
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username.trim().toLowerCase()
          }
        }
      })

      if (error) throw error

      router.push("/auth/sign-in")
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-center text-2xl font-bold tracking-tight text-white">
            Join the party 🎉
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <a href="/auth/sign-in" className="font-semibold text-grape-300 hover:text-grape-200 hover:underline">
              Sign in
            </a>
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <Input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                className={`${usernameAvailable === true ? 'border-green-500 bg-green-50/10' : usernameAvailable === false ? 'border-red-500 bg-red-50/10' : ''}`}
                required
              />
              {checkingUsername && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary rounded-full border-t-transparent"></div>
                </div>
              )}
              {!checkingUsername && usernameAvailable === true && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
                  ✓
                </div>
              )}
              {!checkingUsername && usernameAvailable === false && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-red-500">
                  ✗
                </div>
              )}
            </div>
            <p className="text-xs mt-1 text-muted-foreground">
              {usernameAvailable === true ? 'Username is available' : 
               usernameAvailable === false ? 'Username is already taken' : 
               'Choose a unique username'}
            </p>
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="rounded-lg bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" variant="brand" className="w-full" size="lg" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <div className="relative flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            supabase.auth.signInWithOAuth({ provider: "google" })
          }}
        >
          Continue with Google
        </Button>

        {/* Guest play — no signup needed */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-xs font-medium text-white/70">Just want to jump in? Play as a guest — pick a name.</p>
          <div className="flex gap-2">
            <Input
              placeholder="Your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuest()}
              maxLength={24}
            />
            <Button type="button" variant="brand" onClick={handleGuest} disabled={guestLoading} className="shrink-0">
              {guestLoading ? "…" : "Play as guest"}
            </Button>
          </div>
        </div>
      </div>
  )
}
