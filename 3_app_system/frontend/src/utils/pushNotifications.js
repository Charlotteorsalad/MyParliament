/**
 * Browser Web Push: register SW, request permission, subscribe with VAPID key.
 * Returns subscription object to send to backend, or null if not supported/denied.
 */
export async function subscribePush(getVapidPublicKey, savePushSubscription) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, error: 'Push not supported' };
  }
  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await reg.ready;
    }
    if (Notification.permission === 'denied') return { ok: false, error: 'Permission denied' };
    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { ok: false, error: 'Permission denied' };
    }
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return { ok: false, error: 'Server push not configured' };
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey)
    });
    const subscription = sub.toJSON ? sub.toJSON() : { endpoint: sub.endpoint, keys: { p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh')))), auth: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth')))) } };
    await savePushSubscription(subscription);
    return { ok: true, subscription };
  } catch (err) {
    return { ok: false, error: err.message || 'Subscribe failed' };
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

/**
 * Unsubscribe and remove from backend.
 */
export async function unsubscribePush(removePushSubscription) {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await removePushSubscription(sub.endpoint);
    }
  } catch (err) {
    console.warn('Unsubscribe push failed:', err);
  }
}
