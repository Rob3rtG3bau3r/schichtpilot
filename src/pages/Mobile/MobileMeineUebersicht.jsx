import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../supabaseClient";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const fmt = (n, digits = 2) =>
  Number.isFinite(n)
    ? n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: digits })
    : "–";

const pct = (total, part) => (total > 0 ? (part / total) * 100 : 0);

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-300/20 dark:bg-gray-800 p-4 shadow-sm">
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

const YearSelect = ({ value, onChange }) => {
  const now = new Date().getFullYear();
  const options = [now - 1, now];

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40
                 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none
                 focus:ring-2 focus:ring-gray-400/40"
    >
      {options.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
};

export default function MobileMeineUebersicht() {
  const [loading, setLoading] = useState(true);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [err, setErr] = useState(null);

  // Stunden
  const [stundenGesamt, setStundenGesamt] = useState(0); // vorgabe_stunden
  const [stundenSummeJahr, setStundenSummeJahr] = useState(0); // summe_jahr
  const [stundenUebernahmeVorjahr, setStundenUebernahmeVorjahr] = useState(0); // uebernahme_vorjahr
  const [stundenAbzugSummeJahr, setStundenAbzugSummeJahr] = useState(0); // sum(stunden)

  // Urlaub
  const [urlaubGesamt, setUrlaubGesamt] = useState(0); // urlaub_gesamt
  const [urlaubSummeJahr, setUrlaubSummeJahr] = useState(0); // summe_jahr
  const [urlaubUebernahmeVorjahr, setUrlaubUebernahmeVorjahr] = useState(0); // uebernahme_vorjahr

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const me = localStorage.getItem("user_id");
      if (!me) {
        setErr("Nicht angemeldet.");
        return;
      }

      // --- DB_Stunden ---
      const { data: stundenRows, error: e1 } = await supabase
        .from("DB_Stunden")
        .select("vorgabe_stunden,summe_jahr,uebernahme_vorjahr,jahr")
        .eq("user_id", me)
        .eq("jahr", jahr);

      if (e1) throw e1;

      const sSum = (stundenRows || []).reduce((acc, r) => acc + num(r?.summe_jahr), 0);

      const sGes = Math.max(
        0,
        ...((stundenRows || []).map((r) => Number(r?.vorgabe_stunden)).filter((n) => Number.isFinite(n)))
      );

      const sVorj = Math.max(
        0,
        ...((stundenRows || []).map((r) => Number(r?.uebernahme_vorjahr)).filter((n) => Number.isFinite(n)))
      );

      setStundenSummeJahr(sSum);
      setStundenGesamt(Number.isFinite(sGes) ? sGes : 0);
      setStundenUebernahmeVorjahr(Number.isFinite(sVorj) ? sVorj : 0);

      // --- DB_StundenAbzug ---
      const { data: abzugRows, error: eAb } = await supabase
        .from("DB_StundenAbzug")
        .select("stunden,jahr")
        .eq("user_id", me)
        .eq("jahr", jahr);

      if (eAb) throw eAb;

      const abzugSum = (abzugRows || []).reduce((acc, r) => acc + num(r?.stunden), 0);
      setStundenAbzugSummeJahr(abzugSum);

      // --- DB_Urlaub ---
      const { data: urlaubRows, error: e2 } = await supabase
        .from("DB_Urlaub")
        .select("urlaub_gesamt,summe_jahr,uebernahme_vorjahr,jahr")
        .eq("user_id", me)
        .eq("jahr", jahr);

      if (e2) throw e2;

      const uSum = (urlaubRows || []).reduce((acc, r) => acc + num(r?.summe_jahr), 0);

      const uGes = Math.max(
        0,
        ...((urlaubRows || []).map((r) => Number(r?.urlaub_gesamt)).filter((n) => Number.isFinite(n)))
      );

      const uVorj = Math.max(
        0,
        ...((urlaubRows || []).map((r) => Number(r?.uebernahme_vorjahr)).filter((n) => Number.isFinite(n)))
      );

      setUrlaubSummeJahr(uSum);
      setUrlaubGesamt(Number.isFinite(uGes) ? uGes : 0);
      setUrlaubUebernahmeVorjahr(Number.isFinite(uVorj) ? uVorj : 0);
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

  // ---- Berechnungen ----
  const istStundenInklVorjahrRaw = num(stundenSummeJahr) + num(stundenUebernahmeVorjahr);
  const istStundenInklVorjahr = istStundenInklVorjahrRaw - num(stundenAbzugSummeJahr);
  const restStunden = istStundenInklVorjahr - num(stundenGesamt);

  const istUrlaub = num(urlaubSummeJahr);
  const urlaubSollInklVorjahr = num(urlaubGesamt) + num(urlaubUebernahmeVorjahr);
  const restUrlaub = urlaubSollInklVorjahr - istUrlaub;

  const pctStundenRaw = pct(num(stundenGesamt), istStundenInklVorjahr);
  const pctUrlaubRaw = pct(urlaubSollInklVorjahr, istUrlaub);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Meine Übersicht</h2>
        <YearSelect value={jahr} onChange={setJahr} />
      </div>

      {loading && <div className="text-sm opacity-80">Lade Daten…</div>}
      {err && <div className="text-sm text-red-500">{err}</div>}

      {!loading && !err && (
        <div className="space-y-4 bg-gray-200 dark:bg-gray-900">
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
                <div className="text-sm font-medium">
                  {fmt(istStundenInklVorjahr)} / {fmt(stundenGesamt)} Std
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Ist (inkl. Vorjahr - Abzug) / Soll</div>
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full relative overflow-visible">
                <div
                  className="h-3 bg-green-600 rounded-l-full"
                  style={{ width: `${Math.min(pctStundenRaw, 100)}%` }}
                  aria-hidden
                />
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
              <Row label="Std. Vorgabe" value={`${fmt(stundenGesamt)} Std`} />
              <Row label="Bisherige Std. (inkl. Vorjahr)" value={`${fmt(istStundenInklVorjahrRaw)} Std`} />
              <Row label="Stundenabzug (Jahr)" value={`-${fmt(stundenAbzugSummeJahr)} Std`} />
              <Row label="Differenz (Soll – Ist)" value={`${fmt(restStunden)} Std`} />
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
                <div className="text-sm font-medium">
                  {fmt(istUrlaub, 1)} / {fmt(urlaubSollInklVorjahr, 1)} Tage
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Verbraucht / Gesamt (inkl. Vorjahr)</div>
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
              <Row label="Gesamt (inkl. Vorjahr)" value={`${fmt(urlaubSollInklVorjahr, 1)} Tage`} />
              <Row label="Verbraucht (Jahr)" value={`${fmt(istUrlaub, 1)} Tage`} />
              <Row label="Rest" value={`${fmt(restUrlaub, 1)} Tage`} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
