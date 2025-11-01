import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const BedarfErfassenFormular = ({ ausgewaehlteQualiId, ausgewaehlteQualiName, onRefresh, vorbelegt }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

 // Zeitlich begrenzt als Default sinnvoll vorbelegen
 useEffect(() => {
   if (!vorbelegt) {
     setNormalbetrieb(false);
     setVon(heute);
     setBis(dayjs(heute).add(1, 'day').format('YYYY-MM-DD'));
   }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

  // --- Gemeinsame States ---
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);

  // --- Normalbetrieb / Zeitlich begrenzt Umschalter ---
  const [normalbetrieb, setNormalbetrieb] = useState(false);

  // --- Farbe & Name (nur zeitlich begrenzt genutzt) ---
  const [farbe, setFarbe] = useState(vorbelegt?.farbe || '#3b82f6');
  const [namebedarf, setNamebedarf] = useState(vorbelegt?.namebedarf || '');

  // --- Zeitraum (nur zeitlich begrenzt) ---
  const heute = dayjs().format('YYYY-MM-DD');
  const [von, setVon] = useState(vorbelegt?.von || '');
  const [bis, setBis] = useState(vorbelegt?.bis || '');
  const minBis = von ? dayjs(von).add(1, 'day').format('YYYY-MM-DD') : heute;

  // --- Schicht-Grenzen (nur zeitlich begrenzt) ---
  const [startSchicht, setStartSchicht] = useState('Früh');
  const [endSchicht, setEndSchicht] = useState('Nacht');

  // --- Normalbetrieb: Modus "alle" vs "je" ---
  const [nbModus, setNbModus] = useState('alle'); // 'alle' | 'je'
  const [anzahlAlle, setAnzahlAlle] = useState(1);
  const [anzahlFrueh, setAnzahlFrueh] = useState(0);
  const [anzahlSpaet, setAnzahlSpaet] = useState(0);
  const [anzahlNacht, setAnzahlNacht] = useState(0);

  // --- Zeitlich begrenzt: Modus "alle" vs "je" ---
  const [zbModus, setZbModus] = useState('alle'); // 'alle' | 'je'
  const [zbAlle, setZbAlle] = useState(1);
  const [zbFrueh, setZbFrueh] = useState(0);
  const [zbSpaet, setZbSpaet] = useState(0);
  const [zbNacht, setZbNacht] = useState(0);

  useEffect(() => {
    if (vorbelegt) {
      setNormalbetrieb(false);
      setVon(vorbelegt.von || '');
      setBis(vorbelegt.bis || '');
      setFarbe(vorbelegt.farbe || '#3b82f6');
      setNamebedarf(vorbelegt.namebedarf || '');
    }
  }, [vorbelegt]);

  const handleChangeVon = (value) => {
    setVon(value);
    const next = dayjs(value).add(1, 'day').format('YYYY-MM-DD');
    setBis((prev) => (!prev || dayjs(prev).isBefore(next) ? next : prev));
  };

  const order = (s) => (s === 'Früh' ? 1 : s === 'Spät' ? 2 : 3);

  const validate = () => {
    if (!ausgewaehlteQualiId) return 'Bitte zuerst eine Qualifikation links auswählen.';
    if (normalbetrieb) {
      if (nbModus === 'alle') {
        if (!anzahlAlle || anzahlAlle < 1) return 'Bitte eine Anzahl ≥ 1 eingeben.';
      } else {
        if ((anzahlFrueh || 0) <= 0 && (anzahlSpaet || 0) <= 0 && (anzahlNacht || 0) <= 0) {
          return 'Bitte mindestens eine Schicht mit Anzahl > 0 angeben.';
        }
      }
    } else {
      if (!von || !bis) return 'Bitte Zeitraum (Von/Bis) angeben.';
      if (dayjs(bis).isBefore(dayjs(von).add(1, 'day'))) {
        return '„Bis“ muss mindestens einen Tag nach „Von“ liegen.';
      }
      if (!namebedarf?.trim()) return 'Bitte eine Bezeichnung für den Zeitraum eingeben.';
      if (zbModus === 'alle') {
        if (!zbAlle || zbAlle < 1) return 'Bitte eine Anzahl ≥ 1 eingeben.';
      } else {
        if ((zbFrueh || 0) <= 0 && (zbSpaet || 0) <= 0 && (zbNacht || 0) <= 0) {
          return 'Bitte mindestens eine Schicht mit Anzahl > 0 angeben.';
        }
      }
    }
    return '';
  };

  const handleSpeichern = async () => {
    setFeedback('');
    const err = validate();
    if (err) { setFeedback(err); return; }

    const baseCommon = {
      quali_id: ausgewaehlteQualiId,
      firma_id: firma,
      unit_id: unit,
      created_by: userId,
    };

    let rows = [];

    if (normalbetrieb) {
      // --- NORMALBETRIEB ---
      if (nbModus === 'alle') {
        rows.push({
          ...baseCommon,
          normalbetrieb: true,
          anzahl: Number(anzahlAlle),
          schichtart: null,
          von: null,
          bis: null,
          namebedarf: null,
          farbe: null,
        });
      } else {
        if ((anzahlFrueh || 0) > 0) rows.push({ ...baseCommon, normalbetrieb: true, anzahl: Number(anzahlFrueh), schichtart: 'Früh',  von: null, bis: null, namebedarf: null, farbe: null });
        if ((anzahlSpaet || 0) > 0) rows.push({ ...baseCommon, normalbetrieb: true, anzahl: Number(anzahlSpaet), schichtart: 'Spät',  von: null, bis: null, namebedarf: null, farbe: null });
        if ((anzahlNacht || 0) > 0) rows.push({ ...baseCommon, normalbetrieb: true, anzahl: Number(anzahlNacht), schichtart: 'Nacht', von: null, bis: null, namebedarf: null, farbe: null });
      }
    } else {
      // --- ZEITLICH BEGRENZT ---
      const zbCommon = {
        ...baseCommon,
        normalbetrieb: false,
        von,
        bis,
        namebedarf: namebedarf.trim(),
        farbe,
        start_schicht: startSchicht,
        end_schicht: endSchicht,
      };

      if (zbModus === 'alle') {
        rows.push({ ...zbCommon, anzahl: Number(zbAlle), schichtart: null });
      } else {
        if ((zbFrueh || 0) > 0) rows.push({ ...zbCommon, anzahl: Number(zbFrueh), schichtart: 'Früh' });
        if ((zbSpaet || 0) > 0) rows.push({ ...zbCommon, anzahl: Number(zbSpaet), schichtart: 'Spät' });
        if ((zbNacht || 0) > 0) rows.push({ ...zbCommon, anzahl: Number(zbNacht), schichtart: 'Nacht' });
      }
    }

    const { error } = await supabase.from('DB_Bedarf').insert(rows);
    if (error) {
      console.error('Fehler beim Speichern:', error.message);
      setFeedback('Fehler beim Speichern.');
      return;
    }

    setFeedback('Bedarf erfolgreich gespeichert!');
    if (normalbetrieb) {
      setNbModus('alle');
      setAnzahlAlle(1);
      setAnzahlFrueh(0); setAnzahlSpaet(0); setAnzahlNacht(0);
    } else {
      setZbModus('alle');
      setZbAlle(1);
      setZbFrueh(0); setZbSpaet(0); setZbNacht(0);
    }

    setTimeout(() => onRefresh?.(), 50);
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
      <div className="flex gap-2 mb-4">
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

      {/* Qualifikation */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Qualifikation</label>
        <div className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 text-xl">
          {ausgewaehlteQualiName || 'Keine Qualifikation ausgewählt'}
        </div>
      </div>

      {/* NORMALBETRIEB */}
      {normalbetrieb && (
        <>
          <div className="mb-3">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded ${nbModus === 'alle' ? 'bg-indigo-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setNbModus('alle')}
              >
                Alle Schichten gleich
              </button>
              <button
                className={`px-3 py-1 rounded ${nbModus === 'je' ? 'bg-indigo-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setNbModus('je')}
              >
                Je Schicht
              </button>
            </div>
          </div>

          {nbModus === 'alle' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Anzahl (ganztägig)</label>
              <input
                type="number"
                className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                value={anzahlAlle}
                min={1}
                onChange={(e) => setAnzahlAlle(parseInt(e.target.value || '1', 10))}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Früh</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={anzahlFrueh}
                  min={0}
                  onChange={(e) => setAnzahlFrueh(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spät</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={anzahlSpaet}
                  min={0}
                  onChange={(e) => setAnzahlSpaet(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nacht</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={anzahlNacht}
                  min={0}
                  onChange={(e) => setAnzahlNacht(parseInt(e.target.value || '0', 10))}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* ZEITLICH BEGRENZT */}
      {!normalbetrieb && (
        <>
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

          {/* Bezeichnung */}
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Bezeichnung Bedarf</label>
            <input
              type="text"
              className="w-full px-3 py-1 rounded border dark:bg-gray-800"
              value={namebedarf}
              onChange={(e) => setNamebedarf(e.target.value)}
            />
          </div>

          {/* Zeitraum */}
          <div className="flex gap-4 mb-3">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Von</label>
              <input
                type="date"
                className="w-full px-3 py-1 rounded border dark:bg-gray-800"
                value={von}
                min={heute}
                onChange={(e) => handleChangeVon(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">„Bis“ wird automatisch ≥ „Von+1“ gesetzt.</p>
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

          {/* Start-/End-Schicht */}
          <div className="grid grid-cols-2 gap-3 mb-3">
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

          {/* Moduswahl Schichten */}
          <div className="mb-3">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded ${zbModus === 'alle' ? 'bg-indigo-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setZbModus('alle')}
              >
                Alle Schichten gleich
              </button>
              <button
                className={`px-3 py-1 rounded ${zbModus === 'je' ? 'bg-indigo-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setZbModus('je')}
              >
                Je Schicht
              </button>
            </div>
          </div>

          {zbModus === 'alle' ? (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Anzahl (im Zeitraum; alle Schichten)</label>
              <input
                type="number"
                className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                value={zbAlle}
                min={1}
                onChange={(e) => setZbAlle(parseInt(e.target.value || '1', 10))}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Früh</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={zbFrueh}
                  min={0}
                  onChange={(e) => setZbFrueh(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spät</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={zbSpaet}
                  min={0}
                  onChange={(e) => setZbSpaet(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nacht</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded"
                  value={zbNacht}
                  min={0}
                  onChange={(e) => setZbNacht(parseInt(e.target.value || '0', 10))}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Feedback + Button */}
      <div className="mt-6 flex justify-between items-center">
        <span className={`text-sm ${feedback?.startsWith('Fehler') || feedback?.includes('Bitte') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
          {feedback}
        </span>
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
              <li>Wähle links eine Qualifikation aus.</li>
              <li><b>Normalbetrieb</b>: dauerhaft – entweder alle Schichten gleich (1 Datensatz) oder je Schicht (bis zu 3 Datensätze).</li>
              <li><b>Zeitlich begrenzt</b>: Zeitraum + Start-/End-Schicht; Bezeichnung & Farbe dienen der Orientierung.</li>
              <li>Zeitlich begrenzt <b>überschreibt</b> Normalbetrieb im Zeitraum für betroffene Schichten.</li>
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
