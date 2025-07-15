// Start: Neuer Code für BenutzerTabelle.jsx mit D&L, Pagination, Alphabetfilter, Sortierung + InfoModal + Export + umsortiertes Buttonlayout + Namenssuchfeld
import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info, Download } from 'lucide-react';

const BenutzerTabelle = ({ onEditUser, refresh }) => {
  const [benutzer, setBenutzer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterFirma, setFilterFirma] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [filterRolle, setFilterRolle] = useState('');
  const [nurAktiv, setNurAktiv] = useState(true);
  const [sortCreated, setSortCreated] = useState(false);
  const [buchstabeFilter, setBuchstabeFilter] = useState('');
  const [namensSuche, setNamensSuche] = useState('');
  const [sortSpalte, setSortSpalte] = useState('nachname');
  const [sortRichtung, setSortRichtung] = useState(true);
  const [limit, setLimit] = useState(100);
  const [zeigeInfo, setZeigeInfo] = useState(false);

  const [firmenListe, setFirmenListe] = useState([]);
  const [unitsListe, setUnitsListe] = useState([]);
  const [rollenListe, setRollenListe] = useState([]);

  const ladeBenutzer = async () => {
    setLoading(true);
    let query = supabase
      .from('DB_User')
      .select('user_id, vorname, nachname, rolle, aktiv, firma_id, funktion, unit_id, email, created_at')
      .order(sortCreated ? 'created_at' : sortSpalte, { ascending: !sortRichtung })
      .limit(limit);

    if (filterFirma) query = query.eq('firma_id', filterFirma);
    if (filterUnit) query = query.eq('unit_id', filterUnit);
    if (filterRolle) query = query.eq('rolle', filterRolle);
    if (nurAktiv) query = query.eq('aktiv', true);
    if (buchstabeFilter) query = query.ilike('nachname', `${buchstabeFilter}%`);
    if (namensSuche) query = query.ilike('nachname', `%${namensSuche}%`);

    const { data: userData, error: userError } = await query;
    const { data: kunden, error: kundenError } = await supabase.from('DB_Kunden').select('id, firmenname');
    const { data: units, error: unitsError } = await supabase.from('DB_Unit').select('id, unitname');

    if (userError || kundenError || unitsError) {
      console.error('Fehler beim Laden:', userError || kundenError || unitsError);
      setLoading(false);
      return;
    }

    const mitNamen = userData.map(user => {
      const kundenName = kunden.find(k => k.id === user.firma_id)?.firmenname || '–';
      const unitName = units.find(u => u.id === user.unit_id)?.unitname || '–';
      return { ...user, firmenname: kundenName, unitname: unitName };
    });

    setBenutzer(mitNamen);
    setFirmenListe(kunden);
    setUnitsListe(units);
    setRollenListe([...new Set(userData.map(u => u.rolle).filter(Boolean))]);
    setLoading(false);
  };

  useEffect(() => {
    ladeBenutzer();
  }, [filterFirma, filterUnit, filterRolle, nurAktiv, sortCreated, buchstabeFilter, namensSuche, sortSpalte, sortRichtung, limit, refresh]);

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const handleSort = (spalte) => {
    if (sortSpalte === spalte) setSortRichtung(!sortRichtung);
    else {
      setSortSpalte(spalte);
      setSortRichtung(true);
    }
  };

  const handleCSVExport = () => {
    const headers = ['Vorname', 'Nachname', 'Firma', 'Unit', 'Rolle'];
    const rows = benutzer.map(u => [u.vorname, u.nachname, u.firmenname, u.unitname, u.rolle]);
    const csvContent = [headers, ...rows].map(e => e.join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'benutzerliste.csv';
    a.click();
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white p-4 rounded-xl shadow-xl w-full border border-gray-300 dark:border-gray-700 relative">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4 flex-wrap">
          <select value={filterFirma} onChange={(e) => setFilterFirma(e.target.value)} className="p-2 rounded bg-gray-100 dark:bg-gray-700">
            <option value="">Alle Firmen</option>
            {firmenListe.map(f => <option key={f.id} value={f.id}>{f.firmenname}</option>)}
          </select>

          <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)} className="p-2 rounded bg-gray-100 dark:bg-gray-700">
            <option value="">Alle Units</option>
            {unitsListe.map(u => <option key={u.id} value={u.id}>{u.unitname}</option>)}
          </select>

          <select value={filterRolle} onChange={(e) => setFilterRolle(e.target.value)} className="p-2 rounded bg-gray-100 dark:bg-gray-700">
            <option value="">Alle Rollen</option>
            {rollenListe.map((r, i) => <option key={i}>{r}</option>)}
          </select>

          <input
            type="text"
            placeholder="🔍 Nachname suchen"
            value={namensSuche}
            onChange={(e) => setNamensSuche(e.target.value)}
            className="p-2 rounded bg-gray-100 dark:bg-gray-700 placeholder:text-gray-400 text-sm"
          />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={nurAktiv} onChange={() => setNurAktiv(prev => !prev)} />
            Nur aktive anzeigen
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sortCreated} onChange={() => setSortCreated(prev => !prev)} />
            Aktuellste zuerst
          </label>
        </div>

        <button
          onClick={() => setZeigeInfo(true)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-300 ml-auto"
          title="Informationen zur Tabelle"
        >
          <Info size={22} />
        </button>
      </div>

      <div className="flex justify-between items-center mb-2">
        <div className="flex flex-wrap gap-1">
          {alphabet.map((b) => (
            <button
              key={b}
              className={`px-2 py-1 rounded text-xs ${buchstabeFilter === b ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => setBuchstabeFilter(b === buchstabeFilter ? '' : b)}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCSVExport}
            className="bg-gray-400 dark:bg-gray-600 text-white px-3 py-1 rounded text-sm"
            title="CSV Export"
          >
            <Download size={16} className="inline-block mr-1" /> Export
          </button>

          <button
            onClick={ladeBenutzer}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded text-sm"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="overflow-auto max-h-[70vh]">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              {['vorname', 'nachname', 'firmenname', 'unitname', 'rolle'].map(spalte => (
                <th
                  key={spalte}
                  className="px-3 py-2 cursor-pointer hover:underline"
                  onClick={() => handleSort(spalte)}
                >
                  {spalte.charAt(0).toUpperCase() + spalte.slice(1)} {sortSpalte === spalte ? (sortRichtung ? '↑' : '↓') : ''}
                </th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-4 text-center">Lade Benutzer...</td></tr>
            ) : benutzer.map((user) => (
              <tr key={user.user_id} className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                <td className="px-3 py-2">{user.vorname}</td>
                <td className="px-3 py-2">{user.nachname}</td>
                <td className="px-3 py-2">{user.firmenname}</td>
                <td className="px-3 py-2">{user.unitname}</td>
                <td className="px-3 py-2">{user.rolle}</td>
                <td className="px-3 py-2">
                  <button onClick={() => onEditUser(user)} className="text-blue-600 hover:text-blue-800">✏️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-center mt-4">
        <button onClick={() => setLimit(l => l + 100)} className="bg-gray-300 dark:bg-gray-600 text-black dark:text-white px-4 py-2 rounded">
          Mehr laden
        </button>
      </div>

      {zeigeInfo && (
        <div className="animate-fade-in fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-xl max-w-lg w-full">
            <h2 className="text-xl font-semibold mb-4">ℹ️ Benutzer-Tabelle</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>🔤 Nachname-Filter über Buchstabenleiste.</li>
              <li>📅 Sortierung nach „Aktuellste zuerst“ per Checkbox.</li>
              <li>⬆️ Tabellen-Spalten sind sortierbar durch Klick auf Überschrift.</li>
              <li>🧾 Initial werden max. 100 Benutzer geladen, „Mehr laden“ lädt 100 weitere.</li>
              <li>🖊️ Mit Klick auf ✏️ kannst du den Benutzer bearbeiten.</li>
              <li>📥 Exportiere alle aktuell angezeigten Einträge als CSV-Datei.</li>
            </ul>
            <div className="text-right mt-4">
              <button onClick={() => setZeigeInfo(false)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BenutzerTabelle; // Ende
