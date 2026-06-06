import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Info } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';

const WOCHENTAGE = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

const ZusatzbedarfFormular = ({ vorlage, onSaved }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const heute = dayjs().format('YYYY-MM-DD');

  const [schichtarten, setSchichtarten] = useState([]);
  const [qualifikationen, setQualifikationen] = useState([]);

  const [name, setName] = useState('');
  const [schichtartId, setSchichtartId] = useState('');
  const [qualiId, setQualiId] = useState('');
  const [bedarfAnzahl, setBedarfAnzahl] = useState(1);
  const [dtstart, setDtstart] = useState(heute);
  const [until, setUntil] = useState(heute);

  const [beschreibung, setBeschreibung] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [farbe, setFarbe] = useState('#3b82f6');

  const [freq, setFreq] = useState('none'); // none | daily | weekly | monthly
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState('');

  const [alsVorlageSpeichern, setAlsVorlageSpeichern] = useState(false);
  const [vorlageName, setVorlageName] = useState('');

  const [infoOffen, setInfoOffen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  // -----------------------------
  // Daten laden
  // -----------------------------
  useEffect(() => {
    const ladeSchichtarten = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('id, kuerzel, beschreibung, sollplan_relevant')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('sollplan_relevant', false)
        .not('kuerzel', 'in', '(K,KO,U)')
        .order('position', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Zusatzbedarf-Schichtarten:', error.message);
        setSchichtarten([]);
        return;
      }

      setSchichtarten(data || []);
    };

    ladeSchichtarten();
  }, [firma, unit]);

  useEffect(() => {
    const ladeQualifikationen = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_Qualifikationsmatrix')
        .select('id, qualifikation, quali_kuerzel, position, aktiv')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('aktiv', true)
        .order('position', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Qualifikationen:', error.message);
        setQualifikationen([]);
        return;
      }

      setQualifikationen(data || []);
    };

    ladeQualifikationen();
  }, [firma, unit]);

  // -----------------------------
  // Vorlage ins Formular laden
  // -----------------------------
  useEffect(() => {
    if (!vorlage) return;

    setName(vorlage.name || '');
    setSchichtartId(vorlage.schichtart_id ? String(vorlage.schichtart_id) : '');
    setQualiId(vorlage.quali_id ? String(vorlage.quali_id) : '');
    setBedarfAnzahl(Number(vorlage.bedarf_delta || 1));
    setDtstart(vorlage.dtstart || heute);
    setUntil(vorlage.until || vorlage.dtstart || heute);
    setBeschreibung(vorlage.beschreibung || '');
    setHinweis(vorlage.hinweis || '');
    setFarbe(vorlage.farbe || '#3b82f6');
    setFreq(vorlage.freq || 'none');
    setInterval(Number(vorlage.interval || 1));

    if (Array.isArray(vorlage.byweekday) && vorlage.byweekday.length > 0) {
      setByweekday(String(vorlage.byweekday[0]));
    } else {
      setByweekday('');
    }
  }, [vorlage, heute]);

  const ausgewaehlteSchichtart = useMemo(() => {
    return schichtarten.find((s) => String(s.id) === String(schichtartId));
  }, [schichtarten, schichtartId]);

  const ausgewaehlteQuali = useMemo(() => {
    return qualifikationen.find((q) => String(q.id) === String(qualiId));
  }, [qualifikationen, qualiId]);

  const rhythmusText = useMemo(() => {
    if (freq === 'none') {
      if (dtstart === until) return 'Einmaliger Zusatzbedarf an einem Tag.';
      return 'Zusatzbedarf für mehrere Tage am Stück.';
    }

    if (freq === 'daily') {
      return `Wiederholung alle ${interval || 1} Tag(e).`;
    }

    if (freq === 'weekly') {
      const tag = WOCHENTAGE.find((w) => String(w.value) === String(byweekday));
      return `Wiederholung alle ${interval || 1} Woche(n)${
        tag ? ` am ${tag.label}` : ''
      }.`;
    }

    if (freq === 'monthly') {
      return `Wiederholung alle ${interval || 1} Monat(e) am Tag ${dayjs(dtstart).date()}.`;
    }

    return '';
  }, [freq, interval, byweekday, dtstart, until]);

  const resetForm = () => {
    setName('');
    setSchichtartId('');
    setQualiId('');
    setBedarfAnzahl(1);
    setDtstart(heute);
    setUntil(heute);
    setBeschreibung('');
    setHinweis('');
    setFarbe('#3b82f6');
    setFreq('none');
    setInterval(1);
    setByweekday('');
    setAlsVorlageSpeichern(false);
    setVorlageName('');
  };

  const validate = () => {
    if (!firma || !unit) return 'Firma oder Unit fehlt.';
    if (!name.trim()) return 'Bitte eine Beschreibung eingeben.';
    if (!schichtartId) return 'Bitte ein Kürzel / eine Schichtart auswählen.';
    if (!bedarfAnzahl || Number(bedarfAnzahl) < 1) return 'Bitte mindestens 1 Person angeben.';
    if (!dtstart) return 'Bitte ein Startdatum angeben.';
    if (!until) return 'Bitte ein Enddatum angeben.';
    if (dayjs(until).isBefore(dayjs(dtstart), 'day')) {
      return 'Das Enddatum darf nicht vor dem Startdatum liegen.';
    }
    if (freq === 'weekly' && byweekday === '') {
      return 'Bitte einen Wochentag für die wöchentliche Wiederholung auswählen.';
    }
    if (interval < 1) return 'Der Rhythmus-Abstand muss mindestens 1 sein.';
    if (alsVorlageSpeichern && !vorlageName.trim()) {
      return 'Bitte einen Namen für die Vorlage eingeben.';
    }

    return '';
  };

  const handleSpeichern = async () => {
    setFeedback('');

    const err = validate();
    if (err) {
      setFeedback(err);
      return;
    }

    setSaving(true);

    const payload = {
      firma_id: firma,
      unit_id: unit,
      created_by: userId || null,

      name: name.trim(),
      schichtart_id: Number(schichtartId),

      quali_id: qualiId ? Number(qualiId) : null,
      bedarf_delta: Number(bedarfAnzahl || 1),

      dtstart,
      until,

        freq: freq === 'none' ? 'once' : freq,
        interval: Number(interval || 1),
        byweekday:
        freq === 'weekly' && byweekday !== ''
            ? [Number(byweekday)]
            : null,

      beschreibung: beschreibung.trim() || null,
      hinweis: hinweis.trim() || null,
      farbe,
      aktiv: true,

      ist_vorlage: !!alsVorlageSpeichern,
      vorlage_name: alsVorlageSpeichern ? vorlageName.trim() : null,
      anfrage_erlaubt: true,
    };

    const rowsToInsert = [
    {
        ...payload,
        ist_vorlage: false,
        vorlage_name: null,
    },
    ];

    if (alsVorlageSpeichern) {
    rowsToInsert.push({
        ...payload,
        ist_vorlage: true,
        vorlage_name: vorlageName.trim(),
        aktiv: true,
    });
    }

    const { error } = await supabase.from('DB_Sonderbedarf').insert(rowsToInsert);

    setSaving(false);

    if (error) {
    console.error('Fehler beim Speichern des Zusatzbedarfs:', error.message);
    setFeedback(`Fehler beim Speichern: ${error.message}`);
    return;
    }

    setFeedback('Zusatzbedarf wurde gespeichert.');
    resetForm();
    setTimeout(() => onSaved?.(), 100);
  };

  return (
    <div className="relative p-4 border border-gray-300 dark:border-gray-700 shadow-xl rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Zusatzbedarf erfassen
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setInfoOffen(true)}
          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white"
          title="Informationen zum Zusatzbedarf"
        >
          <Info size={20} />
        </button>
      </div>

      <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-500 dark:bg-yellow-900/20 p-3 text-xs text-yellow-900 dark:text-yellow-100 mb-4">
        Zusatzbedarf zählt aktuell nur eingetragene Personen. Eine Prüfung von Arbeitszeit,
        Ruhezeit oder konkreten Uhrzeiten findet hier nicht statt.
      </div>

      {vorlage && (
        <div className="mb-4 rounded-xl bg-blue-500 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 p-3 text-sm text-blue-900 dark:text-blue-100">
          Vorlage geladen: <span className="font-semibold">{vorlage.vorlage_name || vorlage.name}</span>
        </div>
      )}

      <div className="space-y-3 text-sm">
        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Bezeichnung
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Brandwache, Einweisung, Reinigung, Spülarbeiten, TÜV-Vorbereitungen"
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Kürzel / Schichtart 
          </label>
          <select
            value={schichtartId}
            onChange={(e) => setSchichtartId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          >
            <option value="">Bitte auswählen</option>
            {schichtarten.map((s) => (
              <option key={s.id} value={s.id}>
                {s.kuerzel} {s.beschreibung ? `– ${s.beschreibung}` : ''}
              </option>
            ))}
          </select>

          {schichtarten.length === 0 && (
            <div className="text-xs text-red-600 dark:text-red-300 mt-1">
              Keine passenden Schichtarten gefunden. Lege zuerst eine nicht sollplanrelevante
              Schichtart an.
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Benötigte Qualifikation optional
          </label>
          <select
            value={qualiId}
            onChange={(e) => setQualiId(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          >
            <option value="">Keine Qualifikation nötig</option>
            {qualifikationen.map((q) => (
              <option key={q.id} value={q.id}>
                {q.quali_kuerzel ? `${q.quali_kuerzel} – ` : ''}
                {q.qualifikation}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Anzahl Personen
          </label>
          <input
            type="number"
            min="1"
            value={bedarfAnzahl}
            onChange={(e) => setBedarfAnzahl(Number(e.target.value))}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Von
            </label>
            <input
              type="date"
              value={dtstart}
              onChange={(e) => {
                setDtstart(e.target.value);
                if (dayjs(until).isBefore(dayjs(e.target.value), 'day')) {
                  setUntil(e.target.value);
                }
              }}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Bis
            </label>
            <input
              type="date"
              value={until}
              min={dtstart}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 bg-gray-500 dark:bg-gray-800/60">
          <label className="block text-xs font-medium mb-2 text-gray-600 dark:text-gray-300">
            Wiederholung
          </label>

          <select
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 mb-2"
          >
            <option value="none">Keine Wiederholung</option>
            <option value="daily">Alle X Tage</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich am Starttag</option>
          </select>

          {freq !== 'none' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                  Abstand
                </label>
                <input
                  type="number"
                  min="1"
                  value={interval}
                  onChange={(e) => setInterval(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
                />
              </div>

              {freq === 'weekly' && (
                <div>
                  <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                    Wochentag
                  </label>
                  <select
                    value={byweekday}
                    onChange={(e) => setByweekday(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
                  >
                    <option value="">Bitte wählen</option>
                    {WOCHENTAGE.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
            {rhythmusText}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Beschreibung optional
          </label>
          <textarea
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={2}
            placeholder="Wofür ist der Zusatzbedarf?"
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Hinweis optional
          </label>
          <textarea
            value={hinweis}
            onChange={(e) => setHinweis(e.target.value)}
            rows={2}
            placeholder="z. B. Treffpunkt, Kleidung, Besonderheiten"
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Farbe
          </label>
          <input
            type="color"
            value={farbe}
            onChange={(e) => setFarbe(e.target.value)}
            className="w-full h-10 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={alsVorlageSpeichern}
            onChange={(e) => setAlsVorlageSpeichern(e.target.checked)}
            className="accent-blue-600"
          />
          Als Vorlage speichern
        </label>

        {alsVorlageSpeichern && (
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Vorlagenname
            </label>
            <input
              type="text"
              value={vorlageName}
              onChange={(e) => setVorlageName(e.target.value)}
              placeholder="z. B. Monatliche Sicherheitsbegehung"
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          </div>
        )}

        {ausgewaehlteSchichtart && (
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-3 text-xs">
            <div className="font-semibold mb-1">Vorschau</div>
            <div>
              {ausgewaehlteSchichtart.kuerzel} · {bedarfAnzahl} Person(en)
              {ausgewaehlteQuali ? ` · Qualifikation: ${ausgewaehlteQuali.qualifikation}` : ''}
            </div>
            <div className="text-gray-500 dark:text-gray-400 mt-1">{rhythmusText}</div>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              feedback.includes('Fehler') || feedback.includes('Bitte') || feedback.includes('darf nicht')
                ? 'bg-red-500 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700'
                : 'bg-green-500 dark:bg-green-900/20 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
            }`}
          >
            {feedback}
          </div>
        )}

        <button
          type="button"
          onClick={handleSpeichern}
          disabled={saving}
          className={`w-full mt-2 px-4 py-2 rounded text-white ${
            saving
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Speichern…' : 'Zusatzbedarf speichern'}
        </button>
      </div>

      {infoOffen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">Hinweise zum Zusatzbedarf</h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Zusatzbedarf ist für Aufgaben gedacht, die zusätzlich zum normalen Sollplan
                geplant werden.
              </p>
              <p>
                Es können nur Schichtarten gewählt werden, die nicht sollplanrelevant sind.
                K und KO werden ausgeschlossen.
              </p>
              <p>
                Eine Qualifikation kann hinterlegt werden, muss aber nicht.
              </p>
              <p>
                Die Arbeitszeit wird hier aktuell nicht geprüft. Gezählt wird später, ob
                Personen mit dem passenden Kürzel in der Kampfliste eingetragen sind.
              </p>
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Verstanden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZusatzbedarfFormular;