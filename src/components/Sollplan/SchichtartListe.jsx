import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info, X } from 'lucide-react';

const SchichtartListe = ({ selectedFirma, selectedUnit, onSelect }) => {
  const [schichtarten, setSchichtarten] = useState([]);
  const [modalOffen, setModalOffen] = useState(false);

  useEffect(() => {
    const fetchSchichten = async () => {
      if (!selectedFirma || !selectedUnit) return;

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('*')
        .eq('sollplan_relevant', true)
        .eq('firma_id', selectedFirma)
        .eq('unit_id', selectedUnit);

      if (!error) setSchichtarten(data);
    };

    fetchSchichten();
  }, [selectedFirma, selectedUnit]);

  return (
    <>
      <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl shadow-md w-full border border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg text-black dark:text-white">Schichtarten</h3>
          <button onClick={() => setModalOffen(true)} title="Info">
            <Info size={20} className="text-blue-700 dark:text-text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-whiteblue-300 hover:text-blue-600" />
          </button>
        </div>

        <table className="w-full text-sm text-black dark:text-white">
          <thead>
            <tr className="text-left bg-gray-300 dark:bg-gray-700">
              <th className="p-1">Kürzel</th>
              <th className="p-1">Beginn</th>
              <th className="p-1">Ende</th>
              <th className="p-1">Dauer</th>
              <th className="p-1">Bezeichnung</th>
            </tr>
          </thead>
          <tbody>
            {schichtarten.map((schicht) => (
              <tr
                key={schicht.id}
                className="cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-700 border-b border-gray-300 dark:border-gray-700"
                onClick={() => onSelect(schicht)}
              >
                <td className="p-1">
                  <span
                    className="inline-flex items-center justify-center rounded font-bold text-sm"
                    style={{
                      backgroundColor: schicht.farbe_bg || '#ccc',
                      color: schicht.farbe_schrift || '#000',
                      width: '48px',
                      height: '28px',
                      minWidth: '48px',
                    }}
                  >
                    {schicht.kuerzel}
                  </span>
                </td>
                <td className="p-1">{schicht.startzeit}</td>
                <td className="p-1">{schicht.endzeit}</td>
                <td className="p-1">{schicht.dauer}</td>
                <td className="p-1">{schicht.beschreibung}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={() => setModalOffen(false)}
        >
<div
  className="relative bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg p-6 max-w-sm shadow-lg animate-fade-in "
  onClick={(e) => e.stopPropagation()}
>
              <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setModalOffen(false)}
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-2">Hinweis zur Schichtartenliste</h2>
            <ul className="list-disc list-inside text-sm mb-4">
            <li>Die Schichtarten werden automatisch geladen, sobald Firma und Unit gewählt wurden.</li>
             <li>Es werden nur Schichtarten angezeigt, die als <strong>„Soll-Schicht relevant“</strong> markiert sind.</li> 
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default SchichtartListe;
