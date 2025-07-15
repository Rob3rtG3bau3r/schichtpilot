import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';

const TermineUebersicht = ({ reloadKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [eintraege, setEintraege] = useState([]);
  const [alleQualis, setAlleQualis] = useState([]);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [suchtext, setSuchtext] = useState('');
  const [zeigeVergangene, setZeigeVergangene] = useState(false);

  const jahre = [2023, 2024, 2025, 2026];

  // Qualifikationen laden
  useEffect(() => {
    const ladeQualis = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (error) {
        console.error('Fehler beim Laden der Qualifikationen:', error);
      } else {
        setAlleQualis(data);
      }
    };

    ladeQualis();
  }, [firma, unit]);

  // Termine laden
  useEffect(() => {
    const ladeEintraege = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_TerminVerwaltung')
        .select('id, datum, bezeichnung, quali_ids, team, farbe')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (error) {
        console.error('Fehler beim Laden der Termine:', error);
      } else {
        setEintraege(data);
      }
    };

    ladeEintraege();
  }, [firma, unit, reloadKey]);
//console.log('Firma:', firma, 'Unit:', unit);

  // Helper: Quali-IDs in Kürzel umwandeln
  const getQualiText = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) return null;
    return ids
      .map(id => {
        const eintrag = alleQualis.find(q => q.id === id);
        return eintrag ? eintrag.qualifikation : `ID:${id}`;
      })
      .join(', ');
  };

  // Filtern & Sortieren
const gefiltert = eintraege
  .filter(e => dayjs(e.datum).year() === parseInt(jahr))
  .filter(e => e.bezeichnung?.toLowerCase().includes(suchtext.toLowerCase()))
  .filter(e => zeigeVergangene || dayjs(e.datum).isSameOrAfter(dayjs(), 'day'))
  .sort((a, b) => new Date(a.datum) - new Date(b.datum));

  // Löschen
  const handleLoeschen = async (id) => {
    const { error } = await supabase
      .from('DB_TerminVerwaltung')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Löschen:', error);
    } else {
      setEintraege(prev => prev.filter(e => e.id !== id));
    }
  };

  return (
    <div className="p-4 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700">
     <div className="flex items-center gap-4">
  <select
    value={jahr}
    onChange={(e) => setJahr(e.target.value)}
    className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200"
  >
    {jahre.map(j => (
      <option key={j} value={j}>{j}</option>
    ))}
  </select>

  <input
    type="text"
    placeholder="Bezeichnung suchen..."
    value={suchtext}
    onChange={(e) => setSuchtext(e.target.value)}
    className="p-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 w-60"
  />

  <label className="flex items-center gap-1 text-sm">
    <input
      type="checkbox"
      checked={zeigeVergangene}
      onChange={() => setZeigeVergangene(!zeigeVergangene)}
    />
    Vergangene anzeigen
  </label>
</div>


      {/* Tabelle */}
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200">
              <th className="p-2 text-left">Datum</th>
              <th className="p-2 text-left">Bezeichnung</th>
              <th className="p-2 text-left">Qualifikationen / Teams</th>
              <th className="p-2 text-left">Farbe</th>
              <th className="p-2 text-left">Farbcode</th>
              <th className="p-2 text-left">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {gefiltert.map(e => (
              <tr key={e.id} className="border-b border-gray-600 hover:bg-gray-300 dark:bg-gray-700">
                <td className="p-2">{dayjs(e.datum).format('DD.MM.YYYY')}</td>
                <td className="p-2">{e.bezeichnung}</td>
                <td className="p-2">
                  {Array.isArray(e.quali_ids) && e.quali_ids.length > 0
                    ? getQualiText(e.quali_ids)
                    : (Array.isArray(e.team) ? e.team.join(', ') : '-')}
                </td>
                <td className="p-2">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: e.farbe }} />
                </td>
                <td className="p-2">{e.farbe}</td>
                <td className="p-2">
                  <button
                    onClick={() => handleLoeschen(e.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                  >
                    Löschen
                  </button>
                </td>
              </tr>
            ))}
            {gefiltert.length === 0 && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-400">
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TermineUebersicht;