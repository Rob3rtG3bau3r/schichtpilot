import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, Trash2, X } from 'lucide-react';
import dayjs from 'dayjs';

const TermineUebersicht = ({ reloadKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [eintraege, setEintraege] = useState([]);
  const [alleQualis, setAlleQualis] = useState([]);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [suchtext, setSuchtext] = useState('');
  const [zeigeVergangene, setZeigeVergangene] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

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

  // Helper: Quali-IDs in Text umwandeln
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
    <div className="relative p-4 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700">

      {/* Info-Button oben rechts */}
      <button
        onClick={() => setInfoOffen(true)}
        className="absolute top-3 right-3 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Info-Modal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-xl w-[90%] max-w-lg relative animate-fade-in">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-500"
              onClick={() => setInfoOffen(false)}
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-bold mb-4">Informationen zu Terminen</h3>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li>Termine werden nach Jahr gefiltert (Dropdown links).</li>
              <li>Suche funktioniert live über die Bezeichnung.</li>
              <li>Mit dem Haken „Vergangene anzeigen“ lassen sich alte Termine einblenden.</li>
              <li>Qualifikationen oder Teams werden je nach Auswahl angezeigt.</li>
              <li>Die Farbe dient der optischen Hervorhebung.</li>
              <li>Einträge können über das rote Papierkorb-Icon gelöscht werden.</li>
              <li>Termine werden automatisch nach Datum sortiert.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Filterleiste */}
      <div className="flex items-center gap-4 mb-4">
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
            <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200 boder-b border-gray-300 dark:border-gray-700">
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
              <tr key={e.id} className="border-b border-gray-600 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700">
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
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 size={18} />
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
