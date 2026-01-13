import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { GripVertical, Info, X, Trash2, Pencil } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';

const SchichtartTabelle = ({ onBearbeiten, refreshKey = 0 }) => {
  const [eintraege, setEintraege] = useState([]);
  const { sichtFirma, sichtUnit, istSuperAdmin } = useRollen();
  const [loading, setLoading] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  const ladeSchichtarten = async () => {
    setLoading(true);

    let query = supabase
      .from('DB_SchichtArt')
      .select(
        `
        *,
        DB_Kunden:firma_id ( firmenname ),
        DB_Unit:unit_id ( unitname )
      `
      );

    if (!istSuperAdmin) {
      query = query.eq('firma_id', sichtFirma).eq('unit_id', sichtUnit);
    }

    const { data, error } = await query.order('position', { ascending: true });

    if (error) {
      console.error('Fehler beim Laden:', error.message);
    } else {
      setEintraege(data || []);
    }
    setLoading(false);
  };

  // ✅ refreshKey triggert Reload nach Save
  useEffect(() => {
    ladeSchichtarten();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtFirma, sichtUnit, istSuperAdmin, refreshKey]);

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('index', index);
  };

  const handleDrop = async (e, targetIndex) => {
    const draggedIndex = e.dataTransfer.getData('index');
    if (draggedIndex === undefined || Number(draggedIndex) === targetIndex) return;

    const neueListe = [...eintraege];
    const [verschobenesItem] = neueListe.splice(Number(draggedIndex), 1);
    neueListe.splice(targetIndex, 0, verschobenesItem);

    const aktualisierteListe = neueListe.map((eintrag, idx) => ({
      ...eintrag,
      position: idx + 1,
    }));

    setEintraege(aktualisierteListe);

    for (const eintrag of aktualisierteListe) {
      await supabase
        .from('DB_SchichtArt')
        .update({ position: Number(eintrag.position) })
        .eq('id', eintrag.id);
    }
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm(
      'Willst du diese Schichtart wirklich löschen?\n\n' +
        '❗ Hinweis: Es können nur Schichtarten gelöscht werden, die noch nicht im Plan genutzt werden.'
    );
    if (!confirm) return;

    const { error } = await supabase.from('DB_SchichtArt').delete().eq('id', id);
    if (error) {
      alert('Fehler beim Löschen: ' + error.message);
    } else {
      ladeSchichtarten();
    }
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-black dark:text-white p-6 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700 relative z-10">
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center backdrop-blur-sm justify-center z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-xl w-[90%] max-w-xl animate-fade-in relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setInfoOffen(false)}
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4">Informationen zu Schichtarten</h3>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li>Schichtarten lassen sich per Drag & Drop verschieben.</li>
              <li>Die Reihenfolge wird automatisch gespeichert.</li>
              <li>Im Cockpit wird dieselbe Reihenfolge beim Ändern angezeigt.</li>
              <li>Farben & Kürzel helfen bei der visuellen Zuordnung.</li>
              <li>
                <strong>Löschen nur möglich, wenn die Schichtart noch nicht eingesetzt wurde.</strong>
              </li>
              <li>
                <strong>Pause:</strong> Wenn aktiviert, wird die Pausenzeit angezeigt (Minuten).
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Schichtarten</h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
            onClick={() => setInfoOffen(true)}
            title="Mehr Infos zu Schichtarten"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-300 dark:bg-gray-700">
          <tr>
            <th className="px-2 py-1"></th>
            <th className="px-2 py-1">Kürzel</th>
            <th className="px-2 py-1">Beginn</th>
            <th className="px-2 py-1">Ende</th>
            <th className="px-2 py-1">Dauer</th>
            <th className="px-2 py-1">Pause</th>
            <th className="px-2 py-1">Tag</th>
            <th className="px-2 py-1">Fix</th>
            <th className="px-2 py-1">SollPl.</th>
            <th className="px-2 py-1">Beschreibung</th>
            <th className="px-2 py-1">Firma ➝ Unit</th>
            <th className="px-2 py-1">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {eintraege.map((item, index) => (
            <tr
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, index)}
              className="hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <td className="px-2 py-1 text-gray-400 dark:text-gray-500 border-b border-gray-300 dark:border-gray-700 cursor-move">
                <GripVertical size={16} />
              </td>

              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                <span
                  className="px-2 py-1 rounded font-bold inline-block text-center"
                  style={{
                    backgroundColor: item.farbe_bg || '#ccc',
                    color: item.farbe_text || '#000',
                    minWidth: '30px',
                  }}
                >
                  {item.kuerzel}
                </span>
              </td>

              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.startzeit}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.endzeit}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.dauer} h
              </td>

              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.pause_aktiv ? `${item.pause_dauer ?? 0} min` : '—'}
              </td>

              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.endet_naechsten_tag ? 'yes' : 'no'}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.ignoriert_arbeitszeit ? 'yes' : 'no'}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.sollplan_relevant ? 'yes' : 'no'}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.beschreibung}
              </td>
              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700">
                {item.DB_Kunden?.firmenname || '❓'} ➝ {item.DB_Unit?.unitname || '❓'}
              </td>

              <td className="px-2 py-1 border-b border-gray-300 dark:border-gray-700 space-x-2">
                <button onClick={() => onBearbeiten(item)}>
                  <Pencil size={16} className="inline text-blue-500 hover:text-blue-700 mr-2" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SchichtartTabelle;
