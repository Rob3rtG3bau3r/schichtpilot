import React, { useEffect, useState } from 'react';
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
  const [qualifikationen, setQualifikationen] = useState([]);
  const [selectedQuali, setSelectedQuali] = useState('');
  const [suche, setSuche] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [sortierung, setSortierung] = useState({ feld: 'name', richtung: 'asc' });

  const handleSortierung = (feld) => {
    setSortierung((aktuell) => {
      if (aktuell.feld === feld) {
        return {
          feld,
          richtung: aktuell.richtung === 'asc' ? 'desc' : 'asc',
        };
      } else {
        return {
          feld,
          richtung: 'asc',
        };
      }
    });
  };

  // Qualifikationen für Dropdown laden (aus Matrix)
  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!firma || !unit) {
        setQualifikationen([]);
        return;
      }
      const { data } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('qualifikation')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .order('qualifikation', { ascending: true });

      if (data) {
        const eindeutige = [...new Set(data.map((q) => q.qualifikation))];
        setQualifikationen(eindeutige);
      } else {
        setQualifikationen([]);
      }
    };
    ladeQualifikationen();
  }, [firma, unit]);

  // Mitarbeiter + höchste Quali + Team (heute) laden
  useEffect(() => {
    const ladeDaten = async () => {
      if (!firma || !unit) {
        setPersonen([]);
        return;
      }

      // 1) Mitarbeiter aus der Unit holen
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

      // 2) Qualifikationen dieser User laden
      const { data: qualiEintraege, error: error2 } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali')
        .in('user_id', userIds);

      if (error2) {
        console.error('Fehler beim Laden der Qualifikationen:', error2);
      }

      // 3) Matrix für genutzte Quali-IDs laden (Position + Bezeichnung)
      const qualiIds = Array.from(new Set((qualiEintraege || []).map((q) => q.quali)));
      let matrix = [];
      if (qualiIds.length > 0) {
        const { data: matrixData, error: error3 } = await supabase
          .from('DB_Qualifikationsmatrix')
          .select('id, qualifikation, position')
          .in('id', qualiIds)
          .eq('firma_id', firma)
          .eq('unit_id', unit);

        if (error3) {
          console.error('Fehler beim Laden der Qualifikationsmatrix:', error3);
        } else {
          matrix = matrixData || [];
        }
      }

      // 4) Team am HEUTIGEN Tag aus DB_SchichtZuweisung ermitteln
      const heute = new Date().toISOString().split('T')[0];

      // Hole alle Zuweisungen für diese User mit Start <= heute
      const { data: zuwRaw, error: zuwErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', userIds)
        .lte('von_datum', heute);

      if (zuwErr) {
        console.error('Fehler beim Laden der Schichtzuweisungen:', zuwErr);
      }

      // Pro User: am heutigen Tag gültigen Eintrag (max von_datum) auswählen
      const zuwMap = new Map(); // user_id -> schichtgruppe
      (zuwRaw || [])
        .filter(z => !z.bis_datum || z.bis_datum >= heute)
        .forEach(z => {
          const prev = zuwMap.get(z.user_id);
          if (!prev || z.von_datum > prev.von_datum) {
            zuwMap.set(z.user_id, { schichtgruppe: z.schichtgruppe, von_datum: z.von_datum });
          }
        });

      // 5) Zusammenführen: höchste Quali + Team
      const personenMitQuali = (mitarbeiter || []).map((person) => {
        const eigeneQualis = (qualiEintraege || [])
          .filter((q) => q.user_id === person.user_id)
          .map((q) => {
            const details = matrix.find((m) => m.id === q.quali);
            return {
              qualifikation: details?.qualifikation ?? '',
              position: details?.position ?? 999,
            };
          });

        const alle = eigeneQualis.map((q) => q.qualifikation).filter(Boolean);
        const hoechste = eigeneQualis.sort((a, b) => a.position - b.position)[0];

        const aktuelleSchichtgruppe = zuwMap.get(person.user_id)?.schichtgruppe ?? '–';

        return {
          user_id: person.user_id,
          name: `${person.vorname} ${person.nachname}`,
          rolle: person.rolle,
          schichtgruppe: aktuelleSchichtgruppe,
          hoechste_quali: hoechste?.qualifikation || '–',
          alle_qualis: alle,
        };
      });

      setPersonen(personenMitQuali);
    };

    ladeDaten();
  }, [firma, unit, refreshKey]);

  // Suche + Quali-Filter + Sortierung
  const gefiltertePersonen = personen
    .filter((p) =>
      p.name?.toLowerCase().includes(suche.toLowerCase()) &&
      (!selectedQuali || p.alle_qualis.includes(selectedQuali))
    )
    .sort((a, b) => {
      const { feld, richtung } = sortierung;

      const aWert =
        feld === 'name'
          ? a.name.split(' ').slice(-1)[0].toLowerCase()
          : a[feld]?.toLowerCase?.() || '';

      const bWert =
        feld === 'name'
          ? b.name.split(' ').slice(-1)[0].toLowerCase()
          : b[feld]?.toLowerCase?.() || '';

      if (aWert < bWert) return richtung === 'asc' ? -1 : 1;
      if (aWert > bWert) return richtung === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="p-4 shadow-xl rounded-xl border border-gray-300 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-md font-bold">Mitarbeiterliste</h2>
        <Info
          className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        />
      </div>

      {/* Suche + Dropdown */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          placeholder="🔍 Namen suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="border px-2 py-1 rounded w-full md:w-1/2 bg-gray-200 dark:bg-gray-800"
        />

        <select
          value={selectedQuali}
          onChange={(e) => setSelectedQuali(e.target.value)}
          className="border px-2 py-1 rounded w-full md:w-1/2 bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-200"
        >
          <option value="">Alle Qualifikationen</option>
          {qualifikationen.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      {/* Tabelle */}
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-200 dark:bg-gray-700">
            <tr>
              <th
                className="p-2 text-left cursor-pointer select-none"
                onClick={() => handleSortierung('name')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon
                    aktiv={sortierung.feld === 'name'}
                    richtung={sortierung.richtung}
                  />
                </div>
              </th>
              <th
                className="p-2 text-left cursor-pointer select-none"
                onClick={() => handleSortierung('rolle')}
              >
                <div className="flex items-center gap-1">
                  Rolle
                  <SortIcon
                    aktiv={sortierung.feld === 'rolle'}
                    richtung={sortierung.richtung}
                  />
                </div>
              </th>
              <th
                className="p-2 text-left cursor-pointer select-none"
                onClick={() => handleSortierung('hoechste_quali')}
              >
                <div className="flex items-center gap-1">
                  Qualifikation
                  <SortIcon
                    aktiv={sortierung.feld === 'hoechste_quali'}
                    richtung={sortierung.richtung}
                  />
                </div>
              </th>
              <th
                className="p-2 text-left cursor-pointer select-none"
                onClick={() => handleSortierung('schichtgruppe')}
              >
                <div className="flex items-center gap-1">
                  Team
                  <SortIcon
                    aktiv={sortierung.feld === 'schichtgruppe'}
                    richtung={sortierung.richtung}
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {gefiltertePersonen.map((p) => (
              <tr
                key={p.user_id}
                className="cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700"
                onClick={() => onUserClick(p)}
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
              <li>Nur aktive User der aktuellen Unit werden angezeigt.</li>
              <li>Pro Person wird die höchste zugewiesene Qualifikation angezeigt (nach Position).</li>
              <li>Du kannst nach Namen suchen und nach Qualifikation filtern.</li>
              <li><strong>Team</strong> kommt aus <strong>DB_SchichtZuweisung</strong> (gültig am heutigen Tag).</li>
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

