// src/components/SystemTools/SystemAbrechnungTab.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { RotateCw, Plus } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import RechnungEditor from './RechnungEditor';

const fmtDate = (d) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

const Panel = ({ title, right, children }) => (
  <div className="rounded-2xl border border-gray-600/40 bg-gray-900 text-white mb-3">
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/60">
      <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-200">
        {title}
      </h2>
      <div className="flex items-center gap-2 text-xs">{right}</div>
    </div>
    <div className="px-3 py-3">
      {children}
    </div>
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    entwurf: 'bg-gray-600 text-gray-50',
    offen: 'bg-yellow-500/80 text-black',
    bezahlt: 'bg-green-600/90 text-white',
    storniert: 'bg-red-700/80 text-white',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] ${map[status] || 'bg-gray-700 text-gray-100'}`}>
      {status || '—'}
    </span>
  );
};

export default function SystemAbrechnungTab() {
  const [loading, setLoading] = useState(false);
  const [rechnungen, setRechnungen] = useState([]);
  const [firmenMap, setFirmenMap] = useState({});
  const [firmenList, setFirmenList] = useState([]);

  const [statusFilter, setStatusFilter] = useState('alle');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState(null);

  // für "Neue Rechnung"
  const [newFirmaId, setNewFirmaId] = useState('');
  const [creating, setCreating] = useState(false); // rein optisch

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: reRows, error: reErr }, { data: kundenRows, error: kuErr }] =
        await Promise.all([
          supabase.from('DB_Rechnung')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase.from('DB_Kunden')
            .select('id,firmenname')
            .order('firmenname', { ascending: true }),
        ]);

      if (reErr) throw reErr;
      if (kuErr) throw kuErr;

      const map = {};
      (kundenRows || []).forEach((k) => { map[k.id] = k.firmenname; });

      setFirmenMap(map);
      setFirmenList(kundenRows || []);
      setRechnungen(reRows || []);

      // ausgewählte Rechnung auffrischen, falls sie existiert
      if (selected && selected.id != null) {
        const fresh = (reRows || []).find((r) => r.id === selected.id);
        setSelected(fresh || null);
      }
    } catch (e) {
      console.error('Fehler beim Laden der Rechnungen:', e);
      alert('Konnte Rechnungen nicht laden. Details in der Konsole.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const viewRows = useMemo(() => {
    let rows = [...rechnungen];

    if (statusFilter !== 'alle') {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        (r.rechnungsnummer || '').toLowerCase().includes(q) ||
        (firmenMap[r.firma_id] || '').toLowerCase().includes(q)
      );
    }

    return rows;
  }, [rechnungen, statusFilter, search, firmenMap]);

  const handleSelect = (r) => {
    setSelected(r);
  };

  // 🔹 NEU: Nur lokalen Entwurf erstellen, noch kein DB-Insert
  const handleCreateDraft = () => {
    if (!newFirmaId) {
      alert('Bitte zuerst eine Firma für die neue Rechnung auswählen.');
      return;
    }
    setCreating(true);

    const today = dayjs();
    const draft = {
      id: null,                        // wichtig: kennzeichnet "neu"
      firma_id: Number(newFirmaId),
      status: 'entwurf',
      rechnungsnummer: '',
      periode_von: today.startOf('month').format('YYYY-MM-DD'),
      periode_bis: today.endOf('month').format('YYYY-MM-DD'),
      faellig_am: today.add(14, 'day').format('YYYY-MM-DD'),
      betrag_netto: 0,
      betrag_brutto: 0,
      created_at: null,
    };

    setSelected(draft);
    setCreating(false);
  };

  // 🔹 Wird nach Speichern im Editor aufgerufen
  const handleSaved = async (savedRow) => {
    if (!savedRow) {
      // z.B. bei "Abbrechen" → einfach neu laden/aufräumen
      setSelected(null);
      return;
    }
    setSelected(savedRow);
    await loadData();
  };

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Linke Seite: Liste der Rechnungen */}
      <div className="col-span-12 lg:col-span-5">
        <Panel
          title="Rechnungen (Kopf)"
          right={
            <div className="flex items-center gap-2">
              {/* Firma für neue Rechnung wählen */}
              <select
                className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-xs"
                value={newFirmaId}
                onChange={(e) => setNewFirmaId(e.target.value)}
              >
                <option value="">Firma wählen…</option>
                {firmenList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.firmenname}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateDraft}
                disabled={!newFirmaId || creating}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-xs hover:bg-gray-700 disabled:opacity-50"
              >
                <Plus size={14} />
                Neue Rechnung
              </button>
              <button
                onClick={loadData}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-600 text-xs hover:bg-gray-700"
              >
                <RotateCw size={14} />
                Aktualisieren
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap gap-2 mb-3 text-xs">
            <input
              type="text"
              placeholder="Suche nach Nummer oder Firma…"
              className="px-2 py-1 rounded bg-gray-800 border border-gray-700 text-sm flex-1 min-w-[140px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="px-2 py-1 rounded bg-gray-800 border border-gray-700"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="alle">alle Status</option>
              <option value="entwurf">Entwürfe</option>
              <option value="offen">Offen</option>
              <option value="bezahlt">Bezahlt</option>
              <option value="storniert">Storniert</option>
            </select>
          </div>

          {loading ? (
            <div className="text-sm text-gray-300">Lade Rechnungen…</div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="min-w-full text-xs">
                <thead className="text-[11px] uppercase text-gray-400 border-b border-gray-700/60">
                  <tr>
                    <th className="py-1 pr-3 text-left">Nr.</th>
                    <th className="py-1 pr-3 text-left">Firma</th>
                    <th className="py-1 pr-3 text-left">Erstellt</th>
                    <th className="py-1 pr-3 text-left">Brutto</th>
                    <th className="py-1 pr-3 text-left">Fällig</th>
                    <th className="py-1 pr-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {viewRows.map((r) => {
                    const isActive = selected && selected.id === r.id;
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-gray-800/70 cursor-pointer hover:bg-gray-800 ${
                          isActive ? 'bg-gray-800' : ''
                        }`}
                        onClick={() => handleSelect(r)}
                      >
                        <td className="py-1 pr-3">
                          {r.rechnungsnummer || `#${r.id}`}
                        </td>
                        <td className="py-1 pr-3">
                          {firmenMap[r.firma_id] || `Firma #${r.firma_id}`}
                        </td>
                        <td className="py-1 pr-3">
                          {fmtDate(r.created_at)}
                        </td>
                        <td className="py-1 pr-3">
                          {r.betrag_brutto != null ? `${r.betrag_brutto} €` : '—'}
                        </td>
                        <td className="py-1 pr-3">
                          {fmtDate(r.faellig_am)}
                        </td>
                        <td className="py-1 pr-3">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    );
                  })}
                  {viewRows.length === 0 && !loading && (
                    <tr>
                      <td className="py-2 text-gray-400" colSpan={6}>
                        Noch keine Rechnungen vorhanden.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Rechte Seite: Detail / Editor */}
      <div className="col-span-12 lg:col-span-7">
        <RechnungEditor
          rechnung={selected}
          firmenMap={firmenMap}
          onSaved={handleSaved}
          onCancel={() => setSelected(null)}
        />
      </div>
    </div>
  );
}
