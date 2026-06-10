import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const freqLabel = (row) => {
  if (!row?.freq || row.freq === 'once') {
    if (row.dtstart === row.until) return 'Einmalig';
    return 'Mehrere Tage';
  }

  if (row.freq === 'daily') {
    return `Alle ${row.interval || 1} Tag(e)`;
  }

  if (row.freq === 'weekly') {
    const tage = {
      0: 'So',
      1: 'Mo',
      2: 'Di',
      3: 'Mi',
      4: 'Do',
      5: 'Fr',
      6: 'Sa',
    };

    const ersterTag = Array.isArray(row.byweekday) ? row.byweekday[0] : null;

    return `Alle ${row.interval || 1} Woche(n)${
      ersterTag !== null ? ` · ${tage[ersterTag]}` : ''
    }`;
  }

  if (row.freq === 'monthly') {
    return `Alle ${row.interval || 1} Monat(e)`;
  }

  return row.freq;
};

const formatDatum = (datum) => {
  if (!datum) return '—';
  return dayjs(datum).format('DD.MM.YYYY');
};

const berechneDauerText = (row) => {
  if (!row?.dtstart || !row?.until) return '—';

  const start = dayjs(row.dtstart).startOf('day');
  const ende = dayjs(row.until).startOf('day');

  if (!start.isValid() || !ende.isValid()) return '—';
  if (ende.isBefore(start, 'day')) return '—';

  const tage = ende.diff(start, 'day') + 1;

  return `${tage} Tag${tage === 1 ? '' : 'e'}`;
};

const ZusatzbedarfListe = ({ refreshKey, onAuswahl }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [rows, setRows] = useState([]);
  const [schichtartMap, setSchichtartMap] = useState({});
  const [qualiMap, setQualiMap] = useState({});

  const [eingeklappt, setEingeklappt] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [zeitFilter, setZeitFilter] = useState('zukunft'); // zukunft | vergangen | alle
  const [aktivFilter, setAktivFilter] = useState('alle'); // alle | aktiv | inaktiv
  const [anfrageFilter, setAnfrageFilter] = useState('alle'); // alle | erlaubt | nicht_erlaubt

  useEffect(() => {
    const lade = async () => {
      if (!firma || !unit) return;

      setLoading(true);

      const { data, error } = await supabase
        .from('DB_Sonderbedarf')
        .select(`
          id,
          created_at,
          created_by,
          firma_id,
          unit_id,
          name,
          quali_id,
          schichtart_id,
          bedarf_delta,
          freq,
          interval,
          byweekday,
          dtstart,
          until,
          aktiv,
          farbe,
          beschreibung,
          hinweis,
          anfrage_erlaubt
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .order('dtstart', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Zusatzbedarfe:', error.message);
        setRows([]);
        setSchichtartMap({});
        setQualiMap({});
        setLoading(false);
        return;
      }

      const liste = data || [];
      setRows(liste);

      const schichtartIds = [
        ...new Set(liste.map((r) => r.schichtart_id).filter(Boolean)),
      ];

      const qualiIds = [
        ...new Set(liste.map((r) => r.quali_id).filter(Boolean)),
      ];

      if (schichtartIds.length > 0) {
        const { data: schichtarten, error: schichtErr } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, beschreibung')
          .in('id', schichtartIds);

        if (schichtErr) {
          console.error('Fehler beim Laden der Zusatzbedarf-Schichtarten:', schichtErr.message);
          setSchichtartMap({});
        } else {
          const map = {};

          (schichtarten || []).forEach((s) => {
            map[s.id] = s;
          });

          setSchichtartMap(map);
        }
      } else {
        setSchichtartMap({});
      }

      if (qualiIds.length > 0) {
        const { data: qualis, error: qualiErr } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, quali_kuerzel')
          .in('id', qualiIds);

        if (qualiErr) {
          console.error('Fehler beim Laden der Zusatzbedarf-Qualifikationen:', qualiErr.message);
          setQualiMap({});
        } else {
          const map = {};

          (qualis || []).forEach((q) => {
            map[q.id] = q;
          });

          setQualiMap(map);
        }
      } else {
        setQualiMap({});
      }

      setLoading(false);
    };

    lade();
  }, [firma, unit, refreshKey]);

  const sichtbareRows = useMemo(() => {
    const heute = dayjs().startOf('day');

    return (rows || [])
      .filter((r) => {
        const ende = r.until ? dayjs(r.until).startOf('day') : null;
        const start = r.dtstart ? dayjs(r.dtstart).startOf('day') : null;

        if (zeitFilter === 'alle') return true;

        if (zeitFilter === 'zukunft') {
          if (!ende) return true;
          return ende.isSame(heute, 'day') || ende.isAfter(heute, 'day');
        }

        if (zeitFilter === 'vergangen') {
          if (!ende && !start) return false;

          const vergleich = ende || start;
          return vergleich.isBefore(heute, 'day');
        }

        return true;
      })
      .filter((r) => {
        if (aktivFilter === 'alle') return true;
        if (aktivFilter === 'aktiv') return r.aktiv !== false;
        if (aktivFilter === 'inaktiv') return r.aktiv === false;

        return true;
      })
      .filter((r) => {
        if (anfrageFilter === 'alle') return true;
        if (anfrageFilter === 'erlaubt') return r.anfrage_erlaubt !== false;
        if (anfrageFilter === 'nicht_erlaubt') return r.anfrage_erlaubt === false;

        return true;
      })
      .sort((a, b) => {
        const da = dayjs(a.dtstart).valueOf();
        const db = dayjs(b.dtstart).valueOf();

        if (da !== db) return da - db;

        return (a.name || '').localeCompare(b.name || '', 'de');
      });
  }, [rows, zeitFilter, aktivFilter, anfrageFilter]);

  const filterInfoText = useMemo(() => {
    const teile = [];

    if (zeitFilter === 'zukunft') teile.push('Heute + Zukunft');
    if (zeitFilter === 'vergangen') teile.push('Vergangenheit');
    if (zeitFilter === 'alle') teile.push('Alle Zeiträume');

    if (aktivFilter === 'aktiv') teile.push('Aktiv');
    if (aktivFilter === 'inaktiv') teile.push('Inaktiv');
    if (aktivFilter === 'alle') teile.push('Aktiv + Inaktiv');

    if (anfrageFilter === 'erlaubt') teile.push('Anfrage möglich');
    if (anfrageFilter === 'nicht_erlaubt') teile.push('Anfrage nicht möglich');
    if (anfrageFilter === 'alle') teile.push('Alle Anfragearten');

    return teile.join(' · ');
  }, [zeitFilter, aktivFilter, anfrageFilter]);

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex justify-between items-start mb-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setEingeklappt((prev) => !prev)}
        >
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}

        <div className="flex items-center gap-2">
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
            Geplanter Zusatzbedarf
          </h3>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({sichtbareRows.length} Eintrag{sichtbareRows.length === 1 ? '' : 'e'})
          </span>
        </div>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen"
        >
          <Info size={20} />
        </button>
      </div>

      {!eingeklappt && (
        <>
          <div className="mb-4 space-y-2">
            <div>
              <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                Zeitraum
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setZeitFilter('zukunft')}
                  className={`px-2 py-1.5 rounded-lg text-xs border ${
                    zeitFilter === 'zukunft'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  Heute + Zukunft
                </button>

                <button
                  type="button"
                  onClick={() => setZeitFilter('vergangen')}
                  className={`px-2 py-1.5 rounded-lg text-xs border ${
                    zeitFilter === 'vergangen'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  Vergangenheit
                </button>

                <button
                  type="button"
                  onClick={() => setZeitFilter('alle')}
                  className={`px-2 py-1.5 rounded-lg text-xs border ${
                    zeitFilter === 'alle'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  Alle
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                  Aktivität
                </label>

                <select
                  value={aktivFilter}
                  onChange={(e) => setAktivFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
                >
                  <option value="alle">Alle</option>
                  <option value="aktiv">Aktiv</option>
                  <option value="inaktiv">Inaktiv</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300">
                  Anfrage
                </label>

                <select
                  value={anfrageFilter}
                  onChange={(e) => setAnfrageFilter(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200"
                >
                  <option value="alle">Alle</option>
                  <option value="erlaubt">Anfrage möglich</option>
                  <option value="nicht_erlaubt">Anfrage nicht möglich</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Zusatzbedarfe werden geladen…
            </div>
          ) : sichtbareRows.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              Keine Zusatzbedarfe für diesen Filter vorhanden.
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {sichtbareRows.map((row) => {
                const schichtart = schichtartMap[row.schichtart_id];
                const quali = qualiMap[row.quali_id];

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() =>
                      onAuswahl?.({
                        ...row,
                        schichtart,
                        quali,
                      })
                    }
                    className="w-full text-left rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg text-xs font-bold text-white"
                            style={{ backgroundColor: row.farbe || '#3b82f6' }}
                          >
                            {schichtart?.kuerzel || '—'}
                          </span>

                          <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                            {row.name || 'Ohne Bezeichnung'}
                          </div>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                            {formatDatum(row.dtstart)} – {formatDatum(row.until)}
                          </span>

                          <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                            Dauer: {berechneDauerText(row)}
                          </span>

                          <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                            {freqLabel(row)}
                          </span>

                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100 border border-blue-200 dark:border-blue-700">
                            {Number(row.bedarf_delta || 0)} Person(en)
                          </span>

                          {quali ? (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-700">
                              {quali.quali_kuerzel ? `${quali.quali_kuerzel} · ` : ''}
                              {quali.qualifikation}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
                              ohne Quali
                            </span>
                          )}
                        </div>

                        {(row.beschreibung || row.hinweis) && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {row.beschreibung || row.hinweis}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 text-xs shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full border ${
                            row.aktiv
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-green-300 dark:border-green-700'
                              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-300 dark:border-red-700'
                          }`}
                        >
                          {row.aktiv ? 'aktiv' : 'inaktiv'}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full border ${
                            row.anfrage_erlaubt !== false
                              ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700'
                          }`}
                        >
                          {row.anfrage_erlaubt !== false
                            ? 'Anfrage möglich'
                            : 'Anfrage nicht möglich'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {infoOffen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">
              Geplanter Zusatzbedarf
            </h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Hier siehst du alle gespeicherten Zusatzbedarfe dieser Unit.
              </p>

              <p>
                Die Liste zeigt echte einzelne Zusatzbedarf-Einträge. Wiederholungen werden
                beim Speichern bereits in einzelne Einträge aufgelöst.
              </p>

              <p>
                Über die Filter kannst du zwischen Zukunft, Vergangenheit, Aktivität und
                Anfrage-Möglichkeit unterscheiden.
              </p>

              <p>
                Zusatzbedarf ist bewusst von Früh, Spät und Nacht getrennt. Er wird im
                Mitarbeiterbedarf klein unterhalb der Nachtschicht angezeigt.
              </p>

              <p>
                Gezählt werden später die Personen, die nach Annahme in der Kampfliste mit
                dem passenden Zusatz-Kürzel eingetragen sind.
              </p>
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZusatzbedarfListe;