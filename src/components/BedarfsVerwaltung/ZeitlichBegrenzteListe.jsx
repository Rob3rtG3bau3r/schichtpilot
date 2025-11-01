// components/BedarfsVerwaltung/ZeitlichBegrenzteListe.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

const Badge = ({ children }) => (
  <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600">
    {children}
  </span>
);

const ZeitlichBegrenzteListe = ({ refreshKey, onAuswahl, maxVisible = 10 }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();
  const [rows, setRows] = useState([]);
  const [eingeklappt, setEingeklappt] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const [zeigeVergangene, setZeigeVergangene] = useState(false);

  useEffect(() => {
    const lade = async () => {
      if (!firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select('id, von, bis, namebedarf, farbe, start_schicht, end_schicht, schichtart, quali_id')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', false)
        .order('von', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden (Zeitlich begrenzt):', error.message);
        setRows([]);
        return;
      }
      setRows(data || []);
    };
    lade();
  }, [firma, unit, refreshKey]);

  // Zu Blöcken gruppieren (ein Block = gemeinsamer Zeitraum+Name+Start/End-Schicht)
  const bloecke = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const key = `${r.von}|${r.bis}|${r.namebedarf}|${r.start_schicht||'Früh'}|${r.end_schicht||'Nacht'}`;
      if (!m.has(key)) {
        m.set(key, {
          key,
          von: r.von,
          bis: r.bis,
          namebedarf: r.namebedarf || '—',
          farbe: r.farbe || '#999',
          start_schicht: r.start_schicht || 'Früh',
          end_schicht: r.end_schicht || 'Nacht',
          items: [], // alle Zeilen des Blocks (ggf. versch. schichtart/quali)
        });
      }
      m.get(key).items.push(r);
    }

    const arr = Array.from(m.values());
    const heute = dayjs().startOf('day');
    return arr
      .filter(b => zeigeVergangene ? true : dayjs(b.bis).isSame(heute) || dayjs(b.bis).isAfter(heute))
      .sort((a,b) => dayjs(a.von).diff(dayjs(b.von)) || a.namebedarf.localeCompare(b.namebedarf, 'de'));
  }, [rows, zeigeVergangene]);

  const loescheBlock = async (block) => {
    if (!window.confirm(`„${block.namebedarf}“ (${dayjs(block.von).format('DD.MM.YYYY')}–${dayjs(block.bis).format('DD.MM.YYYY')}) komplett löschen?`)) return;
    setBusyKey(block.key);
    const { error } = await supabase
      .from('DB_Bedarf')
      .delete()
      .match({
        firma_id: Number(firma),
        unit_id: Number(unit),
        von: block.von,
        bis: block.bis,
        namebedarf: block.namebedarf,
        start_schicht: block.start_schicht,
        end_schicht: block.end_schicht,
        normalbetrieb: false,
      });
    setBusyKey(null);
    if (error) {
      alert('Löschen fehlgeschlagen.');
      return;
    }
    // Lokal entfernen
    setRows(prev => prev.filter(r =>
      !(r.von === block.von &&
        r.bis === block.bis &&
        (r.namebedarf || '—') === block.namebedarf &&
        (r.start_schicht || 'Früh') === block.start_schicht &&
        (r.end_schicht || 'Nacht') === block.end_schicht)
    ));
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setEingeklappt(!eingeklappt)}>
          {eingeklappt ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
          <h3 className="text-md font-semibold">Zeitlich begrenzte Einträge</h3>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-blue-600"
              checked={zeigeVergangene}
              onChange={(e) => setZeigeVergangene(e.target.checked)}
            />
            Vergangene anzeigen
          </label>
          <button
            className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
            onClick={() => setInfoOffen(true)}
            title="Informationen"
          >
            <Info size={20} />
          </button>
        </div>
      </div>

      {!eingeklappt && (
        <>
          {bloecke.length === 0 ? (
            <p className="text-sm text-gray-500 italic ">Keine zeitlich begrenzten Einträge vorhanden.</p>
          ) : (
            <ul className={`text-sm space-y-2 ${bloecke.length > maxVisible ? 'max-h-72 overflow-auto pr-1' : ''}`}>
              {bloecke.map((b) => (
<li
  key={b.key}
  className="bg-gray-300 dark:bg-gray-700 p-2 rounded-2xl hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition-colors"
>
  {/* Kopfzeile */}
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 min-w-0" onClick={() => onAuswahl?.(b)}>
      <span
        className="inline-block h-4 w-4 rounded-full ring-1 ring-black/10"
        style={{ backgroundColor: b.farbe }}
      />
      <div className="font-medium truncate">{b.namebedarf}</div>
    </div>

    <button
      className={`p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 ${busyKey===b.key ? 'opacity-50 pointer-events-none' : ''}`}
      title="Kompletten Block löschen"
      onClick={() => loescheBlock(b)}
    >
      <Trash2 size={16} className="text-red-600" />
    </button>
  </div>

  {/* Durchgehende Trennlinie über die gesamte Breite */}
  <div className="h-px bg-gray-200 dark:bg-gray-800 my-2 -mx-2" />

  {/* Inhalt unter der Linie */}
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0" onClick={() => onAuswahl?.(b)}>
      <div className="text-xs text-gray-700 dark:text-gray-300">
        {dayjs(b.von).format('DD.MM.YYYY')} – {dayjs(b.bis).format('DD.MM.YYYY')}
      </div>
      <div className="mt-1">
        <Badge>{b.start_schicht} → {b.end_schicht}</Badge>
      </div>
    </div>
  </div>
</li>


              ))}
            </ul>
          )}
        </>
      )}

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center backdrop-blur-sm justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow animate-fade-in max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zur Liste</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Jeder Eintrag bündelt alle Zeilen eines Zeitraums (gleiches <i>Von/Bis</i> + <i>Name</i> + <i>Start→Ende</i>).</li>
              <li>Start/Ende-Schicht definieren, welche Schichten an den Randtagen wirken.</li>
              <li>Der Mülleimer löscht den <b>gesamten Block</b> (alle zugehörigen Zeilen) aus dem Normalplan-Override.</li>
              <li>Mit dem Häkchen blendest du abgelaufene Einträge ein.</li>
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

export default ZeitlichBegrenzteListe;
