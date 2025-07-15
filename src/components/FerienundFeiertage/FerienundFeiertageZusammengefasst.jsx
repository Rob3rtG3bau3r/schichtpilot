import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';

const FerienundFeiertageZusammengefasst = ({ onFilterChange, refresh }) => {
  const [daten, setDaten] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [gefiltertesJahr, setGefiltertesJahr] = useState('');
  const [gefiltertesBundesland, setGefiltertesBundesland] = useState('');

  useEffect(() => {
    const ladeDaten = async () => {
      const { data, error } = await supabase.from('DB_FeiertageundFerien').select('*');
      if (!error) setDaten(data);
    };
    ladeDaten();
  }, [refresh]);

  // Gruppenlogik: Jahr + Bundesland => Array von { jahr, bundesland, count }
  const gruppiert = daten.reduce((acc, eintrag) => {
    const key = `${eintrag.jahr}-${eintrag.bundesland}`;
    if (!acc[key]) {
      acc[key] = {
        jahr: eintrag.jahr,
        bundesland: eintrag.bundesland,
        count: 1,
      };
    } else {
      acc[key].count++;
    }
    return acc;
  }, {});

  let gruppiertArray = Object.values(gruppiert);

  if (gefiltertesJahr) {
    gruppiertArray = gruppiertArray.filter(e => e.jahr.toString() === gefiltertesJahr);
  }
  if (gefiltertesBundesland) {
    gruppiertArray = gruppiertArray.filter(e => e.bundesland === gefiltertesBundesland);
  }

  const alleJahre = [...new Set(daten.map(e => e.jahr))];
  const alleBundeslaender = [...new Set(daten.map(e => e.bundesland))];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow relative">
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          <select
            value={gefiltertesJahr}
            onChange={(e) => setGefiltertesJahr(e.target.value)}
            className="p-2 border rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
          >
            <option value="">Alle Jahre</option>
            {alleJahre.sort().map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>

          <select
            value={gefiltertesBundesland}
            onChange={(e) => setGefiltertesBundesland(e.target.value)}
            className="p-2 border rounded border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
          >
            <option value="">Alle Bundesländer</option>
            {alleBundeslaender.sort().map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setInfoOpen(true)}
          className="text-blue-500 hover:text-blue-700"
          title="Info anzeigen"
        >
          <Info size={20} />
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b dark:border-gray-700">
            <th className="py-1">Jahr</th>
            <th className="py-1">Bundesland</th>
            <th className="py-1">Anzahl Einträge</th>
          </tr>
        </thead>
        <tbody>
          {gruppiertArray.map((e, i) => (
            <tr key={i} className="border-b text-gray-800 dark:text-gray-200 dark:border-gray-700">
              <td className="py-1">{e.jahr}</td>
              <td className="py-1">{e.bundesland}</td>
              <td className="py-1">{e.count}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {infoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-lg text-sm relative">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-2">Informationen zur Zusammenfassung</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Einträge werden nach Jahr und Bundesland gruppiert.</li>
              <li>Die Anzahl zeigt, wie viele Feiertage oder Ferien pro Kombination existieren.</li>
              <li>Du kannst gezielt nach Jahr oder Bundesland filtern.</li>
              <li>Die Filter gelten nur für diese Übersicht, nicht für die Detailanzeige darunter.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FerienundFeiertageZusammengefasst;