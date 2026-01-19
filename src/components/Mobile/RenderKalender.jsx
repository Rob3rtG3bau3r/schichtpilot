import React from 'react';
import dayjs from 'dayjs';

const WTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WTAG_HEADER = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/**
 * Erwartete Props:
 * - startDatum: dayjs Instanz (Monats-Start)
 * - eintraege: [{ datum, ist_schicht:{kuerzel, farbe_bg, farbe_text}, startzeit_ist, endzeit_ist, kommentar }]
 * - bedarfStatus: { 'YYYY-MM-DD': { fehlendProSchicht:{F,S,N}, ueber:[Kürzel,...] } }
 * - feierMap: { 'YYYY-MM-DD': [{name,typ,farbe}, ...] }
 * - infoOffenIndex, setInfoOffenIndex
 * - setUrlaubModal({offen,tag,datum,schicht})
 * - setHilfeModal({offen,tag,datum,schicht})
 */
export default function RenderKalender({
  startDatum,
  eintraege,
  bedarfStatus,
  feierMap = {},
  infoOffenIndex,
  setInfoOffenIndex,
  setUrlaubModal,
  setHilfeModal,
}) {
  if (!startDatum || typeof startDatum.daysInMonth !== 'function') return null;

  const daysInMonth = startDatum.daysInMonth();
  // Montag als Wochenstart: Offset so berechnen, dass Montag links ist
  const firstDay = startDatum.startOf('month').day(); // 0=So..6=Sa
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const cells = [];

  // Leerzellen vor dem 1.
  for (let i = 0; i < offset; i++) {
    cells.push(<div key={`empty-${i}`} className="h-20 rounded bg-gray-200 dark:bg-gray-900" />);
  }

  const findEintrag = (iso) =>
    eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === iso);

  const feiertagsBadge = (iso) => {
    const tags = feierMap?.[iso];
    if (!tags || !tags.length) return null;

    const ferien = tags.filter(t => ((t.typ || '').toLowerCase().includes('ferien')));
    const feiertage = tags.filter(t => ((t.typ || '').toLowerCase().includes('feiertag')));

    // Ranking: Feiertag > Ferien
    const pick = (feiertage[0] || ferien[0]) || null;
    if (!pick) return null;

    const title = (() => {
      if (feiertage.length) {
        return `Feiertag: ${feiertage[0]?.name || ''}${feiertage.length > 1 ? ` +${feiertage.length - 1}` : ''}`;
      }
      return `Ferien: ${ferien[0]?.name || ''}${ferien.length > 1 ? ` +${ferien.length - 1}` : ''}`;
    })();

    return (
      <div
        className="absolute top-0 left-0 right-0 h-1.5 rounded-t"
        style={{ backgroundColor: pick.farbe || '#ef4444' }}
        title={title}
      />
    );
  };


  for (let day = 1; day <= daysInMonth; day++) {
    const iso = startDatum.date(day).format('YYYY-MM-DD');
    const e = findEintrag(iso);

    const kuerzel = e?.ist_schicht?.kuerzel || '';
    const farbeBg = e?.ist_schicht?.farbe_bg || '#ccc';
    const farbeTx = e?.ist_schicht?.farbe_text || '#000';

    const start = e?.startzeit_ist ? dayjs(`2000-01-01T${e.startzeit_ist}`) : null;
    let ende = e?.endzeit_ist ? dayjs(`2000-01-01T${e.endzeit_ist}`) : null;
    if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');

    const hatKommentar = !!(e?.kommentar && String(e.kommentar).trim().length > 0);
    const istHeute = iso === dayjs().format('YYYY-MM-DD');
    const istVergangenheit = dayjs(iso).isBefore(dayjs(), 'day');

    const status = bedarfStatus?.[iso] || {};

    // Nachbar-Regel F/N
    const prevIso = dayjs(iso).subtract(1, 'day').format('YYYY-MM-DD');
    const nextIso = dayjs(iso).add(1, 'day').format('YYYY-MM-DD');
    const prevK = findEintrag(prevIso)?.ist_schicht?.kuerzel || null;
    const nextK = findEintrag(nextIso)?.ist_schicht?.kuerzel || null;
    const hideFrueh = prevK === 'N';
    const hideNacht = nextK === 'F';

    const fehlend = status?.fehlendProSchicht || {};
    const gefFehl = {
      F: hideFrueh ? 0 : fehlend.F,
      S: fehlend.S,
      N: hideNacht ? 0 : fehlend.N,
    };

    const hatUnterbesetzung =
      !istVergangenheit &&
      Object.values(gefFehl).some((v) => v === true || (typeof v === 'number' && v > 0));
    const hatUeberdeckung = !istVergangenheit && kuerzel !== '-' && status?.ueber?.includes(kuerzel);

    cells.push(
      <div
        key={iso}
        className={`relative border rounded h-20 p-1 text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
          istHeute ? 'border-blue-400 border-2' : 'border-gray-300 dark:border-gray-700'
        }`}
        onClick={() => setInfoOffenIndex(day - 1)}
      >
        {feiertagsBadge(iso)}

        <div className="flex justify-between items-center text-[10px] mb-1">
          <span className="text-gray-700 dark:text-gray-200 font-semibold">{day}</span>
          <span className="flex gap-1">
            {hatKommentar && <span title="Kommentar vorhanden">💬</span>}
            {hatUeberdeckung && <span title="Überdeckung – Urlaub möglich">🌿</span>}
            {hatUnterbesetzung && <span title="Unterbesetzung">❗</span>}
          </span>
        </div>

        {kuerzel && (
          <div
            className="rounded text-center text-[11px] mb-1 truncate"
            style={{ backgroundColor: farbeBg, color: farbeTx }}
          >
            {kuerzel}
          </div>
        )}
        {start && ende && (
          <div className="text-gray-700 dark:text-gray-400 text-[10px]">
            {start.format('HH:mm')} - {ende.format('HH:mm')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Kopfzeile (Mo-So) */}
      <div className="grid grid-cols-7 gap-1 text-center font-semibold mb-1">
        {WTAG_HEADER.map((w) => (
          <div key={w} className="py-1 text-gray-600 dark:text-gray-200">
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">{cells}</div>

      {/* Modal */}
      {infoOffenIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-80 max-w-full relative">
            {(() => {
              const iso = startDatum.date(infoOffenIndex + 1).format('YYYY-MM-DD');
              const e = eintraege.find((x) => dayjs(x.datum).format('YYYY-MM-DD') === iso);
              const w = dayjs(iso).day();
              const kuerzel = e?.ist_schicht?.kuerzel || '-';
              const farbeBg = e?.ist_schicht?.farbe_bg || '#999';
              const farbeTx = e?.ist_schicht?.farbe_text || '#fff';
              const start = e?.startzeit_ist ? dayjs(`2000-01-01T${e.startzeit_ist}`) : null;
              let ende = e?.endzeit_ist ? dayjs(`2000-01-01T${e.endzeit_ist}`) : null;
              if (start && ende && ende.isBefore(start)) ende = ende.add(1, 'day');
              const dauerMin = start && ende ? ende.diff(start, 'minute') : 0;
              const stunden = Math.floor(dauerMin / 60);
              const minuten = dauerMin % 60;
              const status = bedarfStatus?.[iso] || {};
              const istVergangenheit = dayjs(iso).isBefore(dayjs(), 'day');

              // F/N-Regel im Modal
              const prevIso = dayjs(iso).subtract(1, 'day').format('YYYY-MM-DD');
              const nextIso = dayjs(iso).add(1, 'day').format('YYYY-MM-DD');
              const prevK = findEintrag(prevIso)?.ist_schicht?.kuerzel || null;
              const nextK = findEintrag(nextIso)?.ist_schicht?.kuerzel || null;
              const hideFrueh = prevK === 'N';
              const hideNacht = nextK === 'F';

              const tags = feierMap?.[iso] || [];

              return (
                <>
                  <h2 className="text-sm font-bold mb-2 text-gray-800 dark:text-gray-200">
                    {WTAG_KURZ[w]} {dayjs(iso).format('DD.MM.YYYY')}
                  </h2>

                  {/* Feiertage/Ferien Liste */}
                  {tags.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {tags.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block w-3 h-3 rounded"
                            style={{ backgroundColor: t.farbe || '#16a34a' }}
                          />
                          <span className="font-medium">{t.typ}:</span>
                          <span>{t.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-1 text-xs">
                    <strong>Schicht:</strong>{' '}
                    <span className="px-2 py-1 rounded" style={{ backgroundColor: farbeBg, color: farbeTx }}>
                      {kuerzel}
                    </span>
                  </div>
                  <div className="mb-1 text-xs">
                    <strong>Von-Bis:</strong> {start?.format('HH:mm')} - {ende?.format('HH:mm')}
                  </div>
                  <div className="mb-1 text-xs">
                    <strong>Dauer:</strong> {dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}
                  </div>

                  {e?.kommentar?.trim?.() && (
                    <div className="mb-1 text-xs">
                      <strong>Kommentar:</strong>{' '}
                      <span className="whitespace-pre-wrap break-words">{e.kommentar}</span>
                    </div>
                  )}

                  {/* Unterbesetzung */}
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
                            onClick={() => setHilfeModal({ offen: true, tag: WTAG_KURZ[w], datum: iso, schicht: key })}
                          >
                            {name}: Fehlt {typeof fehlt === 'number' ? `${fehlt} Person(en)` : ''}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Überdeckung → Urlaub */}
                  {kuerzel !== '-' && !istVergangenheit && status?.ueber?.includes(kuerzel) && (
                    <div className="mt-2 border border-green-300 bg-white dark:bg-gray-900 text-green-700 px-3 py-1 rounded-md shadow-sm text-xs">
                      🌿{' '}
                      <button
                        onClick={() => setUrlaubModal({ offen: true, tag: WTAG_KURZ[w], datum: iso, schicht: kuerzel })}
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
}
