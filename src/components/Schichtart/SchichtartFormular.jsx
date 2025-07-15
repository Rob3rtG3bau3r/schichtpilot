import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, X } from 'lucide-react';

const SchichtartFormular = ({ schichtart, onReset, darkMode }) => {
  const [kuerzel, setKuerzel] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [start, setStart] = useState('06:00');
  const [end, setEnd] = useState('14:00');
  const [dauer, setDauer] = useState(8);
  const [schriftfarbe, setSchriftfarbe] = useState('#000000');
  const [hintergrundfarbe, setHintergrundfarbe] = useState('#ffffff');
  const [ignoriertArbeitszeit, setIgnoriertArbeitszeit] = useState(false);
  const [sollRelevant, setSollRelevant] = useState(false);
  const [firma, setFirma] = useState('');
  const [unit, setUnit] = useState('');
  const { istSuperAdmin, sichtFirma, sichtUnit } = useRollen();
  const [bearbeiteId, setBearbeiteId] = useState(null);
  const [infoOffen, setInfoOffen] = useState(false);
  const [firmenListe, setFirmenListe] = useState([]);
  const [unitListe, setUnitListe] = useState([]);
  const systemKuerzel = ['F', 'S', 'N', '-', 'U', 'KO', 'KAU'];
  const istSystemKuerzel = systemKuerzel.includes(kuerzel);

  useEffect(() => {
    if (!istSuperAdmin) {
      setFirma(sichtFirma || '');
      setUnit(sichtUnit || '');
    }
  }, [istSuperAdmin, sichtFirma, sichtUnit]);

  useEffect(() => {
    if (ignoriertArbeitszeit) {
      setDauer(0);
      return;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    if (endTotal < startTotal) {
      endTotal += 1440;
    }

    const diff = (endTotal - startTotal) / 60;
    setDauer(diff);
  }, [start, end, ignoriertArbeitszeit]);

  useEffect(() => {
    if (schichtart) {
      setBearbeiteId(schichtart.id || null);
      setKuerzel(schichtart.kuerzel || '');
      setBeschreibung(schichtart.beschreibung || '');
      setStart(schichtart.startzeit || '06:00');
      setEnd(schichtart.endzeit || '14:00');
      setDauer(schichtart.dauer || 8);
      setSchriftfarbe(schichtart.farbe_text || '#000000');
      setHintergrundfarbe(schichtart.farbe_bg || '#ffffff');
      setIgnoriertArbeitszeit(schichtart.ignoriert_arbeitszeit || false);
      setSollRelevant(schichtart.sollplan_relevant || false);
      setFirma(schichtart.firma || sichtFirma || '');
      setUnit(schichtart.unit || sichtUnit || '');
    } else {
      setBearbeiteId(null);
    }
  }, [schichtart]);

  useEffect(() => {
  if (!istSuperAdmin) {
    setFirma(sichtFirma || '');
    setUnit(sichtUnit || '');
  }
}, [istSuperAdmin, sichtFirma, sichtUnit]);

useEffect(() => {
  const ladeFirmen = async () => {
    const { data, error } = await supabase
      .from('DB_Kunden')
      .select('id, firmenname')
      .order('firmenname', { ascending: true });
    if (!error) setFirmenListe(data);
  };

  const ladeUnits = async () => {
    const { data, error } = await supabase
      .from('DB_Unit')
      .select('id, unitname, firma')
      .order('unitname', { ascending: true });
    if (!error) setUnitListe(data);
  };

  if (istSuperAdmin) {
    ladeFirmen();
    ladeUnits();
  }
}, [istSuperAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firma || !unit) {
      alert('Firma und Unit müssen gesetzt sein!');
      return;
    }

    const daten = {
      kuerzel,
      beschreibung,
      startzeit: start,
      endzeit: end,
      dauer,
      farbe_text: schriftfarbe,
      farbe_bg: hintergrundfarbe,
      ignoriert_arbeitszeit: ignoriertArbeitszeit,
      sollplan_relevant: sollRelevant,
      firma_id: firma,
      unit_id: unit,
    };

    let error;
    if (bearbeiteId) {
      const res = await supabase
        .from('DB_SchichtArt')
        .update(daten)
        .eq('id', bearbeiteId);

      error = res.error;
    } else {
      const res = await supabase
        .from('DB_SchichtArt')
        .insert(daten);

      error = res.error;
    }

    if (error) {
      alert('Fehler beim Speichern: ' + error.message);
    } else {
      alert('Gespeichert!');
      setBearbeiteId(null);
      onReset();
    }
  };

  return (
    <div className={`p-6 rounded-xl shadow-xl w-full max-w-sm ${
      darkMode
        ? 'bg-gray-800 text-white border border-gray-700'
        : 'bg-gray-200 text-gray-900 border border-gray-300'
    }`}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xl font-semibold">
          {bearbeiteId ? 'Schichtart ändern' : 'Schichtart einpflegen'}
        </h2>
        <button
          onClick={() => setInfoOffen(true)}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-white"
          title="Infos zum Formular"
        >
          <Info size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
<input
  type="text"
  placeholder="Kürzel (max. 3 Zeichen)"
  value={kuerzel}
  onChange={(e) => setKuerzel(e.target.value)}
  disabled={istSystemKuerzel}
  className={`text-center px-3 py-2 rounded placeholder-gray-400 focus:outline-none ${
    darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
  } ${istSystemKuerzel ? 'opacity-60 cursor-not-allowed' : ''}`}
/>

        <div className="flex justify-center items-center gap-10">
          <div className="flex flex-col items-center">
            <input type="color" value={schriftfarbe} onChange={(e) => setSchriftfarbe(e.target.value)} />
            <span className="text-sm mt-1">Schriftfarbe</span>
          </div>
          <div className="flex flex-col items-center">
            <input type="color" value={hintergrundfarbe} onChange={(e) => setHintergrundfarbe(e.target.value)} />
            <span className="text-sm mt-1">Hintergrund</span>
          </div>
        </div>

<label className="flex gap-2 items-center">
  <input
    type="checkbox"
    checked={ignoriertArbeitszeit}
    onChange={(e) => {
      setIgnoriertArbeitszeit(e.target.checked);
      if (e.target.checked) {
        setStart('00:00');
        setEnd('00:00');
      }
    }}
    disabled={istSystemKuerzel}
  />
  Diese Eintragung überschreibt die Arbeitszeit nicht (z. B. Urlaub, Krank)
</label>


        {!ignoriertArbeitszeit && (
          <>
            <label className="text-sm">Beginn Arbeitszeit</label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`rounded px-20 py-2 focus:outline-none ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'}`}
            />

            <label className="text-sm">Ende Arbeitszeit</label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={`rounded px-20 py-2 focus:outline-none ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'}`}
            />

            {end < start && (
              <div className="text-yellow-400 text-sm font-semibold">
                Endet am nächsten Tag
              </div>
            )}

            <div className={`text-right text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Dauer: <strong>{dauer} h</strong>
            </div>
          </>
        )}

<label className="flex gap-2 items-center">
  <input
    type="checkbox"
    checked={sollRelevant}
    onChange={(e) => setSollRelevant(e.target.checked)}
    disabled={istSystemKuerzel}
  />
  Soll-Plan relevant?
</label>

<input
  type="text"
  placeholder="Bezeichnung (max. 30 Zeichen)"
  maxLength={30}
  value={beschreibung}
  onChange={(e) => setBeschreibung(e.target.value)}
  disabled={istSystemKuerzel}
  className={`px-3 py-2 rounded placeholder-gray-400 focus:outline-none ${
    darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
  } ${istSystemKuerzel ? 'opacity-60 cursor-not-allowed' : ''}`}
/>
        {istSuperAdmin && (
          <>
<select
  value={firma}
  onChange={(e) => {
    setFirma(e.target.value);
    setUnit('');
  }}
  disabled={istSystemKuerzel}
  className={`px-3 py-2 rounded focus:outline-none ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'} ${istSystemKuerzel ? 'opacity-60 cursor-not-allowed' : ''}`}
>
  <option value="">Firma wählen</option>
  {firmenListe.map((f) => (
    <option key={f.id} value={f.id}>{f.firmenname}</option>
  ))}
</select>

<select
  value={unit}
  onChange={(e) => setUnit(e.target.value)}
  disabled={istSystemKuerzel}
  className={`px-3 py-2 rounded focus:outline-none ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'} ${istSystemKuerzel ? 'opacity-60 cursor-not-allowed' : ''}`}
>
  <option value="">Unit wählen</option>
  {unitListe
    .filter((u) => u.firma === Number(firma))
    .map((u) => (
      <option key={u.id} value={u.id}>{u.unitname}</option>
    ))}
</select>
          </>
        )}
{istSystemKuerzel && (
  <div className={`text-sm px-2 py-1 rounded text-yellow-900 ${
    darkMode ? 'bg-yellow-900 bg-opacity-20' : 'bg-yellow-100'
  }`}>
    ⚠️ <strong>Hinweis:</strong> Dieses Kürzel ist systemrelevant – nur <strong>Farbe</strong> und <strong>Arbeitszeit</strong> dürfen geändert werden.
  </div>
)}

        <div className="flex justify-between mt-1">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
          >
            {bearbeiteId ? 'Ändern' : 'Speichern'}
          </button>
          <button
            type="button"
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-medium"
            onClick={() => {
              setBearbeiteId(null);
              onReset();
            }}
          >
            Abbrechen
          </button>
        </div>
      </form>

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm  z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-xl w-[90%] max-w-lg animate-fade-in relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              onClick={() => setInfoOffen(false)}
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4">Informationen zur Schichtart</h2>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li><strong>Kürzel:</strong> Max. 3 Zeichen, farbig im Plan dargestellt.</li>
              <li><strong>Farben:</strong> Schrift- und Hintergrundfarbe für visuelle Trennung.</li>
              <li><strong>Beginn & Ende:</strong> Arbeitszeit der Schicht.</li>
              <li><strong>Dauer:</strong> Wird automatisch berechnet, auch über Nacht.</li>
              <li><strong>Überschreibt Arbeitszeit nicht:</strong> z. B. Urlaub oder Krank.</li>
              <li><strong>Soll-Plan relevant:</strong> Notwendig für das Schichtsystem.<br />
                <span className="text-xs text-gray-500">Typisch: F = Früh, S = Spät, N = Nacht, - = Frei</span>
              </li>
              <li><strong>Firma & Unit:</strong> Für SuperAdmin wählbar, sonst automatisch gesetzt.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtartFormular;