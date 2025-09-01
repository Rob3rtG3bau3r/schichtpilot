import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import { Info, ArrowLeft, Calendar, CalendarDays } from 'lucide-react';

const monate = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const MeineDienste = () => {
  const { userId } = useRollen();

  // ── Navigation wie in Mobile MeineDiensteListe ──────────────────────────────────────
  const [startDatum, setStartDatum] = useState(dayjs().startOf('month'));
  const [jahr, setJahr] = useState(dayjs().year());
  const aktuellesJahr = dayjs().year();
  const aktuelleJahre = [aktuellesJahr - 1, aktuellesJahr, aktuellesJahr + 1];

  // ── Restliche States ─────────────────────────────────────────────────────────
  const [eintraege, setEintraege] = useState([]);
  const [infoOffen, setInfoOffen] = useState(false);

  // ── Daten laden: kompletter Monat ────────────────────────────────────────────
  const ladeDienste = async () => {
    if (!userId) return;

    const von = startDatum.startOf('month').format('YYYY-MM-DD');
    const bis = startDatum.endOf('month').format('YYYY-MM-DD');

    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select(`
        datum,
        ist_schicht(kuerzel, farbe_bg, farbe_text),
        startzeit_ist,
        endzeit_ist,
        kommentar,
        created_at
      `)
      .eq('user', userId)
      .gte('datum', von)
      .lte('datum', bis)
      .order('datum', { ascending: true });

    if (!error && data) {
      setEintraege(data);
    } else {
      console.error('Fehler beim Laden der Dienste:', error?.message);
    }
  };

  useEffect(() => {
    ladeDienste();
  }, [userId, startDatum]);

  // ── Handlers für Navigation ──────────────────────────────────────────────────
  const zurueckZuHeute = () => {
    const heute = dayjs();
    setJahr(heute.year());
    setStartDatum(heute.startOf('month'));
  };

  const changeMonth = (event) => {
    const newMonthIndex = monate.indexOf(event.target.value);
    if (newMonthIndex >= 0) {
      const neuesDatum = startDatum.set('month', newMonthIndex).startOf('month');
      setStartDatum(neuesDatum);
    }
  };

  const changeYear = (event) => {
    const newYear = parseInt(event.target.value, 10);
    if (!isNaN(newYear)) {
      const neuesDatum = startDatum.set('year', newYear).startOf('month');
      setJahr(newYear);
      setStartDatum(neuesDatum);
    }
  };

  // Optional: Shortcut-Buttons
  const ladeNaechstenMonat = () => {
    setStartDatum((prev) => dayjs(prev).add(1, 'month').startOf('month'));
    setJahr((prev) => dayjs(startDatum).add(1, 'month').year());
  };

  const ladeNaechstesJahr = () => {
    setStartDatum((prev) => dayjs(prev).add(1, 'year').startOf('year'));
    setJahr((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-gray-300 dark:border-gray-700 relative">
      {/* Kopfbereich mit identischer Navigation */}
      <div className="flex flex-wrap gap-3 justify-between items-center mb-4">
        <h2 className="text-md font-semibold">🗓️ Meine Dienste</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={zurueckZuHeute} title="Zurück zu Heute">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>

          {/* Monat/Jahr wie in MeineDiensteListe */}
          <select
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
            value={monate[startDatum.month()]}
            onChange={changeMonth}
          >
            {monate.map((m, idx) => (
              <option key={idx} value={m}>{m}</option>
            ))}
          </select>

          <select
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm"
            value={jahr}
            onChange={changeYear}
          >
            {aktuelleJahre.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Optional: Zusatz-Shortcuts */}
          <button onClick={ladeNaechstenMonat} title="Nächster Monat">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>
          <button onClick={ladeNaechstesJahr} title="Nächstes Jahr">
            <CalendarDays className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>

          <button onClick={() => setInfoOffen(true)} title="Info">
            <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>
        </div>
      </div>

      {/* Tabelle */}
      <table className="w-full text-sm">
        <thead className="text-left text-gray-900 bg-gray-300 dark:bg-gray-700 dark:text-gray-300">
          <tr>
            <th className="py-2 px-1">Datum</th>
            <th>Kürzel</th>
            <th>von</th>
            <th>bis</th>
            <th>Dauer</th>
            <th>Kommentar</th>
          </tr>
        </thead>
        <tbody>
          {eintraege.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-gray-400 py-4">
                Mehr Dienste sind in der Planung noch nicht eingepflegt.
              </td>
            </tr>
          ) : (
            eintraege.map((eintrag, i) => {
              const start = eintrag.startzeit_ist ? dayjs(`2000-01-01T${eintrag.startzeit_ist}`) : null;
              let ende = eintrag.endzeit_ist ? dayjs(`2000-01-01T${eintrag.endzeit_ist}`) : null;

              if (start && ende && ende.isBefore(start)) {
                ende = ende.add(1, 'day');
              }

              const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
              const stunden = Math.floor(dauerMin / 60);
              const minuten = dauerMin % 60;

              return (
                <tr key={i} className="border-b border-gray-300 dark:border-gray-700 hover:bg-gray-300 dark:hover:bg-gray-700">
                  <td className="py-1">{dayjs(eintrag.datum).format('DD.MM.YYYY')}</td>
                  <td>
                    <span
                      className="inline-block w-10 text-center font-semibold rounded-lg text-xs"
                      style={{
                        backgroundColor: eintrag.ist_schicht?.farbe_bg || '#999',
                        color: eintrag.ist_schicht?.farbe_text || '#fff',
                      }}
                    >
                      {eintrag.ist_schicht?.kuerzel || '-'}
                    </span>
                  </td>
                  <td>{start ? start.format('HH:mm') : '–'}</td>
                  <td>{ende ? ende.format('HH:mm') : '–'}</td>
                  <td>{dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}</td>
                  <td className="text-xs text-gray-600 dark:text-gray-300">
                    {eintrag.kommentar || '–'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {infoOffen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
          <div
            className="bg-white dark:bg-gray-900 text-black dark:text-white rounded-xl p-6 w-[90%] max-w-lg shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Funktionen erklärt</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Monats- und Jahresauswahl wie in der mobilen Ansicht.</li>
              <li>„Zurück zu heute“ setzt auf den aktuellen Monatsanfang.</li>
              <li>Zeiten über Mitternacht werden korrekt berechnet.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setInfoOffen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
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

export default MeineDienste;
