import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';

const PersonalListe = ({ onUserSelect, className, datumStart }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [benutzer, setBenutzer] = useState([]);
  const [nurOhneGruppe, setNurOhneGruppe] = useState(() => {
  return localStorage.getItem('nurOhneGruppe') === 'true';
});
const [sortiereNachGruppe, setSortiereNachGruppe] = useState(() => {
  return localStorage.getItem('sortiereNachGruppe') === 'true';
});
useEffect(() => {
  const ladeBenutzerMitGruppeUndQualifikation = async () => {
    if (!firma || !unit) return;
    const heute = dayjs().format('YYYY-MM-DD');
    const abfrageDatum = datumStart || heute;

    // 1. Aktive User laden
    const { data: userData, error: userError } = await supabase
      .from('DB_User')
      .select('user_id, vorname, nachname')
      .eq('aktiv', true)
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    if (userError) {
      console.error('Fehler beim Laden der Benutzer:', userError.message);
      return;
    }

    const userIds = userData.map(u => u.user_id);

    // 2. Kampfliste laden
    const { data: kampfData, error: kampfError } = await supabase
      .from('DB_Kampfliste')
      .select('user, schichtgruppe')
      .eq('datum', abfrageDatum)
      .in('user', userIds);

    if (kampfError) {
      console.error('Fehler beim Laden der Schichtgruppen:', kampfError.message);
      return;
    }

    // 3. Qualifikationen laden
    const { data: qualiData, error: qualiError } = await supabase
      .from('DB_Qualifikation')
      .select('user_id, quali')
      .in('user_id', userIds);

    if (qualiError) {
      console.error('Fehler beim Laden der Qualifikationen:', qualiError.message);
      return;
    }

    const { data: qualiMatrix, error: matrixError } = await supabase
      .from('DB_Qualifikationsmatrix')
      .select('id, qualifikation, position')
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    if (matrixError) {
      console.error('Fehler beim Laden der Quali-Matrix:', matrixError.message);
      return;
    }

    // 4. Map für Gruppen
    const gruppeMap = {};
    for (const eintrag of kampfData) {
      gruppeMap[eintrag.user] = eintrag.schichtgruppe || null;
    }
// 5. Map für höchste Qualifikation pro User – nur mit Position
const qualiMap = {};
for (const user of userIds) {
  const userQualis = qualiData.filter(q => q.user_id === user);

  // Nur Qualis mit gültiger Matrix + Position
  const mitPosition = userQualis
    .map(q => {
      const matrix = qualiMatrix.find(m => m.id === q.quali);
      return matrix && matrix.position != null ? { ...matrix } : null;
    })
    .filter(Boolean);

  if (mitPosition.length > 0) {
    const wichtigste = mitPosition.sort((a, b) => a.position - b.position)[0];
    qualiMap[user] = wichtigste.qualifikation;
  }
}

    // 6. Finale Liste bauen
    let finalListe = userData.map(user => ({
      ...user,
      schichtgruppe: gruppeMap[user.user_id] || null,
      hauptquali: qualiMap[user.user_id] || null,
    }));

    if (nurOhneGruppe) {
      finalListe = finalListe.filter(u => !u.schichtgruppe);
    }

    finalListe.sort((a, b) => {
      if (sortiereNachGruppe) {
        const gruppeA = a.schichtgruppe;
        const gruppeB = b.schichtgruppe;
        if (!gruppeA && gruppeB) return 1;
        if (gruppeA && !gruppeB) return -1;
        if (!gruppeA && !gruppeB) return a.nachname.localeCompare(b.nachname);
        if (gruppeA === gruppeB) {
          return a.nachname.localeCompare(b.nachname);
        }
        return gruppeA.localeCompare(gruppeB);
      } else {
        return a.nachname.localeCompare(b.nachname);
      }
    });

    setBenutzer(finalListe);
  };

  ladeBenutzerMitGruppeUndQualifikation();
}, [firma, unit, nurOhneGruppe, sortiereNachGruppe, datumStart]);


  useEffect(() => {
  localStorage.setItem('nurOhneGruppe', nurOhneGruppe);
}, [nurOhneGruppe]);

useEffect(() => {
  localStorage.setItem('sortiereNachGruppe', sortiereNachGruppe);
}, [sortiereNachGruppe]);

  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className || ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Personal</h2>
        <div className="flex flex-col text-sm gap-1">
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
      </div>

      <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
        <ul className="space-y-2">
          {benutzer.map((user) => (
            <li
              key={user.user_id}
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded cursor-pointer"
              onClick={() => onUserSelect(user)}
            >
             {user.nachname}, {user.vorname}
– {user.schichtgruppe || '–'}
{user.hauptquali ? ` – [${user.hauptquali}]` : ''}

            </li>
          ))}
          {benutzer.length === 0 && (
            <li className="text-gray-400 italic">Keine aktiven Benutzer gefunden</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PersonalListe;