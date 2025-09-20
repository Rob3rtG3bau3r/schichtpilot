// src/components/SystemTools/TestzugangTab.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function TestzugangTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const { data, error } = await supabase
        .from('db_testzugang') // Klein geschrieben
        .select('id, created_at, name, firma, funktion, mail')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setRows(data || []);
    } catch (e) {
      setErrorMsg(e.message || 'Unbekannter Fehler beim Laden der Testzugänge');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Testzugang – Einträge</h2>
        <button
          onClick={load}
          className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
          disabled={loading}
        >
          Aktualisieren
        </button>
      </div>

      {errorMsg && <div className="mb-3 text-red-400 text-sm">{errorMsg}</div>}

      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left">Erstellt</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Firma</th>
              <th className="px-3 py-2 text-left">Funktion</th>
              <th className="px-3 py-2 text-left">E-Mail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="odd:bg-gray-900 even:bg-gray-850">
                <td className="px-3 py-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                <td className="px-3 py-2">{r.name || '—'}</td>
                <td className="px-3 py-2">{r.firma || '—'}</td>
                <td className="px-3 py-2">{r.funktion || '—'}</td>
                <td className="px-3 py-2">{r.mail || '—'}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-400" colSpan={5}>
                  Keine Einträge vorhanden.
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
