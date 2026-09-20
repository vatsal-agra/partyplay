"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { deleteAccount, signOutDeletedAccount } from "@/lib/delete-account"
import { Button } from "@/components/ui/button"

export function DeleteAccount() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const client = getSupabaseBrowserClient()
      if (!deleted) {
        await deleteAccount(client)
        setDeleted(true)
      }
      await signOutDeletedAccount(client)
      router.replace("/")
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request failed. Please try again.")
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      if (busy || deleted) return
      setError(null)
      setOpen(next)
    }}>
      <Dialog.Trigger asChild>
        <button type="button" className="text-xs text-white/50 underline underline-offset-4 hover:text-red-300">
          Delete account
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-slate-950 p-6 text-white shadow-xl"
          onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus() }}
          onInteractOutside={(event) => event.preventDefault()}
          aria-busy={busy}
        >
          <Dialog.Title className="mb-2 text-xl font-bold">{deleted ? "Account deleted" : "Permanently delete your account?"}</Dialog.Title>
          <Dialog.Description className="mb-6 text-sm text-white/70">
            Your profile, stats, memberships and shop cosmetics may be removed. Hosted parties will be handed to another member or removed if empty. This cannot be undone.
          </Dialog.Description>
          {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
          <div className="flex flex-col justify-end gap-3 sm:flex-row">
            <Dialog.Close asChild>
              <Button ref={cancelRef} variant="outline" disabled={busy || deleted}>Cancel</Button>
            </Dialog.Close>
            <Button variant="destructive" className="h-auto min-h-10 whitespace-normal" disabled={busy} onClick={confirm}>
              {busy ? (deleted ? "Signing out..." : "Deleting...") : deleted ? "Retry sign out" : "Permanently delete account"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
