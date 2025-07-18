import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';


const KundenUnit = () => {
  const { sichtFirma } = useRollen();
  const [unitName, setUnitName] = useState('');
  const [standort, setStandort] = useState('');
  const [anzahlMA, setAnzahlMA] = useState(1);
  const [anzahlSchichten, setAnzahlSchichten] = useState(2);
  const [schichtNamen, setSchichtNamen] = useState([]);

  const handleReset = () => {
    setUnitName('');
    setStandort('');
    setAnzahlMA(1);
    setAnzahlSchichten(2);
    setSchichtNamen([]);
  };

const handleSave = async () => {
  if (!sichtFirma) {
    console.error('Keine Firma ausgewählt');
    return;
  }

  // 1. Unit speichern
  const { data: unitData, error: unitError } = await supabase.from('DB_Unit').insert([
    {
      firma: sichtFirma,
      unitname: unitName,
      unit_standort: standort,
      anzahl_ma: anzahlMA,
      anzahl_schichten: anzahlSchichten,
      schichtname1: schichtNamen[0] || null,
      schichtname2: schichtNamen[1] || null,
      schichtname3: schichtNamen[2] || null,
      schichtname4: schichtNamen[3] || null,
      schichtname5: schichtNamen[4] || null,
      schichtname6: schichtNamen[5] || null,
    }
  ]).select().single();

  if (unitError) {
    console.error('Fehler beim Speichern der Unit:', unitError.message);
    return;
  }

  // 2. Schichtarten direkt einfügen
  const schichtarten = [
    { kuerzel: 'F', beschreibung: 'Frühschicht', start: '06:00', ende: '13:00', dauer: 7, bg: '#4aca1c', text: '#000000', relevant: true, ignoriert: false, pos: 1 },
    { kuerzel: 'S', beschreibung: 'Spätschicht', start: '13:00', ende: '21:00', dauer: 8, bg: '#ffa200', text: '#000000', relevant: false, ignoriert: false, pos: 2 },
    { kuerzel: 'N', beschreibung: 'Nachtschicht', start: '21:00', ende: '06:00', dauer: 9, bg: '#0040ff', text: '#ffffff', relevant: true, ignoriert: false, pos: 3 },
    { kuerzel: 'U', beschreibung: 'Urlaub', start: '00:00', ende: '00:00', dauer: 0, bg: '#fafb0d', text: '#000000', relevant: false, ignoriert: true, pos: 5 },
    { kuerzel: '-', beschreibung: 'Frei', start: '00:00', ende: '00:00', dauer: 0, bg: '#ffffff', text: '#000000', relevant: true, ignoriert: false, pos: 4 },
    { kuerzel: 'KO', beschreibung: 'Krank ohne Attest', start: '00:00', ende: '00:00', dauer: 0, bg: '#ffffff', text: '#000000', relevant: false, ignoriert: true, pos: 6 },
    { kuerzel: 'KAU', beschreibung: 'Krank mit Attest', start: '00:00', ende: '00:00', dauer: 0, bg: '#ffffff', text: '#000000', relevant: false, ignoriert: true, pos: 7 }
  ];

  const eintraege = schichtarten.map(s => ({
    firma_id: sichtFirma,
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
    position: s.pos
  }));

  const { error: schichtError } = await supabase.from('DB_SchichtArt').insert(eintraege);

  if (schichtError) {
    console.error('Fehler beim Einfügen der Schichtarten:', schichtError.message);
  } else {
    console.log('Unit und Schichtarten erfolgreich erstellt!');
    handleReset();
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

        <div>
          <label className="block text-sm">Standort</label>
          <input
            type="text"
            value={standort}
            onChange={e => setStandort(e.target.value)}
            className="w-full mt-1 p-2 rounded border dark:bg-gray-700 dark:border-gray-600"
          />
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

export default KundenUnit;