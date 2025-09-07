import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import dayjs from 'dayjs';
import { Info, ChevronDown, ChevronRight, RefreshCcw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useRollen } from '../../context/RollenContext';

const sortIcon = (activeKey, thisKey, dir) => {
  if (activeKey !== thisKey) return <ArrowUpDown className="w-3 h-3 inline-block opacity-60" />;
  return dir === 'asc' ? <ArrowUp className="w-3 h-3.5 inline-block" /> : <ArrowDown className="w-3 h-3.5 inline-block" />;
};

const add3DaysPassed = (ts) => dayjs(ts).add(3, 'day').isBefore(dayjs());
const dateIsTodayOrFuture = (d) => {
  if (!d) return true; // wenn kein Datum gespeichert ist, nicht ausfiltern
  const heute = dayjs().startOf('day');
  const dd = dayjs(d).startOf('day');
  return !dd.isBefore(heute);
};

// 1 = genehmigt, -1 = abgelehnt, 0 = offen (robust gegen 0/1/"true"/"false"/"t"/"f")
const triStatus = (v) => {
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 't' || v === 'TRUE' || v === 'T') return 1;
  if (v === false || v === 0 || v === '0' || v === 'false' || v === 'f' || v === 'FALSE' || v === 'F') return -1;
  return 0;
};

const AnfragenMitarbeiter = () => {
  const { userId, rolle, sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [alleAnfragen, setAlleAnfragen] = useState([]);
  const [activeTab, setActiveTab] = useState('offen'); // 'offen' | 'genehmigt' | 'abgelehnt'
  const [nurAb3Tagen, setNurAb3Tagen] = useState(false);
  const [nurZukunft, setNurZukunft] = useState(true);
  const [modalAnfrage, setModalAnfrage] = useState(null);
  const [kommentar, setKommentar] = useState('');
  const [entscheidung, setEntscheidung] = useState(null);
  const [bereichOffen, setBereichOffen] = useState(true);
  const [infoModalOffen, setInfoModalOffen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState({ key: 'datum', dir: 'asc' }); // datum | schicht | created_at | datum_entscheid

  useEffect(() => {
    const ladeAnfragen = async () => {
      if (!firma || !unit) return;

      let query = supabase
        .from('DB_AnfrageMA')
        .select('*, created_by_user:created_by ( vorname, nachname ), verantwortlicher_user:verantwortlicher ( vorname, nachname )')
        .eq('firma_id', firma)
        .eq('unit_id', unit);

      if (rolle === 'Employee') {
        query = query.eq('created_by', userId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fehler beim Laden:', error.message);
        return;
      }
      setAlleAnfragen(data || []);
    };

    ladeAnfragen();
  }, [rolle, firma, unit, userId, refreshKey]);

  // Zähler nach Normalisierung
  const counts = useMemo(() => {
    let offen = 0, genehmigt = 0, abgelehnt = 0;
    (alleAnfragen || []).forEach(a => {
      const s = triStatus(a.genehmigt);
      if (s === 1) genehmigt++;
      if (s === -1) abgelehnt++;
      if (s === 0 && a.datum_entscheid == null) {
        let ok = true;
        if (nurAb3Tagen) ok = ok && add3DaysPassed(a.created_at);
        if (nurZukunft) ok = ok && dateIsTodayOrFuture(a.datum);
        if (ok) offen++;
      }
    });
    return { offen, genehmigt, abgelehnt };
  }, [alleAnfragen, nurAb3Tagen, nurZukunft]);

  // Filtern + Sortieren
  const anfragen = useMemo(() => {
    const filtered = (alleAnfragen || []).filter(a => {
      const s = triStatus(a.genehmigt);
      if (activeTab === 'offen') {
        if (!(s === 0 && a.datum_entscheid == null)) return false;
        if (nurAb3Tagen && !add3DaysPassed(a.created_at)) return false;
        if (nurZukunft && !dateIsTodayOrFuture(a.datum)) return false;
        return true;
      }
      if (activeTab === 'genehmigt') return s === 1;      // zeigt auch alte 1/true/"t"
      if (activeTab === 'abgelehnt') return s === -1;     // zeigt auch alte 0/false/"f"
      return false;
    });

    const dirMul = sort.dir === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      const getVal = (row) => {
        switch (sort.key) {
          case 'datum': return row.datum ? dayjs(row.datum).valueOf() : -Infinity;
          case 'schicht': return (row.schicht || '').toString().toLowerCase();
          case 'created_at': return dayjs(row.created_at).valueOf();
          case 'datum_entscheid': return row.datum_entscheid ? dayjs(row.datum_entscheid).valueOf() : -Infinity;
          default: return 0;
        }
      };
      const va = getVal(a), vb = getVal(b);
      if (va < vb) return -1 * dirMul;
      if (va > vb) return 1 * dirMul;
      return 0;
    });
  }, [alleAnfragen, activeTab, sort, nurAb3Tagen, nurZukunft]);

  const toggleSort = (key) => {
    setSort(prev => (prev.key !== key ? { key, dir: 'asc' } : { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }));
  };

  const handleSpeichern = async () => {
    if (!modalAnfrage || entscheidung === null) return;
    const { id } = modalAnfrage;

    const { error } = await supabase
      .from('DB_AnfrageMA')
      .update({
        genehmigt: entscheidung,
        kommentar,
        verantwortlicher: userId,
        datum_entscheid: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Fehler beim Speichern:', error.message);
    } else {
      setModalAnfrage(null);
      setEntscheidung(null);
      setKommentar('');
      setRefreshKey(prev => prev + 1);
    }
  };

  return (
    <div className="bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-1 border border-gray-300 dark:border-gray-700">
      {/* Kopf */}
      <div
        onClick={() => setBereichOffen(prev => !prev)}
        role="button"
        tabIndex={0}
        className="w-full flex justify-between items-center py-3 bg-gray-200 dark:bg-gray-800 rounded-xl transition-all"
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setBereichOffen(prev => !prev)}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white">
          {bereichOffen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span>Anfragen</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={(e) => { e.stopPropagation(); setInfoModalOffen(true); }} title="Mehr Infos">
            <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setRefreshKey(prev => prev + 1); }} className="flex items-center gap-1 text-blue-600 hover:text-blue-800" title="Neu laden">
            <RefreshCcw className="w-4 h-4" />
            <span className="text-sm">Refresh</span>
          </button>
        </div>
      </div>

      {/* Inhalt */}
      {bereichOffen && (
        <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-b-xl">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex gap-2">
              <button className={`px-3 py-1.5 rounded-full text-sm ${activeTab === 'offen' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'}`} onClick={() => setActiveTab('offen')}>
                Offen ({counts.offen})
              </button>
              <button className={`px-3 py-1.5 rounded-full text-sm ${activeTab === 'genehmigt' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'}`} onClick={() => setActiveTab('genehmigt')}>
                Genehmigt ({counts.genehmigt})
              </button>
              <button className={`px-3 py-1.5 rounded-full text-sm ${activeTab === 'abgelehnt' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-200'}`} onClick={() => setActiveTab('abgelehnt')}>
                Abgelehnt ({counts.abgelehnt})
              </button>
            </div>

            {activeTab === 'offen' && (
              <div className="ml-auto flex gap-4 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={nurAb3Tagen} onChange={() => setNurAb3Tagen(v => !v)} />
                  Nur ≥ 3 Tage fällig
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="checkbox" checked={nurZukunft} onChange={() => setNurZukunft(v => !v)} />
                  Nur zukünftige Termine
                </label>
              </div>
            )}
          </div>

          {/* Tabelle */}
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-gray-300 text-left">
                  <th className="p-2 cursor-pointer select-none" onClick={() => toggleSort('datum')}>
                    <span className="inline-flex items-center gap-1">Datum {sortIcon(sort.key, 'datum', sort.dir)}</span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('schicht')}>
                    <span className="inline-flex items-center gap-1">Schicht {sortIcon(sort.key, 'schicht', sort.dir)}</span>
                  </th>
                  <th>Von</th>
                  <th>Antrag</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                    <span className="inline-flex items-center gap-1">Erstellt {sortIcon(sort.key, 'created_at', sort.dir)}</span>
                  </th>
                  <th>Status</th>
                  <th>Entscheider</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('datum_entscheid')}>
                    <span className="inline-flex items-center gap-1">Entschieden am {sortIcon(sort.key, 'datum_entscheid', sort.dir)}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {anfragen.map((a) => {
                  const s = triStatus(a.genehmigt);
                  const istOffen = s === 0 && a.datum_entscheid == null;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => istOffen && setModalAnfrage(a)}
                      className={`border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700 ${!istOffen ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      title={a.kommentar || ''}
                    >
                      <td className="p-2">{a.datum ? dayjs(a.datum).format('DD.MM.YYYY') : '-'}</td>
                      <td>{a.schicht || '-'}</td>
                      <td>{a.created_by_user ? `${a.created_by_user.vorname} ${a.created_by_user.nachname}` : '-'}</td>
                      <td>{a.antrag || '-'}</td>
                      <td>{dayjs(a.created_at).format('DD.MM.YY HH:mm')}</td>
                      <td>{s === 0 ? 'Offen' : s === 1 ? '✅' : '❌'}</td>
                      <td>{a.verantwortlicher_user ? `${a.verantwortlicher_user.vorname.charAt(0)}. ${a.verantwortlicher_user.nachname}` : '-'}</td>
                      <td>{a.datum_entscheid ? dayjs(a.datum_entscheid).format('DD.MM.YY HH:mm') : '-'}</td>
                    </tr>
                  );
                })}
                {anfragen.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-3 text-center text-gray-600 dark:text-gray-300">Keine Einträge.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal (nur offene anklickbar) */}
      {modalAnfrage && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl w-full max-w-md z-50">
            <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-white">Genehmigung prüfen</h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
              Ich habe überprüft, ob der Kollege am <b>{dayjs(modalAnfrage.datum).format('DD.MM.YYYY')}</b> die <b>{modalAnfrage.schicht}</b> entsprechend <b>{modalAnfrage.antrag}</b> genehmigt bekommt.
            </p>

            <div className="flex gap-4 mb-4">
              <button onClick={() => setEntscheidung(true)} className={`px-4 border border-gray-300 dark:border-gray-600 py-2 rounded ${entscheidung === true ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Ja</button>
              <button onClick={() => setEntscheidung(false)} className={`px-4 border border-gray-300 dark:border-gray-600 py-2 rounded ${entscheidung === false ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>Nein</button>
            </div>

            <textarea
              className="w-full p-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              rows="3"
              placeholder="Kommentar"
              value={kommentar}
              onChange={(e) => setKommentar(e.target.value)}
            />

            <div className="flex justify-end mt-4 gap-2">
              <button onClick={() => setModalAnfrage(null)} className="px-4 py-2 text-sm text-gray-500">Abbrechen</button>
              <button onClick={handleSpeichern} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoModalOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">ℹ️ Informationen</h3>
            <ul className="text-sm list-disc ml-4 space-y-2">
              <li>Alte Werte (0/1, "true"/"false", "t"/"f") werden automatisch erkannt.</li>
              <li>„Offen“ = kein Entscheid (optional mit ≥3 Tage & Datum ≥ heute).</li>
              <li>„Genehmigt“/„Abgelehnt“ zeigen alle historischen Einträge.</li>
              <li>Sortieren per Spaltenklick (Standard: Datum ↑).</li>
            </ul>
            <div className="text-right mt-4">
              <button onClick={() => setInfoModalOffen(false)} className="text-blue-600 hover:underline">Schließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnfragenMitarbeiter;
