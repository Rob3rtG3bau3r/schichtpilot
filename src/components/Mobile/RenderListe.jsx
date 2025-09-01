// RenderListe.jsx
import React from 'react';
import dayjs from 'dayjs';
import { Plus, Minus } from 'lucide-react';

const wochenTagKurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const RenderListe = ({
  startDatum,
  eintraege,
  bedarfStatus,
  infoOffenIndex,
  setInfoOffenIndex,
  setUrlaubModal,
  setHilfeModal,
  heuteRef
}) => {
  // Fallback, falls startDatum fehlt
  if (!startDatum || typeof startDatum.daysInMonth !== 'function') {
    console.warn('⚠️ Ungültiges startDatum in RenderListe, Fallback auf aktuellen Monat:', startDatum);
    startDatum = dayjs().startOf('month');
  }

  const daysInMonth = startDatum.daysInMonth();

  return (
    <div className="px-4 space-y-3 pb-6">
      {Array.from({ length: daysInMonth }, (_, idx) => {
        const datum = startDatum.date(idx + 1).format('YYYY-MM-DD');
        const eintrag = eintraege.find(e => dayjs(e.datum).format('YYYY-MM-DD') === datum);
        const woTag = dayjs(datum).day();
        const istHeute = datum === dayjs().format('YYYY-MM-DD');
        const istVergangenheit = dayjs(datum).isBefore(dayjs(), 'day');
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

        return (
          <div
            key={idx}
            ref={istHeute ? heuteRef : null}
            className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 border-2 ${istHeute ? 'border-blue-500' : 'border-transparent'}`}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm">
                <span>{wochenTagKurz[woTag]}</span>
                <span>{dayjs(datum).format('DD.MM.YYYY')}</span>
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: farbe, color: farbeText }}>
                  {kuerzel}
                </span>
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: farbe, color: farbeText }}>
                  {start && ende ? `${start.format('HH:mm')} - ${ende.format('HH:mm')}` : '–'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {status?.ueber?.length > 0 && kuerzel !== '-' && !istVergangenheit && (
                  <button className="text-green-600" title="Überdeckung – Urlaub möglich">🌿</button>
                )}
                {status?.fehlendProSchicht &&
                  !istVergangenheit &&
                  Object.values(status.fehlendProSchicht).some((wert) => wert === true)
                  && (
                    <button
                      className="text-red-600 animate-pulse"
                      title="Unterbesetzung anzeigen"
                      onClick={() => setInfoOffenIndex(idx)}
                    >❗</button>
                  )}
                <button
                  onClick={() => setInfoOffenIndex(infoOffenIndex === idx ? null : idx)}
                  title={infoOffenIndex === idx ? 'Details schließen' : 'Details anzeigen'}
                >
                  {infoOffenIndex === idx ? (
                    <Minus className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Plus className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Detailinfos */}
            {infoOffenIndex === idx && (
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
                <div><strong>Datum:</strong> {dayjs(datum).format('DD.MM.YYYY')}</div>
                <div><strong>Von-Bis:</strong> {start?.format('HH:mm')} - {ende?.format('HH:mm')}</div>
                <div><strong>Dauer:</strong> {dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}</div>
                {eintrag?.kommentar && <div><strong>Kommentar:</strong> {eintrag.kommentar}</div>}
                {/* Unter-/Überbesetzung */}
                {status?.fehlendProSchicht && (
                  <>
                    {[{ name: 'Früh', key: 'F' }, { name: 'Spät', key: 'S' }, { name: 'Nacht', key: 'N' }].map(({ name, key }) => {
                      const fehlt = status.fehlendProSchicht[key];
                      if (!fehlt) return null;
                      return (
                        <div
                          key={key}
                          className="cursor-pointer bg-gray-300 dark:bg-gray-500 text-black shadow-xl opacity-90 border-2 border-red-500 dark:border-red-400 rounded-xl px-2 py-1 mb-1"
                          onClick={() =>
                            !istVergangenheit && setHilfeModal({ offen: true, tag: wochenTagKurz[woTag], datum: datum, schicht: key })
                          }
                        >
                          <span className="font-medium">{name}:</span>{' '}
                          {typeof fehlt === 'number' ? `Fehlt ${fehlt} Person(en)` : 'Fehlt'}
                        </div>
                      );
                    })}
                  </>
                )}
                {kuerzel !== '-' &&
                  !istVergangenheit &&
                  !status?.fehlendProSchicht?.[kuerzel] &&
                  status?.ueber?.includes(kuerzel) && (
                    <div className="mt-2 border-2 border-green-300 bg-white dark:bg-gray-900 text-green-700 px-3 py-1 rounded-md shadow-sm text-xs">
                      🌿 <button
                        onClick={() => setUrlaubModal({ offen: true, tag: wochenTagKurz[woTag], datum: datum, schicht: kuerzel })}
                        className="font-semibold underline text-green-700"
                      >
                        Ich würde gerne Urlaub nehmen
                      </button>
                    </div>
                  )}
                <div className="text-right mt-2">
                  <button onClick={() => setInfoOffenIndex(null)} className="text-blue-600 hover:underline">Schließen</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RenderListe;

