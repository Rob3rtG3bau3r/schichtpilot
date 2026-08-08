// src/components/Cockpit/EngpassDetektor.jsx
import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Settings, ShieldAlert } from 'lucide-react';

const SCHICHTEN = ['F', 'S', 'N'];
const SCHICHT_LABEL = { F: 'Früh', S: 'Spät', N: 'Nacht' };

const reserveWert = (cell) => {
  if (cell?.topRight === 'blau-2') return 2;
  if (cell?.topRight === 'blau-1') return 1;
  return 0;
};

const EngpassDetektor = ({
  tage = [],
  bedarfStatus = { F: {}, S: {}, N: {} },
  freischichtReserveByDate = {},
  unit,
  heutigesDatum,
}) => {
  const [settingsOffen, setSettingsOffen] = useState(false);
  const [tauschBeruecksichtigen, setTauschBeruecksichtigen] = useState(false);
  const [freischichtenBeruecksichtigen, setFreischichtenBeruecksichtigen] = useState(false);
  const [detailDatum, setDetailDatum] = useState(null);

  // Einstellung bewusst lokal je Unit merken. Keine weitere Supabase-Abfrage.
  useEffect(() => {
    if (!unit) return;
    try {
      const raw = localStorage.getItem(`sp_engpass_${unit}`);
      if (!raw) return;
      const cfg = JSON.parse(raw);
      if (typeof cfg.tausch === 'boolean') setTauschBeruecksichtigen(cfg.tausch);
      if (typeof cfg.freischichten === 'boolean') {
        setFreischichtenBeruecksichtigen(cfg.freischichten);
      }
    } catch {
      // Alte/defekte lokale Einstellung ignorieren.
    }
  }, [unit]);

  useEffect(() => {
    if (!unit) return;
    localStorage.setItem(
      `sp_engpass_${unit}`,
      JSON.stringify({
        tausch: tauschBeruecksichtigen,
        freischichten: freischichtenBeruecksichtigen,
      })
    );
  }, [unit, tauschBeruecksichtigen, freischichtenBeruecksichtigen]);

  const analyseByDate = useMemo(() => {
    const out = {};

    for (const datum of tage) {
      const cells = SCHICHTEN.map((schicht) => bedarfStatus?.[schicht]?.[datum]);
      const hatBedarf = cells.some((cell) => cell?.farbe);

      if (!hatBedarf) {
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

      score = Math.max(0, Math.min(100, score));

      let status = 'orange-dunkel';
      let label = 'Hohes Risiko';
      let className = 'bg-orange-700';

      if (score > 80) {
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
        unterdeckte: [],
      };
    }

    return out;
  }, [
    tage,
    bedarfStatus,
    tauschBeruecksichtigen,
    freischichtenBeruecksichtigen,
    freischichtReserveByDate,
  ]);

  const detail = detailDatum ? analyseByDate?.[detailDatum] : null;

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
                  onChange={(e) => setTauschBeruecksichtigen(e.target.checked)}
                />
                Schichttausch berücksichtigen
              </label>

              <label className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={freischichtenBeruecksichtigen}
                  onChange={(e) => setFreischichtenBeruecksichtigen(e.target.checked)}
                />
                Freischichten berücksichtigen
              </label>

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
                className={`w-[48px] min-w-[48px] h-[22px] rounded-sm border border-black/10 dark:border-white/10 transition-opacity ${
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

              <div>
                Direkte Reserve gesamt: <b>{detail.reserveGesamt || 0}</b> in{' '}
                <b>{detail.reserveSchichten || 0}</b> Schicht(en).
              </div>

              {tauschBeruecksichtigen && (
                <div>↔ Schichttausch wird in der Risikobewertung berücksichtigt.</div>
              )}

              {freischichtenBeruecksichtigen && (
                <div>
                  ○ Potenzielle Freischichtreserve: <b>{detail.frei || 0}</b>.
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
