// src/components/UnitReports/MonthView.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import MonthsCharts from './MonthsCharts';
import { MONTHS, deNumber, dePercent, colorBySign, FALLBACK_COLORS } from './unitReportsShared';

const Card = ({ className='', children, ...rest }) => (
  <div className={`rounded-2xl shadow-sm border border-gray-400 dark:border-bg-gray-200 dark:bg-gray-800 p-2 ${className}`} {...rest}>
    {children}
  </div>
);
const Muted = ({ className='', children, ...rest }) => (
  <span className={`text-gray-500 dark:text-gray-300 ${className}`} {...rest}>{children}</span>
);

const KuerzelTable = ({ title, data, unit }) => {
  const rows = Object.entries(data ?? {}).map(([k,v])=>({k, v})).sort((a,b)=> (b.v ?? 0) - (a.v ?? 0));
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b flex items-center gap-2">
        <Calendar className="w-4 h-4" /><span className="font-medium">{title}</span>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left sticky top-0 bg-white/10">
              <th className="px-4 py-2">Kürzel</th>
              <th className="px-4 py-2 text-right">Wert</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td className="px-4 py-3 text-gray-500" colSpan={2}>Keine Daten</td></tr>
            )}
            {rows.map((r, idx)=> (
              <tr key={r.k} className="hover:bg-white/5">
                <td className="px-4 py-2 font-mono flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: FALLBACK_COLORS[idx % FALLBACK_COLORS.length] }} />
                  {r.k}
                </td>
                <td className="px-4 py-2 text-right">{unit === 'h' ? deNumber(r.v) : deNumber(r.v,0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default function MonthView({
  year,
  monthRow,
  monthDiff,
  monthK, monthKO,
  monthKCount, monthKOCount,
  monthKQuote, monthKOQuote,
  monthPlanQuote,
  monthTopKuerzel,
  colorFor,
}) {
  return (
    <div className="grid md:grid-cols-12 gap-4">
      {/* Links */}
      <div className="md:col-span-6 space-y-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Monatsübersicht</span>
            </div>
            <Muted>{monthRow ? MONTHS[monthRow.monat - 1] + ' ' + year : '–'}</Muted>
          </div>

          {!monthRow && <Muted>Wähle einen fertigen Monat oben aus.</Muted>}

          {monthRow && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {typeof monthRow.soll_stunden_sum === 'number' && (
                <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                  <div className="text-sm text-gray-400">Ist-Stunden</div>
                  <div className="text-lg font-semibold">{deNumber(monthRow.ist_stunden_sum)}</div>
                </div>
              )}

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Soll-Stunden</div>
                <div className="text-lg font-semibold">{deNumber(monthRow.soll_stunden_sum)}</div>
              </div>

              {monthDiff != null && (
                <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                  <div className="text-sm text-gray-400">Differenz (Ist−Soll)</div>
                  <div className={`text-lg font-semibold ${colorBySign(monthDiff)}`}>
                    {monthDiff >= 0 ? '+' : '-'}{deNumber(Math.abs(monthDiff))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Urlaubstage</div>
                <div className="text-lg font-semibold">{deNumber(monthRow.urlaubstage_sum, 0)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">K-Tage</div>
                <div className="text-lg font-semibold">{deNumber(monthKCount, 0)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">KO-Tage</div>
                <div className="text-lg font-semibold">{deNumber(monthKOCount, 0)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">K-Stunden</div>
                <div className="text-lg font-semibold">{deNumber(monthK)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">KO-Stunden</div>
                <div className="text-lg font-semibold">{deNumber(monthKO)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">K-% (Stundenbasis)</div>
                <div className="text-lg font-semibold">{dePercent(monthKQuote)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">KO-% (Stundenbasis)</div>
                <div className="text-lg font-semibold">{dePercent(monthKOQuote)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">10/11/12 Std Einsätze</div>
                <div className="text-lg font-semibold">
                  {(monthRow.dauer10_count ?? 0) + (monthRow.dauer11_count ?? 0) + (monthRow.dauer12_count ?? 0)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  10h {monthRow.dauer10_count ?? 0} · 11h {monthRow.dauer11_count ?? 0} · 12h {monthRow.dauer12_count ?? 0}
                </div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Planänderungen gesamt</div>
                <div className="text-lg font-semibold">{deNumber(monthRow?.planchg_total ?? 0, 0)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Planänderungen (aus dem Rhythmus)</div>
                <div className="text-lg font-semibold">{deNumber(monthRow?.planchg_off_rhythm ?? 0, 0)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Planerfüllung</div>
                <div className="text-lg font-semibold">{dePercent(monthPlanQuote)}</div>
              </div>

              <div className="rounded-xl border border-gray-400 dark:border-gray-700 bg-gray-200 dark:bg-gray-900 p-3 shadow">
                <div className="text-sm text-gray-400">Kurzfristigkeit ≤1 / 2–≤3 / 4–6 / ≥7 Tage</div>
                <div className="text-lg font-semibold">
                  {(monthRow?.kurzfrist_1d ?? 0)} / {(monthRow?.kurzfrist_3d ?? 0)} / {(monthRow?.kurzfrist_7d ?? 0)} / {(monthRow?.kurzfrist_gt7d ?? 0)}
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <KuerzelTable title="Kürzel – Counts" data={monthRow?.kuerzel_count ?? null} unit="count" />
          <KuerzelTable title="Kürzel – Stunden" data={monthRow?.kuerzel_stunden ?? null} unit="h" />
        </div>
      </div>

      {/* Rechts */}
      <div className="md:col-span-6 space-y-4">
        <MonthsCharts
          monthRow={monthRow}
          monthTopKuerzel={monthTopKuerzel}
          colorFor={colorFor}
          monthK={monthK}
          monthKO={monthKO}
        />
      </div>
    </div>
  );
}
