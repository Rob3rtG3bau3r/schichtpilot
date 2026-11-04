// src/components/Cockpit/EngpassDetektor.jsx
import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Settings, ShieldAlert } from 'lucide-react';

const SCHICHTEN = ['F', 'S', 'N'];
const SCHICHT_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };

const reserveWert = (cell) => {
  if (cell?.topRight === 'blau-2') return 2;
  if (cell?.topRight === 'blau-1') return 1;
  return 0;
};

// ausfallDatenByDate[datum] muss den vollständigen Tagesbedarf enthalten.
// Je benötigtem Arbeitsplatz ein Eintrag in bedarf, auch bei mehrfacher Besetzung.
// Die aufrufende Komponente liefert Kandidaten-IDs nach Qualifikations- und
// Verfügbarkeitsprüfung, einschließlich Arbeitszeit und angrenzender Dienste.
// { geplant: ['ma1', ...], bedarf: [
//   { schicht: 'F', arbeitsplatz: 'Messwarte', direkt: ['ma1', ...],
//     frei: ['ma2', ...], tausch: ['ma3', ...] }
// ] }
// Alle IDs müssen dasselbe Format haben. Pro Person wird maximal ein Einsatz
// pro Planungstag zugelassen. Tauschoptionen müssen im Tagesbedarf abgebildet sein.
const mitKandidaten = (bedarf, mitFrei, mitTausch) => bedarf.map((platz) => ({
  ...platz,
  kandidaten: [...new Set([
    ...platz.direkt,
    ...(mitFrei ? platz.frei ?? [] : []),
    ...(mitTausch ? platz.tausch ?? [] : []),
  ])],
}));

const ermittleOffenePlaetze = (bedarf, gesperrteIds) => {
  const zuordnung = new Map();

  const besetze = (platz, besucht) => {
    for (const id of platz.kandidaten) {
      if (gesperrteIds.has(id) || besucht.has(id)) continue;
      besucht.add(id);
      if (!zuordnung.has(id) || besetze(zuordnung.get(id), besucht)) {
        zuordnung.set(id, platz);
        return true;
      }
    }
    return false;
  };

  return bedarf.filter((platz) => !besetze(platz, new Set()));
};

const zaehleMachbareWechsel = (bedarf, schicht) => {
  const zielPlaetze = bedarf.filter((platz) => platz.schicht === schicht);
  const ausfaelle = new Set(zielPlaetze.flatMap((platz) => platz.direkt));
  const machbar = new Set();

  for (const platz of zielPlaetze) {
    const restbedarf = bedarf.filter((andererPlatz) => andererPlatz !== platz);
    for (const id of platz.tausch ?? []) {
      if (machbar.has(id)) continue;
      // Den Wechsel fest einplanen und alle übrigen Plätze neu besetzen.
      for (const ausfall of ausfaelle) {
        if (id === ausfall) continue;
        if (ermittleOffenePlaetze(restbedarf, new Set([id, ausfall])).length === 0) {
          machbar.add(id);
          break;
        }
      }
    }
  }
  return machbar.size;
};

const pruefeAusfaelle = (daten, mitFrei, mitTausch) => {
  const geplant = [...new Set(daten.geplant)];
  const bedarf = mitKandidaten(daten.bedarf, mitFrei, mitTausch);
  const offenePlaetze = (ausfaelle) => ermittleOffenePlaetze(bedarf, ausfaelle);

  const unterdeckung = offenePlaetze(new Set());
  if (unterdeckung.length) {
    return { score: 0, offenePlaetze: unterdeckung, geprueft: 0 };
  }

  const einzelLuecken = geplant.flatMap((id) => offenePlaetze(new Set([id])));
  if (einzelLuecken.length) {
    return { score: 35, offenePlaetze: einzelLuecken, geprueft: 1 };
  }

  const hatLuecke = (anzahl, start = 0, ausfaelle = new Set()) => {
    if (anzahl === 0) return offenePlaetze(ausfaelle).length > 0;
    for (let index = start; index <= geplant.length - anzahl; index += 1) {
      const id = geplant[index];
      ausfaelle.add(id);
      const luecke = hatLuecke(anzahl - 1, index + 1, ausfaelle);
      ausfaelle.delete(id);
      if (luecke) return true;
    }
    return false;
  };

  let abgesichert = 1;
  for (let anzahl = 2; anzahl <= Math.min(3, geplant.length); anzahl += 1) {
    if (hatLuecke(anzahl)) break;
    abgesichert = anzahl;
  }

  return {
    score: [0, 60, 75, 90][abgesichert],
    offenePlaetze: [],
    geprueft: abgesichert,
  };
};

const EngpassDetektor = ({
  tage = [],
  bedarfStatus = { F: {}, S: {}, N: {} },
  freischichtReserveByDate = {},
  ausfallDatenByDate,
  urlaubPuffer,
  darfUrlaubPufferSpeichern = false,
  urlaubFehler,
  urlaubSpeichert,
  onUrlaubPufferChange,
  heutigesDatum,
  tauschBeruecksichtigen = false,
  setTauschBeruecksichtigen,
  freischichtenBeruecksichtigen = false,
  setFreischichtenBeruecksichtigen,
}) => {
  const [settingsOffen, setSettingsOffen] = useState(false);
  const [detailDatum, setDetailDatum] = useState(null);

  const analyseByDate = useMemo(() => {
    const out = {};

    for (const datum of tage) {
      const cells = SCHICHTEN.map((schicht) => bedarfStatus?.[schicht]?.[datum]);
      const hatBedarf = cells.some((cell) => cell?.farbe);

      const daten = ausfallDatenByDate?.[datum];
      const hatAusfallDaten = daten?.bedarf?.length > 0 && daten?.geplant?.length > 0;

      if (!hatBedarf && !hatAusfallDaten) {
        out[datum] = {
          status: 'neutral',
          score: null,
          label: 'Keine Bewertung',
          reserves: [0, 0, 0],
          reserveGesamt: 0,
          reserveSchichten: 0,
          frei: 0,
          unterdeckte: [],
        };
        continue;
      }

      const unterdeckte = cells
        .map((cell, index) => ({ cell, schicht: SCHICHTEN[index] }))
        .filter(({ cell }) => String(cell?.farbe || '').includes('bg-red'))
        .map(({ schicht }) => schicht);

      const reserves = cells.map(reserveWert);
      const reserveSchichten = reserves.filter((reserve) => reserve > 0).length;
      const reserveGesamt = reserves.reduce((sum, reserve) => sum + reserve, 0);
      const frei = freischichtenBeruecksichtigen
        ? Number(freischichtReserveByDate?.[datum] || 0)
        : 0;

      if (unterdeckte.length > 0) {
        out[datum] = {
          status: 'rot',
          score: 0,
          label: 'Unterdeckung',
          reserves,
          reserveGesamt,
          reserveSchichten,
          frei,
          unterdeckte,
          className: 'bg-red-600',
        };
        continue;
      }

      const ausfallAnalyse = hatAusfallDaten
        ? pruefeAusfaelle(daten, freischichtenBeruecksichtigen, tauschBeruecksichtigen)
        : null;

      // Rückfall auf die bisherige Bewertung für Aufrufer ohne Ausfalldaten.
      // V1: bewusst einfacher Robustheitswert.
      // Die Verteilung der Reserve über mehrere Schichten zählt stärker
      // als dieselbe Reservezahl nur in einer einzigen Schicht.
      let score = 30 + reserveSchichten * 12 + reserveGesamt * 6;

      if (tauschBeruecksichtigen && reserveGesamt > 0 && reserveSchichten < 3) {
        score += Math.min(8, reserveGesamt * 4);
      }

      // Freischichten sind nur potenzielle Reserve und daher geringer gewichtet.
      if (freischichtenBeruecksichtigen && frei > 0) {
        score += Math.min(10, frei * 5);
      }

      score = ausfallAnalyse?.score ?? Math.max(0, Math.min(100, score));

      let status = 'orange-dunkel';
      let label = 'Hohes Risiko';
      let className = 'bg-orange-700';

      if (score === 0) {
        status = 'rot';
        label = 'Unterdeckung';
        className = 'bg-red-600';
      } else if (score > 80) {
        status = 'gruen';
        label = 'Sehr stabil';
        className = 'bg-green-600';
      } else if (score > 65) {
        status = 'blau';
        label = 'Stabil';
        className = 'bg-blue-500';
      } else if (score > 50) {
        status = 'gelb';
        label = 'Mittleres Risiko';
        className = 'bg-yellow-400';
      } else if (score > 35) {
        status = 'orange';
        label = 'Erhöhtes Risiko';
        className = 'bg-orange-500';
      }

      out[datum] = {
        status,
        score,
        label,
        className,
        reserves,
        reserveGesamt,
        reserveSchichten,
        frei,
        unterdeckte: score === 0
          ? [...new Set(ausfallAnalyse.offenePlaetze.map((platz) => platz.schicht))]
          : [],
        ausfallAnalyse,
      };
    }

    return out;
  }, [
    ausfallDatenByDate,
    tage,
    bedarfStatus,
    tauschBeruecksichtigen,
    freischichtenBeruecksichtigen,
    freischichtReserveByDate,
  ]);

  const detail = detailDatum ? analyseByDate?.[detailDatum] : null;
  const detailBedarf = mitKandidaten(
    ausfallDatenByDate?.[detailDatum]?.bedarf ?? [],
    false, // Die Wechselzahl zeigt nur Lösungen mit eingeplanten Mitarbeitern.
    tauschBeruecksichtigen,
  );

  return (
    <>
      <div className="flex w-full border-b border-gray-300 dark:border-gray-700 bg-gray-100/80 dark:bg-gray-900/50">
        <div className="relative w-[176px] min-w-[176px] h-[30px] flex items-center px-2 gap-2 text-xs font-semibold">
          <ShieldAlert size={14} className="text-orange-500" />

          <span className="flex-1 text-left">
            Engpass-Detektor
          </span>

          <button
            type="button"
            onClick={() => setSettingsOffen((prev) => !prev)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Engpass-Einstellungen"
          >
            <Settings size={14} />
          </button>

          {settingsOffen && (
            <div className="absolute left-2 top-8 z-[60] w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-xl p-3 text-xs font-normal">
              <div className="font-semibold mb-2">Engpass-Analyse</div>

              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tauschBeruecksichtigen}
                  onChange={(e) => setTauschBeruecksichtigen?.(e.target.checked)}
                />
                Schichttausch berücksichtigen
              </label>

              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freischichtenBeruecksichtigen}
                  onChange={(e) => setFreischichtenBeruecksichtigen?.(e.target.checked)}
                />
                Freischichten berücksichtigen
              </label>

              {[
                ['engpass_urlaub_vor', 'Vor dem Urlaub'],
                ['engpass_urlaub_nach', 'Nach dem Urlaub'],
              ].map(([feld, label]) => (
                darfUrlaubPufferSpeichern ? (
                <label key={feld} className="flex items-center justify-between gap-2 py-1">
                  {label}
                  <select
                    className="rounded border bg-white dark:bg-gray-800"
                    value={urlaubPuffer?.[feld] ?? 0}
                    disabled={!urlaubPuffer || urlaubSpeichert}
                    onChange={(e) => onUrlaubPufferChange(feld, Number(e.target.value))}
                  >
                    <option value={0}>Aus</option>
                    {Array.from({ length: 6 }, (_, i) => i + 1).map((tage) => (
                      <option key={tage} value={tage}>{tage} {tage === 1 ? 'Tag' : 'Tage'}</option>
                    ))}
                  </select>
                </label>
                ) : (
                  <div key={feld} className="flex items-center justify-between gap-2 py-1">
                    <span>{label}</span>
                    <span>{urlaubPuffer
                      ? urlaubPuffer[feld] ? `${urlaubPuffer[feld]} Kalendertage` : 'Aus'
                      : '–'}</span>
                  </div>
                )
              ))}
              <div className="mt-1 text-[10px]">Urlaubspuffer gelten für die gesamte Unit.</div>
              {urlaubFehler && <div role="alert" className="mt-1 text-red-600">{urlaubFehler}</div>}

              <div className="mt-2 text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
                Ohne Optionen bewertet der Detektor nur die Reserve innerhalb der geplanten Schichten.
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-[2px] min-w-fit h-[30px] items-center">
          {tage.map((datum) => {
            const analyse = analyseByDate?.[datum];
            const bewertbar = analyse?.score != null;

            return (
              <button
                type="button"
                key={`engpass-${datum}`}
                onClick={() => bewertbar && setDetailDatum(datum)}
                className={`w-[48px] min-w-[48px] h-[18px] text-xs rounded-sm border border-black/10 dark:border-white/10 transition-opacity ${
                  bewertbar
                    ? `${analyse.className} hover:opacity-80 cursor-pointer`
                    : 'bg-gray-300/30 dark:bg-gray-700/30 cursor-default'
                } ${datum === heutigesDatum ? 'ring-1 ring-yellow-400' : ''}`}
                title={
                  bewertbar
                    ? `${dayjs(datum).format('DD.MM.YYYY')} · ${analyse.label} · Score ${analyse.score}`
                    : 'Keine Engpassbewertung für diesen Tag'
                }
              >
                {bewertbar && (
                  <span className="text-[9px] font-bold text-white drop-shadow">
                    {analyse.score}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {detailDatum && detail && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setDetailDatum(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  Engpassanalyse · {dayjs(detailDatum).format('DD.MM.YYYY')}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Robustheits-Score {detail.score ?? '–'} / 100
                </div>
              </div>

              <div
                className={`px-2 py-1 rounded text-xs font-semibold text-white ${detail.className || 'bg-gray-500'}`}
              >
                {detail.label}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {SCHICHTEN.map((schicht, index) => (
                <div
                  key={schicht}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-2"
                >
                  <div className="text-gray-500 dark:text-gray-400">
                    {SCHICHT_LABEL[schicht]}
                  </div>
                  <div className="font-semibold mt-1">
                    Reserve +{detail.reserves?.[index] || 0}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 text-xs space-y-2">
              {detail.unterdeckte?.length > 0 ? (
                <div>
                  ❌ Unterdeckung in:{' '}
                  <b>{detail.unterdeckte.map((s) => SCHICHT_LABEL[s] || s).join(', ')}</b>
                </div>
              ) : (
                <div>✓ Der aktuelle Mindestbedarf aller bewerteten Schichten ist gedeckt.</div>
              )}

              {detail.ausfallAnalyse?.geprueft > 0 && (
                detail.ausfallAnalyse.offenePlaetze.length > 0 ? (
                  <div>
                    Mögliche Lücken bei einem Einzelausfall{' '}
                    <b>{[...new Set(detail.ausfallAnalyse.offenePlaetze.map(
                      ({ schicht, arbeitsplatz }) => `${SCHICHT_LABEL[schicht] || schicht} · ${arbeitsplatz}`,
                    ))].join(', ')}</b>
                  </div>
                ) : (
                  <div>
                    Alle geprüften Kombinationen mit bis zu{' '}
                    <b>{detail.ausfallAnalyse.geprueft}</b> Ausfällen sind abdeckbar.
                  </div>
                )
              )}
              {!detail.ausfallAnalyse && !detail.unterdeckte.length && (
                <div>Bewertung anhand der Reservemarker. Qualifikationsdaten fehlen.</div>
              )}

              <div>
                Direkte Reserve gesamt: <b>{detail.reserveGesamt || 0}</b> in{' '}
                <b>{detail.reserveSchichten || 0}</b> Schicht(en).
              </div>

              {tauschBeruecksichtigen && (
                <div>↔ Schichttausch wird in der Risikobewertung berücksichtigt.</div>
              )}

              {(freischichtenBeruecksichtigen || tauschBeruecksichtigen) && (
                <div>
                  <div className="font-semibold">Potenzielle Kandidaten je Schicht</div>
                  {detailBedarf.length > 0 ? (
                    <>
                      <ul className="mt-1 space-y-1">
                        {SCHICHTEN.map((schicht) => {
                          const plaetze = detailBedarf.filter((platz) => platz.schicht === schicht);
                          const freie = new Set(plaetze.flatMap((platz) => platz.frei ?? []));

                          return (
                            <li key={schicht}>
                              <b>{SCHICHT_LABEL[schicht]}</b>{' · '}
                              {plaetze.length === 0
                                ? 'Kein bewerteter Bedarf'
                                : [
                                  freischichtenBeruecksichtigen && `${freie.size} aus Frei`,
                                  tauschBeruecksichtigen && `${zaehleMachbareWechsel(detailBedarf, schicht)} für Wechsel ohne Freischicht`,
                                ].filter(Boolean).join(' · ')}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-1 text-gray-500 dark:text-gray-400">
                        Eine Person kann für mehrere Schichten infrage kommen.
                        Für die Wechselzahl müssen bei einem Einzelausfall alle
                        Schichten mit eingeplanten Mitarbeitern besetzbar bleiben.
                      </div>
                    </>
                  ) : (
                    <div>Für diesen Tag liegen keine Kandidatenzahlen je Schicht vor.</div>
                  )}
                </div>
              )}

              {freischichtenBeruecksichtigen && (
                <div>
                  Potenzielle Freischichtreserve am Tag vor Prüfung je Schicht{' '}
                  <b>{detail.frei || 0}</b>.
                </div>
              )}
            </div>

            <div className="mt-3 text-[10px] text-gray-500 dark:text-gray-400">
              Die Einstufung ist ein Planungshinweis. Sie ändert oder genehmigt keine Dienste.
            </div>

            <div className="mt-4 text-right">
              <button
                type="button"
                onClick={() => setDetailDatum(null)}
                className="px-3 py-1.5 rounded bg-gray-200 dark:bg-gray-700 text-xs"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EngpassDetektor;
