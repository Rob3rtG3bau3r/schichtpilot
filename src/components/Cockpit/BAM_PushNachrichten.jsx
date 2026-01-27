// src/components/Dashboard/BAM_PushNachrichten.jsx
import React, { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";

/**
 * Hook: kapselt Push-Logik + Status
 * - speichert IMMER zuerst in db_pushinbox
 * - ruft dann Edge Function send-push auf
 */
export function useBamPush({ supabase, firma, unit, modalDatum, modalSchicht }) {
  const [pushText, setPushText] = useState("");
  const [pushSending, setPushSending] = useState(false);
  const [pushResult, setPushResult] = useState("");

  const defaultPushText = useCallback(() => {
    const s = String(modalSchicht || "").toUpperCase();
    const label = s === "F" ? "Früh" : s === "S" ? "Spät" : s === "N" ? "Nacht" : s;
    return `❗ ${label}schicht am ${dayjs(modalDatum).format("DD.MM.YYYY")} unterbesetzt – kannst du helfen?`;
  }, [modalDatum, modalSchicht]);

  const resetPush = useCallback(() => {
    setPushText("");
    setPushResult("");
  }, []);

  const insertPushInbox = useCallback(
    async (userIds, msg) => {
      const ids = (userIds || []).map(String).filter(Boolean);
      const message = String(msg || "").trim();
      if (!ids.length || !message) return;

      const u = (await supabase.auth.getUser()).data?.user;
      if (!u?.id) throw new Error("Kein User eingeloggt.");

      const rows = ids.map((rid) => ({
        firma_id: firma ?? null,
        unit_id: unit ?? null,
        sender_user_id: u.id,
        recipient_user_id: rid,
        typ: "dienst_anfrage",
        title: "SchichtPilot",
        message,
        context: {
          datum: modalDatum,
          schicht: String(modalSchicht || "").toUpperCase(),
          source: "BedarfsAnalyseModal",
        },
      }));

      const { error } = await supabase.from("db_pushinbox").insert(rows);
      if (error) throw error;
    },
    [supabase, firma, unit, modalDatum, modalSchicht]
  );

  const sendPushToUsers = useCallback(
    async (userIds, message) => {
      const ids = (userIds || []).map(String).filter(Boolean);
      const msg = String(message || "").trim();

      if (!ids.length) {
        setPushResult("⚠️ Kein Empfänger ausgewählt.");
        return;
      }
      if (!msg) {
        setPushResult("⚠️ Nachricht ist leer.");
        return;
      }

      try {
        setPushSending(true);

        // 1) Inbox
        setPushResult("💾 Speichere Nachricht…");
        await insertPushInbox(ids, msg);

        // 2) Display Push
        setPushResult("📨 Sende Push…");
        const { data, error } = await supabase.functions.invoke("send-push", {
          body: {
            firma_id: firma ?? null,
            unit_id: unit ?? null,
            user_ids: ids,
            title: "SchichtPilot",
            message: msg,
            url: "https://schichtpilot.com/mobile",
          },
        });

        if (error) throw error;

        const sent = data?.sent ?? 0;
        const failed = data?.failed ?? 0;

        if (sent > 0 && failed === 0) {
          setPushResult(`✅ Push gesendet (${sent}/${ids.length})`);
        } else {
          setPushResult(`⚠️ Ergebnis: sent=${sent}, failed=${failed} (Logs prüfen)`);
        }
      } catch (e) {
        console.error(e);
        const m =
          e?.message ||
          e?.error?.message ||
          (typeof e === "string" ? e : JSON.stringify(e, null, 2));
        setPushResult(`❌ Push fehlgeschlagen: ${m}`);
      } finally {
        setPushSending(false);
      }
    },
    [supabase, firma, unit, insertPushInbox]
  );

  const effectiveText = useMemo(() => {
    const t = (pushText || defaultPushText()).trim();
    return t;
  }, [pushText, defaultPushText]);

  return {
    pushText,
    setPushText,
    pushSending,
    pushResult,
    setPushResult,
    defaultPushText,
    effectiveText,
    resetPush,
    sendPushToUsers,
  };
}

/**
 * UI-Baustein für das User-Modal (Textarea + Button + Status)
 */
export default function BAM_PushNachrichten({
  selectedUserId,
  pushText,
  setPushText,
  pushSending,
  pushResult,
  defaultPushText,
  effectiveText,
  onSendPush,
}) {
  if (!selectedUserId) return null;

  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
      <div className="text-sm font-medium mb-1">Push-Nachricht</div>

      <textarea
        rows={2}
        value={pushText || defaultPushText()}
        onChange={(e) => setPushText(e.target.value)}
        className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm"
        maxLength={180}
      />

      <button
        className="mt-2 w-full rounded-xl px-4  bg-blue-700 text-white hover:bg-blue-600 disabled:opacity-60"
        disabled={pushSending || !effectiveText}
        onClick={() => onSendPush([selectedUserId], effectiveText)}
      >
        {pushSending ? "Sende…" : "Benachrichtigung senden"}
      </button>

      {pushResult ? (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">{pushResult}</div>
      ) : null}
    </div>
  );
}
