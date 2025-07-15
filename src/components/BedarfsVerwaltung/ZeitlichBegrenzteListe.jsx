// components/BedarfsVerwaltung/ZeitlichBegrenzteListe.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
dayjs.extend(isSameOrAfter); // ⬅️ Das hier nicht vergessen!
import { Info, ChevronDown, ChevronRight } from 'lucide-react';


const ZeitlichBegrenzteListe = ({ refreshKey, onAuswahl }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [daten, setDaten] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);
  const [zeigeVergangene, setZeigeVergangene] = useState(false);

  useEffect(() => {
    const ladeDaten = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select('id, von, bis, namebedarf, farbe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', false)
        .order('von', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der zeitlich begrenzten Daten:', error.message);
      } else {
        // Duplikate entfernen nach von|bis|namebedarf
        const unique = [];
        const map = new Map();
        for (const eintrag of data) {
          const key = `${eintrag.von}|${eintrag.bis}|${eintrag.namebedarf}`;
          if (!map.has(key)) {
            map.set(key, true);
            unique.push(eintrag);
          }
        }

        const heute = dayjs().startOf('day');
        const gefiltert = unique.filter((e) =>
          zeigeVergangene ? true : dayjs(e.bis).isSameOrAfter(heute)
        );

        setDaten(gefiltert);
      }
    };

    ladeDaten();
  }, [firma, unit, refreshKey, zeigeVergangene]);

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl relative">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEingeklappt(!eingeklappt)}>
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          <h3 className="text-md font-semibold">Zeitlich begrenzte Einträge</h3>
        </div>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
          title="Informationen"
        >
          <Info size={20} />
        </button>
      </div>

      {!eingeklappt && (
        <>
          {/* Checkbox */}
          <div className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              id="vergangene"
              checked={zeigeVergangene}
              onChange={(e) => setZeigeVergangene(e.target.checked)}
              className="accent-blue-600"
            />
            <label htmlFor="vergangene">Vergangene Einträge anzeigen</label>
          </div>

          {/* Liste */}
          {daten.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Keine zeitlich begrenzten Einträge vorhanden.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {daten.map((eintrag) => (
                <li
                  key={eintrag.id}
                  className="bg-gray-100 dark:bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                  onClick={() => onAuswahl?.(eintrag)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{eintrag.namebedarf}</div>
                      <div className="text-xs text-gray-500">
                        {dayjs(eintrag.von).format('DD.MM.YYYY')} – {dayjs(eintrag.bis).format('DD.MM.YYYY')}
                      </div>
                    </div>
                    <div
                      className="w-20 h-3 rounded-full border"
                      style={{ backgroundColor: eintrag.farbe || '#ccc' }}
                    ></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center backdrop-blur-sm justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow animate-fade-in max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Liste der zeitlich begrenzten Einträge</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Hier werden alle Einträge mit dem Typ <b>zeitlich begrenzt</b> angezeigt.</li>
              <li>Ein Eintrag ist definiert über den Zeitraum <b>von – bis</b> und eine Bezeichnung.</li>
              <li>Wenn mehrere Datensätze denselben Zeitraum und Namen haben, wird dieser nur einmal angezeigt.</li>
              <li>Standardmäßig werden nur zukünftige Einträge angezeigt.</li>
              <li>Mit der Checkbox kannst du vergangene Einträge einblenden.</li>
              <li>Ein Klick auf einen Eintrag öffnet ihn zur Bearbeitung im rechten Bereich.</li>
              <li>Die Farbmarkierung dient der späteren Orientierung im Cockpit.</li>
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

export default ZeitlichBegrenzteListe;
