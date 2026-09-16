"use client"

import { useEffect, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"
import { listOwnedCosmetics, listShopItems } from "@/lib/shop"

type EquippedCosmetics = {
  feltHex: string | null
  tokenHex: string | null
  cardBackHex: string | null
}

const EMPTY: EquippedCosmetics = { feltHex: null, tokenHex: null, cardBackHex: null }

export function useEquippedCosmetics(): EquippedCosmetics {
  const [colors, setColors] = useState<EquippedCosmetics>(EMPTY)

  useEffect(() => {
    let disposed = false
    let revision = 0
    let unsubscribe: (() => void) | undefined

    try {
      const client = getSupabaseBrowserClient()
      const load = async (userId?: string) => {
        const request = ++revision
        if (disposed) return
        setColors(EMPTY)
        if (!userId) return
        try {
          const [owned, items] = await Promise.all([
            listOwnedCosmetics(client, userId),
            listShopItems(client),
          ])
          const equipped = new Set(owned.filter((row) => row.equipped).map((row) => row.cosmetic_id))
          const next = { ...EMPTY }
          for (const item of items) {
            // Only pass valid RGB hex colors to Three.js materials.
            if (!equipped.has(item.id) || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(item.preview_color)) continue
            if (item.category === "felt") next.feltHex = item.preview_color
            if (item.category === "token") next.tokenHex = item.preview_color
            if (item.category === "card_back") next.cardBackHex = item.preview_color
          }
          if (!disposed && request === revision) setColors(next)
        } catch {
          // Missing tables, offline requests and auth failures keep the original look.
          if (!disposed && request === revision) setColors(EMPTY)
        }
      }

      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // Leave the auth callback before making further Supabase requests.
        void Promise.resolve().then(() => load(session?.user.id))
      })
      unsubscribe = () => data.subscription.unsubscribe()
      const initialRevision = revision
      void client.auth.getSession().then(({ data, error }) => {
        if (!disposed && revision === initialRevision) void load(error ? undefined : data.session?.user.id)
      }).catch(() => {
        if (!disposed && revision === initialRevision) setColors(EMPTY)
      })
    } catch {
      setColors(EMPTY)
    }

    return () => {
      disposed = true
      revision++
      unsubscribe?.()
    }
  }, [])

  return colors
}
