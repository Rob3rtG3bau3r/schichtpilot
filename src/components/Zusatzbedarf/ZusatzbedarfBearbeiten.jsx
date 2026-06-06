import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Save, X, Info } from 'lucide-react';
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

const ZusatzbedarfBearbeiten = ({ eintrag, onClose, onSaved }) => {
  const { sichtFirma: firma, sichtUnit: unit } = useRollen();

  const [schichtarten, setSchichtarten] = useState([]);
  const [qualifikationen, setQualifikationen] = useState([]);

  const [name, setName] = useState('');
  const [schichtartId, setSchichtartId] = useState('');
  const [qualiId, setQualiId] = useState('');
  const [bedarfAnzahl, setBedarfAnzahl] = useState(1);
  const [dtstart, setDtstart] = useState('');
  const [until, setUntil] = useState('');
  const [freq, setFreq] = useState('none');
  const [interval, setInterval] = useState(1);
  const [byweekday, setByweekday] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [hinweis, setHinweis] = useState('');
  const [farbe, setFarbe] = useState('#3b82f6');
  const [aktiv, setAktiv] = useState(true);
  const [anfrageErlaubt, setAnfrageErlaubt] = useState(true);

  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [infoOffen, setInfoOffen] = useState(false);

  // Schichtarten laden
  useEffect(() => {
    const ladeSchichtarten = async () => {
      if (!firma || !unit) return;

      const { data, error } = await supabase
        .from('DB_SchichtArt')
        .select('id, kuerzel, beschreibung, sollplan_relevant')
        .eq('firma_id', firma)
        .eq('unit_id', unit)
        .eq('sollplan_relevant', false)
        .not('kuerzel', 'in', '(K,KO)')
        .order('position', { ascending: true });

      if (error) {
        console.error('Fehler beim Laden der Schichtarten:', error.message);
        setSchichtarten([]);
        return;
      }

      setSchichtarten(data || []);
    };

    ladeSchichtarten();
  }, [firma, unit]);

  // Qualifikationen laden
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

  // Eintrag ins Formular laden
  useEffect(() => {
    if (!eintrag) {
      setFeedback('');
      return;
    }

    setName(eintrag.name || '');
    setSchichtartId(eintrag.schichtart_id ? String(eintrag.schichtart_id) : '');
    setQualiId(eintrag.quali_id ? String(eintrag.quali_id) : '');
    setBedarfAnzahl(Number(eintrag.bedarf_delta || 1));
    setDtstart(eintrag.dtstart || dayjs().format('YYYY-MM-DD'));
    setUntil(eintrag.until || eintrag.dtstart || dayjs().format('YYYY-MM-DD'));
    setFreq(eintrag.freq === 'once' ? 'none' : eintrag.freq || 'none');
    setInterval(Number(eintrag.interval || 1));

    if (Array.isArray(eintrag.byweekday) && eintrag.byweekday.length > 0) {
      setByweekday(String(eintrag.byweekday[0]));
    } else {
      setByweekday('');
    }

    setBeschreibung(eintrag.beschreibung || '');
    setHinweis(eintrag.hinweis || '');
    setFarbe(eintrag.farbe || '#3b82f6');
    setAktiv(eintrag.aktiv !== false);
    setAnfrageErlaubt(eintrag.anfrage_erlaubt !== false);
    setFeedback('');
  }, [eintrag]);

  const istVergangen = useMemo(() => {
    if (!eintrag?.until) return false;
    return dayjs(eintrag.until).isBefore(dayjs().startOf('day'), 'day');
    }, [eintrag]);

  const ausgewaehlteSchichtart = useMemo(() => {
    return schichtarten.find((s) => String(s.id) === String(schichtartId));
  }, [schichtarten, schichtartId]);

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

  const validate = () => {
    if (!eintrag?.id) return 'Kein Eintrag ausgewählt.';
    if (!name.trim()) return 'Bitte eine Bezeichnung eingeben.';
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

    if (Number(interval || 0) < 1) {
      return 'Der Rhythmus-Abstand muss mindestens 1 sein.';
    }

    return '';
  };

  const handleSave = async () => {
    setFeedback('');
    if (istVergangen) {
    setFeedback('Vergangener Zusatzbedarf kann nicht mehr geändert oder deaktiviert werden.');
    return;
    }
    const err = validate();
    if (err) {
      setFeedback(err);
      return;
    }

    setSaving(true);

    const patch = {
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
      aktiv,
      anfrage_erlaubt: anfrageErlaubt,
    };

    const { error } = await supabase
      .from('DB_Sonderbedarf')
      .update(patch)
      .eq('id', eintrag.id)
      .eq('firma_id', firma)
      .eq('unit_id', unit);

    setSaving(false);

    if (error) {
      console.error('Fehler beim Speichern:', error.message);
      setFeedback(`Fehler beim Speichern: ${error.message}`);
      return;
    }

    setFeedback('Änderungen gespeichert.');
    onSaved?.();

    setTimeout(() => {
      setFeedback('');
    }, 2500);
  };

  if (!eintrag) {
    return (
      <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-white/60 dark:bg-gray-900/40">
        <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Details / Bearbeiten
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Wähle oben einen Zusatzbedarf aus, um ihn hier zu bearbeiten.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-xl bg-white/60 dark:bg-gray-900/40">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">
            Zusatzbedarf bearbeiten
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Änderungen wirken sich auf die Anzeige im Mitarbeiterbedarf aus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setInfoOffen(true)}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-500"
            title="Informationen"
          >
            <Info size={18} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Schließen"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        {istVergangen && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
                Dieser Zusatzbedarf liegt in der Vergangenheit und kann nicht mehr geändert oder deaktiviert werden.
            </div>
            )}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
            <input
            type="checkbox"
            checked={aktiv}
            disabled={istVergangen}
            onChange={(e) => setAktiv(e.target.checked)}
            className="accent-blue-600 disabled:cursor-not-allowed"
            />
            Aktiv
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-800">
            <input
              type="checkbox"
              checked={anfrageErlaubt}
              onChange={(e) => setAnfrageErlaubt(e.target.checked)}
              className="accent-blue-600"
            />
            Anfrage möglich
          </label>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Bezeichnung
          </label>
          <input
            type="text"
            value={name}
            disabled={istVergangen}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Kürzel / Schichtart
          </label>
          <select
            value={schichtartId}
            disabled={istVergangen}
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
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Benötigte Qualifikation optional
          </label>
          <select
            value={qualiId}
            disabled={istVergangen}
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
            disabled={istVergangen}
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
              disabled={istVergangen}
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
              disabled={istVergangen}
              min={dtstart}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/60">
          <label className="block text-xs font-medium mb-2 text-gray-600 dark:text-gray-300">
            Wiederholung
          </label>

          <select
            value={freq}
            disabled={istVergangen}
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
                  disabled={istVergangen}
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
                    disabled={istVergangen}
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
            disabled={istVergangen}
            onChange={(e) => setBeschreibung(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
            Hinweis optional
          </label>
          <textarea
            value={hinweis}
            disabled={istVergangen}
            onChange={(e) => setHinweis(e.target.value)}
            rows={2}
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
            disabled={istVergangen}
            onChange={(e) => setFarbe(e.target.value)}
            className="w-full h-10 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          />
        </div>

        {ausgewaehlteSchichtart && (
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 p-3 text-xs">
            <div className="font-semibold mb-1">Vorschau</div>
            <div>
              {ausgewaehlteSchichtart.kuerzel} · {bedarfAnzahl} Person(en)
            </div>
            <div className="text-gray-500 dark:text-gray-400 mt-1">
              {rhythmusText}
            </div>
          </div>
        )}

        {feedback && (
          <div
            className={`rounded-xl px-3 py-2 text-sm ${
              feedback.includes('Fehler') || feedback.includes('Bitte') || feedback.includes('darf nicht')
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700'
                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700'
            }`}
          >
            {feedback}
          </div>
        )}

<div className="flex gap-2 pt-2">
  <button
    type="button"
    onClick={onClose}
    disabled={saving}
    className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:bg-gray-400 text-gray-900 dark:text-gray-100"
  >
    Schließen
  </button>

  <button
    type="button"
    onClick={handleSave}
    disabled={saving}
    className="flex-1 px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white flex items-center justify-center gap-2"
  >
    <Save size={16} />
    {saving ? 'Speichern…' : 'Änderungen speichern'}
  </button>
</div>
      </div>

      {infoOffen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setInfoOffen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-3">Zusatzbedarf bearbeiten</h3>

            <div className="text-sm space-y-2 text-gray-700 dark:text-gray-200">
              <p>
                Hier kannst du geplante Zusatzbedarfe ändern oder deaktivieren.
              </p>
              <p>
                Inaktive Zusatzbedarfe bleiben gespeichert, werden aber später nicht im
                Mitarbeiterbedarf angezeigt.
              </p>
              <p>
                Die Arbeitszeit wird für Zusatzbedarf aktuell nicht geprüft. Gezählt werden
                später Einträge in der Kampfliste mit dem passenden Zusatz-Kürzel.
              </p>
            </div>

            <div className="flex justify-end mt-5">
              <button
                type="button"
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
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

export default ZusatzbedarfBearbeiten;