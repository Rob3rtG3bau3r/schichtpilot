// src/components/SystemTools/DataCleanUpTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';

function toYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DataCleanUpTab() {
  const [dateStr, setDateStr] = useState(() => toYMD(new Date()));
  const [onlyChanges, setOnlyChanges] = useState(true); // rows_affected > 0
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { startISO, endISO } = useMemo(() => {
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [dateStr]);

  const load = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      let q = supabase
        .from('DB_DataCleanupLog') // Groß-/Kleinschreibung beachten
        .select('id, run_at, table_name, cutoff_date, cutoff_year, rows_affected, dry_run, notes')
        .gte('run_at', startISO)
        .lt('run_at', endISO)
        .order('run_at', { ascending: false });

      if (onlyChanges) q = q.gt('rows_affected', 0);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
    } catch (e) {
      setErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Cleanup-Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, onlyChanges]);

  const changeDay = (delta) => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + delta);
    setDateStr(toYMD(d));
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex flex-wrap items-center gap-3 justify-between mb-3">
        <h2 className="text-xl font-semibold">Data Cleanup Log</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDay(-1)}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
            title="Vortag"
          >
            −1 Tag
          </button>
          <input
            type="date"
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1"
            value={dateStr}
            onChange={(e) => setDateStr(e.target.value)}
          />
          <button
            onClick={() => changeDay(1)}
            className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
            title="Folgetag"
          >
            +1 Tag
          </button>

          <label className="ml-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-blue-500"
              checked={onlyChanges}
              onChange={(e) => setOnlyChanges(e.target.checked)}
            />
            nur mit Änderungen (rows_affected &gt; 0)
          </label>

          <button
            onClick={load}
            className="ml-3 px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            disabled={loading}
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {errorMsg && <div className="mb-3 text-red-400 text-sm">{errorMsg}</div>}

      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Zeit</th>
              <th className="px-3 py-2 text-left">Tabelle / Job</th>
              <th className="px-3 py-2 text-left">cutoff_date</th>
              <th className="px-3 py-2 text-left">cutoff_year</th>
              <th className="px-3 py-2 text-left">rows_affected</th>
              <th className="px-3 py-2 text-left">dry_run</th>
              <th className="px-3 py-2 text-left">Notizen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-gray-900 even:bg-gray-850 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{r.run_at ? new Date(r.run_at).toLocaleString() : '—'}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold">{r.table_name || '—'}</div>
                </td>
                <td className="px-3 py-2">{r.cutoff_date || '—'}</td>
                <td className="px-3 py-2">{r.cutoff_year ?? '—'}</td>
                <td className="px-3 py-2">{r.rows_affected ?? 0}</td>
                <td className="px-3 py-2">{r.dry_run ? 'true' : 'false'}</td>
                <td className="px-3 py-2 whitespace-pre-wrap">{r.notes || '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={7}>
                  Keine Einträge für {dateStr}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <div className="mt-3 text-sm text-gray-300">Laden…</div>}
    </div>
  );
}
