// src/utils/pushClient.js
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export async function ensurePushSubscription({ vapidPublicKey }) {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker nicht verfügbar.');
  if (!('PushManager' in window)) throw new Error('Push wird vom Browser nicht unterstützt.');

  if (!vapidPublicKey) throw new Error('VAPID Public Key fehlt.');

  // ✅ 1) Permission anfragen (nur wenn noch "default")
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    console.log('[PUSH] permission result:', p);
  }

  // ✅ 2) Hart stoppen, wenn nicht erlaubt
  if (Notification.permission !== 'granted') {
    throw new Error('Push Permission nicht erteilt.');
  }

  // ✅ 3) SW ready
  const reg = await navigator.serviceWorker.ready;

  // ✅ 4) vorhandene Subscription wiederverwenden
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  // ✅ 5) neue Subscription
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });

  return sub;
}
