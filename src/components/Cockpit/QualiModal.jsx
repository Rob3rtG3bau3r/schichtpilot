import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

const QualiModal = ({ offen, onClose, userId, userName }) => {
  const [qualis, setQualis] = useState([]);

  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!userId) return;

      // 1. Hole alle Qualifikationszuweisungen des Users
      const { data: zuweisungen, error: errorZuweisung } = await supabase
        .from('DB_Qualifikation')
        .select('quali')
        .eq('user_id', userId);

      if (errorZuweisung) {
        console.error('❌ Fehler beim Laden der User-Qualifikationen:', errorZuweisung);
        return;
      }

      const qualiIds = zuweisungen.map((q) => q.quali);

      if (qualiIds.length === 0) {
        setQualis([]);
        return;
      }

      // 2. Hole die Qualifikationsdetails aus der Matrix
      const { data: qualifikationen, error: errorMatrix } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation, beschreibung, position')
        .in('id', qualiIds);

      if (errorMatrix) {
        console.error('❌ Fehler beim Laden der Qualifikationsdetails:', errorMatrix);
        return;
      }

      // 3. Sortieren nach Position (null ans Ende)
      const sortiert = qualifikationen.sort((a, b) => {
        if (a.position == null) return 1;
        if (b.position == null) return -1;
        return a.position - b.position;
      });

      setQualis(sortiert);
    };

    if (offen) ladeQualifikationen();
  }, [offen, userId]);

  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-lg max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">
          Qualifikationen von {userName}
        </h2>

        {qualis.length === 0 ? (
          <p className="text-sm italic text-gray-500">
            Keine Qualifikationen vorhanden
          </p>
        ) : (
          <ul className="list-disc list-inside space-y-1 text-sm">
            {qualis.map((q) => (
              <li key={q.id}>
                {q.qualifikation || 'Unbekannt'}
                              </li>
            ))}
          </ul>
        )}

        <div className="text-right mt-6">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

export default QualiModal;

