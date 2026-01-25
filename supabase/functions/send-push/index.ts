// supabase/functions/send-push/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = {
  firma_id: number | null;
  unit_id: number | null;
  user_ids: string[]; // UUIDs
  title?: string;
  message: string;
  url?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  // Preflight
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  try {
    // --- Auth
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization Bearer token" }, 401);
    }

    // --- Body (Ping erlauben auch ohne Schema)
    let raw: any = {};
    try {
      raw = await req.json();
    } catch {
      raw = {};
    }

    // ✅ Ping/Healthcheck
    if (raw?.ping === true) {
      return json({ ok: true, pong: true, ts: new Date().toISOString() }, 200);
    }

    const body = raw as Body;

    const firma_id = body.firma_id ?? null;
    const unit_id = body.unit_id ?? null;
    const user_ids = Array.isArray(body.user_ids) ? body.user_ids.map(String) : [];
    const title = (body.title ?? "SchichtPilot").toString().slice(0, 60);
    const message = (body.message ?? "").toString().trim().slice(0, 180);
    const url = body.url ? String(body.url).slice(0, 300) : undefined;

    if (!user_ids.length) return json({ error: "user_ids empty" }, 400);
    if (!message) return json({ error: "message empty" }, 400);

    // --- Supabase (Service Role)
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // --- VAPID
// --- VAPID (Debug Mini-Step)
const VAPID_PUBLIC_KEY  = (Deno.env.get("VAPID_PUBLIC_KEY")  || "").trim();
const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") || "").trim();
const VAPID_SUBJECT     = (Deno.env.get("VAPID_SUBJECT")     || "").trim();

console.log("VAPID_CHECK", {
  hasPublic: !!VAPID_PUBLIC_KEY,
  hasPrivate: !!VAPID_PRIVATE_KEY,
  hasSubject: !!VAPID_SUBJECT,
  pubLen: VAPID_PUBLIC_KEY.length,
  privLen: VAPID_PRIVATE_KEY.length,
  subject: VAPID_SUBJECT
});

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

    // --- Subscriptions laden
    let q = admin
      .from("db_pushsubscription")
      .select("id, user_id, firma_id, unit_id, endpoint, p256dh, auth")
      .in("user_id", user_ids);

   // if (firma_id != null) q = q.eq("firma_id", firma_id);
   // if (unit_id != null) q = q.eq("unit_id", unit_id);

    const { data: subs, error } = await q;
    console.log("PUSH_DEBUG_QUERY", {
      firma_id,
      unit_id,
      user_ids_len: user_ids.length,
      first_uid: user_ids[0],
      subs_found: subs?.length ?? 0,
      subs_sample: (subs || []).slice(0, 2).map((s) => ({
        user_id: s.user_id,
        firma_id: s.firma_id,
        unit_id: s.unit_id,
        endpoint_domain: (s.endpoint || "").split("/")[2] || "",
      })),
    });
    if (error) return json({ error: error.message }, 500);

    if (!subs?.length) {
      return json({ ok: true, sent: 0, failed: 0, removed: 0, reason: "no subscriptions found" }, 200);
    }

    const payload = JSON.stringify({
      title,
      body: message,
      url,
      firma_id,
      unit_id,
      ts: new Date().toISOString(),
    });

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (const s of subs) {
      const subscription = {
        endpoint: s.endpoint,
        keys: {
          p256dh: s.p256dh,
          auth: s.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription as any, payload);
        sent += 1;
      } catch (e: any) {
        failed += 1;

        const statusCode = e?.statusCode ?? e?.status ?? null;
        const msg = e?.body
          ? (typeof e.body === "string" ? e.body : JSON.stringify(e.body))
          : (e?.message ?? String(e));

        console.error("WEBPUSH_FAIL", {
          statusCode,
          message: msg,
          endpoint: s.endpoint,
          user_id: s.user_id,
        });

        if (statusCode === 404 || statusCode === 410) {
          const { error: delErr } = await admin.from("db_pushsubscription").delete().eq("id", s.id);
          if (!delErr) removed += 1;
        }
      }
    }

    return json({ ok: true, found: subs.length, sent, failed, removed }, 200);
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500);
  }
});
