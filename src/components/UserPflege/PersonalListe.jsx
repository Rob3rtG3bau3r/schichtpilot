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
  const { sichtFirma: firma, sichtUnit: unit, rolle: eigeneRolle } = useRollen();
  const isSuperAdmin = eigeneRolle === 'SuperAdmin';

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

  // Mitarbeiter + höchste Quali + Team (heute) laden – Team aus DB_SchichtZuweisung
  useEffect(() => {
    const ladeDaten = async () => {
      // Für Nicht-SuperAdmin: ohne Firma/Unit keine Daten
      if (!isSuperAdmin && (!firma || !unit)) {
        setPersonen([]);
        return;
      }

      // 1) Mitarbeitende laden
      let mitarbeiterRes;
      if (isSuperAdmin) {
        mitarbeiterRes = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, rolle, firma_id, unit_id, aktiv');
      } else {
        mitarbeiterRes = await supabase
          .from('DB_User')
          .select('user_id, vorname, nachname, rolle, firma_id, unit_id, aktiv')
          .eq('firma_id', firma)
          .eq('unit_id', unit);
      }
      const { data: mitarbeiter, error: error1 } = mitarbeiterRes;
      if (error1) {
        console.error('Fehler beim Laden der Mitarbeitenden:', error1);
        setPersonen([]);
        return;
      }

      const aktive = (mitarbeiter || []).filter(m => m.aktiv !== false);
      const userIds = aktive.map((m) => m.user_id);
      if (userIds.length === 0) {
        setPersonen([]);
        return;
      }

      // 2) Quali-Zuweisungen nur für die geladenen User
      const { data: qualiEintraege, error: error2 } = await supabase
        .from('DB_Qualifikation')
        .select('user_id, quali')
        .in('user_id', userIds);
      if (error2) {
        console.error('Fehler beim Laden der Qualifikationen:', error2);
      }

      // 3) Matrix (Position & Bezeichnung) für die verwendeten Quali-IDs
      const qualiIds = Array.from(new Set((qualiEintraege || []).map((q) => q.quali)));
      let matrixById = new Map();
      if (qualiIds.length > 0) {
        let matrixRes;
        if (isSuperAdmin) {
          matrixRes = await supabase
            .from('DB_Qualifikationsmatrix')
            .select('id, qualifikation, position')
            .in('id', qualiIds);
        } else {
          matrixRes = await supabase
            .from('DB_Qualifikationsmatrix')
            .select('id, qualifikation, position')
            .in('id', qualiIds)
            .eq('firma_id', firma)
            .eq('unit_id', unit);
        }
        const { data: matrix, error: error3 } = matrixRes;
        if (error3) {
          console.error('Fehler beim Laden der Qualifikationsmatrix:', error3);
        } else {
          matrixById = new Map(
            (matrix || []).map((m) => [
              m.id,
              { qualifikation: m.qualifikation, position: Number(m.position) || 999 },
            ])
          );
        }
      }

      // 4) Zuweisungen am HEUTIGEN Tag aus DB_SchichtZuweisung
      const heute = new Date().toISOString().split('T')[0];

      // Hol alle Zuweisungen mit von_datum <= heute für die betroffenen User
      // (SuperAdmin: über alle Firmen/Units; sonst ist die Userliste sowieso gefiltert)
      const { data: zuwRaw, error: zuwErr } = await supabase
        .from('DB_SchichtZuweisung')
        .select('user_id, schichtgruppe, von_datum, bis_datum, firma_id, unit_id')
        .in('user_id', userIds)
        .lte('von_datum', heute);

      if (zuwErr) {
        console.error('Fehler beim Laden der Zuweisungen:', zuwErr);
      }

      // Pro User die am heutigen Tag gültige Zuweisung (max von_datum) ermitteln
      const zuwByUser = new Map(); // user_id -> { schichtgruppe, von_datum }
      (aktive || []).forEach((u) => {
        const rows = (zuwRaw || [])
          .filter(z =>
            z.user_id === u.user_id &&
            z.firma_id === u.firma_id &&
            z.unit_id === u.unit_id && // passend zum User
            (!z.bis_datum || z.bis_datum >= heute)
          );
        if (rows.length > 0) {
          const last = rows.reduce((acc, curr) =>
            acc == null || curr.von_datum > acc.von_datum ? curr : acc, null);
          if (last) {
            zuwByUser.set(u.user_id, { schichtgruppe: last.schichtgruppe, von_datum: last.von_datum });
          }
        }
      });

      // 5) Zusammenbauen
      const qualisByUser = new Map();
      (qualiEintraege || []).forEach((q) => {
        const arr = qualisByUser.get(q.user_id) || [];
        arr.push(q);
        qualisByUser.set(q.user_id, arr);
      });

      const personenMitDaten = (aktive || []).map((person) => {
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

        const zuw = zuwByUser.get(person.user_id);
        const aktuelleSchichtgruppe = zuw?.schichtgruppe ?? '–';

        return {
          user_id: person.user_id,
          name: `${person.vorname} ${person.nachname}`,
          rolle: person.rolle,
          schichtgruppe: aktuelleSchichtgruppe,
          hoechste_quali: besteBezeichnung,
          firma_id: person.firma_id,
          unit_id: person.unit_id,
        };
      });

      setPersonen(personenMitDaten);
    };

    ladeDaten();
  }, [firma, unit, refreshKey, isSuperAdmin]);

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
        <h2 className="text-md font-bold">Mitarbeiterliste{isSuperAdmin ? ' (alle Firmen)' : ''}</h2>
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
              <li>Nur aktive User werden angezeigt.</li>
              <li>Als <strong>SuperAdmin</strong> siehst du alle Firmen & Units.</li>
              <li>Pro Person wird die höchste zugewiesene Qualifikation angezeigt (nach Position).</li>
              <li>Team wird aus den <strong>Schichtzuweisungen</strong> für <strong>heute</strong> ermittelt.</li>
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
