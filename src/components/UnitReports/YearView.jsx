// src/components/UnitReports/YearView.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import YearCharts from './YearCharts';
import { deNumber, dePercent, colorBySign } from './unitReportsShared';

const Card = ({ className='', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-300 dark:border-gray-700 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Muted = ({ className='', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);

export default function YearView({
  year,
  ytdRow,
  atLeastOneReady,
  ytdKrankQuote,
  chartVis,

  fullYearRows,
  monthlyDiffSeries,
  cumBothIncl,
  monthlyChangeSeries,
  monthlyShortNotice,

  availableKuerzel,
  customKuerzel,
  setCustomKuerzel,
  chosenKuerzel,
  kuerzelSeriesPerMonth,
  colorFor,
}) {
  return (
    <div className="grid md:grid-cols-12 gap-4">
      {/* Links */}
      <div className="md:col-span-6 space-y-4">
        <Card className="min-h-[14rem]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Jahresübersicht</span>
            </div>
            <Muted>{year} · bis Monat {ytdRow?.bis_monat ?? '–'}</Muted>
          </div>

          {!atLeastOneReady ? (
            <Muted className="px-3 pb-3">Noch kein Monat finalisiert.</Muted>
          ) : (
            <div className="h-[calc(100%-2.5rem)] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Ist-Stunden (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.ytd_ist ?? 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Soll-Stunden (YTD)</div>
                  <div className="text-base font-semibold leading-tight">
                    {ytdRow?.ytd_soll != null ? deNumber(ytdRow.ytd_soll) : '–'}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Differenz (Ist−Soll, YTD)</div>
                  <div className={`text-base font-semibold leading-tight ${colorBySign(ytdRow?.ytd_diff ?? 0)}`}>
                    {ytdRow?.ytd_diff == null ? '–' : (ytdRow.ytd_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.ytd_diff))}
                  </div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Stunden · gesamtes Jahr
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Ist-Stunden (Jahr)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.year_ist ?? 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Soll-Stunden (Jahr)</div>
                  <div className="text-base font-semibold leading-tight">
                    {ytdRow?.year_soll != null ? deNumber(ytdRow.year_soll) : '–'}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Differenz (Ist−Soll, Jahr)</div>
                  <div className={`text-base font-semibold leading-tight ${colorBySign(ytdRow?.year_diff ?? 0)}`}>
                    {ytdRow?.year_diff == null ? '–' : (ytdRow.year_diff >= 0 ? '+' : '-') + deNumber(Math.abs(ytdRow.year_diff))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Vorjahresstunden (Übernahme)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.year_uebernahme ?? 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Ist-Stunden inkl. Übernahme (Jahr)</div>
                  <div className="text-base font-semibold leading-tight">
                    {deNumber(ytdRow?.year_ist_incl ?? ((ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0)))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Differenz inkl. Übernahme (Ist+Übernahme − Soll)</div>
                  <div className={`text-base font-semibold leading-tight ${colorBySign(
                    (ytdRow?.year_diff_incl ??
                      ((ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0) - (ytdRow?.year_soll ?? 0)))
                  )}`}>
                    {(() => {
                      const v = (ytdRow?.year_diff_incl ??
                        ((ytdRow?.year_ist ?? 0) + (ytdRow?.year_uebernahme ?? 0) - (ytdRow?.year_soll ?? 0)));
                      return (v >= 0 ? '+' : '-') + deNumber(Math.abs(v));
                    })()}
                  </div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Urlaub · bis Monat {ytdRow?.bis_monat ?? '–'}
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Urlaubstage (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.ytd_urlaub ?? 0, 0)}</div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Urlaub · gesamtes Jahr
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Urlaubstage (Jahr)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.year_urlaub ?? 0, 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Urlaubstage-Soll (Jahr)</div>
                  <div className="text-base font-semibold leading-tight">
                    {ytdRow?.year_urlaub_soll != null ? deNumber(ytdRow.year_urlaub_soll, 0) : '–'}
                  </div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Krank · bis Monat {ytdRow?.bis_monat ?? '–'}
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Kranktage (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.kranktage_ytd ?? 0, 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Krank-Stunden (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.krank_stunden_ytd ?? 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Krank-% (Stundenbasis, YTD)</div>
                  <div className="text-base font-semibold leading-tight">{dePercent(ytdKrankQuote)}</div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Einsätze über 10 Stunden · bis Monat {ytdRow?.bis_monat ?? '–'}
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">10/11/12 Std Einsätze (YTD)</div>
                  <div className="text-base font-semibold leading-tight">
                    {(ytdRow?.dauer10_ytd ?? 0) + (ytdRow?.dauer11_ytd ?? 0) + (ytdRow?.dauer12_ytd ?? 0)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-1">
                    10h {ytdRow?.dauer10_ytd ?? 0} · 11h {ytdRow?.dauer11_ytd ?? 0} · 12h {ytdRow?.dauer12_ytd ?? 0}
                  </div>
                </div>

                <div className="col-span-full mt-1 text-[10px] uppercase tracking-wide text-gray-500">
                  Planänderungen · bis Monat {ytdRow?.bis_monat ?? '–'}
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Gesamt (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.planchg_total_ytd ?? 0, 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Aus dem Rhythmus (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{deNumber(ytdRow?.planchg_off_rhythm_ytd ?? 0, 0)}</div>
                </div>

                <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-2 bg-gray-300/60 dark:bg-gray-900/50">
                  <div className="text-xs text-gray-500">Planerfüllung (YTD)</div>
                  <div className="text-base font-semibold leading-tight">{dePercent(ytdRow?.planerfuellung_ytd)}</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Rechts: Charts */}
      <div className="md:col-span-6 space-y-4">
        <YearCharts
          chartVis={chartVis}
          fullYearRows={fullYearRows}
          monthlyDiffSeries={monthlyDiffSeries}
          cumBothIncl={cumBothIncl}
          monthlyChangeSeries={monthlyChangeSeries}
          monthlyShortNotice={monthlyShortNotice}
          availableKuerzel={availableKuerzel}
          customKuerzel={customKuerzel}
          setCustomKuerzel={setCustomKuerzel}
          chosenKuerzel={chosenKuerzel}
          kuerzelSeriesPerMonth={kuerzelSeriesPerMonth}
          colorFor={colorFor}
        />
      </div>
    </div>
  );
}
