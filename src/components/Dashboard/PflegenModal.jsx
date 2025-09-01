import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";

const PflegenModal = ({ user, onClose, onRefresh }) => {
  const jahr = new Date().getFullYear();
  const { sichtFirma: firma_id, sichtUnit: unit_id } = useRollen();

  const [stunden, setStunden] = useState({
    vorgabe_stunden: 0,
    korrektur: 0,
    uebernahme_vorjahr: 0,
  });

  const [urlaub, setUrlaub] = useState({
    urlaub_soll: 0,
    korrektur: 0,
    uebernahme_vorjahr: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ladeDaten = async () => {
      setLoading(true);
      try {
        const { data: stundenData, error: stundenError } = await supabase
          .from("DB_Stunden")
          .select("vorgabe_stunden, korrektur, uebernahme_vorjahr")
          .eq("user_id", user.user_id)
          .eq("jahr", jahr)
          .maybeSingle();

        if (stundenError) throw stundenError;

        const { data: urlaubData, error: urlaubError } = await supabase
          .from("DB_Urlaub")
          .select("urlaub_soll, korrektur, uebernahme_vorjahr")
          .eq("user_id", user.user_id)
          .eq("jahr", jahr)
          .maybeSingle();

        if (urlaubError) throw urlaubError;

        setStunden(stundenData || { vorgabe_stunden: 0, korrektur: 0, uebernahme_vorjahr: 0 });
        setUrlaub(urlaubData || { urlaub_soll: 0, korrektur: 0, uebernahme_vorjahr: 0 });
      } catch (err) {
        console.error("❌ Fehler beim Laden:", err.message);
      } finally {
        setLoading(false);
      }
    };

    ladeDaten();
  }, [user, jahr]);

  const handleSave = async (closeAfter) => {
    setSaving(true);
    try {
      // Stunden prüfen
      const { data: stundenExistiert } = await supabase
        .from("DB_Stunden")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      if (stundenExistiert) {
        await supabase
          .from("DB_Stunden")
          .update({
            vorgabe_stunden: stunden.vorgabe_stunden,
            korrektur: stunden.korrektur,
            uebernahme_vorjahr: stunden.uebernahme_vorjahr,
          })
          .eq("user_id", user.user_id)
          .eq("jahr", jahr);
      } else {
        await supabase
          .from("DB_Stunden")
          .insert({
            user_id: user.user_id,
            jahr,
            firma_id,
            unit_id,
            vorgabe_stunden: stunden.vorgabe_stunden,
            korrektur: stunden.korrektur,
            uebernahme_vorjahr: stunden.uebernahme_vorjahr,
          });
      }

      // Urlaub prüfen
      const { data: urlaubExistiert } = await supabase
        .from("DB_Urlaub")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      if (urlaubExistiert) {
        await supabase
          .from("DB_Urlaub")
          .update({
            urlaub_soll: urlaub.urlaub_soll,
            korrektur: urlaub.korrektur,
            uebernahme_vorjahr: urlaub.uebernahme_vorjahr,
          })
          .eq("user_id", user.user_id)
          .eq("jahr", jahr);
      } else {
        await supabase
          .from("DB_Urlaub")
          .insert({
            user_id: user.user_id,
            jahr,
            firma_id,
            unit_id,
            urlaub_soll: urlaub.urlaub_soll,
            korrektur: urlaub.korrektur,
            uebernahme_vorjahr: urlaub.uebernahme_vorjahr,
          });
      }
      if (onRefresh) onRefresh();
      if (closeAfter) onClose();
    } catch (err) {
      console.error("❌ Fehler beim Speichern:", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40">
        Lade Daten...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-200 dark:bg-gray-800 bg-opacity-50 dark:bg-opacity-50 z-50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl w-100 max-w-md shadow-xl relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-400">✕</button>
        <h2 className="text-lg font-semibold mb-4">
          Daten pflegen: {user.vorname} {user.nachname}
        </h2>

        {/* Stunden-Sektion */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Stunden</h3>
          <div className="flex flex-col gap-2">
            <label>Stunden Vorgabe:
              <input type="number" value={stunden.vorgabe_stunden || 0}
                onChange={(e) => setStunden({ ...stunden, vorgabe_stunden: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
            <label>Stunden Korrektur:
              <input type="number" value={stunden.korrektur || 0}
                onChange={(e) => setStunden({ ...stunden, korrektur: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
            <label>Stunden Vorjahr:
              <input type="number" value={stunden.uebernahme_vorjahr || 0}
                onChange={(e) => setStunden({ ...stunden, uebernahme_vorjahr: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
          </div>
        </div>

        {/* Urlaub-Sektion */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Urlaub</h3>
          <div className="flex flex-col gap-2">
            <label>Urlaub Vorgabe:
              <input type="number" value={urlaub.urlaub_soll || 0}
                onChange={(e) => setUrlaub({ ...urlaub, urlaub_soll: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
            <label>Urlaub Korrektur:
              <input type="number" value={urlaub.korrektur || 0}
                onChange={(e) => setUrlaub({ ...urlaub, korrektur: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
            <label>Urlaub Vorjahr:
              <input type="number" value={urlaub.uebernahme_vorjahr || 0}
                onChange={(e) => setUrlaub({ ...urlaub, uebernahme_vorjahr: Number(e.target.value) })}
                className="bg-gray-200 text-gray-900 border p-1 rounded w-full" />
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-gray-500 rounded">Abbrechen</button>
          <button onClick={() => handleSave(false)} className="px-3 py-1 bg-blue-500 text-white rounded">
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <button onClick={() => handleSave(true)} className="px-3 py-1 bg-green-500 text-white rounded">
            {saving ? "Speichern…" : "Speichern & Schließen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PflegenModal;
