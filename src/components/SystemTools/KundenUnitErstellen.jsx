import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const KundenUnitErstellen = ({ firmaId, onCreated }) => {
  const { sichtFirma } = useRollen();
  const firma = firmaId ?? sichtFirma;

  const [unitName, setUnitName] = useState('');
  const [standort, setStandort] = useState('');
  const [land, setLand] = useState('DE'); // ✅ NEU: Standard DE
  const [bundesland, setBundesland] = useState('');
  const [anzahlMA, setAnzahlMA] = useState(1);
  const [anzahlSchichten, setAnzahlSchichten] = useState(2);
  const [schichtNamen, setSchichtNamen] = useState([]);

  const handleReset = () => {
    setUnitName('');
    setStandort('');
    setLand('DE');
    setBundesland('');
    setAnzahlMA(1);
    setAnzahlSchichten(2);
    setSchichtNamen([]);
  };

  const handleSave = async () => {
    if (!firma) {
      console.error('Keine Firma ausgewählt');
      return;
    }

    if (!land) {
      alert('Bitte ein Land auswählen!');
      return;
    }

    // Bundesland nur erzwingen, wenn Land = DE (für AT/CH später andere Logik)
    if (land === 'DE' && !bundesland) {
      alert('Bitte ein Bundesland auswählen!');
      return;
    }

    // 1. Unit speichern
    const { data: unitData, error: unitError } = await supabase
      .from('DB_Unit')
      .insert([
        {
          firma: firma,
          unitname: unitName,
          unit_standort: standort,
          land: land, // ✅ NEU
          bundesland: land === 'DE' ? bundesland : null, // ✅ bei Nicht-DE optional leer
          anzahl_ma: anzahlMA,
          anzahl_schichten: anzahlSchichten,
          schichtname1: schichtNamen[0] || null,
          schichtname2: schichtNamen[1] || null,
          schichtname3: schichtNamen[2] || null,
          schichtname4: schichtNamen[3] || null,
          schichtname5: schichtNamen[4] || null,
          schichtname6: schichtNamen[5] || null,
        },
      ])
      .select()
      .single();

    if (unitError) {
      console.error('Fehler beim Speichern der Unit:', unitError.message);
      return;
    }

    // 2. Schichtarten direkt einfügen
    const schichtarten = [
      { kuerzel: 'F', beschreibung: 'Frühschicht', start: '06:00', ende: '13:00', dauer: 7, bg: '#4aca1c', text: '#000000', relevant: true, ignoriert: false, pos: 1 },
      { kuerzel: 'S', beschreibung: 'Spätschicht', start: '13:00', ende: '21:00', dauer: 8, bg: '#ffa200', text: '#000000', relevant: true, ignoriert: false, pos: 2 },
      { kuerzel: 'N', beschreibung: 'Nachtschicht', start: '21:00', ende: '06:00', dauer: 9, bg: '#0040ff', text: '#ffffff', relevant: true, ignoriert: false, pos: 3 },
      { kuerzel: 'U', beschreibung: 'Urlaub', start: '00:00', ende: '00:00', dauer: 0, bg: '#fafb0d', text: '#000000', relevant: false, ignoriert: true, pos: 5 },
      { kuerzel: '-', beschreibung: 'Frei', start: '00:00', ende: '00:00', dauer: 0, bg: '#e3dede', text: '#000000', relevant: true, ignoriert: false, pos: 4 },
      { kuerzel: 'KO', beschreibung: 'Krank ohne Attest', start: '00:00', ende: '00:00', dauer: 0, bg: '#e3dede', text: '#000000', relevant: false, ignoriert: true, pos: 6 },
      { kuerzel: 'K', beschreibung: 'Krank mit Attest', start: '00:00', ende: '00:00', dauer: 0, bg: '#e3dede', text: '#000000', relevant: false, ignoriert: true, pos: 7 }
    ];

    const eintraege = schichtarten.map((s) => ({
      firma_id: firma,
      unit_id: unitData.id,
      kuerzel: s.kuerzel,
      beschreibung: s.beschreibung,
      startzeit: s.start,
      endzeit: s.ende,
      dauer: s.dauer,
      farbe_bg: s.bg,
      farbe_text: s.text,
      sollplan_relevant: s.relevant,
      ignoriert_arbeitszeit: s.ignoriert,
      position: s.pos,
    }));

    const { error: schichtError } = await supabase.from('DB_SchichtArt').insert(eintraege);
    if (schichtError) {
      console.error('Fehler beim Einfügen der Schichtarten:', schichtError.message);
    } else {
      console.log('Unit und Schichtarten erfolgreich erstellt!');
      handleReset();

      if (onCreated && unitData) {
        onCreated(unitData);
      }
    }
  };

  const updateSchichtName = (index, value) => {
    setSchichtNamen(prev => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 text-black dark:text-white p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-bold mb-4">Unit erstellen</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm">Unit-Name</label>
          <input
            type="text"
            value={unitName}
            onChange={e => setUnitName(e.target.value)}
            className="w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          />
        </div>

        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm">Standort</label>
            <input
              type="text"
              value={standort}
              onChange={e => setStandort(e.target.value)}
              className="w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {/* ✅ NEU: Land + Bundesland */}
        <div className="flex space-x-4">
          <div className="flex-1">
            <label className="block text-sm">Land</label>
            <select
              value={land}
              onChange={(e) => {
                const v = e.target.value;
                setLand(v);
                if (v !== 'DE') setBundesland(''); // bei AT/CH nicht erzwingen
              }}
              className="w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="DE">DE</option>
              <option value="AT">AT</option>
              <option value="CH">CH</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm">
              Bundesland {land !== 'DE' ? '(optional)' : ''}
            </label>
            <select
              value={bundesland}
              onChange={e => setBundesland(e.target.value)}
              disabled={land !== 'DE'}
              className={`w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 ${
                land !== 'DE' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="">{land !== 'DE' ? '—' : 'Bundesland wählen'}</option>
              {["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"].map((bl) => (
                <option key={bl} value={bl}>{bl}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex space-x-4">
          <div>
            <label className="block text-sm">Anzahl MA</label>
            <input
              type="number"
              min="1"
              value={anzahlMA}
              onChange={e => setAnzahlMA(parseInt(e.target.value, 10))}
              className="w-24 mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm">Anzahl Schichten</label>
            <input
              type="number"
              min="1"
              max="6"
              value={anzahlSchichten}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                setAnzahlSchichten(val);
                setSchichtNamen(Array(val).fill(''));
              }}
              className="w-24 mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        </div>

        {[...Array(anzahlSchichten)].map((_, i) => (
          <div key={i}>
            <label className="block text-sm">Schicht {i + 1} Name</label>
            <input
              type="text"
              value={schichtNamen[i] || ''}
              onChange={e => updateSchichtName(i, e.target.value)}
              className="w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
        ))}

        <div className="flex space-x-4 pt-2">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            Erstellen
          </button>
          <button
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Zurücksetzen
          </button>
        </div>
      </div>
    </div>
  );
};

export default KundenUnitErstellen;
