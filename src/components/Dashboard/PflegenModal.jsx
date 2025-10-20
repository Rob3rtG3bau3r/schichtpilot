// src/components/Dashboard/PflegenModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";
import { GripVertical, PanelLeftOpen, PanelRightOpen } from "lucide-react";

/* ----------------------------- UI Helpers ----------------------------- */
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
      className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </label>
);

const ReadonlySum = ({ label, value }) => (
  <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-baseline justify-between">
    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value ?? 0}</span>
  </div>
);

/* ----------------------------- Component ------------------------------ */
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

  // Anzeigeformat
  const fmtInt = (n) =>
    (Number(n) || 0).toLocaleString("de-DE", { maximumFractionDigits: 0 });
  const fmtStunden = (n) =>
    (Number(n) || 0).toLocaleString("de-DE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  // ❗ Vorjahr NICHT mehr in die Stunden-Summe einrechnen
  const stundenSumme = useMemo(
    () =>
      (Number(stunden.vorgabe_stunden) || 0) +
      (Number(stunden.korrektur) || 0),
    [stunden.vorgabe_stunden, stunden.korrektur]
  );
  const urlaubSumme = useMemo(
    () =>
      (Number(urlaub.urlaub_soll) || 0) +
      (Number(urlaub.korrektur) || 0) +
      (Number(urlaub.uebernahme_vorjahr) || 0),
    [urlaub.urlaub_soll, urlaub.korrektur, urlaub.uebernahme_vorjahr]
  );

  useEffect(
    () => setStunden((s) => ({ ...s, stunden_gesamt: stundenSumme })),
    [stundenSumme]
  );
  useEffect(
    () => setUrlaub((u) => ({ ...u, urlaub_gesamt: urlaubSumme })),
    [urlaubSumme]
  );

  /* ------------------------------ Daten laden ----------------------------- */
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

  /* -------------------------------- Speichern ----------------------------- */
  const handleSave = async (closeAfter) => {
    if (!user?.user_id) return;
    setSaving(true);
    try {
      // STUNDEN – Vorjahr NICHT in stunden_gesamt einrechnen
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
          (Number(stunden.korrektur) || 0), // ⬅️ ohne Vorjahr
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

      // URLAUB – unverändert (Vorjahr zählt mit)
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

      onRefresh?.();
      if (closeAfter) onClose?.();
    } catch (err) {
      console.error("❌ Fehler beim Speichern:", err.message);
    } finally {
      setSaving(false);
    }
  };

  /* --------- Drag & Dock (immer mittig im Undock-Modus + Persist Dock) -------- */
  // Persistiere Dock-Status: '', 'left', 'right'
  const [dock, setDock] = useState(() => {
    const v = localStorage.getItem("pflegen_modal_dock");
    return v === "left" || v === "right" ? v : null;
  });
  useEffect(() => {
    localStorage.setItem("pflegen_modal_dock", dock ?? "");
  }, [dock]);

  // Offset ab Center (damit kein Flackern oben-links)
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const startDrag = (e) => {
    if (dock) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    mouseRef.current = {
      dragging: true,
      startX: cx,
      startY: cy,
      initX: pos.x,
      initY: pos.y,
    };
    e.preventDefault?.();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!mouseRef.current.dragging || dock) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - mouseRef.current.startX;
      const dy = cy - mouseRef.current.startY;
      setPos({ x: mouseRef.current.initX + dx, y: mouseRef.current.initY + dy });
    };
    const onUp = () => (mouseRef.current.dragging = false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dock]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="rounded-xl bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-xl">
          Lade Daten…
        </div>
      </div>
    );
  }

  /* -------------------------------- Render -------------------------------- */
  const Card = ({ children }) => (
    <div className="bg-white text-gray-800 dark:bg-gray-900 dark:text-white border border-gray-500 p-6 rounded-xl w-[700px] shadow-lg">
      {children}
    </div>
  );

  const Header = () => (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          onMouseDown={startDrag}
          onTouchStart={startDrag}
          title="Verschieben"
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-move"
        >
          <GripVertical className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-bold">
          Daten pflegen – {user?.vorname} {user?.nachname} · {jahr}
        </h2>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDock((d) => (d === "left" ? null : "left"))}
          title={dock === "left" ? "Andocken lösen" : "Links andocken"}
          className={`p-1 rounded ${
            dock === "left"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
        <button
          onClick={() => setDock((d) => (d === "right" ? null : "right"))}
          title={dock === "right" ? "Andocken lösen" : "Rechts andocken"}
          className={`p-1 rounded ${
            dock === "right"
              ? "bg-blue-600 text-white"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          <PanelRightOpen className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          title="Schließen"
        >
          ✕
        </button>
      </div>
    </div>
  );

  const Content = () => (
    <div className="space-y-6">
      {/* STUNDEN */}
      <section className="rounded-xl border border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">Stunden</h3>
        <ReadonlySum
          label="Stunden gesamt"
          value={fmtStunden(stunden.stunden_gesamt)}
        />
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
      <section className="rounded-xl border border-gray-300 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
        <h3 className="font-semibold mb-3">Urlaub</h3>
        <ReadonlySum label="Urlaub gesamt" value={fmtInt(urlaub.urlaub_gesamt)} />
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
  );

  const Footer = () => (
    <div className="mt-6 flex justify-end gap-3">
      <button
        onClick={onClose}
        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-xl transition"
        disabled={saving}
      >
        Abbrechen
      </button>
      <button
        onClick={() => handleSave(false)}
        disabled={saving}
        className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition ${
          saving ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {saving ? "Speichern…" : "Speichern"}
      </button>
      <button
        onClick={() => handleSave(true)}
        disabled={saving}
        className={`bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-xl transition ${
          saving ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {saving ? "Speichern…" : "Speichern & Schließen"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* UND0CKED: immer mittig, Drag verschiebt nur Offset */}
      {!dock && (
        <div
          className="fixed left-1/2 top-1/2 z-[60]"
          style={{
            transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Card>
            <Header />
            <Content />
            <Footer />
          </Card>
        </div>
      )}

      {/* DOCKED LEFT */}
      {dock === "left" && (
        <div className="fixed left-0 top-0 h-screen w-[700px] z-[60]">
          <div className="h-full bg-white text-gray-800 dark:bg-gray-900 dark:text-white border-r border-gray-500 p-6 rounded-none shadow-lg">
            <Header />
            <Content />
            <Footer />
          </div>
        </div>
      )}

      {/* DOCKED RIGHT */}
      {dock === "right" && (
        <div className="fixed right-0 top-0 h-screen w-[700px] z-[60]">
          <div className="h-full bg-white text-gray-800 dark:bg-gray-900 dark:text-white border-l border-gray-500 p-6 rounded-none shadow-lg">
            <Header />
            <Content />
            <Footer />
          </div>
        </div>
      )}
    </div>
  );
};

export default PflegenModal;
