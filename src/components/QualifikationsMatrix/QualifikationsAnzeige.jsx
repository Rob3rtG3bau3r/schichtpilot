import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, RefreshCcw, Pencil, Trash2 } from 'lucide-react';

const QualifikationsAnzeige = ({ onEdit, onReload, refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [daten, setDaten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);
  const dragStartIndex = useRef(null);

  const ladeDaten = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('*')
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    if (!error) {
      const sortiert = data.sort((a, b) => {
        if (a.betriebs_relevant !== b.betriebs_relevant) return a.betriebs_relevant ? -1 : 1;
        return (a.position || 999) - (b.position || 999);
      });
      setDaten(sortiert);
    }
    setLoading(false);
  };

useEffect(() => {
  ladeDaten();
}, [firma, unit, refreshKey]);


  const handleLoeschen = async (eintrag) => {
    const { data: nutzung } = await supabase
      .from('DB_Qualifikation')
      .select('id')
      .eq('quali_id', eintrag.id)
      .limit(1);

    if (nutzung && nutzung.length > 0) {
      alert('Diese Qualifikation kann nicht gelöscht werden, da sie bereits zugewiesen wurde.');
      return;
    }

    const bestaetigt = window.confirm('Soll diese Qualifikation wirklich gelöscht werden?');
    if (!bestaetigt) return;

    await supabase.from('DB_Qualifikationsmatrix').delete().eq('id', eintrag.id);
    onReload(); // <- wichtig!
  };


  const handleDragStart = (index) => {
    dragStartIndex.current = index;
  };

  const handleDrop = async (dropIndex) => {
    const startIndex = dragStartIndex.current;
    if (startIndex === null || startIndex === dropIndex) return;

    const betriebsrelevante = daten.filter(e => e.betriebs_relevant);
    const andere = daten.filter(e => !e.betriebs_relevant);

    const moved = [...betriebsrelevante];
    const [verschoben] = moved.splice(startIndex, 1);
    moved.splice(dropIndex, 0, verschoben);

    // Positionen neu vergeben
    for (let i = 0; i < moved.length; i++) {
      moved[i].position = i + 1;
    }

    setDaten([...moved, ...andere]); // lokal sortiert anzeigen

    // In DB speichern
    for (const eintrag of moved) {
      await supabase
        .from('DB_Qualifikationsmatrix')
        .update({ position: eintrag.position })
        .eq('id', eintrag.id);
    }

    dragStartIndex.current = null;
  };

  return (
    <div className="bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Qualifikationen</h2>
        <div className="flex gap-3">
          <button onClick={ladeDaten}
           className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
          </button>
          <button onClick={() => setInfoOffen(true)}>
            <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>

        </div>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b dark:border-gray-700 bg-gray-300 dark:bg-gray-700">
            <th className="py-2 px-1">Kürzel</th>
            <th>Qualifikation</th>
            <th>Schwerpunkt</th>
            <th>Betriebsrelevant</th>
            <th>Aktiv</th>
            <th className="text-right">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {daten.map((eintrag, index) => (
            <tr
              key={eintrag.id}
              draggable={eintrag.betriebs_relevant}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className={`border-b dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700 ${
                eintrag.betriebs_relevant ? 'cursor-move' : ''
              }`}
              title={eintrag.beschreibung || ''}
            >
              <td className="py-1">{eintrag.quali_kuerzel}</td>
              <td>{eintrag.qualifikation}</td>
              <td>{eintrag.schwerpunkt}</td>
              <td>{eintrag.betriebs_relevant ? 'Ja' : 'Nein'}</td>
              <td>{eintrag.aktiv ? 'Ja' : 'Nein'}</td>
              <td className="text-right">
                <button onClick={() => onEdit(eintrag)}>
                  <Pencil size={16} className="inline text-blue-500 hover:text-blue-700 mr-2" />
                </button>
                <button onClick={() => handleLoeschen(eintrag)}>
                  <Trash2 size={16} className="inline text-red-500 hover:text-red-700" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-xl text-sm text-gray-800 dark:text-gray-100 relative animate-fade-in"
          >
            <button
              onClick={() => setInfoOffen(false)}
              className="absolute top-2 right-4 text-gray-400 hover:text-black dark:hover:text-white text-xl"
            >
              &times;
            </button>
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Qualifikationsliste</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>Betriebsrelevante Qualifikationen können per Drag & Drop sortiert werden</li>
              <li>Nur diese bekommen eine Positionsnummer</li>
              <li>Andere werden alphabetisch angezeigt</li>
              <li>Hover über Kürzel zeigt die Beschreibung</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualifikationsAnzeige;