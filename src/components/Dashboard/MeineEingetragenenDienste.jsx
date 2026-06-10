import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/de';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

dayjs.locale('de');

const MeineEingetragenenDienste = () => {
  const { rolle, userId, sichtUnit: unit } = useRollen();

  const [offen, setOffen] = useState(true);
  const [vergangenheitAnzeigen, setVergangenheitAnzeigen] = useState(false);
  const [dienste, setDienste] = useState([]);
  const [schichtartenMap, setSchichtartenMap] = useState({});
  const [loading, setLoading] = useState(false);
  const autoEinklappenGeprueft = useRef(false);

  const darfSehen = ['Planner', 'Admin_Dev'].includes(rolle);

  useEffect(() => {
    const ladeDienste = async () => {
      if (!darfSehen || !userId || !unit) return;

      setLoading(true);

      try {
        const heute = dayjs().format('YYYY-MM-DD');

        let query = supabase
          .from('DB_Kampfliste')
          .select(
            'id, datum, user, ist_schicht, startzeit_ist, endzeit_ist, kommentar, schichtgruppe'
          )
          .eq('unit_id', unit)
          .eq('user', userId)
          .order('datum', { ascending: true });

        if (!vergangenheitAnzeigen) {
          query = query.gte('datum', heute);
        }

        const { data, error } = await query;
        if (error) throw error;

        setDienste(data || []);
        if (!vergangenheitAnzeigen && !autoEinklappenGeprueft.current) {
            setOffen((data || []).length > 0);
            autoEinklappenGeprueft.current = true;
}

        const schichtIds = [
          ...new Set(
            (data || [])
              .map((d) => d.ist_schicht)
              .filter((id) => id !== null && id !== undefined)
          ),
        ];

        if (schichtIds.length === 0) {
          setSchichtartenMap({});
          return;
        }

        const { data: schichtarten, error: schichtError } = await supabase
          .from('DB_SchichtArt')
          .select('id, kuerzel, beschreibung')
          .in('id', schichtIds);

        if (schichtError) throw schichtError;

        const map = {};
        (schichtarten || []).forEach((s) => {
          map[s.id] = s;
        });

        setSchichtartenMap(map);
      } catch (err) {
        console.error('Fehler beim Laden eigener eingetragener Dienste:', err?.message || err);
        setDienste([]);
      } finally {
        setLoading(false);
      }
    };

    ladeDienste();
  }, [darfSehen, userId, unit, vergangenheitAnzeigen]);

  if (!darfSehen) return null;

  return (
    <div className="rounded-xl shadow-xl py-4 px-1 border border-gray-300 dark:border-gray-700">
      {/* Überschrift */}
      <div className="flex justify-between items-center">
        <h3
          className="text-sm font-semibold cursor-pointer flex items-center gap-2"
          onClick={() => setOffen(!offen)}
        >
          {offen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          Meine eingetragenen Dienste
        </h3>

        <div className="flex items-center gap-3 pr-2">
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {dienste.length} Eintrag{dienste.length === 1 ? '' : 'e'}
          </span>
        </div>
      </div>

      {offen && (
        <div className="mt-2 space-y-3">
          {/* Filterzeile */}
          <div className="bg-gradient-to-r from-gray-100 to-gray-300 dark:from-gray-800 dark:to-gray-700 p-2 border border-gray-400 rounded-xl shadow-xl mb-2">
            <div className="flex justify-between items-center gap-3">
              <div>
                <p className="text-xs md:text-sm text-gray-900 dark:text-gray-100 font-semibold">
                  Eigene Dienste aus der Kampfliste
                </p>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={vergangenheitAnzeigen}
                  onChange={(e) => setVergangenheitAnzeigen(e.target.checked)}
                />
                Vergangenheit
              </label>
            </div>
          </div>

          {/* Inhalt */}
          <div className="bg-gray-200 dark:bg-gray-900/40 border border-gray-400 dark:border-gray-700 rounded-xl shadow-xl p-1">
            {loading && (
              <div className="text-sm text-gray-600 dark:text-gray-300 p-2">
                Dienste werden geladen...
              </div>
            )}

            {!loading && dienste.length === 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-300 p-2">
                Keine eingetragenen Dienste vorhanden.
              </div>
            )}

            {!loading && dienste.length > 0 && (
              <div className="space-y-2">
                {dienste.map((dienst) => {
                  const datum = dayjs(dienst.datum);
                  const schicht = schichtartenMap[dienst.ist_schicht];
                  const istVergangenheit = datum.isBefore(dayjs(), 'day');

                  return (
                    <div
                      key={dienst.id}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        istVergangenheit
                          ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="font-semibold">
                          {datum.format('dd., DD.MM.YYYY')}
                        </div>

                        <div className="font-bold text-blue-700 dark:text-blue-300">
                          {schicht?.kuerzel || '-'}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                        <span>
                          {dienst.startzeit_ist || '--:--'} bis {dienst.endzeit_ist || '--:--'}
                        </span>

                        {schicht?.beschreibung && (
                          <span>{schicht.beschreibung}</span>
                        )}

                        {dienst.schichtgruppe && (
                          <span>Gruppe: {dienst.schichtgruppe}</span>
                        )}
                      </div>

                      {dienst.kommentar && (
                        <div className="mt-1 text-xs italic text-gray-500 dark:text-gray-400">
                          {dienst.kommentar}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeineEingetragenenDienste;