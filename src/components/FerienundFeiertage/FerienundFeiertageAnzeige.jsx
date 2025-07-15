import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';

const FerienundFeiertageAnzeige = (refresh) => {
  const [eintraege, setEintraege] = useState([]);
  const [gefiltertesJahr, setGefiltertesJahr] = useState('');
  const [gefiltertesBundesland, setGefiltertesBundesland] = useState('');
  const [typFilter, setTypFilter] = useState('alle');
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    const ladeDaten = async () => {
      const { data, error } = await supabase.from('DB_FeiertageundFerien').select('*');
      if (!error) setEintraege(data);
    };
    ladeDaten();
  }, [refresh]);

  const gefiltert = eintraege
    .filter(e => !gefiltertesJahr || e.jahr.toString() === gefiltertesJahr)
    .filter(e => !gefiltertesBundesland || e.bundesland === gefiltertesBundesland)
    .filter(e => typFilter === 'alle' || e.typ === typFilter)
    .sort((a, b) => new Date(a.von) - new Date(b.von));

  const alleJahre = [...new Set(eintraege.map(e => e.jahr))];
  const alleBundeslaender = [...new Set(eintraege.map(e => e.bundesland))];

  const handleDelete = async (id) => {
    await supabase.from('DB_FeiertageundFerien').delete().eq('id', id);
    setEintraege(prev => prev.filter(e => e.id !== id));
  };

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

          <div className="flex gap-2">
            {['alle', 'Ferien', 'Feiertag'].map((typ) => (
              <button
                key={typ}
                onClick={() => setTypFilter(typ)}
                className={`px-3 py-1 rounded ${typFilter === typ ? 'bg-blue-500 text-white' : 'bg-gray-200 border border-gray-300 dark:border-gray-500 dark:bg-gray-600'}`}
              >
                {typ === 'alle' ? 'Alles anzeigen' : `Nur ${typ}`}
              </button>
            ))}
          </div>
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
            <th>Von</th>
            <th>Bis</th>
            <th>Name</th>
            <th>Farbe</th>
            <th>Code</th>
            <th>Typ</th>
            <th>Löschen</th>
          </tr>
        </thead>
        <tbody>
          {gefiltert.map(e => (
            <tr key={e.id} className="border-b dark:border-gray-700">
              <td>{dayjs(e.von).format('DD.MM.YYYY')}</td>
              <td>{e.bis ? dayjs(e.bis).format('DD.MM.YYYY') : '-'}</td>
              <td>{e.name}</td>
              <td><div className="w-6 h-6 rounded" style={{ backgroundColor: e.farbe }}></div></td>
              <td>{e.farbe}</td>
              <td>{e.typ}</td>
              <td>
                <button onClick={() => handleDelete(e.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={18} />
                </button>
              </td>
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
            <h2 className="text-lg font-bold mb-2">Informationen zur Anzeige</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Oben kannst du nach Jahr, Bundesland und Typ filtern.</li>
              <li>Einträge werden nach Datum sortiert (Januar bis Dezember).</li>
              <li>Du kannst Einträge gezielt löschen.</li>
              <li>Farben werden sowohl visuell als auch als Hexcode angezeigt.</li>
              <li>Die Typangabe zeigt an, ob es sich um Ferien oder einen Feiertag handelt.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FerienundFeiertageAnzeige;