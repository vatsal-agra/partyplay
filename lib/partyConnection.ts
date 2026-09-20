// Party lobby connection state.
//
// The lobby leans entirely on one Supabase realtime channel for chat, votes,
// seats and launches. When that channel drops, nothing on the page moves and
// there is no sign anything is wrong. These helpers turn the raw channel
// lifecycle plus the browser's own online flag into the one message worth
// showing, and nothing at all while things are healthy.

// Mirrors the states Supabase reports through channel.subscribe(status).
export type PartyChannelState =
  | "idle"
  | "subscribing"
  | "subscribed"
  | "error"
  | "timeout"
  | "closed"

export type PartyConnection = {
  channel: PartyChannelState
  // navigator.onLine, mirrored into React state.
  online: boolean
  // A recovery attempt (manual retry or auto retry after coming back online)
  // is in flight.
  recovering: boolean
  // Last recovery attempt failed, with the reason to show.
  lastError: string | null
}

export type PartyConnectionStatus = {
  // Losing live updates is worth interrupting a screen reader for; being
  // offline or mid-reconnect is not.
  role: "status" | "alert"
  tone: "offline" | "reconnecting" | "dropped"
  title: string
  message: string
  // Whether a Retry button makes sense right now.
  canRetry: boolean
}

export const INITIAL_PARTY_CONNECTION: PartyConnection = {
  channel: "idle",
  online: true,
  recovering: false,
  lastError: null,
}

// Supabase hands back a bare status string; keep the mapping in one place.
export function channelStateFromStatus(status: string): PartyChannelState {
  switch (status) {
    case "SUBSCRIBED":
      return "subscribed"
    case "CHANNEL_ERROR":
      return "error"
    case "TIMED_OUT":
      return "timeout"
    case "CLOSED":
      return "closed"
    default:
      return "subscribing"
  }
}

function isBroken(channel: PartyChannelState) {
  return channel === "error" || channel === "timeout" || channel === "closed"
}

// The single status to show, or null for "say nothing". A healthy subscribed
// channel on an online browser is silent, and so is the first subscribe
// attempt on load, which would otherwise flash a banner on every visit.
export function partyConnectionStatus(connection: PartyConnection): PartyConnectionStatus | null {
  const { channel, online, recovering, lastError } = connection

  if (!online) {
    return {
      role: "status",
      tone: "offline",
      title: "You are offline",
      message: "This device lost its internet connection. The party will catch up by itself once you are back online.",
      canRetry: !recovering,
    }
  }

  if (recovering) {
    return {
      role: "status",
      tone: "reconnecting",
      title: "Reconnecting",
      message: "Rebuilding the live connection to this party.",
      canRetry: false,
    }
  }

  if (lastError) {
    return {
      role: "alert",
      tone: "dropped",
      title: "Could not reconnect",
      message: `${lastError} Chat, votes and launches may be out of date.`,
      canRetry: true,
    }
  }

  if (isBroken(channel)) {
    return {
      role: "alert",
      tone: "dropped",
      title: "Live updates paused",
      message: "The connection to this party dropped. Chat, votes and launches may be out of date.",
      canRetry: true,
    }
  }

  return null
}
