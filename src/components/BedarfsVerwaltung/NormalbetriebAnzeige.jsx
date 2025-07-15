import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

const NormalbetriebAnzeige = ({ refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [daten, setDaten] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    console.log('🔄 Lade neu mit refreshKey:', refreshKey);
    const ladeDaten = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select(`
          id,
          anzahl,
          quali_id,
          namebedarf,
          farbe,
          DB_Qualifikationsmatrix (
            qualifikation,
            quali_kuerzel,
            betriebs_relevant
          )
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', true);

      if (error) {
        console.error('Fehler beim Laden:', error.message);
      } else {
        setDaten(data);
      }
    };

    ladeDaten();
  }, [firma, unit, refreshKey]);

  const handleLöschen = async (id) => {
    const confirm = window.confirm('Soll diese Qualifikation aus dem Normalbedarf gelöscht werden?');
    if (!confirm) return;
    await supabase.from('DB_Bedarf').delete().eq('id', id);
    setDaten((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Header mit Icon + Einklapp-Toggle */}
      <div className="flex justify-between items-center mb-3">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => setEingeklappt(!eingeklappt)}
        >
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          <h3 className="text-md font-semibold">
  Normalbetrieb {' --> '}
  {daten
    .filter((e) => e.DB_Qualifikationsmatrix?.betriebs_relevant)
    .reduce((sum, e) => sum + (e.anzahl || 0), 0)}{' '}
    Personen
</h3>
{daten.length > 0 && (
  <span
    className="inline-block w-20 h-3 rounded-full mr-1"
    style={{ backgroundColor: daten[0].farbe || '#ccc' }}
  />
)}

        </div>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
          title="Informationen"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Inhalt nur wenn nicht eingeklappt */}
      {!eingeklappt && (
        <>
          {daten.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Keine Einträge im Normalbetrieb vorhanden.</p>
          ) : (
            <>
              {/* Betriebsrelevante */}
              <ul className="text-sm space-y-2 mb-4">
                {daten
                  .filter((e) => e.DB_Qualifikationsmatrix?.betriebs_relevant)
                  .map((eintrag) => (
                    <li
                      key={eintrag.id}
                      className="bg-gray-100 dark:bg-gray-700 p-2 rounded flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium">{eintrag.DB_Qualifikationsmatrix?.qualifikation || '–'}</div>
                        <div className="text-xs text-gray-500">{eintrag.DB_Qualifikationsmatrix?.quali_kuerzel}</div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="text-sm font-semibold">{eintrag.anzahl}</span>
                        <span className="text-xs text-gray-500">Personen</span>
                        <button
                          onClick={() => handleLöschen(eintrag.id)}
                          title="Löschen"
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
              </ul>

              {/* Gesamt-Personal-Zeile */}
              <div className="text-sm font-medium border-t pt-2 dark:border-gray-600">
                Gesamt Personal:{' '}
                {daten
                  .filter((e) => e.DB_Qualifikationsmatrix?.betriebs_relevant)
                  .reduce((sum, e) => sum + (e.anzahl || 0), 0)}{' '}
                Personen
              </div>

              {/* Nicht-relevante Qualis */}
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">Weitere Qualifikationen (nicht gezählt)</h4>
                <ul className="text-sm space-y-2">
                  {daten
                    .filter((e) => !e.DB_Qualifikationsmatrix?.betriebs_relevant)
                    .map((eintrag) => (
                      <li
                        key={eintrag.id}
                        className="bg-gray-50 dark:bg-gray-800 p-2 rounded flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{eintrag.DB_Qualifikationsmatrix?.qualifikation || '–'}</div>
                          <div className="text-xs text-gray-500">{eintrag.DB_Qualifikationsmatrix?.quali_kuerzel}</div>
                        </div>
                        <div className="text-right flex items-center gap-2">
  <span className="text-sm text-gray-500">{eintrag.anzahl} Personen</span>
  <button
    onClick={() => handleLöschen(eintrag.id)}
    title="Löschen"
    className="text-red-500 hover:text-red-700"
  >
    <Trash2 size={16} />
  </button>
</div>
                      </li>
                    ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow animate-fade-in max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Normalbetrieb-Anzeige</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Nur Bedarfe mit dem Typ <b>Normalbetrieb</b> werden hier angezeigt.</li>
              <li>Einträge sind getrennt nach <b>betriebsrelevant</b> und <i>nicht betriebsrelevant</i>.</li>
              <li>Die Gesamt-Personalzahl berechnet sich nur aus den relevanten Einträgen.</li>
              <li>Mit 🗑 kannst du einen Eintrag löschen – nach Bestätigung.</li>
              <li>Du kannst den Bereich über den Pfeil ↕️ einklappen.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                onClick={() => setInfoOffen(false)}
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

export default NormalbetriebAnzeige;
