import React, { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);

  // States für auf-/zuklappen
  const [offen, setOffen] = useState(true);
  const [tabelleOffen, setTabelleOffen] = useState(false);
  const [chartOffen, setChartOffen] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    const ladeDaten = async () => {
      setLoading(true);
      try {
        const aktuellesJahr = new Date().getFullYear();

        const { data: stundenData, error: stundenError } = await supabase
          .from("DB_Stunden")
          .select("*")
          .eq("user_id", userId)
          .eq("firma_id", firma)
          .eq("unit_id", unit)
          .eq("jahr", aktuellesJahr)
          .maybeSingle();

        if (stundenError) throw stundenError;

        const { data: urlaubData, error: urlaubError } = await supabase
          .from("DB_Urlaub")
          .select("*")
          .eq("user_id", userId)
          .eq("firma_id", firma)
          .eq("unit_id", unit)
          .eq("jahr", aktuellesJahr)
          .maybeSingle();

        if (urlaubError) throw urlaubError;

        setStunden(stundenData || {});
        setUrlaub(urlaubData || {});
      } catch (err) {
        console.error("❌ Fehler beim Laden der Übersicht:", err.message);
      } finally {
        setLoading(false);
      }
    };

    ladeDaten();
  }, [firma, unit, userId]);

  if (loading) return <div>Lade Übersicht...</div>;

  const monate = [
    "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
  ];

  // Berechnungen
  const stunden_gesamt = stunden.stunden_gesamt || 0;
  const summeIst = stunden.summe_jahr || 0;
  const restStd = summeIst - stunden_gesamt;
  const uebernahme_vorjahr = stunden.uebernahme_vorjahr

  const urlaub_gesamt = urlaub.urlaub_gesamt || 0;
  const urlaub_vorjahr = urlaub.uebernahme_vorjahr || 0;
  const urlaubSumme = urlaub.summe_jahr || 0;

  const urlaubUebrig = (urlaub_gesamt + urlaub_vorjahr - urlaubSumme);

  // Chartdaten
  let kumIst = 0;
  let kumSoll = 0;
  let kumUrlaub = 0;
  const vorgabeProMonat = stunden_gesamt / 12;

  const chartData = monate.map((name, i) => {
    const m = i + 1;
    const ist = stunden[`m${m}`] || 0;
    const soll = stunden[`soll_m${m}`] || 0;
    const urlaubMonat = urlaub[`m${m}`] || 0;

    kumIst += ist;
    kumSoll += soll;
    kumUrlaub += urlaubMonat;

    return {
      name,
      ist: kumIst,
      soll: kumSoll,
      ziel: vorgabeProMonat * m, // Ziel-Linie
      urlaub: kumUrlaub,
    };
  });

  return (
    <div className="rounded-xl shadow-xl py-4 px-1 border border-gray-300 dark:border-gray-700">
      {/* Überschrift mit Icons */}
      <div className="flex justify-between items-center ">
        <h3
          className="text-sm font-semibold cursor-pointer flex items-center gap-2 "
          onClick={() => setOffen(!offen)}
        >
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          Übersicht {new Date().getFullYear()}
        </h3>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        >
          <Info size={20} />
        </button>
      </div>

      {offen && (
        <div className="mt-2 space-y-3">
          {/* Neue Infozeilen */}
          {/* Neue Infozeilen */}
<div className="bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-700 p-3 border border-gray-400 rounded-xl shadow-xl mb-2">
  {/* Erste Zeile */}
  <div className="flex flex-wrap gap-4 items-center text-xs md:text-[16px] text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600 pb-2 mb-2">
    
    <div className="flex items-center gap-1">
      <span className="text-blue-600">⏱</span>
      <span>Std. Jahres zum Ende:</span> <b>
  {Number.isFinite(restStd)
    ? restStd.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '–'} h
</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-green-600">✔</span>
      <span>Geleistete Std.:</span> <b>{summeIst} h</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-orange-500">🎯</span>
      <span>Zu erbringende Std.:</span> <b>{stunden_gesamt} h</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-purple-500">↩</span>
      <span>Aus Vorjahr:</span> <b>{uebernahme_vorjahr} h</b>
    </div>
  </div>

  {/* Zweite Zeile */}
  <div className="flex flex-wrap gap-4 items-center text-xs md:text-sm text-gray-900 dark:text-gray-100">
    <div className="flex items-center gap-1">
      <span className="text-blue-600">🌴</span>
      <span>Urlaub übrig:</span> <b>{urlaubUebrig}</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-green-600">📝</span>
      <span>Urlaub eingetragen:</span> <b>{urlaubSumme}</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-orange-500">📅</span>
      <span>Urlaub Gesamt:</span> <b>{urlaub_gesamt}</b>
    </div>
    <div className="flex items-center gap-1">
      <span className="text-purple-500">↩</span>
      <span>Urlaub Vorjahr:</span> <b>{urlaub_vorjahr}</b>
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
                    <td className="p-1 border font-semibold w-40">Ist Stunden</td>
                    {monate.map((m, i) => (
                      <td key={m} className="p-1 border">{stunden[`m${i + 1}`] || 0}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-1 border font-semibold">Sollplan Stunden</td>
                    {monate.map((m, i) => (
                      <td key={m} className="p-1 border">{stunden[`soll_m${i + 1}`] || 0}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="p-1 border font-semibold">Urlaubstage</td>
                    {monate.map((m, i) => (
                      <td key={m} className="p-1 border">{urlaub[`m${i + 1}`] || 0}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
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
              <div className="h-96 w-full bg-gray-300 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 rounded-xl shadow-xl p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" label={{ value: "Stunden", angle: -90, position: 'insideLeft' }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[0, (urlaub.urlaub_gesamt || 0) + (urlaub.uebernahme_vorjahr || 0)]}
                      label={{ value: "Urlaubstage", angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="ist" stroke="#4CAF50" name="Ist Stunden" />
                    <Line yAxisId="left" type="monotone" dataKey="soll" stroke="#2196F3" name="Soll Stunden" />
                    <Line yAxisId="left" type="monotone" dataKey="ziel" stroke="#f44336" name="Vorgabe" strokeDasharray="5 5" />
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
              <li>Die Ist-Stunden sind die tatsächlich gearbeiteten Stunden.</li>
              <li>Die Sollplan-Stunden stammen aus dem geplanten Schichtplan.</li>
              <li>Die Vorgabe zeigt die Zielstunden für das Jahr (linear pro Monat).</li>
              <li>Urlaubstage werden kumuliert angezeigt.</li>
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

