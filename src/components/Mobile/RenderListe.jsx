import React from 'react';
import dayjs from 'dayjs';
import { Plus, Minus } from 'lucide-react';

const WTAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/**
 * Erwartete Props:
 * - startDatum, eintraege, bedarfStatus, feierMap
 * - infoOffenIndex, setInfoOffenIndex
 * - setUrlaubModal, setHilfeModal
 * - heuteRef (optional)
 */
export default function RenderListe({
  startDatum,
  eintraege,
  bedarfStatus,
  feierMap = {},
  infoOffenIndex,
  setInfoOffenIndex,
  setUrlaubModal,
  setHilfeModal,
  heuteRef,
}) {
  if (!startDatum || typeof startDatum.daysInMonth !== 'function') {
    startDatum = dayjs().startOf('month');
  }

  const daysInMonth = startDatum.daysInMonth();
  const findEintrag = (iso) =>
    eintraege.find((e) => dayjs(e.datum).format('YYYY-MM-DD') === iso);

  return (
    <div className="px-4 space-y-3 pb-6">
      {Array.from({ length: daysInMonth }, (_, i) => {
        const iso = startDatum.date(i + 1).format('YYYY-MM-DD');
        const e = findEintrag(iso);
        const w = dayjs(iso).day();
        const istHeute = iso === dayjs().format('YYYY-MM-DD');
        const istVergangenheit = dayjs(iso).isBefore(dayjs(), 'day');

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

        // F/N-Regel
        const prevIso = dayjs(iso).subtract(1, 'day').format('YYYY-MM-DD');
        const nextIso = dayjs(iso).add(1, 'day').format('YYYY-MM-DD');
        const prevK = findEintrag(prevIso)?.ist_schicht?.kuerzel || null;
        const nextK = findEintrag(nextIso)?.ist_schicht?.kuerzel || null;
        const hideFrueh = prevK === 'N';
        const hideNacht = nextK === 'F';

        const fehlOrg = status?.fehlendProSchicht || {};
        const fehlGef = { F: hideFrueh ? 0 : fehlOrg.F, S: fehlOrg.S, N: hideNacht ? 0 : fehlOrg.N };
        const hatUnterbesetzung =
          !istVergangenheit &&
          Object.values(fehlGef).some((v) => v === true || (typeof v === 'number' && v > 0));

        const tags = feierMap?.[iso] || [];

        return (
          <div
            key={iso}
            ref={istHeute ? heuteRef : null}
            className={`bg-white dark:bg-gray-700 rounded-lg shadow p-3 border-2 ${
              istHeute ? 'border-blue-500' : 'border-transparent'
            }`}
          >
            <div className="flex justify-between items-center">
              {/* Linker Block: Datum + Feiertags/Ferien-Badges */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{WTAG_KURZ[w]}</span>
                <span>{dayjs(iso).format('DD.MM.YYYY')}</span>

                {tags.slice(0, 2).map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px]"
                    style={{ backgroundColor: t.farbe || '#16a34a', color: '#fff' }}
                    title={`${t.typ}: ${t.name}`}
                  >
                    {t.typ}
                  </span>
                ))}
                {tags.length > 2 && (
                  <span
                    className="text-xs"
                    title={tags.map((t) => `${t.typ}: ${t.name}`).join(' • ')}
                  >
                    +{tags.length - 2}
                  </span>
                )}

                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: farbeBg, color: farbeTx }}
                >
                  {kuerzel}
                </span>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: farbeBg, color: farbeTx }}
                >
                  {start && ende ? `${start.format('HH:mm')} - ${ende.format('HH:mm')}` : '–'}
                </span>

                {e?.kommentar?.trim() && <span title="Kommentar vorhanden">💬</span>}
              </div>

              {/* Rechts: Aktionen */}
              <div className="flex items-center gap-1">
                {status?.ueber?.length > 0 && kuerzel !== '-' && !istVergangenheit && (
                  <button
                    className="text-green-600"
                    title="Überdeckung – Urlaub möglich"
                    onClick={() =>
                      setUrlaubModal({ offen: true, tag: WTAG_KURZ[w], datum: iso, schicht: kuerzel })
                    }
                  >
                    🌿
                  </button>
                )}

                {hatUnterbesetzung && (
                  <button
                    className="text-red-600 animate-pulse"
                    title="Unterbesetzung anzeigen"
                    onClick={() => setInfoOffenIndex(i)}
                  >
                    ❗
                  </button>
                )}

                <button
                  onClick={() => setInfoOffenIndex(infoOffenIndex === i ? null : i)}
                  title={infoOffenIndex === i ? 'Details schließen' : 'Details anzeigen'}
                >
                  {infoOffenIndex === i ? (
                    <Minus className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Plus className="w-4 h-4 text-blue-600" />
                  )}
                </button>
              </div>
            </div>

            {/* Details */}
            {infoOffenIndex === i && (
              <div className="mt-2 bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs">
                {/* Feiertage/Ferien Detail */}
                {tags.length > 0 && (
                  <div className="mb-2 grid grid-cols-1 gap-1">
                    {tags.map((t, idx) => (
                      <div key={idx} className="flex items-center gap-2">
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

                <div>
                  <strong>Von-Bis:</strong> {start?.format('HH:mm')} - {ende?.format('HH:mm')}
                </div>
                <div>
                  <strong>Dauer:</strong> {dauerMin > 0 ? `${stunden}h ${minuten}min` : '–'}
                </div>
                {e?.kommentar && (
                  <div>
                    <strong>Kommentar:</strong> {e.kommentar}
                  </div>
                )}

                {/* Unterbesetzung nach F/N-Regel */}
                {status?.fehlendProSchicht && (
                  <>
                    {[
                      { name: 'Früh', key: 'F', hidden: hideFrueh },
                      { name: 'Spät', key: 'S', hidden: false },
                      { name: 'Nacht', key: 'N', hidden: hideNacht },
                    ].map(({ name, key, hidden }) => {
                      if (hidden) return null;
                      const fehlt = fehlGef[key];
                      if (!fehlt) return null;
                      return (
                        <div
                          key={key}
                          className="cursor-pointer bg-gray-300 dark:bg-gray-500 text-black shadow-xl opacity-90 border-2 border-red-500 dark:border-red-400 rounded-xl px-2 py-1 mb-1"
                          onClick={() =>
                            !istVergangenheit &&
                            setHilfeModal({ offen: true, tag: WTAG_KURZ[w], datum: iso, schicht: key })
                          }
                        >
                          <span className="font-medium">{name}:</span>{' '}
                          {typeof fehlt === 'number' ? `Fehlt ${fehlt} Person(en)` : 'Fehlt'}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Überdeckung → Urlaub */}
                {kuerzel !== '-' &&
                  !istVergangenheit &&
                  !status?.fehlendProSchicht?.[kuerzel] &&
                  status?.ueber?.includes(kuerzel) && (
                    <div className="mt-2 border-2 border-green-300 bg-white dark:bg-gray-900 text-green-700 px-3 py-1 rounded-md shadow-sm">
                      🌿{' '}
                      <button
                        onClick={() =>
                          setUrlaubModal({ offen: true, tag: WTAG_KURZ[w], datum: iso, schicht: kuerzel })
                        }
                        className="font-semibold underline text-green-700"
                      >
                        Ich würde gerne Urlaub nehmen
                      </button>
                    </div>
                  )}

                <div className="text-right mt-2">
                  <button onClick={() => setInfoOffenIndex(null)} className="text-blue-600 hover:underline">
                    Schließen
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
