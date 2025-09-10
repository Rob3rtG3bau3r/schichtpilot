import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";

const ZahlInput = ({ label, value, onChange }) => (
  <label className="text-xs font-medium text-gray-700 dark:text-gray-200">
    <span className="block mb-1">{label}</span>
    <input
      type="number"
      inputMode="numeric"
      max={999999}
      step={1}
      value={value ?? 0}
      onChange={(e) => {
        const v = e.target.value === "" ? 0 : Number(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </label>
);

const ReadonlySum = ({ label, value }) => (
  <div className="rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 flex items-baseline justify-between">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value ?? 0}</span>
  </div>
);

const PflegenModal = ({ user, onClose, onRefresh }) => {
  const jahr = new Date().getFullYear();
  const { sichtFirma: firma_id, sichtUnit: unit_id } = useRollen();

  const [stunden, setStunden] = useState({
    vorgabe_stunden: 0,
    korrektur: 0,
    uebernahme_vorjahr: 0,
    stunden_gesamt: 0,
  });

  const [urlaub, setUrlaub] = useState({
    urlaub_soll: 0,
    korrektur: 0,
    uebernahme_vorjahr: 0,
    urlaub_gesamt: 0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Live-Summen berechnen
  const stundenSumme = useMemo(
    () =>
      (Number(stunden.vorgabe_stunden) || 0) +
      (Number(stunden.korrektur) || 0) +
      (Number(stunden.uebernahme_vorjahr) || 0),
    [stunden.vorgabe_stunden, stunden.korrektur, stunden.uebernahme_vorjahr]
  );

  const urlaubSumme = useMemo(
    () =>
      (Number(urlaub.urlaub_soll) || 0) +
      (Number(urlaub.korrektur) || 0) +
      (Number(urlaub.uebernahme_vorjahr) || 0),
    [urlaub.urlaub_soll, urlaub.korrektur, urlaub.uebernahme_vorjahr]
  );

  useEffect(() => {
    setStunden((s) => ({ ...s, stunden_gesamt: stundenSumme }));
  }, [stundenSumme]);

  useEffect(() => {
    setUrlaub((u) => ({ ...u, urlaub_gesamt: urlaubSumme }));
  }, [urlaubSumme]);

  useEffect(() => {
    const ladeDaten = async () => {
      if (!user?.user_id) return;
      setLoading(true);
      try {
        const { data: stundenData, error: stundenError } = await supabase
          .from("DB_Stunden")
          .select(
            "vorgabe_stunden, korrektur, uebernahme_vorjahr, stunden_gesamt"
          )
          .eq("user_id", user.user_id)
          .eq("jahr", jahr)
          .maybeSingle();

        if (stundenError) throw stundenError;

        const { data: urlaubData, error: urlaubError } = await supabase
          .from("DB_Urlaub")
          .select("urlaub_soll, korrektur, uebernahme_vorjahr, urlaub_gesamt")
          .eq("user_id", user.user_id)
          .eq("jahr", jahr)
          .maybeSingle();

        if (urlaubError) throw urlaubError;

        setStunden(
          stundenData || {
            vorgabe_stunden: 0,
            korrektur: 0,
            uebernahme_vorjahr: 0,
            stunden_gesamt: 0,
          }
        );
        setUrlaub(
          urlaubData || {
            urlaub_soll: 0,
            korrektur: 0,
            uebernahme_vorjahr: 0,
            urlaub_gesamt: 0,
          }
        );
      } catch (err) {
        console.error("❌ Fehler beim Laden:", err.message);
      } finally {
        setLoading(false);
      }
    };

    ladeDaten();
  }, [user, jahr]);

  const handleSave = async (closeAfter) => {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      // --- STUNDEN ---
      const { data: stundenRow } = await supabase
        .from("DB_Stunden")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      const stundenPayload = {
        user_id: user.user_id,
        jahr,
        firma_id,
        unit_id,
        vorgabe_stunden: Number(stunden.vorgabe_stunden) || 0,
        korrektur: Number(stunden.korrektur) || 0,
        uebernahme_vorjahr: Number(stunden.uebernahme_vorjahr) || 0,
        stunden_gesamt:
          (Number(stunden.vorgabe_stunden) || 0) +
          (Number(stunden.korrektur) || 0) +
          (Number(stunden.uebernahme_vorjahr) || 0),
      };

      if (stundenRow) {
        await supabase
          .from("DB_Stunden")
          .update(stundenPayload)
          .eq("user_id", user.user_id)
          .eq("jahr", jahr);
      } else {
        await supabase.from("DB_Stunden").insert(stundenPayload);
      }

      // --- URLAUB ---
      const { data: urlaubRow } = await supabase
        .from("DB_Urlaub")
        .select("id")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      const urlaubPayload = {
        user_id: user.user_id,
        jahr,
        firma_id,
        unit_id,
        urlaub_soll: Number(urlaub.urlaub_soll) || 0,
        korrektur: Number(urlaub.korrektur) || 0,
        uebernahme_vorjahr: Number(urlaub.uebernahme_vorjahr) || 0,
        urlaub_gesamt:
          (Number(urlaub.urlaub_soll) || 0) +
          (Number(urlaub.korrektur) || 0) +
          (Number(urlaub.uebernahme_vorjahr) || 0),
      };

      if (urlaubRow) {
        await supabase
          .from("DB_Urlaub")
          .update(urlaubPayload)
          .eq("user_id", user.user_id)
          .eq("jahr", jahr);
      } else {
        await supabase.from("DB_Urlaub").insert(urlaubPayload);
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
      <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
        <div className="rounded-xl bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-xl">
          Lade Daten…
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl w-[min(440px,92vw)] shadow-2xl border border-gray-200 dark:border-gray-700 relative">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Daten pflegen: {user?.vorname} {user?.nachname} · {jahr}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-2 py-2 space-y-6">
          {/* STUNDEN */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-2 bg-gray-200 dark:bg-gray-900">
            <h3 className="font-semibold mb-2">Stunden</h3>
            <ReadonlySum label="Stunden gesamt" value={stunden.stunden_gesamt} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <ZahlInput
                label="Vorgabe"
                value={stunden.vorgabe_stunden}
                onChange={(v) =>
                  setStunden((s) => ({ ...s, vorgabe_stunden: v }))
                }
              />
              <ZahlInput
                label="Korrektur"
                value={stunden.korrektur}
                onChange={(v) => setStunden((s) => ({ ...s, korrektur: v }))}
              />
              <ZahlInput
                label="Vorjahr"
                value={stunden.uebernahme_vorjahr}
                onChange={(v) =>
                  setStunden((s) => ({ ...s, uebernahme_vorjahr: v }))
                }
              />
            </div>
          </section>

          {/* URLAUB */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
            <h3 className="font-semibold mb-3">Urlaub</h3>
            <ReadonlySum label="Urlaub gesamt" value={urlaub.urlaub_gesamt} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <ZahlInput
                label="Vorgabe"
                value={urlaub.urlaub_soll}
                onChange={(v) => setUrlaub((u) => ({ ...u, urlaub_soll: v }))}
              />
              <ZahlInput
                label="Korrektur"
                value={urlaub.korrektur}
                onChange={(v) => setUrlaub((u) => ({ ...u, korrektur: v }))}
              />
              <ZahlInput
                label="Vorjahr"
                value={urlaub.uebernahme_vorjahr}
                onChange={(v) =>
                  setUrlaub((u) => ({ ...u, uebernahme_vorjahr: v }))
                }
              />
            </div>
          </section>
        </div>

        {/* Footer / Buttons */}
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Abbrechen
          </button>
          <button
            onClick={() => handleSave(false)}
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition"
            disabled={saving}
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
          <button
            onClick={() => handleSave(true)}
            className="px-3 py-2 rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition"
            disabled={saving}
          >
            {saving ? "Speichern…" : "Speichern & Schließen"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PflegenModal;
