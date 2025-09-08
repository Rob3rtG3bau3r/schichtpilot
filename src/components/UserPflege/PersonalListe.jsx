'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const SortIcon = ({ aktiv, richtung }) => {
  if (!aktiv) return <span className="opacity-20">↕</span>;
  return richtung === 'asc' ? <span>▲</span> : <span>▼</span>;
};

const Personalliste = ({ onUserClick, refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [personen, setPersonen] = useState([]);
  const [suche, setSuche] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [sortierung, setSortierung] = useState({ feld: 'name', richtung: 'asc' });

  const handleSortierung = (feld) => {
    setSortierung((aktuell) =>
      aktuell.feld === feld
        ? { feld, richtung: aktuell.richtung === 'asc' ? 'desc' : 'asc' }
        : { feld, richtung: 'asc' }
    );
  };

  // Mitarbeiter + höchste Quali + Team (heute) laden
  useEffect(() => {
    const ladeDaten = async () => {
      if (!firma || !unit) {
        setPersonen([]);
        return;
      }

      // 1) Mitarbeitende (aktiv) der Firma/Unit
      const { data: mitarbeiter, error: error1 } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true);

      if (error1) {
        console.error('Fehler beim Laden der Mitarbeitenden:', error1);
        setPersonen([]);
        return;
      }
      const userIds = (mitarbeiter || []).map((m) => m.user_id);
      if (userIds.length === 0) {
        setPersonen([]);
        return;
      }

      // 2) Quali-Zuweisungen (DB_Qualifikation.quali -> Matrix.id)
      const { data: qualiEintraege, error: error2 } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali');
      if (error2) console.error('Fehler beim Laden der Qualifikationen:', error2);

      // 3) Matrix (Position & Bezeichnung) der Firma/Unit für die verwendeten IDs
      const qualiIds = Array.from(new Set((qualiEintraege || []).map((q) => q.quali)));
      let matrixById = new Map();
      if (qualiIds.length > 0) {
        const { data: matrix, error: error3 } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, position')
          .in('id', qualiIds)
          .eq('firma_id', firma)
          .eq('unit_id', unit);
        if (error3) {
          console.error('Fehler beim Laden der Qualifikationsmatrix:', error3);
        } else {
          matrixById = new Map(
            (matrix || []).map((m) => [m.id, { qualifikation: m.qualifikation, position: Number(m.position) || 999 }])
          );
        }
      }

      // 4) Kampfliste-Einträge für HEUTE (Team)
      const heute = new Date().toISOString().split('T')[0];
      const { data: kampfliste, error: errorKampfliste } = await supabase
        .from('DB_Kampfliste')
        .select('user, schichtgruppe')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('datum', heute);
      if (errorKampfliste) console.error('Fehler beim Laden der Kampfliste:', errorKampfliste);

      // 5) Zusammenbauen
      const qualisByUser = new Map();
      (qualiEintraege || []).forEach((q) => {
        const arr = qualisByUser.get(q.user_id) || [];
        arr.push(q);
        qualisByUser.set(q.user_id, arr);
      });

      const personenMitDaten = (mitarbeiter || []).map((person) => {
        // höchste Quali: kleinste Matrix-Position
        const eigene = qualisByUser.get(person.user_id) || [];
        let besteBezeichnung = '–';
        let bestePos = 999;

        eigene.forEach((q) => {
          const m = matrixById.get(q.quali);
          if (m?.qualifikation && m.position < bestePos) {
            bestePos = m.position;
            besteBezeichnung = m.qualifikation;
          }
        });

        const kampfEintrag = kampfliste?.find((k) => k.user === person.user_id);
        const aktuelleSchichtgruppe = kampfEintrag?.schichtgruppe ?? '–';

        return {
          user_id: person.user_id,
          name: `${person.vorname} ${person.nachname}`,
          rolle: person.rolle,
          schichtgruppe: aktuelleSchichtgruppe,
          hoechste_quali: besteBezeichnung,
        };
      });

      setPersonen(personenMitDaten);
    };

    ladeDaten();
  }, [firma, unit, refreshKey]);

  // Filter (nur Suche) + Sort
  const gefiltertePersonen = useMemo(() => {
    const s = (suche || '').toLowerCase();
    const arr = personen.filter((p) => p.name?.toLowerCase().includes(s));

    const { feld, richtung } = sortierung;
    const dir = richtung === 'asc' ? 1 : -1;

    return [...arr].sort((a, b) => {
      const aWert =
        feld === 'name'
          ? a.name.split(' ').slice(-1)[0].toLowerCase()
          : a[feld]?.toLowerCase?.() || '';
      const bWert =
        feld === 'name'
          ? b.name.split(' ').slice(-1)[0].toLowerCase()
          : b[feld]?.toLowerCase?.() || '';

      if (aWert < bWert) return -1 * dir;
      if (aWert > bWert) return 1 * dir;
      return 0;
    });
  }, [personen, suche, sortierung]);

  return (
    <div className="p-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-md font-bold">Mitarbeiterliste</h2>
        <Info
          className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        />
      </div>

      {/* Suche */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="🔍 Namen suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="border px-2 py-1 rounded w-full bg-gray-200 dark:bg-gray-800"
        />
      </div>

      {/* Tabelle */}
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('name')}>
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon aktiv={sortierung.feld === 'name'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('rolle')}>
                <div className="flex items-center gap-1">
                  Rolle
                  <SortIcon aktiv={sortierung.feld === 'rolle'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('hoechste_quali')}>
                <div className="flex items-center gap-1">
                  Qualifikation
                  <SortIcon aktiv={sortierung.feld === 'hoechste_quali'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer select-none" onClick={() => handleSortierung('schichtgruppe')}>
                <div className="flex items-center gap-1">
                  Team
                  <SortIcon aktiv={sortierung.feld === 'schichtgruppe'} richtung={sortierung.richtung} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {gefiltertePersonen.map((p) => (
              <tr
                key={p.user_id}
                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700"
                onClick={() => onUserClick?.(p)}
              >
                <td className="py-2 px-2">{p.name}</td>
                <td className="px-2 text-xs">{p.rolle}</td>
                <td className="px-2 text-xs">{p.hoechste_quali}</td>
                <td className="px-2 text-xs">{p.schichtgruppe}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {gefiltertePersonen.length === 0 && (
          <p className="text-sm mt-2">Keine Ergebnisse gefunden.</p>
        )}
      </div>

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex justify-center items-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-xl w-full animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-2">Informationen</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Nur aktive User der aktuellen Firma & Unit werden angezeigt.</li>
              <li>Pro Person wird die höchste zugewiesene Qualifikation angezeigt (nach Position).</li>
              <li>Suche nach Namen und Sortierung nach allen Spalten.</li>
              <li>Team wird aus der Kampfliste für <strong>heute</strong> ermittelt.</li>
            </ul>
            <div className="mt-4 text-right">
              <button
                onClick={() => setInfoOffen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded"
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

export default Personalliste;

