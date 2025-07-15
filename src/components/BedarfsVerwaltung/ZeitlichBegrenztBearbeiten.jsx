// components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { ChevronDown, ChevronRight, Info, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';

const ZeitlichBegrenztBearbeiten = ({ eintrag, refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [daten, setDaten] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    const ladeEintraege = async () => {
      if (!firma || !unit || !eintrag) return;

      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select(`id, anzahl, quali_id, farbe, DB_Qualifikationsmatrix(qualifikation, quali_kuerzel, betriebs_relevant)`)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', false)
        .eq('von', eintrag.von)
        .eq('bis', eintrag.bis)
        .eq('namebedarf', eintrag.namebedarf);

      if (error) {
        console.error('Fehler beim Laden der Einträge:', error.message);
      } else {
        setDaten(data);
      }
    };

    ladeEintraege();
  }, [firma, unit, eintrag, refreshKey]);

  const handleLöschen = async (id) => {
    const confirm = window.confirm('Soll dieser Eintrag gelöscht werden?');
    if (!confirm) return;
    await supabase.from('DB_Bedarf').delete().eq('id', id);
    setDaten((prev) => prev.filter((e) => e.id !== id));
  };

const [automatischEintrag, setAutomatischEintrag] = useState(null);

useEffect(() => {
  const ladeNaechstenEintrag = async () => {
    if (!firma || !unit || eintrag) return;

    const heute = dayjs().format('YYYY-MM-DD');
    const { data, error } = await supabase
      .from('DB_Bedarf')
      .select('von, bis, namebedarf, farbe')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .eq('normalbetrieb', false)
      .gte('von', heute)
      .order('von', { ascending: true })
      .limit(1);

    if (error) {
      console.error('❌ Fehler beim Vorauswählen:', error.message);
    } else if (data.length > 0) {
      setAutomatischEintrag(data[0]);
    }
  };

  ladeNaechstenEintrag();
}, [firma, unit, eintrag]);

const aktiverEintrag = eintrag || automatischEintrag;

if (!aktiverEintrag) {
  return <p className="text-sm text-gray-500 italic">Kein Eintrag ausgewählt.</p>;
}

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEingeklappt(!eingeklappt)}>
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
<h3 className="text-md font-semibold flex items-center gap-2">
  {aktiverEintrag.namebedarf} → {dayjs(aktiverEintrag.von).format('DD.MM.YYYY')} – {dayjs(aktiverEintrag.bis).format('DD.MM.YYYY')}
  <span
    className="inline-block w-20 h-3 rounded-full border border-gray-400"
    style={{ backgroundColor: aktiverEintrag.farbe || '#ccc' }}
  ></span>
</h3>

        </div>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        >
          <Info size={20} />
        </button>
      </div>

      {!eingeklappt && (
        <>
          {daten.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Keine Einträge vorhanden.</p>
          ) : (
            <ul className="text-sm space-y-2">
              {daten.map((e) => (
                <li
                  key={e.id}
                  className="bg-gray-100 dark:bg-gray-700 p-2 rounded flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{e.DB_Qualifikationsmatrix?.qualifikation || '–'}</div>
                    <div className="text-xs text-gray-500">{e.DB_Qualifikationsmatrix?.quali_kuerzel}</div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-semibold">{e.anzahl}</span>
                    <span className="text-xs text-gray-500">Personen</span>
                    <button
                      onClick={() => handleLöschen(e.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl animate-fade-in shadow max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Bearbeitung</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Hier siehst du alle Einträge zum gewählten Zeitraum und Namen.</li>
              <li>Du kannst einzelne Bedarfe löschen.</li>
              <li>Die Einträge stammen aus der Tabelle <b>DB_Bedarf</b>.</li>
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

export default ZeitlichBegrenztBearbeiten;