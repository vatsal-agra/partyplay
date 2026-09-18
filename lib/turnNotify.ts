// Desktop "Your turn" notifications.
//
// The tab title already shouts at players who are looking at their browser
// tabs; this reaches the ones who have switched to another window entirely.
// Deliberately small: no service worker, no push backend, no server. Just the
// plain Notification API, fired from the open game tab when the turn passes to
// the local player while the tab is hidden.

const ICON = "/icons/icon-192.png"
// One tag for the whole app, so a second notification replaces the first
// instead of stacking up a column of them.
const TAG = "dice-alley-turn"

// Once the player says no we never ask again for the life of this tab. The
// browser remembers "denied" too, but this also covers the dismiss-without-
// choosing case, where permission stays "default" and re-asking would be rude.
let askedThisSession = false

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

export function notificationPermission(): NotificationPermission | null {
  return notificationsSupported() ? Notification.permission : null
}

/** True while it still makes sense to offer the player the opt-in control. */
export function canAskForTurnNotifications(): boolean {
  return notificationPermission() === "default" && !askedThisSession
}

/**
 * Ask for permission, at most once per tab. Browsers only honour this from a
 * user gesture, so call it from a click handler.
 */
export async function requestTurnNotifications(): Promise<NotificationPermission | null> {
  if (!notificationsSupported()) return null
  if (Notification.permission !== "default") return Notification.permission
  askedThisSession = true
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/**
 * Show the notification. No-ops unless permission has already been granted —
 * the turn itself is never a good moment to prompt, since the player is by
 * definition looking at another window.
 */
export function notifyYourTurn(gameName: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return
  try {
    const n = new Notification("Your turn", {
      body: `It's your move in ${gameName}.`,
      icon: ICON,
      tag: TAG,
    })
    n.onclick = () => {
      window.focus()
      n.close()
    }
  } catch {
    // Some browsers (older Android Chrome) throw unless the notification comes
    // from a service worker. Nothing to recover — the tab title still carries.
  }
}
