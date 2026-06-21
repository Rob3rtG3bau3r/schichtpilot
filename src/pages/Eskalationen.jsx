import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../supabaseClient';
import { useRollen } from '../context/RollenContext';
import { pruefeUndAktualisiereEskalationen } from '../utils/pruefeUndAktualisiereEskalationen';

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

const typLabel = (typ) =>
  TYP_LABELS[typ] || String(typ || '-').replaceAll('_', ' ');

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

const normalisiere = (wert) =>
  String(wert || '')
    .trim()
    .toLowerCase();

const sortValue = (row, key) => {
  if (key === 'datum') return row.datum || '';
  if (key === 'name') return normalisiere(row.name);
  if (key === 'typ') return normalisiere(typLabel(row.typ));
  if (key === 'status') return normalisiere(statusLabel(row.status));
  if (key === 'created_at') return row.created_at || '';
  if (key === 'firmaUnit') return `${row.firma_id || ''}-${row.unit_id || ''}`;
  return normalisiere(row[key]);
};

export default function Eskalationen() {
  const { rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const darfSehen = useMemo(
    () => ['Planner', 'Admin_Dev', 'SuperAdmin'].includes(rolle),
    [rolle]
  );
  const [erneutPruefenId, setErneutPruefenId] = useState(null);
  const [infoMeldung, setInfoMeldung] = useState('');
  const istSuperAdmin = rolle === 'SuperAdmin';

  const aktuellesJahr = dayjs().year();
  const heute = dayjs().format('YYYY-MM-DD');

  const [tab, setTab] = useState('zukunft'); // zukunft | vergangen | alle
  const [statusFilter, setStatusFilter] = useState('alle');

  const [jahrFilter, setJahrFilter] = useState(String(aktuellesJahr));
  const [von, setVon] = useState(`${aktuellesJahr}-01-01`);
  const [bis, setBis] = useState(`${aktuellesJahr}-12-31`);

  const [nameSuche, setNameSuche] = useState('');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pruefModal, setPruefModal] = useState(null);
  const [pruefKommentar, setPruefKommentar] = useState('');

  const [sortConfig, setSortConfig] = useState({
    key: 'datum',
    direction: 'asc',
  });

  const jahrOptionen = useMemo(() => {
    const jahre = [];

    for (let jahr = aktuellesJahr + 1; jahr >= aktuellesJahr - 6; jahr -= 1) {
      jahre.push(jahr);
    }

    return jahre;
  }, [aktuellesJahr]);

  const title =
    tab === 'zukunft'
      ? 'Handlungsbedarf – aktive Eskalationen'
      : tab === 'vergangen'
      ? 'Bereits passierte Eskalationen'
      : 'Alle Eskalationen';

  const handleJahrChange = (neuesJahr) => {
    setJahrFilter(neuesJahr);
    setVon(`${neuesJahr}-01-01`);
    setBis(`${neuesJahr}-12-31`);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'created_at' ? 'desc' : 'asc',
      };
    });
  };

  const sortIcon = (key) => {
    if (sortConfig.key !== key) return '↕';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const ladeEskalationen = async () => {
    if (!darfSehen) return;

    if (!istSuperAdmin && (!firma || !unit)) {
      setRows([]);
      setError('Keine Firma/Unit im RollenContext gefunden.');
      return;
    }

    if (!von || !bis) {
      setRows([]);
      setError('Bitte Von- und Bis-Datum auswählen.');
      return;
    }

    if (dayjs(von).isAfter(dayjs(bis))) {
      setRows([]);
      setError('Das Von-Datum darf nicht nach dem Bis-Datum liegen.');
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

      // Grundsätzlich immer manuelle Von/Bis-Eingrenzung berücksichtigen
      query = query
        .gte('datum', von)
        .lte('datum', bis);

      if (tab === 'zukunft') {
        query = query
          .in('status', ['offen', 'geprueft'])
          .gte('datum', heute);
      }

      if (tab === 'vergangen') {
        query = query
          .in('status', ['offen', 'geprueft'])
          .lt('datum', heute);
      }

      if (tab === 'alle') {
        if (statusFilter !== 'alle') {
          query = query.eq('status', statusFilter);
        }
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
          const name = `${u.nachname || ''}, ${u.vorname || ''}`.trim();

          userNameMap.set(
            String(u.user_id),
            name || `User ${u.user_id}`
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
  }, [tab, statusFilter, jahrFilter, von, bis, firma, unit, rolle]);

  const angezeigteRows = useMemo(() => {
    const suchText = normalisiere(nameSuche);

    let gefiltert = [...rows];

    if (suchText) {
      gefiltert = gefiltert.filter((row) =>
        normalisiere(row.name).includes(suchText)
      );
    }

    gefiltert.sort((a, b) => {
      const aValue = sortValue(a, sortConfig.key);
      const bValue = sortValue(b, sortConfig.key);

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }

      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }

      return 0;
    });

    return gefiltert;
  }, [rows, nameSuche, sortConfig]);

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

const erneutPruefen = async (e) => {
  if (!e?.id) return;

  setErneutPruefenId(e.id);
  setError('');
  setInfoMeldung('');

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const createdBy = sessionData?.session?.user?.id || null;

    await pruefeUndAktualisiereEskalationen({
      userId: e.user_id,
      firmaId: e.firma_id,
      unitId: e.unit_id,
      datum: e.datum,
      createdBy,
    });

    await ladeEskalationen();

    const { data: neu, error: neuErr } = await supabase
      .from('DB_Eskalation')
      .select('id, status, hinweis, resolved_reason')
      .eq('id', e.id)
      .maybeSingle();

    if (neuErr) throw neuErr;

    if (!neu || neu.status === 'automatisch_geloest') {
      setInfoMeldung('Erneut geprüft: Die Eskalation besteht nicht mehr und wurde automatisch gelöst.');
    } else {
      setInfoMeldung('Erneut geprüft: Die Eskalation besteht weiterhin.');
    }
  } catch (err) {
    console.error('Erneute Prüfung fehlgeschlagen:', err);
    setError(err.message || 'Erneute Prüfung konnte nicht durchgeführt werden.');
  } finally {
    setErneutPruefenId(null);
  }
};

  const SortHeader = ({ sortKey, children, className = '' }) => (
    <th className={`py-2 pr-4 ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-blue-500"
        title="Sortieren"
      >
        <span>{children}</span>
        <span className="text-[10px] opacity-70">{sortIcon(sortKey)}</span>
      </button>
    </th>
  );

  if (!darfSehen) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white p-6">
        <div className="rounded-2xl border border-red-400 bg-red-600/10 p-4">
          Kein Zugriff auf diese Seite.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* FILTER */}
        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-4 shadow">
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
              Handlungsbedarf
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
              Bereits vergangen
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
            <div>
              <label className="block text-xs opacity-70 mb-1">Jahr</label>
              <select
                value={jahrFilter}
                onChange={(e) => handleJahrChange(e.target.value)}
                className="w-full rounded-xl p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
              >
                {jahrOptionen.map((jahr) => (
                  <option key={jahr} value={String(jahr)}>
                    {jahr}
                  </option>
                ))}
              </select>
            </div>

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
              <label className="block text-xs opacity-70 mb-1">Mitarbeiter suchen</label>
              <input
                type="text"
                value={nameSuche}
                onChange={(e) => setNameSuche(e.target.value)}
                placeholder="Name eingeben..."
                className="w-full rounded-xl p-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
              />
            </div>

            {tab === 'alle' && (
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
            )}
          </div>

          <div className="text-xs opacity-60 mt-3">
            Beim Wechsel des Jahres wird automatisch 01.01. bis 31.12. gesetzt.
            Danach kannst du Von/Bis manuell weiter eingrenzen. Die Liste lädt automatisch neu.
          </div>
        </div>

        {/* TABELLE */}
        <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-4 shadow">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold">{title}</h2>

            <div className="flex flex-wrap gap-2 text-sm opacity-70">
              <span>{angezeigteRows.length} angezeigt</span>
              <span>von</span>
              <span>{rows.length} geladen</span>
            </div>
          </div>

        {infoMeldung && (
          <div className="mb-3 rounded-xl border border-blue-400 bg-blue-600/10 p-3 text-sm text-blue-700 dark:text-blue-200">
            {infoMeldung}
          </div>
        )}

          {loading ? (
            <div className="text-sm opacity-70">Lade Eskalationen…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-400 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : angezeigteRows.length === 0 ? (
            <div className="text-sm opacity-70">Keine Eskalationen gefunden.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left uppercase text-xs opacity-70 border-b border-gray-300 dark:border-gray-700 bg-gray-300 dark:bg-gray-700">
                    <SortHeader sortKey="datum">Datum</SortHeader>
                    <SortHeader sortKey="name">Mitarbeiter</SortHeader>
                    {istSuperAdmin && <SortHeader sortKey="firmaUnit">Firma/Unit</SortHeader>}
                    <SortHeader sortKey="typ">Typ</SortHeader>
                    <SortHeader sortKey="status">Status</SortHeader>
                    <th className="py-2 pr-4">Hinweis</th>
                    <SortHeader sortKey="created_at">Erstellt</SortHeader>
                    <th className="py-2 pr-4">Aktion</th>
                  </tr>
                </thead>

                <tbody>
                  {angezeigteRows.map((e) => (
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
  <div className="flex flex-wrap gap-1">
    {e.status === 'offen' && (
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
    )}

    {(e.status === 'offen' || e.status === 'geprueft') && (
      <button
        type="button"
        onClick={() => erneutPruefen(e)}
        disabled={erneutPruefenId === e.id}
        className="px-3 py-1 rounded-lg bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white text-xs"
      >
        {erneutPruefenId === e.id ? 'Prüfe…' : 'Erneut prüfen'}
      </button>
    )}

    {e.status === 'automatisch_geloest' && (
      <span className="text-xs opacity-60">-</span>
    )}
  </div>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
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