// components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Trash2 } from 'lucide-react';



// --- Helpers für Datumsliste & Matrixaufbau (Preview-Tabelle) ---
const daysBetween = (start, end) => {
  if (!start || !end) return [];
  let d = dayjs(start);
  const last = dayjs(end);
  const out = [];
  while (d.isSameOrBefore(last, 'day')) {
    out.push(d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
  return out;
};

// Position-Sortierung: 1..n aufsteigend, Position 0 immer ganz nach unten
const sortByPositionWithZeroLast = (a, b) => {
  const pa = Number(a.position ?? 9999);
  const pb = Number(b.position ?? 9999);
  const aZero = pa === 0;
  const bZero = pb === 0;
  if (aZero && !bZero) return 1;
  if (!aZero && bZero) return -1;
  if (pa !== pb) return pa - pb;
  // fallback alphabetisch nach Kürzel
  return (a.kuerzel || '').localeCompare(b.kuerzel || '', 'de');
};

const buildMatrixFromRows = (rows) => {
  const m = new Map();
  (rows || []).forEach(r => {
    const kuerzel = r?.DB_Qualifikationsmatrix?.quali_kuerzel || '???';
    if (!m.has(kuerzel)) {
      m.set(kuerzel, { kuerzel, frueh: 0, spaet: 0, nacht: 0 });
    }
    const add = (slot) => { m.get(kuerzel)[slot] = (m.get(kuerzel)[slot] || 0) + Number(r.anzahl || 0); };
    const s = r.schichtart;
    if (!s || s === 'Alle') { add('frueh'); add('spaet'); add('nacht'); }
    else if (s === 'Früh') add('frueh');
    else if (s === 'Spät') add('spaet');
    else if (s === 'Nacht') add('nacht');
  });
  return Array.from(m.values()).sort((a, b) => a.kuerzel.localeCompare(b.kuerzel, 'de'));
};

const ZeitlichBegrenztBearbeiten = ({ eintrag, refreshKey, onSaved, onClose }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  // Editfelder
  const [namebedarf, setNamebedarf] = useState('');
  const [farbe, setFarbe] = useState('#888888');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [startSchicht, setStartSchicht] = useState('Früh');
  const [endSchicht, setEndSchicht] = useState('Nacht');

  // Übersicht über enthaltene Zeilen (nur Anzeige)
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [feedback, setFeedback] = useState('');

  // UI-State: gewählter Tag + Edit-Puffer
const [selectedDay, setSelectedDay] = useState(null); // default: kein Filter -> zeigt alles
const [editStarted, setEditStarted] = useState(false);
const [pending, setPending] = useState({}); 
// Struktur: { [qualiId]: { Frueh?:number, Spaet?:number, Nacht?:number } }

// leitet ab, welche Schichten an einem Tag gelten
const activeSlotsForDay = (dayISO, startSchicht, endSchicht, vonISO, bisISO) => {
  if (!dayISO || !vonISO || !bisISO) return { Frueh:true, Spaet:true, Nacht:true };

  const isVon = dayISO === vonISO;
  const isBis = dayISO === bisISO;

  // Hilfsfunktionen
  const only = (s) => ({
    Frueh: s === 'Früh',
    Spaet: s === 'Spät',
    Nacht: s === 'Nacht',
  });

  const upTo = (s) => ({
    Frueh: true,
    Spaet: s === 'Spät' || s === 'Nacht',
    Nacht: s === 'Nacht',
  });

  // Sonderfall: Zeitraum ist nur 1 Tag
  if (isVon && isBis) {
    // nur die End-Schicht bis zur End-Schicht? — für 1 Tag gilt: nur genau diese Schicht
    return only(endSchicht);
  }

  // Start-Tag (nur die Start-Schicht)
  if (isVon && !isBis) return only(startSchicht);

  // End-Tag (alle Schichten BIS zur End-Schicht)
  if (isBis && !isVon) return upTo(endSchicht);

  // Dazwischen: alle Schichten
  return { Frueh:true, Spaet:true, Nacht:true };
};


// Matrix aus rows aufbauen (summe je quali_id & schicht)
const buildEditableMatrix = (rows) => {
  const m = new Map();
  (rows || []).forEach(r => {
    const qualiId = r.quali_id;
    const kuerzel = r?.DB_Qualifikationsmatrix?.quali_kuerzel || '???';
    const position = r?.DB_Qualifikationsmatrix?.position ?? 9999;
    if (!m.has(qualiId)) {
      m.set(qualiId, { qualiId, kuerzel, position, Frueh:0, Spaet:0, Nacht:0 });
    }
    const slot = (r.schichtart === 'Früh' ? 'Frueh' : r.schichtart === 'Spät' ? 'Spaet' : r.schichtart === 'Nacht' ? 'Nacht' : null);
    if (!slot) {
      m.get(qualiId).Frueh += Number(r.anzahl || 0);
      m.get(qualiId).Spaet += Number(r.anzahl || 0);
      m.get(qualiId).Nacht += Number(r.anzahl || 0);
    } else {
      m.get(qualiId)[slot] += Number(r.anzahl || 0);
    }
  });
  // in sortiertes Array umwandeln
  return Array.from(m.values()).sort(sortByPositionWithZeroLast);
};

// initial pending aus rows ableiten, wenn rows neu kommen
useEffect(() => {
  const m = buildEditableMatrix(rows);
  const next = {};
  m.forEach(row => {
    next[row.qualiId] = { Frueh: row.Frueh, Spaet: row.Spaet, Nacht: row.Nacht };
  });
  setPending(next);
}, [rows]);

const onEditCell = (qualiId, slot, val) => {
  setEditStarted(true);
  setPending(prev => ({
    ...prev,
    [qualiId]: {
      ...(prev[qualiId] || {}),
      [slot]: Math.max(0, Number(val || 0)),
    }
  }));
};

  // Vorbelegen
  useEffect(() => {
    if (!eintrag) {
      setRows([]); setFeedback(''); return;
    }
    setNamebedarf(eintrag.namebedarf || '');
    setFarbe(eintrag.farbe || '#888888');
    setVon(eintrag.von || '');
    setBis(eintrag.bis || '');
    setStartSchicht(eintrag.start_schicht || 'Früh');
    setEndSchicht(eintrag.end_schicht || 'Nacht');
  }, [eintrag]);

  // Zeilen des Blocks laden (für Übersicht)
  useEffect(() => {
    const lade = async () => {
      if (!eintrag || !firma || !unit) return;
      const { data, error } = await supabase
        .from('DB_Bedarf')
        .select(`
          id, quali_id, schichtart, anzahl,
          DB_Qualifikationsmatrix ( id, quali_kuerzel, position )`)
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('normalbetrieb', false)
        .eq('von', eintrag.von)
        .eq('bis', eintrag.bis)
        .eq('namebedarf', eintrag.namebedarf || null)
        .eq('start_schicht', eintrag.start_schicht || 'Früh')
        .eq('end_schicht', eintrag.end_schicht || 'Nacht');

      if (error) {
        console.error('Zeilen laden (ZB) fehlgeschlagen:', error.message);
        setRows([]); return;
      }
      setRows(data || []);
    };
    lade();
  }, [eintrag, firma, unit, refreshKey]);

  const minBis = useMemo(() => (von ? dayjs(von).add(1,'day').format('YYYY-MM-DD') : ''), [von]);

  const validate = () => {
    if (!eintrag) return 'Kein Eintrag ausgewählt.';
    if (!namebedarf?.trim()) return 'Bitte eine Bezeichnung angeben.';
    if (!von || !bis) return 'Bitte Von/Bis angeben.';
    if (dayjs(bis).isBefore(dayjs(von).add(1,'day'))) return '„Bis“ muss mindestens einen Tag nach „Von“ liegen.';
    return '';
  };

  const handleSave = async () => {
    setFeedback('');
    const err = validate();
    if (err) { setFeedback(err); return; }
    setSaving(true);

    const match = {
      firma_id: Number(firma),
      unit_id: Number(unit),
      normalbetrieb: false,
      von: eintrag.von,
      bis: eintrag.bis,
      namebedarf: eintrag.namebedarf,
      start_schicht: eintrag.start_schicht || 'Früh',
      end_schicht: eintrag.end_schicht || 'Nacht',
    };

    const patch = {
      von, bis,
      namebedarf: namebedarf.trim(),
      farbe,
      start_schicht: startSchicht,
      end_schicht: endSchicht,
    };

    const { error } = await supabase.from('DB_Bedarf').update(patch).match(match);
    setSaving(false);

    if (error) {
      console.error('Speichern fehlgeschlagen:', error.message);
      setFeedback('Fehler beim Speichern.'); return;
    }
    setFeedback('Gespeichert.');
    onSaved?.();
  };



  if (!eintrag) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-xl">
        <div className="text-sm text-gray-500">
          Wähle oben einen zeitlich begrenzten Eintrag aus, um ihn hier zu bearbeiten.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-md font-semibold">Zeitlich begrenzt – Bearbeiten</h3>
        <button
          className="text-xs px-3 py-1 rounded bg-gray-200 dark:bg-gray-700"
          onClick={() => onClose?.()}
        >
          Schließen
        </button>
      </div>

      {/* Formular */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Bezeichnung</label>
          <input
            type="text"
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={namebedarf}
            onChange={(e) => setNamebedarf(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Farbe</label>
          <input
            type="color"
            className="w-full h-9 rounded bg-gray-200 dark:bg-gray-800"
            value={farbe}
            onChange={(e) => setFarbe(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Von</label>
          <input
            type="date"
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={von}
            onChange={(e) => setVon(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bis</label>
          <input
            type="date"
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={bis}
            min={minBis}
            onChange={(e) => setBis(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Start-Schicht</label>
          <select
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={startSchicht}
            onChange={(e) => setStartSchicht(e.target.value)}
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End-Schicht</label>
          <select
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={endSchicht}
            onChange={(e) => setEndSchicht(e.target.value)}
          >
            <option value="Früh">Früh</option>
            <option value="Spät">Spät</option>
            <option value="Nacht">Nacht</option>
          </select>
        </div>
      </div>

{/* Vorschau (Tages-Optik) + Enthaltene Zeilen (aufgeräumt) */}
<div className="mt-4 space-y-4">
  {/* Kopfzeile + Datum-Chips */}
  <div className="rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-3">
    <div className="flex items-center flex-wrap gap-2 mb-3">
      {farbe && (
        <span
          className="inline-block w-3 h-3 rounded-full border border-black/10"
          style={{ backgroundColor: farbe }}
          title={farbe}
        />
      )}
      <span className="text-sm font-medium">{namebedarf || '(ohne Titel)'}</span>
      {von && bis && (
        <span className="text-xs opacity-70">
          {dayjs(von).format('DD.MM.YYYY')} – {dayjs(bis).format('DD.MM.YYYY')}
        </span>
      )}
      <span className="text-xs opacity-70">• {startSchicht} → {endSchicht}</span>
    </div>

    {/* Datum-Chips (klickbar) */}
    <div className="flex gap-1 overflow-x-auto pb-1">
      {daysBetween(von, bis).map(d => {
        const active = selectedDay ? (selectedDay === d) : false;
        return (
          <button
            type="button"
            key={d}
            className={`text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-200'
            }`}
            title={dayjs(d).format('dddd, DD.MM.YYYY')}
            onClick={() => setSelectedDay(prev => (prev === d ? null : d))}
          >
            {dayjs(d).format('dd')} {dayjs(d).format('DD.MM.')}
          </button>
        );
      })}
    </div>

    {/* Tabelle: Quali | Früh | Spät | Nacht (editierbar) */}
    <div className="mt-3 overflow-x-auto">
      {rows.length === 0 ? (
        <div className="text-sm opacity-70">Keine Bedarfszeilen vorhanden.</div>
      ) : (
        <table className="min-w-full text-sm border-separate border-spacing-y-1">
          <thead>
            <tr className="text-left text-xs uppercase opacity-70">
              <th className="py-1 pr-4">Quali (Position)</th>
              <th className="py-1 pr-4">Früh</th>
              <th className="py-1 pr-4">Spät</th>
              <th className="py-1 pr-0">Nacht</th>
            </tr>
          </thead>
          <tbody>
            {buildEditableMatrix(rows).map((r, i) => {
              const slotsActive = activeSlotsForDay(
                selectedDay,
                startSchicht, endSchicht,
                von || null, bis || null
              );
              const val = pending[r.qualiId] || { Frueh:0, Spaet:0, Nacht:0 };
              const cell = (slotKey, disabled) => (
                <input
                  type="number"
                  min={0}
                  className={`w-20 text-center text-xs px-2 py-1 rounded border dark:bg-gray-800 ${
                    disabled ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  value={disabled ? '' : (val[slotKey] ?? 0)}
                  onChange={(e) => !disabled && onEditCell(r.qualiId, slotKey, e.target.value)}
                  placeholder={disabled ? '—' : '0'}
                  disabled={disabled}
                />
              );
              return (
                <tr key={i} className="bg-gray-50 dark:bg-gray-900/30">
                  <td className="py-1 pr-4">
                    <span className="font-mono mr-2">{r.kuerzel}</span>
                    <span className="opacity-60 text-[11px]">Pos {Number(r.position ?? 0)}</span>
                  </td>
                  <td className="py-1 pr-4">{cell('Frueh', selectedDay && !slotsActive.Frueh)}</td>
                  <td className="py-1 pr-4">{cell('Spaet', selectedDay && !slotsActive.Spaet)}</td>
                  <td className="py-1 pr-0">{cell('Nacht', selectedDay && !slotsActive.Nacht)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  {editStarted && (
    <div className="mt-3 text-xs px-3 py-2 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-100 dark:border-yellow-800">
      Änderungen wirken auf <strong>alle Tage</strong> im gewählten Zeitraum.
    </div>
  )}
    {/* Speichern der Mengen */}
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        disabled={!editStarted}
onClick={async () => {
  try {
    const blockMatch = {
      firma_id: Number(firma),
      unit_id: Number(unit),
      normalbetrieb: false,
      von: eintrag.von,
      bis: eintrag.bis,
      namebedarf: eintrag.namebedarf,
      start_schicht: eintrag.start_schicht || 'Früh',
      end_schicht: eintrag.end_schicht || 'Nacht',
    };

    // 1) Existierende Zeilen indexieren: pro qualiId sowohl Slot-Keys als auch 'Alle'
    //    key = `${qualiId}|Frueh|Spaet|Nacht|Alle`
    const existing = new Map();
    (rows || []).forEach(r => {
      const slotKey =
        r.schichtart === 'Früh' ? 'Frueh' :
        r.schichtart === 'Spät' ? 'Spaet' :
        r.schichtart === 'Nacht' ? 'Nacht' : 'Alle';
      existing.set(`${r.quali_id}|${slotKey}`, r);
    });

    const tasks = [];

    // kleine Helper für CRUD
    const upd = (id, anzahl) =>
      supabase.from('DB_Bedarf').update({ anzahl: Number(anzahl || 0) }).match({ id, ...blockMatch });

    const ins = (qualiId, schichtart, anzahl) =>
      supabase.from('DB_Bedarf').insert([{
        ...blockMatch,
        quali_id: Number(qualiId),
        schichtart,
        anzahl: Number(anzahl || 0),
      }]);

    const del = (id) =>
      supabase.from('DB_Bedarf').delete().match({ id, ...blockMatch });

    // 2) Für jede Quali pending-Werte holen und „Alle“-Sonderfälle korrekt auflösen
    for (const [qualiId, obj] of Object.entries(pending)) {
      const tF = Number(obj?.Frueh ?? 0);
      const tS = Number(obj?.Spaet ?? 0);
      const tN = Number(obj?.Nacht ?? 0);

      const exAll   = existing.get(`${qualiId}|Alle`);
      const exF     = existing.get(`${qualiId}|Frueh`);
      const exS     = existing.get(`${qualiId}|Spaet`);
      const exN     = existing.get(`${qualiId}|Nacht`);

      // FALL A: Es gibt eine „Alle“-Zeile
      if (exAll) {
        if (tF === tS && tS === tN) {
          // Werte identisch -> „Alle“ behalten/setzen und ggf. per-Slot-Zeilen löschen
          if (exF) tasks.push(del(exF.id));
          if (exS) tasks.push(del(exS.id));
          if (exN) tasks.push(del(exN.id));

          if (tF > 0) {
            tasks.push(upd(exAll.id, tF));
          } else {
            // Ziel 0 -> „Alle“-Zeile löschen
            tasks.push(del(exAll.id));
          }
        } else {
          // Werte ungleich -> „Alle“ auflösen -> löschen und per-Slot sauber anlegen/aktualisieren
          tasks.push(del(exAll.id));

          // FRÜH
          if (exF) {
            tF > 0 ? tasks.push(upd(exF.id, tF)) : tasks.push(del(exF.id));
          } else if (tF > 0) {
            tasks.push(ins(qualiId, 'Früh', tF));
          }
          // SPÄT
          if (exS) {
            tS > 0 ? tasks.push(upd(exS.id, tS)) : tasks.push(del(exS.id));
          } else if (tS > 0) {
            tasks.push(ins(qualiId, 'Spät', tS));
          }
          // NACHT
          if (exN) {
            tN > 0 ? tasks.push(upd(exN.id, tN)) : tasks.push(del(exN.id));
          } else if (tN > 0) {
            tasks.push(ins(qualiId, 'Nacht', tN));
          }
        }
        continue; // nächster qualiId
      }

      // FALL B: Keine „Alle“-Zeile -> normaler per-Slot Upsert + Löschen bei 0
      // FRÜH
      if (exF) {
        tF > 0 ? tasks.push(upd(exF.id, tF)) : tasks.push(del(exF.id));
      } else if (tF > 0) {
        tasks.push(ins(qualiId, 'Früh', tF));
      }

      // SPÄT
      if (exS) {
        tS > 0 ? tasks.push(upd(exS.id, tS)) : tasks.push(del(exS.id));
      } else if (tS > 0) {
        tasks.push(ins(qualiId, 'Spät', tS));
      }

      // NACHT
      if (exN) {
        tN > 0 ? tasks.push(upd(exN.id, tN)) : tasks.push(del(exN.id));
      } else if (tN > 0) {
        tasks.push(ins(qualiId, 'Nacht', tN));
      }
    }

    const results = await Promise.all(tasks);
    const err = results.find(r => r?.error);
    if (err?.error) throw new Error(err.error.message || 'Fehler beim Speichern');

    setEditStarted(false);
    setFeedback('Mengen gespeichert.');
    onSaved?.();
  } catch (e) {
    console.error(e);
    setFeedback('Fehler beim Speichern der Mengen.');
  }
}}
      >
        Mengen speichern
      </button>
    </div>
  </div>
</div>

      {/* Feedback + Aktionen */}
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-sm ${feedback?.startsWith('Fehler') || feedback?.includes('Bitte') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {feedback}
        </span>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-1 rounded text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
};

export default ZeitlichBegrenztBearbeiten;
