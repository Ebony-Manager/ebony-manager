self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Ebony Manager", {
      body: data.body || "Tienes una notificación nueva.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { href: data.href || "/dashboard" },
      tag: data.tag || undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data && event.notification.data.href ? event.notification.data.href : "/dashboard";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(href);
          return client.focus();
        }
      }
      return clients.openWindow(href);
    }),
  );
});
