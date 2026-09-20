export type NamedUser = {
  display_name?: string | null
  username?: string | null
  email?: string | null
}

// Prefer the name they set on the dashboard, then username, then email.
export function partyLabel(user?: NamedUser | null): string {
  const display = user?.display_name?.trim()
  if (display) return display
  const username = user?.username?.trim()
  if (username) return username
  const email = user?.email?.trim()
  if (email) return email
  return "Unknown User"
}

export function partyInitial(user?: NamedUser | null): string {
  const label = partyLabel(user)
  return label[0]?.toUpperCase() || "?"
}
