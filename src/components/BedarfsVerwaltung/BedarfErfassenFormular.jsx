// BedarfErfassenFormular.jsx
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import { Info } from 'lucide-react';

const BedarfErfassenFormular = ({ ausgewaehlteQualiId, ausgewaehlteQualiName, onRefresh, vorbelegt }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  // 🔧 FIX: heute nach oben gezogen, damit es im useEffect verfügbar ist
  const heute = dayjs().format('YYYY-MM-DD');

  // --- Gemeinsame States ---
  const [feedback, setFeedback] = useState('');
  const [infoOffen, setInfoOffen] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- Normalbetrieb / Zeitlich begrenzt Umschalter ---
  const [normalbetrieb, setNormalbetrieb] = useState(false);

  // --- NEU: Betriebsmodus für Normalbetrieb ---
  // '24_7' oder 'wochenbetrieb'
  const [betriebsmodus, setBetriebsmodus] = useState('24_7');      // NEU
  const [wochenTage, setWochenTage] = useState('MO_FR');           // NEU

  // --- Farbe & Name (nur zeitlich begrenzt genutzt) ---
  const [farbe, setFarbe] = useState(vorbelegt?.farbe || '#3b82f6');
  const [namebedarf, setNamebedarf] = useState(vorbelegt?.namebedarf || '');

  // --- Zeitraum (nur zeitlich begrenzt) ---
  const [von, setVon] = useState(vorbelegt?.von || '');
  const [bis, setBis] = useState(vorbelegt?.bis || '');
  const minBis = von ? dayjs(von).format('YYYY-MM-DD') : heute;

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

  // --- Vorlage für zeitlich begrenzten Bedarf ---
  const [alsVorlageSpeichern, setAlsVorlageSpeichern] = useState(false);
  const [vorlageName, setVorlageName] = useState('');

  // Zeitlich begrenzt als Default sinnvoll vorbelegen
  useEffect(() => {
    if (!vorbelegt) {
      setNormalbetrieb(false);
      setVon(heute);
      setBis(dayjs(heute).add(1, 'day').format('YYYY-MM-DD'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!vorbelegt) return;

    setNormalbetrieb(false);
    setFarbe(vorbelegt.farbe || '#3b82f6');
    setNamebedarf(vorbelegt.namebedarf || '');
    setStartSchicht(vorbelegt.start_schicht || 'Früh');
    setEndSchicht(vorbelegt.end_schicht || 'Nacht');

    // Eine Vorlage übernimmt den fachlichen Bauplan, aber nie alte Datumswerte.
    if (vorbelegt._quelle === 'vorlage') {
      setVon(heute);
      setBis(dayjs(heute).add(1, 'day').format('YYYY-MM-DD'));
      setZbModus(vorbelegt.modus === 'je' ? 'je' : 'alle');
      setZbAlle(Number(vorbelegt.anzahl_alle || 1));
      setZbFrueh(Number(vorbelegt.anzahl_frueh || 0));
      setZbSpaet(Number(vorbelegt.anzahl_spaet || 0));
      setZbNacht(Number(vorbelegt.anzahl_nacht || 0));
      setAlsVorlageSpeichern(false);
      setVorlageName('');
      setFeedback(`Vorlage „${vorbelegt.vorlage_name || vorbelegt.namebedarf || ''}“ geladen.`);
      return;
    }

    // Vorbelegung aus einem bestehenden zeitlichen Bedarf.
    setVon(vorbelegt.von || heute);
    setBis(vorbelegt.bis || vorbelegt.von || heute);
    setAlsVorlageSpeichern(false);
    setVorlageName('');
  }, [vorbelegt, heute]);

const handleChangeVon = (value) => {
  setVon(value);
  const next = dayjs(value).format('YYYY-MM-DD'); // gleiches Datum möglich
  setBis((prev) => (!prev || dayjs(prev).isBefore(next) ? next : prev));
};

  const validate = () => {
    if (!ausgewaehlteQualiId) return 'Bitte zuerst eine Qualifikation links auswählen.';

    if (normalbetrieb) {
      // Optional: hier könnten wir später prüfen, ob wochenTage gesetzt ist
      if (nbModus === 'alle') {
        if (!anzahlAlle || anzahlAlle < 1) return 'Bitte eine Anzahl ≥ 1 eingeben.';
      } else {
        if (
          (anzahlFrueh || 0) <= 0 &&
          (anzahlSpaet || 0) <= 0 &&
          (anzahlNacht || 0) <= 0
        ) {
          return 'Bitte mindestens eine Schicht mit Anzahl > 0 angeben.';
        }
      }
    } else {
if (!von || !bis) return 'Bitte Zeitraum (Von/Bis) angeben.';
if (dayjs(bis).isBefore(dayjs(von), 'day')) {
  return '„Bis“ darf nicht vor „Von“ liegen.';
}
      if (!namebedarf?.trim()) return 'Bitte eine Bezeichnung für den Zeitraum eingeben.';
      if (alsVorlageSpeichern && !vorlageName.trim()) {
        return 'Bitte einen Namen für die Vorlage eingeben.';
      }
      if (zbModus === 'alle') {
        if (!zbAlle || zbAlle < 1) return 'Bitte eine Anzahl ≥ 1 eingeben.';
      } else {
        if (
          (zbFrueh || 0) <= 0 &&
          (zbSpaet || 0) <= 0 &&
          (zbNacht || 0) <= 0
        ) {
          return 'Bitte mindestens eine Schicht mit Anzahl > 0 angeben.';
        }
      }
    }
    return '';
  };

  const handleSpeichern = async () => {
    if (saving) return;

    setFeedback('');
    const err = validate();
    if (err) {
      setFeedback(err);
      return;
    }

    setSaving(true);

    const baseCommon = {
      quali_id: ausgewaehlteQualiId,
      firma_id: firma,
      unit_id: unit,
      created_by: userId,
    };

    let rows = [];

    if (normalbetrieb) {
      // --- NORMALBETRIEB ---

      // NEU: vorbereiten, was wir in die DB schreiben
      const nbCommon = {
        ...baseCommon,
        normalbetrieb: true,
        betriebsmodus,                                        // NEU
        wochen_tage: betriebsmodus === 'wochenbetrieb' ? wochenTage : null, // NEU
        von: null,
        bis: null,
        namebedarf: null,
        farbe: null,
      };

      if (nbModus === 'alle') {
        rows.push({
          ...nbCommon,
          anzahl: Number(anzahlAlle),
          schichtart: null,
        });
      } else {
        if ((anzahlFrueh || 0) > 0)
          rows.push({ ...nbCommon, anzahl: Number(anzahlFrueh), schichtart: 'Früh' });
        if ((anzahlSpaet || 0) > 0)
          rows.push({ ...nbCommon, anzahl: Number(anzahlSpaet), schichtart: 'Spät' });
        if ((anzahlNacht || 0) > 0)
          rows.push({ ...nbCommon, anzahl: Number(anzahlNacht), schichtart: 'Nacht' });
      }
    } else {
      // --- ZEITLICH BEGRENZT ---
      const zbCommon = {
        ...baseCommon,
        normalbetrieb: false,
        betriebsmodus: null,   // NEU: zeitlich begrenzt hat keinen Modus
        wochen_tage: null,     // NEU
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
        if ((zbFrueh || 0) > 0)
          rows.push({ ...zbCommon, anzahl: Number(zbFrueh), schichtart: 'Früh' });
        if ((zbSpaet || 0) > 0)
          rows.push({ ...zbCommon, anzahl: Number(zbSpaet), schichtart: 'Spät' });
        if ((zbNacht || 0) > 0)
          rows.push({ ...zbCommon, anzahl: Number(zbNacht), schichtart: 'Nacht' });
      }
    }

    const { error } = await supabase.from('DB_Bedarf').insert(rows);
    if (error) {
      console.error('Fehler beim Speichern:', error.message);
      setFeedback('Fehler beim Speichern.');
      setSaving(false);
      return;
    }

    let vorlageFehler = null;

    if (!normalbetrieb && alsVorlageSpeichern) {
      const vorlagePayload = {
        created_by: userId,
        firma_id: firma,
        unit_id: unit,
        vorlage_name: vorlageName.trim(),
        namebedarf: namebedarf.trim(),
        farbe,
        quali_id: ausgewaehlteQualiId,
        modus: zbModus,
        anzahl_alle: zbModus === 'alle' ? Number(zbAlle) : null,
        anzahl_frueh: zbModus === 'je' ? Number(zbFrueh || 0) : null,
        anzahl_spaet: zbModus === 'je' ? Number(zbSpaet || 0) : null,
        anzahl_nacht: zbModus === 'je' ? Number(zbNacht || 0) : null,
        start_schicht: startSchicht,
        end_schicht: endSchicht,
        aktiv: true,
      };

      const { error: templateError } = await supabase
        .from('DB_BedarfVorlage')
        .insert(vorlagePayload);

      if (templateError) {
        console.error('Fehler beim Speichern der Bedarfsvorlage:', templateError.message);
        vorlageFehler = templateError;
      }
    }

    setFeedback(
      vorlageFehler
        ? 'Bedarf gespeichert, aber die Vorlage konnte nicht gespeichert werden.'
        : alsVorlageSpeichern && !normalbetrieb
          ? 'Bedarf und Vorlage erfolgreich gespeichert!'
          : 'Bedarf erfolgreich gespeichert!'
    );
    if (normalbetrieb) {
      setNbModus('alle');
      setAnzahlAlle(1);
      setAnzahlFrueh(0); setAnzahlSpaet(0); setAnzahlNacht(0);
    } else {
      setZbModus('alle');
      setZbAlle(1);
      setZbFrueh(0); setZbSpaet(0); setZbNacht(0);
      setAlsVorlageSpeichern(false);
      setVorlageName('');
    }

    setSaving(false);
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
          {/* NEU: Betriebsmodus (24/7 vs. Wochenbetrieb) */}
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Modus Normalbetrieb</label>
            <div className="flex gap-2 mb-2">
              <button
                className={`px-3 py-1 rounded ${betriebsmodus === '24_7' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setBetriebsmodus('24_7')}
              >
                24/7-Betrieb
              </button>
              <button
                className={`px-3 py-1 rounded ${betriebsmodus === 'wochenbetrieb' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setBetriebsmodus('wochenbetrieb')}
              >
                Wochenbetrieb
              </button>
            </div>

{betriebsmodus === 'wochenbetrieb' && (
  <div className="mt-1">
    <label className="block text-sm font-medium mb-1 ">Wochenmuster</label>
    <select
      className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
      value={wochenTage}
      onChange={(e) => setWochenTage(e.target.value)}
    >
      <option value="MO_FR">Mo–Fr (Früh/Spät/Nacht)</option>
      <option value="MO_SA_ALL">Mo–Sa (Früh/Spät/Nacht)</option>
      <option value="MO_FR_SA_F">
        Mo–Fr (Früh/Spät/Nacht) + Sa nur Früh
      </option>
      <option value="MO_FR_SA_FS">
        Mo–Fr (Früh/Spät/Nacht) + Sa Früh &amp; Spät
      </option>
      <option value="SO_FR_ALL">So Nacht – Fr Spät</option>
    </select>
    <p className="text-xs text-gray-500 mt-1">
      Dieses Muster steuert später, an welchen Wochentagen der Normalbedarf im MitarbeiterBedarf berücksichtigt wird.
    </p>
  </div>
)}

          </div>

          <div className="mb-3">
            <div className="flex gap-2">
              <button
                className={`px-3 py-1 rounded ${nbModus === 'alle' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setNbModus('alle')}
              >
                Alle Schichten gleich
              </button>
              <button
                className={`px-3 py-1 rounded ${nbModus === 'je' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
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
                className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
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
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
                  value={anzahlFrueh}
                  min={0}
                  onChange={(e) => setAnzahlFrueh(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spät</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
                  value={anzahlSpaet}
                  min={0}
                  onChange={(e) => setAnzahlSpaet(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nacht</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
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
              className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
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
                className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
                value={von}
                min={heute}
                onChange={(e) => handleChangeVon(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">„Bis“ wird automatisch ≥ „Von“ gesetzt.</p>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Bis</label>
              <input
                type="date"
                className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
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
                className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
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
                className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800"
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
                className={`px-3 py-1 rounded ${zbModus === 'alle' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
                onClick={() => setZbModus('alle')}
              >
                Alle Schichten gleich
              </button>
              <button
                className={`px-3 py-1 rounded ${zbModus === 'je' ? 'bg-blue-600 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}
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
                className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
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
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
                  value={zbFrueh}
                  min={0}
                  onChange={(e) => setZbFrueh(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Spät</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
                  value={zbSpaet}
                  min={0}
                  onChange={(e) => setZbSpaet(parseInt(e.target.value || '0', 10))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nacht</label>
                <input
                  type="number"
                  className="w-full text-xl px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-700 hover:bg-gray-300/20 dark:hover:bg-gray-700/20"
                  value={zbNacht}
                  min={0}
                  onChange={(e) => setZbNacht(parseInt(e.target.value || '0', 10))}
                />
              </div>
            </div>
          )}

          {/* Optional zusätzlich als Vorlage speichern */}
          <div className="mt-4 p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100/70 dark:bg-gray-800/70">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={alsVorlageSpeichern}
                onChange={(e) => {
                  setAlsVorlageSpeichern(e.target.checked);
                  if (!e.target.checked) setVorlageName('');
                }}
              />
              <span className="text-sm font-medium">
                Zusätzlich als Vorlage speichern
              </span>
            </label>

            {alsVorlageSpeichern && (
              <div className="mt-3">
                <label className="block text-sm font-medium mb-1">
                  Vorlagenname
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-900"
                  value={vorlageName}
                  onChange={(e) => setVorlageName(e.target.value)}
                  placeholder="z. B. Revision Vollbetrieb"
                  maxLength={80}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Datum und Zeitraum werden nicht in der Vorlage gespeichert.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Feedback + Button */}
      <div className="mt-6 flex justify-between items-center">
        <span
          className={`text-sm ${
            feedback?.startsWith('Fehler') || feedback?.includes('Bitte')
              ? 'text-red-600 dark:text-red-400'
              : 'text-green-600 dark:text-green-400'
          }`}
        >
          {feedback}
        </span>
        <button
          type="button"
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleSpeichern}
          disabled={saving}
        >
          {saving ? 'Speichert…' : 'Speichern'}
        </button>
      </div>

      {/* Info-Modal */}
      {infoOffen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center backdrop-blur-sm justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-gray-200 dark:bg-gray-800 p-6 rounded-xl shadow animate-fade-in max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Hinweise zum Bedarfformular</h3>
            <ul className="list-disc pl-5 text-sm space-y-2">
              <li>Wähle links eine Qualifikation aus.</li>
              <li>
                <b>Normalbetrieb</b>: dauerhaft – entweder alle Schichten gleich (1 Datensatz) oder je Schicht (bis zu 3 Datensätze).
              </li>
              <li>
                Im Normalbetrieb kannst du zwischen <b>24/7-Betrieb</b> und
                <b> Wochenbetrieb (z. B. Mo–Fr)</b> wählen. Dieses Muster wird später in der Bedarfsanalyse verwendet.
              </li>
              <li>
                <b>Zeitlich begrenzt</b>: Zeitraum + Start-/End-Schicht; Bezeichnung &amp; Farbe dienen der Orientierung.
              </li>
              <li>Zeitlich begrenzt <b>überschreibt</b> Normalbetrieb im Zeitraum für betroffene Schichten.</li>
              <li>Optional kannst du die fachlichen Einstellungen zusätzlich als Vorlage speichern. Datumswerte werden dabei bewusst nicht übernommen.</li>
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
