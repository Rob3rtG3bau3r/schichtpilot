import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';

const STATUS_OPTIONS = [
  { value: 'alle', label: 'Alle' },
  { value: 'offen', label: 'Offen' },
  { value: 'automatisch_geloest', label: 'Automatisch gelöst' },
  { value: 'geprueft', label: 'Akzeptiert' },
];

const TYP_LABELS = {
  RUHEZEIT_UNTERSCHRITTEN: 'Ruhezeit unterschritten',
  ARBEITSZEIT_UEBER_10H: 'Arbeitszeit über 10 h',
  ARBEITSZEIT_UEBER_12H: 'Arbeitszeit über 12 h',
};

const typLabel = (typ) => TYP_LABELS[typ] || String(typ || '-').replaceAll('_', ' ');
const statusLabel = (status) => {
  if (status === 'offen') return 'Offen';
  if (status === 'automatisch_geloest') return 'Automatisch gelöst';
  if (status === 'geprueft') return 'Akzeptiert';
  return status || '-';
};
const statusStyle = (status) => {
  if (status === 'offen') return 'bg-red-600/20 text-red-200 border-red-400/40';
  if (status === 'automatisch_geloest') return 'bg-gray-600/20 text-gray-300 border-gray-400/40';
  if (status === 'geprueft') return 'bg-blue-600/20 text-blue-200 border-blue-400/40';
  return 'bg-gray-600/20 text-gray-200 border-gray-400/40';
};

export default function Eskalationen() {
  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const darfSehen = useMemo(
    () => ['Planner', 'Admin_Dev', 'SuperAdmin'].includes(rolle),
    [rolle]
  );

  const istSuperAdmin = rolle === 'SuperAdmin';

  const [tab, setTab] = useState('zukunft'); // zukunft | vergangen | alle
  const [statusFilter, setStatusFilter] = useState('alle');
  const [von, setVon] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
  const [bis, setBis] = useState(dayjs().add(30, 'day').format('YYYY-MM-DD'));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pruefModal, setPruefModal] = useState(null);
  const [pruefKommentar, setPruefKommentar] = useState('');

  const heute = dayjs().format('YYYY-MM-DD');

  const ladeEskalationen = async () => {
    if (!darfSehen) return;

    if (!istSuperAdmin && (!firma || !unit)) {
      setRows([]);
      setError('Keine Firma/Unit im RollenContext gefunden.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('DB_Eskalation')
        .select(`
          id,
          created_at,
          updated_at,
          firma_id,
          unit_id,
          user_id,
          datum,
          typ,
          status,
          hinweis,
          kommentar,
          ruhezeit_stunden,
          dauer_stunden,
          bezug_von_datum,
          bezug_bis_datum,
          resolved_at,
          resolved_reason
        `);

      // SuperAdmin autonom: keine Firma/Unit-Einschränkung
      if (!istSuperAdmin) {
        query = query
          .eq('firma_id', Number(firma))
          .eq('unit_id', Number(unit));
      }

      if (tab === 'zukunft') {
        query = query
          .eq('status', 'offen')
          .gte('datum', heute);
      }

      if (tab === 'vergangen') {
        query = query
          .eq('status', 'offen')
          .lt('datum', heute);
      }

      if (tab === 'alle') {
        if (von) query = query.gte('datum', von);
        if (bis) query = query.lte('datum', bis);
        if (statusFilter !== 'alle') query = query.eq('status', statusFilter);
      }

      query = query
        .order('datum', { ascending: tab !== 'vergangen' })
        .order('created_at', { ascending: false });

      const { data, error: eskErr } = await query;
      if (eskErr) throw eskErr;

      const eskRows = data || [];

      const userIds = Array.from(
        new Set(eskRows.map((r) => String(r.user_id)).filter(Boolean))
      );

      const userNameMap = new Map();

      if (userIds.length) {
        const { data: userRows, error: userErr } = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname')
          .in('user_id', userIds);

        if (userErr) throw userErr;

        (userRows || []).forEach((u) => {
          userNameMap.set(
            String(u.user_id),
            `${u.nachname || ''}, ${u.vorname || ''}`.trim()
          );
        });
      }

      setRows(
        eskRows.map((r) => ({
          ...r,
          name: userNameMap.get(String(r.user_id)) || `User ${r.user_id}`,
        }))
      );
    } catch (e) {
      console.error('Eskalationen laden fehlgeschlagen:', e);
      setError(e.message || 'Fehler beim Laden der Eskalationen.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladeEskalationen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter, von, bis, firma, unit, rolle]);

const updateStatusGeprueft = async () => {
  if (!pruefModal?.id) return;

  const kommentarClean = pruefKommentar.trim();

  if (!kommentarClean) {
    setError('Bitte einen Kommentar eintragen, warum die Eskalation geprüft/akzeptiert wurde.');
    return;
  }

    const { error: updErr } = await supabase
      .from('DB_Eskalation')
      .update({
        status: 'geprueft',
        kommentar: kommentarClean,
        updated_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        resolved_reason: 'Durch Planner geprüft und akzeptiert.',
      })
      .eq('id', pruefModal.id);

    if (updErr) {
      setError(updErr.message || 'Status konnte nicht geändert werden.');
      return;
    }

    setPruefModal(null);
    setPruefKommentar('');
    await ladeEskalationen();
  };

  if (!darfSehen) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white p-6">
        <div className="rounded-2xl border border-red-400 bg-red-600/10 p-4">
          Kein Zugriff auf diese Seite.
        </div>
      </div>
    );
  }

  const title =
    tab === 'zukunft'
      ? 'Offene Eskalationen – Zukunft'
      : tab === 'vergangen'
      ? 'Offene Eskalationen – Vergangenheit'
      : 'Alle Eskalationen';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-4 shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Eskalationen</h1>
            </div>

            <button
              type="button"
              onClick={ladeEskalationen}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              Aktualisieren
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3 shadow">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('zukunft')}
              className={`px-4 py-2 rounded-xl text-sm ${
                tab === 'zukunft'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Offen Zukunft
            </button>

            <button
              type="button"
              onClick={() => setTab('vergangen')}
              className={`px-4 py-2 rounded-xl text-sm ${
                tab === 'vergangen'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Offen Vergangenheit
            </button>

            <button
              type="button"
              onClick={() => setTab('alle')}
              className={`px-4 py-2 rounded-xl text-sm ${
                tab === 'alle'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              Alle Eskalationen
            </button>
          </div>

          {tab === 'alle' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div>
                <label className="block text-xs opacity-70 mb-1">Von</label>
                <input
                  type="date"
                  value={von}
                  onChange={(e) => setVon(e.target.value)}
                  className="w-full rounded-xl p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">Bis</label>
                <input
                  type="date"
                  value={bis}
                  onChange={(e) => setBis(e.target.value)}
                  className="w-full rounded-xl p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs opacity-70 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-4 shadow">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <span className="text-sm opacity-70">{rows.length} Einträge</span>
          </div>

          {loading ? (
            <div className="text-sm opacity-70">Lade Eskalationen…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-400 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm opacity-70">Keine Eskalationen gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left uppercase text-xs opacity-70 border-b border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-700">
                    <th className="py-2 pr-4">Datum</th>
                    <th className="py-2 pr-4">Mitarbeiter</th>
                    {istSuperAdmin && <th className="py-2 pr-4">Firma/Unit</th>}
                    <th className="py-2 pr-4">Typ</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Hinweis</th>
                    <th className="py-2 pr-4">Erstellt</th>
                    <th className="py-2 pr-4">Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-gray-200 dark:border-gray-700 align-top"
                    >
                      <td className="py-3 pr-4 whitespace-nowrap font-medium">
                        {dayjs(e.datum).format('DD.MM.YYYY')}
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap">
                        {e.name}
                      </td>

                      {istSuperAdmin && (
                        <td className="py-3 pr-4 whitespace-nowrap text-xs opacity-80">
                          F: {e.firma_id} / U: {e.unit_id}
                        </td>
                      )}

                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full bg-red-600/10 border border-red-400/30 text-red-700 dark:text-red-200 text-xs">
                          {typLabel(e.typ)}
                        </span>
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full border text-xs ${statusStyle(e.status)}`}>
                          {statusLabel(e.status)}
                        </span>
                      </td>

                      <td className="py-3 pr-4 min-w-[280px]">
                        <div>{e.hinweis || '-'}</div>
                        {e.kommentar && (
                          <div className="mt-1 text-xs opacity-70 italic">
                            Kommentar: {e.kommentar}
                          </div>
                        )}
                        {e.resolved_reason && (
                          <div className="mt-1 text-xs opacity-70">
                            Lösung: {e.resolved_reason}
                          </div>
                        )}
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap text-xs opacity-80">
                        {e.created_at ? dayjs(e.created_at).format('DD.MM.YYYY HH:mm') : '-'}
                      </td>

                      <td className="py-3 pr-4 whitespace-nowrap">
                        {e.status === 'offen' ? (
                          <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPruefModal(e);
                              setPruefKommentar(e.kommentar || '');
                              setError('');
                            }}
                            className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          >
                            Akzeptieren
                          </button>
                          </div>
                        ) : (
                          <span className="text-xs opacity-60">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {pruefModal && (
  <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4">
    <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 p-5 shadow-2xl">
      <h2 className="text-xl font-bold mb-2">Eskalation prüfen und akzeptieren</h2>

      <div className="text-sm opacity-80 mb-3">
        {dayjs(pruefModal.datum).format('DD.MM.YYYY')} • {pruefModal.name}
      </div>

      <div className="rounded-xl bg-red-600/10 border border-red-400/30 p-3 text-sm mb-4">
        {pruefModal.hinweis || '-'}
      </div>

      <label className="block text-sm font-semibold mb-1">
        Begründung / Entscheidung
      </label>

      <textarea
        value={pruefKommentar}
        onChange={(e) => setPruefKommentar(e.target.value)}
        rows={4}
        maxLength={300}
        className="w-full rounded-xl p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
        placeholder="Beispiel: Schicht musste wegen kurzfristigem Ausfall / Anlagenstörung so bleiben. Führungskraft wurde informiert."
      />

      <div className="text-xs opacity-60 mt-1">
        {pruefKommentar.length}/300 Zeichen
      </div>

      <div className="flex justify-end gap-3 mt-5">
        <button
          type="button"
          onClick={() => {
            setPruefModal(null);
            setPruefKommentar('');
          }}
          className="px-4 py-2 rounded-xl bg-gray-500 hover:bg-gray-600 text-white text-sm"
        >
          Abbrechen
        </button>

        <button
          type="button"
          onClick={updateStatusGeprueft}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm"
        >
          Akzeptieren speichern
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}