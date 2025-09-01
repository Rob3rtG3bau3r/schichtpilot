import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { X } from "lucide-react";
import { erstelleDatenschutzPDF } from "../../utils/DatenschutzPDF";
import dayjs from "dayjs";

const BieteMichAnModal = ({ offen, onClose, tag, datum, schicht }) => {
  const user_id = localStorage.getItem("user_id");
  const firma_id = localStorage.getItem("firma_id");
  const unit_id = localStorage.getItem("unit_id");

  const [einwilligung, setEinwilligung] = useState(false);
  const [ladeStatus, setLadeStatus] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  const [fehlermsg, setFehlermsg] = useState("");

  useEffect(() => {
    if (!offen || !user_id) return;
    const holeConsent = async () => {
      setLadeStatus(true);
      const { data, error } = await supabase
        .from("DB_User")
        .select("consent_anfragema")
        .eq("user_id", user_id)
        .single();

      if (error) {
        console.error("Fehler beim Laden der Einwilligung:", error);
      } else {
        setEinwilligung(data?.consent_anfragema || false);
      }
      setLadeStatus(false);
    };
    holeConsent();
  }, [offen, user_id]);

  const handleAbschicken = async () => {
    if (sendet) return;
    setFehlermsg("");
    setSendet(true);

    try {
      // Einwilligung beim ersten Senden automatisch speichern
      if (!einwilligung) {
        const { error: consentError } = await supabase
          .from("DB_User")
          .update({
            consent_anfragema: true,
            consent_anfragema_at: new Date().toISOString(),
          })
          .eq("user_id", user_id);

        if (consentError) throw consentError;
        setEinwilligung(true);
      }

      const { error } = await supabase.from("DB_AnfrageMA").insert({
        created_by: user_id,
        datum,
        schicht,
        antrag: "Ich biete mich freiwillig an",
        genehmigt: null,
        kommentar: "",
        firma_id,
        unit_id,
      });

      if (error) throw error;

      setGesendet(true);
      setTimeout(() => {
        setGesendet(false);
        onClose();
      }, 1000);
    } catch (e) {
      console.error("Fehler beim Anlegen der Anfrage:", e);
      setFehlermsg("Senden fehlgeschlagen. Bitte später erneut versuchen.");
    } finally {
      setSendet(false);
    }
  };

  if (!offen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-center items-center backdrop-blur-sm">
      <div className="relative bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-6 rounded-xl shadow-xl w-[420px] max-w-[95%]">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>

        {/* Erfolgshinweis */}
        {gesendet && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm px-3 py-1 rounded-md shadow">
            Angebot gesendet
          </div>
        )}

        {/* Titel */}
        <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">
          Für Schicht anbieten
        </h2>

        {/* Datum */}
        <p className="text-gray-600 dark:text-gray-300 mb-3">
          Datum: <strong>{dayjs(datum).format("DD.MM.YYYY")}</strong>
        </p>

        {/* Schicht */}
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Schicht: <strong>{schicht}</strong>
        </p>

        {/* Einwilligungshinweis */}
        {!einwilligung && !ladeStatus && (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 rounded-md">
            <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
              Bevor du dich freiwillig anbieten kannst, benötigen wir deine
              Einwilligung zur Verarbeitung deiner Daten.
            </p>
            <button
              onClick={erstelleDatenschutzPDF}
              className="underline text-blue-600 hover:text-blue-800 text-sm"
            >
              📄 Datenschutzerklärung ansehen
            </button>
          </div>
        )}

        {/* Fehler */}
        {fehlermsg && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">
            {fehlermsg}
          </p>
        )}

        {/* Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md"
          >
            Schließen
          </button>

          <button
            onClick={handleAbschicken}
            disabled={sendet || ladeStatus}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-md"
          >
            {sendet ? "Senden…" : "Angebot senden"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BieteMichAnModal;

