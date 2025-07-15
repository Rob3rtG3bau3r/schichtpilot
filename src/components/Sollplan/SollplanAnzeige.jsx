import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';

const SollplanAnzeige = ({ schichtgruppe, firma, unit, refreshKey }) => {
  const [eintraege, setEintraege] = useState([]);
  const [schichtarten, setSchichtarten] = useState([]);
  const [ladeMehr, setLadeMehr] = useState(false);
  const [offset, setOffset] = useState(0);
  const tableRef = useRef(null);

  const formatDate = (isoDatum) => {
    const d = new Date(isoDatum);
    return d.toLocaleDateString('de-DE');
  };

  const ladeEintraege = async (startOffset = 0) => {
    if (!schichtgruppe || !firma || !unit) return;

    const { data, error } = await supabase
      .from('DB_SollPlan')
      .select('*')
      .eq('firma_id', firma)
      .eq('unit_id', unit)
      .eq('schichtgruppe', schichtgruppe)
      .order('datum', { ascending: false })
      .range(startOffset, startOffset + 365); // = max. 366 Einträge

    if (!error && data) {
      setEintraege((prev) => [...prev, ...data]);
      setOffset(startOffset + 366);
    }
  };

  useEffect(() => {
    setEintraege([]);
    setOffset(0);
    ladeEintraege(0);
  }, [schichtgruppe, firma, unit, refreshKey]);

  useEffect(() => {
    const fetchSchichtarten = async () => {
      const { data, error } = await supabase.from('DB_SchichtArt').select('*');
      if (!error) setSchichtarten(data);
    };

    fetchSchichtarten();
  }, []);

  const handleScroll = () => {
    const el = tableRef.current;
    if (!el || ladeMehr) return;

    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setLadeMehr(true);
      ladeEintraege(offset).then(() => setLadeMehr(false));
    }
  };

  const baseClasses = 'p-4 rounded-xl shadow-md w-full border';
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
      <h3 className={`text-lg mb-2 ${textClass}`}>Einträge für {schichtgruppe}</h3>

      {eintraege.length === 0 ? (
        <p className={hintClass}>Keine Soll-Einträge vorhanden.</p>
      ) : (
        <div
          ref={tableRef}
          onScroll={handleScroll}
          className="max-h-[calc(100vh-250px)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500 dark:scrollbar-thumb-gray-400"
        >
          <table className={`w-full text-sm ${textClass}`}>
            <thead>
              <tr className="text-left border-b border-gray-400 dark:border-gray-600">
                <th className="p-1">Datum</th>
                <th className="p-1">Kürzel</th>
                <th className="p-1">Start</th>
                <th className="p-1">Ende</th>
                <th className="p-1">Dauer</th>
              </tr>
            </thead>
            <tbody>
              {eintraege.map((e) => {
                const schichtart = schichtarten.find((sa) => sa.id === e.schichtart_id);
                return (
                  <tr key={e.id} className="hover:bg-gray-200 dark:hover:bg-gray-700">
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
      )}

      {ladeMehr && (
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
          Weitere Einträge werden geladen...
        </p>
      )}
    </div>
  );
};

export default SollplanAnzeige;