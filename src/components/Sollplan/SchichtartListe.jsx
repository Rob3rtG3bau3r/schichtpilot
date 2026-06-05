import React from 'react';
import { Info } from 'lucide-react';

const SchichtartListe = ({ schichtarten = [] }) => {
  const handleDragStart = (e, schicht) => {
    e.dataTransfer.setData('application/json', JSON.stringify(schicht));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md w-full border border-gray-300 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg text-gray-900 dark:text-white">Schichtarten</h3>
        <Info size={18} className="text-blue-500" />
      </div>

      {schichtarten.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Wähle oben Firma und Unit.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {schichtarten.map((schicht) => (
            <button
              key={schicht.id}
              draggable
              onDragStart={(e) => handleDragStart(e, schicht)}
              title={`${schicht.beschreibung || schicht.kuerzel}
${schicht.startzeit || '-'} bis ${schicht.endzeit || '-'}
Dauer: ${schicht.dauer ?? '-'} h`}
              className="h-10 min-w-[52px] px-3 rounded-lg font-bold shadow-sm border border-gray-300 dark:border-gray-600 cursor-grab active:cursor-grabbing hover:scale-105 transition"
              style={{
                backgroundColor: schicht.farbe_bg || '#d1d5db',
                color: schicht.farbe_text || schicht.farbe_schrift || '#000',
              }}
            >
              {schicht.kuerzel}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Ziehe eine Schicht in den Rhythmus oder klicke im Rhythmus auf ein Feld.
      </div>
    </div>
  );
};

export default SchichtartListe;