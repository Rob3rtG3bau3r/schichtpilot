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
  const [suche, setSuche] = useState('');

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

      // 1) Aktive User laden
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

      const userIds = (userData || []).map(u => u.user_id);
      if (userIds.length === 0) {
        setBenutzer([]);
        return;
      }

      // 2) Zuweisungen laden (neue DB) und auf Datum filtern
      //   - Wir begrenzen serverseitig auf von_datum ≤ abfrageDatum
      //   - und filtern clientseitig auf (bis_datum null oder ≥ abfrageDatum)
      const { data: zuwRaw, error: zuwError } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .in('user_id', userIds)
        .lte('von_datum', abfrageDatum);

      if (zuwError) {
        console.error('Fehler beim Laden der Zuweisungen:', zuwError.message);
      }

      const zuwGefiltert = (zuwRaw || []).filter(z =>
        dayjs(z.von_datum).isSameOrBefore(abfrageDatum, 'day') &&
        (!z.bis_datum || dayjs(z.bis_datum).isSameOrAfter(abfrageDatum, 'day'))
      );

      // pro User den "letzten" gültigen Eintrag (max von_datum) finden
      const zuwMap = new Map(); // user_id -> { schichtgruppe, von_datum }
      for (const z of zuwGefiltert) {
        const prev = zuwMap.get(z.user_id);
        if (!prev || dayjs(z.von_datum).isAfter(prev.von_datum, 'day')) {
          zuwMap.set(z.user_id, { schichtgruppe: z.schichtgruppe, von_datum: z.von_datum });
        }
      }

      // 3) Qualifikationen (wie gehabt)
      const { data: qualiData } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali')
        .in('user_id', userIds);

      const { data: qualiMatrix } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation, position')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      const qualiMap = {};
      for (const uid of userIds) {
        const userQualis = (qualiData || []).filter(q => q.user_id === uid);
        const mitPos = userQualis
          .map(q => (qualiMatrix || []).find(m => m.id === q.quali))
          .filter(m => m && m.position != null);
        if (mitPos.length > 0) {
          const wichtigste = mitPos.sort((a, b) => a.position - b.position)[0];
          qualiMap[uid] = wichtigste.qualifikation;
        }
      }

      // 4) Zusammenführen
      let finalListe = (userData || []).map(user => ({
        ...user,
        schichtgruppe: zuwMap.get(user.user_id)?.schichtgruppe || null,
        hauptquali: qualiMap[user.user_id] || null,
      }));

      // 5) Filter "nur ohne Gruppe"
      if (nurOhneGruppe) {
        finalListe = finalListe.filter(u => !u.schichtgruppe);
      }

      // 6) Sortierung
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

  const sichtbareBenutzer = benutzer.filter((u) => {
    const q = suche.trim().toLowerCase();
    if (!q) return true;
    const full1 = `${u.vorname || ''} ${u.nachname || ''}`.toLowerCase();
    const full2 = `${u.nachname || ''} ${u.vorname || ''}`.toLowerCase();
    return full1.includes(q) || full2.includes(q);
  });

  return (
    <div className={`bg-grey-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 ${className || ''}`}>
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold">Personal</h2>
        <Info
          className="w-5 h-5 cursor-pointer text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
        />
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-col md:flex-row gap-2 mb-2">
        <input
          type="text"
          placeholder="🔍 Namen suchen"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="border px-2 py-1 rounded w-full md:w-1/2 bg-gray-200 dark:bg-gray-800"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={nurOhneGruppe}
            onChange={(e) => setNurOhneGruppe(e.target.checked)}
            className="accent-blue-500"
          />
          nicht zugewiesen
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
            {sichtbareBenutzer.map((user) => (
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
            {benutzer.length > 0 && sichtbareBenutzer.length === 0 && (
              <tr>
                <td colSpan={4} className="text-gray-400 italic p-2">Keine Ergebnisse gefunden.</td>
              </tr>
            )}
            {benutzer.length === 0 && (
              <tr>
                <td colSpan={4} className="text-gray-400 italic p-2">Keine aktiven Benutzer gefunden.</td>
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
              <li>„Team“ kommt aus den Zuweisungen (gültig am ausgewählten Datum).</li>
              <li>Checkbox filtert nach „nicht zugewiesen“ am Datum.</li>
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
