// src/components/Mobile/RenderKalender.jsx
import React from 'react';
import dayjs from 'dayjs';

const wochenTagKurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const RenderKalender = ({
  startDatum,
  eintraege,
  bedarfStatus,
  infoOffenIndex,
  setInfoOffenIndex,
  setUrlaubModal,
  setHilfeModal,
}) => {
  if (!startDatum || typeof startDatum.daysInMonth !== 'function') return null;

  const daysInMonth = startDatum.daysInMonth();
  const firstDay = startDatum.startOf('month').day();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const kalenderTage = [];

  // Leere Felder vor dem 1. des Monats
  for (let i = 0; i < offset; i++) {
    kalenderTage.push(
      <div key={`empty-${i}`} className="h-20 bg-gray-200 dark:bg-gray-900 rounded" />
    );
  }

  // Tage rendern
  for (let day = 1; day <= daysInMonth; day++) {
    const datum = startDatum.date(day).format('YYYY-MM-DD');
    const eintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === datum);

    const kuerzel = eintrag?.ist_schicht?.kuerzel || '';
    const farbe = eintrag?.ist_schicht?.farbe_bg || '#ccc';
    const farbeText = eintrag?.ist_schicht?.farbe_text || '#000';
    const start = eintrag?.startzeit_ist ? dayjs(`2000-01-01T${eintrag.startzeit_ist}`) : null;
    let ende = eintrag?.endzeit_ist ? dayjs(`2000-01-01T${eintrag.endzeit_ist}`) : null;
    if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');
    const hatKommentar = !!(eintrag?.kommentar && String(eintrag.kommentar).trim().length > 0);

    const istHeute = datum === dayjs().format('YYYY-MM-DD');
    const istVergangenheit = dayjs(datum).isBefore(dayjs(), 'day');
    const status = bedarfStatus?.[datum] || {};

    // Nachbar-Tage prüfen (F/N-Regel)
    const prevDatum = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');
    const nextDatum = dayjs(datum).add(1, 'day').format('YYYY-MM-DD');
    const prevEintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === prevDatum);
    const nextEintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === nextDatum);
    const prevKuerzel = prevEintrag?.ist_schicht?.kuerzel || null;
    const nextKuerzel = nextEintrag?.ist_schicht?.kuerzel || null;

    const hideFrueh = prevKuerzel === 'N';
    const hideNacht = nextKuerzel === 'F';

    // Fehlstände für Icons filtern
    const fehlend = status?.fehlendProSchicht || {};
    const gefiltertFehlend = {
      F: hideFrueh ? 0 : fehlend.F,
      S: fehlend.S,
      N: hideNacht ? 0 : fehlend.N,
    };

    const hatUnterbesetzung =
      !istVergangenheit &&
      Object.values(gefiltertFehlend).some(
        (v) => v === true || (typeof v === 'number' && v > 0)
      );

    const hatUeberbesetzung =
      !istVergangenheit && kuerzel !== '-' && status?.ueber?.includes(kuerzel);

    kalenderTage.push(
      <div
        key={day}
        className={`border relative h-20 p-1 text-xs cursor-pointer rounded hover:bg-gray-100 ${
          istHeute ? 'border-blue-400 border-2' : ''
        }`}
        onClick={() => setInfoOffenIndex(day - 1)}
      >

        <div className="flex justify-between items-center text-[10px] mb-1">
          <span className="text-gray-600 dark:text-gray-200 font-semibold">{day}</span>
          <span className="flex gap-1">
            {hatKommentar && <span title="Kommentar vorhanden">💬</span>}
            {hatUeberbesetzung && <span title="Überdeckung – Urlaub möglich">🌿</span>}
            {hatUnterbesetzung && <span title="Unterbesetzung">❗</span>}
          </span>
        </div>

        {kuerzel && (
          <div
            className="rounded text-center text-[11px] mb-1 truncate"
            style={{ backgroundColor: farbe, color: farbeText }}
          >
            {kuerzel}
          </div>
        )}
        {start && ende && (
          <div className="text-gray-700 dark:text-gray-400 text-[10px]">
            {`${start.format('HH:mm')} - ${ende.format('HH:mm')}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Kopfzeile der Wochentage */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold mb-1">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((w, idx) => (
          <div key={idx} className="py-1 text-gray-600 dark:text-gray-200">
            {w}
          </div>
        ))}
      </div>

      {/* Kalender Grid */}
      <div className="grid grid-cols-7 gap-1">{kalenderTage}</div>

      {/* Modal-Detailanzeige */}
      {infoOffenIndex !== null && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 max-w-full relative">
            {(() => {
              const datum = startDatum.date(infoOffenIndex + 1).format('YYYY-MM-DD');
              const eintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === datum);
              const woTag = dayjs(datum).day();
              const kuerzel = eintrag?.ist_schicht?.kuerzel || '-';
              const farbe = eintrag?.ist_schicht?.farbe_bg || '#999';
              const farbeText = eintrag?.ist_schicht?.farbe_text || '#ffffff';
              const start = eintrag?.startzeit_ist ? dayjs(`2000-01-01T${eintrag.startzeit_ist}`) : null;
              let ende = eintrag?.endzeit_ist ? dayjs(`2000-01-01T${eintrag.endzeit_ist}`) : null;
              if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');
              const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
              const stunden = Math.floor(dauerMin / 60);
              const minuten = dauerMin % 60;
              const status = bedarfStatus[datum] || {};
              const istVergangenheit = dayjs(datum).isBefore(dayjs(), 'day');

              // F/N-Regel für Modal
              const prevDatum = dayjs(datum).subtract(1, 'day').format('YYYY-MM-DD');
              const nextDatum = dayjs(datum).add(1, 'day').format('YYYY-MM-DD');
              const prevEintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === prevDatum);
              const nextEintrag = eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === nextDatum);
              const prevKuerzel = prevEintrag?.ist_schicht?.kuerzel || null;
              const nextKuerzel = nextEintrag?.ist_schicht?.kuerzel || null;

              const hideFrueh = prevKuerzel === 'N';
              const hideNacht = nextKuerzel === 'F';

              return (
                <>
                  <h2 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">
                    {wochenTagKurz[woTag]} {dayjs(datum).format('DD.MM.YYYY')}
                  </h2>

                  <div className="mb-1 text-xs">
                    <strong>Schicht:</strong>{' '}
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: farbe, color: farbeText }}>
                      {kuerzel}
                    </span>
                  </div>
                  <div className="mb-1 text-xs">
                    <strong>Von-Bis:</strong> {start?.format('HH:mm')} - {ende?.format('HH:mm')}
                  </div>
                  <div className="mb-1 text-xs">
                    <strong>Dauer:</strong> {dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}
                  </div>

                  {/* Kommentar im Modal */}
                  {eintrag?.kommentar?.trim?.() && (
                    <div className="mb-1 text-xs">
                      <strong>Kommentar:</strong>{' '}
                      <span className="whitespace-pre-wrap break-words">{eintrag.kommentar}</span>
                    </div>
                  )}

                  {/* Unterbesetzung (gefiltert) */}
                  {status?.fehlendProSchicht && !istVergangenheit && (
                    <div className="mt-2">
                      {[
                        { name: 'Früh', key: 'F', hidden: hideFrueh },
                        { name: 'Spät', key: 'S', hidden: false },
                        { name: 'Nacht', key: 'N', hidden: hideNacht },
                      ].map(({ name, key, hidden }) => {
                        if (hidden) return null;
                        const fehlt = status.fehlendProSchicht[key];
                        if (!fehlt) return null;
                        return (
                          <div
                            key={key}
                            className="cursor-pointer bg-gray-300 dark:bg-gray-500 text-black shadow-xl opacity-90 border-2 border-red-500 dark:border-red-400 rounded-xl px-2 py-1 mb-1"
                            onClick={() =>
                              setHilfeModal({ offen: true, tag: wochenTagKurz[woTag], datum, schicht: key })
                            }
                          >
                            {name}: Fehlt {typeof fehlt === 'number' ? `${fehlt} Person(en)` : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Überdeckung */}
                  {kuerzel !== '-' && !istVergangenheit && status?.ueber?.includes(kuerzel) && (
                    <div className="mt-2 border border-green-300 bg-white dark:bg-gray-900 text-green-700 px-3 py-1 rounded-md shadow-sm text-xs">
                      🌿{' '}
                      <button
                        onClick={() =>
                          setUrlaubModal({ offen: true, tag: wochenTagKurz[woTag], datum, schicht: kuerzel })
                        }
                        className="font-semibold underline"
                      >
                        Ich würde gerne Urlaub nehmen
                      </button>
                    </div>
                  )}

                  <div className="text-right mt-3">
                    <button onClick={() => setInfoOffenIndex(null)} className="text-blue-600 hover:underline text-sm">
                      Schließen
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default RenderKalender;
