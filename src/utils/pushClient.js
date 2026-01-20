// src/utils/pushClient.js
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export async function ensurePushSubscription({ vapidPublicKey }) {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker nicht verfügbar.");
  }
  if (!("PushManager" in window)) {
    throw new Error("Push wird vom Browser nicht unterstützt.");
  }
  if (!vapidPublicKey) {
    throw new Error("VAPID Public Key fehlt.");
  }

  const reg = await navigator.serviceWorker.ready;

  // Permission anfragen (nur wenn noch nicht entschieden)
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") {
    throw new Error("Push Permission nicht erteilt.");
  }

  // Schon vorhanden?
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  // Neu anlegen
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  return sub;
}
