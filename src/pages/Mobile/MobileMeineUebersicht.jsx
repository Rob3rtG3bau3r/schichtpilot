import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";

const fmt = (n, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits })
    : "–";

const pct = (total, part) => (total > 0 ? (part / total) * 100 : 0);

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between text-sm py-0.5">
    <span className="text-gray-600 dark:text-gray-300">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export default function MobileMeineUebersicht() {
  const [loading, setLoading] = useState(true);
  const [jahr] = useState(new Date().getFullYear());
  const [err, setErr] = useState(null);

  const [stundenGesamt, setStundenGesamt] = useState(0);
  const [stundenSummeJahr, setStundenSummeJahr] = useState(0);

  const [urlaubGesamt, setUrlaubGesamt] = useState(0);
  const [urlaubSummeJahr, setUrlaubSummeJahr] = useState(0);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const me = localStorage.getItem("user_id");
      if (!me) {
        setErr("Nicht angemeldet.");
        setLoading(false);
        return;
      }

      // --- DB_Stunden ---
      const { data: stundenRows, error: e1 } = await supabase
        .from("DB_Stunden")
        .select("stunden_gesamt,summe_jahr,jahr")
        .eq("user_id", me)
        .eq("jahr", jahr);

      if (e1) throw e1;

      const sSum = (stundenRows || []).reduce(
        (acc, r) => acc + (Number(r?.summe_jahr) || 0),
        0
      );
      const sGes = Math.max(
        0,
        ...((stundenRows || [])
          .map((r) => Number(r?.stunden_gesamt))
          .filter((n) => Number.isFinite(n)))
      );

      setStundenSummeJahr(sSum);
      setStundenGesamt(Number.isFinite(sGes) ? sGes : 0);

      // --- DB_Urlaub ---
      const { data: urlaubRows, error: e2 } = await supabase
        .from("DB_Urlaub")
        .select("urlaub_gesamt,summe_jahr,jahr")
        .eq("user_id", me)
        .eq("jahr", jahr);

      if (e2) throw e2;

      const uSum = (urlaubRows || []).reduce(
        (acc, r) => acc + (Number(r?.summe_jahr) || 0),
        0
      );
      const uGes = Math.max(
        0,
        ...((urlaubRows || [])
          .map((r) => Number(r?.urlaub_gesamt))
          .filter((n) => Number.isFinite(n)))
      );

      setUrlaubSummeJahr(uSum);
      setUrlaubGesamt(Number.isFinite(uGes) ? uGes : 0);
    } catch (e) {
      console.error(e);
      setErr("Daten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [jahr]);

  useEffect(() => {
    load();
  }, [load]);

  const restStunden = (Number(stundenSummeJahr) || 0) - (Number(stundenGesamt) || 0);
  const restUrlaub = (Number(urlaubGesamt) || 0) - (Number(urlaubSummeJahr) || 0);
const pctStundenRaw = pct(Number(stundenGesamt) || 0, Number(stundenSummeJahr) || 0);
const pctUrlaubRaw  = pct(Number(urlaubGesamt)  || 0, Number(urlaubSummeJahr)  || 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Meine Übersicht</h2>
        <div className="text-sm opacity-80">{jahr}</div>
      </div>

      {loading && (
        <div className="text-sm opacity-80">Lade Daten…</div>
      )}
      {err && (
        <div className="text-sm text-red-500">{err}</div>
      )}

      {!loading && !err && (
        <div className="space-y-4">
          {/* Stunden */}
          <Card title="Arbeitsstunden (Jahr)">
            <div className="flex items-end justify-between">
              <div>
                <div className={`text-3xl font-bold ${restStunden < 0 ? "text-red-500" : "text-green-500"}`}>
                  {fmt(restStunden)} Std
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Differenz (Soll – Ist)</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fmt(stundenSummeJahr)} / {fmt(stundenGesamt)} Std</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Ist / Soll</div>
              </div>
            </div>

<div className="mt-3">
  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-visible">
    {/* bis 100% (grün) */}
    <div
      className="h-3 bg-green-600 rounded-l-full"
      style={{ width: `${Math.min(pctStundenRaw, 100)}%` }}
      aria-hidden
    />
    {/* darüber hinaus (rot) */}
    {pctStundenRaw > 100 && (
      <div
        className="h-3 bg-red-500 rounded-r-full absolute top-0"
        style={{ left: "100%", width: `${pctStundenRaw - 100}%` }}
        aria-hidden
      />
    )}
  </div>
  <div className={`mt-1 text-xs text-right ${pctStundenRaw > 100 ? "text-red-500" : "opacity-80"}`}>
    {pctStundenRaw.toFixed(0)}%
  </div>
</div>

            <div className="mt-3 space-y-1">
              <Row label="Soll (Jahr)" value={`${fmt(stundenGesamt)} Std`} />
              <Row label="Bisher (Jahr)" value={`${fmt(stundenSummeJahr)} Std`} />
              <Row
                label="Differenz"
                value={`${fmt(restStunden)} Std`}
              />
            </div>
          </Card>

          {/* Urlaub */}
          <Card title="Urlaub (Jahr)">
            <div className="flex items-end justify-between">
              <div>
                <div className={`text-3xl font-bold ${restUrlaub < 0 ? "text-red-500" : "text-green-500"}`}>
                  {fmt(restUrlaub, 1)} Tage
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Resturlaub (Gesamt – Verbraucht)</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{fmt(urlaubSummeJahr, 1)} / {fmt(urlaubGesamt, 1)} Tage</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Verbraucht / Gesamt</div>
              </div>
            </div>
<div className="mt-3">
  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-visible">
    <div
      className="h-3 bg-green-600 rounded-l-full"
      style={{ width: `${Math.min(pctUrlaubRaw, 100)}%` }}
      aria-hidden
    />
    {pctUrlaubRaw > 100 && (
      <div
        className="h-3 bg-red-500 rounded-r-full absolute top-0"
        style={{ left: "100%", width: `${pctUrlaubRaw - 100}%` }}
        aria-hidden
      />
    )}
  </div>
  <div className={`mt-1 text-xs text-right ${pctUrlaubRaw > 100 ? "text-red-500" : "opacity-80"}`}>
    {pctUrlaubRaw.toFixed(0)}%
  </div>
</div>

            <div className="mt-3 space-y-1">
              <Row label="Gesamt (Jahr)" value={`${fmt(urlaubGesamt, 1)} Tage`} />
              <Row label="Bisher (Jahr)" value={`${fmt(urlaubSummeJahr, 1)} Tage`} />
              <Row
                label="Rest"
                value={`${fmt(restUrlaub, 1)} Tage`}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-sm"
            >
              Aktualisieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
