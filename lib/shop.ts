import type { SupabaseClient } from "@supabase/supabase-js"

export type Cosmetic = {
  id: string
  name: string
  description: string
  category: "felt" | "token" | "card_back" | "flair"
  price_paise: number
  starter: boolean
  preview_color: string
}
export type OwnedCosmetic = { cosmetic_id: string; equipped: boolean }

export async function listShopItems(client: SupabaseClient): Promise<Cosmetic[]> {
  const { data, error } = await client.from("cosmetics").select("id,name,description,category,price_paise,starter,preview_color").eq("active", true).order("price_paise")
  if (error) throw error
  return data || []
}

export async function unlockStarterCosmetics(client: SupabaseClient) {
  const { error } = await client.rpc("unlock_starter_cosmetics")
  if (error) throw error
}

export async function listOwnedCosmetics(client: SupabaseClient, userId: string): Promise<OwnedCosmetic[]> {
  const { data, error } = await client.from("user_cosmetics").select("cosmetic_id,equipped").eq("user_id", userId)
  if (error) throw error
  return data || []
}

export async function equipCosmetic(client: SupabaseClient, cosmeticId: string) {
  const { error } = await client.rpc("equip_cosmetic", { p_cosmetic_id: cosmeticId })
  if (error) throw error
}

export function formatINR(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(paise / 100)
}
