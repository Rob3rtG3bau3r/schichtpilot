// src/utils/pushSave.js
import { supabase } from "../supabaseClient";

/**
 * Speichert eine WebPush-Subscription in Supabase.
 * - upsert auf endpoint (ein Gerät = ein endpoint)
 */
export async function savePushSubscriptionToDb(sub, { firma_id = null, unit_id = null } = {}) {
  const { data: uData, error: uErr } = await supabase.auth.getUser();
  if (uErr) throw uErr;

  const user = uData?.user;
  if (!user?.id) throw new Error("Kein eingeloggter User (auth.getUser).");

  const json = sub?.toJSON?.() || sub;
  const endpoint = json?.endpoint;
  const p256dh = json?.keys?.p256dh;
  const auth = json?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Subscription unvollständig (endpoint/keys fehlen).");
  }

  const payload = {
    user_id: user.id,
    firma_id: firma_id ?? null,
    unit_id: unit_id ?? null,
    endpoint,
    p256dh,
    auth,
    user_agent: navigator.userAgent,
    last_seen: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("db_pushsubscription")
    .upsert(payload, { onConflict: "endpoint" });

  if (error) throw error;

  return { ok: true, endpoint };
}
