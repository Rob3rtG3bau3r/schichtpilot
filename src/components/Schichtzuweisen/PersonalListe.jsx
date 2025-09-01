import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';

const SortIcon = ({ aktiv, richtung }) => {
  if (!aktiv) return <span className="opacity-20">↕</span>;
  return richtung === 'asc' ? <span>▲</span> : <span>▼</span>;
};

const PersonalListe = ({ onUserSelect, className, datumStart }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [benutzer, setBenutzer] = useState([]);
  const [nurOhneGruppe, setNurOhneGruppe] = useState(() => localStorage.getItem('nurOhneGruppe') === 'true');
  const [sortiereNachGruppe, setSortiereNachGruppe] = useState(() => localStorage.getItem('sortiereNachGruppe') === 'true');
  const [infoOffen, setInfoOffen] = useState(false);
  const [sortierung, setSortierung] = useState({ feld: 'nachname', richtung: 'asc' });

  const handleSortierung = (feld) => {
    setSortierung((aktuell) => {
      if (aktuell.feld === feld) {
        return { feld, richtung: aktuell.richtung === 'asc' ? 'desc' : 'asc' };
      } else {
        return { feld, richtung: 'asc' };
      }
    });
  };

  useEffect(() => {
    const ladeBenutzerMitGruppeUndQualifikation = async () => {
      if (!firma || !unit) return;
      const heute = dayjs().format('YYYY-MM-DD');
      const abfrageDatum = datumStart || heute;

      const { data: userData, error: userError } = await supabase
        .from('DB_User')
        .select('user_id, vorname, nachname, rolle')
        .eq('aktiv', true)
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (userError) {
        console.error('Fehler beim Laden der Benutzer:', userError.message);
        return;
      }

      const userIds = userData.map((u) => u.user_id);

      const { data: kampfData } = await supabase
        .from('DB_Kampfliste')
        .select('user, schichtgruppe')
        .eq('datum', abfrageDatum)
        .in('user', userIds);

      const { data: qualiData } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali')
        .in('user_id', userIds);

      const { data: qualiMatrix } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation, position')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      const gruppeMap = {};
      for (const eintrag of kampfData) {
        gruppeMap[eintrag.user] = eintrag.schichtgruppe || null;
      }

      const qualiMap = {};
      for (const user of userIds) {
        const userQualis = qualiData.filter((q) => q.user_id === user);
        const mitPosition = userQualis
          .map((q) => {
            const matrix = qualiMatrix.find((m) => m.id === q.quali);
            return matrix && matrix.position != null ? { ...matrix } : null;
          })
          .filter(Boolean);
        if (mitPosition.length > 0) {
          const wichtigste = mitPosition.sort((a, b) => a.position - b.position)[0];
          qualiMap[user] = wichtigste.qualifikation;
        }
      }

      let finalListe = userData.map((user) => ({
        ...user,
        schichtgruppe: gruppeMap[user.user_id] || null,
        hauptquali: qualiMap[user.user_id] || null,
      }));

      if (nurOhneGruppe) {
        finalListe = finalListe.filter((u) => !u.schichtgruppe);
      }

      // Sortierung
      finalListe.sort((a, b) => {
        const { feld, richtung } = sortierung;
        let aWert = (a[feld] || '').toString().toLowerCase();
        let bWert = (b[feld] || '').toString().toLowerCase();

        if (feld === 'name') {
          aWert = `${a.nachname} ${a.vorname}`.toLowerCase();
          bWert = `${b.nachname} ${b.vorname}`.toLowerCase();
        }
        if (aWert < bWert) return richtung === 'asc' ? -1 : 1;
        if (aWert > bWert) return richtung === 'asc' ? 1 : -1;
        return 0;
      });

      setBenutzer(finalListe);
    };

    ladeBenutzerMitGruppeUndQualifikation();
  }, [firma, unit, nurOhneGruppe, sortiereNachGruppe, datumStart, sortierung]);

  useEffect(() => localStorage.setItem('nurOhneGruppe', nurOhneGruppe), [nurOhneGruppe]);
  useEffect(() => localStorage.setItem('sortiereNachGruppe', sortiereNachGruppe), [sortiereNachGruppe]);

  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className || ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Personal</h2>
        <Info
          className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        />
      </div>

      {/* Filter */}
      <div className="flex flex-col text-sm gap-1 mb-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={nurOhneGruppe}
            onChange={(e) => setNurOhneGruppe(e.target.checked)}
            className="accent-blue-500"
          />
          nicht zugewiesen
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sortiereNachGruppe}
            onChange={(e) => setSortiereNachGruppe(e.target.checked)}
            className="accent-blue-500"
          />
          nach Schichten sortieren
        </label>
      </div>

      {/* Tabelle */}
      <div className="overflow-auto max-h-[calc(100vh-300px)]">
        <table className="min-w-full table-auto">
          <thead className="bg-gray-200 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="p-2 text-left cursor-pointer" onClick={() => handleSortierung('name')}>
                <div className="flex items-center gap-1">
                  Name
                  <SortIcon aktiv={sortierung.feld === 'name'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer" onClick={() => handleSortierung('rolle')}>
                <div className="flex items-center gap-1">
                  Rolle
                  <SortIcon aktiv={sortierung.feld === 'rolle'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer" onClick={() => handleSortierung('hauptquali')}>
                <div className="flex items-center gap-1">
                  Qualifikation
                  <SortIcon aktiv={sortierung.feld === 'hauptquali'} richtung={sortierung.richtung} />
                </div>
              </th>
              <th className="p-2 text-left cursor-pointer" onClick={() => handleSortierung('schichtgruppe')}>
                <div className="flex items-center gap-1">
                  Team
                  <SortIcon aktiv={sortierung.feld === 'schichtgruppe'} richtung={sortierung.richtung} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {benutzer.map((user) => (
              <tr
                key={user.user_id}
                className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onUserSelect(user)}
              >
                <td className="p-2">{user.nachname}, {user.vorname}</td>
                <td className="p-2 text-xs">{user.rolle || '–'}</td>
                <td className="p-2 text-xs">{user.hauptquali || '–'}</td>
                <td className="p-2 text-xs">{user.schichtgruppe || '–'}</td>
              </tr>
            ))}
            {benutzer.length === 0 && (
              <tr>
                <td colSpan="4" className="text-gray-400 italic p-2">Keine aktiven Benutzer gefunden</td>
              </tr>
            )}
          </tbody>
        </table>
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
            <h3 className="text-xl font-bold mb-2">Informationen zur Liste</h3>
            <ul className="list-disc pl-6 space-y-1 text-sm">
              <li>Nur aktive Benutzer aus der aktuellen Unit werden angezeigt.</li>
              <li>Die Liste kann nach Name, Rolle, Qualifikation und Team sortiert werden.</li>
              <li>Es wird die höchste Qualifikation des Benutzers angezeigt.</li>
              <li>Checkboxen filtern nach nicht zugewiesenen oder sortieren nach Schichtgruppen.</li>
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

export default PersonalListe;
