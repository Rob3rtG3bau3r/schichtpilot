import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const schwerpunktOptionen = [
  'Betriebsspezifisch',
  'Arbeitssicherheit',
  'Zusatzqualifikationen'
];

const QualifikationsFormular = ({ bearbeitung, setBearbeitung, onReload }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const [kuerzel, setKuerzel] = useState('');
  const [qualifikation, setQualifikation] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [betriebsrelevant, setBetriebsrelevant] = useState(false);
  const [schwerpunkt, setSchwerpunkt] = useState('');
  const [aktiv, setAktiv] = useState(true);
  const [infoOffen, setInfoOffen] = useState(false);
  const [feedback, setFeedback] = useState('');

  const [fehlerKuerzel, setFehlerKuerzel] = useState(false);
  const [fehlerQuali, setFehlerQuali] = useState(false);
  const [fehlerSchwerpunkt, setFehlerSchwerpunkt] = useState(false);

  useEffect(() => {
    if (bearbeitung) {
      setKuerzel(bearbeitung.quali_kuerzel || '');
      setQualifikation(bearbeitung.qualifikation || '');
      setBeschreibung(bearbeitung.beschreibung || '');
      setBetriebsrelevant(bearbeitung.betriebs_relevant || false);
      setSchwerpunkt(bearbeitung.schwerpunkt || '');
      setAktiv(bearbeitung.aktiv !== undefined ? bearbeitung.aktiv : true);
    } else {
      setKuerzel('');
      setQualifikation('');
      setBeschreibung('');
      setBetriebsrelevant(false);
      setSchwerpunkt('');
      setAktiv(true);
    }
  }, [bearbeitung]);

  const handleSpeichern = async () => {
    setFehlerKuerzel(false);
    setFehlerQuali(false);
    setFehlerSchwerpunkt(false);

    let fehler = false;
    if (!kuerzel.trim()) { setFehlerKuerzel(true); fehler = true; }
    if (!qualifikation.trim()) { setFehlerQuali(true); fehler = true; }
    if (!schwerpunkt) { setFehlerSchwerpunkt(true); fehler = true; }

    if (fehler) {
      setFeedback('Bitte fülle alle Pflichtfelder aus.');
      setTimeout(() => setFeedback(''), 3000);
      return;
    }

    if (!firma || !unit || !userId) return;

    if (bearbeitung) {
      const { error } = await supabase
        .from('DB_Qualifikationsmatrix')
        .update({
          quali_kuerzel: kuerzel,
          qualifikation,
          beschreibung,
          betriebs_relevant: betriebsrelevant,
          schwerpunkt,
          aktiv,
        })
        .eq('id', bearbeitung.id);

      if (!error) {
        setFeedback('Änderung gespeichert!');
        setBearbeitung(null);
        onReload();
      } else {
        setFeedback('Fehler beim Ändern.');
      }

    } else {
      const { error } = await supabase.from('DB_Qualifikationsmatrix').insert([{
        quali_kuerzel: kuerzel,
        qualifikation,
        beschreibung,
        betriebs_relevant: betriebsrelevant,
        schwerpunkt,
        aktiv,
        firma_id: firma,
        unit_id: unit,
        created_by: userId,
      }]);

      if (!error) {
        setFeedback('Erfolgreich gespeichert!');
        setKuerzel('');
        setQualifikation('');
        setBeschreibung('');
        setBetriebsrelevant(false);
        setSchwerpunkt('');
        setAktiv(true);
        onReload();
      } else {
        setFeedback('Fehler beim Speichern.');
      }
    }

    setTimeout(() => setFeedback(''), 3000);
  };

  return (
    <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-6 rounded-xl shadow-xl border border-gray-300 dark:border-gray-700 max-w-xl mx-auto relative">
      <div className="absolute top-4 right-4">
        <button onClick={() => setInfoOffen(true)}>
          <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
        </button>
      </div>

      <h2 className="text-xl font-bold mb-4 text-center">
        {bearbeitung ? 'Qualifikation ändern' : 'Qualifikation anlegen'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Kürzel *</label>
          <input
            type="text"
            placeholder="Kürzel (max. 3 Zeichen)"
            value={kuerzel}
            onChange={(e) => setKuerzel(e.target.value.slice(0, 3))}
            className={`w-full border px-3 py-1 rounded bg-white dark:bg-gray-800 ${fehlerKuerzel ? 'border-red-500' : ''}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Qualifikation *</label>
          <input
            type="text"
            placeholder="Bezeichnung"
            value={qualifikation}
            onChange={(e) => setQualifikation(e.target.value)}
            className={`w-full border px-3 py-1 rounded bg-white dark:bg-gray-800 ${fehlerQuali ? 'border-red-500' : ''}`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Beschreibung</label>
          <textarea
            value={beschreibung}
            placeholder="Beschreibung"
            onChange={(e) => setBeschreibung(e.target.value.slice(0, 100))}
            rows={2}
            className="w-full border px-3 py-1 rounded bg-white dark:bg-gray-800"
          />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={betriebsrelevant} onChange={(e) => setBetriebsrelevant(e.target.checked)} className="accent-blue-500" />
          <label>Betriebsrelevant</label>
        </div>
        <div>
          <label className="block text-sm font-medium">Schwerpunkt *</label>
          <select
            value={schwerpunkt}
            onChange={(e) => setSchwerpunkt(e.target.value)}
            className={`w-full border px-3 py-1 rounded bg-white dark:bg-gray-800 ${fehlerSchwerpunkt ? 'border-red-500' : ''}`}
          >
            <option value="">Bitte wählen</option>
            {schwerpunktOptionen.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} className="accent-green-500" />
          <label>Aktiv</label>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button onClick={handleSpeichern} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          {bearbeitung ? 'Ändern & Speichern' : 'Speichern'}
        </button>
        {bearbeitung && (
          <button onClick={() => setBearbeitung(null)} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-600">
            Abbrechen
          </button>
        )}
      </div>

      {feedback && <p className="mt-2 text-sm italic">{feedback}</p>}

      {/* Info-Modal */}
      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl max-w-md w-full shadow-2xl animate-fade-in">
            <h3 className="text-lg font-bold mb-2">ℹ️ Erklärung: Qualifikation</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Kürzel:</strong> Max. 3 Zeichen, wird in der Schichtanzeige verwendet.</li>
              <li><strong>Qualifikation:</strong> Vollständiger Name der Qualifikation.</li>
              <li><strong>Beschreibung:</strong> Freitext, max. 100 Zeichen – dient als Erläuterung.</li>
              <li><strong>Betriebsrelevant:</strong> Nur diese Qualifikationen zählen bei der Bedarfsdeckung.</li>
              <li><strong>Schwerpunkt:</strong> Kategorisierung für interne Auswertung (Pflichtfeld).</li>
              <li><strong>Aktiv:</strong> Nur aktive Qualifikationen können zugewiesen werden.</li>
              <li><strong>Bearbeitung:</strong> Änderungen wirken sich sofort aus und sind für alle sichtbar.</li>
            </ul>
            <div className="text-right mt-4">
              <button onClick={() => setInfoOffen(false)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm">
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualifikationsFormular;

