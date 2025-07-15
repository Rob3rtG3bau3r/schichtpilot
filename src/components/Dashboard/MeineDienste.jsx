import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { useRollen } from '../../context/RollenContext';
import dayjs from 'dayjs';
import { Info, ArrowRight, ArrowLeft, Calendar, CalendarDays } from 'lucide-react';

const MeineDienste = () => {
  const { userId } = useRollen();
  const [eintraege, setEintraege] = useState([]);
  const [heute] = useState(dayjs());
  const [startDatum, setStartDatum] = useState(dayjs().startOf('day'));
  const [anzahlGeladeneTage, setAnzahlGeladeneTage] = useState(50);
  const [infoOffen, setInfoOffen] = useState(false);

  const ladeDienste = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('DB_Kampfliste')
      .select(`
        datum,
        ist_schicht(kuerzel, farbe_bg),
        startzeit_ist,
        endzeit_ist,
        kommentar,
        created_at
      `)
      .eq('user', userId)
      .gte('datum', startDatum.format('YYYY-MM-DD'))
      .lte('datum', dayjs(startDatum).add(anzahlGeladeneTage - 1, 'day').format('YYYY-MM-DD'))
      .order('datum', { ascending: true });

if (!error && data) {
      setEintraege(data);
} else {
      console.error('Fehler beim Laden der Dienste:', error?.message);
    }
  };

  useEffect(() => {
    ladeDienste();
  }, [userId, startDatum, anzahlGeladeneTage]);

  const ladeNaechstenMonat = () => {
    setStartDatum((prev) => dayjs(prev).add(1, 'month').startOf('month'));
  };

  const ladeNaechstesJahr = () => {
    setStartDatum((prev) => dayjs(prev).add(1, 'year').startOf('year'));
  };

  const ladeMehrDienste = () => {
    setAnzahlGeladeneTage((prev) => prev + 50);
  };

  const zurueckZuHeute = () => {
    setStartDatum(dayjs().startOf('day'));
    setAnzahlGeladeneTage(50);
  };

  return (
    <div className="w-full h-[calc(100vh-150px)] overflow-auto bg-gray-200 dark:bg-gray-800 rounded-xl shadow-xl p-4 border border-gray-300 dark:border-gray-700 relative">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">🗓️ Deine Dienste</h2>
        <div className="flex gap-2 items-center">
          <button onClick={ladeNaechstenMonat} title="Nächster Monat">
            <Calendar className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>
          <button onClick={ladeNaechstesJahr} title="Nächstes Jahr">
            <CalendarDays className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>
          <button onClick={zurueckZuHeute} title="Zurück zu Heute">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-blue-500" />
          </button>
          <button onClick={() => setInfoOffen(true)} title="Info">
            <Info className="w-5 h-5 text-blue-500 hover:text-blue-700 dark:text-blue-300 dark:hover:text-white" />
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600">
          <tr>
            <th className="py-1">Datum</th>
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

              // Tageswechsel behandeln (z. B. 21:00 – 06:00)
              if (start && ende && ende.isBefore(start)) {
                ende = ende.add(1, 'day');
              }

              const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
              const stunden = Math.floor(dauerMin / 60);
              const minuten = dauerMin % 60;

              return (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-1">{dayjs(eintrag.datum).format('DD.MM.YYYY')}</td>
                  <td>
                    <span
                      className="inline-block w-10 text-center rounded text-white text-xs"
                      style={{ backgroundColor: eintrag.ist_schicht?.farbe_bg || '#999' }}
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
            className="bg-white dark:bg-gray-900 text-black dark:text-white rounded-xl p-6 w-[90%] max-w-lg shadow-2xl relative animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Funktionen erklärt</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Zeigt nur zukünftige Dienste ab heute.</li>
              <li>Lädt jeweils 50 Tage, automatisch erweiterbar durch Scrollen.</li>
              <li>Icons oben: Info, nächster Monat, nächstes Jahr, zurück zu heute.</li>
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