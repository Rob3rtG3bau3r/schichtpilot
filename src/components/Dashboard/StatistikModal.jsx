import React, { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
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

const StatistikModal = ({ user, onClose }) => {
  const [stunden, setStunden] = useState({});
  const [urlaub, setUrlaub] = useState({});
  const jahr = new Date().getFullYear();
  const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  useEffect(() => {
    const ladeDaten = async () => {
      const { data: stundenData } = await supabase
        .from("DB_Stunden")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      const { data: urlaubData } = await supabase
        .from("DB_Urlaub")
        .select("*")
        .eq("user_id", user.user_id)
        .eq("jahr", jahr)
        .maybeSingle();

      setStunden(stundenData || {});
      setUrlaub(urlaubData || {});
    };

    ladeDaten();
  }, [user, jahr]);

  const summeIst = Array.from({ length: 12 }, (_, i) => stunden[`m${i + 1}`] || 0).reduce((a, b) => a + b, 0);
  const restStd = summeIst - (stunden.vorgabe_stunden || 0);
  const urlaubSumme = Array.from({ length: 12 }, (_, i) => urlaub[`m${i + 1}`] || 0).reduce((a, b) => a + b, 0);
  const urlaubUebrig = (urlaub.urlaub_soll || 0) + (urlaub.uebernahme_vorjahr || 0) - urlaubSumme;

  let kumIst = 0;
  let kumSoll = 0;
  let kumUrlaub = 0;
  const chartData = monate.map((name, i) => {
    const ist = stunden[`m${i + 1}`] || 0;
    const soll = stunden[`soll_m${i + 1}`] || 0;
    const urlaubM = urlaub[`m${i + 1}`] || 0;
    kumIst += ist;
    kumSoll += soll;
    kumUrlaub += urlaubM;
    return { name, ist: kumIst, soll: kumSoll, ziel: (stunden.vorgabe_stunden || 0) / 12 * (i + 1), urlaub: kumUrlaub };
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg w-full max-w-3xl shadow-xl relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500">✕</button>
        <h2 className="text-lg font-semibold mb-4">
          Statistiken für {user.vorname} {user.nachname}
        </h2>

        {/* Info-Zeilen */}
        <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded mb-4 text-sm">
          <div className="flex flex-wrap gap-4 mb-2">
            <span>Std. Jahres zum Ende: <b>{restStd}</b></span>
            <span>Geleistete Std.: <b>{summeIst}</b></span>
            <span>Zu erbringende Std.: <b>{stunden.vorgabe_stunden || 0}</b></span>
            <span>Aus Vorjahr: <b>{stunden.uebernahme_vorjahr || 0}</b></span>
          </div>
          <div className="flex flex-wrap gap-4">
            <span>Urlaub übrig: <b>{urlaubUebrig}</b></span>
            <span>Urlaub eingetragen: <b>{urlaubSumme}</b></span>
            <span>Urlaub Soll: <b>{urlaub.urlaub_soll || 0}</b></span>
            <span>Urlaub Vorjahr: <b>{urlaub.uebernahme_vorjahr || 0}</b></span>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 w-full bg-gray-300 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 rounded-xl shadow-md p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="ist" stroke="#4CAF50" name="Ist Stunden" />
              <Line yAxisId="left" type="monotone" dataKey="soll" stroke="#2196F3" name="Soll Stunden" />
              <Line yAxisId="left" type="monotone" dataKey="ziel" stroke="#f44336" name="Vorgabe" strokeDasharray="5 5" />
              <Line yAxisId="right" type="monotone" dataKey="urlaub" stroke="#FF9800" name="Urlaub (Tage)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StatistikModal;
