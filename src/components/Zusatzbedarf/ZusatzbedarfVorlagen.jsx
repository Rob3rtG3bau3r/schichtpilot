import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const ZusatzbedarfVorlagen = ({ refreshKey, onVorlageWaehlen }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [rows, setRows] = useState([]);
  const [schichtartMap, setSchichtartMap] = useState({});
  const [qualiMap, setQualiMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    const lade = async () => {
      if (!firma || !unit) return;

      setLoading(true);

  const { data, error } = await supabase
    .from('DB_SonderbedarfVorlage')
    .select(`
      id,
      created_at,
      created_by,
      firma_id,
      unit_id,
      vorlage_name,
      name,
      quali_id,
      schichtart_id,
      bedarf_delta,
      aktiv,
      farbe,
      beschreibung,
      hinweis,
      anfrage_erlaubt,
      position
    `)
    .eq('firma_id', firma)
    .eq('unit_id', unit)
    .eq('aktiv', true)
    .order('position', { ascending: true })
    .order('vorlage_name', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Zusatzbedarf-Vorlagen:', error.message);
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
          console.error('Fehler beim Laden der Vorlage-Schichtarten:', schichtErr.message);
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
          console.error('Fehler beim Laden der Vorlage-Qualifikationen:', qualiErr.message);
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

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
            Vorlagen
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Wiederkehrende Zusatzbedarfe.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zu Vorlagen"
        >
          <Info size={20} />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Vorlagen werden geladen…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
          Noch keine Vorlagen gespeichert.
        </div>
      ) : (
        <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
          {rows.map((row) => {
            const schichtart = schichtartMap[row.schichtart_id];
            const quali = qualiMap[row.quali_id];

            return (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  onVorlageWaehlen?.({
                    ...row,
                    schichtart,
                    quali,
                  })
                }
                className="w-full text-left rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition p-3"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="inline-flex items-center justify-center min-w-10 px-2 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: row.farbe || '#3b82f6' }}
                  >
                    {schichtart?.kuerzel || '—'}
                  </span>

                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {row.vorlage_name || row.name || 'Ohne Vorlagenname'}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {Number(row.bedarf_delta || 0)} Person(en)
                      {quali
                        ? ` · ${quali.quali_kuerzel ? `${quali.quali_kuerzel} ` : ''}${quali.qualifikation}`
                        : ' · ohne Quali'}
                    </div>

                    {row.name && row.name !== row.vorlage_name && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        {row.name}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
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
            <h3 className="text-lg font-semibold mb-3">Vorlagen</h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Vorlagen dienen als schneller Startpunkt für wiederkehrende Zusatzbedarfe.
              </p>
              <p>
                Beim Anklicken wird die Vorlage ins Formular geladen. Gespeichert wird erst,
                wenn du im Formular auf „Zusatzbedarf speichern“ klickst.
              </p>
              <p>
                Eine Vorlage selbst erzeugt noch keinen aktiven Zusatzbedarf im Mitarbeiterbedarf.
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

export default ZusatzbedarfVorlagen;