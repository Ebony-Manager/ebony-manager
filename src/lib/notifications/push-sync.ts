"use client";

/**
 * Mantiene al día el registro push de ESTE dispositivo. iOS y los
 * navegadores a veces cambian la dirección de la suscripción sin avisar: la
 * vieja deja de entregar (sin dar error) y las notificaciones "desaparecen".
 * Aquí se guarda la última dirección enviada al servidor; si cambió, se
 * registra la nueva y se borra la anterior.
 */

const KEY = "push.endpoint";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberPushEndpoint(endpoint: string | null) {
  try {
    if (endpoint) window.localStorage.setItem(KEY, endpoint);
    else window.localStorage.removeItem(KEY);
  } catch {}
}

/** Registra la suscripción en el servidor (reemplazando la anterior de este dispositivo). */
export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const previous = read();
  const response = await fetch("/api/notifications/subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...subscription.toJSON(), replaces: previous && previous !== subscription.endpoint ? previous : null }),
  });
  if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "Error");
  rememberPushEndpoint(subscription.endpoint);
}

/** Al abrir la app: si este dispositivo tiene push y su dirección cambió, la actualiza. */
export async function syncPushSubscription(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  if (read() === subscription.endpoint) return;
  await savePushSubscription(subscription);
}
