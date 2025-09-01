import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Info, X } from 'lucide-react';
import dayjs from 'dayjs';

const SollplanAnzeige = ({ schichtgruppe, firma, unit, refreshKey }) => {
  const [eintraege, setEintraege] = useState([]);
  const [schichtarten, setSchichtarten] = useState([]);
  const [ladeMehr, setLadeMehr] = useState(false);
  const [currentYear, setCurrentYear] = useState(null);
  const [minYearLoaded, setMinYearLoaded] = useState(null); // ältestes geladenes Jahr
  const [infoOffen, setInfoOffen] = useState(false);
  const tableRef = useRef(null);

  const formatDate = (isoDatum) => {
    const d = new Date(isoDatum);
    return d.toLocaleDateString('de-DE');
  };

  // --- Lädt Einträge eines Jahres ---
  const ladeJahr = async (jahr) => {
    if (!schichtgruppe || !firma || !unit || !jahr) return [];

    const start = `${jahr}-01-01`;
    const ende = `${jahr}-12-31`;

    const { data, error } = await supabase
      .from('DB_SollPlan')
      .select('*')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .eq('schichtgruppe', schichtgruppe)
      .gte('datum', start)
      .lte('datum', ende)
      .order('datum', { ascending: false });

    if (!error && data) {
      return data;
    }
    return [];
  };

  // --- Ermittelt das neueste Jahr ---
  const ermittleNeuesteJahr = async () => {
    const { data, error } = await supabase
      .from('DB_SollPlan')
      .select('datum')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .eq('schichtgruppe', schichtgruppe)
      .order('datum', { ascending: false })
      .limit(1);

    if (!error && data.length > 0) {
      return new Date(data[0].datum).getFullYear();
    }
    return null;
  };

  // --- Initial: Nur neuestes Jahr laden ---
  useEffect(() => {
    const init = async () => {
      setEintraege([]);
      const jahr = await ermittleNeuesteJahr();
      if (jahr) {
        const daten = await ladeJahr(jahr);
        setEintraege(daten);
        setCurrentYear(jahr);
        setMinYearLoaded(jahr);
      }
    };
    init();
  }, [schichtgruppe, firma, unit, refreshKey]);

  // --- Schichtarten laden ---
  useEffect(() => {
    const fetchSchichtarten = async () => {
      const { data, error } = await supabase.from('DB_SchichtArt').select('*');
      if (!error) setSchichtarten(data);
    };
    fetchSchichtarten();
  }, []);

  // --- Scroll: Älteres Jahr nachladen ---
  const handleScroll = () => {
    const el = tableRef.current;
    if (!el || ladeMehr) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      const nextYear = minYearLoaded - 1;
      if (nextYear >= 2000) {
        setLadeMehr(true);
        ladeJahr(nextYear).then((neueDaten) => {
          if (neueDaten.length > 0) {
            setEintraege((prev) => [...prev, ...neueDaten]);
            setMinYearLoaded(nextYear);
          }
          setLadeMehr(false);
        });
      }
    }
  };

  // --- Gruppiert Einträge nach Jahren ---
  const gruppiertNachJahr = () => {
    const gruppiert = {};
    eintraege.forEach((e) => {
      const jahr = new Date(e.datum).getFullYear();
      if (!gruppiert[jahr]) gruppiert[jahr] = [];
      gruppiert[jahr].push(e);
    });

    // Sortiert nach Jahr absteigend
    return Object.keys(gruppiert)
      .sort((a, b) => b - a)
      .map((jahr) => ({
        jahr,
        eintraege: gruppiert[jahr].sort(
          (a, b) => new Date(b.datum) - new Date(a.datum)
        ),
      }));
  };

  const baseClasses = 'p-4 rounded-xl shadow-md w-full border relative';
  const bgClass = 'bg-white dark:bg-gray-800';
  const textClass = 'text-gray-900 dark:text-white';
  const borderClass = 'border-gray-300 dark:border-gray-700';
  const hintClass = 'text-sm text-gray-600 dark:text-gray-400';

  if (!schichtgruppe || !firma || !unit) {
    return (
      <div className={`${baseClasses} ${bgClass} ${borderClass}`}>
        <h3 className={`text-lg mb-2 ${textClass}`}>Soll Schicht</h3>
        <p className={hintClass}>Wähle eine Schichtgruppe, Firma und Unit aus.</p>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${bgClass} ${borderClass}`}>
      {/* Info-Button */}
      <button
        onClick={() => setInfoOffen(true)}
        className="absolute top-3 right-3 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Info Modal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-xl w-[90%] max-w-xl relative animate-fade-in">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setInfoOffen(false)}
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4">Informationen zur Sollplan-Anzeige</h3>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li>Beim Laden wird nur das letzte verfügbare Jahr angezeigt.</li>
              <li>Beim Scrollen werden automatisch ältere Jahre nachgeladen.</li>
              <li>Die Tabelle ist nach Jahren gruppiert.</li>
              <li>Die Einträge sind nach Datum sortiert (neueste oben).</li>
              <li>Die Kürzelfarben stammen aus den definierten Schichtarten.</li>
            </ul>
          </div>
        </div>
      )}

      <h3 className={`text-lg mb-2 ${textClass}`}>Einträge für {schichtgruppe}</h3>

      {eintraege.length === 0 ? (
        <p className={hintClass}>Keine Soll-Einträge vorhanden.</p>
      ) : (
        <div
          ref={tableRef}
          onScroll={handleScroll}
          className="max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 dark:scrollbar-thumb-gray-400"
        >
          {gruppiertNachJahr().map((jahrBlock) => (
            <div key={jahrBlock.jahr}>
              <div className="sticky top-0 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-bold py-1 z-10 border-b border-gray-900">
                {jahrBlock.jahr}
              </div>
              <table className={`w-full text-sm ${textClass}`}>
                <thead>
                  <tr className="text-left border-b border-gray-400 dark:border-gray-600 bg-gray-300 dark:bg-gray-700">
                    <th className="p-1">Datum</th>
                    <th className="p-1">Kürzel</th>
                    <th className="p-1">Start</th>
                    <th className="p-1">Ende</th>
                    <th className="p-1">Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {jahrBlock.eintraege.map((e) => {
                    const schichtart = schichtarten.find((sa) => sa.id === e.schichtart_id);
                    return (
                      <tr key={e.id} className="hover:bg-gray-200 dark:hover:bg-gray-700 border-b border-gray-300 dark:border-gray-700">
                        <td className="p-1">{formatDate(e.datum)}</td>
                        <td className="p-1">
                          <span
                            className="inline-flex items-center justify-center rounded font-bold text-sm"
                            style={{
                              backgroundColor: schichtart?.farbe_bg || '#ccc',
                              color: schichtart?.farbe_text || '#000',
                              width: '48px',
                              height: '24px',
                              minWidth: '48px',
                            }}
                          >
                            {schichtart?.kuerzel || '–'}
                          </span>
                        </td>
                        <td className="p-1">{e.startzeit || '-'}</td>
                        <td className="p-1">{e.endzeit || '-'}</td>
                        <td className="p-1">{e.dauer} h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {ladeMehr && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          Lade weitere Jahre...
        </p>
      )}
    </div>
  );
};

export default SollplanAnzeige;
