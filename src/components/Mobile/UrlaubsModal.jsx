import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import dayjs from "dayjs";
import { erstelleDatenschutzPDF } from "../../utils/DatenschutzPDF";

const fmt = (d) => (d ? dayjs(d).format("DD.MM.YYYY") : "-");
const normSchicht = (s) => (s ?? "-").toString().trim().toUpperCase();

const UrlaubsModal = ({ offen, onClose, tag, datum, schicht }) => {
  const user_id  = localStorage.getItem("user_id");
  const firma_id = localStorage.getItem("firma_id");
  const unit_id  = localStorage.getItem("unit_id");

  // UI-State
  const [loadingConsent, setLoadingConsent] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [agreeDSGVO, setAgreeDSGVO] = useState(false);

  const [sending, setSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const resetUi = () => {
    setAgreeDSGVO(false);
    setSending(false);
    setSuccessMsg("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (offen) resetUi();
  }, [offen, datum, schicht]);

  useEffect(() => {
    if (!offen || !user_id) return;
    (async () => {
      setLoadingConsent(true);
      const { data, error } = await supabase
        .from("DB_User")
        .select("consent_anfragema")
        .eq("user_id", user_id)
        .single();
      if (!error) setHasConsent(Boolean(data?.consent_anfragema));
      setLoadingConsent(false);
    })();
  }, [offen, user_id]);

  useEffect(() => {
    if (!errorMsg && !successMsg) return;
    const t = setTimeout(() => { setErrorMsg(""); setSuccessMsg(""); }, 4000);
    return () => clearTimeout(t);
  }, [errorMsg, successMsg]);

  const handleSend = async () => {
    if (sending) return;
    setErrorMsg("");

    const today = dayjs().startOf("day");
    const dSel  = dayjs(datum);
    if (dSel.isBefore(today, "day")) {
      setErrorMsg("Anfragen für vergangene Tage sind nicht möglich.");
      return;
    }

    if (!hasConsent && !agreeDSGVO) {
      setErrorMsg("Bitte bestätige die Datenschutzerklärung.");
      return;
    }

    setSending(true);
    try {
      const windowStartISO = dayjs().subtract(3, "day").toISOString();
      const schichtCode = normSchicht(schicht);

      // Duplikat/Spam-Check (wie oben)
      const { error: chkErr, count } = await supabase
        .from("DB_AnfrageMA")
        .select("id", { count: "exact", head: true })
        .eq("created_by", user_id)
        .eq("datum", datum)
        .eq("schicht", schichtCode)
        .eq("firma_id", firma_id)
        .eq("unit_id", unit_id)
        .is("genehmigt", null)
        .gte("created_at", windowStartISO);

      if (chkErr) throw chkErr;
      if ((count ?? 0) > 0) {
        setErrorMsg("In den letzten 3 Tagen wurde bereits ein offener Antrag für diesen Tag & diese Schicht gestellt.");
        setSending(false);
        return;
      }

      // Consent speichern (falls neu)
      if (!hasConsent) {
        const { error: cErr } = await supabase
          .from("DB_User")
          .update({ consent_anfragema: true, consent_anfragema_at: new Date().toISOString() })
          .eq("user_id", user_id);
        if (cErr) throw cErr;
        setHasConsent(true);
      }

      // Insert
      const { error: insErr } = await supabase.from("DB_AnfrageMA").insert({
        created_by: user_id,
        datum,
        schicht: schichtCode,
        antrag: "Urlaub beantragt",
        genehmigt: null,
        kommentar: "",
        firma_id,
        unit_id,
      });
      if (insErr) throw insErr;

      setSuccessMsg("Antrag gesendet.");
      setTimeout(() => { onClose?.(); }, 900);
    } catch (e) {
      console.error(e);
      setErrorMsg("Senden fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setSending(false);
    }
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
      <div className="relative w-[420px] max-w-[95%] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 shadow-xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>

        {/* Title */}
        <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Urlaub beantragen</h2>

        {/* Meta */}
        <ul className="text-sm mb-4 text-gray-700 dark:text-gray-300 space-y-1">
          <li><b>Tag:</b> {tag ?? "-"}</li>
          <li><b>Datum:</b> {fmt(datum)}</li>
          <li><b>Schicht:</b> {normSchicht(schicht)}</li>
        </ul>

        {/* Consent block */}
        {!hasConsent && (
          <div className="mb-4 p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm">
            <label className="flex items-start gap-2 select-none">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreeDSGVO}
                onChange={(e) => setAgreeDSGVO(e.target.checked)}
                disabled={loadingConsent}
              />
              <span>
                Ich habe die{" "}
                <button type="button" onClick={erstelleDatenschutzPDF} className="underline text-blue-600 hover:text-blue-800">
                  Datenschutzerklärung
                </button>{" "}
                gelesen und bin einverstanden.
              </span>
            </label>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
            <AlertTriangle className="w-4 h-4" /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            <CheckCircle className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Schließen
          </button>
          <button
            onClick={handleSend}
            disabled={sending || loadingConsent || (!hasConsent && !agreeDSGVO)}
            className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Senden…" : "Antrag senden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UrlaubsModal;
