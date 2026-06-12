import { createClient } from "@supabase/supabase-js"
import { supabase } from "./supabase"

export const subscribeToPartyUpdates = (partyId: string, callback: (data: any) => void) => {
  return supabase
    .channel(`party_${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "votes",
        filter: `party_id=eq.${partyId}`,
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
}

export const subscribeToPartyMembers = (partyId: string, callback: (data: any) => void) => {
  return supabase
    .channel(`party_members_${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "party_members",
        filter: `party_id=eq.${partyId}`,
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
}

export const subscribeToPartyChat = (partyId: string, callback: (data: any) => void) => {
  return supabase
    .channel(`party_chat_${partyId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `party_id=eq.${partyId}`,
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()
}

export const unsubscribe = (subscription: any) => {
  return subscription.unsubscribe()
}
