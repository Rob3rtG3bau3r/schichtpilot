// components/BedarfsVerwaltung/ZeitlichBegrenztBearbeiten.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Trash2 } from 'lucide-react';

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
          DB_Qualifikationsmatrix ( quali_kuerzel )
        `)
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

  // >>> Einzellöschung pro Zeile
  const handleDeleteRow = async (rowId) => {
    if (!rowId) return;
    if (!window.confirm('Diesen Bedarfseintrag wirklich löschen?')) return;

    setDeletingId(rowId);
    const { error } = await supabase
      .from('DB_Bedarf')
      .delete()
      .eq('id', rowId)
      .eq('firma_id', Number(firma))
      .eq('unit_id', Number(unit));

    setDeletingId(null);

    if (error) {
      console.error('Löschen fehlgeschlagen:', error.message);
      setFeedback('Fehler beim Löschen.'); return;
    }

    // lokal aus Liste entfernen
    setRows(prev => prev.filter(r => r.id !== rowId));
    setFeedback('Eintrag gelöscht.');
    onSaved?.(); // damit ggf. rechts die Listen/Leiste aktualisieren
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

      {/* Enthaltene Zeilen (Read-only) mit Einzellöschung */}
      <div className="mt-4">
        <div className="text-sm font-medium mb-1">Enthaltene Zeilen</div>
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500">Keine Zeilen geladen.</div>
        ) : (
          <div className="rounded border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
            {rows.map(r => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 border">
                    {r.schichtart ?? 'Alle'}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {r.DB_Qualifikationsmatrix?.quali_kuerzel || '—'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{Number(r.anzahl || 0)}</span>
                  <button
                    className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                    onClick={() => handleDeleteRow(r.id)}
                    disabled={deletingId === r.id}
                    title="Eintrag löschen"
                  >
                    <Trash2
                      size={16}
                      className={deletingId === r.id ? 'text-red-300' : 'text-red-600'}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Feedback + Aktionen */}
      <div className="mt-4 flex items-center justify-between">
        <span className={`text-sm ${feedback?.startsWith('Fehler') || feedback?.includes('Bitte') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {feedback}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || deletingId !== null}
          className={`px-4 py-1 rounded text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
};

export default ZeitlichBegrenztBearbeiten;
