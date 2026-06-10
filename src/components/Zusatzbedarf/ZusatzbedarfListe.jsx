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
    return `Alle ${row.interval || 1} Woche(n)${ersterTag !== null ? ` · ${tage[ersterTag]}` : ''}`;
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

const ZusatzbedarfListe = ({ refreshKey, onAuswahl }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [rows, setRows] = useState([]);
  const [schichtartMap, setSchichtartMap] = useState({});
  const [qualiMap, setQualiMap] = useState({});
  const [eingeklappt, setEingeklappt] = useState(false);
  const [zeigeVergangene, setZeigeVergangene] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  const [loading, setLoading] = useState(false);

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
        if (zeigeVergangene) return true;
        if (!r.until) return true;
        return dayjs(r.until).isSame(heute, 'day') || dayjs(r.until).isAfter(heute, 'day');
      })
      .sort((a, b) => {
        const da = dayjs(a.dtstart).valueOf();
        const db = dayjs(b.dtstart).valueOf();
        if (da !== db) return da - db;
        return (a.name || '').localeCompare(b.name || '', 'de');
      });
  }, [rows, zeigeVergangene]);

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex justify-between items-start mb-4">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setEingeklappt((prev) => !prev)}
        >
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          <div>
            <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
              Geplanter Zusatzbedarf
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Aktive und zukünftige Einträge.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={zeigeVergangene}
              onChange={(e) => setZeigeVergangene(e.target.checked)}
              className="accent-blue-600"
            />
            Vergangene
          </label>

          <button
            type="button"
            onClick={() => setInfoOffen(true)}
            className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
            title="Informationen"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {!eingeklappt && (
        <>
          {loading ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Zusatzbedarfe werden geladen…
            </div>
          ) : sichtbareRows.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              Keine Zusatzbedarfe vorhanden.
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

                      <div className="flex flex-col items-end gap-1 text-xs">
                        <span
                          className={`px-2 py-0.5 rounded-full border ${
                            row.aktiv
                              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200 border-green-300 dark:border-green-700'
                              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-200 border-red-300 dark:border-red-700'
                          }`}
                        >
                          {row.aktiv ? 'aktiv' : 'inaktiv'}
                        </span>

                        {row.anfrage_erlaubt && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                            Anfrage möglich
                          </span>
                        )}
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
            <h3 className="text-lg font-semibold mb-3">Geplanter Zusatzbedarf</h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Hier siehst du alle gespeicherten Zusatzbedarfe dieser Unit.
              </p>
              <p>
                Zusatzbedarf ist bewusst von Früh, Spät und Nacht getrennt. Er wird später
                im Mitarbeiterbedarf klein unterhalb der Nachtschicht angezeigt.
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