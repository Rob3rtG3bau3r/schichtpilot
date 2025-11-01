import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const BedarfsMatrixAnzeige = ({ refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const lade = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select(`
          id, quali_id, schichtart, anzahl, normalbetrieb,
          DB_Qualifikationsmatrix(qualifikation, quali_kuerzel, betriebs_relevant, position)
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (!error) setRows(data || []);
    };
    lade();
  }, [firma, unit, refreshKey]);

  const matrix = useMemo(() => {
    const acc = new Map();
    for (const e of rows) {
      const quali = e.DB_Qualifikationsmatrix?.qualifikation || '—';
      const kuerzel = e.DB_Qualifikationsmatrix?.quali_kuerzel || '';
      const pos = e.DB_Qualifikationsmatrix?.position ?? 9999;
      const key = quali + '|' + kuerzel;

      if (!acc.has(key)) acc.set(key, { quali, kuerzel, pos, Früh: 0, Spät: 0, Nacht: 0 });
      const s = (e.schichtart || 'Früh');
      if (s === 'Früh' || s === 'Spät' || s === 'Nacht') {
        acc.get(key)[s] += (e.anzahl || 0);
      }
    }
    return Array.from(acc.values()).sort((a,b) => a.pos - b.pos || a.quali.localeCompare(b.quali, 'de'));
  }, [rows]);

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-xl shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-md font-semibold">Bedarfsübersicht (Matrix)</h3>
        <span className="text-xs text-gray-500">Summe pro Quali × Schicht</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="text-left p-2">Qualifikation</th>
              <th className="text-center p-2">Früh</th>
              <th className="text-center p-2">Spät</th>
              <th className="text-center p-2">Nacht</th>
            </tr>
          </thead>
          <tbody>
            {matrix.length === 0 ? (
              <tr><td className="p-3 text-gray-500 italic" colSpan={4}>Keine Einträge vorhanden.</td></tr>
            ) : (
              matrix.map((r) => (
                <tr key={r.quali+'|'+r.kuerzel} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="p-2">
                    <div className="font-medium">{r.quali}</div>
                    <div className="text-xs text-gray-500">{r.kuerzel}</div>
                  </td>
                  <td className="text-center p-2">{r.Früh}</td>
                  <td className="text-center p-2">{r.Spät}</td>
                  <td className="text-center p-2">{r.Nacht}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BedarfsMatrixAnzeige;
