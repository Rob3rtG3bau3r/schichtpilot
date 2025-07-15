import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Info } from 'lucide-react';

const FeiertageFormular = ({ onRefresh }) => {
  const [bundesland, setBundesland] = useState('');
  const [typ, setTyp] = useState('Feiertag');
  const [name, setName] = useState('');
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [farbe, setFarbe] = useState('#22d3ee');
  const [feedback, setFeedback] = useState('');
  const [infoOpen, setInfoOpen] = useState(false);

  const handleSpeichern = async () => {
    if (!bundesland || !typ || !name || !von) {
      setFeedback('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }

    const jahr = new Date(von).getFullYear();

    const eintrag = {
      bundesland,
      typ,
      name,
      von,
      bis: typ === 'Feiertag' ? von : bis,
      jahr,
      farbe,
    };

    const { error } = await supabase.from('DB_FeiertageundFerien').insert(eintrag);

    if (error) {
      setFeedback('Fehler beim Speichern.');
      console.error(error);
    } else {
      setFeedback('Erfolgreich gespeichert.');
      setName('');
      setVon('');
      if (typ === 'Ferien') setBis('');
      if (onRefresh) onRefresh();
    }
  };

  const handleVonChange = (e) => {
    const value = e.target.value;
    setVon(value);
    setBis(value); // Bei allen Typen wird bis erstmal auf von gesetzt
  };

  return (
    <>
      <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl shadow">
        <div className="bg-gray-200 dark:bg-gray-800 flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Feiertag oder Ferien eintragen</h2>
          <button
            onClick={() => setInfoOpen(true)}
            className="text-blue-500 hover:text-blue-700"
            title="Info anzeigen"
          >
            <Info size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
          Hier kannst du Feiertage und Ferienzeiten eintragen, die dann im Kalender angezeigt werden.
        </p>

        <div className="grid grid-cols-1 gap-4">
          <div className="flex gap-4 ">
            <select
              value={bundesland}
              onChange={(e) => setBundesland(e.target.value)}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
            >
              <option value="">Bundesland wählen</option>
              {["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"].map((bl) => (
                <option key={bl} value={bl}>{bl}</option>
              ))}
            </select>

            <select
              value={typ}
              onChange={(e) => setTyp(e.target.value)}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
            >
              <option value="Feiertag">Feiertag</option>
              <option value="Ferien">Ferien</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Bezeichnung"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
          />

          <div className="flex gap-4">
            <input
              type="date"
              value={von}
              onChange={handleVonChange}
              className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
            />
            {typ === 'Ferien' && (
              <input
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className="w-1/2 p-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700"
              />
            )}
          </div>

          <div className="flex items-center gap-4 ">
            <label className="text-sm">Farbe:</label>
            <input
              type="color"
              value={farbe}
              onChange={(e) => setFarbe(e.target.value)}
              className="w-12 h-8 p-1 bg-gray-200 dark:bg-gray-800"
            />
          </div>

          {feedback && <p className="text-sm text-red-500 dark:text-red-300">{feedback}</p>}

          <button
            onClick={handleSpeichern}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
          >
            Eintrag speichern
          </button>
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-lg text-sm relative">
            <button
              onClick={() => setInfoOpen(false)}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-2">Informationen zu Feiertagen & Ferien</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Typ:</strong> Wähle Feiertag oder Ferien.</li>
              <li><strong>Datum:</strong> Bei Feiertagen nur Startdatum – wird automatisch als Ende gespeichert.</li>
              <li><strong>Farbe:</strong> Optional – für farbliche Darstellung im Kalender.</li>
              <li><strong>Bundesland:</strong> Auswahl z. B. NRW, BY, BW.</li>
              <li><strong>Jahr:</strong> Wird automatisch aus dem Startdatum berechnet.</li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
};

export default FeiertageFormular;

