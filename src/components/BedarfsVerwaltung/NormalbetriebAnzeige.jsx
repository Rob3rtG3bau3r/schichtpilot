import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, Trash2 } from 'lucide-react';

const NormalbetriebAnzeige = ({ refreshKey }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [rows, setRows] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const lade = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select(`
          id,
          anzahl,
          quali_id,
          schichtart,
          namebedarf,
          DB_Qualifikationsmatrix (
            qualifikation,
            quali_kuerzel,
            betriebs_relevant
          )
        `)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', true);

      if (error) {
        console.error('Fehler beim Laden (Normalbetrieb):', error.message);
        setRows([]);
        return;
      }
      setRows(data || []);
    };
    lade();
  }, [firma, unit, refreshKey]);

  const gruppiert = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = r.quali_id;
      if (!map.has(key)) {
        map.set(key, {
          quali_id: r.quali_id,
          name: r.DB_Qualifikationsmatrix?.qualifikation || '–',
          kuerzel: r.DB_Qualifikationsmatrix?.quali_kuerzel || '',
          betriebs_relevant: !!r.DB_Qualifikationsmatrix?.betriebs_relevant,
          items: [] // { id, schichtart, anzahl }
        });
      }
      map.get(key).items.push({
        id: r.id,
        schichtart: r.schichtart, // null = ganztägig
        anzahl: Number(r.anzahl || 0)
      });
    }
    const order = (s) => (s == null ? 0 : s === 'Früh' ? 1 : s === 'Spät' ? 2 : 3);
    const arr = Array.from(map.values());
    arr.forEach(card => card.items.sort((a,b) => order(a.schichtart) - order(b.schichtart)));
    arr.sort((a,b) => (a.betriebs_relevant === b.betriebs_relevant)
      ? a.name.localeCompare(b.name, 'de')
      : (a.betriebs_relevant ? -1 : 1));
    return arr;
  }, [rows]);

  const summen = useMemo(() => {
    let fr = 0, sp = 0, na = 0;
    for (const card of gruppiert) {
      if (!card.betriebs_relevant) continue;
      const f = card.items.find(i => i.schichtart === 'Früh');
      const s = card.items.find(i => i.schichtart === 'Spät');
      const n = card.items.find(i => i.schichtart === 'Nacht');
      const g = card.items.find(i => i.schichtart == null);
      fr += f ? f.anzahl : (g ? g.anzahl : 0);
      sp += s ? s.anzahl : (g ? g.anzahl : 0);
      na += n ? n.anzahl : (g ? g.anzahl : 0);
    }
    return { fr, sp, na };
  }, [gruppiert]);

  const gesamtRelevant = useMemo(() => {
    return gruppiert
      .filter(c => c.betriebs_relevant)
      .reduce((sum, c) => {
        const f = c.items.find(i => i.schichtart === 'Früh');
        const s = c.items.find(i => i.schichtart === 'Spät');
        const n = c.items.find(i => i.schichtart === 'Nacht');
        const g = c.items.find(i => i.schichtart == null);
        const fr = f ? f.anzahl : (g ? g.anzahl : 0);
        const sp = s ? s.anzahl : (g ? g.anzahl : 0);
        const na = n ? n.anzahl : (g ? g.anzahl : 0);
        return sum + Math.max(fr, sp, na);
      }, 0);
  }, [gruppiert]);

  const handleLoeschen = async (id) => {
    if (!window.confirm('Soll dieser Eintrag gelöscht werden?')) return;
    setBusyId(id);
    const { error } = await supabase.from('DB_Bedarf').delete().eq('id', id);
    setBusyId(null);
    if (error) {
      alert('Löschen fehlgeschlagen.');
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
  };

  const renderItem = (it) => {
    const label = it.schichtart == null ? 'Ganztägig' : it.schichtart;
    return (
      <div key={it.id} className="flex items-center justify-between py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            {label}
          </span>
          <span className="font-medium">{it.anzahl}</span>
        </div>
        <button
          className={`p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 ${busyId===it.id ? 'opacity-50 pointer-events-none' : ''}`}
          title="Eintrag löschen"
          onClick={() => handleLoeschen(it.id)}
        >
          <Trash2 size={16} className="text-red-600" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Header */}
<div className="flex justify-between items-center mb-3">
  <h3 className="text-md font-semibold">
    Normalbetrieb
    {/* Summenzeile F/S/N (nur betriebsrelevant) */}
    <div className="text-sm font-medium border-t pt-2 dark:border-gray-600">
      <span className="mr-4">Früh: <b>{summen.fr}</b></span>
      <span className="mr-4">Spät: <b>{summen.sp}</b></span>
      <span>Nacht: <b>{summen.na}</b></span>
    </div>
  </h3>
  <button
    className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
    onClick={() => setInfoOffen(true)}
    title="Informationen"
  >
    <Info size={20} />
  </button>
</div>

{gruppiert.length === 0 ? (
  <p className="text-sm text-gray-500 italic">Keine Einträge im Normalbetrieb vorhanden.</p>
) : (
  <>
    {/* Betriebsrelevante */}
    <ul className="text-sm space-y-3 mb-4">
      {gruppiert.filter(c => c.betriebs_relevant).map((card) => (
        <li key={`rel-${card.quali_id}`} className="bg-gray-300 dark:bg-gray-700 rounded-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <div className="font-medium">{card.name}</div>
              <div className="text-xs text-gray-500">{card.kuerzel}</div>
            </div>
          </div>
          <div className="px-3 py-2">
            {card.items.map(renderItem)}
          </div>
        </li>
      ))}
    </ul>

    {/* Zusatz / nicht betriebsrelevant */}
    {gruppiert.some(c => !c.betriebs_relevant) && (
      <div className="mt-5">
        <h4 className="text-sm font-semibold mb-2">Weitere Qualifikationen (nicht gezählt)</h4>
        <ul className="text-sm space-y-3">
          {gruppiert.filter(c => !c.betriebs_relevant).map((card) => (
            <li key={`nrel-${card.quali_id}`} className="bg-gray-300/50 dark:bg-gray-700/50 rounded-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="font-medium">{card.name}</div>
                  <div className="text-xs text-gray-500">{card.kuerzel}</div>
                </div>
              </div>
              <div className="px-3 py-2">
                {card.items.map(renderItem)}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )}
  </>
)}

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex backdrop-blur-sm items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow animate-fade-in max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Normalbetrieb-Anzeige</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Nur <b>Normalbetrieb</b>-Einträge werden hier gezeigt.</li>
              <li>Pro Qualifikation: <i>Ganztägig</i> oder <i>Früh/Spät/Nacht</i>-Zeilen.</li>
              <li>Summen unten zählen ausschließlich <b>betriebsrelevante</b> Qualifikationen.</li>
              <li>„Weitere Qualifikationen (nicht gezählt)“ sind Zusatz/Info und fließen nicht in Summen ein.</li>
              <li>🗑 löscht die jeweilige Zeile nach Bestätigung.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
                onClick={() => setInfoOffen(false)}
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

export default NormalbetriebAnzeige;
