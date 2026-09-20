export type PartyInvite = { kind: "code"; code: string } | { kind: "party"; partyId: string }

// Origins are explicit inputs so parsing stays pure and works on custom deployments.
export function parsePartyInvite(input: string, origins: readonly string[]): PartyInvite | null {
  const text = input.trim()
  if (/^[0-9a-f]{6}$/i.test(text)) return { kind: "code", code: text.toUpperCase() }

  if (/^https?:\/\//i.test(text)) {
    // Match the raw path too: URL normalization must not repair malformed invites.
    const match = text.match(/^https?:\/\/[^\s/?#]+\/party\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#][^\s]*)?$/i)
    if (!match) return null
    try {
      const url = new URL(text)
      if (url.username || url.password || !origins.some(origin => new URL(origin).origin === url.origin)) return null
      return { kind: "party", partyId: match[1].toLowerCase() }
    } catch {
      return null
    }
  }

  const labels = text.match(/\bparty\s+code\s*:/gi)
  const code = text.match(/\bparty\s+code\s*:\s*([0-9a-f]{6})(?=$|\s|[.!?,;])/i)
  if (labels?.length === 1 && code) return { kind: "code", code: code[1].toUpperCase() }
  return null
}
