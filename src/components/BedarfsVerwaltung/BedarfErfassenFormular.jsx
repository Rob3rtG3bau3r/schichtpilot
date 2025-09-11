import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const BedarfErfassenFormular = ({ ausgewaehlteQualiId, ausgewaehlteQualiName, onRefresh, vorbelegt }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const [anzahl, setAnzahl] = useState(1);
  const [von, setVon] = useState(vorbelegt?.von || '');
  const [bis, setBis] = useState(vorbelegt?.bis || '');
  const [namebedarf, setNamebedarf] = useState(vorbelegt?.namebedarf || '');
  const [farbe, setFarbe] = useState(vorbelegt?.farbe || '#3b82f6');
  const [normalbetrieb, setNormalbetrieb] = useState(!vorbelegt);
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);

  const heute = dayjs().format('YYYY-MM-DD');
  const minBis = von ? dayjs(von).add(1, 'day').format('YYYY-MM-DD') : heute;

  useEffect(() => {
    if (vorbelegt) {
      setNormalbetrieb(false);
      setVon(vorbelegt.von || '');
      setBis(vorbelegt.bis || '');
      setFarbe(vorbelegt.farbe || '#3b82f6');
      setNamebedarf(vorbelegt.namebedarf || '');
    }
  }, [vorbelegt]);

  // Beim Ändern von "Von" → "Bis" automatisch +1 Tag (falls leer/zu früh)
  const handleChangeVon = (value) => {
    setVon(value);
    const next = dayjs(value).add(1, 'day').format('YYYY-MM-DD');
    setBis((prev) => (!prev || dayjs(prev).isBefore(next) ? next : prev));
  };

  const handleSpeichern = async () => {
    setFeedback('');

    if (!ausgewaehlteQualiId || !anzahl || (!normalbetrieb && (!von || !bis))) {
      setFeedback('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }

    // Extra-Schutz: Bis darf nicht vor Von+1 liegen
    if (!normalbetrieb) {
      const requiredMinBis = dayjs(von).add(1, 'day');
      if (dayjs(bis).isBefore(requiredMinBis)) {
        setFeedback('Das Feld „Bis“ muss mindestens einen Tag nach „Von“ liegen.');
        return;
      }
    }

    const { error } = await supabase.from('DB_Bedarf').insert([{
      quali_id: ausgewaehlteQualiId,
      anzahl: Number(anzahl),
      von: normalbetrieb ? null : von,
      bis: normalbetrieb ? null : bis,
      namebedarf: normalbetrieb ? 'Normalbetrieb' : namebedarf,
      normalbetrieb,
      farbe,
      firma_id: firma,
      unit_id: unit,
      created_by: userId,
    }]);

    if (error) {
      console.error('Fehler beim Speichern:', error.message);
      setFeedback('Fehler beim Speichern.');
    } else {
      setFeedback('Bedarf erfolgreich gespeichert!');
      setAnzahl(1);
      if (normalbetrieb) {
        setNamebedarf('');
        setVon('');
        setBis('');
      }
      // Parent aktualisieren (rechte Vorschau bleibt wie bei dir umgesetzt)
      setTimeout(() => {
        onRefresh?.();
      }, 50);
    }
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl">
      {/* Überschrift + Info */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Bedarf erfassen</h2>
        <button
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          onClick={() => setInfoOffen(true)}
          title="Informationen zum Formular"
        >
          <Info size={20} />
        </button>
      </div>

      {/* Umschalter */}
      <div className="flex gap-4 mb-4">
        <button
          className={`px-3 py-1 rounded ${normalbetrieb ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
          onClick={() => setNormalbetrieb(true)}
        >
          Normalbetrieb
        </button>
        <button
          className={`px-3 py-1 rounded ${!normalbetrieb ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
          onClick={() => setNormalbetrieb(false)}
        >
          Zeitlich begrenzt
        </button>
      </div>

      {/* Farbe */}
      <div className="mb-2">
        <label className="block text-sm font-medium mb">Farbe</label>
        <input
          type="color"
          className="w-full bg-gray-200 dark:bg-gray-800 h-8 rounded"
          value={farbe}
          onChange={(e) => setFarbe(e.target.value)}
        />
      </div>

      {/* Nur bei zeitlich begrenzt */}
      {!normalbetrieb && (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Bezeichnung Bedarf</label>
          <input
            type="text"
            className="w-full px-3 py-1 rounded border dark:bg-gray-800"
            value={namebedarf}
            onChange={(e) => setNamebedarf(e.target.value)}
          />
        </div>
      )}

      {/* Qualifikation */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Qualifikation</label>
        <div className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 text-xl">
          {ausgewaehlteQualiName || 'Keine Qualifikation ausgewählt'}
        </div>
      </div>

      {/* Anzahl */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Anzahl</label>
        <input
          type="number"
          className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
          value={anzahl}
          min={1}
          onChange={(e) => setAnzahl(parseInt(e.target.value || '1', 10))}
        />
      </div>

      {/* Zeitraum (nur zeitlich begrenzt) */}
      {!normalbetrieb && (
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Von</label>
            <input
              type="date"
              className="w-full px-3 py-1 rounded border dark:bg-gray-800"
              value={von}
              min={heute}
              onChange={(e) => handleChangeVon(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Tipp: „Bis“ wird automatisch auf einen Tag nach „Von“ gesetzt.
            </p>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Bis</label>
            <input
              type="date"
              className="w-full px-3 py-1 rounded border dark:bg-gray-800"
              value={bis}
              min={minBis}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Feedback + Button */}
      <div className="mt-6 flex justify-between items-center">
        <span className="text-sm text-green-600 dark:text-green-400">{feedback}</span>
        <button
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
          onClick={handleSpeichern}
        >
          Speichern
        </button>
      </div>

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
            <h3 className="text-lg font-semibold mb-2">Hinweise zum Bedarfformular</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Wähle eine Qualifikation durch Klick in der linken Liste.</li>
              <li>Bei <b>Normalbetrieb</b> wird der Bedarf dauerhaft gespeichert.</li>
              <li>Bei <b>zeitlich begrenzt</b> musst du einen Zeitraum und eine Bezeichnung angeben.</li>
              <li><b>zeitlich begrenzt</b> ersetzt für den gewählten Zeitraum die Besetzung aus dem Normalbetrieb.</li>
              <li>Die Bezeichnung wird bei Normalbetrieb automatisch auf <b><i>„Normalbetrieb“</i></b> gesetzt.</li>
              <li>Die Anzahl gibt an, wie viele Personen mit dieser Qualifikation gebraucht werden.</li>
              <li>Wähle eine Farbe, um die Einträge visuell zu unterscheiden.</li>
              <li>Die ausgewählte Farbe wird im Cockpit später zur Orientierung genutzt.</li>
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

export default BedarfErfassenFormular;
