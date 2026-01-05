import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient";
import { useRollen } from "../../context/RollenContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChevronDown, ChevronRight, Info } from "lucide-react";

const MeineUebersicht = () => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const [stunden, setStunden] = useState({});
  const [urlaub, setUrlaub] = useState({});
  const [abzuege, setAbzuege] = useState([]);
  const [loading, setLoading] = useState(true);

  // States für auf-/zuklappen
  const [offen, setOffen] = useState(true);
  const [tabelleOffen, setTabelleOffen] = useState(false);
  const [chartOffen, setChartOffen] = useState(false);
  const [abzugOffen, setAbzugOffen] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  const aktuellesJahr = new Date().getFullYear();

  // ✅ Limits: max 3 Jahre zurück, max 1 Jahr vor
  const minYear = aktuellesJahr - 3;
  const maxYear = aktuellesJahr + 1;

  const [selectedYear, setSelectedYear] = useState(aktuellesJahr);

  useEffect(() => {
    const ladeDaten = async () => {
      setLoading(true);
      try {
        const { data: stundenData, error: stundenError } = await supabase
          .from("DB_Stunden")
          .select("*")
          .eq("user_id", userId)
          .eq("firma_id", firma)
          .eq("unit_id", unit)
          .eq("jahr", selectedYear)
          .maybeSingle();
        if (stundenError) throw stundenError;

        const { data: urlaubData, error: urlaubError } = await supabase
          .from("DB_Urlaub")
          .select("*")
          .eq("user_id", userId)
          .eq("firma_id", firma)
          .eq("unit_id", unit)
          .eq("jahr", selectedYear)
          .maybeSingle();
        if (urlaubError) throw urlaubError;

        const { data: abzugData, error: abzugError } = await supabase
          .from("DB_StundenAbzug")
          .select("id, datum, stunden, kommentar")
          .eq("user_id", userId)
          .eq("firma_id", firma)
          .eq("unit_id", unit)
          .eq("jahr", selectedYear)
          .order("datum", { ascending: false });
        if (abzugError) throw abzugError;

        setStunden(stundenData || {});
        setUrlaub(urlaubData || {});
        setAbzuege(abzugData || []);
      } catch (err) {
        console.error("❌ Fehler beim Laden der Übersicht:", err.message);
      } finally {
        setLoading(false);
      }
    };

    if (firma && unit && userId) ladeDaten();
  }, [firma, unit, userId, selectedYear]);

  // ✅ Hooks immer vor conditional returns
  const abzugSumme = useMemo(
    () => (abzuege || []).reduce((acc, r) => acc + (Number(r?.stunden) || 0), 0),
    [abzuege]
  );

  if (loading) return <div>Lade Übersicht...</div>;

  const monate = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ];

  // ---------------- Hilfsfunktionen ----------------
  const fmt2 = (n) =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "0,00";

  const diffClass = (v) =>
    v > 0 ? "text-green-600"
      : v < 0 ? "text-red-600"
        : "text-gray-700";

  // ---------------- Berechnungen ----------------
  const vorgabe_stunden = Number(stunden.vorgabe_stunden) || 0;
  const uebernahme_vorjahr = Number(stunden.uebernahme_vorjahr) || 0;

  // ✅ Abzug von summe_jahr
  const summeJahrEffektiv = (Number(stunden.summe_jahr) || 0) - abzugSumme;

  const summeIst = summeJahrEffektiv + uebernahme_vorjahr;

  // ✅ Stunden zum Jahresende: Ist − Vorgabe
  const restStd = summeIst - vorgabe_stunden;

  // Urlaub
  const urlaub_gesamt = Number(urlaub.urlaub_gesamt) || 0;
  const urlaub_vorjahr = Number(urlaub.uebernahme_vorjahr) || 0;
  const urlaubSumme = Number(urlaub.summe_jahr) || 0;
  const urlaubUebrig = urlaub_gesamt + urlaub_vorjahr - urlaubSumme;

  // ---------------- Chartdaten ----------------
  let kumIst = uebernahme_vorjahr - abzugSumme;
  let kumSoll = 0;
  let kumUrlaub = 0;

  const vorgabeProMonat = vorgabe_stunden / 12;

  const chartData = monate.map((name, i) => {
    const m = i + 1;
    const ist = Number(stunden[`m${m}`]) || 0;
    const soll = Number(stunden[`soll_m${m}`]) || 0;
    const urlaubMonat = Number(urlaub[`m${m}`]) || 0;

    kumIst += ist;
    kumSoll += soll;
    kumUrlaub += urlaubMonat;

    return {
      name,
      ist: kumIst,
      soll: kumSoll,
      ziel: vorgabeProMonat * m,
      urlaub: kumUrlaub,
    };
  });

  // ✅ Button-States (Limits)
  const canPrev = selectedYear > minYear;
  const canNext = selectedYear < maxYear;

  const btnBase =
    "px-2 py-1 rounded-lg text-xs border border-gray-300 dark:border-gray-700";
  const btnHover = "hover:bg-gray-200 dark:hover:bg-gray-800";
  const btnDisabled = "opacity-40 cursor-not-allowed";

  return (
    <div className="rounded-xl shadow-xl py-4 px-1 border border-gray-300 dark:border-gray-700">
      {/* Überschrift */}
      <div className="flex justify-between items-center">
        <h3
          className="text-sm font-semibold cursor-pointer flex items-center gap-2"
          onClick={() => setOffen(!offen)}
        >
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          Übersicht {selectedYear}
        </h3>

        <div className="flex items-center gap-2">
          {/* ✅ Vorjahr (mit Limit) */}
          <button
            className={`${btnBase} ${canPrev ? btnHover : btnDisabled}`}
            disabled={!canPrev}
            onClick={(e) => {
              e.stopPropagation();
              if (!canPrev) return;
              setSelectedYear((y) => Math.max(minYear, y - 1));
            }}
            title={canPrev ? "Ein Jahr zurück" : `Maximal bis ${minYear}`}
          >
            ← {selectedYear - 1}
          </button>

          {/* ✅ Heute */}
          <button
            className={`px-2 py-1 rounded-lg text-xs border ${
              selectedYear === aktuellesJahr
                ? "bg-blue-600 text-white border-blue-600"
                : `border-gray-300 dark:border-gray-700 ${btnHover}`
            }`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedYear(aktuellesJahr);
            }}
            title="Aktuelles Jahr"
          >
            Heute
          </button>

          {/* ✅ Folgejahr (max +1) */}
          <button
            className={`${btnBase} ${canNext ? btnHover : btnDisabled}`}
            disabled={!canNext}
            onClick={(e) => {
              e.stopPropagation();
              if (!canNext) return;
              setSelectedYear((y) => Math.min(maxYear, y + 1));
            }}
            title={canNext ? "Ein Jahr vor" : `Maximal bis ${maxYear}`}
          >
            {selectedYear + 1} →
          </button>

          <button
            className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              setInfoOffen(true);
            }}
            title="Info"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {offen && (
        <div className="mt-2 space-y-3">
          {/* Info-Box */}
          <div className="bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-700 p-3 border border-gray-400 rounded-xl shadow-xl mb-2">
            <div className="flex flex-wrap gap-4 items-center text-xs md:text-[16px] text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600 pb-2 mb-2">
              <div className="flex items-center gap-1">
                <span>Vorgabe Jahresstunden:</span> <b>{fmt2(vorgabe_stunden)} h</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Ist-Stunden (inkl. Vorjahr, −Abzug):</span> <b>{fmt2(summeIst)} h</b>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-blue-600">⏱</span>
                <span>Stunden zum Jahresende:</span> <b>{fmt2(restStd)} h</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Stunden aus dem Vorjahr:</span> <b>{fmt2(uebernahme_vorjahr)} h</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Abzug (Jahr):</span> <b>{fmt2(abzugSumme)} h</b>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 items-center text-xs md:text-sm text-gray-900 dark:text-gray-100">
              <div className="flex items-center gap-1">
                <span>Urlaub übrig:</span> <b>{urlaubUebrig}</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Urlaub eingetragen:</span> <b>{urlaubSumme}</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Urlaub gesamt:</span> <b>{urlaub_gesamt}</b>
              </div>
              <div className="flex items-center gap-1">
                <span>Urlaub aus Vorjahr:</span> <b>{urlaub_vorjahr}</b>
              </div>
            </div>
          </div>

          {/* Tabelle */}
          <div className="mb-2">
            <div
              className="cursor-pointer flex items-center gap-2 mb-1 font-semibold"
              onClick={() => setTabelleOffen(!tabelleOffen)}
            >
              {tabelleOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              Tabelle
            </div>

            {tabelleOffen && (
              <table className="w-full border-collapse bg-gray-300 dark:bg-gray-900 text-xs text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-sm mb-4 shadow-xl">
                <thead className="bg-gray-400 dark:bg-gray-300">
                  <tr>
                    <th className="text-gray-900 border">Monat</th>
                    {monate.map((m) => (
                      <th key={m} className="text-gray-900 border">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1 border font-semibold w-40">Ist-Stunden</td>
                    {monate.map((m, i) => {
                      const ist = Number(stunden[`m${i + 1}`]) || 0;
                      return <td key={m} className="p-1 border">{fmt2(ist)}</td>;
                    })}
                  </tr>

                  <tr>
                    <td className="p-1 border font-semibold">Stunden laut Sollplan</td>
                    {monate.map((m, i) => {
                      const soll = Number(stunden[`soll_m${i + 1}`]) || 0;
                      return <td key={m} className="p-1 border">{fmt2(soll)}</td>;
                    })}
                  </tr>

                  <tr>
                    <td className="p-1 border font-semibold">Differenz (Ist − Soll)</td>
                    {monate.map((m, i) => {
                      const ist = Number(stunden[`m${i + 1}`]) || 0;
                      const soll = Number(stunden[`soll_m${i + 1}`]) || 0;
                      const diff = ist - soll;
                      return (
                        <td key={m} className={`p-1 border font-semibold ${diffClass(diff)}`}>
                          {fmt2(diff)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr>
                    <td className="p-1 border font-semibold">Urlaubstage</td>
                    {monate.map((m, i) => {
                      const u = Number(urlaub[`m${i + 1}`]) || 0;
                      return <td key={m} className="p-1 border">{fmt2(u)}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Abzüge */}
          <div className="mb-2">
            <div
              className="cursor-pointer flex items-center gap-2 mb-1 font-semibold"
              onClick={() => setAbzugOffen(!abzugOffen)}
            >
              {abzugOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              Stunden-Abzug{" "}
              <span className="text-xs text-gray-600 dark:text-gray-300">
                ({fmt2(abzugSumme)} h)
              </span>
            </div>

            {abzugOffen && (
              <div className="bg-gray-200 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 rounded-xl shadow-xl p-2">
                {(!abzuege || abzuege.length === 0) ? (
                  <div className="text-sm text-gray-600 dark:text-gray-300 p-2">
                    Keine Abzüge im Jahr vorhanden.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-left">
                        <th className="p-2 border-b border-gray-300 dark:border-gray-700">Datum</th>
                        <th className="p-2 border-b border-gray-300 dark:border-gray-700">Stunden</th>
                        <th className="p-2 border-b border-gray-300 dark:border-gray-700">Kommentar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {abzuege.map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="p-2 border-b border-gray-300 dark:border-gray-800">
                            {r.datum ? new Date(r.datum).toLocaleDateString("de-DE") : "–"}
                          </td>
                          <td className="p-2 border-b border-gray-300 dark:border-gray-800 font-semibold">
                            {fmt2(r.stunden)} h
                          </td>
                          <td className="p-2 border-b border-gray-300 dark:border-gray-800">
                            {r.kommentar || "–"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          {/* Chart */}
          <div>
            <div
              className="cursor-pointer flex items-center gap-2 mb-1 font-semibold"
              onClick={() => setChartOffen(!chartOffen)}
            >
              {chartOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              Chart
            </div>

            {chartOffen && (
              <div className="h-96 w-full bg-gray-200 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 rounded-xl shadow-xl p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" label={{ value: "Stunden", angle: -90, position: "insideLeft" }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, (urlaub.urlaub_gesamt || 0) + (urlaub.uebernahme_vorjahr || 0)]}
                      label={{ value: "Urlaubstage", angle: 90, position: "insideRight" }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="ist" stroke="#4CAF50" name="Ist-Stunden (inkl. Vorjahr, −Abzug)" />
                    <Line yAxisId="left" type="monotone" dataKey="soll" stroke="#2196F3" name="Stunden laut Sollplan" />
                    <Line yAxisId="left" type="monotone" dataKey="ziel" stroke="#f44336" name="Vorgabe Jahresstunden" strokeDasharray="5 5" />
                    <Line yAxisId="right" type="monotone" dataKey="urlaub" stroke="#FF9800" name="Urlaub (Tage)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-6 rounded-xl shadow-xl w-96 animate-fade-in relative">
            <h2 className="text-lg font-bold mb-2">Info</h2>
            <ul className="text-sm list-disc pl-5 space-y-1">
              <li><b>Vorgabe</b> kommt aus <b>vorgabe_stunden</b>.</li>
              <li><b>Abzug</b> ist die Jahressumme aus <b>DB_StundenAbzug.stunden</b> und wird von <b>summe_jahr</b> abgezogen.</li>
              <li><b>Ist-Stunden</b> sind <b>(summe_jahr − abzug) + uebernahme_vorjahr</b>.</li>
              <li><b>Stunden zum Jahresende</b> ist <b>Ist − Vorgabe</b>.</li>
              <li>Jahresauswahl ist begrenzt: <b>{minYear}</b> bis <b>{maxYear}</b>.</li>
            </ul>
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-700"
              onClick={() => setInfoOffen(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeineUebersicht;
