/* Service worker de mensagens push.
   Isolado do PWA: não faz cache de app. */
/* eslint-disable no-undef */

function getPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch {
    return {};
  }
}

function payloadData(payload) {
  return payload.data || payload.notification?.data || payload.webpush?.notification?.data || {};
}

async function acknowledgePushDelivery(data, deviceState) {
  if (!data || !data.traceId || !data.ackSecret) return;
  try {
    await fetch("/api/public/push-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traceId: data.traceId,
        ackSecret: data.ackSecret,
        deviceState,
      }),
      keepalive: true,
    });
  } catch {
    // Confirmação best-effort.
  }
}

self.addEventListener("push", (event) => {
  const payload = getPayload(event);
  const data = payloadData(payload);
  const notification = payload.notification || payload.webpush?.notification || {};
  const title = notification.title || data.title || "Notificação";
  const body = notification.body || data.body || "";
  const url = data.url || notification.data?.url || "/";

  event.waitUntil(
    Promise.all([
      acknowledgePushDelivery(data, "background"),
      self.registration.showNotification(title, {
        body,
        icon: notification.icon || "/pwa-icon.png",
        badge: notification.badge || "/pwa-icon.png",
        data: { url },
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
