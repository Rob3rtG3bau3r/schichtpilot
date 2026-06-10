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

const MAX_EINZELTERMINE = 104;

const ZusatzbedarfFormular = ({ vorlage, onSaved }) => {
  const { sichtFirma: firma, sichtUnit: unit, userId } = useRollen();

  const heute = dayjs().format('YYYY-MM-DD');

  const [schichtarten, setSchichtarten] = useState([]);
  const [qualifikationen, setQualifikationen] = useState([]);

  const [name, setName] = useState('');
  const [schichtartId, setSchichtartId] = useState('');
  const [qualiId, setQualiId] = useState('');
  const [bedarfAnzahl, setBedarfAnzahl] = useState(1);

  // Von/Bis = Dauer eines einzelnen Zusatzbedarfs
  const [dtstart, setDtstart] = useState(heute);
  const [until, setUntil] = useState(heute);

  // Serie/Wiederholung
  const [serieBis, setSerieBis] = useState(heute);
  const [freq, setFreq] = useState('none'); // none | daily | weekly | monthly
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState('');

  const [beschreibung, setBeschreibung] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [farbe, setFarbe] = useState('#3b82f6');

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

    // Vorlage ist nur Bauplan, Datum/Wiederholung werden bewusst neu gesetzt
    setDtstart(heute);
    setUntil(heute);
    setSerieBis(heute);
    setFreq('none');
    setInterval(1);
    setByweekday('');

    setBeschreibung(vorlage.beschreibung || '');
    setHinweis(vorlage.hinweis || '');
    setFarbe(vorlage.farbe || '#3b82f6');
  }, [vorlage, heute]);

  const ausgewaehlteSchichtart = useMemo(() => {
    return schichtarten.find((s) => String(s.id) === String(schichtartId));
  }, [schichtarten, schichtartId]);

  const ausgewaehlteQuali = useMemo(() => {
    return qualifikationen.find((q) => String(q.id) === String(qualiId));
  }, [qualifikationen, qualiId]);

  const dauerTage = useMemo(() => {
    if (!dtstart || !until) return 0;

    const start = dayjs(dtstart).startOf('day');
    const ende = dayjs(until).startOf('day');

    if (!start.isValid() || !ende.isValid()) return 0;
    if (ende.isBefore(start, 'day')) return 0;

    return ende.diff(start, 'day') + 1;
  }, [dtstart, until]);

  const ermittleStarttermine = () => {
    const start = dayjs(dtstart).startOf('day');

    if (!start.isValid()) return [];

    // Keine Wiederholung:
    // Genau ein echter Zusatzbedarf, Dauer kommt aus Von/Bis.
    if (freq === 'none') {
      return [start.format('YYYY-MM-DD')];
    }

    const serienEnde = dayjs(serieBis).startOf('day');

    if (!serienEnde.isValid()) return [];
    if (serienEnde.isBefore(start, 'day')) return [];

    const termine = [];
    let d = start;

    while (d.isSame(serienEnde, 'day') || d.isBefore(serienEnde, 'day')) {
      let gilt = false;

      if (freq === 'daily') {
        const diffDays = d.diff(start, 'day');

        gilt =
          diffDays >= 0 &&
          diffDays % Number(interval || 1) === 0;
      }

      if (freq === 'weekly') {
        const diffWeeks = d.startOf('week').diff(start.startOf('week'), 'week');
        const zielWochentag = Number(byweekday);
        const aktuellerWochentag = d.day(); // Sonntag = 0

        gilt =
          diffWeeks >= 0 &&
          diffWeeks % Number(interval || 1) === 0 &&
          aktuellerWochentag === zielWochentag;
      }

      if (freq === 'monthly') {
        const diffMonths = d.diff(start, 'month');

        gilt =
          diffMonths >= 0 &&
          diffMonths % Number(interval || 1) === 0 &&
          d.date() === start.date();
      }

      if (gilt) {
        termine.push(d.format('YYYY-MM-DD'));
      }

      if (termine.length > MAX_EINZELTERMINE) {
        break;
      }

      d = d.add(1, 'day');
    }

    return [...new Set(termine)];
  };

  const anzahlStarttermine = useMemo(() => {
    return ermittleStarttermine().length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dtstart, until, serieBis, freq, interval, byweekday]);

  const rhythmusText = useMemo(() => {
    if (freq === 'none') {
      if (dauerTage === 1) return 'Einmaliger Zusatzbedarf an einem Tag.';
      return `Einmaliger Zusatzbedarf über ${dauerTage} Tage.`;
    }

    if (freq === 'daily') {
      return `Wiederholung alle ${interval || 1} Tag(e) bis ${dayjs(serieBis).format('DD.MM.YYYY')}.`;
    }

    if (freq === 'weekly') {
      const tag = WOCHENTAGE.find((w) => String(w.value) === String(byweekday));

      return `Wiederholung alle ${interval || 1} Woche(n)${
        tag ? ` am ${tag.label}` : ''
      } bis ${dayjs(serieBis).format('DD.MM.YYYY')}.`;
    }

    if (freq === 'monthly') {
      return `Wiederholung alle ${interval || 1} Monat(e) am Tag ${dayjs(dtstart).date()} bis ${dayjs(serieBis).format('DD.MM.YYYY')}.`;
    }

    return '';
  }, [freq, interval, byweekday, dtstart, serieBis, dauerTage]);

  const resetForm = () => {
    setName('');
    setSchichtartId('');
    setQualiId('');
    setBedarfAnzahl(1);
    setDtstart(heute);
    setUntil(heute);
    setSerieBis(heute);
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

    if (Number(interval || 0) < 1) {
      return 'Der Rhythmus-Abstand muss mindestens 1 sein.';
    }

    if (dauerTage < 1) {
      return 'Die Dauer des Zusatzbedarfs konnte nicht berechnet werden.';
    }

    if (freq === 'weekly' && byweekday === '') {
      return 'Bitte einen Wochentag für die wöchentliche Wiederholung auswählen.';
    }

    if (freq !== 'none') {
      if (!serieBis) {
        return 'Bitte ein Datum für „Wiederholen bis“ angeben.';
      }

      if (dayjs(serieBis).isBefore(dayjs(dtstart), 'day')) {
        return '„Wiederholen bis“ darf nicht vor dem Von-Datum liegen.';
      }
    }

    const termine = ermittleStarttermine();

    if (!termine.length) {
      return 'Für diese Auswahl wurden keine Termine gefunden.';
    }

    if (termine.length > MAX_EINZELTERMINE) {
      return `Bitte den Zeitraum begrenzen. Maximal ${MAX_EINZELTERMINE} Einzeltermine pro Speichervorgang.`;
    }

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

    const starttermine = ermittleStarttermine();

    setSaving(true);

    try {
      const basisPayload = {
        firma_id: firma,
        unit_id: unit,
        created_by: userId || null,

        name: name.trim(),
        schichtart_id: Number(schichtartId),

        quali_id: qualiId ? Number(qualiId) : null,
        bedarf_delta: Number(bedarfAnzahl || 1),

        beschreibung: beschreibung.trim() || null,
        hinweis: hinweis.trim() || null,
        farbe,

        aktiv: true,
        anfrage_erlaubt: true,
      };

      const rowsToInsert = starttermine.map((startDatum) => {
        const endDatum = dayjs(startDatum)
          .add(Math.max(dauerTage - 1, 0), 'day')
          .format('YYYY-MM-DD');

        return {
          ...basisPayload,

          // Jeder gespeicherte Datensatz ist ein echter Zusatzbedarf.
          // Von/Bis bleibt als Dauer erhalten.
          dtstart: startDatum,
          until: endDatum,

          // Serienlogik wird nicht virtuell gespeichert.
          // Die Serie wurde bereits in echte Einzeltermine aufgelöst.
          freq: 'once',
          interval: 1,
          byweekday: null,
        };
      });

      const { error: sonderErr } = await supabase
        .from('DB_Sonderbedarf')
        .insert(rowsToInsert);

      if (sonderErr) throw sonderErr;

      if (alsVorlageSpeichern) {
        const vorlagePayload = {
          firma_id: firma,
          unit_id: unit,
          created_by: userId || null,

          vorlage_name: vorlageName.trim(),
          name: name.trim(),

          schichtart_id: Number(schichtartId),
          quali_id: qualiId ? Number(qualiId) : null,

          bedarf_delta: Number(bedarfAnzahl || 1),

          beschreibung: beschreibung.trim() || null,
          hinweis: hinweis.trim() || null,

          farbe,
          anfrage_erlaubt: true,
          aktiv: true,
          position: null,
        };

        const { error: vorlageErr } = await supabase
          .from('DB_SonderbedarfVorlage')
          .insert(vorlagePayload);

        if (vorlageErr) throw vorlageErr;
      }

      setFeedback(
        alsVorlageSpeichern
          ? `${starttermine.length} Zusatzbedarf-Eintrag${starttermine.length === 1 ? '' : 'e'} und Vorlage wurden gespeichert.`
          : `${starttermine.length} Zusatzbedarf-Eintrag${starttermine.length === 1 ? '' : 'e'} wurde${starttermine.length === 1 ? '' : 'n'} gespeichert.`
      );

      resetForm();
      setTimeout(() => onSaved?.(), 100);
    } catch (error) {
      console.error('Fehler beim Speichern des Zusatzbedarfs:', error.message);
      setFeedback(`Fehler beim Speichern: ${error.message}`);
    } finally {
      setSaving(false);
    }
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
          Vorlage geladen:{' '}
          <span className="font-semibold">
            {vorlage.vorlage_name || vorlage.name}
          </span>
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Von
            </label>
            <input
              type="date"
              value={dtstart}
              onChange={(e) => {
                const neuesDatum = e.target.value;

                setDtstart(neuesDatum);

                if (dayjs(until).isBefore(dayjs(neuesDatum), 'day')) {
                  setUntil(neuesDatum);
                }

                if (dayjs(serieBis).isBefore(dayjs(neuesDatum), 'day')) {
                  setSerieBis(neuesDatum);
                }

                if (freq === 'weekly') {
                  setByweekday(String(dayjs(neuesDatum).day()));
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
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-200">
          Dauer:{' '}
          <span className="font-semibold">
            {dauerTage > 0 ? `${dauerTage} Tag${dauerTage === 1 ? '' : 'e'}` : '—'}
          </span>
          </div>
          </div>

        <div className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 bg-gray-500 dark:bg-gray-800/60">
          <label className="block text-xs font-medium mb-2 text-gray-600 dark:text-gray-300">
            Wiederholung
          </label>

          <select
            value={freq}
            onChange={(e) => {
              const value = e.target.value;
              setFreq(value);

              if (value === 'none') {
                setSerieBis(dtstart);
                setByweekday('');
              }

              if (value === 'weekly') {
                setByweekday(String(dayjs(dtstart).day()));
                if (dayjs(serieBis).isBefore(dayjs(dtstart), 'day')) {
                  setSerieBis(dtstart);
                }
              }

              if (value !== 'none' && dayjs(serieBis).isBefore(dayjs(dtstart), 'day')) {
                setSerieBis(dtstart);
              }
            }}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 mb-2"
          >
            <option value="none">Keine Wiederholung</option>
            <option value="daily">Alle X Tage</option>
            <option value="weekly">Wöchentlich</option>
            <option value="monthly">Monatlich am Starttag</option>
          </select>

          {freq !== 'none' && (
            <div className="space-y-3">
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

                <div>
                  <label className="block text-xs mb-1 text-gray-600 dark:text-gray-300">
                    Wiederholen bis
                  </label>
                  <input
                    type="date"
                    value={serieBis}
                    min={dtstart}
                    onChange={(e) => setSerieBis(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
                  />
                </div>
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

              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 px-3 py-2 text-xs text-blue-900 dark:text-blue-100">
                Es werden voraussichtlich{' '}
                <span className="font-semibold">
                  {anzahlStarttermine} Eintrag{anzahlStarttermine === 1 ? '' : 'e'}
                </span>{' '}
                erzeugt. Jeder Eintrag dauert{' '}
                <span className="font-semibold">
                  {dauerTage > 0 ? `${dauerTage} Tag${dauerTage === 1 ? '' : 'e'}` : '—'}
                </span>.
              </div>
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
            <div className="text-gray-500 dark:text-gray-400 mt-1">
              Dauer: {dauerTage > 0 ? `${dauerTage} Tag${dauerTage === 1 ? '' : 'e'}` : '—'}
            </div>
            <div className="text-gray-500 dark:text-gray-400 mt-1">
              {rhythmusText}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              feedback.includes('Fehler') ||
              feedback.includes('Bitte') ||
              feedback.includes('darf nicht') ||
              feedback.includes('keine Termine')
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
            <h3 className="text-lg font-semibold mb-3">
              Hinweise zum Zusatzbedarf
            </h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Zusatzbedarf ist für Aufgaben gedacht, die zusätzlich zum normalen Sollplan
                geplant werden.
              </p>
              <p>
                Es können nur Schichtarten gewählt werden, die nicht sollplanrelevant sind.
                K, KO und U werden ausgeschlossen.
              </p>
              <p>
                Eine Qualifikation kann hinterlegt werden, muss aber nicht.
              </p>
              <p>
                Von und Bis beschreiben die Dauer eines einzelnen Zusatzbedarfs.
                Bei Wiederholung werden daraus echte einzelne Einträge erzeugt.
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