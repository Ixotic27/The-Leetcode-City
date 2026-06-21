// ── Push event ──────────────────────────────────────────────────────────────
// Fired when the server sends a push message via web-push (dispatchPush in
// notifications.ts). The payload matches the JSON built in that function.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback if the push body is plain text instead of JSON
    payload = { title: "New notification", body: event.data.text(), data: {} };
  }

  const { title, body, icon, badge, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: icon || "/icons/icon-192x192.png",
      badge: badge || "/icons/badge-72x72.png",
      data: data || {},
      // `tag` collapses duplicate notifications (same tag = replace, not stack)
      tag: data?.tag || "default",
      renotify: true, // vibrate/sound even when replacing a same-tag notification
    })
  );
});

// ── Notification click event ─────────────────────────────────────────────────
// Fired when the user taps/clicks a notification in the OS notification tray.
// We close the notification and navigate to the action URL.

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // `data.url` is set by dispatchPush() via payload.actionUrl
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the target URL is already open in a tab, just focus it
        for (const client of windowClients) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});