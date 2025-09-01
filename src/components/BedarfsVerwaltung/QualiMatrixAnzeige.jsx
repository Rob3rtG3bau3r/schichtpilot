// components/BedarfsVerwaltung/QualiMatrixAnzeige.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const QualiMatrixAnzeige = ({ onQualiClick }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [qualifikationen, setQualifikationen] = useState([]);
  const [infoOffen, setInfoOffen] = useState(false);

  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('*')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true); // nur aktive anzeigen

      if (error) {
        console.error('Fehler beim Laden der Qualifikationen:', error.message);
      } else {
        // erst mit Position, dann ohne
        const mitPosition = data.filter((q) => q.position !== null);
        const ohnePosition = data.filter((q) => q.position === null);
        mitPosition.sort((a, b) => a.position - b.position);
        setQualifikationen([...mitPosition, ...ohnePosition]);
      }
    };

    ladeQualifikationen();
  }, [firma, unit]);

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Überschrift + Info */}
      <div className="flex justify-between items-center mb-">
        <h2 className="text-lg font-semibold">Qualifikationen im Betrieb</h2>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
          title="Informationen zur Qualifikationsanzeige"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Liste */}
     <ul className="space-y-2 text-sm">
  {qualifikationen.map((quali) => (
<li
  key={quali.id}
  onClick={() => onQualiClick?.(quali.id, quali.qualifikation)}
  className="relative group bg-gray-200 dark:bg-gray-700 p-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition cursor-pointer"
>
  <div className="flex justify-between items-center">
    <div className="flex flex-col">
      <span className="font-medium">{quali.qualifikation}</span>
    </div>
    {quali.betriebs_relevant && (
      <div className="text-green-600 text-lg" title="betriebsrelevant">
        ✅
      </div>
    )}
  </div>
  {/* Tooltip bei Hover */}
  <div className="absolute z-10 hidden group-hover:block bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-100 p-2 rounded shadow-md w-64 top-full mt-1 left-1/2 -translate-x-1/2">
    <div>
      <span className="font-semibold">Kürzel: </span>
      <span className="text-gray-600 dark:text-gray-300">{quali.quali_kuerzel || '—'}</span>
    </div>
    <div className="font-semibold mb-1">Schwerpunkt</div>
    <div className="mb-2">{quali.schwerpunkt || '—'}</div>
    {quali.beschreibung && (
      <>
        <div className="font-semibold">Beschreibung</div>
        <div>{quali.beschreibung}</div>
      </>
    )}
  </div>
</li>
  ))}
  {qualifikationen.length === 0 && (
    <li className="text-gray-500 italic">Keine Qualifikationen eingetragen.</li>
  )}
</ul>
      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl animate-fade-in shadow max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Qualifikationsanzeige</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Nur aktive Qualifikationen werden angezeigt.</li>
              <li>Sortiert nach Position, Einträge ohne Position kommen danach.</li>
              <li>Haken ✅ zeigt, ob eine Qualifikation betrieblich relevant ist.</li>
              <li>Tooltip bei Hover zeigt Schwerpunkt und Beschreibung.</li>
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

export default QualiMatrixAnzeige;