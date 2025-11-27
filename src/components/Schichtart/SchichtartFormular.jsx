import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info, X } from 'lucide-react';

const systemKuerzelSet = new Set(['F', 'S', 'N', '-', 'U', 'KO', 'KAU']);

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

  // 🔁 NEU: Pausen-States
  const [pauseAktiv, setPauseAktiv] = useState(false);
  const [pauseDauer, setPauseDauer] = useState(30); // Minuten

  const [firma, setFirma] = useState('');
  const [unit, setUnit] = useState('');
  const { istSuperAdmin, sichtFirma, sichtUnit } = useRollen();
  const [bearbeiteId, setBearbeiteId] = useState(null);
  const [infoOffen, setInfoOffen] = useState(false);
  const [firmenListe, setFirmenListe] = useState([]);
  const [unitListe, setUnitListe] = useState([]);
  const [originalKuerzel, setOriginalKuerzel] = useState('');

  const isEditing = !!bearbeiteId;
  const isSystemOriginal =
    isEditing && systemKuerzelSet.has(originalKuerzel?.toUpperCase?.() || '');

  // Firma/Unit für Nicht-SuperAdmin automatisch setzen
  useEffect(() => {
    if (!istSuperAdmin) {
      setFirma(sichtFirma || '');
      setUnit(sichtUnit || '');
    }
  }, [istSuperAdmin, sichtFirma, sichtUnit]);

  // 🔁 Dauer berechnen (inkl. Pause)
  useEffect(() => {
    if (ignoriertArbeitszeit) {
      setDauer(0);
      return;
    }

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;

    // Über Mitternacht
    if (endTotal < startTotal) endTotal += 1440;

    let arbeitsMinuten = endTotal - startTotal;

    if (pauseAktiv && pauseDauer > 0) {
      arbeitsMinuten = Math.max(arbeitsMinuten - pauseDauer, 0);
    }

    setDauer(arbeitsMinuten / 60);
  }, [start, end, ignoriertArbeitszeit, pauseAktiv, pauseDauer]);

  // Formular mit Datensatz füllen
  useEffect(() => {
    if (schichtart) {
      setBearbeiteId(schichtart.id || null);
      setKuerzel((schichtart.kuerzel || '').toUpperCase());
      setOriginalKuerzel((schichtart.kuerzel || '').toUpperCase());
      setBeschreibung(schichtart.beschreibung || '');
      setStart(schichtart.startzeit || '06:00');
      setEnd(schichtart.endzeit || '14:00');
      setDauer(schichtart.dauer || 8);
      setSchriftfarbe(schichtart.farbe_text || '#000000');
      setHintergrundfarbe(schichtart.farbe_bg || '#ffffff');
      setIgnoriertArbeitszeit(Boolean(schichtart.ignoriert_arbeitszeit));
      setSollRelevant(Boolean(schichtart.sollplan_relevant));
      setFirma(schichtart.firma_id || sichtFirma || '');
      setUnit(schichtart.unit_id || sichtUnit || '');

      // 🔁 NEU: Pause aus DB holen
      setPauseAktiv(Boolean(schichtart.pause_aktiv));
      setPauseDauer(
        schichtart.pause_dauer !== null && schichtart.pause_dauer !== undefined
          ? Number(schichtart.pause_dauer)
          : 30
      );
    } else {
      setBearbeiteId(null);
      setOriginalKuerzel('');
      setKuerzel('');
      setBeschreibung('');
      setStart('06:00');
      setEnd('14:00');
      setDauer(8);
      setSchriftfarbe('#000000');
      setHintergrundfarbe('#ffffff');
      setIgnoriertArbeitszeit(false);
      setSollRelevant(false);
      setPauseAktiv(false);
      setPauseDauer(30);

      if (!istSuperAdmin) {
        setFirma(sichtFirma || '');
        setUnit(sichtUnit || '');
      } else {
        setFirma('');
        setUnit('');
      }
    }
  }, [schichtart, sichtFirma, sichtUnit, istSuperAdmin]);

  // Stammdaten für SuperAdmin
  useEffect(() => {
    if (!istSuperAdmin) return;

    (async () => {
      const { data: firmen } = await supabase
        .from('DB_Kunden')
        .select('id, firmenname')
        .order('firmenname', { ascending: true });
      if (firmen) setFirmenListe(firmen);

      const { data: units } = await supabase
        .from('DB_Unit')
        .select('id, unitname, firma')
        .order('unitname', { ascending: true });
      if (units) setUnitListe(units);
    })();
  }, [istSuperAdmin]);

  // Kürzel-Eingabe: max 3 Zeichen, Uppercase
  const handleKuerzelChange = (e) => {
    const val = (e.target.value || '').toUpperCase().slice(0, 3);
    setKuerzel(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firma || !unit) {
      alert('Firma und Unit müssen gesetzt sein!');
      return;
    }

    // Beim ANLEGEN sind System-Kürzel reserviert
    if (!isEditing && systemKuerzelSet.has((kuerzel || '').toUpperCase())) {
      alert(
        'Das eingegebene Kürzel ist systemreserviert (F, S, N, -, U, KO, KAU) und kann nicht angelegt werden.'
      );
      return;
    }

    const daten = {
      kuerzel: (kuerzel || '').toUpperCase(),
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
      // 🔁 NEU: Pausen-Felder
      pause_aktiv: pauseAktiv,
      pause_dauer: pauseAktiv ? pauseDauer : 0,
    };

    let error;
    if (isEditing) {
      const res = await supabase
        .from('DB_SchichtArt')
        .update(daten)
        .eq('id', bearbeiteId);
      error = res.error;
    } else {
      const res = await supabase.from('DB_SchichtArt').insert(daten);
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
    <div
      className={`p-6 rounded-xl shadow-xl w-full max-w-sm ${
        darkMode
          ? 'bg-gray-800 text-white border border-gray-700'
          : 'bg-gray-200 text-gray-900 border border-gray-300'
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xl font-semibold">
          {isEditing ? 'Schichtart ändern' : 'Schichtart einpflegen'}
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
          onChange={handleKuerzelChange}
          maxLength={3}
          disabled={isSystemOriginal}
          className={`text-center px-3 py-2 rounded placeholder-gray-400 focus:outline-none ${
            darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
          } ${isSystemOriginal ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        <div className="flex justify-center items-center gap-10">
          <div className="flex flex-col items-center">
            <input
              type="color"
              value={schriftfarbe}
              onChange={(e) => setSchriftfarbe(e.target.value)}
            />
            <span className="text-sm mt-1">Schriftfarbe</span>
          </div>
          <div className="flex flex-col items-center">
            <input
              type="color"
              value={hintergrundfarbe}
              onChange={(e) => setHintergrundfarbe(e.target.value)}
            />
            <span className="text-sm mt-1">Hintergrund</span>
          </div>
        </div>

        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={ignoriertArbeitszeit}
            onChange={(e) => {
              const checked = e.target.checked;
              setIgnoriertArbeitszeit(checked);
              if (checked) {
                setStart('00:00');
                setEnd('00:00');
                setPauseAktiv(false);
                setPauseDauer(30);
              }
            }}
          />
          Diese Eintragung überschreibt die Arbeitszeit nicht (z. B. Urlaub, Krank)
        </label>

        {/* 🔁 Nur wenn Arbeitszeit relevant ist, Pausen & Zeiten anzeigen */}
        {!ignoriertArbeitszeit && (
          <>
          {/* 🔁 NEU: Pause Checkbox + Auswahl */}
            <label className="flex gap-2 items-center mt-1">
              <input
                type="checkbox"
                checked={pauseAktiv}
                onChange={(e) => setPauseAktiv(e.target.checked)}
              />
              Schicht enthält Pause
            </label>
            
            <label className="text-sm">Beginn Arbeitszeit</label>
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={`rounded px-20 py-2 focus:outline-none ${
                darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
              }`}
            />

            

            {pauseAktiv && (
              <div className="flex flex-col gap-1">
                <span className="text-sm">Pausendauer</span>
                <select
                  value={pauseDauer}
                  onChange={(e) => setPauseDauer(Number(e.target.value))}
                  className={`rounded px-3 py-2 focus:outline-none ${
                    darkMode
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-300 text-gray-800'
                  }`}
                >
                  <option value={15}>15 Minuten</option>
                  <option value={30}>30 Minuten</option>
                  <option value={45}>45 Minuten</option>
                  <option value={60}>60 Minuten</option>
                </select>
                <span className="text-xs opacity-70">
                  Die Pausenzeit wird von der Schichtdauer abgezogen.
                </span>
              </div>
            )}

            <label className="text-sm mt-2">Ende Arbeitszeit</label>
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={`rounded px-20 py-2 focus:outline-none ${
                darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
              }`}
            />

            {end < start && (
              <div className="text-yellow-400 text-sm font-semibold">
                Endet am nächsten Tag
              </div>
            )}

            <div
              className={`text-right text-sm ${
                darkMode ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Dauer: <strong>{dauer} h</strong>
            </div>
          </>
        )}

        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={sollRelevant}
            onChange={(e) => setSollRelevant(e.target.checked)}
            disabled={isSystemOriginal}
          />
          Soll-Plan relevant?
        </label>

        <input
          type="text"
          placeholder="Bezeichnung (max. 30 Zeichen)"
          maxLength={30}
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          disabled={isSystemOriginal}
          className={`px-3 py-2 rounded placeholder-gray-400 focus:outline-none ${
            darkMode ? 'bg-gray-700 text-white' : 'bg-gray-300 text-gray-800'
          } ${isSystemOriginal ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        {istSuperAdmin && (
          <>
            <select
              value={firma}
              onChange={(e) => {
                setFirma(e.target.value);
                setUnit('');
              }}
              disabled={isSystemOriginal}
              className={`px-3 py-2 rounded focus:outline-none ${
                darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
              } ${isSystemOriginal ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Firma wählen</option>
              {firmenListe.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.firmenname}
                </option>
              ))}
            </select>

            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={isSystemOriginal}
              className={`px-3 py-2 rounded focus:outline-none ${
                darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-800'
              } ${isSystemOriginal ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="">Unit wählen</option>
              {unitListe
                .filter((u) => u.firma === Number(firma))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitname}
                  </option>
                ))}
            </select>
          </>
        )}

        {isSystemOriginal && (
          <div
            className={`text-sm px-2 py-1 rounded text-yellow-900 ${
              darkMode
                ? 'bg-yellow-900 bg-opacity-20'
                : 'bg-yellow-100'
            }`}
          >
            ⚠️ <strong>Hinweis:</strong> Dieses Kürzel ist systemrelevant – nur{' '}
            <strong>Farbe</strong>, <strong>Arbeitszeit</strong> und{' '}
            <strong>Pausen</strong> dürfen geändert werden.
          </div>
        )}

        <div className="flex justify-between mt-1">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-medium"
          >
            {isEditing ? 'Ändern' : 'Speichern'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center backdrop-blur-sm z-50">
          <div className="bg-white dark:bg-gray-900 text-black dark:text-white p-6 rounded-xl shadow-xl w-[90%] max-w-lg animate-fade-in relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
              onClick={() => setInfoOffen(false)}
            >
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4">
              Informationen zur Schichtart
            </h2>
            <ul className="list-disc list-inside text-sm space-y-2">
              <li>
                <strong>Kürzel:</strong> Max. 3 Zeichen, farbig im Plan
                dargestellt.
              </li>
              <li>
                <strong>Farben:</strong> Schrift- und Hintergrundfarbe für
                visuelle Trennung.
              </li>
              <li>
                <strong>Beginn &amp; Ende:</strong> Arbeitszeit der Schicht.
              </li>
              <li>
                <strong>Pausen:</strong> Optional 15–60 Minuten; wird von der
                Schichtdauer abgezogen.
              </li>
              <li>
                <strong>Dauer:</strong> Wird automatisch berechnet, auch über
                Nacht.
              </li>
              <li>
                <strong>Überschreibt Arbeitszeit nicht:</strong> z. B. Urlaub
                oder Krank.
              </li>
              <li>
                <strong>Soll-Plan relevant:</strong> Notwendig für das
                Schichtsystem.
                <br />
                <span className="text-xs text-gray-500">
                  Typisch: F = Früh, S = Spät, N = Nacht, - = Frei
                </span>
              </li>
              <li>
                <strong>Firma &amp; Unit:</strong> Für SuperAdmin wählbar, sonst
                automatisch gesetzt.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchichtartFormular;
