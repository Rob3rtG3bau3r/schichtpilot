// src/components/SystemTools/LoginTab.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const PAGE_SIZE = 20;

export default function LoginTab() {
  const [logs, setLogs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async (reset = false) => {
    try {
      setLoading(true);
      setErrorMsg('');

      const rangeStart = reset ? 0 : offset;
      const rangeEnd = rangeStart + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('DB_LoginLog') // Groß-/Kleinschreibung beachten
        .select('id, login_time, user_id, user_agent')
        .order('login_time', { ascending: false })
        .range(rangeStart, rangeEnd);

      if (error) throw error;

      const newData = reset ? data : [...logs, ...data];
      setLogs(newData);
      setOffset(rangeEnd + 1);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      setErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Login-Logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Login-Logs (je 20)</h2>
        <div className="flex gap-2">
          <button
            onClick={() => load(true)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
            disabled={loading}
          >
            Aktualisieren
          </button>
          <button
            onClick={() => load(false)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
            disabled={loading || !hasMore}
          >
            Mehr laden
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-3 text-red-400 text-sm">{errorMsg}</div>
      )}

      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Zeit</th>
              <th className="px-3 py-2 text-left">User ID</th>
              <th className="px-3 py-2 text-left">User-Agent</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row) => (
              <tr key={row.id} className="odd:bg-gray-900 even:bg-gray-850">
                <td className="px-3 py-2 whitespace-nowrap">
                  {row.login_time ? new Date(row.login_time).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{row.user_id || '—'}</td>
                <td className="px-3 py-2">{row.user_agent || '—'}</td>
              </tr>
            ))}
            {!loading && logs.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={3}>
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className="mt-3 text-sm text-gray-300">Laden…</div>
      )}
      {!loading && hasMore && logs.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => load(false)}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            Weitere 20 laden
          </button>
        </div>
      )}
    </div>
  );
}
